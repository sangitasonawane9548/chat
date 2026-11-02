import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthLoading from '@/components/auth/AuthLoading';

export {
  ProtectedUserRoute,
  ProtectedAdminRoute,
  PermissionGuard
} from './RouteGuards';

/**
 * Maps a verified user to their designated role dashboard
 * User -> /dashboard
 * Admin / Super Admin -> /admin/dashboard
 * Moderator -> /admin/moderation
 * Support Admin -> /admin/support
 */
export const getDashboardRouteForUser = (user) => {
  if (!user) return '/login';
  const role = user.role;
  if (role === 'super_admin' || role === 'admin') {
    return '/admin/dashboard';
  }
  if (role === 'moderator') {
    return '/admin/moderation';
  }
  if (role === 'support_admin') {
    return '/admin/support';
  }
  return '/dashboard';
};

/**
 * Root Route Redirect Component
 * Direct application entry router:
 * - If still verifying auth session: renders smooth loading screen
 * - If unauthenticated: redirects directly to /login
 * - If unverified email: redirects to /verify-email
 * - If authenticated: redirects to the user's role-specific dashboard
 */
export const RootRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading message="Loading MELT..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user.email_verified) {
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
  }

  const destination = getDashboardRouteForUser(user);
  return <Navigate to={destination} replace />;
};

/**
 * Admin Index Route Redirect
 * Directs admin users to their designated view within the admin console
 */
export const AdminIndexRedirect = () => {
  const { user } = useAuth();
  if (user?.role === 'moderator') {
    return <Navigate to="/admin/moderation" replace />;
  }
  if (user?.role === 'support_admin') {
    return <Navigate to="/admin/support" replace />;
  }
  return <Navigate to="/admin/dashboard" replace />;
};

/**
 * Route guard that ensures the user has an active, verified authenticated session
 */
export const ProtectedRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading message="Verifying encryption & session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && !user.email_verified) {
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
  }

  return children;
};

/**
 * Route guard for public-only pages (e.g. login/register should redirect logged-in users)
 */
export const PublicRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoading message="Loading MELT..." />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardRouteForUser(user)} replace />;
  }

  return children;
};

export default ProtectedRoute;
