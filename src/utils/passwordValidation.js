/**
 * Password validation utilities for BOSP compliance
 * Requirements: 12+ characters, at least 1 special character
 */

const SPECIAL_CHARS = /[~!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
const MIN_LENGTH = 12;

/**
 * Validate password meets BOSP requirements
 * @param {string} password - Password to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validatePassword = (password) => {
  const errors = [];

  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`);
  }

  if (!SPECIAL_CHARS.test(password)) {
    errors.push('Password must contain at least one special character (~!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Get password requirements message
 * @returns {string}
 */
export const getPasswordRequirements = () => {
  return `Password must be at least ${MIN_LENGTH} characters and include at least one special character (~!@#$%^&*)`;
};

export default validatePassword;
