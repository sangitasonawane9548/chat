import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Check, ExternalLink, Inbox } from 'lucide-react';
import { checkApiHealth, getNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '@/services/api';
import Tooltip from '@/components/ui/Tooltip';
import ThemeToggle from '@/components/common/ThemeToggle';
import Dropdown, { DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { useSocket } from '@/context/SocketContext';

export const Header = ({ onOpenMobileMenu, title = 'Dashboard' }) => {
  const navigate = useNavigate();
  const { unreadNotificationsCount, setUnreadNotificationsCount } = useSocket();

  const [health, setHealth] = useState({ status: 'checking', message: 'Checking API...' });
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchHealth = async () => {
      try {
        const data = await checkApiHealth();
        if (isMounted) {
          if (data.database === 'connected') {
            setHealth({ status: 'connected', message: 'API & MySQL Online' });
          } else {
            setHealth({ status: 'partial', message: 'API Online, DB Connecting...' });
          }
        }
      } catch (err) {
        if (isMounted) {
          setHealth({ status: 'disconnected', message: 'API Offline' });
        }
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const loadNotifications = async () => {
    try {
      setLoadingNotifs(true);
      const res = await getNotifications();
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadNotificationsCount(res.unreadCount || 0);
      }
    } catch (err) {
      // Ignore background notification fetch errors
    } finally {
      setLoadingNotifs(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadNotificationsCount(0);
    } catch (err) {
      // Ignore
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
        );
        setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
      } catch (e) {
        // Ignore
      }
    }

    const type = notif.notification_type || '';
    if (type.includes('chat_request')) {
      navigate('/requests');
    } else if (type.includes('message')) {
      navigate('/dashboard');
    } else if (type.includes('call')) {
      navigate('/calls');
    } else if (type.includes('status')) {
      navigate('/status');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <header className="h-14 border-b border-brand-border bg-brand-surface/85 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-10 shrink-0 select-none transition-colors duration-200">
      {/* Left: Mobile hamburger & title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none shrink-0"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-sm sm:text-base font-bold font-display text-brand-text capitalize tracking-tight truncate max-w-[140px] xs:max-w-[220px] sm:max-w-none">
          {title}
        </h1>
      </div>

      {/* Right: Health pill & notification bell */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Backend Connectivity Status Pill */}
        <Tooltip content={`Status: ${health.message}`}>
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium bg-brand-card border border-brand-border select-none shadow-sm">
            {health.status === 'connected' && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="hidden sm:inline text-brand-muted text-[11px] font-medium">Live</span>
              </>
            )}
            {health.status === 'checking' && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="hidden sm:inline text-brand-muted text-[11px]">Syncing...</span>
              </>
            )}
            {health.status === 'disconnected' && (
              <>
                <span className="w-2 h-2 rounded-full bg-brand-danger shrink-0" />
                <span className="hidden sm:inline text-brand-danger text-[11px]">API Offline</span>
              </>
            )}
          </div>
        </Tooltip>

        {/* Theme Toggle */}
        <ThemeToggle variant="icon" />

        {/* Notifications Dropdown */}
        <Dropdown
          align="right"
          width="w-72 sm:w-80"
          trigger={
            <button
              onClick={loadNotifications}
              className="p-2 rounded-xl text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative focus:outline-none"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-violet-600 text-white">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          }
        >
          <div className="p-3 border-b border-brand-border flex items-center justify-between">
            <h4 className="text-xs font-semibold text-brand-text">Notifications</h4>
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[10px] text-brand-primary hover:underline font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-brand-border/40">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                    !notif.is_read ? 'bg-violet-500/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="font-semibold text-brand-text text-[11px] truncate flex-1">{notif.title}</span>
                    <span className="text-[10px] text-brand-muted shrink-0">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-brand-muted text-[11px] leading-relaxed break-words">{notif.description}</p>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-brand-muted flex flex-col items-center gap-1">
                <Inbox className="w-5 h-5 text-brand-muted" />
                <span>No notifications yet</span>
              </div>
            )}
          </div>

          <DropdownDivider />
          <div className="p-2 text-center">
            <button
              onClick={() => navigate('/requests')}
              className="text-[11px] text-brand-primary hover:underline font-medium"
            >
              Manage Chat Requests →
            </button>
          </div>
        </Dropdown>
      </div>
    </header>
  );
};

export default Header;
