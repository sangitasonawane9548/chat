const express = require('express');
const adminController = require('../controllers/adminController');
const {
  requireAdminAuth,
  requireAdminPermission,
  requireAdminRole
} = require('../middleware/adminAuthMiddleware');
const { adminLoginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// 1. Admin Authentication (Rate Limited, Server-Side Role Verified)
router.post('/login', adminLoginLimiter, adminController.adminLogin);

// All subsequent routes require valid administrator authentication & DB verification
router.use(requireAdminAuth);

// 2. Profile & Session
router.get('/me', adminController.adminGetMe);
router.post('/logout', adminController.adminLogout);
router.put('/change-password', adminController.changeAdminPassword);

// 3. Dashboard Telemetry & System Status
router.get('/dashboard', requireAdminPermission(['dashboard:read', 'stats:read', 'users:read']), adminController.getDashboardStats);
router.get('/dashboard/stats', requireAdminPermission(['dashboard:read', 'stats:read', 'users:read']), adminController.getDashboardStats);
router.get('/dashboard/charts', requireAdminPermission(['dashboard:read', 'stats:read', 'users:read']), adminController.getDashboardCharts);

// 4. User Accounts & Provisioning
router.get('/users', requireAdminPermission('users:read'), adminController.getUsers);
router.get('/users/:id', requireAdminPermission('users:read'), adminController.getUserDetails);
router.post('/users', requireAdminRole('super_admin'), adminController.createAdminUser);
router.put('/users/:id/status', requireAdminPermission('users:suspend'), adminController.updateUserStatus);
router.patch('/users/:id/status', requireAdminPermission('users:suspend'), adminController.updateUserStatus);
router.patch('/users/:id', requireAdminPermission('users:suspend'), adminController.updateUserStatus);
router.put('/users/:id/role', requireAdminRole('super_admin'), adminController.updateUserRole);
router.delete('/users/:id', requireAdminRole('super_admin'), adminController.deleteUser);

// 5. Group Management & Moderation
router.get('/groups', requireAdminPermission('groups:read'), adminController.getGroups);
router.get('/groups/:id', requireAdminPermission('groups:read'), adminController.getGroupDetails);
router.put('/groups/:id/status', requireAdminPermission('groups:suspend'), adminController.updateGroupStatus);
router.patch('/groups/:id/status', requireAdminPermission('groups:suspend'), adminController.updateGroupStatus);
router.delete('/groups/:id', requireAdminRole('super_admin'), adminController.deleteGroup);

// 6. Reports & Moderation Tickets
router.get('/reports', requireAdminPermission('reports:read'), adminController.getReports);
router.put('/reports/:id', requireAdminPermission('reports:write'), adminController.updateReport);
router.patch('/reports/:id', requireAdminPermission('reports:write'), adminController.updateReport);

// 7. System Analytics & Security Audit Ledger
router.get('/analytics', requireAdminPermission(['analytics:read', 'stats:read']), adminController.getAnalytics);
router.get('/audit-logs', requireAdminRole('super_admin'), adminController.getAuditLogs);

// 8. Admin Notifications
router.get('/notifications', adminController.getNotifications);
router.put('/notifications/mark-read', adminController.markNotificationsRead);

// 9. Platform Configurations (Restricted to Super Administrator)
router.get('/settings', requireAdminRole('super_admin'), adminController.getSettings);
router.put('/settings', requireAdminRole('super_admin'), adminController.updateSettings);
router.patch('/settings', requireAdminRole('super_admin'), adminController.updateSettings);

module.exports = router;
