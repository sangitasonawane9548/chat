import React from 'react';
import { Link } from 'react-router-dom';

/**
 * MELT World-Class Brand Logo & Wordmark
 * Distinctive, liquid-smooth, expressive, premium identity
 *
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl'} size
 * @param {'default' | 'admin' | 'white'} variant
 * @param {boolean} showWordmark
 * @param {boolean} showBadge
 * @param {string} badgeText
 * @param {string} to - Optional Link destination
 * @param {string} className
 */
export const MeltLogo = ({
  size = 'md',
  variant = 'default',
  showWordmark = true,
  showBadge = false,
  badgeText = 'PRO',
  to = null,
  className = ''
}) => {
  // Sizing configurations
  const dimensions = {
    xs: { icon: 'w-6 h-6', text: 'text-sm', badge: 'text-[9px] px-1.5 py-0.2', gap: 'gap-1.5' },
    sm: { icon: 'w-8 h-8', text: 'text-base font-bold', badge: 'text-[9px] px-1.5 py-0.2', gap: 'gap-2' },
    md: { icon: 'w-9 h-9 sm:w-10 sm:h-10', text: 'text-lg sm:text-xl font-bold', badge: 'text-[10px] px-2 py-0.5', gap: 'gap-2.5' },
    lg: { icon: 'w-11 h-11 sm:w-12 sm:h-12', text: 'text-2xl sm:text-3xl font-extrabold', badge: 'text-xs px-2.5 py-0.5', gap: 'gap-3' },
    xl: { icon: 'w-14 h-14 sm:w-16 sm:h-16', text: 'text-3xl sm:text-4xl font-extrabold', badge: 'text-xs px-3 py-0.5', gap: 'gap-3.5' }
  }[size] || { icon: 'w-9 h-9', text: 'text-lg font-bold', badge: 'text-[10px] px-2 py-0.5', gap: 'gap-2.5' };

  const isAmberAdmin = variant === 'admin';
  const isWhite = variant === 'white';

  const logoIcon = (
    <div
      className={`relative ${dimensions.icon} rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:shadow-glow-primary ${
        isAmberAdmin
          ? 'bg-gradient-to-tr from-amber-500 via-amber-600 to-orange-500 shadow-md shadow-amber-500/25'
          : isWhite
          ? 'bg-white text-brand-primary shadow-md'
          : 'bg-gradient-to-tr from-[#8B5CF6] via-[#A855F7] to-[#FF6B81] shadow-glow-primary'
      }`}
    >
      {/* Liquid Melting Conversation Droplet Icon */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-3/5 h-3/5 drop-shadow-sm"
      >
        {/* Soft fluid drop + speech bubble contour */}
        <path
          d="M16 4C9.37258 4 4 9.37258 4 16C4 19.3496 5.37037 22.3789 7.58579 24.5642C7.8488 24.8242 8 25.1783 8 25.5492V27.5C8 28.3284 8.67157 29 9.5 29H11.4508C11.8217 29 12.1758 28.8488 12.4358 28.5858C13.5255 27.4812 14.7126 26.5412 16 26.5412C22.6274 26.5412 28 21.1686 28 14.5412C28 8.71966 22.6274 4 16 4Z"
          fill={isWhite ? '#8B5CF6' : '#101018'}
          fillOpacity={isWhite ? 1 : 0.92}
        />
        {/* Expressive fluid core wave */}
        <path
          d="M12 14.5C12 12.567 13.567 11 15.5 11C17.433 11 19 12.567 19 14.5C19 17.5 13 18.5 13 21H18.5"
          stroke={isAmberAdmin ? '#F59E0B' : isWhite ? '#FFFFFF' : '#A78BFA'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Smooth melting droplet highlight */}
        <circle
          cx="21"
          cy="11.5"
          r="1.8"
          fill={isAmberAdmin ? '#FBBF24' : isWhite ? '#FF6B81' : '#FF6B81'}
        />
      </svg>

      {/* Subtle glass reflection overlay */}
      <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );

  const wordmark = showWordmark && (
    <div className="flex items-center gap-1.5 min-w-0 select-none">
      <span
        className={`tracking-tight font-display transition-colors ${dimensions.text} ${
          isAmberAdmin
            ? 'text-brand-text group-hover:text-amber-400'
            : isWhite
            ? 'text-white'
            : 'text-brand-text group-hover:text-brand-primary'
        }`}
      >
        MELT
      </span>
      {/* Expressive molten droplet dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isAmberAdmin
            ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
            : 'bg-gradient-to-r from-violet-500 to-rose-400 shadow-sm shadow-violet-500/50'
        }`}
      />

      {showBadge && (
        <span
          className={`font-semibold uppercase tracking-wider rounded-full shrink-0 ${dimensions.badge} ${
            isAmberAdmin
              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
              : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/25'
          }`}
        >
          {badgeText}
        </span>
      )}
    </div>
  );

  const content = (
    <div className={`inline-flex items-center ${dimensions.gap} ${className}`}>
      {logoIcon}
      {wordmark}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-xl">
        {content}
      </Link>
    );
  }

  return <div className="group">{content}</div>;
};

export default MeltLogo;
