import React, { useState } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';

export const ChatSearchBar = ({
  searchQuery,
  onSearchChange,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
  onClose
}) => {
  return (
    <div className="flex items-center gap-1.5 xs:gap-2 px-2.5 xs:px-4 py-2 bg-brand-surface/95 border-b border-brand-border backdrop-blur-md shadow-sm z-10 shrink-0 select-none">
      <div className="relative flex-1">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-subtle" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search in this conversation..."
          autoFocus
          className="w-full pl-9 pr-8 py-1.5 text-xs bg-brand-bg text-brand-text rounded-lg border border-brand-border focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all placeholder-brand-subtle"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-subtle hover:text-brand-text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {searchQuery && (
        <div className="flex items-center gap-1.5 text-xs text-brand-muted shrink-0">
          <span className="text-[11px] font-medium text-brand-subtle">
            {matchCount > 0 ? `${currentMatchIndex + 1} of ${matchCount}` : 'No matches'}
          </span>
          <div className="flex items-center gap-0.5 border border-brand-border/60 rounded-lg p-0.5 bg-brand-bg">
            <button
              onClick={onPrevMatch}
              disabled={matchCount === 0}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-brand-muted hover:text-brand-text transition-colors"
              title="Previous match"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onNextMatch}
              disabled={matchCount === 0}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-brand-muted hover:text-brand-text transition-colors"
              title="Next match"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="p-1.5 rounded-lg text-brand-subtle hover:text-white hover:bg-white/5 transition-colors"
        title="Close search"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ChatSearchBar;

