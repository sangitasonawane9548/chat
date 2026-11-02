import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/utils/cn';

/**
 * Premium MELT Theme Toggle Button
 * Tactile micro-interactions with smooth icon rotation and glow
 */
export const ThemeToggle = ({
  size = 'md',
  className = '',
  showLabel = false,
  variant = 'icon' // 'icon' | 'pill'
}) => {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-10 h-10 text-base'
  }[size] || 'w-9 h-9 text-sm';

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }[size] || 'w-4 h-4';

  if (variant === 'pill') {
    return (
      <div className={cn('inline-flex items-center p-1 rounded-full bg-brand-surface border border-brand-border select-none shadow-sm', className)}>
        {[
          { id: 'light', icon: Sun, label: 'Light' },
          { id: 'dark', icon: Moon, label: 'Dark' },
          { id: 'system', icon: Laptop, label: 'Auto' }
        ].map((item) => {
          const Icon = item.icon;
          const active = theme === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTheme(item.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                active
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      onClick={toggleTheme}
      type="button"
      className={cn(
        'relative inline-flex items-center justify-center rounded-xl border transition-colors select-none',
        'bg-brand-surface hover:bg-brand-card border-brand-border hover:border-brand-border-strong text-brand-muted hover:text-brand-text shadow-sm',
        sizeClasses,
        className
      )}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className={cn(iconSizes, 'text-violet-400')} />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className={cn(iconSizes, 'text-amber-500')} />
          </motion.div>
        )}
      </AnimatePresence>
      {showLabel && (
        <span className="ml-2 text-xs font-medium capitalize">
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </motion.button>
  );
};

export default ThemeToggle;

