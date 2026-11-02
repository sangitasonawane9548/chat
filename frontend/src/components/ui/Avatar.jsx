import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import { getApiBaseUrl } from '@/utils/apiUrl';

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl font-bold',
};

const statusSizes = {
  xs: 'w-1.5 h-1.5 ring-1',
  sm: 'w-2 h-2 ring-1.5',
  md: 'w-2.5 h-2.5 ring-2',
  lg: 'w-3 h-3 ring-2',
  xl: 'w-3.5 h-3.5 ring-2',
  '2xl': 'w-4 h-4 ring-2',
};

const statusColors = {
  online: 'bg-brand-online',
  offline: 'bg-brand-subtle',
  away: 'bg-amber-400',
  busy: 'bg-brand-danger',
};

// Deterministic gradient generator from username or name
const getGradientFromName = (name = '') => {
  const gradients = [
    'from-purple-600 to-indigo-600',
    'from-indigo-600 to-blue-600',
    'from-emerald-600 to-teal-600',
    'from-rose-600 to-pink-600',
    'from-amber-600 to-orange-600',
    'from-violet-600 to-fuchsia-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

export const Avatar = ({
  src,
  alt = 'Avatar',
  name = '',
  size = 'md',
  status = null,
  className,
  shape = 'circle', // circle or rounded
}) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (text) => {
    if (!text) return '?';
    const parts = text.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  const API_URL = getApiBaseUrl();
  const resolvedSrc = src && !src.startsWith('http') && !src.startsWith('blob:') && !src.startsWith('data:')
    ? `${API_URL}${src.startsWith('/') ? '' : '/'}${src}`
    : src;

  return (
    <div className={cn('relative inline-flex shrink-0 select-none', sizes[size] || sizes.md, className)}>
      {resolvedSrc && !imageError ? (
        <img
          src={resolvedSrc}
          alt={alt}
          onError={() => setImageError(true)}
          className={cn(
            'w-full h-full object-cover border border-white/10 shadow-sm',
            roundedClass
          )}
        />
      ) : (
        <div
          className={cn(
            'w-full h-full flex items-center justify-center font-semibold text-white bg-gradient-to-tr border border-white/10 shadow-sm',
            getGradientFromName(name || alt),
            roundedClass
          )}
        >
          {getInitials(name || alt)}
        </div>
      )}

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-brand-bg',
            statusColors[status] || statusColors.offline,
            statusSizes[size] || statusSizes.md
          )}
        />
      )}
    </div>
  );
};

export default Avatar;

