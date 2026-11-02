import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Phone,
  Settings,
  User,
  Search,
  Compass,
  UserPlus,
  CircleDashed,
  LogIn,
  X,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/utils/cn';
import Avatar from '@/components/ui/Avatar';
import Dropdown, { DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import MeltLogo from '@/components/common/MeltLogo';
import ThemeToggle from '@/components/common/ThemeToggle';

export const Sidebar = ({ isMobileOpen, setIsMobileOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { pendingRequestsCount } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');

  // Lock body scroll and listen for Escape key when mobile drawer is open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen?.(false);
      }
    };

    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, setIsMobileOpen]);

  const navItems = [
    { name: 'Dashboard', icon: SlidersHorizontal, path: '/dashboard' },
    { name: 'Chats', icon: MessageSquare, path: '/chat' },
    { name: 'Status', icon: CircleDashed, path: '/status' },
    { name: 'Discover', icon: Compass, path: '/discover' },
    { name: 'Requests', icon: UserPlus, path: '/requests', badge: pendingRequestsCount },
    { name: 'Calls', icon: Phone, path: '/calls' },
    { name: 'Profile', icon: User, path: '/profile' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/discover?q=${encodeURIComponent(searchQuery.trim())}`);
      if (setIsMobileOpen) setIsMobileOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-brand-sidebar border-r border-brand-border select-none overflow-hidden transition-colors duration-200">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-brand-border shrink-0">
        <NavLink to="/dashboard" onClick={() => setIsMobileOpen?.(false)} className="flex items-center gap-2 group min-w-0">
          <MeltLogo size="md" showBadge={true} badgeText="2.0" />
        </NavLink>

        <div className="flex items-center gap-1.5">
          <ThemeToggle size="sm" />
          {setIsMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-1.5 rounded-xl text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Search Users Input -> Redirects to /discover?q=... */}
      <div className="p-3 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search @username... ↵"
            className="w-full pl-9 pr-3 py-2 text-xs bg-brand-surface text-brand-text placeholder-brand-muted/70 rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-all shadow-sm"
          />
        </form>
      </div>

      {/* Main Navigation links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
          Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path === '/chat' && location.pathname.startsWith('/chat'));

          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
              className={({ isActive: isNavActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative min-h-[42px]',
                  isNavActive || isActive
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-glow-primary'
                    : 'text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105" />
              <span className="truncate">{item.name}</span>

              {item.badge > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0">
                  {item.badge}
                </span>
              )}

              {isActive && !item.badge && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm shrink-0" />
              )}
            </NavLink>
          );
        })}

        {/* Quick Link to Admin Portal - Strictly restricted to authorized administrators */}
        {['super_admin', 'admin', 'moderator', 'support_admin'].includes(user?.role) && (
          <>
            <div className="pt-4 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              Administration
            </div>
            <NavLink
              to="/admin/dashboard"
              onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Admin Portal</span>
            </NavLink>
          </>
        )}

        {!isAuthenticated && (
          <>
            <div className="pt-4 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              Account
            </div>

            <NavLink
              to="/login"
              onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-h-[40px]"
            >
              <LogIn className="w-4 h-4 text-violet-500 shrink-0" />
              <span>Sign In</span>
            </NavLink>

            <NavLink
              to="/register"
              onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-h-[40px]"
            >
              <UserPlus className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Create Account</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-brand-border bg-brand-surface/70 shrink-0">
        {isAuthenticated && user ? (
          <Dropdown
            align="left"
            width="w-56"
            trigger={
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group">
                <Avatar
                  name={user.full_name}
                  src={user.profile_picture}
                  size="sm"
                  status="online"
                />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-brand-text truncate group-hover:text-brand-primary">
                    {user.full_name}
                  </p>
                  <p className="text-[11px] text-brand-muted truncate">
                    @{user.username}
                  </p>
                </div>
                <Settings className="w-3.5 h-3.5 text-brand-muted group-hover:text-brand-text transition-transform group-hover:rotate-45 shrink-0" />
              </div>
            }
          >
            <div className="px-3 py-2 border-b border-brand-border">
              <p className="text-xs font-semibold text-brand-text truncate">{user.full_name}</p>
              <p className="text-[11px] text-brand-muted truncate">@{user.username}</p>
            </div>
            <DropdownItem icon={<User className="w-3.5 h-3.5" />} onClick={() => navigate('/profile')}>
              View Profile
            </DropdownItem>
            <DropdownItem icon={<Settings className="w-3.5 h-3.5" />} onClick={() => navigate('/settings')}>
              Account Settings
            </DropdownItem>
            <DropdownDivider />
            <DropdownItem
              icon={<LogIn className="w-3.5 h-3.5" />}
              variant="danger"
              onClick={handleLogout}
            >
              Log Out
            </DropdownItem>
          </Dropdown>
        ) : (
          <div className="flex items-center justify-between p-2">
            <span className="text-xs text-brand-muted">Not signed in</span>
            <NavLink
              to="/login"
              className="text-xs font-semibold text-brand-primary hover:text-brand-primary-hover"
            >
              Sign In →
            </NavLink>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col w-60 lg:w-64 h-screen shrink-0 z-20">
        {sidebarContent}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10 animate-slideRight">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
