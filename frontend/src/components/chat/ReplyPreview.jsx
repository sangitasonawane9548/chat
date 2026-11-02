import React from 'react';
import { Reply, X, Image as ImageIcon, Mic, Video, FileText } from 'lucide-react';

/**
 * Preview banner shown inside the composer while composing a reply
 */
export const ComposerReplyBanner = ({ replyMessage, onCancel }) => {
  if (!replyMessage) return null;

  const senderName = replyMessage.sender?.username || replyMessage.sender_username || 'User';

  const renderSnippet = () => {
    if (replyMessage.deleted_for_everyone) return 'This message was deleted';
    if (replyMessage.message_type === 'image') return '📷 Photo';
    if (replyMessage.message_type === 'audio') return '🎤 Voice message';
    if (replyMessage.message_type === 'video') return '🎥 Video';
    if (replyMessage.message_type === 'file') return '📎 Document';
    return replyMessage.message_content || 'Message';
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-brand-surface/90 border-b border-brand-border/60 text-xs animate-fade-in">
      <div className="flex items-center gap-2 min-w-0">
        <Reply className="w-3.5 h-3.5 text-brand-primary shrink-0" />
        <div className="border-l-2 border-brand-primary pl-2 min-w-0">
          <div className="font-semibold text-brand-primary truncate">
            Replying to @{senderName}
          </div>
          <div className="text-brand-subtle truncate text-[11px]">
            {renderSnippet()}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 ml-2"
        title="Cancel reply"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Quoted reference banner shown inside a message bubble
 */
export const BubbleQuotedReply = ({ replyTo }) => {
  if (!replyTo) return null;

  const scrollToOriginal = () => {
    const el = document.getElementById(`message-${replyTo.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-brand-primary', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-brand-primary');
      }, 1500);
    }
  };

  const renderSnippet = () => {
    if (replyTo.deleted_for_everyone) return 'This message was deleted';
    if (replyTo.message_type === 'image') return '📷 Photo';
    if (replyTo.message_type === 'audio') return '🎤 Voice message';
    if (replyTo.message_type === 'video') return '🎥 Video';
    if (replyTo.message_type === 'file') return '📎 Document';
    return replyTo.message_content || 'Message';
  };

  return (
    <div
      onClick={scrollToOriginal}
      className="mb-1.5 px-2.5 py-1 bg-black/25 hover:bg-black/40 border-l-2 border-brand-primary rounded-r-lg cursor-pointer transition-colors text-xs select-none max-w-full overflow-hidden"
      title="Click to view original message"
    >
      <div className="font-semibold text-brand-primary text-[11px] truncate">
        @{replyTo.sender_username || 'User'}
      </div>
      <div className="text-brand-text/70 truncate text-[10px] mt-0.5">
        {renderSnippet()}
      </div>
    </div>
  );
};

export default ComposerReplyBanner;

