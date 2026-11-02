import React from 'react';
import { cn } from '@/utils/cn';

export const AuthInput = React.forwardRef(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className,
  containerClassName,
  disabled,
  id,
  type = 'text',
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={cn('w-full flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-brand-muted uppercase tracking-wider flex items-center justify-between"
        >
          <span>{label}</span>
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 flex items-center justify-center text-brand-subtle pointer-events-none">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          className={cn(
            'w-full bg-brand-surface text-brand-text placeholder-brand-muted/70 text-sm rounded-xl px-4 py-2.5',
            'border border-brand-border transition-all duration-200',
            'focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'border-brand-danger focus:border-brand-danger focus:ring-brand-danger/30',
            className
          )}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 flex items-center justify-center">
            {rightIcon}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-brand-danger font-normal mt-0.5 animate-fadeIn">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-brand-subtle font-normal mt-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

AuthInput.displayName = 'AuthInput';

export default AuthInput;

