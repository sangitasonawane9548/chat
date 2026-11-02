import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  MoreVertical,
  Copy,
  Edit2,
  Trash2,
  Ban,
  Reply,
  Forward,
  SmilePlus
} from 'lucide-react';
import { formatMessageTime } from '@/utils/date';
import { notify } from '@/components/common/ToastProvider';
import { BubbleQuotedReply } from './ReplyPreview';
import ImageMessage from './ImageMessage';
import DocumentMessage from './DocumentMessage';
import VideoMessage from './VideoMessage';
import VoiceMessage from './VoiceMessage';
import { MessageReactions, MessageReactionPicker } from './MessageReactions';
import Avatar from '@/components/ui/Avatar';

export const MessageBubble = ({
  message,
  isOwn,
  isGroup,
  isFirstInGroup = true,
  isLastInGroup = true,
  searchHighlight,
  currentUserId,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onReply,
  onForward,
  onToggleReaction,
  onOpenImageViewer
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // System Message Centered Pill
  if (message.message_type === 'system') {
    return (
      <div className="w-full flex justify-center my-2.5 px-4 select-none">
        <div className="bg-brand-surface border border-brand-border rounded-full px-3.5 py-1 text-[11px] text-brand-muted shadow-sm max-w-md text-center">
          {message.message_content}
        </div>
      </div>
    );
  }

  // Linkify helper
  const renderMessageContent = (text) => {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-brand-secondary hover:text-white break-all transition-colors"
          >
            {part}
          </a>
        );
      }

      if (searchHighlight && searchHighlight.trim().length > 0) {
        const queryRegex = new RegExp(`(${searchHighlight.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
        const searchParts = part.split(queryRegex);

        return searchParts.map((subPart, subIdx) =>
          subPart.toLowerCase() === searchHighlight.toLowerCase() ? (
            <mark key={subIdx} className="bg-yellow-400/40 text-white rounded px-0.5">
              {subPart}
            </mark>
          ) : (
            subPart
          )
        );
      }

      return part;
    });
  };

  const handleCopy = () => {
    if (message.message_content) {
      navigator.clipboard.writeText(message.message_content);
      notify.success('Copied to clipboard');
      setShowMenu(false);
    }
  };

  const isWithin15Mins = () => {
    if (!message.created_at) return false;
    const diffMins = (Date.now() - new Date(message.created_at).getTime()) / (1000 * 60);
    return diffMins <= 15;
  };

  const canEdit = isOwn && !message.deleted_for_everyone && isWithin15Mins() && message.message_type === 'text';
  const canDeleteEveryone = isOwn && !message.deleted_for_everyone && isWithin15Mins();

  const firstAttachment = message.attachments?.[0];
  const hasImage = message.message_type === 'image' || firstAttachment?.attachment_type === 'image';
  const hasAudio = message.message_type === 'audio' || firstAttachment?.attachment_type === 'audio';
  const hasVideo = message.message_type === 'video' || firstAttachment?.attachment_type === 'video';
  const hasDoc = message.message_type === 'file' || firstAttachment?.attachment_type === 'document';

  // Action Icons Tray rendered cleanly beside the bubble
  const renderActionTray = (alignment) => {
    if (message.deleted_for_everyone) return null;

    return (
      <div
        className={`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center gap-0.5 mb-1 shrink-0 z-10 ${
          alignment === 'left' ? 'mr-1.5' : 'ml-1.5'
        }`}
      >
        {/* Quick React Picker Trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReactionPicker((prev) => !prev)}
            className="p-1 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-white/5 transition-colors"
            title="Add reaction"
            aria-label="Add reaction"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
          {showReactionPicker && (
            <div className={`absolute bottom-full mb-1 z-30 ${alignment === 'left' ? 'right-0' : 'left-0'}`}>
              <MessageReactionPicker
                onSelectReaction={(emoji) => {
                  onToggleReaction?.(message.id, emoji);
                  setShowReactionPicker(false);
                }}
                onClose={() => setShowReactionPicker(false)}
              />
            </div>
          )}
        </div>

        {/* Quick Reply Button */}
        <button
          type="button"
          onClick={() => onReply?.(message)}
          className="p-1 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-white/5 transition-colors"
          title="Reply"
          aria-label="Reply"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>

        {/* Options Menu Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="p-1 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-white/5 transition-colors"
            title="More options"
            aria-label="More options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <div
              className={`absolute bottom-full mb-1 w-44 bg-brand-surface border border-brand-border rounded-xl shadow-elevated py-1 z-30 animate-fade-in ${
                alignment === 'left' ? 'right-0' : 'left-0'
              }`}
              onMouseLeave={() => setShowMenu(false)}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  onReply?.(message);
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-brand-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
              >
                <Reply className="w-3.5 h-3.5 text-brand-primary" />
                <span>Reply</span>
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  onForward?.(message);
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-brand-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
              >
                <Forward className="w-3.5 h-3.5 text-purple-400" />
                <span>Forward</span>
              </button>

              <button
                onClick={handleCopy}
                className="w-full px-3 py-1.5 text-xs text-left text-brand-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-brand-muted" />
                <span>Copy Text</span>
              </button>

              {canEdit && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit?.(message);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-brand-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Edit Message</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowMenu(false);
                  onDeleteForMe?.(message.id);
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-brand-muted hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-brand-muted" />
                <span>Delete for me</span>
              </button>

              {canDeleteEveryone && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDeleteForEveryone?.(message.id);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-brand-danger hover:bg-brand-danger/10 flex items-center gap-2 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5 text-brand-danger" />
                  <span>Delete for everyone</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`w-full min-w-0 flex items-end ${
        isOwn ? 'justify-end' : 'justify-start'
      } ${isFirstInGroup ? 'mt-2.5 sm:mt-3' : 'mt-0.5'} group relative select-text`}
    >
      {/* Sender Avatar for non-own messages in group chats */}
      {!isOwn && isGroup && (
        <div className="shrink-0 mb-0.5 mr-2 self-end">
          {isLastInGroup ? (
            <Avatar
              name={message.sender?.full_name || message.sender?.username}
              src={message.sender?.profile_picture}
              size="xs"
              shape="rounded"
            />
          ) : (
            <div className="w-6 h-6" aria-hidden="true" />
          )}
        </div>
      )}

      {/* Outgoing Action Tray (left of outgoing bubble) */}
      {isOwn && renderActionTray('left')}

      {/* Message Bubble + Reactions Column */}
      <div className="flex flex-col max-w-[78%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[65%] min-w-0">
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm relative transition-all min-w-[72px] w-fit max-w-full ${
            isOwn
              ? `bg-gradient-to-tr from-violet-600 to-purple-600 text-white border border-white/10 ${
                  isLastInGroup ? 'rounded-br-xs' : 'rounded-br-md'
                }`
              : `bg-brand-surface text-brand-text border border-brand-border ${
                  isLastInGroup ? 'rounded-bl-xs' : 'rounded-bl-md'
                }`
          }`}
        >
          {/* Sender display name for group messages (only on first message in sequence) */}
          {!isOwn && isGroup && isFirstInGroup && message.sender && (
            <div className="text-[11px] font-semibold text-brand-primary mb-1 select-none">
              {message.sender.full_name || `@${message.sender.username}`}
            </div>
          )}

          {/* Forwarded Tag */}
          {(message.is_forwarded || message.forwarded_from_message_id) && (
            <div className="flex items-center gap-1 text-[10px] text-brand-subtle italic mb-1 select-none">
              <Forward className="w-3 h-3 text-brand-subtle" />
              <span>Forwarded</span>
            </div>
          )}

          {/* Quoted Reply Preview */}
          {message.reply_to && (
            <BubbleQuotedReply replyTo={message.reply_to} />
          )}

          {/* Deleted Message Placeholder or Content */}
          {message.deleted_for_everyone ? (
            <div className="flex items-center gap-2 text-xs italic text-brand-subtle py-0.5">
              <Ban className="w-3.5 h-3.5 text-brand-subtle" />
              <span>This message was deleted</span>
            </div>
          ) : (
            <>
              {/* Media Renderers */}
              {hasImage && firstAttachment && (
                <ImageMessage
                  attachment={firstAttachment}
                  onOpenViewer={onOpenImageViewer}
                />
              )}

              {hasAudio && firstAttachment && (
                <VoiceMessage
                  attachment={firstAttachment}
                  isOwn={isOwn}
                />
              )}

              {hasVideo && firstAttachment && (
                <VideoMessage
                  attachment={firstAttachment}
                />
              )}

              {hasDoc && firstAttachment && (
                <DocumentMessage
                  attachment={firstAttachment}
                  isOwn={isOwn}
                />
              )}

              {/* Text / Caption Content */}
              {message.message_content &&
                (!firstAttachment || message.message_content !== firstAttachment.original_filename) && (
                  <div className="break-words [overflow-wrap:anywhere] leading-relaxed whitespace-pre-wrap select-text mt-0.5">
                    {renderMessageContent(message.message_content)}
                  </div>
                )}
            </>
          )}

          {/* Metadata Footer: timestamp, edited badge, delivery ticks */}
          <div
            className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] select-none ${
              isOwn ? 'text-brand-text/70' : 'text-brand-subtle'
            }`}
          >
            {message.is_edited && !message.deleted_for_everyone && (
              <span className="italic opacity-70">edited</span>
            )}
            <span>{formatMessageTime(message.created_at)}</span>

            {/* Delivery Ticks (Outgoing messages) */}
            {isOwn && (
              <span className="inline-flex items-center ml-0.5">
                {message.status === 'read' ? (
                  <CheckCheck
                    className="w-3.5 h-3.5 text-brand-secondary"
                    title="Read"
                  />
                ) : message.status === 'delivered' ? (
                  <CheckCheck
                    className="w-3.5 h-3.5 text-brand-muted"
                    title="Delivered"
                  />
                ) : (
                  <Check
                    className="w-3.5 h-3.5 text-brand-muted"
                    title="Sent"
                  />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Emoji Reaction Counters Pills Below Bubble */}
        <div className={`${isOwn ? 'self-end mr-1' : 'self-start ml-1'}`}>
          <MessageReactions
            reactions={message.reactions}
            onToggleReaction={(reaction) => onToggleReaction?.(message.id, reaction)}
            currentUserId={currentUserId}
          />
        </div>
      </div>

      {/* Incoming Action Tray (right of incoming bubble) */}
      {!isOwn && renderActionTray('right')}
    </div>
  );
};

export default MessageBubble;
