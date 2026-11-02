import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video,
  MessageSquare,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Radio,
  RefreshCw,
  Plus
} from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import EmptyState from '@/components/common/EmptyState';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { notify } from '@/components/common/ToastProvider';
import { useCall } from '@/context/CallContext';
import {
  getCallHistoryApi,
  getUserConversations
} from '@/services/api';
import { formatConversationTime } from '@/utils/date';

export const CallsPage = () => {
  const navigate = useNavigate();
  const { startAudioCall, startVideoCall, callStatus } = useCall();

  // Filters: 'all' | 'video' | 'audio' | 'missed' | 'incoming' | 'outgoing'
  const [activeTab, setActiveTab] = useState('all');
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Start Call Modal
  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Fetch Call History
  const fetchCallHistory = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await getCallHistoryApi({
        filter: activeTab,
        page,
        limit: 20
      });

      if (res.success) {
        setCalls(res.calls || []);
        setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('[CallsPage] Error loading history:', err);
      notify.error('Failed to load call history');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchCallHistory(1);
  }, [fetchCallHistory]);

  // Load authorized conversations for "Start Call" modal
  const loadContactsForCall = async () => {
    try {
      setLoadingConversations(true);
      const res = await getUserConversations();
      if (res.success) {
        setConversations(res.conversations || []);
      }
    } catch (err) {
      console.error('[CallsPage] Error loading contacts:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const openNewCallModal = () => {
    setIsNewCallModalOpen(true);
    loadContactsForCall();
  };

  // Helper to format duration
  const formatDurationText = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
    }
    return `${secs}s`;
  };

  // Trigger audio call to participant
  const handleStartAudioCall = (conversationId, participant) => {
    if (callStatus !== 'idle') {
      notify.warning('You are already in an active call');
      return;
    }
    setIsNewCallModalOpen(false);
    startAudioCall(conversationId, participant);
  };

  // Trigger video call to participant
  const handleStartVideoCall = (conversationId, participant) => {
    if (callStatus !== 'idle') {
      notify.warning('You are already in an active call');
      return;
    }
    setIsNewCallModalOpen(false);
    startVideoCall(conversationId, participant);
  };

  // Filtered contacts in start call modal
  const filteredContacts = conversations.filter((c) => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return true;
    const name = c.participant?.full_name?.toLowerCase() || '';
    const username = c.participant?.username?.toLowerCase() || '';
    return name.includes(q) || username.includes(q);
  });

  return (
    <PageTransition className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-text tracking-tight flex items-center gap-2.5">
            <span>Voice & Video Calling</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-violet-500/10 text-violet-500 border border-violet-500/30">
              WebRTC P2P
            </span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Encrypted peer-to-peer real-time audio and HD video records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchCallHistory(pagination.page)}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            className="text-brand-muted hover:text-brand-text"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={openNewCallModal}
            leftIcon={<PhoneCall className="w-3.5 h-3.5" />}
          >
            Start Call
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-brand-border/60 pb-3 text-xs overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 shrink-0">
          {[
            { id: 'all', label: 'All Calls' },
            { id: 'video', label: 'Video Calls' },
            { id: 'audio', label: 'Audio Calls' },
            { id: 'missed', label: 'Missed' },
            { id: 'incoming', label: 'Incoming' },
            { id: 'outgoing', label: 'Outgoing' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl capitalize font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30'
                  : 'text-brand-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {pagination.total > 0 && (
          <span className="text-[11px] text-brand-subtle hidden sm:inline-block shrink-0 ml-2">
            Showing {calls.length} of {pagination.total} records
          </span>
        )}
      </div>

      {/* Calls List or Loading or Empty State */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="glass-card rounded-2xl p-4 flex items-center justify-between animate-pulse"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/5" />
                <div className="space-y-2">
                  <div className="w-32 h-4 rounded bg-white/5" />
                  <div className="w-24 h-3 rounded bg-white/5" />
                </div>
              </div>
              <div className="w-20 h-8 rounded-xl bg-white/5" />
            </div>
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 min-h-[360px] flex items-center justify-center">
          <EmptyState
            icon={
              activeTab === 'video' ? (
                <Video className="w-8 h-8 text-brand-primary" />
              ) : (
                <Phone className="w-8 h-8 text-brand-secondary" />
              )
            }
            title={
              activeTab === 'missed'
                ? 'No Missed Calls'
                : activeTab === 'video'
                ? 'No Video Calls'
                : activeTab === 'audio'
                ? 'No Audio Calls'
                : activeTab === 'incoming'
                ? 'No Incoming Calls'
                : activeTab === 'outgoing'
                ? 'No Outgoing Calls'
                : 'No Call History'
            }
            description={
              activeTab === 'missed'
                ? "You don't have any missed audio or video calls."
                : activeTab === 'video'
                ? "You haven't made or received any video calls yet."
                : 'Initiate encrypted peer-to-peer audio or video calls with authorized contacts from any conversation.'
            }
            actionLabel="Start a Call"
            actionIcon={<Plus className="w-3.5 h-3.5" />}
            onAction={openNewCallModal}
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {calls.map((call) => {
            const isVideoCall = call.call_type === 'video';
            const isMissed = call.call_outcome === 'missed' || call.status === 'missed';
            const isOutgoing = call.direction === 'outgoing' || call.my_role === 'caller';
            const isCompleted = call.status === 'ended' && call.duration_seconds > 0;

            const otherUser = {
              id: call.other_user_id,
              username: call.other_username,
              full_name: call.other_full_name,
              profile_picture: call.other_profile_picture
            };

            return (
              <div
                key={call.id}
                className="glass-card rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-4 hover:border-brand-border/80 transition-all group"
              >
                {/* Left: Direction Icon & Contact Identity */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative">
                    <Avatar
                      name={call.other_full_name}
                      src={call.other_profile_picture}
                      size="md"
                      shape="rounded"
                    />
                    {/* Status badge in bottom-right corner of avatar */}
                    <div
                      className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ring-2 ring-brand-surface ${
                        isMissed
                          ? 'bg-brand-danger text-white'
                          : isOutgoing
                          ? 'bg-brand-primary text-white'
                          : 'bg-brand-secondary text-white'
                      }`}
                      title={
                        isMissed
                          ? 'Missed call'
                          : isOutgoing
                          ? 'Outgoing call'
                          : 'Incoming call'
                      }
                    >
                      {isMissed ? (
                        <PhoneMissed className="w-2.5 h-2.5" />
                      ) : isOutgoing ? (
                        <PhoneOutgoing className="w-2.5 h-2.5" />
                      ) : (
                        <PhoneIncoming className="w-2.5 h-2.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate group-hover:text-brand-primary transition-colors">
                        {call.other_full_name || 'Contact'}
                      </span>
                      <span className="text-xs text-brand-muted truncate">
                        @{call.other_username}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs flex-wrap">
                      {/* Call Type Pill */}
                      <span className="inline-flex items-center gap-1 text-[11px] text-brand-primary font-medium">
                        {isVideoCall ? (
                          <Video className="w-3 h-3 text-brand-primary" />
                        ) : (
                          <Phone className="w-3 h-3 text-brand-secondary" />
                        )}
                        <span>{isVideoCall ? 'Video' : 'Audio'}</span>
                      </span>

                      <span className="text-brand-subtle">•</span>

                      {/* Call outcome description */}
                      <span
                        className={`font-medium ${
                          isMissed
                            ? 'text-brand-danger'
                            : isCompleted
                            ? 'text-brand-secondary'
                            : 'text-brand-muted'
                        }`}
                      >
                        {isMissed
                          ? 'Missed Call'
                          : isCompleted
                          ? formatDurationText(call.duration_seconds)
                          : call.status === 'rejected'
                          ? 'Declined'
                          : call.status === 'cancelled'
                          ? 'Cancelled'
                          : 'Unanswered'}
                      </span>

                      <span className="text-brand-subtle">•</span>

                      {/* Call timestamp */}
                      <span className="text-brand-muted" title={call.started_at}>
                        {formatConversationTime(call.started_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Chat Message link */}
                  {call.conversation_id && (
                    <button
                      onClick={() => navigate(`/chat?c=${call.conversation_id}`)}
                      className="p-2 rounded-xl text-brand-muted hover:text-white hover:bg-white/5 transition-colors hidden sm:flex"
                      title="Open Conversation"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}

                  {/* Audio Call Back */}
                  <button
                    onClick={() => handleStartAudioCall(call.conversation_id, otherUser)}
                    className="p-2 rounded-xl text-brand-muted hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
                    title={`Audio Call @${otherUser.username}`}
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  {/* Video Call Back */}
                  <button
                    onClick={() => handleStartVideoCall(call.conversation_id, otherUser)}
                    className="p-2 rounded-xl text-brand-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors"
                    title={`Video Call @${otherUser.username}`}
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-brand-border/60 text-xs">
          <Button
            variant="ghost"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => fetchCallHistory(pagination.page - 1)}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Previous
          </Button>

          <span className="text-brand-muted font-medium">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <Button
            variant="ghost"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchCallHistory(pagination.page + 1)}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Next
          </Button>
        </div>
      )}

      {/* Start New Call Modal */}
      <Modal
        isOpen={isNewCallModalOpen}
        onClose={() => setIsNewCallModalOpen(false)}
        title="Start Encrypted WebRTC Call"
        description="Select an active contact or conversation to place a peer-to-peer audio or video call."
      >
        <div className="space-y-4 pt-1">
          <Input
            placeholder="Search contacts by name or username..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            autoFocus
          />

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {loadingConversations ? (
              <div className="p-6 text-center text-xs text-brand-muted">
                Loading contacts...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-6 text-center text-xs text-brand-muted">
                {searchFilter ? 'No matching contacts found' : 'No active conversations yet'}
              </div>
            ) : (
              filteredContacts.map((c) => {
                const p = c.participant;
                return (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-white/5 border border-brand-border hover:border-brand-primary/40 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={p?.full_name}
                        src={p?.profile_picture}
                        size="sm"
                        shape="rounded"
                        status={p?.is_online ? 'online' : null}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {p?.full_name}
                        </p>
                        <p className="text-[11px] text-brand-muted truncate">
                          @{p?.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartAudioCall(c.id, p)}
                        leftIcon={<Phone className="w-3.5 h-3.5" />}
                        title="Start Audio Call"
                      >
                        Audio
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleStartVideoCall(c.id, p)}
                        leftIcon={<Video className="w-3.5 h-3.5" />}
                        title="Start Video Call"
                      >
                        Video
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
};

export default CallsPage;
