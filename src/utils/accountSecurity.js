/**
 * Account security utilities for BOSP compliance
 * All operations go through Cloud Functions (server-side).
 * Password hashing remains client-side — only hashes are sent to the server.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

let functions;
try {
  functions = getFunctions(getApp());
} catch {
  // Functions will be null if Firebase isn't initialized
  functions = null;
}

// ─── Cloud Function references ──────────────────────────────────────

const callCheckAccountLockout = functions ? httpsCallable(functions, 'checkAccountLockout') : null;
const callRecordFailedAttempt = functions ? httpsCallable(functions, 'recordFailedAttempt') : null;
const callResetFailedAttempts = functions ? httpsCallable(functions, 'resetFailedAttempts') : null;
const callCheckPasswordExpiry = functions ? httpsCallable(functions, 'checkPasswordExpiry') : null;
const callInitializeSecurityRecord = functions ? httpsCallable(functions, 'initializeSecurityRecord') : null;
const callCheckPasswordHistory = functions ? httpsCallable(functions, 'checkPasswordHistory') : null;
const callAddToPasswordHistory = functions ? httpsCallable(functions, 'addToPasswordHistory') : null;

// Security constants (keep in sync for client-side fallback values)
const MAX_FAILED_ATTEMPTS = 5;
const PASSWORD_EXPIRY_DAYS = 90;

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
    if (!callCheckAccountLockout) {
      return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
    }
    const result = await callCheckAccountLockout({ email });
    return result.data;
  } catch (error) {
    console.error('Error checking account lockout:', error);
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
    if (!callRecordFailedAttempt) {
      return { attemptCount: 1, isLocked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - 1 };
    }
    const result = await callRecordFailedAttempt({ email });
    return result.data;
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
    if (!callResetFailedAttempts) return;
    await callResetFailedAttempts({ email });
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
    if (!callCheckPasswordExpiry) {
      return { expired: false, daysUntilExpiry: PASSWORD_EXPIRY_DAYS };
    }
    const result = await callCheckPasswordExpiry({ email });
    return result.data;
  } catch (error) {
    console.error('Error checking password expiry:', error);
    return { expired: false, daysUntilExpiry: PASSWORD_EXPIRY_DAYS };
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
    if (!callCheckPasswordHistory) return { valid: true };
    const passwordHash = await hashPassword(newPassword);
    const result = await callCheckPasswordHistory({ email, passwordHash });
    return result.data;
  } catch (error) {
    console.error('Error checking password history:', error);
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
    if (!callAddToPasswordHistory) return;
    const passwordHash = await hashPassword(password);
    await callAddToPasswordHistory({ email, passwordHash });
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
    if (!callInitializeSecurityRecord) return;
    const passwordHash = await hashPassword(password);
    await callInitializeSecurityRecord({ email, passwordHash });
  } catch (error) {
    console.error('Error initializing security record:', error);
  }
};

export default {
  checkAccountLockout,
  recordFailedAttempt,
  resetFailedAttempts,
  checkPasswordExpiry,
  checkPasswordHistory,
  addToPasswordHistory,
  initializeSecurityRecord
};
