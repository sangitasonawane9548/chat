import React from 'react';
import { Video } from 'lucide-react';
import { useCall } from '@/context/CallContext';
import { notify } from '@/components/common/ToastProvider';

export const VideoCallButton = ({
  conversationId,
  participant,
  className = '',
  iconClassName = 'w-4 h-4'
}) => {
  const { startVideoCall, callStatus } = useCall();

  const handleCall = () => {
    if (callStatus !== 'idle') {
      notify.warning('You are already in an active call');
      return;
    }

    if (!participant || !participant.id) {
      notify.error('Cannot initiate call: recipient info unavailable');
      return;
    }

    startVideoCall(conversationId, participant);
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
      title={isBusy ? 'Call in progress' : `Video Call @${participant?.username || ''}`}
    >
      <Video className={iconClassName} />
    </button>
  );
};

export default VideoCallButton;

