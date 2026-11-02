import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Minimize2,
  Maximize2,
  Shield,
  Wifi,
  ChevronDown
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

export const AudioCallScreen = ({
  call,
  duration,
  formatDuration,
  isMuted,
  isPeerMuted,
  onToggleMute,
  onEndCall,
  isMinimized,
  onToggleMinimize,
  audioOutputs = [],
  selectedAudioOutput,
  onSelectAudioOutput,
  connectionQuality = 'good',
  isAudioAutoplayBlocked = false,
  onUnblockAudio
}) => {
  const [showOutputMenu, setShowOutputMenu] = useState(false);
  const otherUser = call?.otherUser || (call?.isCaller ? call?.receiver : call?.caller) || {};

  // Minimized Floating Widget Mode (Picture-in-Picture)
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 bg-brand-surface/95 border border-brand-primary/40 rounded-2xl shadow-elevated backdrop-blur-xl animate-fade-in transition-colors duration-200"
      >
        <div className="relative">
          <Avatar
            name={otherUser.full_name}
            src={otherUser.profile_picture}
            size="sm"
            shape="rounded"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-brand-surface" />
        </div>

        <div className="flex flex-col min-w-0 pr-1">
          <span className="text-xs font-semibold text-brand-text truncate max-w-[120px]">
            {otherUser.full_name || 'Active Call'}
          </span>
          <span className="text-[11px] font-mono text-brand-secondary font-medium">
            {formatDuration(duration)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-xl transition-colors ${
              isMuted
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-brand-muted hover:text-white hover:bg-white/5'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onToggleMinimize}
            className="p-2 rounded-xl text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
            title="Expand Call View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onEndCall}
            className="p-2 rounded-xl bg-brand-danger hover:bg-red-600 text-white transition-colors shadow-sm"
            title="End Call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    );
  }

  // Full Screen / Modal Mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-md bg-brand-surface border border-brand-border rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden transition-colors duration-200"
      >
        {/* Subtle background glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Control Bar: Quality & Minimize */}
        <div className="w-full flex items-center justify-between text-xs text-brand-muted mb-6">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-brand-border text-brand-muted">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionQuality === 'good'
                  ? 'bg-emerald-400'
                  : connectionQuality === 'fair'
                  ? 'bg-amber-400'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-[11px] font-medium text-brand-text">
              {connectionQuality === 'good' ? 'HD Voice' : 'Connecting'}
            </span>
            <Wifi className="w-3 h-3 text-brand-subtle ml-0.5" />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onToggleMinimize}
              className="p-1.5 rounded-full hover:bg-white/5 text-brand-muted hover:text-white transition-colors"
              title="Minimize to Widget"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Calling Avatar with Dynamic Animated Audio Waves */}
        <div className="relative my-4 flex items-center justify-center">
          {/* Animated audio wave rings */}
          <motion.div
            animate={{
              scale: isPeerMuted ? 1 : [1, 1.28, 1],
              opacity: isPeerMuted ? 0.1 : [0.35, 0, 0.35]
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 w-32 h-32 -m-3 rounded-full bg-brand-primary/20"
          />
          <motion.div
            animate={{
              scale: isPeerMuted ? 1 : [1, 1.15, 1],
              opacity: isPeerMuted ? 0.2 : [0.5, 0.1, 0.5]
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            className="absolute inset-0 w-32 h-32 -m-3 rounded-full border border-brand-primary/30"
          />

          <div className="relative z-10">
            <Avatar
              name={otherUser.full_name}
              src={otherUser.profile_picture}
              size="2xl"
              shape="rounded"
              className="ring-4 ring-brand-surface shadow-elevated"
            />
          </div>
        </div>

        {/* User Identity */}
        <h3 className="text-xl font-bold text-brand-text mt-3 truncate max-w-[280px]">
          {otherUser.full_name || 'Participant'}
        </h3>
        <p className="text-xs text-brand-primary font-medium mt-0.5">
          @{otherUser.username || 'username'}
        </p>

        {/* Live Call Duration */}
        <div className="mt-4 px-3.5 py-1 rounded-full bg-brand-card border border-brand-border/60">
          <span className="font-mono text-sm font-semibold text-emerald-400 tracking-wider">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Peer Mute Warning */}
        {isPeerMuted && (
          <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            <MicOff className="w-3.5 h-3.5" />
            <span>Participant muted their microphone</span>
          </div>
        )}

        {/* Audio Visualizer Waves Indicator */}
        <div className="flex items-center gap-1 h-6 my-4">
          {[40, 75, 55, 90, 60, 30, 80, 45].map((height, i) => (
            <motion.span
              key={i}
              animate={{
                height: isPeerMuted ? '4px' : [`${Math.max(4, height * 0.25)}px`, `${height * 0.25 + 12}px`, `${Math.max(4, height * 0.25)}px`]
              }}
              transition={{
                duration: 0.8 + (i % 3) * 0.2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.08
              }}
              className="w-1 bg-brand-primary/60 rounded-full"
            />
          ))}
        </div>

        {/* Autoplay blocked notification banner */}
        {isAudioAutoplayBlocked && (
          <button
            onClick={onUnblockAudio}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium text-xs shadow-xl animate-pulse mb-2 transition-all cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-white" />
            <span>Audio paused by browser • Tap to enable</span>
          </button>
        )}

        {/* Bottom Control Dock */}
        <div className="w-full flex items-center justify-center gap-5 mt-4 pt-5 border-t border-brand-border/60 relative">
          {/* Mute Microphone Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onToggleMute}
              className={`w-13 h-13 p-3.5 rounded-full border transition-all transform hover:scale-105 active:scale-95 ${
                isMuted
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30 shadow-lg'
                  : 'bg-white/5 text-brand-muted border-brand-border hover:bg-white/10 hover:text-white'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5 text-amber-400" /> : <Mic className="w-5 h-5" />}
            </button>
            <span className="text-[11px] font-medium text-brand-muted">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </div>

          {/* Audio Output Selector (if supported devices available) */}
          {audioOutputs.length > 0 && (
            <div className="relative flex flex-col items-center gap-1.5">
              <button
                onClick={() => setShowOutputMenu((prev) => !prev)}
                className="w-13 h-13 p-3.5 rounded-full bg-white/5 text-brand-muted border border-brand-border hover:bg-white/10 hover:text-white transition-all transform hover:scale-105 active:scale-95"
                title="Audio Output Device"
              >
                <Volume2 className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-medium text-brand-muted flex items-center gap-0.5">
                Speaker <ChevronDown className="w-3 h-3" />
              </span>

              {/* Output Device Popup Menu */}
              {showOutputMenu && (
                <div
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-brand-surface border border-brand-border rounded-xl shadow-elevated py-1 z-30 animate-fade-in text-left"
                  onMouseLeave={() => setShowOutputMenu(false)}
                >
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-brand-subtle font-semibold">
                    Select Audio Output
                  </div>
                  {audioOutputs.map((device) => (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        onSelectAudioOutput(device.deviceId);
                        setShowOutputMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-xs truncate flex items-center gap-2 hover:bg-white/5 transition-colors ${
                        selectedAudioOutput === device.deviceId
                          ? 'text-brand-secondary font-semibold bg-brand-secondary/10'
                          : 'text-brand-muted hover:text-white'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{device.label || `Speaker (${device.deviceId.slice(0, 5)}...)`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* End Call Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={onEndCall}
              className="w-13 h-13 p-3.5 rounded-full bg-brand-danger hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-brand-danger/30 transition-all transform hover:scale-105 active:scale-95 group"
              title="End Call"
            >
              <PhoneOff className="w-5 h-5 transition-transform group-hover:rotate-12" />
            </button>
            <span className="text-[11px] font-medium text-brand-danger group-hover:text-red-400">
              End Call
            </span>
          </div>
        </div>

        {/* Security watermark footer */}
        <div className="mt-5 text-[11px] text-brand-subtle flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-brand-secondary" />
          Encrypted WebRTC Audio
        </div>
      </motion.div>
    </div>
  );
};

export default AudioCallScreen;

