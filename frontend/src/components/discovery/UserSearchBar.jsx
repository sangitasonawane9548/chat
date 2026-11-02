import React from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export const UserSearchBar = ({
  value,
  onChange,
  onClear,
  isLoading = false,
  placeholder = 'Search by @username or name...'
}) => {
  return (
    <div className="relative w-full max-w-2xl">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-subtle pointer-events-none">
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
        ) : (
          <Search className="w-5 h-5" />
        )}
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-11 py-3.5 bg-brand-card/90 text-brand-text placeholder-brand-subtle text-sm sm:text-base rounded-2xl border border-brand-border focus:outline-none focus:border-brand-primary/80 focus:ring-2 focus:ring-brand-primary/20 shadow-glass transition-all"
      />

      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-brand-subtle hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default UserSearchBar;

