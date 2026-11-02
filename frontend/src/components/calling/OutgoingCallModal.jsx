import React from 'react';
import { motion } from 'framer-motion';
import { PhoneOff, Shield, Radio, Video } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

export const OutgoingCallModal = ({ call, isRinging, onCancel }) => {
  const isVideo = call?.callType === 'video';
  const recipient = call?.otherUser || call?.receiver || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-sm bg-brand-surface border border-brand-border rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden transition-colors duration-200"
      >
        {/* Subtle background glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-brand-primary/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="w-full flex items-center justify-center text-xs text-brand-muted mb-6">
          <div className="flex items-center gap-1.5 text-brand-primary font-medium">
            {isVideo ? (
              <Video className="w-3.5 h-3.5 animate-pulse text-brand-primary" />
            ) : (
              <Radio className="w-3.5 h-3.5 animate-pulse text-brand-primary" />
            )}
            <span>
              {isRinging ? 'Ringing...' : isVideo ? 'Starting Video Call...' : 'Calling...'}
            </span>
          </div>
        </div>

        {/* Pulsing Avatar */}
        <div className="relative my-4 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 w-28 h-28 -m-2 rounded-full bg-brand-primary/20"
          />
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            className="absolute inset-0 w-28 h-28 -m-2 rounded-full border border-brand-primary/40"
          />
          <div className="relative z-10">
            <Avatar
              name={recipient.full_name}
              src={recipient.profile_picture}
              size="2xl"
              shape="rounded"
              className="ring-4 ring-brand-surface shadow-elevated"
            />
          </div>
        </div>

        {/* Recipient Info */}
        <h3 className="text-lg font-bold text-brand-text mt-3 truncate max-w-[240px]">
          {recipient.full_name || 'Contact'}
        </h3>
        <p className="text-xs text-brand-primary font-medium mt-0.5">
          @{recipient.username || 'username'}
        </p>

        <p className="text-xs text-brand-muted mt-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-brand-secondary" />
          {isVideo ? 'End-to-End Encrypted WebRTC Video' : 'End-to-End Encrypted WebRTC Audio'}
        </p>

        {/* Action Controls: Cancel Button */}
        <div className="w-full flex items-center justify-center mt-8 pt-4 border-t border-brand-border/60">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onCancel}
              className="w-14 h-14 rounded-full bg-brand-danger hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-brand-danger/25 transition-all transform hover:scale-105 active:scale-95 group"
              title="Cancel Call"
            >
              <PhoneOff className="w-6 h-6 transition-transform group-hover:rotate-12" />
            </button>
            <span className="text-[11px] font-medium text-brand-muted group-hover:text-white">
              Cancel
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OutgoingCallModal;
