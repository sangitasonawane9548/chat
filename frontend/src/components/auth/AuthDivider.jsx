import React from 'react';

export const AuthDivider = ({ label = 'OR' }) => {
  return (
    <div className="relative my-5 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-brand-border" />
      </div>
      {label && (
        <span className="relative bg-[#171D29] px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-subtle">
          {label}
        </span>
      )}
    </div>
  );
};

export default AuthDivider;

