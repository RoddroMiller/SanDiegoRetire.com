/**
 * Account security utilities for BOSP compliance
 * - Account lockout after failed login attempts
 * - Password expiration (90 days)
 * - Password history (prevent reuse of last 5)
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../constants';

// Security constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const PASSWORD_EXPIRY_DAYS = 90;
const MAX_PASSWORD_HISTORY = 5;

/**
 * Hash email for use as Firestore document ID
 * @param {string} email
 * @returns {string}
 */
const hashEmail = (email) => {
  return email.toLowerCase().replace(/[.@]/g, '_');
};

/**
 * SHA-256 hash a password using Web Crypto API
 * @param {string} password
 * @returns {Promise<string>}
 */
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Get security document reference for a user
 * @param {string} email
 * @returns {DocumentReference}
 */
const getSecurityDocRef = (email) => {
  return doc(db, 'security', 'users', hashEmail(email), 'data');
};

// ============================================
// ACCOUNT LOCKOUT
// ============================================

/**
 * Check if an account is locked out
 * @param {string} email
 * @returns {Promise<{ locked: boolean, remainingMinutes?: number, remainingAttempts?: number, message?: string }>}
 */
export const checkAccountLockout = async (email) => {
  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }

    const data = docSnap.data();

    if (data.lockoutUntil) {
      const lockoutTime = data.lockoutUntil.toDate();
      if (lockoutTime > new Date()) {
        const remainingMs = lockoutTime - new Date();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return {
          locked: true,
          remainingMinutes,
          message: `Account locked due to too many failed attempts. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`
        };
      }
      // Lockout expired, reset
      await updateDoc(docRef, {
        failedAttempts: 0,
        lockoutUntil: null,
        updatedAt: serverTimestamp()
      });
    }

    const remainingAttempts = MAX_FAILED_ATTEMPTS - (data.failedAttempts || 0);
    return { locked: false, remainingAttempts };
  } catch (error) {
    console.error('Error checking account lockout:', error);
    // On error, allow login attempt (fail open for usability)
    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }
};

/**
 * Record a failed login attempt
 * @param {string} email
 * @returns {Promise<{ attemptCount: number, isLocked: boolean, remainingAttempts: number }>}
 */
export const recordFailedAttempt = async (email) => {
  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await getDoc(docRef);

    let failedAttempts = 1;

    if (docSnap.exists()) {
      failedAttempts = (docSnap.data().failedAttempts || 0) + 1;
    }

    const updateData = {
      email: email.toLowerCase(),
      failedAttempts,
      updatedAt: serverTimestamp()
    };

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockoutUntil = Timestamp.fromDate(
        new Date(Date.now() + LOCKOUT_DURATION_MS)
      );
    }

    if (docSnap.exists()) {
      await updateDoc(docRef, updateData);
    } else {
      await setDoc(docRef, { ...updateData, createdAt: serverTimestamp() });
    }

    return {
      attemptCount: failedAttempts,
      isLocked: failedAttempts >= MAX_FAILED_ATTEMPTS,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts)
    };
  } catch (error) {
    console.error('Error recording failed attempt:', error);
    return { attemptCount: 1, isLocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - 1 };
  }
};

/**
 * Reset failed login attempts (call on successful login)
 * @param {string} email
 */
export const resetFailedAttempts = async (email) => {
  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        failedAttempts: 0,
        lockoutUntil: null,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error resetting failed attempts:', error);
  }
};

// ============================================
// PASSWORD EXPIRATION
// ============================================

/**
 * Check if a user's password has expired
 * @param {string} email
 * @returns {Promise<{ expired: boolean, daysUntilExpiry: number, daysSinceChange?: number }>}
 */
export const checkPasswordExpiry = async (email) => {
  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // New user - password is not expired but will be tracked on first change
      return { expired: false, daysUntilExpiry: PASSWORD_EXPIRY_DAYS };
    }

    const data = docSnap.data();
    if (!data.lastPasswordChange) {
      // No record of password change - treat as expired to force tracking
      return { expired: true, daysUntilExpiry: 0 };
    }

    const lastChange = data.lastPasswordChange.toDate();
    const daysSinceChange = Math.floor((Date.now() - lastChange) / (1000 * 60 * 60 * 24));
    const daysUntilExpiry = PASSWORD_EXPIRY_DAYS - daysSinceChange;

    return {
      expired: daysSinceChange >= PASSWORD_EXPIRY_DAYS,
      daysUntilExpiry: Math.max(0, daysUntilExpiry),
      daysSinceChange
    };
  } catch (error) {
    console.error('Error checking password expiry:', error);
    // On error, don't block login
    return { expired: false, daysUntilExpiry: PASSWORD_EXPIRY_DAYS };
  }
};

/**
 * Update the password change timestamp
 * @param {string} email
 */
export const updatePasswordTimestamp = async (email) => {
  try {
    const docRef = getSecurityDocRef(email);
    await setDoc(docRef, {
      lastPasswordChange: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating password timestamp:', error);
  }
};

// ============================================
// PASSWORD HISTORY
// ============================================

/**
 * Check if a password was used recently (last 5 passwords)
 * @param {string} email
 * @param {string} newPassword
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export const checkPasswordHistory = async (email, newPassword) => {
  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { valid: true };
    }

    const data = docSnap.data();
    const passwordHistory = data.passwordHistory || [];

    if (passwordHistory.length === 0) {
      return { valid: true };
    }

    const newHash = await hashPassword(newPassword);

    if (passwordHistory.includes(newHash)) {
      return {
        valid: false,
        error: 'Cannot reuse your last 5 passwords. Please choose a different password.'
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error checking password history:', error);
    // On error, allow the password change
    return { valid: true };
  }
};

/**
 * Add a password to the user's password history
 * @param {string} email
 * @param {string} password
 */
export const addToPasswordHistory = async (email, password) => {
  try {
    const docRef = getSecurityDocRef(email);
    const docSnap = await getDoc(docRef);

    let passwordHistory = [];
    if (docSnap.exists()) {
      passwordHistory = docSnap.data().passwordHistory || [];
    }

    const newHash = await hashPassword(password);

    // Add new hash to beginning, keep only last 5
    passwordHistory.unshift(newHash);
    if (passwordHistory.length > MAX_PASSWORD_HISTORY) {
      passwordHistory = passwordHistory.slice(0, MAX_PASSWORD_HISTORY);
    }

    await setDoc(docRef, {
      passwordHistory,
      lastPasswordChange: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error adding to password history:', error);
  }
};

/**
 * Initialize security record for a new user (call on signup)
 * @param {string} email
 * @param {string} password
 */
export const initializeSecurityRecord = async (email, password) => {
  try {
    const newHash = await hashPassword(password);
    const docRef = getSecurityDocRef(email);

    await setDoc(docRef, {
      email: email.toLowerCase(),
      failedAttempts: 0,
      lockoutUntil: null,
      lastPasswordChange: serverTimestamp(),
      passwordHistory: [newHash],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error initializing security record:', error);
  }
};

export default {
  checkAccountLockout,
  recordFailedAttempt,
  resetFailedAttempts,
  checkPasswordExpiry,
  updatePasswordTimestamp,
  checkPasswordHistory,
  addToPasswordHistory,
  initializeSecurityRecord
};
