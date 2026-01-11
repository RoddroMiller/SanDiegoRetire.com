import { useState, useEffect, useCallback } from 'react';
import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth, MASTER_EMAIL } from '../constants';

/**
 * Custom hook for managing authentication state and actions
 * @returns {object} Auth state and handlers
 */
export const useAuth = () => {
  const [viewMode, setViewMode] = useState('gate');
  const [userRole, setUserRole] = useState('client');
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Listen to auth state changes
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        if (user.isAnonymous) {
          setUserRole('client');
        } else {
          if (user.email && user.email.toLowerCase() === MASTER_EMAIL.toLowerCase()) {
            setUserRole('master');
          } else {
            setUserRole('advisor');
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Handle anonymous client entry
   */
  const handleClientEntry = useCallback(async () => {
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

    // Actions
    handleClientEntry,
    handleAdvisorLogin,
    handleLogout
  };
};

export default useAuth;
