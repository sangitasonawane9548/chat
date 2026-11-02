import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, UserPlus, Inbox, Send, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import RequestTabs from '@/components/requests/RequestTabs';
import RequestCard from '@/components/requests/RequestCard';
import EmptyState from '@/components/common/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  getIncomingChatRequests,
  getSentChatRequests,
  acceptChatRequest,
  declineChatRequest,
  cancelChatRequest
} from '@/services/api';
import { notify } from '@/components/common/ToastProvider';
import { useSocket } from '@/context/SocketContext';

export const ChatRequests = () => {
  const navigate = useNavigate();
  const { refreshCounts } = useSocket();

  const [activeTab, setActiveTab] = useState('incoming');
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const [incRes, sentRes] = await Promise.all([
        getIncomingChatRequests(),
        getSentChatRequests()
      ]);

      if (incRes.success) setIncomingRequests(incRes.requests || []);
      if (sentRes.success) setSentRequests(sentRes.requests || []);
    } catch (err) {
      notify.error(err.message || 'Failed to fetch chat requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAccept = async (requestId) => {
    try {
      const res = await acceptChatRequest(requestId);
      if (res.success) {
        notify.success('Chat request accepted! Conversation established.');
        setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
        refreshCounts();
      }
    } catch (err) {
      notify.error(err.message || 'Failed to accept chat request');
    }
  };

  const handleDecline = async (requestId) => {
    try {
      const res = await declineChatRequest(requestId);
      if (res.success) {
        notify.info('Chat request declined.');
        setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
        refreshCounts();
      }
    } catch (err) {
      notify.error(err.message || 'Failed to decline chat request');
    }
  };

  const handleCancel = async (requestId) => {
    try {
      const res = await cancelChatRequest(requestId);
      if (res.success) {
        notify.info('Chat request cancelled.');
        setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (err) {
      notify.error(err.message || 'Failed to cancel chat request');
    }
  };

  return (
    <PageTransition className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold font-display text-brand-text tracking-tight">Chat Requests</h1>
        <p className="text-xs text-brand-muted mt-1">
          Review incoming one-to-one messaging requests and manage sent invitations
        </p>
      </div>

      {/* Tabs */}
      <RequestTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        incomingCount={incomingRequests.length}
        sentCount={sentRequests.length}
      />

      {/* Content */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : activeTab === 'incoming' ? (
        incomingRequests.length > 0 ? (
          <div className="space-y-3">
            {incomingRequests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                type="incoming"
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-8 border border-brand-border">
            <EmptyState
              icon={<Inbox className="w-8 h-8 text-brand-primary" />}
              title="No Incoming Requests"
              description="You have no pending chat requests from other users. When someone searches your username and requests to connect, it will appear here."
              actionLabel="Discover People"
              onAction={() => navigate('/discover')}
            />
          </div>
        )
      ) : sentRequests.length > 0 ? (
        <div className="space-y-3">
          {sentRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              type="sent"
              onCancel={handleCancel}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-8 border border-brand-border">
          <EmptyState
            icon={<Send className="w-8 h-8 text-brand-secondary" />}
            title="No Sent Requests"
            description="You haven't sent any pending chat requests to other users. Search usernames to discover people and send invitations."
            actionLabel="Search Usernames"
            onAction={() => navigate('/discover')}
          />
        </div>
      )}
    </PageTransition>
  );
};

export default ChatRequests;

