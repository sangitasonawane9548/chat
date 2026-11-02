import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Phone,
  Video,
  PanelRight,
  MoreVertical,
  Trash2,
  User,
  Users,
  LogOut,
  Info
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { formatConversationTime } from '@/utils/date';
import { notify } from '@/components/common/ToastProvider';
import AudioCallButton from '@/components/calling/AudioCallButton';
import VideoCallButton from '@/components/calling/VideoCallButton';

export const ChatHeader = ({
  conversationId,
  participant,
  conversation,
  onBack,
  onToggleSearch,
  isSearching,
  onToggleInfo,
  showInfo,
  onClearHistory,
  onViewProfile,
  onLeaveGroup,
  onStartGroupCall
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const isGroup = conversation?.conversation_type === 'group' || participant?.is_group;
  const group = conversation?.group;
  const groupTitle = group?.name || participant?.full_name || 'Group Chat';

  // Status text display
  const getStatusText = () => {
    if (isGroup) {
      const count = group?.members_count || participant?.members_count;
      return count ? `${count} members` : 'Group conversation';
    }
    if (!participant) return '';
    if (participant.is_online) return 'Online';
    if (participant.show_online_status && participant.last_seen) {
      return `Last seen ${formatConversationTime(participant.last_seen)}`;
    }
    return 'Offline';
  };

  return (
    <div className="h-14 xs:h-16 px-2.5 xs:px-4 bg-brand-surface/90 border-b border-brand-border backdrop-blur-md flex items-center justify-between z-10 shrink-0 select-none transition-colors duration-200">
      {/* Left: Back (mobile) + Contact/Group Identity */}
      <div className="flex items-center gap-1.5 xs:gap-2.5 min-w-0 flex-1 mr-2">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 rounded-lg text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
            title="Back to conversations"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div
          onClick={onToggleInfo}
          className="flex items-center gap-2 xs:gap-3 cursor-pointer group min-w-0 flex-1"
        >
          <div className="relative shrink-0">
            {isGroup ? (
              <div className="w-8 h-8 xs:w-10 xs:h-10 rounded-xl bg-gradient-to-tr from-brand-primary/30 to-purple-600/30 border border-brand-primary/40 flex items-center justify-center text-white">
                {group?.profile_image || participant?.profile_picture ? (
                  <img
                    src={group?.profile_image || participant?.profile_picture}
                    alt={groupTitle}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <Users className="w-4 h-4 xs:w-5 xs:h-5 text-brand-primary" />
                )}
              </div>
            ) : (
              <Avatar
                name={participant?.full_name}
                src={participant?.profile_picture}
                size="sm"
                shape="rounded"
                status={participant?.is_online ? 'online' : null}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs xs:text-sm font-semibold text-brand-text truncate group-hover:text-brand-primary transition-colors">
                {groupTitle}
              </h2>
              {isGroup && (
                <span className="shrink-0 text-[8px] xs:text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand-primary/15 text-brand-primary border border-brand-primary/25">
                  Group
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] xs:text-xs text-brand-muted truncate">
              {!isGroup && (
                <>
                  <span className="truncate">@{participant?.username}</span>
                  <span className="text-brand-subtle">•</span>
                </>
              )}
              <span
                className={`truncate font-medium ${
                  isGroup
                    ? 'text-brand-subtle'
                    : participant?.is_online
                    ? 'text-brand-secondary'
                    : 'text-brand-subtle'
                }`}
              >
                {getStatusText()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-0.5 xs:gap-1 shrink-0">
        {/* Search in chat */}
        <button
          onClick={onToggleSearch}
          className={`p-1.5 xs:p-2 rounded-xl transition-colors ${
            isSearching
              ? 'text-brand-primary bg-brand-primary/10'
              : 'text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          title="Search messages"
          aria-label="Search messages"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Group Call buttons or One-to-One Call buttons */}
        {isGroup ? (
          <>
            <button
              onClick={() => onStartGroupCall?.('audio')}
              className="p-1.5 xs:p-2 rounded-xl text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Start Group Audio Call"
              aria-label="Start Group Audio Call"
            >
              <Phone className="w-4 h-4 text-brand-primary" />
            </button>
            <button
              onClick={() => onStartGroupCall?.('video')}
              className="p-1.5 xs:p-2 rounded-xl text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Start Group Video Call"
              aria-label="Start Group Video Call"
            >
              <Video className="w-4 h-4 text-purple-400" />
            </button>
          </>
        ) : (
          <>
            {/* WebRTC Audio Call */}
            <AudioCallButton
              conversationId={conversationId}
              participant={participant}
            />

            {/* WebRTC Video Call */}
            <VideoCallButton
              conversationId={conversationId}
              participant={participant}
            />
          </>
        )}

        {/* Toggle Info Panel */}
        <button
          onClick={onToggleInfo}
          className={`hidden sm:flex p-1.5 xs:p-2 rounded-xl transition-colors ${
            showInfo
              ? 'text-brand-primary bg-brand-primary/10'
              : 'text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          title={isGroup ? 'Group information' : 'Toggle info panel'}
          aria-label="Toggle info panel"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* More Options Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className="p-1.5 xs:p-2 rounded-xl text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="More options"
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-48 max-w-[calc(100vw-24px)] bg-brand-surface border border-brand-border rounded-xl shadow-elevated py-1 z-30 animate-fade-in"
              onMouseLeave={() => setShowMenu(false)}
            >
              {isGroup ? (
                <>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onToggleInfo?.();
                    }}
                    className="w-full px-3.5 py-2 text-xs text-left text-brand-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors"
                  >
                    <Info className="w-4 h-4 text-brand-subtle" />
                    <span>Group Information</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onLeaveGroup?.();
                    }}
                    className="w-full px-3.5 py-2 text-xs text-left text-brand-muted hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-brand-subtle" />
                    <span>Leave Group</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onViewProfile?.();
                  }}
                  className="w-full px-3.5 py-2 text-xs text-left text-brand-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors"
                >
                  <User className="w-4 h-4 text-brand-subtle" />
                  <span>View Full Profile</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowMenu(false);
                  onClearHistory?.();
                }}
                className="w-full px-3.5 py-2 text-xs text-left text-brand-danger hover:bg-brand-danger/10 flex items-center gap-2.5 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-brand-danger" />
                <span>Clear Chat History</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;


