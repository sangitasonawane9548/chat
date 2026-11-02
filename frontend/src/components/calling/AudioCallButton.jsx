import React from 'react';
import { Phone } from 'lucide-react';
import { useCall } from '@/context/CallContext';
import { notify } from '@/components/common/ToastProvider';

export const AudioCallButton = ({
  conversationId,
  participant,
  className = '',
  iconClassName = 'w-4 h-4'
}) => {
  const { startAudioCall, callStatus } = useCall();

  const handleCall = () => {
    if (callStatus !== 'idle') {
      notify.warning('You are already in a call');
      return;
    }

    if (!participant || !participant.id) {
      notify.error('Cannot initiate call: recipient info unavailable');
      return;
    }

    startAudioCall(conversationId, participant);
  };

  const isBusy = callStatus !== 'idle';

  return (
    <button
      onClick={handleCall}
      disabled={isBusy}
      className={`p-2 rounded-xl transition-colors ${
        isBusy
          ? 'opacity-40 cursor-not-allowed text-brand-muted'
          : 'text-brand-muted hover:text-white hover:bg-white/5 active:scale-95'
      } ${className}`}
      title={isBusy ? 'Call in progress' : `Audio Call @${participant?.username || ''}`}
    >
      <Phone className={iconClassName} />
    </button>
  );
};

export default AudioCallButton;

