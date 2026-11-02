import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCall } from '@/context/CallContext';
import IncomingCallModal from './IncomingCallModal';
import OutgoingCallModal from './OutgoingCallModal';
import AudioCallScreen from './AudioCallScreen';
import VideoCallScreen from './VideoCallScreen';
import MediaSecurityModal from './MediaSecurityModal';

export const CallOverlay = () => {
  const {
    callStatus,
    callType,
    activeCall,
    isRingingRemote,
    isMuted,
    isPeerMuted,
    isCameraOff,
    isPeerCameraOff,
    isScreenSharing,
    isPeerScreenSharing,
    duration,
    formatCallDuration,
    isMinimized,
    setIsMinimized,
    audioOutputs,
    selectedAudioOutput,
    switchAudioOutput,
    availableCameras,
    selectedCamera,
    switchCamera,
    connectionQuality,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    togglePictureInPicture,
    toggleFullscreen,
    mediaSecurityNotice,
    clearMediaSecurityNotice,
    isAudioAutoplayBlocked,
    unblockAudioPlayback
  } = useCall();

  if (callStatus === 'idle' && !mediaSecurityNotice) {
    return null;
  }

  const isVideo = (activeCall?.callType || callType) === 'video';

  return (
    <AnimatePresence>
      {/* 1. Incoming Call Dialog */}
      {callStatus === 'incoming' && (
        <IncomingCallModal
          key="incoming-modal"
          call={activeCall}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {/* 2. Outgoing Call Dialog */}
      {callStatus === 'outgoing' && (
        <OutgoingCallModal
          key="outgoing-modal"
          call={activeCall}
          isRinging={isRingingRemote}
          onCancel={cancelCall}
        />
      )}

      {/* 3. Connecting / Active Call Screen */}
      {(callStatus === 'connecting' || callStatus === 'connected') && (
        isVideo ? (
          <VideoCallScreen
            key="active-video-screen"
            call={activeCall}
            duration={duration}
            formatDuration={formatCallDuration}
            isMuted={isMuted}
            isPeerMuted={isPeerMuted}
            isCameraOff={isCameraOff}
            isPeerCameraOff={isPeerCameraOff}
            isScreenSharing={isScreenSharing}
            isPeerScreenSharing={isPeerScreenSharing}
            localStream={localStream}
            remoteStream={remoteStream}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleScreenShare={toggleScreenShare}
            onSwitchCamera={switchCamera}
            availableCameras={availableCameras}
            selectedCamera={selectedCamera}
            onEndCall={endCall}
            isMinimized={isMinimized}
            onToggleMinimize={() => setIsMinimized((prev) => !prev)}
            audioOutputs={audioOutputs}
            selectedAudioOutput={selectedAudioOutput}
            onSelectAudioOutput={switchAudioOutput}
            connectionQuality={connectionQuality}
            onTogglePictureInPicture={togglePictureInPicture}
            onToggleFullscreen={toggleFullscreen}
            isAudioAutoplayBlocked={isAudioAutoplayBlocked}
            onUnblockAudio={unblockAudioPlayback}
          />
        ) : (
          <AudioCallScreen
            key="active-audio-screen"
            call={activeCall}
            duration={duration}
            formatDuration={formatCallDuration}
            isMuted={isMuted}
            isPeerMuted={isPeerMuted}
            onToggleMute={toggleMute}
            onEndCall={endCall}
            isMinimized={isMinimized}
            onToggleMinimize={() => setIsMinimized((prev) => !prev)}
            audioOutputs={audioOutputs}
            selectedAudioOutput={selectedAudioOutput}
            onSelectAudioOutput={switchAudioOutput}
            connectionQuality={connectionQuality}
            isAudioAutoplayBlocked={isAudioAutoplayBlocked}
            onUnblockAudio={unblockAudioPlayback}
          />
        )
      )}

      {/* 4. Mobile WebRTC Media Security & HTTPS Setup Guidance */}
      {mediaSecurityNotice && (
        <MediaSecurityModal
          key="media-security-modal"
          notice={mediaSecurityNotice}
          onDismiss={clearMediaSecurityNotice}
        />
      )}
    </AnimatePresence>
  );
};

export default CallOverlay;
