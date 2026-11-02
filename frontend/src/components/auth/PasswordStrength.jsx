import React from 'react';

/**
 * Calculates password score between 0 and 4
 */
export const calculatePasswordStrength = (password = '') => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return score;
};

export const PasswordStrength = ({ password = '' }) => {
  if (!password) return null;

  const score = calculatePasswordStrength(password);

  const levels = [
    { label: 'Too Weak', color: 'bg-brand-danger', textColor: 'text-brand-danger' },
    { label: 'Weak', color: 'bg-orange-500', textColor: 'text-orange-400' },
    { label: 'Fair', color: 'bg-amber-400', textColor: 'text-amber-400' },
    { label: 'Good', color: 'bg-blue-400', textColor: 'text-blue-400' },
    { label: 'Strong', color: 'bg-brand-secondary', textColor: 'text-brand-secondary' },
  ];

  const currentLevel = levels[score];

  return (
    <div className="w-full mt-1.5 space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-brand-subtle">Password Strength</span>
        <span className={`font-semibold ${currentLevel.textColor}`}>
          {currentLevel.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 h-1">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-full rounded-full transition-all duration-300 ${
              score >= step ? currentLevel.color : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default PasswordStrength;

