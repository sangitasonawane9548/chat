import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Smile, Heart, Coffee, Activity, Flag } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
      '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
      '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦',
      '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞'
    ]
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: Heart,
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '🖕', '👇', '☝️', '🖐️', '✋', '🖖', '👋', '🤙', '💪',
      '🙏', '👏', '🤝', '🙌', '👐', '🤲', '❤️', '🧡', '💛', '💚',
      '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓',
      '💗', '💖', '💘', '💝', '💟', '🔥', '✨', '⚡', '💯', '💥'
    ]
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: Activity,
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓',
      '🏸', '🥅', '🥊', '🥋', '🎯', '⛳', '🎮', '🕹️', '🎲', '🧩',
      '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸',
      '🚀', '🛸', '🛰️', '✈️', '⛵', '🏎️', '🏍️', '🚲', '🛴', '🏆'
    ]
  },
  {
    id: 'food',
    name: 'Food',
    icon: Coffee,
    emojis: [
      '☕', '🍵', '🧃', '🥤', '🍺', '🍻', '🍷', '🥂', '🍾', '🍸',
      '🍕', '🍔', '🍟', '🌭', '🍿', '🥪', '🌮', '🌯', '🥗', '🍝',
      '🍜', '🍲', '🍣', '🍱', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂',
      '🍫', '🍬', '🍭', '🍓', '🍒', '🍎', '🍉', '🍇', '🥑', '🥑'
    ]
  },
  {
    id: 'symbols',
    name: 'Symbols',
    icon: Flag,
    emojis: [
      '⭐', '🌟', '💫', '✨', '🔔', '🔕', '🎉', '🎊', '🎈', '🎁',
      '💡', '🔦', '🔑', '🔒', '🔓', '🛡️', '⚔️', '💣', '💎', '💰',
      '📢', '📣', '💬', '💭', '🗯️', '✅', '❌', '⚠️', '⛔', '🚫',
      '🆗', '🆒', '🆕', '🆓', '🆙', '🆘', '📍', '📌', '🏷️', '🔖'
    ]
  }
];

export const EmojiPicker = ({ onSelectEmoji, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [search, setSearch] = useState('');
  const pickerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Filter emojis based on query
  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    const matches = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const emoji of cat.emojis) {
        matches.push(emoji);
      }
    }
    return matches.slice(0, 72);
  }, [search]);

  return (
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-1 sm:left-2 mb-3 w-[calc(100vw-1.5rem)] xs:w-80 sm:w-88 max-w-[22rem] bg-brand-surface/95 border border-brand-border backdrop-blur-xl rounded-2xl shadow-elevated z-50 overflow-hidden flex flex-col transition-colors duration-200"
      style={{ maxHeight: '380px' }}
    >
      {/* Search Header */}
      <div className="p-2.5 border-b border-brand-border/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emojis..."
            className="w-full bg-brand-bg border border-brand-border rounded-xl pl-8 pr-7 py-1.5 text-xs text-brand-text placeholder-brand-subtle focus:outline-none focus:border-brand-primary"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-subtle hover:text-brand-text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Close emoji picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      {!search && (
        <div className="flex items-center justify-around px-2 py-1.5 bg-brand-bg/50 border-b border-brand-border/40">
          {EMOJI_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'text-brand-primary bg-brand-primary/10'
                    : 'text-brand-subtle hover:text-white hover:bg-white/5'
                }`}
                title={cat.name}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-3 overflow-y-auto max-h-64 scrollbar-thin scrollbar-thumb-brand-border">
        {search ? (
          <div>
            <div className="text-[10px] font-semibold text-brand-subtle uppercase tracking-wider mb-2">
              Search Results
            </div>
            <div className="grid grid-cols-8 gap-1">
              {filteredEmojis && filteredEmojis.length > 0 ? (
                filteredEmojis.map((emoji, idx) => (
                  <button
                    key={`${emoji}-${idx}`}
                    type="button"
                    onClick={() => onSelectEmoji(emoji)}
                    className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-white/10 hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))
              ) : (
                <div className="col-span-8 text-center py-6 text-xs text-brand-subtle">
                  No emojis matching "{search}"
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {EMOJI_CATEGORIES.filter((c) => c.id === activeCategory).map((cat) => (
              <div key={cat.id}>
                <div className="text-[10px] font-semibold text-brand-subtle uppercase tracking-wider mb-2">
                  {cat.name}
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map((emoji, idx) => (
                    <button
                      key={`${emoji}-${idx}`}
                      type="button"
                      onClick={() => onSelectEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-white/10 hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default EmojiPicker;

