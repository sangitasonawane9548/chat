import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

/**
 * Premium MELT Reusable Surface Card
 * Refined surface colors, subtle shadows, consistent corner radii, and balanced internal spacing
 */
export const Card = ({
  children,
  className = '',
  hover = false,
  interactive = false,
  onClick = null,
  as = 'div',
  ...props
}) => {
  const Component = interactive ? motion.div : as;
  const motionProps = interactive
    ? {
        whileHover: { y: -2, transition: { duration: 0.15 } },
        whileTap: { scale: 0.99 }
      }
    : {};

  return (
    <Component
      onClick={onClick}
      className={cn(
        'rounded-2xl bg-brand-card border border-brand-border p-5 transition-all duration-200',
        'shadow-card dark:shadow-card',
        hover && 'hover:bg-brand-card-hover hover:border-brand-border-strong hover:shadow-md',
        interactive && 'cursor-pointer select-none',
        className
      )}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
};

export const CardHeader = ({ children, className = '' }) => (
  <div className={cn('flex items-center justify-between gap-3 pb-3 border-b border-brand-border/60 mb-4', className)}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={cn('text-sm sm:text-base font-semibold text-brand-text tracking-tight', className)}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '' }) => (
  <p className={cn('text-xs text-brand-muted mt-0.5 leading-relaxed', className)}>
    {children}
  </p>
);

export default Card;

