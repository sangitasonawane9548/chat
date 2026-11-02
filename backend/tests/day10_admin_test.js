/**
 * =============================================================================
 * DAY 10: COMPLETE ADMIN PANEL & MODERATION SYSTEM TEST SUITE
 * =============================================================================
 */

const { pool } = require('../config/database');

const API_BASE = 'http://localhost:5000/api';
let passed = 0;
let failed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    if (details) console.error(`   Details: ${details}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   DAY 10: COMPLETE ADMIN PANEL VERIFICATION SUITE    ');
  console.log('======================================================\n');

  try {
    const timestamp = Date.now();

    // -------------------------------------------------------------------------
    // 1. ADMIN AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Admin Authentication & Role Enforcement ---');

    // 1.1 Super Admin Login
    const superLoginRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@Aether2026!' })
    });
    const superLoginData = await superLoginRes.json();
    assert(superLoginRes.status === 200 && superLoginData.success, 'Super Admin login succeeds (200 OK)');
    assert(superLoginData.admin?.role === 'super_admin', 'Admin role is super_admin');
    assert(Boolean(superLoginData.token), 'Admin JWT token returned in body');

    const superAdminToken = superLoginData.token;

    // 1.2 Invalid password rejected
    const badLoginRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'WrongPassword999!' })
    });
    assert(badLoginRes.status === 401, 'Admin login with invalid password rejected (401 Unauthorized)');

    // 1.3 Normal user cannot access admin login
    // Create standard user
    const normUsername = `norm_${timestamp}`;
    const normEmail = `${normUsername}@test.com`;
    await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Normal User',
        username: normUsername,
        email: normEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        agreeTerms: true
      })
    });
    await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normEmail, otp: '123456' })
    });

    const normAdminLoginRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: normUsername, password: 'Password123!' })
    });
    assert(normAdminLoginRes.status === 403, 'Normal user rejected from admin login (403 Forbidden)');

    // 1.4 Protected route without token rejected
    const unauthRes = await fetch(`${API_BASE}/admin/dashboard/stats`);
    assert(unauthRes.status === 401, 'Protected admin route rejected without token (401 Unauthorized)');

    // 1.5 GET /api/admin/me returns profile
    const meRes = await fetch(`${API_BASE}/admin/me`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.admin?.username === 'admin', 'GET /api/admin/me returns authenticated admin profile');

    // -------------------------------------------------------------------------
    // 2. DASHBOARD TELEMETRY & HEALTH
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Dashboard Statistics & Health Telemetry ---');

    const statsRes = await fetch(`${API_BASE}/admin/dashboard/stats`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const statsData = await statsRes.json();
    assert(statsRes.status === 200 && statsData.success, 'GET /api/admin/dashboard/stats succeeds');
    assert(typeof statsData.stats?.totalUsers === 'number' && statsData.stats.totalUsers > 0, 'Total users metric computed from DB');
    assert(typeof statsData.stats?.totalMessagesSent === 'number', 'Total messages metric computed from DB');
    assert(typeof statsData.stats?.totalGroups === 'number', 'Total groups metric computed from DB');
    assert(statsData.stats?.systemStatus === 'healthy', 'System status indicates healthy cluster');
    assert(Boolean(statsData.stats?.dbLatency), 'Database latency recorded');

    const chartsRes = await fetch(`${API_BASE}/admin/dashboard/charts`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const chartsData = await chartsRes.json();
    assert(chartsRes.status === 200 && Array.isArray(chartsData.charts?.registrations), 'GET /api/admin/dashboard/charts returns registration volume');

    // -------------------------------------------------------------------------
    // 3. USER MANAGEMENT & SUSPENSION ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 3. User Accounts Management & Suspension ---');

    // 3.1 List users with pagination and search
    const usersListRes = await fetch(`${API_BASE}/admin/users?search=${normUsername}&limit=5`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const usersListData = await usersListRes.json();
    assert(usersListRes.status === 200 && usersListData.users?.length >= 1, 'GET /api/admin/users finds registered test user');

    const targetUser = usersListData.users[0];
    assert(targetUser.username === normUsername, 'Found user matches username');

    // 3.2 Fetch user details
    const userDetailRes = await fetch(`${API_BASE}/admin/users/${targetUser.id}`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const userDetailData = await userDetailRes.json();
    assert(userDetailRes.status === 200 && userDetailData.user?.id === targetUser.id, 'GET /api/admin/users/:id returns user details');

    // 3.3 Normal user logs in to obtain active session
    const normLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: normEmail, password: 'Password123!' })
    });
    const normCookie = normLoginRes.headers.get('set-cookie');
    assert(normLoginRes.status === 200, 'User logs in successfully before suspension');

    // 3.4 Admin suspends user
    const suspendRes = await fetch(`${API_BASE}/admin/users/${targetUser.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ status: 'suspended', reason: 'Test policy violation' })
    });
    const suspendData = await suspendRes.json();
    assert(suspendRes.status === 200 && suspendData.account_status === 'suspended', 'Admin suspends user account');

    // 3.5 Suspended user cannot log in
    const blockedLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: normEmail, password: 'Password123!' })
    });
    assert(blockedLoginRes.status === 403, 'Suspended user login rejected with 403 Forbidden');

    // 3.6 Suspended user active session revoked
    const blockedMeRes = await fetch(`${API_BASE}/users/me`, {
      headers: { 'Cookie': normCookie }
    });
    assert(blockedMeRes.status === 401, 'Suspended user existing session invalidated immediately (401/403)');

    // 3.7 Admin reactivates user
    const reactivateRes = await fetch(`${API_BASE}/admin/users/${targetUser.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ status: 'active', reason: 'Reactivation after review' })
    });
    const reactivateData = await reactivateRes.json();
    assert(reactivateRes.status === 200 && reactivateData.account_status === 'active', 'Admin reactivates user account');

    // 3.8 User can log in again
    const restoredLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: normEmail, password: 'Password123!' })
    });
    assert(restoredLoginRes.status === 200, 'User can log in again after reactivation');

    // -------------------------------------------------------------------------
    // 4. GROUP MANAGEMENT & GROUP SUSPENSION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Group Management & Moderation ---');

    const groupsRes = await fetch(`${API_BASE}/admin/groups?limit=10`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const groupsData = await groupsRes.json();
    assert(groupsRes.status === 200 && Array.isArray(groupsData.groups), 'GET /api/admin/groups returns channels');

    if (groupsData.groups.length > 0) {
      const testGrp = groupsData.groups[0];

      // Suspend group
      const grpSuspRes = await fetch(`${API_BASE}/admin/groups/${testGrp.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ status: 'suspended', reason: 'Admin group moderation test' })
      });
      assert(grpSuspRes.status === 200, 'Admin can suspend group chat');

      // Reactivate group
      const grpReactRes = await fetch(`${API_BASE}/admin/groups/${testGrp.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ status: 'active', reason: 'Reactivation test' })
      });
      assert(grpReactRes.status === 200, 'Admin can reactivate group chat');
    }

    // -------------------------------------------------------------------------
    // 5. USER REPORT SUBMISSION & MODERATION REVIEW
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Reports & Moderation Tickets ---');

    // User submits report
    const restoredCookie = restoredLoginRes.headers.get('set-cookie');
    const submitReportRes = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': restoredCookie
      },
      body: JSON.stringify({
        reported_user_id: 1,
        reason: 'Unsolicited Spam Promotions',
        description: 'Automated advertising in private conversations.'
      })
    });
    const submitReportData = await submitReportRes.json();
    assert(submitReportRes.status === 201 && Boolean(submitReportData.reportId), 'User successfully files moderation report (201 Created)');

    const ticketId = submitReportData.reportId;

    // Admin views report in queue
    const adminReportsRes = await fetch(`${API_BASE}/admin/reports?status=pending`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const adminReportsData = await adminReportsRes.json();
    const foundReport = adminReportsData.reports?.find(r => r.id === ticketId);
    assert(Boolean(foundReport), 'Admin reports queue includes newly submitted user report');
    assert(foundReport?.reporter_username === normUsername, 'Report links correctly to reporter identity');

    // Admin resolves report
    const resolveRes = await fetch(`${API_BASE}/admin/reports/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        status: 'resolved',
        admin_notes: 'Reviewed spam logs and closed ticket',
        action_taken: 'warning_issued'
      })
    });
    const resolveData = await resolveRes.json();
    assert(resolveRes.status === 200 && resolveData.report?.status === 'resolved', 'Admin marks report as resolved with notes and action taken');

    // -------------------------------------------------------------------------
    // 6. RBAC (SUPER ADMIN VS MODERATOR)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Role-Based Access Control (RBAC) ---');

    const modLoginRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'moderator', password: 'Mod@Aether2026!' })
    });
    const modLoginData = await modLoginRes.json();
    assert(modLoginRes.status === 200 && modLoginData.admin?.role === 'moderator', 'Moderator logs in successfully');
    const modToken = modLoginData.token;

    // Moderator can read reports
    const modReadRes = await fetch(`${API_BASE}/admin/reports`, {
      headers: { 'Authorization': `Bearer ${modToken}` }
    });
    assert(modReadRes.status === 200, 'Moderator has permission to view reports queue');

    // Moderator CANNOT update global platform settings
    const modSettingsRes = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modToken}`
      },
      body: JSON.stringify({ settings: { site_name: 'Unauthorized Change' } })
    });
    assert(modSettingsRes.status === 403, 'Moderator forbidden from modifying platform settings (403 Forbidden)');

    // Moderator CANNOT change user roles
    const modRoleRes = await fetch(`${API_BASE}/admin/users/${targetUser.id}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modToken}`
      },
      body: JSON.stringify({ role: 'super_admin' })
    });
    assert(modRoleRes.status === 403, 'Moderator forbidden from elevating user roles (403 Forbidden)');

    // Super Admin CAN update platform settings
    const superSettingsRes = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        settings: {
          site_name: 'Aether Chat Network',
          max_group_members: 150
        }
      })
    });
    assert(superSettingsRes.status === 200, 'Super Admin successfully updates platform settings (200 OK)');

    // -------------------------------------------------------------------------
    // 7. AUDIT LOGS & NOTIFICATIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Security Audit Trail & Notifications ---');

    const auditRes = await fetch(`${API_BASE}/admin/audit-logs?limit=5`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200 && auditData.logs?.length > 0, 'Admin audit logs recorded and accessible');
    assert(auditData.logs.some(l => l.admin_username === 'admin'), 'Audit log includes actions by admin');

    const notifRes = await fetch(`${API_BASE}/admin/notifications`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const notifData = await notifRes.json();
    assert(notifRes.status === 200 && Array.isArray(notifData.notifications), 'Admin notifications endpoint returns alerts');

    const markReadRes = await fetch(`${API_BASE}/admin/notifications/mark-read`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    assert(markReadRes.status === 200, 'Admin notifications successfully marked as read');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();

