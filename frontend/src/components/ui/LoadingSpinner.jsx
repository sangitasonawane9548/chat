import React from 'react';
import { cn } from '@/utils/cn';

const sizes = {
  xs: 'w-3.5 h-3.5 border-2',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
  xl: 'w-12 h-12 border-4',
};

export const LoadingSpinner = ({ size = 'md', className = '' }) => {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent text-brand-primary',
        sizes[size] || sizes.md,
        className
      )}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;

