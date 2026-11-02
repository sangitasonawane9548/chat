import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Shield, ExternalLink, Search, RefreshCw, Check, CheckCircle2 } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import ThemeToggle from '@/components/common/ThemeToggle';
import Dropdown, { DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { getAdminNotifications, markAdminNotificationsRead } from '@/services/adminApi';

export const AdminHeader = ({ onOpenMobileMenu, title = 'Admin Overview' }) => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminNotifications, setAdminNotifications] = useState([]);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await getAdminNotifications();
        if (res.success) {
          setUnreadCount(res.unreadCount || 0);
          setAdminNotifications(
            (res.notifications || []).slice(0, 10).map((n) => ({
              id: n.id,
              title: n.title,
              text: n.message,
              time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              unread: !n.is_read
            }))
          );
        }
      } catch (err) {
        console.warn('Failed to load notifications', err);
      }
    };
    fetchNotifs();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAdminNotificationsRead();
      setAdminNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark read', err);
    }
  };

  return (
    <header className="h-14 border-b border-brand-border bg-brand-surface/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-10 shrink-0 select-none transition-colors duration-200">
      {/* Left: Mobile Menu & Breadcrumb Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none shrink-0"
          aria-label="Open Admin Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline text-xs font-semibold uppercase text-brand-subtle tracking-wider">
            Admin
          </span>
          <span className="hidden sm:inline text-brand-subtle">/</span>
          <h1 className="text-sm sm:text-base font-bold text-brand-text tracking-tight truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">
            {title}
          </h1>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* System Health Pill */}
        <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px]">System Online</span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle variant="icon" />

        {/* Admin Alerts Dropdown */}
        <Dropdown
          align="right"
          width="w-72 sm:w-80"
          trigger={
            <button
              className="p-2 rounded-xl text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative focus:outline-none"
              aria-label="Admin notifications"
            >
              <Bell className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-black">
                  {unreadCount}
                </span>
              )}
            </button>
          }
        >
          <div className="p-3 border-b border-brand-border flex items-center justify-between">
            <h4 className="text-xs font-bold text-brand-text">Security & Audit Alerts</h4>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[10px] text-amber-500 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Mark read</span>
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-brand-border/40">
            {adminNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                  notif.unread ? 'bg-amber-500/5' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="font-semibold text-brand-text text-[11px] truncate flex-1">{notif.title}</span>
                  <span className="text-[10px] text-brand-subtle shrink-0">{notif.time}</span>
                </div>
                <p className="text-brand-muted text-[11px] leading-relaxed break-words">{notif.text}</p>
              </div>
            ))}
          </div>

          <DropdownDivider />
          <div className="p-2 text-center">
            <button
              onClick={() => navigate('/admin/audit-logs')}
              className="text-[11px] text-amber-500 dark:text-amber-400 hover:underline font-semibold"
            >
              View Full Audit Log →
            </button>
          </div>
        </Dropdown>
      </div>
    </header>
  );
};

export default AdminHeader;

