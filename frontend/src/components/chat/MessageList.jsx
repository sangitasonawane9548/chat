import React, { useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { ArrowDown, MessageSquare, Users } from 'lucide-react';
import MessageBubble from './MessageBubble';
import { formatDateDivider, isSameDay } from '@/utils/date';
import Avatar from '@/components/ui/Avatar';

export const MessageList = ({
  conversationId,
  messages = [],
  currentUserId,
  participant,
  isGroup = false,
  group = null,
  searchHighlight,
  onEditMessage,
  onDeleteForMe,
  onDeleteForEveryone,
  onReplyMessage,
  onForwardMessage,
  onToggleReaction,
  onOpenImageViewer,
  onLoadMore,
  hasMore,
  loadingMore,
  isKeyboardOpen = false
}) => {
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const contentWrapperRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isInitialScrollDone = useRef(false);
  const isNearBottomRef = useRef(true);
  const rafRefs = useRef([]);

  // Pagination scroll preservation refs
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const prevFirstMsgIdRef = useRef(null);
  const prevLastMsgIdRef = useRef(null);

  // Scroll directly to bottom with dual mathematical and sentinel guarantee
  const scrollToBottom = useCallback((behavior = 'auto') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Mathematical direct scroll to bottom
    container.scrollTop = container.scrollHeight;

    // Sentinel alignment guarantee above composer
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior, block: 'end' });
    }

    isNearBottomRef.current = true;
    setShowScrollBottom(false);
  }, []);

  // Multi-frame initial scroll scheduler ensuring post-DOM, post-flow, and post-reflow bottom lock
  const executeInitialScroll = useCallback(() => {
    // Frame 0: immediate layout-level scroll
    scrollToBottom('auto');

    // Clear any previous frame requests
    rafRefs.current.forEach((id) => {
      cancelAnimationFrame(id);
      clearTimeout(id);
    });
    rafRefs.current = [];

    // Frame 1: post-DOM construction
    const r1 = requestAnimationFrame(() => {
      scrollToBottom('auto');

      // Frame 2: post-browser layout pass & font metric resolution
      const r2 = requestAnimationFrame(() => {
        scrollToBottom('auto');
        isInitialScrollDone.current = true;
      });
      rafRefs.current.push(r2);
    });
    rafRefs.current.push(r1);

    // Fallback safety timer for delayed layout settling
    const timer = setTimeout(() => {
      if (!isInitialScrollDone.current || isNearBottomRef.current) {
        scrollToBottom('auto');
        isInitialScrollDone.current = true;
      }
    }, 120);
    rafRefs.current.push(timer);
  }, [scrollToBottom]);

  // Clean up animation frames and timers on unmount
  useEffect(() => {
    return () => {
      rafRefs.current.forEach((id) => {
        cancelAnimationFrame(id);
        clearTimeout(id);
      });
    };
  }, []);

  // Reset scroll state on switching or reopening conversation
  useEffect(() => {
    isInitialScrollDone.current = false;
    isNearBottomRef.current = true;
    setShowScrollBottom(false);
    prevFirstMsgIdRef.current = null;
    prevLastMsgIdRef.current = null;
  }, [conversationId]);

  // Manage initial scroll, pagination scroll anchoring, and new incoming message scrolling
  useLayoutEffect(() => {
    if (messages.length === 0) return;

    const container = scrollContainerRef.current;
    const currentFirstId = messages[0]?.id;
    const currentLastId = messages[messages.length - 1]?.id;

    // Case 1: Initial conversation entry (or after reopening conversation)
    if (!isInitialScrollDone.current) {
      executeInitialScroll();
      if (container) {
        prevScrollHeightRef.current = container.scrollHeight;
        prevScrollTopRef.current = container.scrollTop;
      }
      prevFirstMsgIdRef.current = currentFirstId || null;
      prevLastMsgIdRef.current = currentLastId || null;
      return;
    }

    if (!container) return;

    // Case 2: Older messages prepended at top (Pagination scroll anchoring)
    if (prevFirstMsgIdRef.current && currentFirstId !== prevFirstMsgIdRef.current) {
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = prevScrollTopRef.current + heightDiff;
    }
    // Case 3: New message appended at bottom (outgoing sent message or incoming Socket.IO)
    else if (prevLastMsgIdRef.current && currentLastId !== prevLastMsgIdRef.current) {
      if (isNearBottomRef.current) {
        // User is near bottom: smoothly bring newest message into view
        requestAnimationFrame(() => {
          scrollToBottom('smooth');
        });
      }
      // If user was reading older messages, keep their scroll position intact
    }

    // Update tracking references
    prevScrollHeightRef.current = container.scrollHeight;
    prevScrollTopRef.current = container.scrollTop;
    prevFirstMsgIdRef.current = currentFirstId || null;
    prevLastMsgIdRef.current = currentLastId || null;
  }, [messages, executeInitialScroll, scrollToBottom]);

  // ResizeObserver: observe contentWrapperRef to auto-pin bottom view if media (images/videos/fonts) expand content height
  useEffect(() => {
    const container = scrollContainerRef.current;
    const contentEl = contentWrapperRef.current;
    if (!container || !contentEl || typeof ResizeObserver === 'undefined') return;

    let prevContentHeight = contentEl.offsetHeight;

    const observer = new ResizeObserver(() => {
      const currentHeight = contentEl.offsetHeight;
      if (Math.abs(currentHeight - prevContentHeight) > 2) {
        // If content height changed and user was near bottom or on initial load settling
        if (isNearBottomRef.current || !isInitialScrollDone.current) {
          container.scrollTop = container.scrollHeight;
          if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
          }
        }
        prevContentHeight = currentHeight;
      }
    });

    observer.observe(contentEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  // When mobile keyboard opens/closes, keep latest messages visible if user was at bottom
  useEffect(() => {
    if (isKeyboardOpen && isNearBottomRef.current) {
      const scroll = () => {
        scrollToBottom('auto');
      };

      const raf1 = requestAnimationFrame(scroll);
      const t1 = setTimeout(scroll, 120);
      const t2 = setTimeout(scroll, 280);

      return () => {
        cancelAnimationFrame(raf1);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isKeyboardOpen, scrollToBottom]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isFar = distanceFromBottom > 120;

    isNearBottomRef.current = !isFar;
    setShowScrollBottom(isFar);

    // Save scroll position for pagination math
    prevScrollHeightRef.current = scrollHeight;
    prevScrollTopRef.current = scrollTop;

    // Trigger load older messages when scrolled near top
    // Guard: Only after initial scroll has settled, content overflows, and user deliberately scrolled near top (< 60px)
    if (
      isInitialScrollDone.current &&
      scrollTop < 60 &&
      hasMore &&
      !loadingMore &&
      scrollHeight > clientHeight
    ) {
      onLoadMore?.();
    }
  };

  if (messages.length === 0) {
    const title = isGroup ? (group?.name || participant?.full_name || 'Group Chat') : (participant?.full_name || 'Direct Conversation');
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
        <div className="relative mb-4">
          {isGroup ? (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-primary/30 to-purple-600/30 border border-brand-primary/40 flex items-center justify-center text-white">
              {group?.profile_image ? (
                <img src={group.profile_image} alt={title} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <Users className="w-8 h-8 text-brand-primary" />
              )}
            </div>
          ) : (
            <Avatar
              name={participant?.full_name}
              src={participant?.profile_picture}
              size="xl"
              shape="circle"
              status={participant?.is_online ? 'online' : null}
            />
          )}
        </div>
        <h3 className="text-base font-semibold text-brand-text mb-1">
          {title}
        </h3>
        <p className="text-xs text-brand-subtle mb-4">
          {isGroup ? `${group?.members_count || participant?.members_count || 'Multiple'} group members` : `@${participant?.username || 'user'}`}
        </p>
        <p className="text-xs text-brand-muted max-w-sm leading-relaxed mb-4">
          {isGroup
            ? 'Send the first message in this group to start the discussion!'
            : 'End-to-end encrypted real-time messages. Say hello to start the conversation!'}
        </p>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-brand-border text-[11px] text-brand-subtle">
          <MessageSquare className="w-3.5 h-3.5 text-brand-primary" />
          <span>No messages yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 relative flex flex-col overflow-hidden">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 min-w-0 w-full overflow-y-auto chat-message-gutter py-3 relative [overflow-anchor:none] overscroll-y-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div ref={contentWrapperRef} className="w-full flex flex-col">
          {/* Loading older messages indicator */}
          {loadingMore && (
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Message items grouped by date and sender */}
          {messages.map((message, idx) => {
            const prevMessage = idx > 0 ? messages[idx - 1] : null;
            const nextMessage = idx < messages.length - 1 ? messages[idx + 1] : null;
            const showDateDivider = !prevMessage || !isSameDay(prevMessage.created_at, message.created_at);

            // Grouping logic: check consecutive sender sequences on the same day
            const isSameSenderAsPrev = !showDateDivider && prevMessage && prevMessage.sender_id === message.sender_id && prevMessage.message_type !== 'system';
            const isSameSenderAsNext = nextMessage && isSameDay(message.created_at, nextMessage.created_at) && nextMessage.sender_id === message.sender_id && nextMessage.message_type !== 'system';

            const isFirstInGroup = !isSameSenderAsPrev;
            const isLastInGroup = !isSameSenderAsNext;

            return (
              <React.Fragment key={message.id || message.client_message_id || idx}>
                {showDateDivider && (
                  <div className="flex items-center justify-center my-3 select-none">
                    <span className="px-3 py-0.5 rounded-full bg-brand-surface/90 border border-brand-border text-[10px] font-medium text-brand-subtle shadow-sm">
                      {formatDateDivider(message.created_at)}
                    </span>
                  </div>
                )}

                <MessageBubble
                  message={message}
                  isOwn={message.sender_id === currentUserId}
                  isGroup={isGroup}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  searchHighlight={searchHighlight}
                  currentUserId={currentUserId}
                  onEdit={onEditMessage}
                  onDeleteForMe={onDeleteForMe}
                  onDeleteForEveryone={onDeleteForEveryone}
                  onReply={onReplyMessage}
                  onForward={onForwardMessage}
                  onToggleReaction={onToggleReaction}
                  onOpenImageViewer={onOpenImageViewer}
                />
              </React.Fragment>
            );
          })}

          <div ref={bottomRef} className="h-1" />
        </div>
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-4 right-4 sm:right-6 p-2 rounded-full bg-brand-surface border border-brand-border text-brand-text shadow-elevated hover:bg-brand-card transition-all animate-bounce z-20"
          title="Jump to latest messages"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default MessageList;
