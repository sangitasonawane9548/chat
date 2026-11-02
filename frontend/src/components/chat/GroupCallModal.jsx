import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Share2,
  Users,
  Volume2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/components/common/ToastProvider';

export const GroupCallModal = ({
  isOpen,
  callData, // { callId, conversationId, groupName, groupImage, callType, initiator }
  onClose
}) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callData?.callType !== 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peerConnections = useRef({}); // userId -> RTCPeerConnection
  const remoteStreams = useRef({}); // userId -> MediaStream
  const [remoteStreamsState, setRemoteStreamsState] = useState({});

  // Duration timer
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Setup media and join call
  useEffect(() => {
    if (!isOpen || !callData?.callId || !socket) return;

    let isMounted = true;

    const startLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callData.callType === 'video'
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.muted = true;
          localVideoRef.current.defaultMuted = true;
          localVideoRef.current.volume = 0;
          localVideoRef.current.srcObject = stream;
        }

        // Join group call via Socket
        socket.emit('group_call:join', { callId: callData.callId }, (res) => {
          if (res?.success && isMounted) {
            setParticipants(res.participants || []);
          } else if (res?.error) {
            notify.error(res.error);
            onClose();
          }
        });
      } catch (err) {
        console.error('[GroupCallModal] Media error:', err);
        // Fallback to audio-only if video fails
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = audioStream;
          setIsVideoOff(true);
          socket.emit('group_call:join', { callId: callData.callId }, (res) => {
            if (res?.success && isMounted) setParticipants(res.participants || []);
          });
        } catch (audioErr) {
          notify.error('Could not access microphone or camera');
          onClose();
        }
      }
    };

    startLocalStream();

    // Socket events
    const handleUserJoined = (data) => {
      if (data.callId === callData.callId) {
        setParticipants((prev) => {
          if (prev.some((p) => p.user_id === data.user.id || p.id === data.user.id)) return prev;
          return [...prev, { ...data.user, user_id: data.user.id }];
        });
        notify.info(`${data.user.full_name || data.user.username} joined the call`);
      }
    };

    const handleUserLeft = (data) => {
      if (data.callId === callData.callId) {
        setParticipants((prev) => prev.filter((p) => (p.user_id || p.id) !== data.userId));
        setRemoteStreamsState((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }
    };

    const handleCallEnded = (data) => {
      if (data.callId === callData.callId) {
        notify.info('Group call ended');
        cleanup();
        onClose();
      }
    };

    socket.on('group_call:user_joined', handleUserJoined);
    socket.on('group_call:user_left', handleUserLeft);
    socket.on('group_call:ended', handleCallEnded);

    return () => {
      isMounted = false;
      cleanup();
      socket.off('group_call:user_joined', handleUserJoined);
      socket.off('group_call:user_left', handleUserLeft);
      socket.off('group_call:ended', handleCallEnded);
    };
  }, [isOpen, callData?.callId, socket]);

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    remoteStreams.current = {};
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleToggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      } else if (isVideoOff) {
        // Upgrade to video
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newVideoTrack);
          if (localVideoRef.current) {
            localVideoRef.current.muted = true;
            localVideoRef.current.defaultMuted = true;
            localVideoRef.current.volume = 0;
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          setIsVideoOff(false);
        } catch (err) {
          notify.error('Could not enable camera');
        }
      }
    }
  };

  const handleLeaveCall = () => {
    if (socket && callData?.callId) {
      socket.emit('group_call:leave', { callId: callData.callId });
    }
    cleanup();
    onClose();
  };

  const handleEndCallForEveryone = () => {
    if (socket && callData?.callId) {
      socket.emit('group_call:end', { callId: callData.callId });
    }
    cleanup();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl h-[85vh] bg-brand-surface border border-brand-border rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* Header Bar */}
        <div className="h-16 px-6 border-b border-brand-border/60 flex items-center justify-between bg-brand-surface/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-text tracking-tight">{callData?.groupName || 'Group Call'}</h3>
              <div className="flex items-center gap-2 text-xs text-brand-muted">
                <span className="w-2 h-2 rounded-full bg-brand-secondary animate-pulse" />
                <span>{formatDuration(callDuration)}</span>
                <span>•</span>
                <span>{participants.length} connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Video / Participants Grid */}
        <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto bg-black/30 items-center justify-center">
          {/* Local User Tile */}
          <div className="relative aspect-video rounded-2xl bg-brand-card border border-brand-border overflow-hidden flex items-center justify-center shadow-lg">
            {!isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Avatar name={user?.full_name} src={user?.profile_picture} size="xl" shape="rounded" />
                <span className="text-xs font-semibold text-white">{user?.full_name || user?.username} (You)</span>
              </div>
            )}

            {/* Local Tile Overlays */}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white flex items-center gap-1.5">
              <span>You</span>
              {isMuted && <MicOff className="w-3 h-3 text-brand-danger" />}
            </div>
          </div>

          {/* Remote Participants Tiles */}
          {participants
            .filter((p) => (p.user_id || p.id) !== user?.id)
            .map((p) => {
              const pId = p.user_id || p.id;
              const hasRemoteStream = Boolean(remoteStreamsState[pId]);

              return (
                <div
                  key={pId}
                  className="relative aspect-video rounded-2xl bg-brand-card border border-brand-border overflow-hidden flex items-center justify-center shadow-lg"
                >
                  {hasRemoteStream ? (
                    <video
                      autoPlay
                      playsInline
                      ref={(el) => {
                        if (el && remoteStreamsState[pId]) {
                          el.srcObject = remoteStreamsState[pId];
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Avatar name={p.full_name} src={p.profile_picture} size="xl" shape="rounded" />
                      <span className="text-xs font-semibold text-white">{p.full_name || `@${p.username}`}</span>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white">
                    <span>{p.full_name?.split(' ')[0] || `@${p.username}`}</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Floating Call Controls Dock */}
        <div className="h-20 border-t border-brand-border/60 bg-brand-surface/80 backdrop-blur-md flex items-center justify-center gap-3 shrink-0">
          {/* Mute Mic */}
          <button
            onClick={handleToggleMute}
            className={`p-3.5 rounded-2xl transition-all shadow-md ${
              isMuted
                ? 'bg-brand-danger text-white'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={handleToggleVideo}
            className={`p-3.5 rounded-2xl transition-all shadow-md ${
              isVideoOff
                ? 'bg-white/10 text-brand-subtle hover:bg-white/15'
                : 'bg-brand-primary text-white shadow-glow-primary'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Leave Call */}
          <button
            onClick={handleLeaveCall}
            className="p-3.5 rounded-2xl bg-brand-danger text-white hover:bg-red-600 transition-all shadow-md flex items-center gap-2 px-5 font-semibold text-xs"
            title="Leave Call"
          >
            <PhoneOff className="w-5 h-5" />
            <span>Leave</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default GroupCallModal;

