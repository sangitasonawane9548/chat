import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  MessageSquare,
  Plus,
  Phone,
  User
} from 'lucide-react';
import { useCall } from '@/context/CallContext';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useSocket } from '@/context/SocketContext';
import { cn } from '@/utils/cn';

/**
 * MobileFloatingNav
 * A premium, floating bottom navigation bar for mobile devices.
 * Features 5 positions with an elevated, glowing center action button
 * for starting new conversations.
 */
export const MobileFloatingNav = ({
  hasActiveChat = false,
  isMobileDrawerOpen = false
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { callStatus, isMinimized } = useCall?.() || {};
  const { isKeyboardOpen } = useVisualViewport();
  const { pendingRequestsCount } = useSocket?.() || {};

  // Visibility Guards:
  // Hide if desktop, inside active chat room, mobile keyboard open, active fullscreen call, or drawer open
  const isCallActive = callStatus && callStatus !== 'idle' && !isMinimized;
  const isHidden = hasActiveChat || isKeyboardOpen || isCallActive || isMobileDrawerOpen;

  if (isHidden) {
    return null;
  }

  // Active state calculations
  const pathname = location.pathname;
  const isHomeActive = pathname === '/dashboard' || pathname === '/';
  const isChatsActive = pathname === '/chat';
  const isNewChatActive = pathname === '/discover';
  const isCallsActive = pathname.startsWith('/calls');
  const isProfileActive = pathname.startsWith('/profile') || pathname.startsWith('/settings');

  const handleNavigation = (path) => {
    if (pathname === path) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(path);
    }
  };

  const handleNewChatClick = () => {
    if (pathname === '/discover') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const searchInput = document.querySelector('input[type="text"]');
      if (searchInput) searchInput.focus();
    } else {
      navigate('/discover');
    }
  };

  return (
    <aside
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed left-0 right-0 z-40 flex justify-center pointer-events-none px-3"
      style={{
        bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))'
      }}
    >
      <motion.nav
        initial={{ y: 25, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 25, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className={cn(
          "pointer-events-auto",
          "w-full max-w-[370px] xs:max-w-[390px] sm:max-w-[420px]",
          "h-[64px] sm:h-[68px]",
          "rounded-full",
          "bg-brand-surface/92 dark:bg-[#151522]/92",
          "backdrop-blur-2xl",
          "border border-brand-border/80 dark:border-white/10",
          "shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12),0_4px_16px_rgba(139,92,246,0.08)]",
          "dark:shadow-[0_16px_40px_-6px_rgba(0,0,0,0.7),0_4px_24px_rgba(139,92,246,0.15)]",
          "flex items-center justify-between",
          "px-2 xs:px-3 sm:px-4",
          "relative"
        )}
      >
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => handleNavigation('/dashboard')}
          aria-label="Home Dashboard"
          className={cn(
            "flex-1 min-w-[44px] h-full flex flex-col items-center justify-center gap-0.5 relative",
            "text-xs transition-colors duration-200 select-none",
            "active:scale-95 focus:outline-none"
          )}
        >
          <motion.div
            animate={{ scale: isHomeActive ? 1.08 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              "p-1 rounded-xl transition-colors",
              isHomeActive
                ? "text-brand-primary dark:text-[#A78BFA]"
                : "text-brand-muted hover:text-brand-text"
            )}
          >
            <Home className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={isHomeActive ? 2.5 : 2} />
          </motion.div>
          <span
            className={cn(
              "text-[10px] tracking-tight leading-none transition-colors",
              isHomeActive
                ? "text-brand-primary dark:text-[#A78BFA] font-semibold"
                : "text-brand-muted font-medium"
            )}
          >
            Home
          </span>
          {isHomeActive && (
            <motion.span
              layoutId="mobileFloatingNavDot"
              className="w-1 h-1 rounded-full bg-brand-primary dark:bg-[#A78BFA] shadow-[0_0_6px_rgba(139,92,246,0.8)] mt-0.5"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </button>

        {/* 2. Chats */}
        <button
          type="button"
          onClick={() => handleNavigation('/chat')}
          aria-label="Direct Conversations"
          className={cn(
            "flex-1 min-w-[44px] h-full flex flex-col items-center justify-center gap-0.5 relative",
            "text-xs transition-colors duration-200 select-none",
            "active:scale-95 focus:outline-none"
          )}
        >
          <motion.div
            animate={{ scale: isChatsActive ? 1.08 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              "p-1 rounded-xl transition-colors relative",
              isChatsActive
                ? "text-brand-primary dark:text-[#A78BFA]"
                : "text-brand-muted hover:text-brand-text"
            )}
          >
            <MessageSquare className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={isChatsActive ? 2.5 : 2} />
            {pendingRequestsCount > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-brand-surface dark:ring-[#151522]" />
            )}
          </motion.div>
          <span
            className={cn(
              "text-[10px] tracking-tight leading-none transition-colors",
              isChatsActive
                ? "text-brand-primary dark:text-[#A78BFA] font-semibold"
                : "text-brand-muted font-medium"
            )}
          >
            Chats
          </span>
          {isChatsActive && (
            <motion.span
              layoutId="mobileFloatingNavDot"
              className="w-1 h-1 rounded-full bg-brand-primary dark:bg-[#A78BFA] shadow-[0_0_6px_rgba(139,92,246,0.8)] mt-0.5"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </button>

        {/* 3. Center Elevated Action Button (New Chat) */}
        <div className="relative -top-3.5 sm:-top-4 flex flex-col items-center justify-center shrink-0 px-1">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92, rotate: 90 }}
            onClick={handleNewChatClick}
            aria-label="New Chat or Discovery"
            className={cn(
              "w-[50px] h-[50px] sm:w-[54px] sm:h-[54px]",
              "rounded-full",
              "bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-500",
              "text-white",
              "flex items-center justify-center",
              "shadow-[0_8px_24px_-2px_rgba(139,92,246,0.55)]",
              "hover:shadow-[0_10px_28px_rgba(139,92,246,0.7)]",
              "ring-4 ring-brand-bg dark:ring-[#101018]",
              "active:ring-brand-primary/40",
              "transition-all duration-200 focus:outline-none cursor-pointer"
            )}
          >
            <Plus className="w-6 h-6 stroke-[2.75] text-white" />
          </motion.button>
          <span
            className={cn(
              "text-[10px] tracking-tight font-semibold mt-0.5 leading-none transition-colors",
              isNewChatActive ? "text-brand-primary dark:text-[#A78BFA]" : "text-brand-muted"
            )}
          >
            New
          </span>
        </div>

        {/* 4. Calls */}
        <button
          type="button"
          onClick={() => handleNavigation('/calls')}
          aria-label="Voice and Video Calls"
          className={cn(
            "flex-1 min-w-[44px] h-full flex flex-col items-center justify-center gap-0.5 relative",
            "text-xs transition-colors duration-200 select-none",
            "active:scale-95 focus:outline-none"
          )}
        >
          <motion.div
            animate={{ scale: isCallsActive ? 1.08 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              "p-1 rounded-xl transition-colors",
              isCallsActive
                ? "text-brand-primary dark:text-[#A78BFA]"
                : "text-brand-muted hover:text-brand-text"
            )}
          >
            <Phone className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={isCallsActive ? 2.5 : 2} />
          </motion.div>
          <span
            className={cn(
              "text-[10px] tracking-tight leading-none transition-colors",
              isCallsActive
                ? "text-brand-primary dark:text-[#A78BFA] font-semibold"
                : "text-brand-muted font-medium"
            )}
          >
            Calls
          </span>
          {isCallsActive && (
            <motion.span
              layoutId="mobileFloatingNavDot"
              className="w-1 h-1 rounded-full bg-brand-primary dark:bg-[#A78BFA] shadow-[0_0_6px_rgba(139,92,246,0.8)] mt-0.5"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </button>

        {/* 5. Profile */}
        <button
          type="button"
          onClick={() => handleNavigation('/profile')}
          aria-label="User Profile"
          className={cn(
            "flex-1 min-w-[44px] h-full flex flex-col items-center justify-center gap-0.5 relative",
            "text-xs transition-colors duration-200 select-none",
            "active:scale-95 focus:outline-none"
          )}
        >
          <motion.div
            animate={{ scale: isProfileActive ? 1.08 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
              "p-1 rounded-xl transition-colors",
              isProfileActive
                ? "text-brand-primary dark:text-[#A78BFA]"
                : "text-brand-muted hover:text-brand-text"
            )}
          >
            <User className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={isProfileActive ? 2.5 : 2} />
          </motion.div>
          <span
            className={cn(
              "text-[10px] tracking-tight leading-none transition-colors",
              isProfileActive
                ? "text-brand-primary dark:text-[#A78BFA] font-semibold"
                : "text-brand-muted font-medium"
            )}
          >
            Profile
          </span>
          {isProfileActive && (
            <motion.span
              layoutId="mobileFloatingNavDot"
              className="w-1 h-1 rounded-full bg-brand-primary dark:bg-[#A78BFA] shadow-[0_0_6px_rgba(139,92,246,0.8)] mt-0.5"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      </motion.nav>
    </aside>
  );
};

export default MobileFloatingNav;
