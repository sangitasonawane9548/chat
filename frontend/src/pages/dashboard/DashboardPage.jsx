import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Users,
  Compass,
  Phone,
  Video,
  Plus,
  Sparkles,
  ArrowRight,
  Search,
  CircleDashed,
  Radio,
  Clock,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getUserConversations, getFeedStatusesApi } from '@/services/api';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import PageTransition from '@/components/common/PageTransition';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [statuses, setStatuses] = useState([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [filter, setFilter] = useState('all'); // all, direct, groups, unread

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoadingConversations(true);
        const [convRes, statusRes] = await Promise.all([
          getUserConversations(),
          getFeedStatusesApi().catch(() => ({ success: false }))
        ]);

        if (isMounted && convRes.success) {
          setConversations(convRes.conversations || []);
        }
        if (isMounted && statusRes.success) {
          setStatuses(statusRes.groupedStatuses || []);
        }
      } catch (err) {
        console.error('[Dashboard] Error loading overview data:', err);
      } finally {
        if (isMounted) {
          setLoadingConversations(false);
          setLoadingStatuses(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter conversations based on selected tab
  const filteredConversations = conversations.filter((c) => {
    if (filter === 'unread') return (c.unread_count || 0) > 0;
    if (filter === 'groups') return c.conversation_type === 'group';
    if (filter === 'direct') return c.conversation_type === 'direct';
    return true;
  });

  // Extract online contacts
  const onlineContacts = conversations
    .filter((c) => c.conversation_type === 'direct' && c.participant?.is_online)
    .map((c) => ({
      conversationId: c.id,
      ...c.participant
    }));

  return (
    <PageTransition
      className="p-3 xs:p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 min-w-0"
      style={{
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* 1. Welcome Header Banner */}
      <div className="relative rounded-3xl p-5 sm:p-8 bg-gradient-to-r from-violet-600/15 via-purple-600/10 to-rose-500/10 border border-brand-border overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <Avatar
              name={user?.full_name}
              src={user?.profile_picture}
              size="xl"
              status="online"
              className="ring-4 ring-brand-surface shadow-md shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg xs:text-xl sm:text-2xl font-extrabold font-display text-brand-text tracking-tight truncate">
                  Welcome back, {user?.full_name?.split(' ')[0] || user?.username}!
                </h1>
                <Badge variant="emerald" size="sm" dot>Online</Badge>
              </div>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5 truncate">
                @{user?.username} • Real-time messaging ready
              </p>
            </div>
          </div>

          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2.5 w-full md:w-auto">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/chat')}
              leftIcon={<MessageSquare className="w-4 h-4" />}
              className="w-full xs:w-auto justify-center shadow-sm"
            >
              Open Active Chats
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/discover')}
              leftIcon={<Compass className="w-4 h-4" />}
              className="w-full xs:w-auto justify-center shadow-sm"
            >
              Find People
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Key Telemetry & Metric Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-brand-surface border border-brand-border/80 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-brand-primary flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-brand-muted truncate">Conversations</p>
            <p className="text-base sm:text-lg font-bold text-brand-text truncate">{conversations.length}</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-brand-surface border border-brand-border/80 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-brand-muted truncate">Contacts Online</p>
            <p className="text-base sm:text-lg font-bold text-brand-text truncate">{onlineContacts.length}</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-brand-surface border border-brand-border/80 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
            <CircleDashed className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-brand-muted truncate">Active Stories</p>
            <p className="text-base sm:text-lg font-bold text-brand-text truncate">{statuses.length}</p>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-brand-surface border border-brand-border/80 shadow-sm flex items-center gap-3 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-brand-muted truncate">P2P Encryption</p>
            <p className="text-base sm:text-lg font-bold text-emerald-500 truncate">Protected</p>
          </div>
        </div>
      </div>

      {/* 3. Active Stories & Moments Rail */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDashed className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-text">
              24-Hour Stories & Moments
            </h2>
          </div>
          <Link to="/status" className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none pt-1 overscroll-x-contain [webkit-overflow-scrolling:touch]">
          {/* Add Story Button */}
          <button
            onClick={() => navigate('/status')}
            className="flex flex-col items-center gap-2 shrink-0 group focus:outline-none"
          >
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-violet-500/50 flex items-center justify-center bg-brand-surface group-hover:border-violet-500 group-hover:scale-105 transition-all shadow-sm">
              <Plus className="w-6 h-6 text-violet-500 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[11px] font-medium text-brand-muted truncate max-w-[68px]">Your Story</span>
          </button>

          {/* Status Updates Carousel */}
          {statuses.slice(0, 8).map((st) => (
            <button
              key={st.user.id}
              onClick={() => navigate('/status')}
              className="flex flex-col items-center gap-2 shrink-0 group focus:outline-none"
            >
              <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-violet-600 via-purple-500 to-rose-400 group-hover:scale-105 transition-transform shadow-sm">
                <Avatar
                  name={st.user.full_name}
                  src={st.user.profile_picture}
                  size="lg"
                  className="ring-2 ring-brand-bg"
                />
              </div>
              <span className="text-[11px] font-medium text-brand-text truncate max-w-[68px]">
                {st.user.full_name?.split(' ')[0] || st.user.username}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Online Contacts Horizontal Rail */}
      {onlineContacts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-text">
              Active Contacts Online ({onlineContacts.length})
            </h2>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-2 scrollbar-none overscroll-x-contain [webkit-overflow-scrolling:touch]">
            {onlineContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => navigate(`/chat?c=${contact.conversationId}`)}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-brand-surface border border-brand-border hover:border-violet-500/40 hover:bg-brand-card transition-all shrink-0 shadow-sm"
              >
                <Avatar
                  name={contact.full_name}
                  src={contact.profile_picture}
                  size="sm"
                  status="online"
                />
                <div className="text-left min-w-0 pr-1">
                  <p className="text-xs font-semibold text-brand-text truncate max-w-[120px]">{contact.full_name}</p>
                  <p className="text-[10px] text-emerald-500 font-medium">Online</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Recent Conversations Feed */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-text">
              Recent Conversations
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-brand-surface border border-brand-border self-start sm:self-auto text-xs font-medium max-w-full overflow-x-auto scrollbar-none">
            {[
              { id: 'all', label: 'All' },
              { id: 'direct', label: 'Direct' },
              { id: 'groups', label: 'Groups' },
              { id: 'unread', label: 'Unread' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filter === tab.id
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-muted hover:text-brand-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Cards Grid */}
        {loadingConversations ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="p-4 rounded-2xl bg-brand-surface border border-brand-border animate-pulse flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-card" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3.5 bg-brand-card rounded" />
                  <div className="w-48 h-3 bg-brand-card rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <Card className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-violet-500/40 mx-auto mb-3" />
            <h3 className="text-base font-bold text-brand-text mb-1">No conversations found</h3>
            <p className="text-xs text-brand-muted max-w-sm mx-auto mb-5">
              {filter === 'unread'
                ? "You're all caught up! No unread messages."
                : 'Start a conversation with friends or explore user handles on the discover screen.'}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/discover')}
              leftIcon={<Compass className="w-3.5 h-3.5" />}
            >
              Discover Users
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredConversations.map((conv) => {
              const isGroup = conv.conversation_type === 'group';
              const name = isGroup
                ? (conv.group?.name || conv.participant?.full_name || 'Group')
                : (conv.participant?.full_name || 'User');
              const picture = isGroup ? conv.group?.profile_image : conv.participant?.profile_picture;
              const hasUnread = (conv.unread_count || 0) > 0;
              const lastMsg = conv.last_message;

              return (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/chat?c=${conv.id}`)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 group select-none ${
                    hasUnread
                      ? 'bg-brand-surface border-brand-primary/40 shadow-sm'
                      : 'bg-brand-surface hover:bg-brand-card border-brand-border'
                  }`}
                >
                  <div className="relative">
                    <Avatar
                      name={name}
                      src={picture}
                      size="lg"
                      status={!isGroup && conv.participant?.is_online ? 'online' : null}
                    />
                    {isGroup && (
                      <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-violet-600 text-white text-[9px] shadow-sm">
                        <Users className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-brand-text truncate group-hover:text-brand-primary transition-colors">
                        {name}
                      </h4>
                      {lastMsg?.created_at && (
                        <span className="text-[10px] text-brand-muted shrink-0 ml-2">
                          {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${hasUnread ? 'text-brand-text font-semibold' : 'text-brand-muted'}`}>
                        {lastMsg?.message_content || 'No messages yet'}
                      </p>

                      {hasUnread && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white shrink-0 shadow-sm">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guaranteed Bottom Viewport Spacer for Floating Navigation Bar */}
      <div className="h-28 sm:h-20 w-full shrink-0" aria-hidden="true" />
    </PageTransition>
  );
};

export default DashboardPage;
