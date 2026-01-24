/**
 * PII/SSN detection utilities for BOSP compliance
 * Prevents users from entering Social Security Numbers in text fields
 */

// SSN patterns to detect
const SSN_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,  // XXX-XX-XXXX format
  /\b\d{9}\b/               // 9 consecutive digits
];

/**
 * Check if text contains an SSN pattern
 * @param {string} text - Text to check
 * @returns {boolean} True if SSN pattern detected
 */
export const containsSSN = (text) => {
  if (!text || typeof text !== 'string') return false;
  return SSN_PATTERNS.some(pattern => pattern.test(text));
};

/**
 * Validate that text does not contain PII
 * @param {string} text - Text to validate
 * @returns {{ valid: boolean, error: string | null }}
 */
export const validateNoPII = (text) => {
  if (containsSSN(text)) {
    return {
      valid: false,
      error: 'Social Security Numbers are not allowed in this field for security purposes.'
    };
  }
  return { valid: true, error: null };
};

/**
 * Create an onChange handler that blocks SSN input
 * @param {function} originalOnChange - Original onChange handler
 * @param {function} onBlocked - Callback when SSN is blocked
 * @returns {function} Wrapped onChange handler
 */
export const createSSNBlockingHandler = (originalOnChange, onBlocked) => {
  return (e) => {
    const newValue = e.target.value;
    if (containsSSN(newValue)) {
      if (onBlocked) onBlocked();
      return; // Block the input
    }
    originalOnChange(e);
  };
};

export default { containsSSN, validateNoPII, createSSNBlockingHandler };
