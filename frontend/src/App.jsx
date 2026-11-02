import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { CallProvider } from '@/context/CallContext';
import CallOverlay from '@/components/calling/CallOverlay';
import ProtectedRoute, {
  PublicRoute,
  ProtectedUserRoute,
  ProtectedAdminRoute,
  RootRedirect,
  AdminIndexRedirect
} from '@/components/common/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import ToastProvider from '@/components/common/ToastProvider';
import ErrorBoundary from '@/components/common/ErrorBoundary';


// Lazy-loaded route components for optimal initial bundle & performance
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ChatPage = lazy(() => import('@/pages/chat/ChatPage'));
const UserProfilePage = lazy(() => import('@/pages/profile/UserProfilePage'));
const EditProfile = lazy(() => import('@/pages/profile/EditProfile'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const CallsPage = lazy(() => import('@/pages/calls/CallsPage'));
const StatusPage = lazy(() => import('@/pages/status/StatusPage'));
const Discover = lazy(() => import('@/pages/discovery/Discover'));
const ChatRequests = lazy(() => import('@/pages/requests/ChatRequests'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));

// Lazy-loaded Admin components
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));
const AdminAccessDenied = lazy(() => import('@/pages/admin/AdminAccessDenied'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminGroups = lazy(() => import('@/pages/admin/AdminGroups'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));
const AdminModeration = lazy(() => import('@/pages/admin/AdminModeration'));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AdminAuditLogs'));
const AdminSupport = lazy(() => import('@/pages/admin/AdminSupport'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));

const LoadingFallback = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-brand-bg transition-colors duration-300">
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="w-10 h-10 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-brand-muted tracking-wider uppercase">Loading MELT...</span>
    </div>
  </div>
);

export const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <ToastProvider />
            <CallOverlay />
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                {/* Root Route: Direct Role-Based Dashboard or Login */}
                <Route path="/" element={<RootRedirect />} />
                <Route path="/home" element={<Navigate to="/" replace />} />

                {/* Public Authentication Routes */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <Register />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/verify-email"
                  element={<VerifyEmail />}
                />
                <Route
                  path="/forgot-password"
                  element={
                    <PublicRoute>
                      <ForgotPassword />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/reset-password"
                  element={
                    <PublicRoute>
                      <ResetPassword />
                    </PublicRoute>
                  }
                />

                {/* Protected User App Routes */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/discover" element={<Discover />} />
                  <Route path="/requests" element={<ChatRequests />} />
                  <Route path="/profile" element={<UserProfilePage />} />
                  <Route path="/profile/:username" element={<UserProfilePage />} />
                  <Route path="/profile/edit" element={<EditProfile />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/calls" element={<CallsPage />} />
                  <Route path="/status" element={<StatusPage />} />
                </Route>

                {/* Admin Portal Routes */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/access-denied" element={<AdminAccessDenied />} />
                <Route
                  path="/admin"
                  element={
                    <ProtectedAdminRoute>
                      <AdminLayout />
                    </ProtectedAdminRoute>
                  }
                >
                  <Route index element={<AdminIndexRedirect />} />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="groups" element={<AdminGroups />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="moderation" element={<AdminModeration />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route
                    path="audit-logs"
                    element={
                      <ProtectedAdminRoute requiredRole="super_admin">
                        <AdminAuditLogs />
                      </ProtectedAdminRoute>
                    }
                  />
                  <Route path="support" element={<AdminSupport />} />
                  <Route
                    path="settings"
                    element={
                      <ProtectedAdminRoute requiredRole="super_admin">
                        <AdminSettings />
                      </ProtectedAdminRoute>
                    }
                  />
                </Route>

                {/* 404 Catch-All */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  </ThemeProvider>
  );
};

export default App;
