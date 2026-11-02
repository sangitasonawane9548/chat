import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, AlertCircle } from 'lucide-react';
import { notify } from '@/components/common/ToastProvider';

export const VoiceRecorder = ({ onSendVoice, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const previewAudioRef = useRef(null);
  const streamRef = useRef(null);

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // Start recording on component mount
  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const startRecording = async () => {
    try {
      setHasPermissionError(false);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select supported audio mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setIsRecording(false);
      };

      mediaRecorder.start(200); // 200ms slices
      setIsRecording(true);
      setDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => {
          // Cap voice message at 5 minutes (300 seconds)
          if (prev >= 300) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('[VoiceRecorder] Microphone permission denied or unsupported:', err);
      setHasPermissionError(true);
      notify.error('Microphone access is required to record voice notes');
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  const togglePreviewPlayback = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const handleSend = () => {
    if (!audioBlob) return;
    onSendVoice(audioBlob, duration || 1);
    cleanup();
  };

  const handleCancel = () => {
    cleanup();
    onCancel?.();
  };

  if (hasPermissionError) {
    return (
      <div className="flex items-center justify-between w-full p-2.5 bg-brand-danger/10 border border-brand-danger/30 rounded-2xl animate-fade-in text-xs text-brand-danger">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Microphone access was denied. Please allow microphone permissions in your browser.</span>
        </div>
        <button
          onClick={handleCancel}
          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors ml-2 shrink-0"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full px-2 xs:px-3 py-1.5 bg-brand-surface border border-brand-primary/40 rounded-2xl shadow-glow-primary/20 animate-fade-in gap-2 xs:gap-3 transition-colors duration-200">
      {/* Recording State */}
      {isRecording ? (
        <>
          <div className="flex items-center gap-2 xs:gap-3 min-w-0">
            <div className="relative flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute" />
              <span className="w-3 h-3 rounded-full bg-red-500 relative" />
            </div>

            {/* Live Waveform Pulse Simulation */}
            <div className="flex items-center gap-0.5 h-6">
              {[40, 75, 55, 90, 60, 30, 80, 100, 45, 70, 85, 40].map((h, i) => (
                <span
                  key={i}
                  className="w-1 bg-brand-primary rounded-full transition-all duration-300"
                  style={{
                    height: `${Math.max(20, (h * (0.6 + Math.random() * 0.4)))}%`,
                    animation: `pulse 0.8s ease-in-out infinite alternate ${i * 0.08}s`
                  }}
                />
              ))}
            </div>

            <span className="text-xs font-mono font-medium text-brand-text">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Discard */}
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 rounded-xl text-brand-subtle hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
              title="Discard recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Stop & Review */}
            <button
              type="button"
              onClick={stopRecording}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Stop recording"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Done</span>
            </button>
          </div>
        </>
      ) : (
        /* Preview State (Recorded & Stopped) */
        <>
          <div className="flex items-center gap-3 flex-1">
            {/* Play/Pause Preview */}
            <button
              type="button"
              onClick={togglePreviewPlayback}
              className="p-2 rounded-xl bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 transition-colors"
              title={isPlayingPreview ? 'Pause preview' : 'Play preview'}
            >
              {isPlayingPreview ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {audioUrl && (
              <audio
                ref={previewAudioRef}
                src={audioUrl}
                onEnded={() => setIsPlayingPreview(false)}
                className="hidden"
              />
            )}

            <div className="flex-1">
              <div className="text-xs font-medium text-brand-text">Voice Message Preview</div>
              <div className="text-[10px] font-mono text-brand-subtle">{formatTime(duration)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Discard */}
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 rounded-xl text-brand-subtle hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
              title="Discard"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Send */}
            <button
              type="button"
              onClick={handleSend}
              className="px-3 py-1.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover shadow-glow-primary transition-all flex items-center gap-1.5 text-xs font-medium"
              title="Send voice note"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceRecorder;

