import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getAttachmentStreamUrl, getAttachmentDownloadUrl } from '@/services/api';

export const ImageViewer = ({ activeImage, allImages = [], onClose, onSelectImage }) => {
  const [scale, setScale] = useState(1);

  const currentIndex = allImages.findIndex((img) => img.id === activeImage?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < allImages.length - 1;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setScale(1);

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      setScale(1);
      onSelectImage?.(allImages[currentIndex - 1]);
    }
  }, [hasPrev, allImages, currentIndex, onSelectImage]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      setScale(1);
      onSelectImage?.(allImages[currentIndex + 1]);
    }
  }, [hasNext, allImages, currentIndex, onSelectImage]);

  // Keyboard navigation & Esc listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext]);

  if (!activeImage) return null;

  const imageUrl = activeImage.id
    ? getAttachmentStreamUrl(activeImage.id)
    : activeImage.file_url;

  const downloadUrl = activeImage.id
    ? getAttachmentDownloadUrl(activeImage.id)
    : imageUrl;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 backdrop-blur-md p-4 select-none"
      >
        {/* Top Toolbar */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="text-xs text-white/80 font-medium truncate max-w-[120px] xs:max-w-[200px] sm:max-w-sm">
            {activeImage.original_filename || activeImage.file_name || 'Image Preview'}
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <button
              onClick={handleZoomOut}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-white/60 min-w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Reset zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-white/20 mx-1" />

            {/* Download */}
            <a
              href={downloadUrl}
              download={activeImage.original_filename || 'image'}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors ml-2"
              title="Close viewer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Central Image Container with Zoom & Drag */}
        <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
          {/* Navigation Prev Button */}
          {hasPrev && (
            <button
              onClick={handlePrev}
              className="absolute left-4 p-3 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/80 transition-all z-20 backdrop-blur-sm"
              title="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <motion.img
            src={imageUrl}
            alt={activeImage.original_filename || 'Preview'}
            className="max-h-[82vh] max-w-[88vw] object-contain rounded-lg transition-transform duration-200 cursor-grab active:cursor-grabbing"
            style={{ transform: `scale(${scale})` }}
            draggable={false}
          />

          {/* Navigation Next Button */}
          {hasNext && (
            <button
              onClick={handleNext}
              className="absolute right-4 p-3 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/80 transition-all z-20 backdrop-blur-sm"
              title="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-white/50 z-10">
          Use arrow keys to navigate • Esc to close
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageViewer;

