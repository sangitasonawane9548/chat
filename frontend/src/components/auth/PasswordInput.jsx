import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import AuthInput from './AuthInput';

export const PasswordInput = React.forwardRef(({
  label = 'Password',
  placeholder = '••••••••',
  error,
  helperText,
  value,
  onChange,
  className,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const handleKeyUp = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockActive(true);
    } else {
      setCapsLockActive(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-1">
      <AuthInput
        ref={ref}
        label={label}
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyUp={handleKeyUp}
        error={error}
        helperText={capsLockActive ? '⚠️ Caps Lock is ON' : helperText}
        leftIcon={<Lock className="w-4 h-4" />}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="text-brand-muted hover:text-brand-text transition-colors focus:outline-none p-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
        className={className}
        {...props}
      />
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;

