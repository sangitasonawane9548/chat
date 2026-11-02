import React from 'react';

export const UserSkeleton = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array(count).fill(0).map((_, i) => (
        <div
          key={i}
          className="glass-card rounded-2xl p-4 sm:p-5 flex items-start gap-4 border border-brand-border animate-pulse"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/10 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 bg-white/10 rounded w-1/2" />
            <div className="h-3 bg-white/5 rounded w-1/3" />
            <div className="h-3 bg-white/5 rounded w-3/4 mt-2" />
          </div>
          <div className="w-24 h-9 bg-white/10 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
};

export default UserSkeleton;

