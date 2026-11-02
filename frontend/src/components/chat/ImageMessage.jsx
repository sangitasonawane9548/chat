import React, { useState } from 'react';
import { Image as ImageIcon, Eye, AlertCircle } from 'lucide-react';
import { getAttachmentStreamUrl } from '@/services/api';

export const ImageMessage = ({ attachment, onOpenViewer }) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const imgSrc = attachment?.id
    ? getAttachmentStreamUrl(attachment.id)
    : attachment?.file_url;

  return (
    <div
      onClick={() => onOpenViewer?.(attachment)}
      className="relative rounded-xl overflow-hidden cursor-pointer group my-1 border border-brand-border/40 hover:border-brand-primary/50 transition-all max-w-full sm:max-w-[320px] inline-block bg-brand-surface/40"
    >
      {/* Loading Skeleton: compact and proportional */}
      {!loaded && !hasError && (
        <div className="w-52 max-w-full h-40 bg-brand-surface animate-pulse flex flex-col items-center justify-center text-brand-subtle gap-2">
          <ImageIcon className="w-6 h-6 opacity-40 animate-pulse text-brand-primary" />
          <span className="text-[10px] opacity-60">Loading image...</span>
        </div>
      )}

      {/* Image Element: preserves natural aspect ratio with sensible limits */}
      {!hasError && (
        <img
          src={imgSrc}
          alt={attachment?.original_filename || 'Shared image'}
          onLoad={() => setLoaded(true)}
          onError={() => setHasError(true)}
          className={`max-w-full sm:max-w-[320px] max-h-[300px] sm:max-h-[320px] w-auto h-auto object-contain rounded-xl transition-all duration-300 block ${
            loaded ? 'opacity-100 group-hover:scale-[1.01]' : 'opacity-0 absolute inset-0'
          }`}
          loading="lazy"
        />
      )}

      {/* Hover / Tap Overlay with Preview Icon */}
      {loaded && !hasError && (
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="p-2 rounded-full bg-black/60 text-white backdrop-blur-sm shadow-md">
            <Eye className="w-4 h-4" />
          </span>
        </div>
      )}

      {/* Error Fallback */}
      {hasError && (
        <div className="w-48 max-w-full p-3 bg-brand-danger/10 border border-brand-danger/30 rounded-xl flex items-center gap-2 text-xs text-brand-danger">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">Image failed to load</span>
        </div>
      )}
    </div>
  );
};

export default ImageMessage;
