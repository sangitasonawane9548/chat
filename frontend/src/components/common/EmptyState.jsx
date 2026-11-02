import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import Button from '@/components/ui/Button';

export const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  className,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto',
        className
      )}
    >
      {icon && (
        <div className="relative mb-6">
          <div className="absolute -inset-2 bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 rounded-full blur-xl opacity-70" />
          <div className="relative w-16 h-16 rounded-2xl bg-brand-card border border-brand-border flex items-center justify-center text-brand-primary shadow-glass">
            {icon}
          </div>
        </div>
      )}

      {title && (
        <h3 className="text-lg font-semibold text-brand-text mb-2">
          {title}
        </h3>
      )}

      {description && (
        <p className="text-sm text-brand-muted leading-relaxed mb-6">
          {description}
        </p>
      )}

      <div className="flex items-center gap-3">
        {actionLabel && (
          <Button
            variant="primary"
            onClick={onAction}
            leftIcon={actionIcon}
          >
            {actionLabel}
          </Button>
        )}

        {secondaryActionLabel && (
          <Button
            variant="outline"
            onClick={onSecondaryAction}
          >
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default EmptyState;

