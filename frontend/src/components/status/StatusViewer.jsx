import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Eye,
  Trash2,
  Send,
  Loader2,
  Smile,
  Users
} from 'lucide-react';
import { formatRelativeTime } from '@/utils/date';
import { getApiBaseUrl } from '@/utils/apiUrl';
import Avatar from '@/components/ui/Avatar';
import {
  recordStatusViewApi,
  getStatusViewersApi,
  toggleStatusReactionApi,
  replyToStatusApi,
  deleteStatusApi
} from '@/services/api';
import { notify } from '@/components/common/ToastProvider';

const EMOJI_REACTIONS = ['❤️', '😂', '😍', '😮', '👍', '😢', '🔥'];
const DEFAULT_SLIDE_DURATION = 5000; // 5 seconds for text and images

export const StatusViewer = ({
  usersWithStatuses = [],
  initialUserIndex = 0,
  initialStatusIndex = 0,
  currentUserId,
  onClose,
  onStatusDeleted
}) => {
  const [currentUserIdx, setCurrentUserIdx] = useState(initialUserIndex);
  const [currentStatusIdx, setCurrentStatusIdx] = useState(initialStatusIndex);

  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isMuted, setIsMuted] = useState(false);

  // Reaction & Reply state
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [userReactions, setUserReactions] = useState([]);
  const [isReacting, setIsReacting] = useState(false);

  // Viewers sheet (for own statuses)
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const [viewersList, setViewersList] = useState([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const holdStartRef = useRef(null);

  const currentUserData = usersWithStatuses[currentUserIdx] || null;
  const currentStatusList = currentUserData?.statuses || [];
  const activeStatus = currentStatusList[currentStatusIdx] || null;

  const isOwnStatus = currentUserData && (
    currentUserData.id === currentUserId ||
    currentUserData.user_id === currentUserId ||
    activeStatus?.user_id === currentUserId
  );

  // Record view when status changes
  useEffect(() => {
    if (!activeStatus || isOwnStatus) return;

    recordStatusViewApi(activeStatus.id).catch((err) => {
      // Ignore background view record error
    });
  }, [activeStatus?.id, isOwnStatus]);

  // Load viewers if viewing own status and drawer opened
  const loadViewers = useCallback(async () => {
    if (!activeStatus || !isOwnStatus) return;
    try {
      setLoadingViewers(true);
      const res = await getStatusViewersApi(activeStatus.id);
      if (res.success) {
        setViewersList(res.viewers || []);
      }
    } catch (err) {
      notify.error('Could not load viewers');
    } finally {
      setLoadingViewers(false);
    }
  }, [activeStatus?.id, isOwnStatus]);

  useEffect(() => {
    if (showViewersSheet) {
      loadViewers();
    }
  }, [showViewersSheet, loadViewers]);

  // Handle Next status or Next user
  const handleNext = useCallback(() => {
    if (currentStatusIdx < currentStatusList.length - 1) {
      setCurrentStatusIdx((prev) => prev + 1);
      setProgress(0);
    } else if (currentUserIdx < usersWithStatuses.length - 1) {
      // Advance to next user
      setCurrentUserIdx((prev) => prev + 1);
      setCurrentStatusIdx(0);
      setProgress(0);
    } else {
      // End of all stories
      onClose();
    }
  }, [currentStatusIdx, currentStatusList.length, currentUserIdx, usersWithStatuses.length, onClose]);

  // Handle Prev status or Prev user
  const handlePrev = useCallback(() => {
    if (currentStatusIdx > 0) {
      setCurrentStatusIdx((prev) => prev - 1);
      setProgress(0);
    } else if (currentUserIdx > 0) {
      const prevUserIdx = currentUserIdx - 1;
      const prevUserStatuses = usersWithStatuses[prevUserIdx]?.statuses || [];
      setCurrentUserIdx(prevUserIdx);
      setCurrentStatusIdx(Math.max(0, prevUserStatuses.length - 1));
      setProgress(0);
    }
  }, [currentStatusIdx, currentUserIdx, usersWithStatuses]);

  // Timer progression for stories
  useEffect(() => {
    if (!activeStatus || isPaused || showViewersSheet) return;

    const intervalTime = 50; // update progress every 50ms
    let totalDuration = DEFAULT_SLIDE_DURATION;

    if (activeStatus.status_type === 'video' && videoRef.current?.duration) {
      totalDuration = videoRef.current.duration * 1000;
    }

    const stepIncrement = (intervalTime / totalDuration) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timerRef.current);
          handleNext();
          return 0;
        }
        return prev + stepIncrement;
      });
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeStatus, isPaused, showViewersSheet, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  // Press & hold to pause
  const handleHoldStart = () => {
    holdStartRef.current = Date.now();
    setIsPaused(true);
    if (videoRef.current) videoRef.current.pause();
  };

  const handleHoldEnd = () => {
    setIsPaused(false);
    if (videoRef.current) videoRef.current.play();
  };

  // Reactions
  const handleSendReaction = async (emoji) => {
    if (!activeStatus || isReacting) return;
    try {
      setIsReacting(true);
      const res = await toggleStatusReactionApi(activeStatus.id, emoji);
      if (res.success) {
        if (res.action === 'added') {
          notify.success(`Reacted with ${emoji}`);
        } else {
          notify.info(`Removed reaction ${emoji}`);
        }
      }
    } catch (err) {
      notify.error(err.message || 'Failed to send reaction');
    } finally {
      setIsReacting(false);
    }
  };

  // Status Reply
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeStatus || isSendingReply) return;

    try {
      setIsSendingReply(true);
      const res = await replyToStatusApi(activeStatus.id, replyText.trim());
      if (res.success) {
        notify.success('Reply sent!');
        setReplyText('');
      } else {
        notify.error(res.message || 'Failed to send reply');
      }
    } catch (err) {
      notify.error(err.message || 'Error sending reply');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Status Delete (Own status)
  const handleDeleteStatus = async () => {
    if (!activeStatus || !isOwnStatus) return;
    if (!window.confirm('Are you sure you want to delete this status update?')) return;

    try {
      const res = await deleteStatusApi(activeStatus.id);
      if (res.success) {
        notify.success('Status deleted');
        if (onStatusDeleted) onStatusDeleted(activeStatus.id);
        if (currentStatusList.length <= 1) {
          onClose();
        } else {
          handleNext();
        }
      }
    } catch (err) {
      notify.error(err.message || 'Could not delete status');
    }
  };

  if (!currentUserData || !activeStatus) return null;

  const API_URL = getApiBaseUrl();
  const mediaUrl = activeStatus.media_url ? (activeStatus.media_url.startsWith('http') ? activeStatus.media_url : `${API_URL}${activeStatus.media_url}`) : null;

  const formatStatusTime = (dateStr) => {
    return formatRelativeTime(dateStr);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0D12] flex items-center justify-center select-none overflow-hidden">
      {/* Top Controls Overlay */}
      <div className="absolute top-0 inset-x-0 z-30 p-3 sm:p-4 pt-safe bg-gradient-to-b from-black/85 via-black/40 to-transparent flex flex-col gap-3">
        {/* Progress Bar Segments */}
        <div className="flex items-center gap-1.5 w-full max-w-2xl mx-auto">
          {currentStatusList.map((st, idx) => {
            let widthPercent = 0;
            if (idx < currentStatusIdx) widthPercent = 100;
            else if (idx === currentStatusIdx) widthPercent = progress;
            else widthPercent = 0;

            return (
              <div
                key={st.id || idx}
                className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Header: User Info & Controls */}
        <div className="flex items-center justify-between w-full max-w-2xl mx-auto pt-1">
          <div className="flex items-center gap-3">
            <Avatar
              src={currentUserData.profile_picture_url || currentUserData.avatar_url}
              name={currentUserData.full_name || currentUserData.username}
              size="md"
              className="border-2 border-white/40"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  {currentUserData.full_name || currentUserData.username}
                </span>
                <span className="text-xs text-gray-400">@{currentUserData.username}</span>
              </div>
              <span className="text-xs text-gray-400">
                {formatStatusTime(activeStatus.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeStatus.status_type === 'video' && (
              <button
                onClick={() => setIsMuted((prev) => !prev)}
                className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}

            <button
              onClick={() => setIsPaused((prev) => !prev)}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>

            {isOwnStatus && (
              <button
                onClick={handleDeleteStatus}
                title="Delete Status"
                className="p-2 rounded-full bg-red-600/30 text-red-400 hover:bg-red-600/60 backdrop-blur-md transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Chevrons */}
      <button
        onClick={handlePrev}
        className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-md items-center justify-center transition-all hover:scale-110"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={handleNext}
        className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-md items-center justify-center transition-all hover:scale-110"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Main Content Area */}
      <div
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
        className="relative w-full max-w-2xl h-full flex flex-col justify-center items-center select-none"
      >
        {/* Invisible tap areas for left / right navigation on mobile */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute left-0 inset-y-0 w-1/3 z-10 cursor-pointer"
        />
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-0 inset-y-0 w-1/3 z-10 cursor-pointer"
        />

        {/* Status Render */}
        {activeStatus.status_type === 'text' && (
          <div
            style={{
              backgroundColor: activeStatus.background_color || '#0B0D12',
              color: activeStatus.text_color || '#FFFFFF',
              textAlign: activeStatus.text_alignment || 'center',
            }}
            className="w-full h-full flex items-center justify-center p-8 transition-colors duration-300"
          >
            <p
              className={`max-w-xl whitespace-pre-wrap break-words leading-relaxed ${
                activeStatus.font_size === 'small'
                  ? 'text-xl'
                  : activeStatus.font_size === 'large'
                  ? 'text-4xl font-extrabold'
                  : 'text-2xl font-bold'
              }`}
            >
              {activeStatus.text_content}
            </p>
          </div>
        )}

        {activeStatus.status_type === 'image' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={mediaUrl}
              alt="Status"
              className="max-h-full max-w-full object-contain"
            />
            {activeStatus.caption && (
              <div className="absolute bottom-24 inset-x-4 max-w-xl mx-auto p-3.5 bg-black/60 backdrop-blur-md rounded-2xl text-center text-white text-sm font-medium shadow-xl border border-white/10">
                {activeStatus.caption}
              </div>
            )}
          </div>
        )}

        {activeStatus.status_type === 'video' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              playsInline
              muted={isMuted}
              className="max-h-full max-w-full object-contain"
            />
            {activeStatus.caption && (
              <div className="absolute bottom-24 inset-x-4 max-w-xl mx-auto p-3.5 bg-black/60 backdrop-blur-md rounded-2xl text-center text-white text-sm font-medium shadow-xl border border-white/10">
                {activeStatus.caption}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer Overlay */}
      <div className="absolute bottom-0 inset-x-0 z-30 p-3 sm:p-4 pb-safe bg-gradient-to-t from-black/95 via-black/60 to-transparent">
        <div className="w-full max-w-2xl mx-auto">
          {isOwnStatus ? (
            /* Own Status: Seen Count & Viewers Trigger */
            <div className="flex flex-col items-center justify-center">
              <button
                onClick={() => setShowViewersSheet(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md text-sm font-semibold transition-all hover:scale-105 border border-white/10"
              >
                <Eye className="w-4 h-4 text-brand-primary" />
                <span>Seen by {activeStatus.view_count || viewersList.length || 0}</span>
              </button>
            </div>
          ) : (
            /* Other's Status: Emoji Reactions & Reply Input */
            <div className="space-y-3">
              {/* Quick Emojis */}
              <div className="flex items-center justify-center gap-3">
                {EMOJI_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendReaction(emoji)}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-xl backdrop-blur-md transition-all hover:scale-125 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Reply Form */}
              <form
                onSubmit={handleSendReply}
                className="flex items-center gap-2 max-w-lg mx-auto"
                onFocus={() => setIsPaused(true)}
                onBlur={() => setIsPaused(false)}
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to @${currentUserData.username}...`}
                  className="flex-1 bg-white/10 border border-white/20 rounded-full px-5 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-brand-primary backdrop-blur-md text-sm transition-all"
                />
                <button
                  type="submit"
                  disabled={isSendingReply || !replyText.trim()}
                  className="p-2.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 font-bold transition-all disabled:opacity-50 disabled:scale-100 hover:scale-105 active:scale-95 shadow-md shadow-violet-500/25"
                >
                  {isSendingReply ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Viewers Drawer / Sheet (Owner Only) */}
      {showViewersSheet && (
        <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex flex-col justify-end">
          <div className="w-full max-w-lg mx-auto bg-brand-surface border-t border-brand-border rounded-t-3xl max-h-[70vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp">
            {/* Sheet Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-surface">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-primary" />
                <h3 className="font-bold text-brand-text text-base">
                  Viewers ({viewersList.length})
                </h3>
              </div>
              <button
                onClick={() => setShowViewersSheet(false)}
                className="p-1 rounded-lg text-brand-muted hover:text-brand-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewers List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-brand-border/40">
              {loadingViewers ? (
                <div className="py-12 flex flex-col items-center justify-center text-brand-muted">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary mb-2" />
                  <span className="text-xs">Loading viewers...</span>
                </div>
              ) : viewersList.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Eye className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No views yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    When contacts view your status, they will appear here.
                  </p>
                </div>
              ) : (
                viewersList.map((vw) => (
                  <div key={vw.viewer_id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={vw.profile_picture_url}
                        name={vw.full_name || vw.username}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-bold text-white leading-tight">
                          {vw.full_name || vw.username}
                        </p>
                        <p className="text-xs text-gray-400">@{vw.username}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {vw.viewed_at ? formatRelativeTime(vw.viewed_at) : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusViewer;
