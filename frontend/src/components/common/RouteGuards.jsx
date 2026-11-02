import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthLoading from '@/components/auth/AuthLoading';
import { getAdminMe } from '@/services/adminApi';
import AdminAccessDenied from '@/pages/admin/AdminAccessDenied';

const ADMIN_ROLES = ['super_admin', 'admin', 'moderator', 'support_admin'];

/**
 * 1. ProtectedUserRoute
 * Ensures the user has an active, verified user session before entering user chat areas.
 */
export const ProtectedUserRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading message="Verifying session credentials..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && !user.email_verified) {
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
  }

  return children || <Outlet />;
};

/**
 * 2. ProtectedAdminRoute
 * Strictly validates administrative clearance with the server before rendering any admin content.
 * Prevents flashing of sensitive admin UI, rejects standard users (HTTP 403),
 * and redirects unauthenticated users to /admin/login (HTTP 401).
 */
export const ProtectedAdminRoute = ({ children, requiredRole = null, requiredPermission = null }) => {
  const location = useLocation();
  const [authStatus, setAuthStatus] = useState({
    loading: true,
    authorized: false,
    admin: null,
    errorType: null // 'unauthenticated' | 'forbidden'
  });

  useEffect(() => {
    let isMounted = true;

    const verifyAdmin = async () => {
      try {
        setAuthStatus((prev) => ({ ...prev, loading: true }));
        const res = await getAdminMe();

        if (!isMounted) return;

        if (res?.success && res?.admin) {
          const role = res.admin.role;

          // 1. Role verification
          if (!ADMIN_ROLES.includes(role)) {
            setAuthStatus({
              loading: false,
              authorized: false,
              admin: res.admin,
              errorType: 'forbidden'
            });
            return;
          }

          // 2. Specific role requirement check
          if (requiredRole && role !== 'super_admin' && role !== requiredRole) {
            setAuthStatus({
              loading: false,
              authorized: false,
              admin: res.admin,
              errorType: 'forbidden'
            });
            return;
          }

          // 3. Specific permission requirement check
          if (requiredPermission && role !== 'super_admin') {
            const permissions = res.admin.permissions || [];
            const hasPerm = permissions.includes('*') || permissions.includes(requiredPermission);
            if (!hasPerm) {
              setAuthStatus({
                loading: false,
                authorized: false,
                admin: res.admin,
                errorType: 'forbidden'
              });
              return;
            }
          }

          setAuthStatus({
            loading: false,
            authorized: true,
            admin: res.admin,
            errorType: null
          });
        } else {
          setAuthStatus({
            loading: false,
            authorized: false,
            admin: null,
            errorType: 'unauthenticated'
          });
        }
      } catch (err) {
        if (!isMounted) return;
        const isForbidden = err?.status === 403 || err?.data?.code === 'FORBIDDEN_NOT_ADMIN';
        setAuthStatus({
          loading: false,
          authorized: false,
          admin: null,
          errorType: isForbidden ? 'forbidden' : 'unauthenticated'
        });
      }
    };

    verifyAdmin();

    return () => {
      isMounted = false;
    };
  }, [location.pathname, requiredRole, requiredPermission]);

  // Loading Screen: strictly blocks rendering until backend verification succeeds
  if (authStatus.loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0B0D12]">
        <div className="flex flex-col items-center gap-3 select-none">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-amber-400 tracking-wider uppercase">
            Verifying MELT Admin Authorization...
          </span>
        </div>
      </div>
    );
  }

  // Unauthenticated: redirect to Admin Login
  if (authStatus.errorType === 'unauthenticated' || !authStatus.authorized && authStatus.errorType !== 'forbidden') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Forbidden: standard user or insufficient role -> render 403 Access Denied
  if (authStatus.errorType === 'forbidden' || !authStatus.authorized) {
    return <AdminAccessDenied />;
  }

  return children || <Outlet />;
};

/**
 * 3. PermissionGuard
 * In-page component guard for rendering specific administrative sections conditionally
 */
export const PermissionGuard = ({
  role = null,
  permission = null,
  userRole = null,
  permissions = [],
  children,
  fallback = null
}) => {
  if (userRole === 'super_admin' || permissions.includes('*')) {
    return children;
  }

  if (role && userRole !== role) {
    return fallback;
  }

  if (permission && !permissions.includes(permission)) {
    return fallback;
  }

  return children;
};

export default {
  ProtectedUserRoute,
  ProtectedAdminRoute,
  PermissionGuard
};

