import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Clock, Check, X, MessageSquare, Ban } from 'lucide-react';
import Button from '@/components/ui/Button';
import { sendChatRequest, acceptChatRequest, cancelChatRequest } from '@/services/api';
import { notify } from '@/components/common/ToastProvider';

export const ChatRequestButton = ({
  user,
  onStatusChange,
  size = 'sm',
  className = ''
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSendRequest = async (e) => {
    e.stopPropagation();
    try {
      setLoading(true);
      const res = await sendChatRequest({ receiver_id: user.id });
      if (res.success) {
        notify.success(`Chat request sent to @${user.username}`);
        if (onStatusChange) {
          onStatusChange(user.id, 'pending_outgoing', res.requestId);
        }
      }
    } catch (err) {
      notify.error(err.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (e) => {
    e.stopPropagation();
    if (!user.request_id) return;
    try {
      setLoading(true);
      const res = await acceptChatRequest(user.request_id);
      if (res.success) {
        notify.success(`Connected with @${user.username}!`);
        if (onStatusChange) {
          onStatusChange(user.id, 'connected', null, res.conversationId);
        }
      }
    } catch (err) {
      notify.error(err.message || 'Failed to accept request');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (e) => {
    e.stopPropagation();
    if (!user.request_id) return;
    try {
      setLoading(true);
      const res = await cancelChatRequest(user.request_id);
      if (res.success) {
        notify.info('Chat request cancelled');
        if (onStatusChange) {
          onStatusChange(user.id, 'none', null);
        }
      }
    } catch (err) {
      notify.error(err.message || 'Failed to cancel request');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = (e) => {
    e.stopPropagation();
    navigate('/dashboard');
  };

  if (user.relationship === 'connected') {
    return (
      <Button
        variant="secondary"
        size={size}
        className={className}
        onClick={handleOpenChat}
        leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
      >
        Open Chat
      </Button>
    );
  }

  if (user.relationship === 'pending_outgoing') {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size={size}
          className={`border-amber-500/30 text-amber-400 bg-amber-500/10 cursor-default ${className}`}
          leftIcon={<Clock className="w-3.5 h-3.5" />}
          disabled
        >
          Pending
        </Button>
        <button
          type="button"
          onClick={handleCancelRequest}
          disabled={loading}
          className="p-1.5 rounded-lg text-brand-subtle hover:text-brand-danger hover:bg-white/5 transition-colors text-xs"
          title="Cancel Request"
          aria-label="Cancel Request"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (user.relationship === 'pending_incoming') {
    return (
      <Button
        variant="primary"
        size={size}
        className={className}
        isLoading={loading}
        onClick={handleAcceptRequest}
        leftIcon={<Check className="w-3.5 h-3.5" />}
      >
        Accept
      </Button>
    );
  }

  if (user.relationship === 'blocked') {
    return (
      <span className="px-2.5 py-1 rounded-lg text-xs font-medium text-brand-danger bg-brand-danger/10 border border-brand-danger/20 flex items-center gap-1">
        <Ban className="w-3 h-3" />
        <span>Blocked</span>
      </span>
    );
  }

  if (!user.allow_chat_requests) {
    return (
      <span className="text-xs text-brand-subtle px-2 py-1">
        Requests Off
      </span>
    );
  }

  return (
    <Button
      variant="primary"
      size={size}
      className={className}
      isLoading={loading}
      onClick={handleSendRequest}
      leftIcon={<UserPlus className="w-3.5 h-3.5" />}
    >
      Request Chat
    </Button>
  );
};

export default ChatRequestButton;

