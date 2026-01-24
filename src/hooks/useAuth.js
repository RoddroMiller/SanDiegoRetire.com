import { useState, useEffect, useCallback } from 'react';
import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
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
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Also sign in to Command Center to enable cross-project queries
      await signInToCommandCenter(email, password);
      // The onAuthStateChanged will set the role to 'registeredClient'
      setViewMode('app');
    } catch (e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
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
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // Also sign in to Command Center to enable cross-project queries
      await signInToCommandCenter(email, password);
      setViewMode('app');
    } catch (e) {
      setAuthError(e.message);
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

  return {
    // State
    viewMode,
    setViewMode,
    userRole,
    currentUser,
    authError,
    isLoggingIn,
    resetStatus,

    // Actions
    handleProspectEntry,
    handleClientLogin,
    handleClientSignup,
    handleAdvisorLogin,
    handlePasswordReset,
    handleLogout
  };
};

export default useAuth;
