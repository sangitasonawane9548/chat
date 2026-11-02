import React from 'react';
import { cn } from '@/utils/cn';

/**
 * Premium MELT Reusable Status & Pill Badge
 *
 * @param {'violet' | 'coral' | 'emerald' | 'amber' | 'slate' | 'pink'} variant
 * @param {'sm' | 'md' | 'lg'} size
 * @param {boolean} dot
 */
export const Badge = ({
  children,
  variant = 'violet',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variantStyles = {
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    coral: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    pink: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20',
    slate: 'bg-black/5 dark:bg-white/5 text-brand-muted border-brand-border'
  };

  const dotColors = {
    violet: 'bg-violet-500',
    coral: 'bg-rose-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    pink: 'bg-fuchsia-500',
    slate: 'bg-slate-400'
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border tracking-wide uppercase select-none transition-colors',
        variantStyles[variant] || variantStyles.violet,
        sizeStyles[size] || sizeStyles.md,
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant] || 'bg-current')} />}
      {children}
    </span>
  );
};

export default Badge;

