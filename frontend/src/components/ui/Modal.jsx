import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-md',
  className
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={cn(
              'relative w-full max-h-[calc(100dvh-2rem)] bg-brand-card border border-brand-border rounded-2xl shadow-glass overflow-hidden z-10 flex flex-col',
              maxWidth,
              className
            )}
          >
            {/* Modal Header */}
            {(title || onClose) && (
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-brand-border shrink-0">
                <div className="min-w-0 pr-3">
                  {title && (
                    <h3 className="text-sm sm:text-base font-semibold text-brand-text truncate">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-xs text-brand-muted mt-0.5 line-clamp-2">
                      {description}
                    </p>
                  )}
                </div>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none shrink-0"
                    aria-label="Close modal"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Modal Body */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 flex-1 overflow-y-auto min-h-0">
              {children}
            </div>

            {/* Modal Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-2.5 px-4 sm:px-6 py-3 sm:py-3.5 bg-black/20 border-t border-brand-border shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
