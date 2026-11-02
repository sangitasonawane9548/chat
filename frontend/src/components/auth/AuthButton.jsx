import React from 'react';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const AuthButton = ({
  children,
  type = 'submit',
  isLoading = false,
  disabled = false,
  variant = 'primary', // primary, secondary, outline, coral
  className = '',
  leftIcon = null,
  rightIcon = null,
  onClick
}) => {
  const isDisabled = disabled || isLoading;

  const variantStyles = {
    primary: 'bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 hover:from-violet-500 hover:via-purple-500 hover:to-violet-500 text-white shadow-glow-primary border border-white/10 active:opacity-95',
    secondary: 'bg-brand-surface hover:bg-brand-card-hover text-brand-text border border-brand-border hover:border-brand-border-strong shadow-sm',
    outline: 'bg-transparent border border-brand-border hover:border-brand-primary hover:bg-brand-primary/5 text-brand-text',
    coral: 'bg-gradient-to-r from-violet-600 to-rose-500 hover:from-violet-500 hover:to-rose-400 text-white shadow-glow-coral border border-white/10'
  };

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      whileHover={isDisabled ? undefined : { scale: 1.015, y: -0.5 }}
      whileTap={isDisabled ? undefined : { scale: 0.98, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`w-full relative py-3 px-5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-brand-primary/40 disabled:opacity-50 disabled:pointer-events-none cursor-pointer tracking-normal ${
        variantStyles[variant] || variantStyles.primary
      } ${className}`}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" className="text-current" />
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </motion.button>
  );
};

export default AuthButton;
