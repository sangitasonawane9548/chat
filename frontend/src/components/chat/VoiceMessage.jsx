import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { getAttachmentStreamUrl } from '@/services/api';

const SPEEDS = [1, 1.5, 2];

export const VoiceMessage = ({ attachment, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(attachment?.duration_seconds || 0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const audioRef = useRef(null);

  const audioSrc = attachment?.id
    ? getAttachmentStreamUrl(attachment.id)
    : attachment?.file_url;

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const mins = Math.floor(secs / 60);
    const rem = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && (!duration || duration === 0)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSpeedToggle = () => {
    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[nextIndex];
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * duration;
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 xs:gap-3 py-1 min-w-[180px] xs:min-w-[210px] sm:min-w-[240px] max-w-full select-none">
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
          isOwn
            ? 'bg-white text-brand-primary hover:bg-white/90 shadow-sm'
            : 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-glow-primary'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform Scrubber & Timers */}
      <div className="flex-1 flex flex-col gap-1.5">
        {/* Clickable Scrubber Bar with Waveform Styling */}
        <div
          onClick={handleSeek}
          className="relative h-6 flex items-center cursor-pointer group"
          title="Click to seek"
        >
          {/* Waveform Bars Background */}
          <div className="w-full flex items-center justify-between gap-0.5 h-full opacity-40">
            {[20, 45, 60, 90, 40, 70, 100, 80, 50, 30, 85, 95, 60, 40, 75, 55, 30, 65, 80, 45].map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded-full ${isOwn ? 'bg-white' : 'bg-brand-text'}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>

          {/* Active Progress Fill Overlay */}
          <div
            className="absolute left-0 top-0 bottom-0 flex items-center overflow-hidden pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="w-[200px] sm:w-[240px] flex items-center justify-between gap-0.5 h-full">
              {[20, 45, 60, 90, 40, 70, 100, 80, 50, 30, 85, 95, 60, 40, 75, 55, 30, 65, 80, 45].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full ${isOwn ? 'bg-brand-secondary' : 'bg-brand-primary'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Time Labels */}
        <div className="flex items-center justify-between text-[10px] font-mono opacity-80">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Speed Toggle */}
      <button
        type="button"
        onClick={handleSpeedToggle}
        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider transition-colors shrink-0 ${
          isOwn
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-white/10 hover:bg-white/20 text-brand-text'
        }`}
        title="Change playback speed"
      >
        {SPEEDS[speedIndex]}x
      </button>
    </div>
  );
};

export default VoiceMessage;

