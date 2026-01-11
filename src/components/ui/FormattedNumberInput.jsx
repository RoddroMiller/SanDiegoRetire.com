import React, { useState, useEffect } from 'react';

export const FormattedNumberInput = ({ value, onChange, name, className, placeholder }) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value !== undefined && value !== null) {
      setDisplayValue(value.toLocaleString());
    }
  }, [value]);

  const handleChange = (e) => {
    // Remove commas to deal with raw digits
    const rawValue = e.target.value.replace(/,/g, '');

    if (rawValue === '' || /^\d+$/.test(rawValue)) {
      // Parse to number to automatically drop leading zeros (e.g. "05" -> 5)
      const numValue = rawValue === '' ? 0 : parseFloat(rawValue);

      // Update local display immediately with the cleaned number formatted with commas
      setDisplayValue(rawValue === '' ? '' : numValue.toLocaleString());

      onChange({ target: { name, value: numValue, type: 'number' } });
    }
  };

  return (
    <input
      type="text"
      name={name}
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default FormattedNumberInput;
