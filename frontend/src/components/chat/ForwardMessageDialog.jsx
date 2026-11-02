import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Forward, User, Check } from 'lucide-react';
import { notify } from '@/components/common/ToastProvider';

export const ForwardMessageDialog = ({
  message,
  conversations = [],
  currentConversationId,
  onForward,
  onClose
}) => {
  const [search, setSearch] = useState('');
  const [forwardingToId, setForwardingToId] = useState(null);

  if (!message) return null;

  // Filter conversations (exclude current conversation)
  const availableConversations = conversations.filter((c) => c.id !== currentConversationId);

  const filtered = availableConversations.filter((c) => {
    if (!search.trim()) return true;
    const name = c.participant?.full_name?.toLowerCase() || '';
    const username = c.participant?.username?.toLowerCase() || '';
    const q = search.toLowerCase();
    return name.includes(q) || username.includes(q);
  });

  const handleSelectForward = async (targetId) => {
    try {
      setForwardingToId(targetId);
      await onForward(message.id, targetId);
      notify.success('Message forwarded');
      onClose();
    } catch (err) {
      notify.error(err.message || 'Failed to forward message');
    } finally {
      setForwardingToId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-brand-surface border border-brand-border rounded-2xl shadow-elevated overflow-hidden flex flex-col transition-colors duration-200"
          style={{ maxHeight: '80vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-brand-border/60">
            <div className="flex items-center gap-2">
              <Forward className="w-5 h-5 text-brand-primary" />
              <h3 className="text-sm font-semibold text-brand-text">Forward Message</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-brand-border/40">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-subtle" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contact or conversation..."
                className="w-full bg-brand-bg border border-brand-border rounded-xl pl-9 pr-3 py-2 text-xs text-brand-text placeholder-brand-subtle focus:outline-none focus:border-brand-primary"
                autoFocus
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2 divide-y divide-brand-border/20 max-h-72 scrollbar-thin">
            {filtered.length > 0 ? (
              filtered.map((c) => {
                const isForwardingThis = forwardingToId === c.id;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {c.participant?.profile_picture ? (
                        <img
                          src={c.participant.profile_picture}
                          alt={c.participant.username}
                          className="w-9 h-9 rounded-full object-cover border border-brand-border"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          {c.participant?.full_name || 'Direct Conversation'}
                        </div>
                        <div className="text-[11px] text-brand-subtle truncate">
                          @{c.participant?.username || `conv-${c.id}`}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectForward(c.id)}
                      disabled={isForwardingThis}
                      className="px-3 py-1.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover text-xs font-medium shadow-glow-primary transition-all disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                    >
                      <Forward className="w-3.5 h-3.5" />
                      <span>{isForwardingThis ? 'Sending...' : 'Send'}</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-xs text-brand-subtle">
                {search ? 'No matching contacts found' : 'No other conversations available'}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ForwardMessageDialog;

