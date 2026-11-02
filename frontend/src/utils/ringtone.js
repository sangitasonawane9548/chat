/**
 * Web Audio API Ringtone Synthesizer
 * Generates smooth, pleasant audio tones for incoming and outgoing calls
 * without relying on external audio assets or network requests.
 */

class RingtoneManager {
  constructor() {
    this.audioCtx = null;
    this.intervalId = null;
    this.timeoutIds = [];
    this.activeNodes = [];
    this.isMuted = false;
    this.isPlaying = false;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Play a dual-tone frequency burst
   */
  playTone(freq1, freq2, durationMs, gainLevel = 0.1) {
    if (this.isMuted || !this.isPlaying) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq1, ctx.currentTime);
      osc2.frequency.setValueAtTime(freq2, ctx.currentTime);

      gainNode.gain.setValueAtTime(gainLevel, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      const nodeRef = { osc1, osc2, gainNode };
      this.activeNodes.push(nodeRef);

      const cleanupNode = () => {
        try {
          osc1.disconnect();
          osc2.disconnect();
          gainNode.disconnect();
        } catch (_) {}
        this.activeNodes = this.activeNodes.filter((n) => n !== nodeRef);
      };

      osc1.onended = cleanupNode;

      osc1.start();
      osc2.start();

      osc1.stop(ctx.currentTime + durationMs / 1000);
      osc2.stop(ctx.currentTime + durationMs / 1000);
    } catch (_) {}
  }

  /**
   * Play rhythmic incoming call chime (repeating melodic bell)
   */
  startIncoming() {
    this.stop();
    this.isPlaying = true;

    const playChimeSequence = () => {
      if (!this.isPlaying) return;
      this.playTone(523.25, 659.25, 300, 0.15); // C5 & E5
      const tid = setTimeout(() => {
        if (!this.isPlaying) return;
        this.playTone(659.25, 783.99, 450, 0.15); // E5 & G5
        this.timeoutIds = this.timeoutIds.filter((id) => id !== tid);
      }, 350);
      this.timeoutIds.push(tid);
    };

    playChimeSequence();
    this.intervalId = setInterval(playChimeSequence, 2400);
  }

  /**
   * Play subtle standard outgoing ringing tone (two bursts every 3 seconds)
   */
  startOutgoing() {
    this.stop();
    this.isPlaying = true;

    const playBurst = () => {
      if (!this.isPlaying) return;
      this.playTone(440, 480, 800, 0.08); // A4 & B4
    };

    playBurst();
    this.intervalId = setInterval(playBurst, 3000);
  }

  setMuted(muted) {
    this.isMuted = muted;
  }

  stop() {
    this.isPlaying = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.timeoutIds && this.timeoutIds.length > 0) {
      this.timeoutIds.forEach((id) => clearTimeout(id));
      this.timeoutIds = [];
    }

    if (this.activeNodes && this.activeNodes.length > 0) {
      this.activeNodes.forEach(({ osc1, osc2, gainNode }) => {
        try {
          osc1.stop();
          osc1.disconnect();
          osc2.stop();
          osc2.disconnect();
          gainNode.disconnect();
        } catch (_) {}
      });
      this.activeNodes = [];
    }
  }
}

export default new RingtoneManager();

