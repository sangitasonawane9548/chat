import React from 'react';

export const MessageReactions = ({ reactions = [], onToggleReaction, currentUserId }) => {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1 -mb-0.5 select-none">
      {reactions.map((r) => {
        const hasReacted = r.hasReacted || r.users?.some((u) => u.id === currentUserId);
        const userList = r.users?.map((u) => u.username || u.full_name).join(', ') || '';

        return (
          <button
            key={r.reaction}
            type="button"
            onClick={() => onToggleReaction(r.reaction)}
            title={userList ? `Reacted: ${userList}` : ''}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all ${
              hasReacted
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40 font-medium'
                : 'bg-brand-bg/80 text-brand-text border border-brand-border/60 hover:border-brand-primary/30'
            }`}
          >
            <span>{r.reaction}</span>
            <span className="text-[10px] font-mono">{r.count}</span>
          </button>
        );
      })}
    </div>
  );
};

export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export const MessageReactionPicker = ({ onSelectReaction, onClose }) => {
  return (
    <div
      className="flex items-center gap-1 p-1 bg-brand-surface border border-brand-border rounded-full shadow-elevated z-30 animate-fade-in"
      onMouseLeave={onClose}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelectReaction(emoji);
            onClose?.();
          }}
          className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-sm hover:scale-125 transition-transform"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default MessageReactions;

