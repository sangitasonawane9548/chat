import React from 'react';
import { cn } from '@/utils/cn';

export const Skeleton = ({
  className,
  variant = 'rectangular', // text, circular, rectangular
  width,
  height,
  style,
  ...props
}) => {
  const variantClasses = {
    text: 'rounded-md h-4 w-full',
    circular: 'rounded-full aspect-square',
    rectangular: 'rounded-xl',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-white/5 animate-pulse',
        variantClasses[variant] || variantClasses.rectangular,
        className
      )}
      style={{
        width: width,
        height: height,
        ...style
      }}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-[shimmer_2s_infinite]" />
    </div>
  );
};

export default Skeleton;

