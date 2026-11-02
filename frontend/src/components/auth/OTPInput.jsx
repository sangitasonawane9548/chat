import React, { useRef, useEffect } from 'react';

export const OTPInput = ({
  value = '',
  onChange,
  length = 6,
  disabled = false,
  error = false,
}) => {
  const inputRefs = useRef([]);

  // Ensure digits array has fixed length
  const digits = Array(length).fill('').map((_, idx) => value[idx] || '');

  useEffect(() => {
    // Focus first empty box on mount
    if (inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [disabled]);

  const handleChange = (e, index) => {
    const char = e.target.value.slice(-1);
    // Allow digits only
    if (char && !/^\d$/.test(char)) return;

    const newDigits = [...digits];
    newDigits[index] = char;
    const combined = newDigits.join('');
    onChange(combined);

    // Auto-advance to next input
    if (char && index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0 && inputRefs.current[index - 1]) {
        // Move to previous and clear
        inputRefs.current[index - 1].focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    // Extract only digits up to length
    const numericOnly = pasteData.replace(/\D/g, '').slice(0, length);
    if (numericOnly) {
      onChange(numericOnly);
      const nextFocus = Math.min(numericOnly.length, length - 1);
      if (inputRefs.current[nextFocus]) {
        inputRefs.current[nextFocus].focus();
      }
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5 xs:gap-2 sm:gap-3 py-2 w-full max-w-full overflow-x-auto" onPaste={handlePaste}>
      {Array(length).fill(0).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[index] || ''}
          disabled={disabled}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          className={`w-9 h-12 xs:w-10 xs:h-13 sm:w-12 sm:h-14 text-center text-lg xs:text-xl sm:text-2xl font-bold rounded-xl transition-all duration-200 select-none shrink-0 ${
            error
              ? 'bg-brand-danger/10 border-brand-danger text-brand-danger focus:ring-2 focus:ring-brand-danger/30'
              : 'bg-brand-surface text-brand-text border-brand-border focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/40 shadow-sm'
          } border focus:outline-none disabled:opacity-50`}
        />
      ))}
    </div>
  );
};

export default OTPInput;
