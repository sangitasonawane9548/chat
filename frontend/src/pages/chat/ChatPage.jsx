import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PageTransition from '@/components/common/PageTransition';
import ConversationSidebar from '@/components/chat/ConversationSidebar';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageList from '@/components/chat/MessageList';
import MessageComposer from '@/components/chat/MessageComposer';
import TypingIndicator from '@/components/chat/TypingIndicator';
import ChatInfoPanel from '@/components/chat/ChatInfoPanel';
import GroupInfoPanel from '@/components/chat/GroupInfoPanel';
import CreateGroupModal from '@/components/chat/CreateGroupModal';
import GroupCallModal from '@/components/chat/GroupCallModal';
import ChatSearchBar from '@/components/chat/ChatSearchBar';
import EditMessageModal from '@/components/chat/EditMessageModal';
import ForwardMessageDialog from '@/components/chat/ForwardMessageDialog';
import ImageViewer from '@/components/chat/ImageViewer';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import {
  getUserConversations,
  getConversationById,
  getConversationMessages,
  sendMessage as apiSendMessage,
  uploadConversationAttachment,
  toggleMessageReaction as apiToggleReaction,
  forwardMessage as apiForwardMessage,
  editMessage as apiEditMessage,
  deleteMessageForMe as apiDeleteForMe,
  deleteMessageForEveryone as apiDeleteForEveryone,
  markConversationAsRead as apiMarkAsRead,
  clearConversationHistory as apiClearHistory
} from '@/services/api';
import { notify } from '@/components/common/ToastProvider';
import { MessageSquare, Shield, Lock, Radio, Sparkles } from 'lucide-react';
import MeltLogo from '@/components/common/MeltLogo';
import { useVisualViewport } from '@/hooks/useVisualViewport';

