import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

export const AdminLayout = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname) => {
    if (pathname.includes('/admin/users')) return 'User Accounts';
    if (pathname.includes('/admin/groups')) return 'Group Management';
    if (pathname.includes('/admin/reports')) return 'Reports & Moderation';
    if (pathname.includes('/admin/moderation')) return 'Content Filters';
    if (pathname.includes('/admin/analytics')) return 'System Analytics';
    if (pathname.includes('/admin/audit-logs')) return 'Security Audit Logs';
    if (pathname.includes('/admin/support')) return 'Admin Support';
    if (pathname.includes('/admin/settings')) return 'Platform Configurations';
    return 'Dashboard Overview';
  };

  return (
    <div className="flex h-screen w-full bg-brand-bg text-brand-text overflow-hidden transition-colors duration-200">
      {/* Responsive Left Admin Sidebar */}
      <AdminSidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Admin Viewport */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <AdminHeader
          title={getPageTitle(location.pathname)}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

