/**
 * Format a phone number string to (XXX) XXX-XXXX format
 * @param {string} value - Raw phone number input
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (value) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

/**
 * Format a number as currency
 * @param {number} value - Number to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, options = {}) => {
  const { maximumFractionDigits = 0, showSymbol = true } = options;
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits });
  return showSymbol ? `$${formatted}` : formatted;
};

/**
 * Format a number as percentage
 * @param {number} value - Number to format (already in percentage form, e.g., 7.5 for 7.5%)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, decimals = 1) => {
  return `${value.toFixed(decimals)}%`;
};
