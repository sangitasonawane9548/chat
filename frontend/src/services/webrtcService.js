/**
 * WebRTC Audio & Video Calling Service
 * Handles RTCPeerConnection lifecycle, microphone & camera media capture,
 * SDP negotiation, ICE candidate exchange, camera switching, screen sharing,
 * picture-in-picture, and speaker routing.
 */

// Default STUN servers
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' }
];

export const getIceServers = () => {
  const servers = [...DEFAULT_ICE_SERVERS];

  // Optional custom STUN URLs from environment
  if (import.meta.env.VITE_STUN_URLS) {
    const customStun = import.meta.env.VITE_STUN_URLS.split(',').map((u) => ({ urls: u.trim() }));
    servers.push(...customStun);
  }

  // Optional TURN credentials from environment
  if (import.meta.env.VITE_TURN_URL) {
    servers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
    });
  }

  return servers;
};

export class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.screenStream = null;
    this.savedCameraTrack = null;
    this.queuedCandidates = [];
    this.isRemoteDescriptionSet = false;
    this.callType = 'audio'; // 'audio' | 'video'
    this.currentFacingMode = 'user'; // 'user' | 'environment'
  }

  /**
   * Checks whether the current window context is secure (HTTPS or localhost)
   * Mobile browsers strictly require a Secure Context to expose mediaDevices/getUserMedia.
   */
  isSecureContext() {
    if (typeof window === 'undefined') return true;
    if (typeof window.isSecureContext === 'boolean') {
      return window.isSecureContext;
    }
    const hostname = window.location.hostname;
    return (
      window.location.protocol === 'https:' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    );
  }

  /**
   * Polyfill and return navigator.mediaDevices safely across mobile & desktop browsers
   */
  getMediaDevices() {
    if (typeof navigator === 'undefined') return null;

    // Polyfill navigator.mediaDevices if missing or partially defined in older mobile WebViews
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }

    if (!navigator.mediaDevices.getUserMedia) {
      const legacyGetUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (legacyGetUserMedia) {
        navigator.mediaDevices.getUserMedia = function (constraints) {
          return new Promise((resolve, reject) => {
            legacyGetUserMedia.call(navigator, constraints, resolve, reject);
          });
        };
      }
    }

    return navigator.mediaDevices;
  }

  /**
   * Request microphone stream (Audio Only - Day 6 Compatibility)
   * @returns {Promise<MediaStream>}
   */
  async startLocalAudio() {
    return this.startLocalMedia({ video: false, audio: true });
  }

  /**
   * Request local media streams (Audio and/or Video - Day 7)
   * @param {object} options
   * @param {boolean} options.video
   * @param {boolean} options.audio
   * @param {object|boolean} options.videoConstraints
   * @returns {Promise<MediaStream>}
   */
  async startLocalMedia({ video = false, audio = true, videoConstraints = null } = {}) {
    this.callType = video ? 'video' : 'audio';

    // If local stream already exists with the required tracks, reuse it
    if (this.localStream) {
      const hasAudio = this.localStream.getAudioTracks().length > 0;
      const hasVideo = this.localStream.getVideoTracks().length > 0;
      if ((!audio || hasAudio) && (!video || hasVideo)) {
        return this.localStream;
      }
      // Otherwise clean up existing before requesting new configuration
      this.cleanupLocalStream();
    }

    const isSecure = this.isSecureContext();
    const mediaDevices = this.getMediaDevices();

    if (!mediaDevices || !mediaDevices.getUserMedia) {
      if (!isSecure) {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'this address';
        const err = new Error(
          `WebRTC Camera and Microphone access requires a secure HTTPS connection. Mobile browsers block media devices on unencrypted HTTP (${origin}).`
        );
        err.code = 'INSECURE_CONTEXT';
        err.origin = origin;
        throw err;
      }

      const err = new Error(
        'Your browser does not support WebRTC media capture. Please open MELT in a supported modern browser such as Chrome or Safari.'
      );
      err.code = 'NOT_SUPPORTED';
      throw err;
    }

    const audioConstraints = audio ? {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      channelCount: { ideal: 1 },
      googEchoCancellation: { ideal: true },
      googAutoGainControl: { ideal: true },
      googNoiseSuppression: { ideal: true },
      googHighpassFilter: { ideal: true },
      googAudioMirroring: { ideal: false }
    } : false;

    // Mobile-friendly video constraints without rigid min bounds to support both portrait & landscape orientations
    const defaultVideoConstraints = {
      facingMode: this.currentFacingMode || 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 }
    };

    const finalVideoConstraints = video
      ? (videoConstraints || defaultVideoConstraints)
      : false;

    try {
      const stream = await mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: finalVideoConstraints
      });

      this.localStream = stream;
      return stream;
    } catch (err) {
      // Tier 1.5 Fallback: Standard boolean audio constraints if complex constraints fail
      if (audio) {
        try {
          const fallbackAudioConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          };
          const stream = await mediaDevices.getUserMedia({
            audio: fallbackAudioConstraints,
            video: finalVideoConstraints
          });
          this.localStream = stream;
          return stream;
        } catch (_) {}
      }

      // Tier 2 Fallback: Facing mode only (drops ideal resolution constraints)
      if (video) {
        try {
          const fallbackStream = await mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: { facingMode: this.currentFacingMode || 'user' }
          });
          this.localStream = fallbackStream;
          return fallbackStream;
        } catch (tier2Err) {
          // Tier 3 Fallback: Simple video: true
          try {
            const basicStream = await mediaDevices.getUserMedia({
              audio: true,
              video: true
            });
            this.localStream = basicStream;
            return basicStream;
          } catch (tier3Err) {
            // Keep original or latest error
          }
        }
      }

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        const deviceType = video ? 'Camera and microphone' : 'Microphone';
        const permError = new Error(`${deviceType} permission was denied. Please allow camera and microphone access in your browser settings.`);
        permError.code = 'PERMISSION_DENIED';
        throw permError;
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        const deviceType = video ? 'Camera or microphone' : 'Microphone';
        const notFoundError = new Error(`No ${deviceType.toLowerCase()} was detected. Please connect your media device and try again.`);
        notFoundError.code = 'DEVICE_NOT_FOUND';
        throw notFoundError;
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        const busyError = new Error('Could not access camera/microphone. It may already be in use by another application.');
        busyError.code = 'DEVICE_BUSY';
        throw busyError;
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        const constraintError = new Error('The requested camera resolution is not supported by your mobile hardware.');
        constraintError.code = 'OVERCONSTRAINED';
        throw constraintError;
      }
      throw err;
    }
  }

  /**
   * Initialize RTCPeerConnection with STUN/TURN configuration
   */
  createPeerConnection({ onIceCandidate, onTrack, onConnectionStateChange }) {
    if (this.peerConnection) {
      this.cleanupPeerConnection();
    }

    const iceServers = getIceServers();
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10
    });

    this.peerConnection = pc;
    this.queuedCandidates = [];
    this.isRemoteDescriptionSet = false;
    this.remoteStream = new MediaStream();

    // Attach all local tracks (both audio and video)
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && typeof onIceCandidate === 'function') {
        onIceCandidate(event.candidate);
      }
    };

    // Remote media track received (handled idempotently)
    pc.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!this.remoteStream.getTracks().some((t) => t.id === track.id)) {
            this.remoteStream.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }

      if (typeof onTrack === 'function') {
        onTrack(this.remoteStream);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      if (typeof onConnectionStateChange === 'function') {
        onConnectionStateChange(pc.connectionState);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (typeof onConnectionStateChange === 'function') {
        onConnectionStateChange(pc.iceConnectionState);
      }
    };

    return pc;
  }

  /**
   * Create SDP Offer (Caller)
   * @param {object} options
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async createOffer(options = {}) {
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection has not been initialized');
    }

    const hasVideo = options.video ?? (this.callType === 'video' || (this.localStream && this.localStream.getVideoTracks().length > 0));

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: Boolean(hasVideo)
    });

    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Process SDP Offer and Create SDP Answer (Receiver)
   * @param {string|object} offerSdp 
   * @returns {Promise<RTCSessionDescriptionInit>}
   */
  async handleOffer(offerSdp) {
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection has not been initialized');
    }

    const description = typeof offerSdp === 'string'
      ? { type: 'offer', sdp: offerSdp }
      : offerSdp;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    this.isRemoteDescriptionSet = true;
    await this.flushQueuedCandidates();

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Process SDP Answer (Caller)
   * @param {string|object} answerSdp 
   */
  async handleAnswer(answerSdp) {
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection has not been initialized');
    }

    const description = typeof answerSdp === 'string'
      ? { type: 'answer', sdp: answerSdp }
      : answerSdp;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    this.isRemoteDescriptionSet = true;
    await this.flushQueuedCandidates();
  }

  /**
   * Add ICE candidate received from peer (buffers candidate if remote description not yet set)
   * @param {RTCIceCandidateInit} candidate 
   */
  async addIceCandidate(candidate) {
    if (!candidate) return;

    if (this.peerConnection && this.isRemoteDescriptionSet) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Failed to add ICE candidate:', err.message);
      }
    } else {
      this.queuedCandidates.push(candidate);
    }
  }

  /**
   * Flush queued candidates once remote description is set
   */
  async flushQueuedCandidates() {
    if (!this.peerConnection || !this.isRemoteDescriptionSet) return;

    while (this.queuedCandidates.length > 0) {
      const candidate = this.queuedCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Error flushing candidate:', err.message);
      }
    }
  }

  /**
   * Mute or unmute local microphone track
   * @param {boolean} isMuted 
   */
  setMicrophoneMuted(isMuted) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }

  /**
   * Enable or disable local camera video track
   * @param {boolean} enabled 
   */
  setCameraEnabled(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Get list of available video input devices (cameras)
   * @returns {Promise<MediaDeviceInfo[]>}
   */
  async getVideoInputDevices() {
    try {
      const mediaDevices = this.getMediaDevices();
      if (!mediaDevices || !mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput');
    } catch (_) {
      return [];
    }
  }

  /**
   * Switch camera (e.g. front/rear on mobile or different webcams)
   * Uses RTCRtpSender.replaceTrack() to switch seamlessly without renegotiation
   * @param {string} deviceId 
   * @returns {Promise<MediaStreamTrack>}
   */
  async switchCamera(deviceId) {
    const mediaDevices = this.getMediaDevices();
    if (!mediaDevices || !mediaDevices.getUserMedia) {
      throw new Error('Camera switching not supported');
    }

    const videoSender = this.peerConnection
      ?.getSenders()
      .find((s) => s.track && s.track.kind === 'video');

    const constraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: this.currentFacingMode === 'user' ? 'environment' : 'user' };

    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...constraints,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    const newTrack = newStream.getVideoTracks()[0];
    if (!newTrack) {
      throw new Error('Could not acquire new camera track');
    }

    // Toggle current facing mode state
    if (!deviceId) {
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    }

    // Replace track on RTCPeerConnection sender
    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
    }

    // Replace track in localStream
    if (this.localStream) {
      const oldTrack = this.localStream.getVideoTracks()[0];
      if (oldTrack) {
        this.localStream.removeTrack(oldTrack);
        try {
          oldTrack.stop();
        } catch (_) {}
      }
      this.localStream.addTrack(newTrack);
    }

    return newTrack;
  }

  /**
   * Start screen sharing
   * @param {function} onEndedCallback Callback when user clicks native "Stop sharing"
   * @returns {Promise<MediaStreamTrack>}
   */
  async startScreenShare(onEndedCallback) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported on this browser or platform');
    }

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: false
    });

    const screenTrack = displayStream.getVideoTracks()[0];
    if (!screenTrack) {
      throw new Error('No screen video track captured');
    }

    this.screenStream = displayStream;

    // Save existing camera track to restore later
    if (this.localStream) {
      this.savedCameraTrack = this.localStream.getVideoTracks()[0] || null;
    }

    // Replace video track on sender
    const videoSender = this.peerConnection
      ?.getSenders()
      .find((s) => s.track && s.track.kind === 'video');

    if (videoSender) {
      await videoSender.replaceTrack(screenTrack);
    }

    // Update local stream track reference
    if (this.localStream && this.savedCameraTrack) {
      this.localStream.removeTrack(this.savedCameraTrack);
      this.localStream.addTrack(screenTrack);
    }

    // Handle user clicking native browser "Stop sharing" banner
    screenTrack.onended = () => {
      this.stopScreenShare();
      if (typeof onEndedCallback === 'function') {
        onEndedCallback();
      }
    };

    return screenTrack;
  }

  /**
   * Stop screen sharing and restore camera video track
   */
  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      this.screenStream = null;
    }

    const videoSender = this.peerConnection
      ?.getSenders()
      .find((s) => s.track && s.track.kind === 'video');

    if (this.savedCameraTrack) {
      if (videoSender) {
        try {
          await videoSender.replaceTrack(this.savedCameraTrack);
        } catch (e) {
          console.warn('[WebRTC] Error restoring camera track on sender:', e);
        }
      }

      if (this.localStream) {
        const currentVideo = this.localStream.getVideoTracks()[0];
        if (currentVideo) {
          this.localStream.removeTrack(currentVideo);
        }
        this.localStream.addTrack(this.savedCameraTrack);
      }

      this.savedCameraTrack = null;
    }
  }

  /**
   * Toggle Picture-in-Picture on a HTMLVideoElement
   * @param {HTMLVideoElement} videoElement
   * @returns {Promise<boolean>} Whether PiP is currently active
   */
  async togglePictureInPicture(videoElement) {
    if (!document.pictureInPictureEnabled || !videoElement) {
      return false;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return false;
      } else {
        await videoElement.requestPictureInPicture();
        return true;
      }
    } catch (err) {
      console.warn('[WebRTC] Picture-in-Picture error:', err.message);
      return false;
    }
  }

  /**
   * Toggle Fullscreen on a container element
   * @param {HTMLElement} element
   * @returns {Promise<boolean>}
   */
  async toggleFullscreen(element) {
    if (!element) return false;
    try {
      if (!document.fullscreenElement) {
        if (element.requestFullscreen) {
          await element.requestFullscreen();
          return true;
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
          return true;
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          return false;
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
          return false;
        }
      }
      return false;
    } catch (err) {
      console.warn('[WebRTC] Fullscreen error:', err.message);
      return false;
    }
  }

  /**
   * Get list of available audio output devices (speakers/headphones)
   * @returns {Promise<MediaDeviceInfo[]>}
   */
  async getAudioOutputDevices() {
    try {
      const mediaDevices = this.getMediaDevices();
      if (!mediaDevices || !mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'audiooutput');
    } catch (_) {
      return [];
    }
  }

  /**
   * Switch audio output device on HTMLAudioElement or HTMLVideoElement
   * @param {HTMLMediaElement} mediaElement 
   * @param {string} deviceId 
   * @returns {Promise<boolean>}
   */
  async setAudioOutputDevice(mediaElement, deviceId) {
    if (!mediaElement) return false;
    if (typeof mediaElement.setSinkId === 'function') {
      try {
        await mediaElement.setSinkId(deviceId);
        return true;
      } catch (err) {
        console.warn('[WebRTC] setSinkId failed:', err.message);
        return false;
      }
    }
    return false;
  }

  /**
   * Clean up local stream tracks only
   */
  cleanupLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      this.localStream = null;
    }
  }

  /**
   * Clean up peer connection only
   */
  cleanupPeerConnection() {
    if (this.peerConnection) {
      try {
        this.peerConnection.ontrack = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.close();
      } catch (_) {}
      this.peerConnection = null;
    }
    this.queuedCandidates = [];
    this.isRemoteDescriptionSet = false;
  }

  /**
   * Complete teardown and track cleanup
   */
  cleanup() {
    this.cleanupLocalStream();

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      this.screenStream = null;
    }

    if (this.savedCameraTrack) {
      try {
        this.savedCameraTrack.stop();
      } catch (_) {}
      this.savedCameraTrack = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      this.remoteStream = null;
    }

    this.cleanupPeerConnection();

    this.callType = 'audio';
  }
}

export default new WebRTCService();
