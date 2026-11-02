import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Maximize,
  Minimize,
  Minimize2,
  Maximize2,
  Volume2,
  RefreshCw,
  Shield,
  Wifi,
  ChevronDown,
  Layers,
  Sparkles
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

export const VideoCallScreen = ({
  call,
  duration,
  formatDuration,
  isMuted,
  isPeerMuted,
  isCameraOff,
  isPeerCameraOff,
  isScreenSharing,
  isPeerScreenSharing,
  localStream,
  remoteStream,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onSwitchCamera,
  availableCameras = [],
  selectedCamera,
  onEndCall,
  isMinimized,
  onToggleMinimize,
  audioOutputs = [],
  selectedAudioOutput,
  onSelectAudioOutput,
  connectionQuality = 'good',
  onTogglePictureInPicture,
  onToggleFullscreen,
  isAudioAutoplayBlocked = false,
  onUnblockAudio
}) => {
  const containerRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [showOutputMenu, setShowOutputMenu] = useState(false);
  const hideControlsTimerRef = useRef(null);

  const otherUser = call?.otherUser || (call?.isCaller ? call?.receiver : call?.caller) || {};

  // Bind remote stream to remote video element (strictly muted: audio output is handled solely by CallContext's audio element)
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
      el.volume = 0;
      if (remoteStream) {
        if (el.srcObject !== remoteStream) {
          el.srcObject = remoteStream;
        }
        el.play().catch((err) => {
          console.warn('[VideoCallScreen] Remote video autoplay error:', err);
        });
      } else {
        el.srcObject = null;
      }
    }
  }, [remoteStream, isMinimized]);

  // Bind local stream to local preview video element (strictly muted to prevent microphone feedback loop)
  useEffect(() => {
    const el = localVideoRef.current;
    if (el) {
      el.muted = true;
      el.defaultMuted = true;
      el.volume = 0;
      if (localStream) {
        if (el.srcObject !== localStream) {
          el.srcObject = localStream;
        }
        el.play().catch((err) => {
          console.warn('[VideoCallScreen] Local video autoplay error:', err);
        });
      } else {
        el.srcObject = null;
      }
    }
  }, [localStream, isMinimized, isCameraOff, isScreenSharing]);

  // Clean up media element sources on component unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      if (remoteVideoRef.current) {
        try {
          remoteVideoRef.current.pause();
          remoteVideoRef.current.srcObject = null;
        } catch (_) {}
      }
      if (localVideoRef.current) {
        try {
          localVideoRef.current.pause();
          localVideoRef.current.srcObject = null;
        } catch (_) {}
      }
    };
  }, []);

  // Handle Fullscreen Toggle
  const handleFullscreenToggle = async () => {
    if (containerRef.current) {
      const active = await onToggleFullscreen(containerRef.current);
      setIsFullscreen(Boolean(active));
    }
  };

  // Handle PiP Toggle
  const handlePiPToggle = async () => {
    if (remoteVideoRef.current) {
      await onTogglePictureInPicture(remoteVideoRef.current);
    }
  };

  // ---------------------------------------------------------------------------
  // MINIMIZED PICTURE-IN-PICTURE FLOATING WIDGET
  // ---------------------------------------------------------------------------
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        className="fixed bottom-6 right-6 z-50 w-72 h-44 bg-brand-surface border border-brand-primary/40 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-2xl flex flex-col justify-between"
      >
        {/* Background Mini Video / Camera Off Preview */}
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          {remoteStream && !isPeerCameraOff ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center">
              <Avatar
                name={otherUser.full_name}
                src={otherUser.profile_picture}
                size="md"
                shape="rounded"
              />
              <span className="text-[11px] font-medium text-brand-muted truncate max-w-[140px]">
                {otherUser.full_name || 'Participant'}
              </span>
            </div>
          )}
        </div>

        {/* Top Mini Bar */}
        <div className="relative z-10 flex items-center justify-between p-2.5 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-emerald-400 font-mono font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{formatDuration(duration)}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onToggleMinimize}
              className="p-1.5 rounded-full bg-black/60 hover:bg-white/10 text-white backdrop-blur-md transition-colors"
              title="Expand Video"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              onClick={onEndCall}
              className="p-1.5 rounded-full bg-brand-danger hover:bg-red-600 text-white shadow-sm transition-colors"
              title="End Call"
            >
              <PhoneOff className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Bottom Mini Controls */}
        <div className="relative z-10 flex items-center justify-center gap-2 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-xl backdrop-blur-md text-xs transition-colors ${
              isMuted
                ? 'bg-amber-500/80 text-white'
                : 'bg-black/60 text-white hover:bg-white/20'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onToggleCamera}
            className={`p-2 rounded-xl backdrop-blur-md text-xs transition-colors ${
              isCameraOff
                ? 'bg-amber-500/80 text-white'
                : 'bg-black/60 text-white hover:bg-white/20'
            }`}
            title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCameraOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
          </button>
        </div>
      </motion.div>
    );
  }

  // ---------------------------------------------------------------------------
  // FULL ACTIVE VIDEO CALL INTERFACE
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
      className="fixed inset-0 z-50 bg-brand-bg flex flex-col items-center justify-between overflow-hidden select-none animate-fade-in"
    >
      {/* =====================================================================
          1. MAIN REMOTE PARTICIPANT VIDEO AREA
      ====================================================================== */}
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {/* Remote Live Video (visual stream only - audio handled exclusively by CallContext to prevent echo) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover sm:object-contain transition-opacity duration-300 ${
            isPeerCameraOff ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {/* Autoplay blocked notification banner */}
        {isAudioAutoplayBlocked && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onUnblockAudio}
            className="absolute top-24 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium text-xs shadow-2xl backdrop-blur-md border border-white/20 transition-all cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-white animate-pulse" />
            <span>Audio paused by browser • Tap to enable sound</span>
          </motion.button>
        )}

        {/* Remote Camera-Off Placeholder */}
        {isPeerCameraOff && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-brand-surface to-brand-bg">
            <div className="relative my-4 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 w-36 h-36 -m-3 rounded-full bg-brand-primary/20"
              />
              <Avatar
                name={otherUser.full_name}
                src={otherUser.profile_picture}
                size="2xl"
                shape="rounded"
                className="ring-4 ring-brand-surface shadow-2xl"
              />
            </div>
            <h3 className="text-xl font-bold text-white mt-2">
              {otherUser.full_name || 'Participant'}
            </h3>
            <p className="text-xs text-brand-primary font-medium mt-0.5">
              @{otherUser.username}
            </p>
            <div className="mt-4 px-3 py-1 rounded-full bg-white/5 border border-brand-border/60 text-xs text-brand-muted flex items-center gap-1.5">
              <VideoOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Camera is turned off</span>
            </div>
          </div>
        )}

        {/* Remote Screen Share Active Banner */}
        {isPeerScreenSharing && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-primary/90 text-white text-xs font-semibold shadow-lg backdrop-blur-md">
            <Monitor className="w-3.5 h-3.5 animate-pulse" />
            <span>{otherUser.full_name || 'Participant'} is sharing their screen</span>
          </div>
        )}

        {/* Peer Muted Microphone Warning Overlay */}
        {isPeerMuted && (
          <div className="absolute bottom-24 sm:bottom-28 left-6 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium backdrop-blur-md">
            <MicOff className="w-3.5 h-3.5 text-amber-400" />
            <span>Participant muted their microphone</span>
          </div>
        )}

        {/* ===================================================================
            2. FLOATING LOCAL CAMERA PREVIEW WINDOW
        ==================================================================== */}
        <motion.div
          drag
          dragConstraints={containerRef}
          dragElastic={0.1}
          className="absolute top-20 sm:top-24 right-4 sm:right-6 z-30 w-32 sm:w-48 h-44 sm:h-64 rounded-2xl sm:rounded-3xl bg-brand-surface border-2 border-brand-border/80 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing backdrop-blur-md group"
        >
          {/* Local Camera Stream */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform -scale-x-100 ${
              isCameraOff ? 'hidden' : 'block'
            }`}
          />

          {/* Local Camera Off Placeholder */}
          {isCameraOff && (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-brand-surface/95 text-brand-muted">
              <VideoOff className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 mb-1.5" />
              <span className="text-[11px] font-medium text-white">Your Camera Off</span>
            </div>
          )}

          {/* Local Screen Sharing Banner */}
          {isScreenSharing && (
            <div className="absolute inset-0 bg-brand-primary/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center text-white">
              <Monitor className="w-6 h-6 mb-1 text-white animate-pulse" />
              <span className="text-[10px] sm:text-xs font-bold">You are sharing your screen</span>
            </div>
          )}

          {/* Local Floating Badge */}
          <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-medium text-white flex items-center gap-1 pointer-events-none">
            <span>You</span>
            {isMuted && <MicOff className="w-2.5 h-2.5 text-amber-400" />}
          </div>
        </motion.div>
      </div>

      {/* =====================================================================
          3. TOP PARTICIPANT HEADER OVERLAY (Auto-fading)
      ====================================================================== */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 inset-x-0 z-40 p-4 sm:p-6 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between"
          >
            {/* Identity & Status */}
            <div className="flex items-center gap-3">
              <Avatar
                name={otherUser.full_name}
                src={otherUser.profile_picture}
                size="md"
                shape="rounded"
                className="ring-2 ring-white/10"
              />
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                  {otherUser.full_name || 'Contact'}
                </h2>
                <div className="flex items-center gap-2 text-xs text-brand-muted">
                  <span className="text-brand-primary">@{otherUser.username}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1 font-mono text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{formatDuration(duration)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality & Fullscreen Controls */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs text-white">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionQuality === 'good'
                      ? 'bg-emerald-400'
                      : connectionQuality === 'fair'
                      ? 'bg-amber-400'
                      : 'bg-red-400'
                  }`}
                />
                <span className="text-[11px] font-medium">
                  {connectionQuality === 'good' ? 'HD Video' : 'Connecting'}
                </span>
                <Wifi className="w-3 h-3 text-brand-subtle ml-0.5" />
              </div>

              {/* Minimize to PIP widget */}
              <button
                onClick={onToggleMinimize}
                className="p-2 sm:p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
                title="Minimize Call"
              >
                <Minimize2 className="w-4 h-4" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={handleFullscreenToggle}
                className="p-2 sm:p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          4. BOTTOM CALL CONTROLS DOCK (Glassmorphic)
      ====================================================================== */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-0 inset-x-0 z-40 p-3 sm:p-6 pb-safe bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center gap-2 sm:gap-3"
          >
            <div className="flex items-center gap-1.5 xs:gap-2.5 sm:gap-4 px-2.5 xs:px-4 sm:px-6 py-2 sm:py-3 rounded-3xl bg-brand-surface/90 border border-brand-border shadow-elevated backdrop-blur-2xl max-w-[calc(100vw-1rem)]">
              {/* 1. Microphone Toggle */}
              <button
                onClick={onToggleMute}
                className={`p-2.5 xs:p-3 sm:p-3.5 rounded-2xl transition-all transform hover:scale-105 active:scale-95 ${
                  isMuted
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              {/* 2. Camera Toggle */}
              <button
                onClick={onToggleCamera}
                className={`p-2.5 xs:p-3 sm:p-3.5 rounded-2xl transition-all transform hover:scale-105 active:scale-95 ${
                  isCameraOff
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isCameraOff ? <VideoOff className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              {/* 3. Screen Share Toggle */}
              <button
                onClick={onToggleScreenShare}
                className={`p-2.5 xs:p-3 sm:p-3.5 rounded-2xl transition-all transform hover:scale-105 active:scale-95 ${
                  isScreenSharing
                    ? 'bg-brand-primary text-white shadow-glow-primary'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
              >
                <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* 4. Switch Camera (front/back or device picker) */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (availableCameras.length > 1) {
                      setShowCameraMenu((prev) => !prev);
                    } else {
                      onSwitchCamera(null);
                    }
                  }}
                  className="p-2.5 xs:p-3 sm:p-3.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all transform hover:scale-105 active:scale-95"
                  title="Switch Camera"
                >
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Available Cameras Popup */}
                {showCameraMenu && availableCameras.length > 0 && (
                  <div
                    className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 bg-brand-surface border border-brand-border rounded-2xl shadow-elevated py-1.5 z-50 text-left"
                    onMouseLeave={() => setShowCameraMenu(false)}
                  >
                    <div className="px-3.5 py-1 text-[10px] font-semibold text-brand-subtle uppercase tracking-wider">
                      Select Camera
                    </div>
                    {availableCameras.map((cam, idx) => (
                      <button
                        key={cam.deviceId || idx}
                        onClick={() => {
                          onSwitchCamera(cam.deviceId);
                          setShowCameraMenu(false);
                        }}
                        className={`w-full px-3.5 py-2 text-xs truncate flex items-center gap-2 hover:bg-white/5 transition-colors ${
                          selectedCamera === cam.deviceId
                            ? 'text-brand-secondary font-semibold bg-brand-secondary/10'
                            : 'text-brand-muted hover:text-white'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{cam.label || `Camera ${idx + 1}`}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Picture-in-Picture Button */}
              {document.pictureInPictureEnabled && (
                <button
                  onClick={handlePiPToggle}
                  className="p-3 sm:p-3.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all transform hover:scale-105 active:scale-95 hidden sm:flex"
                  title="Picture in Picture"
                >
                  <Layers className="w-5 h-5" />
                </button>
              )}

              {/* 6. Audio Output Speaker Dropdown */}
              {audioOutputs.length > 0 && (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setShowOutputMenu((prev) => !prev)}
                    className="p-3 sm:p-3.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all transform hover:scale-105 active:scale-95"
                    title="Audio Output Device"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>

                  {showOutputMenu && (
                    <div
                      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 bg-brand-surface border border-brand-border rounded-2xl shadow-elevated py-1.5 z-50 text-left"
                      onMouseLeave={() => setShowOutputMenu(false)}
                    >
                      <div className="px-3.5 py-1 text-[10px] font-semibold text-brand-subtle uppercase tracking-wider">
                        Audio Speaker
                      </div>
                      {audioOutputs.map((dev) => (
                        <button
                          key={dev.deviceId}
                          onClick={() => {
                            onSelectAudioOutput(dev.deviceId, remoteVideoRef.current);
                            setShowOutputMenu(false);
                          }}
                          className={`w-full px-3.5 py-2 text-xs truncate flex items-center gap-2 hover:bg-white/5 transition-colors ${
                            selectedAudioOutput === dev.deviceId
                              ? 'text-brand-secondary font-semibold bg-brand-secondary/10'
                              : 'text-brand-muted hover:text-white'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{dev.label || 'Speaker'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 7. End Call Button */}
              <button
                onClick={onEndCall}
                className="p-2.5 xs:p-3 sm:p-3.5 rounded-2xl bg-brand-danger hover:bg-red-600 text-white shadow-lg shadow-brand-danger/30 transition-all transform hover:scale-105 active:scale-95 group ml-0.5 sm:ml-1"
                title="End Call"
              >
                <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:rotate-12" />
              </button>
            </div>

            {/* Privacy Watermark */}
            <div className="text-[11px] text-brand-subtle flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-brand-secondary" />
              <span>Peer-to-Peer Encrypted WebRTC Video</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoCallScreen;

