import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MessageSquare,
  Compass,
  UserPlus,
  Users,
  Check,
  CheckCheck,
  Ban
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { formatConversationTime } from '@/utils/date';

export const ConversationSidebar = ({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  loading = false,
  pendingRequestsCount = 0,
  onOpenCreateGroup
}) => {
  const navigate = useNavigate();
  const [filterQuery, setFilterQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    // Tab filter
    if (activeTab === 'unread' && (!conv.unread_count || conv.unread_count === 0)) {
      return false;
    }
    if (activeTab === 'direct' && conv.conversation_type !== 'direct') {
      return false;
    }
    if (activeTab === 'groups' && conv.conversation_type !== 'group') {
      return false;
    }

    // Text search filter
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase().trim().replace(/^@/, '');
    const title = conv.conversation_type === 'group'
      ? (conv.group?.name || conv.participant?.full_name || '')
      : (conv.participant?.full_name || '');
    const nameMatch = title.toLowerCase().includes(q);
    const usernameMatch = conv.participant?.username?.toLowerCase().includes(q);
    const lastMsgMatch = conv.last_message?.message_content?.toLowerCase().includes(q);

    return nameMatch || usernameMatch || lastMsgMatch;
  });

  return (
    <div className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-brand-sidebar border-r border-brand-border select-none shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand-primary" />
          <h1 className="text-base font-bold text-brand-text font-display tracking-tight">Messages</h1>
        </div>

        <div className="flex items-center gap-1">
          {/* New Group Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenCreateGroup}
            className="p-2 text-brand-muted hover:text-brand-text"
            title="Create New Group"
          >
            <Users className="w-4 h-4 text-brand-primary" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/requests')}
            className="relative p-2 text-brand-muted hover:text-brand-text"
            title="Chat Requests"
          >
            <UserPlus className="w-4 h-4" />
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-primary" />
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/discover')}
            leftIcon={<Compass className="w-3.5 h-3.5" />}
            className="text-xs py-1 px-2 xs:px-2.5 shrink-0"
            title="Discover users"
            aria-label="Discover users"
          >
            <span className="hidden xs:inline">Discover</span>
          </Button>
        </div>
      </div>

      {/* Filter / Search Conversations */}
      <div className="p-3 border-b border-brand-border/60 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-brand-surface text-brand-text placeholder-brand-muted/70 rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary/60 transition-all shadow-sm"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 text-[11px]">
          {['all', 'direct', 'groups', 'unread'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-0.5 rounded-lg font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30 font-semibold'
                  : 'text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-brand-border/30 pb-24 md:pb-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-white/5" />
                <div className="flex-1 space-y-2">
                  <div className="w-24 h-3 rounded bg-white/5" />
                  <div className="w-36 h-2.5 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conv) => {
            const isActive = activeConversationId === conv.id;
            const isGroup = conv.conversation_type === 'group';
            const participant = conv.participant;
            const lastMsg = conv.last_message;
            const groupTitle = conv.group?.name || participant?.full_name || 'Group Chat';

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-brand-primary/10 border-l-4 border-brand-primary pl-2.5'
                    : 'hover:bg-white/5 border-l-4 border-transparent'
                }`}
              >
                {/* Avatar with live presence indicator */}
                <div className="relative shrink-0">
                  {isGroup ? (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary/30 to-purple-600/30 border border-brand-primary/40 flex items-center justify-center text-white">
                      {conv.group?.profile_image ? (
                        <img
                          src={conv.group.profile_image}
                          alt={groupTitle}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Users className="w-5 h-5 text-brand-primary" />
                      )}
                    </div>
                  ) : (
                    <Avatar
                      name={participant?.full_name}
                      src={participant?.profile_picture}
                      size="md"
                      shape="rounded"
                      status={participant?.is_online ? 'online' : null}
                    />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3
                        className={`text-sm truncate font-medium ${
                          isActive ? 'text-white font-semibold' : 'text-brand-text'
                        }`}
                      >
                        {isGroup ? groupTitle : (participant?.full_name || 'Direct Conversation')}
                      </h3>
                      {isGroup && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-primary/15 text-brand-primary border border-brand-primary/25">
                          Group
                        </span>
                      )}
                    </div>

                    {lastMsg && (
                      <span className="text-[10px] text-brand-subtle shrink-0 ml-2">
                        {formatConversationTime(lastMsg.created_at)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    {/* Last message preview */}
                    <div className="flex items-center gap-1 min-w-0 text-xs text-brand-muted truncate">
                      {lastMsg ? (
                        <>
                          {lastMsg.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-brand-secondary shrink-0" />
                          ) : lastMsg.status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-brand-subtle shrink-0" />
                          ) : lastMsg.status === 'sent' ? (
                            <Check className="w-3.5 h-3.5 text-brand-subtle shrink-0" />
                          ) : null}

                          {lastMsg.deleted_for_everyone ? (
                            <span className="italic text-brand-subtle text-[11px] flex items-center gap-1">
                              <Ban className="w-3 h-3" />
                              This message was deleted
                            </span>
                          ) : isGroup && lastMsg.message_type !== 'system' && (lastMsg.sender_full_name || lastMsg.sender_username) ? (
                            <span className="truncate">
                              <span className="font-semibold text-brand-text/90">
                                {lastMsg.sender_full_name?.split(' ')[0] || lastMsg.sender_username}:
                              </span>{' '}
                              {lastMsg.message_content}
                            </span>
                          ) : (
                            <span className="truncate">{lastMsg.message_content}</span>
                          )}
                        </>
                      ) : (
                        <span className="italic text-brand-subtle text-[11px]">
                          {isGroup ? 'Group created' : `@${participant?.username}`}
                        </span>
                      )}
                    </div>

                    {/* Unread message count badge */}
                    {conv.unread_count > 0 && (
                      <span className="shrink-0 ml-1.5 px-2 py-0.5 rounded-full bg-brand-primary text-white text-[10px] font-bold shadow-glow-primary">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center select-none">
            <MessageSquare className="w-8 h-8 text-brand-subtle mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium text-brand-muted mb-1">
              {filterQuery ? 'No conversations match your search' : 'No conversations yet'}
            </p>
            <p className="text-[11px] text-brand-subtle mb-4">
              {filterQuery
                ? 'Try searching by group name or @username'
                : 'Start a group or discover users to chat'}
            </p>
            {!filterQuery && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenCreateGroup}
                  leftIcon={<Users className="w-3.5 h-3.5" />}
                  className="text-xs"
                >
                  New Group
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => navigate('/discover')}
                  leftIcon={<Compass className="w-3.5 h-3.5" />}
                  className="text-xs"
                >
                  Find People
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationSidebar;


