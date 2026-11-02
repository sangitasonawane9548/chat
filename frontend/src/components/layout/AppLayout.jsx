import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileFloatingNav from './MobileFloatingNav';
import { useVisualViewport } from '@/hooks/useVisualViewport';

export const AppLayout = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const { viewportHeight, isKeyboardOpen } = useVisualViewport();

  const isChatRoute = location.pathname === '/chat';
  const searchParams = new URLSearchParams(location.search);
  const hasActiveChat = isChatRoute && Boolean(searchParams.get('c'));

  const getPageTitle = (pathname) => {
    if (pathname.includes('/profile')) return 'User Profile';
    if (pathname.includes('/settings')) return 'Settings & Privacy';
    if (pathname.includes('/calls')) return 'Voice & Video Calls';
    if (pathname.includes('/chat')) return 'Direct Conversations';
    if (pathname.includes('/discover')) return 'Discover & New Chat';
    if (pathname.includes('/status')) return 'Status & Stories';
    if (pathname.includes('/requests')) return 'Chat Requests';
    return 'Chat Dashboard';
  };

  return (
    <div
      className="flex w-full bg-brand-bg text-brand-text overflow-hidden h-screen h-[100dvh]"
      style={
        isKeyboardOpen && viewportHeight
          ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` }
          : undefined
      }
    >
      {/* Responsive Left Sidebar */}
      <Sidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main View Area */}
      <div className="flex flex-col flex-1 h-full min-h-0 min-w-0 overflow-hidden relative">
        {/* On mobile, hide global header when an active conversation is open */}
        <div className={hasActiveChat ? 'hidden md:block shrink-0' : 'block shrink-0'}>
          <Header
            title={getPageTitle(location.pathname)}
            onOpenMobileMenu={() => setIsMobileOpen(true)}
          />
        </div>

        <main
          id="main-scroll-container"
          className={`flex-1 min-h-0 min-w-0 ${
            isChatRoute
              ? 'overflow-hidden'
              : 'overflow-y-auto overscroll-y-contain [webkit-overflow-scrolling:touch]'
          }`}
        >
          <Outlet />
        </main>

        {/* Floating Mobile Bottom Navigation */}
        <MobileFloatingNav
          hasActiveChat={hasActiveChat}
          isMobileDrawerOpen={isMobileOpen}
        />
      </div>
    </div>
  );
};

export default AppLayout;
