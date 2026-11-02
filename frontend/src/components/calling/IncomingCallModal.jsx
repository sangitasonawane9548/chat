import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneOff, Video, Volume2, VolumeX, Shield } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import ringtone from '@/utils/ringtone';

export const IncomingCallModal = ({ call, onAccept, onReject }) => {
  const [isRingtoneMuted, setIsRingtoneMuted] = useState(false);

  const toggleRingtoneMute = () => {
    const next = !isRingtoneMuted;
    setIsRingtoneMuted(next);
    ringtone.setMuted(next);
  };

  const isVideo = call?.callType === 'video';
  const caller = call?.otherUser || call?.caller || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-sm bg-brand-surface border border-brand-border rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden transition-colors duration-200"
      >
        {/* Subtle background glow */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            isVideo ? 'bg-brand-primary/20' : 'bg-brand-secondary/15'
          }`}
        />

        {/* Top Header & Ringtone Mute */}
        <div className="w-full flex items-center justify-between text-xs text-brand-muted mb-6">
          <div
            className={`flex items-center gap-1.5 font-medium ${
              isVideo ? 'text-brand-primary' : 'text-brand-secondary'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isVideo ? 'bg-brand-primary' : 'bg-brand-secondary'
              }`}
            />
            <span>{isVideo ? 'Incoming Video Call' : 'Incoming Audio Call'}</span>
          </div>
          <button
            onClick={toggleRingtoneMute}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-brand-muted hover:text-brand-text transition-colors"
            title={isRingtoneMuted ? 'Unmute Ringtone' : 'Mute Ringtone'}
          >
            {isRingtoneMuted ? (
              <VolumeX className="w-4 h-4 text-brand-danger" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Pulsing Avatar */}
        <div className="relative my-4 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className={`absolute inset-0 w-28 h-28 -m-2 rounded-full ${
              isVideo ? 'bg-brand-primary/20' : 'bg-brand-secondary/20'
            }`}
          />
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            className={`absolute inset-0 w-28 h-28 -m-2 rounded-full border ${
              isVideo ? 'border-brand-primary/40' : 'border-brand-secondary/40'
            }`}
          />
          <div className="relative z-10">
            <Avatar
              name={caller.full_name}
              src={caller.profile_picture}
              size="2xl"
              shape="rounded"
              className="ring-4 ring-brand-surface shadow-elevated"
            />
          </div>
        </div>

        {/* Caller Info */}
        <h3 className="text-lg font-bold text-brand-text mt-3 truncate max-w-[240px]">
          {caller.full_name || 'Caller'}
        </h3>
        <p className="text-xs text-brand-primary font-medium mt-0.5">
          @{caller.username || 'username'}
        </p>

        <p className="text-xs text-brand-muted mt-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-brand-secondary" />
          End-to-End Encrypted Peer-to-Peer
        </p>

        {/* Action Controls: Reject & Accept */}
        <div className="w-full flex items-center justify-around gap-6 mt-8 pt-4 border-t border-brand-border/60">
          {/* Decline / Reject Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onReject}
              className="w-14 h-14 rounded-full bg-brand-danger/20 hover:bg-brand-danger border border-brand-danger/40 hover:border-brand-danger text-brand-danger hover:text-white flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 group"
              title="Decline Call"
            >
              <PhoneOff className="w-6 h-6 transition-transform group-hover:rotate-12" />
            </button>
            <span className="text-[11px] font-medium text-brand-muted group-hover:text-white">
              Decline
            </span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAccept}
              className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 transition-all transform hover:scale-105 active:scale-95 animate-pulse group"
              title={isVideo ? 'Accept Video Call' : 'Accept Audio Call'}
            >
              {isVideo ? (
                <Video className="w-6 h-6 transition-transform group-hover:scale-110" />
              ) : (
                <Phone className="w-6 h-6 transition-transform group-hover:rotate-12" />
              )}
            </button>
            <span className="text-[11px] font-semibold text-emerald-400">Accept</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default IncomingCallModal;
