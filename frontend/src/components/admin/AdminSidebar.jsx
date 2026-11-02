import React, { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  FileText,
  Sliders,
  LifeBuoy,
  X,
  ArrowLeft,
  ShieldAlert,
  Radio,
  LogOut,
  FolderGit2
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { adminLogout } from '@/services/adminApi';
import MeltLogo from '@/components/common/MeltLogo';

export const AdminSidebar = ({ isMobileOpen, setIsMobileOpen, isCollapsed, onToggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  let adminProfile = user;
  try {
    const stored = localStorage.getItem('admin_user');
    if (stored) adminProfile = JSON.parse(stored);
  } catch (e) {}

  // Escape key & body scroll lock on mobile
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

  const currentRole = adminProfile?.role || 'admin';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { name: 'Users', icon: Users, path: '/admin/users' },
    { name: 'Groups', icon: FolderGit2, path: '/admin/groups' },
    { name: 'Reports', icon: AlertTriangle, path: '/admin/reports', badge: '4', roles: ['super_admin', 'admin', 'moderator'] },
    { name: 'Moderation', icon: ShieldCheck, path: '/admin/moderation', roles: ['super_admin', 'admin', 'moderator'] },
    { name: 'Analytics', icon: BarChart3, path: '/admin/analytics', roles: ['super_admin', 'admin', 'moderator'] },
    { name: 'Audit Logs', icon: FileText, path: '/admin/audit-logs', roles: ['super_admin', 'admin'] },
    { name: 'Support', icon: LifeBuoy, path: '/admin/support' },
    { name: 'Settings', icon: Sliders, path: '/admin/settings', roles: ['super_admin', 'admin'] },
  ].filter((item) => !item.roles || item.roles.includes(currentRole));

  const sidebarContent = (
    <div className="flex flex-col h-full bg-brand-sidebar border-r border-brand-border select-none overflow-hidden transition-colors duration-200">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-brand-border shrink-0">
        <NavLink to="/admin/dashboard" onClick={() => setIsMobileOpen?.(false)} className="flex items-center gap-2 min-w-0 group">
          <MeltLogo size="sm" variant="admin" showBadge={true} badgeText="ROOT" />
        </NavLink>

        <div className="flex items-center gap-1.5">
          {setIsMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close admin menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Return to Chat Link */}
      <div className="p-3 shrink-0">
        <NavLink
          to="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/20 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to MELT</span>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-subtle">
          Admin Management
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path === '/admin/dashboard' && location.pathname === '/admin');

          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group min-h-[42px]',
                isActive
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-sm'
                  : 'text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5'
              )}
            >
              <Icon className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110" />
              <span className="truncate">{item.name}</span>

              {item.badge && (
                <span className="ml-auto px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-black shrink-0">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Admin User Footer */}
      <div className="p-3 border-t border-brand-border bg-[#0B0D12]/70 shrink-0 flex items-center justify-between text-xs">
        <div className="min-w-0 pr-2">
          <p className="font-semibold text-white truncate text-[11px]">{adminProfile?.full_name || 'Admin User'}</p>
          <p className="text-[10px] text-amber-400 font-mono truncate capitalize">Role: {adminProfile?.role?.replace('_', ' ') || 'Admin'}</p>
        </div>
        <button
          onClick={async () => {
            await adminLogout();
            logout();
            navigate('/admin/login');
          }}
          className="p-1.5 rounded-lg text-brand-subtle hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
          title="Sign out of Admin"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col w-56 lg:w-64 h-screen shrink-0 z-20">
        {sidebarContent}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
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

export default AdminSidebar;

