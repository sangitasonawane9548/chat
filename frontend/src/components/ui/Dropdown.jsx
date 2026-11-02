import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/cn';

export const Dropdown = ({
  trigger,
  children,
  align = 'right', // left, right, center
  width = 'w-48',
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const alignmentClasses = {
    left: 'left-0 origin-top-left',
    right: 'right-0 origin-top-right',
    center: 'left-1/2 -translate-x-1/2 origin-top',
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={() => setIsOpen(false)}
            className={cn(
              'absolute top-full mt-2 z-50 p-1 bg-brand-card/95 backdrop-blur-md rounded-xl border border-brand-border shadow-glass max-w-[calc(100vw-1.5rem)]',
              alignmentClasses[align] || alignmentClasses.right,
              width,
              className
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DropdownItem = ({
  children,
  icon,
  onClick,
  variant = 'default', // default, danger
  className,
  disabled = false
}) => {
  const variants = {
    default: 'text-brand-text hover:bg-black/5 dark:hover:bg-white/5 hover:text-brand-primary',
    danger: 'text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left focus:outline-none disabled:opacity-50 disabled:pointer-events-none',
        variants[variant] || variants.default,
        className
      )}
    >
      {icon && <span className="w-4 h-4 shrink-0 text-brand-muted">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
};

export const DropdownDivider = () => (
  <div className="my-1 border-t border-brand-border" />
);

export default Dropdown;
