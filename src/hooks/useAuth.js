import { useState, useEffect, useCallback, useRef } from 'react';
import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver
} from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db, appId, MASTER_EMAIL, signInToCommandCenter } from '../constants';

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

  // Listen to auth state changes
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        if (user.isAnonymous) {
          setUserRole('anonymous');
        } else {
          // Check if master first
          if (user.email && user.email.toLowerCase() === MASTER_EMAIL.toLowerCase()) {
            setUserRole('master');
          } else {
            // Check if this user has any plans assigned to them (making them a client)
            // or if they have created plans (making them an advisor)
            try {
              if (db && user.email) {
                const querySnapshot = await getDocs(
                  collection(db, 'artifacts', appId, 'public', 'data', 'scenarios')
                );
                let hasAssignedPlans = false;
                let hasCreatedPlans = false;

                querySnapshot.forEach((doc) => {
                  const data = doc.data();
                  // Check if user has plans assigned to them
                  if (data.assignedClientEmail?.toLowerCase() === user.email.toLowerCase()) {
                    hasAssignedPlans = true;
                  }
                  // Check if user has created plans (is an advisor)
                  if (data.advisorId === user.uid ||
                      data.advisorEmail?.toLowerCase() === user.email.toLowerCase()) {
                    hasCreatedPlans = true;
                  }
                });

                // If they have created plans, they're an advisor
                // If they only have assigned plans, they're a registered client
                if (hasCreatedPlans) {
                  setUserRole('advisor');
                } else if (hasAssignedPlans) {
                  setUserRole('registeredClient');
                } else {
                  // New user - default to advisor (they can create plans)
                  setUserRole('advisor');
                }
              } else {
                setUserRole('advisor');
              }
            } catch {
              // Default to advisor if check fails
              setUserRole('advisor');
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
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Check if MFA is enrolled
      const enrolledFactors = multiFactor(userCredential.user).enrolledFactors;
      if (enrolledFactors.length === 0) {
        // MFA not enrolled - require enrollment
        pendingCredentialsRef.current = { email, password };
        setMfaEnrollRequired(true);
        return;
      }
      // Also sign in to Command Center to enable cross-project queries
      await signInToCommandCenter(email, password);
      // The onAuthStateChanged will set the role to 'registeredClient'
      setViewMode('app');
    } catch (e) {
      if (e.code === 'auth/multi-factor-auth-required') {
        // MFA verification required
        mfaResolverRef.current = getMultiFactorResolver(auth, e);
        pendingCredentialsRef.current = { email, password };
        setMfaRequired(true);
      } else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setAuthError('Invalid email or password. If this is your first time, click "Sign up" below.');
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
  const handleClientSignup = useCallback(async (email, password) => {
    if (!auth) return;
    setAuthError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Also sign in to Command Center to enable cross-project queries
      await signInToCommandCenter(email, password);
      // The onAuthStateChanged will check if they have plans assigned and set role accordingly
      setViewMode('app');
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists. Please log in instead.');
      } else if (e.code === 'auth/weak-password') {
        setAuthError('Password is too weak. Please use at least 6 characters.');
      } else {
        setAuthError(e.message);
      }
    }
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
    try {
      let userCredential;
      if (isSignup) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // New users need to enroll in MFA
        pendingCredentialsRef.current = { email, password };
        setMfaEnrollRequired(true);
        return;
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Check if MFA is enrolled
        const enrolledFactors = multiFactor(userCredential.user).enrolledFactors;
        if (enrolledFactors.length === 0) {
          // MFA not enrolled - require enrollment
          pendingCredentialsRef.current = { email, password };
          setMfaEnrollRequired(true);
          return;
        }
      }
      // Also sign in to Command Center to enable cross-project queries
      await signInToCommandCenter(email, password);
      setViewMode('app');
    } catch (e) {
      if (e.code === 'auth/multi-factor-auth-required') {
        // MFA verification required
        mfaResolverRef.current = getMultiFactorResolver(auth, e);
        pendingCredentialsRef.current = { email, password };
        setMfaRequired(true);
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

      // Complete sign-in to Command Center if we have pending credentials
      if (pendingCredentialsRef.current) {
        await signInToCommandCenter(
          pendingCredentialsRef.current.email,
          pendingCredentialsRef.current.password
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

      // Complete sign-in to Command Center
      if (pendingCredentialsRef.current) {
        await signInToCommandCenter(
          pendingCredentialsRef.current.email,
          pendingCredentialsRef.current.password
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
    cancelMfa
  };
};

export default useAuth;