export const ChatPage = () => {
  const { user } = useAuth();
  const { socket, pendingRequestsCount } = useSocket();
  const { viewportHeight, isKeyboardOpen } = useVisualViewport();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Conversations & active selection
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(() => {
    const cParam = searchParams.get('c');
    return cParam ? parseInt(cParam, 10) : null;
  });
  const [activeConversation, setActiveConversation] = useState(null);

  // Messages in active conversation
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Real-time typing indicators
  const [typingUsers, setTypingUsers] = useState({});

  // In-conversation search
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Right-side Contact Info Panel
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // Edit Message Modal
  const [editingMessage, setEditingMessage] = useState(null);

  // Day 5: Advanced Messaging States
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [activeImageViewer, setActiveImageViewer] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Day 8: Group Chat & Group Calling States
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [activeGroupCall, setActiveGroupCall] = useState(null);

  // Visit counter to ensure MessageList remounts cleanly on reopening or switching conversations
  const [conversationVisitKey, setConversationVisitKey] = useState(0);

  // Sync activeConversationId with URL query
  useEffect(() => {
    const cParam = searchParams.get('c');
    const parsedId = cParam ? parseInt(cParam, 10) : null;
    if (parsedId !== activeConversationId) {
      setActiveConversationId(parsedId);
      setConversationVisitKey((k) => k + 1);
    }
  }, [searchParams, activeConversationId]);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const res = await getUserConversations();
      if (res.success) {
        setConversations(res.conversations || []);
      }
    } catch (err) {
      console.error('[ChatPage] Error fetching conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load active conversation details and messages
  useEffect(() => {
    if (!activeConversationId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);
    setMessages([]);

    const loadConversationData = async () => {
      try {
        // Fetch conversation info and messages in parallel for fastest response
        const [convRes, msgRes] = await Promise.all([
          getConversationById(activeConversationId),
          getConversationMessages(activeConversationId, { limit: 50 })
        ]);

        if (convRes.success && isMounted) {
          setActiveConversation(convRes.conversation);
        }

        if (msgRes.success && isMounted) {
          setMessages(msgRes.messages || []);
          setHasMoreMessages(msgRes.hasMore || false);
        }

        // Mark as read immediately on open
        await apiMarkAsRead(activeConversationId);

        // Decrement unread count locally in conversations sidebar
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId ? { ...c, unread_count: 0 } : c
          )
        );

        // Notify socket to join room
        if (socket) {
          socket.emit('join_conversation', { conversationId: activeConversationId });
          socket.emit('mark_read', { conversationId: activeConversationId });
        }
      } catch (err) {
        console.error('[ChatPage] Error loading conversation data:', err);
        notify.error('Could not load conversation');
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };

    loadConversationData();

    return () => {
      isMounted = false;
      if (socket) {
        socket.emit('leave_conversation', { conversationId: activeConversationId });
      }
    };
  }, [activeConversationId, socket]);

  // Setup Socket.IO real-time event listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming new message
    const handleNewMessage = (newMsg) => {
      if (newMsg.conversation_id === activeConversationId) {
        setMessages((prev) => {
          // Check for duplicate / optimistic message replacement
          const exists = prev.some(
            (m) =>
              m.id === newMsg.id ||
              (newMsg.client_message_id && m.client_message_id === newMsg.client_message_id)
          );
          if (exists) {
            return prev.map((m) =>
              m.id === newMsg.id || (newMsg.client_message_id && m.client_message_id === newMsg.client_message_id)
                ? newMsg
                : m
            );
          }
          return [...prev, newMsg];
        });

        // Mark as read if from other user and chat is active
        if (newMsg.sender_id !== user?.id) {
          apiMarkAsRead(activeConversationId);
          socket.emit('mark_read', { conversationId: activeConversationId });
        }
      }

      // Update sidebar conversation item
      setConversations((prev) => {
        let updated = false;
        const mapped = prev.map((c) => {
          if (c.id === newMsg.conversation_id) {
            updated = true;
            const isCurrentActive = c.id === activeConversationId;
            return {
              ...c,
              last_message: {
                id: newMsg.id,
                sender_id: newMsg.sender_id,
                message_type: newMsg.message_type,
                message_content: newMsg.message_content,
                created_at: newMsg.created_at,
                is_edited: newMsg.is_edited,
                deleted_for_everyone: newMsg.deleted_for_everyone,
                status: newMsg.status
              },
              unread_count: isCurrentActive || newMsg.sender_id === user?.id ? 0 : (c.unread_count || 0) + 1
            };
          }
          return c;
        });

        if (!updated) {
          fetchConversations();
          return prev;
        }

        // Re-sort with latest message first
        return mapped.sort((a, b) => {
          const timeA = a.last_message ? new Date(a.last_message.created_at).getTime() : new Date(a.updated_at).getTime();
          const timeB = b.last_message ? new Date(b.last_message.created_at).getTime() : new Date(b.updated_at).getTime();
          return timeB - timeA;
        });
      });
    };

    // Message delivered status update
    const handleMessageDelivered = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, status: m.status === 'read' ? 'read' : 'delivered', delivered_at: data.deliveredAt }
            : m
        )
      );
    };

    // Messages read status update
    const handleMessagesRead = (data) => {
      if (data.conversationId === activeConversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id === user?.id ? { ...m, status: 'read', read_at: data.readAt } : m
          )
        );
      }

      // Update in sidebar
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId && c.last_message && c.last_message.sender_id === user?.id) {
            return {
              ...c,
              last_message: { ...c.last_message, status: 'read' }
            };
          }
          return c;
        })
      );
    };

    // Message edited
    const handleMessageEdited = (data) => {
      if (data.conversationId === activeConversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, message_content: data.content, is_edited: true, updated_at: data.updated_at }
              : m
          )
        );
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId && c.last_message?.id === data.messageId) {
            return {
              ...c,
              last_message: {
                ...c.last_message,
                message_content: data.content,
                is_edited: true
              }
            };
          }
          return c;
        })
      );
    };

    // Message deleted
    const handleMessageDeleted = (data) => {
      if (data.conversationId === activeConversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? {
                  ...m,
                  message_content: 'This message was deleted',
                  deleted_for_everyone: true
                }
              : m
          )
        );
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId && c.last_message?.id === data.messageId) {
            return {
              ...c,
              last_message: {
                ...c.last_message,
                message_content: 'This message was deleted',
                deleted_for_everyone: true
              }
            };
          }
          return c;
        })
      );
    };

    // User typing indicators
    const handleUserTyping = (data) => {
      if (data.conversationId === activeConversationId && data.userId !== user?.id) {
        setTypingUsers((prev) => ({ ...prev, [data.userId]: data.username }));
      }
    };

    const handleUserStoppedTyping = (data) => {
      if (data.conversationId === activeConversationId) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }
    };

    // Presence updates
    const handlePresenceChanged = (data) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.participant?.id === data.userId) {
            return {
              ...c,
              participant: {
                ...c.participant,
                is_online: data.isOnline,
                last_seen: data.lastSeen || c.participant.last_seen
              }
            };
          }
          return c;
        })
      );

      if (activeConversation?.participant?.id === data.userId) {
        setActiveConversation((prev) => ({
          ...prev,
          participant: {
            ...prev.participant,
            is_online: data.isOnline,
            last_seen: data.lastSeen || prev.participant.last_seen
          }
        }));
      }
    };

    // Message reaction updated
    const handleReactionUpdated = (data) => {
      if (data.conversationId === activeConversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, reactions: data.reactions }
              : m
          )
        );
      }
    };

    // Day 8: Group real-time events
    const handleNewGroup = (data) => {
      fetchConversations();
      if (data?.group?.name) {
        notify.info(`You were added to group "${data.group.name}"`);
      }
    };

    const handleGroupUpdated = (data) => {
      fetchConversations();
      if (data.conversationId === activeConversationId) {
        setActiveConversation((prev) => (prev ? { ...prev, group: data.group } : prev));
      }
    };

    const handleGroupDeleted = (data) => {
      fetchConversations();
      if (data.conversationId === activeConversationId) {
        notify.info('This group was deleted by the creator');
        setActiveConversationId(null);
      }
    };

    const handleIncomingGroupCall = (callPayload) => {
      notify.info(`Incoming group call in "${callPayload.groupName}"`);
      setActiveGroupCall(callPayload);
    };

    // Attach listeners
    socket.on('new_message', handleNewMessage);
    socket.on('message_delivered', handleMessageDelivered);
    socket.on('messages_read', handleMessagesRead);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_reaction_updated', handleReactionUpdated);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);
    socket.on('user_presence_changed', handlePresenceChanged);
    socket.on('new_group', handleNewGroup);
    socket.on('group_updated', handleGroupUpdated);
    socket.on('group_deleted', handleGroupDeleted);
    socket.on('group_call:incoming', handleIncomingGroupCall);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_delivered', handleMessageDelivered);
      socket.off('messages_read', handleMessagesRead);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_reaction_updated', handleReactionUpdated);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('user_presence_changed', handlePresenceChanged);
      socket.off('new_group', handleNewGroup);
      socket.off('group_updated', handleGroupUpdated);
      socket.off('group_deleted', handleGroupDeleted);
      socket.off('group_call:incoming', handleIncomingGroupCall);
    };
  }, [socket, activeConversationId, user?.id, activeConversation, fetchConversations]);

  // Load more messages on scroll to top
  const handleLoadMore = async () => {
    if (!hasMoreMessages || loadingMore || messages.length === 0) return;
    try {
      setLoadingMore(true);
      const oldestId = messages[0].id;
      const res = await getConversationMessages(activeConversationId, {
        limit: 50,
        before: oldestId
      });

      if (res.success) {
        setMessages((prev) => [...(res.messages || []), ...prev]);
        setHasMoreMessages(res.hasMore || false);
      }
    } catch (err) {
      console.error('[ChatPage] Error loading more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Select conversation handler
  const handleSelectConversation = (convId) => {
    setActiveConversationId(convId);
    setConversationVisitKey((k) => k + 1);
    setSearchParams({ c: convId });
    setTypingUsers({});
    setIsSearching(false);
    setSearchQuery('');
  };

  // Collect all image attachments in conversation for image viewer gallery
  const chatImages = useMemo(() => {
    const images = [];
    for (const m of messages) {
      if (m.attachments) {
        for (const att of m.attachments) {
          if (att.attachment_type === 'image' || m.message_type === 'image') {
            images.push(att);
          }
        }
      }
    }
    return images;
  }, [messages]);

  // Send message handler with optimistic UI
  const handleSendMessage = async (content, replyToMessageId = null) => {
    if (!activeConversationId || !content.trim()) return;

    const clientMessageId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Optimistic UI representation
    const optimisticMessage = {
      id: `temp_${Date.now()}`,
      client_message_id: clientMessageId,
      conversation_id: activeConversationId,
      sender_id: user.id,
      sender: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        profile_picture: user.profile_picture
      },
      message_type: 'text',
      message_content: content.trim(),
      reply_to_message_id: replyToMessageId,
      reply_to: replyingTo
        ? {
            id: replyingTo.id,
            sender_id: replyingTo.sender_id,
            sender_username: replyingTo.sender?.username || replyingTo.sender_username,
            message_type: replyingTo.message_type,
            message_content: replyingTo.message_content,
            deleted_for_everyone: Boolean(replyingTo.deleted_for_everyone)
          }
        : null,
      forwarded_from_message_id: null,
      is_forwarded: false,
      is_edited: false,
      deleted_for_everyone: false,
      status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attachments: [],
      reactions: []
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyingTo(null);

    try {
      const res = await apiSendMessage(activeConversationId, {
        content: content.trim(),
        clientMessageId,
        replyToMessageId
      });

      if (res.success && res.message) {
        // Replace optimistic placeholder with verified server response
        setMessages((prev) =>
          prev.map((m) =>
            m.client_message_id === clientMessageId ? res.message : m
          )
        );
      }
    } catch (err) {
      console.error('[ChatPage] Send message failed:', err);
      notify.error('Failed to send message');
      // Remove optimistic message on permanent failure
      setMessages((prev) =>
        prev.filter((m) => m.client_message_id !== clientMessageId)
      );
    }
  };

  // Upload file attachment (Image, Video, Document)
  const handleSendAttachment = async (file, caption = '', replyToMessageId = null) => {
    if (!activeConversationId || !file) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      if (caption) formData.append('caption', caption);
      if (replyToMessageId) formData.append('replyToMessageId', replyToMessageId);
      const clientMessageId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      formData.append('clientMessageId', clientMessageId);

      const res = await uploadConversationAttachment(
        activeConversationId,
        formData,
        (percent) => setUploadProgress(percent)
      );

      if (res.success && res.message) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === res.message.id);
          return exists ? prev : [...prev, res.message];
        });
        setReplyingTo(null);
      }
    } catch (err) {
      console.error('[ChatPage] Upload attachment failed:', err);
      notify.error(err.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Send recorded voice note
  const handleSendVoice = async (audioBlob, duration, replyToMessageId = null) => {
    if (!activeConversationId || !audioBlob) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice_message.webm');
      formData.append('durationSeconds', duration);
      if (replyToMessageId) formData.append('replyToMessageId', replyToMessageId);

      const res = await uploadConversationAttachment(activeConversationId, formData);
      if (res.success && res.message) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === res.message.id);
          return exists ? prev : [...prev, res.message];
        });
        setReplyingTo(null);
      }
    } catch (err) {
      console.error('[ChatPage] Voice message failed:', err);
      notify.error(err.message || 'Failed to send voice note');
    } finally {
      setIsUploading(false);
    }
  };

  // Toggle emoji reaction
  const handleToggleReaction = async (messageId, reaction) => {
    try {
      const res = await apiToggleReaction(messageId, reaction);
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions: res.reactions } : m
          )
        );
      }
    } catch (err) {
      notify.error(err.message || 'Failed to react');
    }
  };

  // Forward message to another conversation
  const handleForwardMessage = async (messageId, targetConversationId) => {
    const res = await apiForwardMessage(messageId, targetConversationId);
    if (res.success) {
      fetchConversations();
    }
  };

  // Typing indicators
  const handleTypingStart = () => {
    if (socket && activeConversationId) {
      socket.emit('typing_start', { conversationId: activeConversationId });
    }
  };

  const handleTypingStop = () => {
    if (socket && activeConversationId) {
      socket.emit('typing_stop', { conversationId: activeConversationId });
    }
  };

  // Message Actions
  const handleSaveEditedMessage = async (messageId, newContent) => {
    const res = await apiEditMessage(messageId, { content: newContent });
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, message_content: newContent, is_edited: true, updated_at: res.data.updated_at }
            : m
        )
      );
      notify.success('Message updated');
    }
  };

  const handleDeleteForMe = async (messageId) => {
    try {
      const res = await apiDeleteForMe(messageId);
      if (res.success) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        notify.success('Message deleted for you');
      }
    } catch (err) {
      notify.error('Failed to delete message');
    }
  };

  const handleDeleteForEveryone = async (messageId) => {
    try {
      const res = await apiDeleteForEveryone(messageId);
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, message_content: 'This message was deleted', deleted_for_everyone: true }
              : m
          )
        );
        notify.success('Message deleted for everyone');
      }
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to delete message for everyone');
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear this conversation history?')) return;
    try {
      const res = await apiClearHistory(activeConversationId);
      if (res.success) {
        setMessages([]);
        notify.success('Conversation history cleared');
      }
    } catch (err) {
      notify.error('Failed to clear conversation history');
    }
  };

  // In-conversation search matches navigation
  const searchMatches = searchQuery.trim()
    ? messages.filter(
        (m) =>
          !m.deleted_for_everyone &&
          m.message_content?.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : [];

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    const targetMsg = searchMatches[nextIdx];
    if (targetMsg) {
      document.getElementById(`message-${targetMsg.id}`)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    const targetMsg = searchMatches[prevIdx];
    if (targetMsg) {
      document.getElementById(`message-${targetMsg.id}`)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const typingUserList = Object.values(typingUsers);

  // Mobile Chrome keyboard visualViewport adjustment
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleViewportResize = () => {
      // Prevent browser jump on mobile virtual keyboard slide-up
      if (window.innerWidth < 768 && activeConversationId) {
        window.scrollTo(0, 0);
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [activeConversationId]);

  return (
    <PageTransition className="flex h-full w-full overflow-hidden bg-brand-bg">
      {/* Panel 1: Left Conversations Sidebar */}
      <div
        className={`${
          activeConversationId ? 'hidden md:flex' : 'flex'
        } w-full md:w-auto h-full shrink-0`}
      >
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          loading={loadingConversations}
          pendingRequestsCount={pendingRequestsCount}
          onOpenCreateGroup={() => setShowCreateGroupModal(true)}
        />
      </div>

      {/* Panel 2: Center Active Chat Panel or Empty Selection */}
      <div
        className={`${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        } flex-1 h-full flex flex-col bg-brand-bg overflow-hidden min-w-0`}
        style={{
          height: typeof window !== 'undefined' && window.innerWidth < 768 && viewportHeight ? `${viewportHeight}px` : undefined,
          maxHeight: typeof window !== 'undefined' && window.innerWidth < 768 && viewportHeight ? `${viewportHeight}px` : undefined
        }}
      >
        {activeConversationId ? (
          <>
            {/* Chat Top Header */}
            <ChatHeader
              conversationId={activeConversationId}
              participant={activeConversation?.participant}
              conversation={activeConversation}
              onBack={() => {
                setActiveConversationId(null);
                setSearchParams({});
              }}
              onToggleSearch={() => {
                setIsSearching((prev) => !prev);
                if (isSearching) setSearchQuery('');
              }}
              isSearching={isSearching}
              onToggleInfo={() => setShowInfoPanel((prev) => !prev)}
              showInfo={showInfoPanel}
              onClearHistory={handleClearHistory}
              onViewProfile={() =>
                activeConversation?.participant?.username &&
                navigate(`/profile/${activeConversation?.participant?.username}`)
              }
              onLeaveGroup={() => setShowInfoPanel(true)}
              onStartGroupCall={(callType) => {
                if (socket && activeConversationId) {
                  socket.emit('group_call:start', { conversationId: activeConversationId, callType }, (res) => {
                    if (res?.success) {
                      setActiveGroupCall(res.groupCall);
                    } else {
                      notify.error(res?.error || 'Failed to start group call');
                    }
                  });
                }
              }}
            />

            {/* In-Conversation Search Header */}
            {isSearching && (
              <ChatSearchBar
                searchQuery={searchQuery}
                onSearchChange={(val) => {
                  setSearchQuery(val);
                  setCurrentMatchIndex(0);
                }}
                matchCount={searchMatches.length}
                currentMatchIndex={currentMatchIndex}
                onNextMatch={handleNextMatch}
                onPrevMatch={handlePrevMatch}
                onClose={() => {
                  setIsSearching(false);
                  setSearchQuery('');
                }}
              />
            )}

            {/* Messages Scroll Area */}
            {loadingMessages ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-brand-muted">Loading messages...</p>
              </div>
            ) : (
              <MessageList
                key={`conv-${activeConversationId}-${conversationVisitKey}`}
                conversationId={activeConversationId}
                messages={messages}
                currentUserId={user?.id}
                participant={activeConversation?.participant}
                isGroup={activeConversation?.conversation_type === 'group'}
                group={activeConversation?.group}
                searchHighlight={searchQuery}
                onEditMessage={(msg) => setEditingMessage(msg)}
                onDeleteForMe={handleDeleteForMe}
                onDeleteForEveryone={handleDeleteForEveryone}
                onReplyMessage={(msg) => setReplyingTo(msg)}
                onForwardMessage={(msg) => setForwardingMessage(msg)}
                onToggleReaction={handleToggleReaction}
                onOpenImageViewer={(att) => setActiveImageViewer(att)}
                onLoadMore={handleLoadMore}
                hasMore={hasMoreMessages}
                loadingMore={loadingMore}
                isKeyboardOpen={isKeyboardOpen}
              />
            )}

            {/* Real-Time Typing Indicator Banner */}
            {typingUserList.length > 0 && (
              <TypingIndicator users={typingUserList} />
            )}

            {/* Bottom Message Composer */}
            <MessageComposer
              onSendMessage={handleSendMessage}
              onSendAttachment={handleSendAttachment}
              onSendVoice={handleSendVoice}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              isKeyboardOpen={isKeyboardOpen}
            />
          </>
        ) : (
          /* Empty State when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="mb-4">
              <MeltLogo size="xl" showWordmark={true} showBadge={true} badgeText="PRO" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-text mb-2 tracking-tight">
              Your conversations, all in one place
            </h2>
            <p className="text-xs sm:text-sm text-brand-muted max-w-md leading-relaxed mb-6">
              Stay connected. Share moments. Keep conversations flowing on MELT. Pick a chat from the sidebar or discover new people by @username.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-brand-subtle">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-brand-secondary" />
                End-to-End Encrypted
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-brand-primary" />
                Ultra-Low Latency
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#EC4899]" />
                Media & Voice
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Panel 3: Right Collapsible Contact / Group Info Panel */}
      {showInfoPanel && (
        activeConversation?.conversation_type === 'group' ? (
          <GroupInfoPanel
            conversationId={activeConversationId}
            currentUserId={user?.id}
            onClose={() => setShowInfoPanel(false)}
            onGroupDeleted={() => {
              setActiveConversationId(null);
              fetchConversations();
            }}
            onGroupLeft={() => {
              setActiveConversationId(null);
              fetchConversations();
            }}
          />
        ) : activeConversation?.participant ? (
          <ChatInfoPanel
            participant={activeConversation.participant}
            onClose={() => setShowInfoPanel(false)}
            onClearHistory={handleClearHistory}
          />
        ) : null
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <CreateGroupModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={(newGroup, conversationId) => {
            fetchConversations();
            setActiveConversationId(conversationId);
          }}
        />
      )}

      {/* Group Call Modal */}
      {activeGroupCall && (
        <GroupCallModal
          isOpen={Boolean(activeGroupCall)}
          callData={activeGroupCall}
          onClose={() => setActiveGroupCall(null)}
        />
      )}

      {/* Edit Message Modal */}
      {editingMessage && (
        <EditMessageModal
          isOpen={Boolean(editingMessage)}
          onClose={() => setEditingMessage(null)}
          message={editingMessage}
          onSave={handleSaveEditedMessage}
        />
      )}

      {/* Forward Message Dialog */}
      {forwardingMessage && (
        <ForwardMessageDialog
          message={forwardingMessage}
          conversations={conversations}
          currentConversationId={activeConversationId}
          onForward={handleForwardMessage}
          onClose={() => setForwardingMessage(null)}
        />
      )}

      {/* Image Viewer Lightbox Modal */}
      {activeImageViewer && (
        <ImageViewer
          activeImage={activeImageViewer}
          allImages={chatImages}
          onClose={() => setActiveImageViewer(null)}
          onSelectImage={(img) => setActiveImageViewer(img)}
        />
      )}
    </PageTransition>
  );
};

export default ChatPage;

