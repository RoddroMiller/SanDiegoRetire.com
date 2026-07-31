import { useState, useEffect, useCallback, useRef } from 'react';
import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver
} from 'firebase/auth';
import { auth, MASTER_EMAIL, signInToCommandCenter } from '../constants';
import {
  checkAccountLockout,
  recordFailedAttempt,
  resetFailedAttempts,
  checkPasswordExpiry
} from '../utils/accountSecurity';

/**
 * Custom hook for managing authentication state and actions
 * @returns {object} Auth state and handlers
 */
export const useAuth = () => {
  const [viewMode, setViewMode] = useState('gate');
  const [userRole, setUserRole] = useState('anonymous');
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [resetStatus, setResetStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'

  // MFA State
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEnrollRequired, setMfaEnrollRequired] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const mfaResolverRef = useRef(null);
  const totpSecretRef = useRef(null);
  const pendingCredentialsRef = useRef(null);

  // Password Expiry State (BOSP Compliance)
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [passwordExpiryEmail, setPasswordExpiryEmail] = useState('');

  // Listen to auth state changes
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        if (user.isAnonymous) {
          setUserRole('anonymous');
        } else {
          // Role comes from a server-set custom auth claim, assigned by the master via
          // the setUserRole Cloud Function. It is never inferred from data the user can
          // create — the previous approach scanned every plan in the database and
          // defaulted unknown users to 'advisor', so anyone who signed up became an
          // advisor and the read rule had to be wide open for the scan to work.
          //
          // No claim means no privileges: the user still sees plans assigned to their
          // own email (enforced server-side), which is the correct least-privilege
          // landing spot for both new signups and advisors awaiting a claim.
          if (user.email && user.email.toLowerCase() === MASTER_EMAIL.toLowerCase()) {
            setUserRole('master');
          } else {
            try {
              const { claims } = await user.getIdTokenResult();
              const claimedRole = claims?.role;
              if (claimedRole === 'master' || claimedRole === 'advisor' || claimedRole === 'registeredClient') {
                setUserRole(claimedRole);
              } else {
                setUserRole('registeredClient');
              }
            } catch {
              // Fail closed — least privilege if the token can't be read
              setUserRole('registeredClient');
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Handle anonymous prospective client entry
   */
  const handleProspectEntry = useCallback(async () => {
    setIsLoggingIn(true);
    if (!auth) {
      setViewMode('app');
      setIsLoggingIn(false);
      return;
    }
    try {
      await signInAnonymously(auth);
      setViewMode('app');
    } catch (e) {
      console.error(e);
      alert("Could not start session.");
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  /**
   * Handle registered client login
   * @param {string} email - Client email
   * @param {string} password - Client password
   */
  const handleClientLogin = useCallback(async (email, password) => {
    if (!auth) return;
    setAuthError('');
    setMfaError('');

    // BOSP: Check account lockout before attempting login
    const lockoutStatus = await checkAccountLockout(email);
    if (lockoutStatus.locked) {
      setAuthError(lockoutStatus.message);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // BOSP: Reset failed attempts on successful login
      await resetFailedAttempts(email);

      // Check if MFA is enrolled
      const enrolledFactors = multiFactor(userCredential.user).enrolledFactors;
      if (enrolledFactors.length === 0) {
        // MFA not enrolled - require enrollment
        pendingCredentialsRef.current = { email, password };
        setMfaEnrollRequired(true);
        return;
      }

      // BOSP: Check password expiry
      const expiryStatus = await checkPasswordExpiry(email);
      if (expiryStatus.expired) {
        setPasswordExpiryEmail(email);
        setPasswordExpired(true);
        return;
      }

      // Also sign in to Command Center to enable cross-project queries
      await signInToCommandCenter(email, password);
      // The onAuthStateChanged will set the role to 'registeredClient'
      setViewMode('app');
    } catch (e) {
      console.log('Client login error:', e.code, e.message);
      if (e.code === 'auth/multi-factor-auth-required') {
        // MFA verification required - don't count as failed attempt
        console.log('MFA required, showing verification modal');
        mfaResolverRef.current = getMultiFactorResolver(auth, e);
        pendingCredentialsRef.current = { email, password };
        setMfaRequired(true);
      } else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        // BOSP: Record failed attempt
        const result = await recordFailedAttempt(email);
        if (result.isLocked) {
          setAuthError('Too many failed attempts. Account locked for 15 minutes.');
        } else {
          setAuthError(`Invalid email or password. ${result.remainingAttempts} attempt${result.remainingAttempts !== 1 ? 's' : ''} remaining.`);
        }
      } else {
        setAuthError(e.message);
      }
    }
  }, []);

  /**
   * Handle registered client signup
   * @param {string} email - Client email
   * @param {string} password - Client password
   */
  // Client logins are disabled — no client should be able to create an account. The
  // entry point was removed from GateScreen a while back, but this path still created
  // real Firebase accounts if it was ever reached, so it now refuses outright rather
  // than being left as a dormant signup route. Prospects use the anonymous wizard
  // (ClientWizard) and never need a login.
  const handleClientSignup = useCallback(async () => {
    setAuthError('Client accounts are not available. Please contact your advisor.');
  }, []);

  /**
   * Handle password reset request
   * @param {string} email - Email to send reset link to
   */
  const handlePasswordReset = useCallback(async (email) => {
    if (!auth) return;
    setResetStatus('sending');
    try {
      await sendPasswordResetEmail(auth, email);
      setResetStatus('sent');
    } catch (e) {
      console.error('Password reset error:', e);
      setResetStatus('error');
      if (e.code === 'auth/user-not-found') {
        setAuthError('No account found with this email address.');
      } else {
        setAuthError(e.message);
      }
    }
  }, []);

  /**
   * Handle advisor login or signup
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {boolean} isSignup - Whether this is a signup vs login
   */
  const handleAdvisorLogin = useCallback(async (email, password, isSignup) => {
    if (!auth) return;
    setAuthError('');
    setMfaError('');

    // BOSP: Check account lockout before attempting login (not for signup)
    if (!isSignup) {
      const lockoutStatus = await checkAccountLockout(email);
      if (lockoutStatus.locked) {
        setAuthError(lockoutStatus.message);
        return;
      }
    }

    try {
      let userCredential;
      if (isSignup) {
        // Advisor accounts are provisioned by the master, not self-service. Leaving this
        // open let anyone create an advisor account. Kept as a guarded branch (rather
        // than deleted) so any stale caller fails loudly instead of silently creating one.
        setAuthError('Advisor accounts are created by your administrator. Please contact them for access.');
        return;
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);

        // BOSP: Reset failed attempts on successful login
        await resetFailedAttempts(email);

        // Check if MFA is enrolled
        const enrolledFactors = multiFactor(userCredential.user).enrolledFactors;
        if (enrolledFactors.length === 0) {
          // MFA not enrolled - require enrollment
          pendingCredentialsRef.current = { email, password };
          setMfaEnrollRequired(true);
          return;
        }

        // BOSP: Check password expiry
        const expiryStatus = await checkPasswordExpiry(email);
        if (expiryStatus.expired) {
          setPasswordExpiryEmail(email);
          setPasswordExpired(true);
          return;
        }
      }
      // Also sign in to Command Center to enable cross-project queries
      await signInToCommandCenter(email, password);
      setViewMode('app');
    } catch (e) {
      console.log('Login error:', e.code, e.message);
      if (e.code === 'auth/multi-factor-auth-required') {
        // MFA verification required - don't count as failed attempt
        console.log('MFA required, showing verification modal');
        mfaResolverRef.current = getMultiFactorResolver(auth, e);
        pendingCredentialsRef.current = { email, password };
        setMfaRequired(true);
      } else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        // BOSP: Record failed attempt
        const result = await recordFailedAttempt(email);
        if (result.isLocked) {
          setAuthError('Too many failed attempts. Account locked for 15 minutes.');
        } else {
          setAuthError(`Invalid email or password. ${result.remainingAttempts} attempt${result.remainingAttempts !== 1 ? 's' : ''} remaining.`);
        }
      } else {
        setAuthError(e.message);
      }
    }
  }, []);

  /**
   * Handle user logout
   * @param {function} onLogout - Callback to run after logout (e.g., clear scenarios)
   */
  const handleLogout = useCallback(async (onLogout) => {
    if (!auth) return;
    await signOut(auth);
    setViewMode('gate');
    if (onLogout) onLogout();
  }, []);

  /**
   * Start MFA enrollment process - generates QR code URL
   */
  const startMfaEnrollment = useCallback(async () => {
    const user = auth?.currentUser;
    if (!user) {
      setMfaError('You must be signed in to set up MFA.');
      return null;
    }
    try {
      const mfaSession = await multiFactor(user).getSession();
      const totpSecret = await TotpMultiFactorGenerator.generateSecret(mfaSession);
      totpSecretRef.current = totpSecret;

      // Generate QR code URL
      const qrUrl = totpSecret.generateQrCodeUrl(user.email, 'Portfolio Architect');
      return {
        qrUrl,
        secretKey: totpSecret.secretKey
      };
    } catch (e) {
      console.error('MFA enrollment error:', e);
      setMfaError('Error setting up MFA: ' + e.message);
      return null;
    }
  }, []);

  /**
   * Complete MFA enrollment with verification code
   */
  const completeMfaEnrollment = useCallback(async (verificationCode) => {
    if (!totpSecretRef.current) {
      setMfaError('MFA session expired. Please try again.');
      return false;
    }
    try {
      const user = auth?.currentUser;
      if (!user) throw new Error('No user signed in');

      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecretRef.current,
        verificationCode
      );
      await multiFactor(user).enroll(assertion, 'Google Authenticator');

      totpSecretRef.current = null;
      setMfaEnrollRequired(false);

      // Complete sign-in to Command Center if we have pending credentials (pass MFA code)
      if (pendingCredentialsRef.current) {
        await signInToCommandCenter(
          pendingCredentialsRef.current.email,
          pendingCredentialsRef.current.password,
          verificationCode
        );
        pendingCredentialsRef.current = null;
      }

      setViewMode('app');
      return true;
    } catch (e) {
      if (e.code === 'auth/invalid-verification-code') {
        setMfaError('Invalid code. Please check your authenticator app and try again.');
      } else {
        setMfaError(e.message);
      }
      return false;
    }
  }, []);

  /**
   * Verify MFA code during sign-in
   */
  const verifyMfaCode = useCallback(async (verificationCode) => {
    if (!mfaResolverRef.current) {
      setMfaError('MFA session expired. Please try logging in again.');
      return false;
    }
    try {
      const resolver = mfaResolverRef.current;
      // Find TOTP factor
      const totpFactor = resolver.hints.find(
        hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
      );
      if (!totpFactor) {
        setMfaError('No TOTP factor found. Please contact support.');
        return false;
      }

      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        totpFactor.uid,
        verificationCode
      );
      await resolver.resolveSignIn(assertion);

      mfaResolverRef.current = null;
      setMfaRequired(false);

      // Complete sign-in to Command Center (pass MFA code for cross-project MFA)
      if (pendingCredentialsRef.current) {
        await signInToCommandCenter(
          pendingCredentialsRef.current.email,
          pendingCredentialsRef.current.password,
          verificationCode
        );
        pendingCredentialsRef.current = null;
      }

      setViewMode('app');
      return true;
    } catch (e) {
      if (e.code === 'auth/invalid-verification-code') {
        setMfaError('Invalid code. Please check your authenticator app and try again.');
      } else {
        setMfaError(e.message);
      }
      return false;
    }
  }, []);

  /**
   * Cancel MFA flow
   */
  const cancelMfa = useCallback(async () => {
    mfaResolverRef.current = null;
    totpSecretRef.current = null;
    pendingCredentialsRef.current = null;
    setMfaRequired(false);
    setMfaEnrollRequired(false);
    setMfaError('');
    // Sign out if user is partially signed in
    if (auth?.currentUser) {
      await signOut(auth);
    }
  }, []);

  /**
   * Handle successful password change from expiry modal
   */
  const handlePasswordExpiryResolved = useCallback(async () => {
    setPasswordExpired(false);
    setPasswordExpiryEmail('');

    // Complete sign-in to Command Center if we have pending credentials
    if (pendingCredentialsRef.current) {
      await signInToCommandCenter(
        pendingCredentialsRef.current.email,
        pendingCredentialsRef.current.password
      );
      pendingCredentialsRef.current = null;
    }

    setViewMode('app');
  }, []);

  /**
   * Cancel password expiry flow (logout)
   */
  const cancelPasswordExpiry = useCallback(async () => {
    setPasswordExpired(false);
    setPasswordExpiryEmail('');
    pendingCredentialsRef.current = null;
    if (auth?.currentUser) {
      await signOut(auth);
    }
    setViewMode('gate');
  }, []);

  return {
    // State
    viewMode,
    setViewMode,
    userRole,
    currentUser,
    authError,
    isLoggingIn,
    resetStatus,

    // MFA State
    mfaRequired,
    mfaEnrollRequired,
    mfaError,

    // Password Expiry State (BOSP)
    passwordExpired,
    passwordExpiryEmail,

    // Actions
    handleProspectEntry,
    handleClientLogin,
    handleClientSignup,
    handleAdvisorLogin,
    handlePasswordReset,
    handleLogout,

    // MFA Actions
    startMfaEnrollment,
    completeMfaEnrollment,
    verifyMfaCode,
    cancelMfa,

    // Password Expiry Actions (BOSP)
    handlePasswordExpiryResolved,
    cancelPasswordExpiry
  };
};

export default useAuth;
