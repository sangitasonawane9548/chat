import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import LoadingSpinner from './LoadingSpinner';

const variantStyles = {
  primary: 'bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 hover:from-violet-500 hover:via-purple-500 hover:to-violet-500 text-white shadow-glow-primary border border-white/10 active:opacity-95',
  secondary: 'bg-brand-surface hover:bg-brand-card-hover text-brand-text border border-brand-border hover:border-brand-border-strong shadow-sm',
  outline: 'bg-transparent border border-brand-border hover:border-brand-primary hover:bg-brand-primary/5 text-brand-text',
  ghost: 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-brand-muted hover:text-brand-text',
  danger: 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 shadow-sm',
  card: 'bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-text shadow-sm',
  coral: 'bg-gradient-to-r from-violet-600 to-rose-500 hover:from-violet-500 hover:to-rose-400 text-white shadow-glow-coral border border-white/10',
  fab: 'rounded-full p-3.5 shadow-elevated bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border border-white/15'
};

const sizeStyles = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1.5 font-medium',
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5 font-medium',
  md: 'px-4 py-2 text-sm rounded-xl gap-2 font-medium',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2.5 font-semibold',
  xl: 'px-6 py-3 text-lg rounded-2xl gap-3 font-bold',
  icon: 'p-2 rounded-xl aspect-square flex items-center justify-center',
};

export const Button = React.forwardRef(({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  type = 'button',
  ...props
}, ref) => {
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.015, y: -0.5 }}
      whileTap={isDisabled ? undefined : { scale: 0.98, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'relative inline-flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 disabled:opacity-50 disabled:pointer-events-none select-none tracking-normal cursor-pointer',
        variantStyles[variant] || variantStyles.primary,
        sizeStyles[size] || sizeStyles.md,
        className
      )}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" className="text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      {children && <span className={cn(isLoading && 'opacity-0', 'truncate')}>{children}</span>}
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </motion.button>
  );
});

Button.displayName = 'Button';

export default Button;
