import React, { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, AlertCircle } from 'lucide-react';
import { getAttachmentStreamUrl } from '@/services/api';

export const VideoMessage = ({ attachment }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);

  const videoSrc = attachment?.id
    ? getAttachmentStreamUrl(attachment.id)
    : attachment?.file_url;

  const togglePlay = (e) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Video play interrupted', err);
      });
    }
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleFullscreen = (e) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    } else if (videoRef.current.webkitRequestFullscreen) {
      videoRef.current.webkitRequestFullscreen();
    }
  };

  if (hasError) {
    return (
      <div className="w-52 max-w-full p-3 bg-brand-danger/10 border border-brand-danger/30 rounded-xl flex items-center gap-2 text-xs text-brand-danger my-1">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="truncate">Video unavailable</span>
      </div>
    );
  }

  return (
    <div
      onClick={togglePlay}
      className="relative rounded-xl overflow-hidden my-1 bg-black/60 border border-brand-border/40 group max-w-full sm:max-w-[320px] cursor-pointer inline-block"
    >
      <video
        ref={videoRef}
        src={videoSrc}
        className="max-h-[260px] sm:max-h-[280px] w-auto max-w-full object-contain rounded-xl block"
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
        controls={false}
        playsInline
        preload="metadata"
      />

      {/* Center Play Button: always visible when paused so mobile users can tap it immediately */}
      {!isPlaying && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity">
          <button
            type="button"
            onClick={togglePlay}
            className="p-3 rounded-full bg-black/70 text-white hover:bg-brand-primary active:scale-95 transition-all shadow-glass border border-white/10"
            title="Play video"
            aria-label="Play video"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        </div>
      )}

      {/* Top Controls Overlay (Mute + Fullscreen) */}
      <div className={`absolute top-0 inset-x-0 p-2 flex justify-end gap-1.5 transition-opacity ${
        isPlaying ? 'opacity-0 hover:opacity-100 group-hover:opacity-100' : 'opacity-100'
      }`}>
        <button
          type="button"
          onClick={toggleMute}
          className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-xs"
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={handleFullscreen}
          className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-xs"
          title="Full screen"
          aria-label="Full screen"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Filename bar */}
      <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-[10px] text-white/80 truncate">
        {attachment?.original_filename || 'Video'}
      </div>
    </div>
  );
};

export default VideoMessage;
