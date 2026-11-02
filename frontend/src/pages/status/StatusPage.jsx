import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Camera,
  Type,
  Shield,
  VolumeX,
  Volume2,
  Eye,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Loader2,
  MoreVertical,
  Radio
} from 'lucide-react';
import { formatRelativeTime } from '@/utils/date';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import Avatar from '@/components/ui/Avatar';
import {
  getMyStatusesApi,
  getFeedStatusesApi,
  toggleMuteUserStatusesApi
} from '@/services/api';
import { notify } from '@/components/common/ToastProvider';
import CreateStatusModal from '@/components/status/CreateStatusModal';
import StatusViewer from '@/components/status/StatusViewer';
import StatusPrivacyModal from '@/components/status/StatusPrivacyModal';

export const StatusPage = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [myStatuses, setMyStatuses] = useState([]);
  const [feedGroups, setFeedGroups] = useState({
    recent: [],
    viewed: [],
    muted: []
  });
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Viewer state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [viewerState, setViewerState] = useState({
    isOpen: false,
    usersList: [],
    userIndex: 0,
    statusIndex: 0
  });

  const [isMutedExpanded, setIsMutedExpanded] = useState(false);
  const [isViewedExpanded, setIsViewedExpanded] = useState(true);

  // Fetch status feed & my statuses
  const loadAllStatuses = useCallback(async (showLoadingSpinner = false) => {
    try {
      if (showLoadingSpinner) setIsLoading(true);
      const [myRes, feedRes] = await Promise.all([
        getMyStatusesApi(),
        getFeedStatusesApi()
      ]);

      if (myRes.success) {
        setMyStatuses(myRes.statuses || []);
      }
      if (feedRes.success) {
        setFeedGroups(feedRes.feed || { recent: [], viewed: [], muted: [] });
      }
    } catch (err) {
      console.error('Failed to load statuses:', err);
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllStatuses(true);
  }, [loadAllStatuses]);

  // Real-time synchronization
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeUpdate = () => {
      loadAllStatuses(false);
    };

    socket.on('status:new', handleRealtimeUpdate);
    socket.on('status:deleted', handleRealtimeUpdate);
    socket.on('status:viewed', handleRealtimeUpdate);
    socket.on('status:reaction', handleRealtimeUpdate);
    socket.on('status:privacy_updated', handleRealtimeUpdate);

    return () => {
      socket.off('status:new', handleRealtimeUpdate);
      socket.off('status:deleted', handleRealtimeUpdate);
      socket.off('status:viewed', handleRealtimeUpdate);
      socket.off('status:reaction', handleRealtimeUpdate);
      socket.off('status:privacy_updated', handleRealtimeUpdate);
    };
  }, [socket, loadAllStatuses]);

  // Mute / Unmute user
  const handleToggleMute = async (e, userId) => {
    e.stopPropagation();
    try {
      const res = await toggleMuteUserStatusesApi(userId);
      if (res.success) {
        notify.success(res.message);
        loadAllStatuses(false);
      }
    } catch (err) {
      notify.error('Could not toggle mute status');
    }
  };

  // Open viewer for My Statuses
  const handleOpenMyStatus = () => {
    if (myStatuses.length === 0) {
      setIsCreateModalOpen(true);
      return;
    }

    const myUserData = {
      id: user?.id,
      user_id: user?.id,
      username: user?.username,
      full_name: user?.full_name,
      profile_picture_url: user?.profile_picture_url,
      statuses: myStatuses
    };

    setViewerState({
      isOpen: true,
      usersList: [myUserData],
      userIndex: 0,
      statusIndex: 0
    });
  };

  // Open viewer for a feed contact
  const handleOpenContactStatus = (groupKey, contactIdx) => {
    const list = feedGroups[groupKey] || [];
    if (list.length === 0) return;

    // Filter to find first unviewed status for this contact
    const contact = list[contactIdx];
    let firstUnviewedIdx = 0;
    if (contact && contact.statuses) {
      const foundIdx = contact.statuses.findIndex((s) => !s.viewed_by_me);
      if (foundIdx !== -1) firstUnviewedIdx = foundIdx;
    }

    setViewerState({
      isOpen: true,
      usersList: list,
      userIndex: contactIdx,
      statusIndex: firstUnviewedIdx
    });
  };

  const totalMyViews = myStatuses.reduce((acc, st) => acc + (st.view_count || 0), 0);

  const formatTime = (timeStr) => {
    return formatRelativeTime(timeStr);
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] bg-brand-bg overflow-hidden select-none transition-colors duration-200">
      {/* Left Column / Feed List */}
      <div className="w-full md:w-[420px] lg:w-[460px] h-full flex flex-col border-r border-brand-border bg-brand-sidebar transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between bg-brand-surface transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600/20 to-purple-600/20 flex items-center justify-center border border-violet-500/30">
              <CircleDashed className="w-5 h-5 text-violet-500 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display text-brand-text tracking-tight">Status</h1>
              <p className="text-xs text-brand-muted">Ephemeral 24-hour stories</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Privacy */}
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              title="Status Privacy"
              className="p-2 rounded-xl bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-brand-text border border-brand-border transition-all hover:scale-105"
            >
              <Shield className="w-4 h-4" />
            </button>

            {/* Create Status Button */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              title="Add Status"
              className="p-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold shadow-md shadow-violet-500/25 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>

        {/* Scrollable Status Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* My Status Card */}
          <div
            onClick={handleOpenMyStatus}
            className="group relative flex items-center justify-between p-3.5 rounded-2xl bg-brand-surface border border-brand-border hover:border-brand-primary/50 cursor-pointer transition-all hover:bg-brand-card"
          >
            <div className="flex items-center gap-3.5">
              <div className="relative">
                {/* Status Avatar Ring */}
                <div
                  className={`p-0.5 rounded-full ${
                    myStatuses.length > 0
                      ? 'bg-gradient-to-tr from-violet-500 to-purple-500 shadow-glow-primary'
                      : 'border-2 border-dashed border-brand-border'
                  }`}
                >
                  <Avatar
                    src={user?.profile_picture_url}
                    name={user?.full_name || user?.username}
                    size="md"
                    className="border-2 border-brand-surface"
                  />
                </div>
                {myStatuses.length === 0 && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-xs shadow-md">
                    +
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-brand-text group-hover:text-brand-primary transition-colors">
                  My Status
                </h3>
                <p className="text-xs text-brand-muted mt-0.5">
                  {myStatuses.length > 0
                    ? `${myStatuses.length} active ${myStatuses.length === 1 ? 'story' : 'stories'} • Tap to view`
                    : 'Tap to add status update'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {myStatuses.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-card border border-brand-border text-xs font-semibold text-brand-text">
                  <Eye className="w-3.5 h-3.5 text-brand-primary" />
                  <span>{totalMyViews}</span>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreateModalOpen(true);
                }}
                title="Add new update"
                className="p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-brand-muted space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <p className="text-xs font-medium">Loading status updates...</p>
            </div>
          ) : (
            <>
              {/* Recent Updates (Unseen) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs uppercase font-bold tracking-wider text-brand-muted">
                    Recent Updates
                  </span>
                  <span className="text-xs text-brand-primary font-semibold">
                    {feedGroups.recent.length}
                  </span>
                </div>

                {feedGroups.recent.length === 0 ? (
                  <div className="py-6 px-4 rounded-xl bg-brand-card/50 border border-brand-border/60 text-center">
                    <Clock className="w-6 h-6 text-brand-subtle mx-auto mb-1.5" />
                    <p className="text-xs text-brand-muted">No new recent updates</p>
                    <p className="text-[11px] text-brand-subtle mt-0.5">
                      Updates from your mutual contacts will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {feedGroups.recent.map((contact, idx) => (
                      <div
                        key={contact.id}
                        onClick={() => handleOpenContactStatus('recent', idx)}
                        className="group flex items-center justify-between p-3 rounded-xl hover:bg-brand-card border border-transparent hover:border-brand-border cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3.5">
                          {/* Segmented / Violet Ring Avatar */}
                          <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 via-purple-500 to-pink-500 shadow-glow-primary">
                            <Avatar
                              src={contact.profile_picture_url}
                              name={contact.full_name || contact.username}
                              size="md"
                              className="border-2 border-brand-surface"
                            />
                          </div>

                          <div>
                            <p className="text-sm font-bold text-brand-text group-hover:text-brand-primary transition-colors leading-tight">
                              {contact.full_name || contact.username}
                            </p>
                            <p className="text-xs text-brand-muted mt-0.5">
                              {contact.latest_status_at ? formatTime(contact.latest_status_at) : ''} • {contact.status_count} {contact.status_count === 1 ? 'update' : 'updates'}
                            </p>
                          </div>
                        </div>

                        {/* Mute Action */}
                        <button
                          onClick={(e) => handleToggleMute(e, contact.id)}
                          title="Mute status updates"
                          className="p-1.5 rounded-lg text-brand-subtle hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <VolumeX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Viewed Updates */}
              {feedGroups.viewed.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-brand-border">
                  <button
                    onClick={() => setIsViewedExpanded((prev) => !prev)}
                    className="flex items-center justify-between w-full px-1 py-1 text-xs uppercase font-bold tracking-wider text-brand-muted hover:text-brand-text transition-colors"
                  >
                    <span>Viewed Updates ({feedGroups.viewed.length})</span>
                    {isViewedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isViewedExpanded && (
                    <div className="space-y-1.5">
                      {feedGroups.viewed.map((contact, idx) => (
                        <div
                          key={contact.id}
                          onClick={() => handleOpenContactStatus('viewed', idx)}
                          className="group flex items-center justify-between p-3 rounded-xl hover:bg-brand-card border border-transparent hover:border-brand-border cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Gray Ring Avatar */}
                            <div className="p-0.5 rounded-full border-2 border-brand-border">
                              <Avatar
                                src={contact.profile_picture_url}
                                name={contact.full_name || contact.username}
                                size="md"
                                className="border border-brand-surface"
                              />
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-brand-text group-hover:text-brand-primary transition-colors leading-tight">
                                {contact.full_name || contact.username}
                              </p>
                              <p className="text-xs text-brand-subtle mt-0.5">
                                {contact.latest_status_at ? formatTime(contact.latest_status_at) : ''}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleToggleMute(e, contact.id)}
                            title="Mute status updates"
                            className="p-1.5 rounded-lg text-brand-subtle hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <VolumeX className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Muted Updates */}
              {feedGroups.muted.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-brand-border">
                  <button
                    onClick={() => setIsMutedExpanded((prev) => !prev)}
                    className="flex items-center justify-between w-full px-1 py-1 text-xs uppercase font-bold tracking-wider text-brand-muted hover:text-brand-text transition-colors"
                  >
                    <span>Muted Updates ({feedGroups.muted.length})</span>
                    {isMutedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isMutedExpanded && (
                    <div className="space-y-1.5">
                      {feedGroups.muted.map((contact, idx) => (
                        <div
                          key={contact.id}
                          onClick={() => handleOpenContactStatus('muted', idx)}
                          className="group flex items-center justify-between p-3 rounded-xl hover:bg-brand-card border border-transparent hover:border-brand-border cursor-pointer transition-all opacity-60 hover:opacity-100"
                        >
                          <div className="flex items-center gap-3.5">
                            <Avatar
                              src={contact.profile_picture_url}
                              name={contact.full_name || contact.username}
                              size="md"
                              className="border border-brand-border"
                            />
                            <div>
                              <p className="text-sm font-semibold text-brand-text group-hover:text-brand-primary transition-colors leading-tight">
                                {contact.full_name || contact.username}
                              </p>
                              <p className="text-xs text-brand-subtle mt-0.5">Muted updates</p>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleToggleMute(e, contact.id)}
                            title="Unmute status updates"
                            className="p-1.5 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-black/5 dark:hover:bg-white/5 transition-all flex items-center gap-1 text-xs"
                          >
                            <Volume2 className="w-4 h-4" />
                            <span className="text-[11px]">Unmute</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Column: Hero / Story Canvas Placeholder */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-brand-bg text-center relative overflow-hidden transition-colors duration-200">
        {/* Subtle Ambient Glow */}
        <div className="absolute w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-brand-primary/10 to-brand-secondary/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-md flex flex-col items-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-brand-surface border border-brand-border flex items-center justify-center shadow-2xl">
            <CircleDashed className="w-10 h-10 text-brand-primary animate-spin-slow" />
          </div>

          <h2 className="text-2xl font-extrabold text-brand-text tracking-tight">
            Status Stories
          </h2>

          <p className="text-sm text-brand-muted leading-relaxed">
            Share moments, photos, videos, and texts with your contacts. Status updates automatically expire after 24 hours.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-violet-500/25 flex items-center gap-2 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Status Update</span>
            </button>
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-brand-surface border border-brand-border hover:bg-brand-card text-brand-muted hover:text-brand-text text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <Shield className="w-4 h-4 text-brand-primary" />
              <span>Privacy Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Create Status Modal */}
      <CreateStatusModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => loadAllStatuses(false)}
      />

      {/* Privacy Settings Modal */}
      <StatusPrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        onUpdated={() => loadAllStatuses(false)}
      />

      {/* Full-Screen Status Viewer */}
      {viewerState.isOpen && (
        <StatusViewer
          usersWithStatuses={viewerState.usersList}
          initialUserIndex={viewerState.userIndex}
          initialStatusIndex={viewerState.statusIndex}
          currentUserId={user?.id}
          onClose={() => setViewerState((prev) => ({ ...prev, isOpen: false }))}
          onStatusDeleted={() => loadAllStatuses(false)}
        />
      )}
    </div>
  );
};

export default StatusPage;
