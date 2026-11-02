import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import webrtcService from '@/services/webrtcService';
import ringtone from '@/utils/ringtone';
import {
  initiateCallApi,
  cancelCallApi,
  rejectCallApi,
  endCallApi
} from '@/services/api';
import { notify } from '@/components/common/ToastProvider';

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();

  // Call status: 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended'
  const [callStatus, setCallStatus] = useState('idle');
  const [callType, setCallType] = useState('audio'); // 'audio' | 'video'
  const [activeCall, setActiveCall] = useState(null);
  const [isRingingRemote, setIsRingingRemote] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPeerMuted, setIsPeerMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isPeerCameraOff, setIsPeerCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPeerScreenSharing, setIsPeerScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [connectionQuality, setConnectionQuality] = useState('good'); // good | fair | poor
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaSecurityNotice, setMediaSecurityNotice] = useState(null);
  const [isAudioAutoplayBlocked, setIsAudioAutoplayBlocked] = useState(false);

  const clearMediaSecurityNotice = useCallback(() => {
    setMediaSecurityNotice(null);
  }, []);

  const unblockAudioPlayback = useCallback(async () => {
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1.0;
        await remoteAudioRef.current.play();
        setIsAudioAutoplayBlocked(false);
      } catch (err) {
        console.warn('[WebRTC] Manual audio unblock failed:', err);
      }
    }
  }, []);

  const remoteAudioRef = useRef(null);
  const durationTimerRef = useRef(null);
  const activeCallRef = useRef(activeCall);
  const callStatusRef = useRef(callStatus);
  const callTypeRef = useRef(callType);

  // Keep refs synchronized to avoid stale closures in socket callbacks
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  // Load available audio output and video input devices
  const refreshMediaDevices = useCallback(async () => {
    try {
      const [audioDevs, videoDevs] = await Promise.all([
        webrtcService.getAudioOutputDevices(),
        webrtcService.getVideoInputDevices()
      ]);
      setAudioOutputs(audioDevs);
      setAvailableCameras(videoDevs);
      if (audioDevs.length > 0 && !selectedAudioOutput) {
        setSelectedAudioOutput(audioDevs[0].deviceId);
      }
      if (videoDevs.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevs[0].deviceId);
      }
    } catch (_) {}
  }, [selectedAudioOutput, selectedCamera]);

  useEffect(() => {
    if (callStatus === 'connected' || callStatus === 'connecting') {
      refreshMediaDevices();
    }
  }, [callStatus, refreshMediaDevices]);

  // Duration Timer
  useEffect(() => {
    if (callStatus === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (callStatus === 'idle') {
        setDuration(0);
      }
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [callStatus]);

  // Complete teardown helper
  const teardownCall = useCallback(() => {
    ringtone.stop();
    webrtcService.cleanup();
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    // Stop & reset dedicated remote audio playback element
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      } catch (_) {}
    }
    setIsAudioAutoplayBlocked(false);
    setCallStatus('idle');
    setCallType('audio');
    setActiveCall(null);
    setIsRingingRemote(false);
    setIsMuted(false);
    setIsPeerMuted(false);
    setIsCameraOff(false);
    setIsPeerCameraOff(false);
    setIsScreenSharing(false);
    setIsPeerScreenSharing(false);
    setIsMinimized(false);
    setConnectionQuality('good');
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  // Format duration into mm:ss
  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Switch speaker/audio output
  const switchAudioOutput = useCallback(async (deviceId, mediaElement = null) => {
    setSelectedAudioOutput(deviceId);
    const targetElement = mediaElement || remoteAudioRef.current;
    if (targetElement) {
      const success = await webrtcService.setAudioOutputDevice(targetElement, deviceId);
      if (success) {
        notify.success('Audio output device updated');
      }
    }
  }, []);

  // Toggle Microphone Mute
  const toggleMute = useCallback(() => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    webrtcService.setMicrophoneMuted(newMute);

    const call = activeCallRef.current;
    if (socket && call?.id) {
      socket.emit('call:mute', {
        callId: call.id,
        isMuted: newMute
      });
    }
  }, [isMuted, socket]);

  // Toggle Camera On/Off
  const toggleCamera = useCallback(() => {
    const newCameraOff = !isCameraOff;
    setIsCameraOff(newCameraOff);
    webrtcService.setCameraEnabled(!newCameraOff);

    const call = activeCallRef.current;
    if (socket && call?.id) {
      socket.emit('call:camera_status', {
        callId: call.id,
        isCameraOff: newCameraOff,
        videoEnabled: !newCameraOff
      });
    }
  }, [isCameraOff, socket]);

  // Switch Camera Device (front/back or webcam selection)
  const switchCamera = useCallback(async (deviceId = null) => {
    try {
      const newTrack = await webrtcService.switchCamera(deviceId);
      if (deviceId) setSelectedCamera(deviceId);
      // Trigger localStream re-render
      if (webrtcService.localStream) {
        setLocalStream(new MediaStream(webrtcService.localStream.getTracks()));
      }
      notify.success('Camera switched');
      return newTrack;
    } catch (err) {
      notify.error(err.message || 'Failed to switch camera');
    }
  }, []);

  // Toggle Screen Sharing
  const toggleScreenShare = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call?.id) return;

    if (isScreenSharing) {
      await webrtcService.stopScreenShare();
      setIsScreenSharing(false);
      if (webrtcService.localStream) {
        setLocalStream(new MediaStream(webrtcService.localStream.getTracks()));
      }
      if (socket) {
        socket.emit('call:screen_share_status', {
          callId: call.id,
          isScreenSharing: false
        });
      }
    } else {
      try {
        await webrtcService.startScreenShare(() => {
          // Native "Stop sharing" clicked by user
          setIsScreenSharing(false);
          if (webrtcService.localStream) {
            setLocalStream(new MediaStream(webrtcService.localStream.getTracks()));
          }
          if (socket && activeCallRef.current?.id) {
            socket.emit('call:screen_share_status', {
              callId: activeCallRef.current.id,
              isScreenSharing: false
            });
          }
        });
        setIsScreenSharing(true);
        if (webrtcService.localStream) {
          setLocalStream(new MediaStream(webrtcService.localStream.getTracks()));
        }
        if (socket) {
          socket.emit('call:screen_share_status', {
            callId: call.id,
            isScreenSharing: true
          });
        }
      } catch (err) {
        if (err.name !== 'NotAllowedError') {
          notify.error(err.message || 'Could not start screen sharing');
        }
      }
    }
  }, [isScreenSharing, socket]);

  // Picture in Picture helper
  const togglePictureInPicture = useCallback(async (videoElement) => {
    return await webrtcService.togglePictureInPicture(videoElement);
  }, []);

  // Fullscreen helper
  const toggleFullscreen = useCallback(async (containerElement) => {
    return await webrtcService.toggleFullscreen(containerElement);
  }, []);

  // 1. INITIATE CALL (Audio or Video)
  const initiateCall = useCallback(async (conversationId, recipientUser, requestedType = 'audio') => {
    if (!isAuthenticated || !user) {
      notify.error('Please log in to make a call');
      return;
    }

    if (callStatusRef.current !== 'idle') {
      notify.warning('You are already in a call');
      return;
    }

    if (!recipientUser || !recipientUser.id) {
      notify.error('Invalid recipient for call');
      return;
    }

    try {
      const isVideo = requestedType === 'video';
      setCallType(requestedType);

      // Pre-flight check: Media capture availability in current browser context
      if (!webrtcService.isSecureContext() && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
        setMediaSecurityNotice({
          origin: window.location.origin,
          hostname: window.location.hostname,
          port: window.location.port || '5173'
        });
        notify.error('Mobile WebRTC requires HTTPS or Chrome Flag setup');
        return;
      }

      // Optimistically setup outgoing call state
      const initialCallData = {
        conversationId,
        receiverId: recipientUser.id,
        callerId: user.id,
        isCaller: true,
        callType: requestedType,
        otherUser: recipientUser,
        caller: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          profile_picture: user.profile_picture
        },
        receiver: recipientUser
      };

      setActiveCall(initialCallData);
      setCallStatus('outgoing');
      setIsRingingRemote(false);
      setIsMuted(false);
      setIsPeerMuted(false);
      setIsCameraOff(false);
      setIsPeerCameraOff(false);
      setIsScreenSharing(false);
      setIsPeerScreenSharing(false);
      setDuration(0);

      // Start gentle outgoing ringtone
      ringtone.startOutgoing();

      // Trigger backend API
      const res = await initiateCallApi({
        conversationId,
        receiverId: recipientUser.id,
        callType: requestedType
      });

      if (res.success && res.call) {
        setActiveCall((prev) => ({
          ...prev,
          id: res.call.id,
          startedAt: res.call.startedAt
        }));
      } else {
        throw new Error(res.message || 'Failed to start call');
      }
    } catch (err) {
      ringtone.stop();
      teardownCall();
      const message = err.response?.data?.message || err.message || 'Could not place call';
      notify.error(message);
    }
  }, [isAuthenticated, user, teardownCall]);

  const startAudioCall = useCallback((convId, user) => initiateCall(convId, user, 'audio'), [initiateCall]);
  const startVideoCall = useCallback((convId, user) => initiateCall(convId, user, 'video'), [initiateCall]);

  // 2. ACCEPT INCOMING CALL
  const acceptCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call || !call.id || !socket) return;

    try {
      ringtone.stop();
      setCallStatus('connecting');

      const isVideo = call.callType === 'video';

      // 1. Capture local media (Camera + Mic for video, Mic only for audio)
      const stream = await webrtcService.startLocalMedia({
        video: isVideo,
        audio: true
      });
      setLocalStream(stream);

      // 2. Prepare PeerConnection
      webrtcService.createPeerConnection({
        onIceCandidate: (candidate) => {
          socket.emit('call:ice-candidate', {
            callId: call.id,
            candidate
          });
        },
        onTrack: (remoteMediaStream) => {
          setRemoteStream(remoteMediaStream);
          if (remoteAudioRef.current) {
            if (remoteAudioRef.current.srcObject !== remoteMediaStream) {
              remoteAudioRef.current.srcObject = remoteMediaStream;
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.volume = 1.0;
              remoteAudioRef.current.play().catch((e) => {
                console.warn('[WebRTC] Audio autoplay blocked:', e);
                setIsAudioAutoplayBlocked(true);
              });
            }
          }
        },
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            setCallStatus('connected');
            setConnectionQuality('good');
          } else if (state === 'disconnected' || state === 'failed') {
            setConnectionQuality('poor');
          }
        }
      });

      // 3. Emit accept acknowledgment to server
      socket.emit('call:accept', { callId: call.id }, (ack) => {
        if (!ack?.success) {
          notify.error(ack?.error || 'Failed to connect call');
          teardownCall();
        }
      });
    } catch (err) {
      console.error('[WebRTC] Error accepting call:', err);
      if (err.code === 'INSECURE_CONTEXT' || (!webrtcService.isSecureContext() && !navigator.mediaDevices?.getUserMedia)) {
        setMediaSecurityNotice({
          origin: window.location.origin,
          hostname: window.location.hostname,
          port: window.location.port || '5173'
        });
      }
      notify.error(err.message || 'Media access failed');
      teardownCall();
    }
  }, [socket, teardownCall]);

  // 3. REJECT INCOMING CALL
  const rejectCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (call?.id) {
      try {
        if (socket) {
          socket.emit('call:reject', { callId: call.id });
        } else {
          await rejectCallApi(call.id);
        }
      } catch (_) {}
    }
    teardownCall();
  }, [socket, teardownCall]);

  // 4. CANCEL OUTGOING CALL
  const cancelCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (call?.id) {
      try {
        if (socket) {
          socket.emit('call:cancel', { callId: call.id });
        } else {
          await cancelCallApi(call.id);
        }
      } catch (_) {}
    }
    teardownCall();
  }, [socket, teardownCall]);

  // 5. END ACTIVE CALL
  const endCall = useCallback(async () => {
    const call = activeCallRef.current;
    const finalSeconds = duration;
    if (call?.id) {
      try {
        if (socket) {
          socket.emit('call:end', { callId: call.id });
        } else {
          await endCallApi(call.id);
        }
      } catch (_) {}
    }
    teardownCall();
    if (finalSeconds > 0) {
      notify.info(`Call ended (${formatCallDuration(finalSeconds)})`);
    }
  }, [duration, socket, teardownCall]);

  // SOCKET EVENT LISTENERS
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    // Incoming call received
    const handleIncomingCall = (data) => {
      if (callStatusRef.current !== 'idle') {
        return;
      }

      const receivedType = data.callType || 'audio';
      setCallType(receivedType);

      setActiveCall({
        id: data.id,
        conversationId: data.conversationId,
        callerId: data.callerId,
        receiverId: data.receiverId,
        callType: receivedType,
        caller: data.caller,
        receiver: data.receiver,
        otherUser: data.caller,
        isCaller: false,
        startedAt: data.startedAt
      });
      setCallStatus('incoming');
      setIsRingingRemote(false);
      setIsMuted(false);
      setIsPeerMuted(false);
      setIsCameraOff(false);
      setIsPeerCameraOff(false);
      setIsScreenSharing(false);
      setIsPeerScreenSharing(false);
      setDuration(0);

      // Acknowledge receipt to caller
      socket.emit('call:ringing', { callId: data.id });

      // Start ringing chime
      ringtone.startIncoming();
    };

    // Caller receives ringing notification
    const handleRemoteRinging = (data) => {
      const call = activeCallRef.current;
      if (call && call.id === data.callId) {
        setIsRingingRemote(true);
      }
    };

    // Caller receives acceptance -> initiates SDP offer
    const handleCallAccepted = async (data) => {
      const call = activeCallRef.current;
      if (!call || call.id !== data.callId) return;

      try {
        ringtone.stop();
        setCallStatus('connecting');

        const isVideo = call.callType === 'video';

        // Capture local media
        const stream = await webrtcService.startLocalMedia({
          video: isVideo,
          audio: true
        });
        setLocalStream(stream);

        // Initialize PeerConnection
        webrtcService.createPeerConnection({
          onIceCandidate: (candidate) => {
            socket.emit('call:ice-candidate', {
              callId: call.id,
              candidate
            });
          },
          onTrack: (remoteMediaStream) => {
            setRemoteStream(remoteMediaStream);
            if (remoteAudioRef.current) {
              if (remoteAudioRef.current.srcObject !== remoteMediaStream) {
                remoteAudioRef.current.srcObject = remoteMediaStream;
                remoteAudioRef.current.muted = false;
                remoteAudioRef.current.volume = 1.0;
                remoteAudioRef.current.play().catch((e) => {
                  console.warn('[WebRTC] Audio autoplay blocked:', e);
                  setIsAudioAutoplayBlocked(true);
                });
              }
            }
          },
          onConnectionStateChange: (state) => {
            if (state === 'connected') {
              setCallStatus('connected');
              setConnectionQuality('good');
            } else if (state === 'disconnected' || state === 'failed') {
              setConnectionQuality('poor');
            }
          }
        });

        // Create and send SDP offer
        const offer = await webrtcService.createOffer({ video: isVideo });
        socket.emit('call:offer', {
          callId: call.id,
          sdp: offer.sdp
        });
      } catch (err) {
        console.error('[WebRTC] Caller negotiation failed:', err);
        if (err.code === 'INSECURE_CONTEXT' || (!webrtcService.isSecureContext() && !navigator.mediaDevices?.getUserMedia)) {
          setMediaSecurityNotice({
            origin: window.location.origin,
            hostname: window.location.hostname,
            port: window.location.port || '5173'
          });
        }
        notify.error('Media error: ' + err.message);
        teardownCall();
      }
    };

    // Receiver handles SDP offer -> responds with SDP answer
    const handleCallOffer = async (data) => {
      const call = activeCallRef.current;
      if (!call || call.id !== data.callId) return;

      try {
        const answer = await webrtcService.handleOffer(data.sdp);
        socket.emit('call:answer', {
          callId: call.id,
          sdp: answer.sdp
        });
        setCallStatus('connected');
      } catch (err) {
        console.error('[WebRTC] Receiver failed to handle offer:', err);
        notify.error('Call connection failed');
        teardownCall();
      }
    };

    // Caller handles SDP answer
    const handleCallAnswer = async (data) => {
      const call = activeCallRef.current;
      if (!call || call.id !== data.callId) return;

      try {
        await webrtcService.handleAnswer(data.sdp);
        setCallStatus('connected');
      } catch (err) {
        console.error('[WebRTC] Failed to handle answer:', err);
        notify.error('Call negotiation error');
        teardownCall();
      }
    };

    // ICE Candidate relay
    const handleIceCandidate = async (data) => {
      const call = activeCallRef.current;
      if (call && call.id === data.callId) {
        await webrtcService.addIceCandidate(data.candidate);
      }
    };

    // Peer muted microphone
    const handleParticipantMuted = (data) => {
      const call = activeCallRef.current;
      if (call && call.id === data.callId) {
        setIsPeerMuted(Boolean(data.isMuted));
      }
    };

    // Peer camera status changed (Day 7)
    const handleCameraStatus = (data) => {
      const call = activeCallRef.current;
      if (call && call.id === data.callId) {
        setIsPeerCameraOff(Boolean(data.isCameraOff));
      }
    };

    // Peer screen share status changed (Day 7)
    const handleScreenShareStatus = (data) => {
      const call = activeCallRef.current;
      if (call && call.id === data.callId) {
        setIsPeerScreenSharing(Boolean(data.isScreenSharing));
      }
    };

    // Call was rejected by recipient
    const handleCallRejected = (data) => {
      const call = activeCallRef.current;
      if (call && call.id === data.callId) {
        ringtone.stop();
        notify.info('Call declined');
        teardownCall();
      }
    };

    // Call was cancelled by caller
    const handleCallCancelled = (data) => {
      const call = activeCallRef.current;
      if (call && call.id === data.callId) {
        ringtone.stop();
        notify.info('Call cancelled');
        teardownCall();
      }
    };

    // Call was hung up / ended
    const handleCallEnded = (data) => {
      const call = activeCallRef.current;
      if (call && call.id === data.callId) {
        ringtone.stop();
        const durationSec = data.durationSeconds || durationTimerRef.current ? duration : 0;
        teardownCall();
        if (data.endReason === 'timeout') {
          notify.info('No answer');
        } else if (durationSec > 0) {
          notify.info(`Call ended (${formatCallDuration(durationSec)})`);
        } else {
          notify.info('Call ended');
        }
      }
    };

    // Missed call notification
    const handleCallMissed = (data) => {
      ringtone.stop();
      teardownCall();
      notify.error(`Missed ${data.callType || 'audio'} call from @${data.caller?.username || 'user'}`);
    };

    // Register socket listeners
    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:ringing', handleRemoteRinging);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:offer', handleCallOffer);
    socket.on('call:answer', handleCallAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:participant_muted', handleParticipantMuted);
    socket.on('call:camera_status', handleCameraStatus);
    socket.on('call:camera-status', handleCameraStatus);
    socket.on('call:screen_share_status', handleScreenShareStatus);
    socket.on('call:screen-share-status', handleScreenShareStatus);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:cancelled', handleCallCancelled);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:missed', handleCallMissed);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:ringing', handleRemoteRinging);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:offer', handleCallOffer);
      socket.off('call:answer', handleCallAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:participant_muted', handleParticipantMuted);
      socket.off('call:camera_status', handleCameraStatus);
      socket.off('call:camera-status', handleCameraStatus);
      socket.off('call:screen_share_status', handleScreenShareStatus);
      socket.off('call:screen-share-status', handleScreenShareStatus);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:cancelled', handleCallCancelled);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:missed', handleCallMissed);
    };
  }, [socket, isAuthenticated, duration, teardownCall]);

  const value = {
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
    startAudioCall,
    startVideoCall,
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
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      {/* Hidden WebRTC Remote Audio Element - dedicated single remote audio output for all calls */}
      <audio
        ref={remoteAudioRef}
        id="webrtc-remote-audio"
        autoPlay
        playsInline
        className="hidden"
      />
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export default CallContext;
