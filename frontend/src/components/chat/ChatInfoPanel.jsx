import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  User,
  Shield,
  Trash2,
  Calendar,
  Lock,
  ExternalLink,
  Info
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { formatConversationTime } from '@/utils/date';

export const ChatInfoPanel = ({
  participant,
  onClose,
  onClearHistory
}) => {
  const navigate = useNavigate();

  if (!participant) return null;

  return (
    <>
      {/* Mobile/Tablet Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 xl:hidden"
        onClick={onClose}
      />

      <div className="fixed xl:static inset-y-0 right-0 z-50 xl:z-20 w-full sm:w-80 h-full bg-brand-surface border-l border-brand-border flex flex-col shrink-0 overflow-y-auto select-none shadow-2xl xl:shadow-none animate-slide-left transition-colors duration-200">
        {/* Header */}
      <div className="h-16 px-4 border-b border-brand-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-text">Contact Info</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Profile Overview */}
      <div className="p-6 flex flex-col items-center text-center border-b border-brand-border/60">
        <div className="relative mb-3">
          <Avatar
            name={participant.full_name}
            src={participant.profile_picture}
            size="2xl"
            shape="rounded"
            status={participant.is_online ? 'online' : null}
          />
        </div>
        <h2 className="text-base font-bold text-brand-text mb-0.5">
          {participant.full_name}
        </h2>
        <p className="text-xs text-brand-primary font-medium mb-3">
          @{participant.username}
        </p>

        {participant.bio && (
          <p className="text-xs text-brand-muted leading-relaxed max-w-xs mb-4">
            {participant.bio}
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/profile/${participant.username}`)}
          leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
          className="w-full text-xs"
        >
          View Full Profile
        </Button>
      </div>

      {/* Contact Details & Security */}
      <div className="p-4 space-y-4 flex-1">
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-subtle">
            Chat Details
          </span>

          <div className="p-3 rounded-xl bg-brand-card border border-brand-border/50 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-brand-subtle">Status</span>
              <span className={`font-medium ${participant.is_online ? 'text-brand-secondary' : 'text-brand-muted'}`}>
                {participant.is_online ? 'Online now' : 'Offline'}
              </span>
            </div>

            {participant.show_online_status && participant.last_seen && (
              <div className="flex items-center justify-between">
                <span className="text-brand-subtle">Last active</span>
                <span className="text-brand-muted">
                  {formatConversationTime(participant.last_seen)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-brand-subtle">Encryption</span>
              <span className="text-brand-secondary font-medium flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Security & Actions */}
        <div className="space-y-2 pt-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-subtle">
            Manage Conversation
          </span>

          <button
            onClick={onClearHistory}
            className="w-full p-3 rounded-xl bg-brand-danger/10 border border-brand-danger/20 hover:bg-brand-danger/20 text-brand-danger text-xs font-medium flex items-center gap-2.5 transition-colors text-left"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <div>
              <p>Clear Chat History</p>
              <p className="text-[10px] text-brand-danger/70 mt-0.5">
                Clears previous messages on your device
              </p>
            </div>
          </button>
        </div>
        </div>
      </div>
    </>
  );
};

export default ChatInfoPanel;

