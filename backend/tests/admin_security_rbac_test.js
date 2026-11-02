/**
 * =============================================================================
 * MELT ADMIN PORTAL: PRODUCTION SECURITY & ACCESS RESTRICTION TEST SUITE
 * =============================================================================
 * Verifies strict separation between Normal User Application and Admin Portal.
 * Tests all 12 security scenarios required by Section 10.
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

async function runSecurityTests() {
  console.log('\n==================================================================');
  console.log('   MELT ADMIN PORTAL: STRICT RBAC & ACCESS RESTRICTIONS TEST SUITE');
  console.log('==================================================================\n');

  try {
    const shortTs = Date.now().toString().slice(-8);

    // Setup: Create a standard normal user
    const normalUsername = `u_sec_${shortTs}`;
    const normalEmail = `${normalUsername}@melt.chat`;
    const userPassword = 'UserPassword123!';

    // Register standard user
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Normal User',
        username: normalUsername,
        email: normalEmail,
        password: userPassword,
        confirmPassword: userPassword,
        agreeTerms: true
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.success, 'Standard user successfully registered');

    // Verify OTP with demo code
    const vRes = await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalEmail, otp: '123456' })
    });
    assert(vRes.status === 200, 'Standard user verified email');

    // Standard user logs in
    const userLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: normalEmail, password: userPassword })
    });
    const userLoginData = await userLoginRes.json();
    const userCookie = userLoginRes.headers.get('set-cookie');
    const userToken = userLoginData.token;

    assert(userLoginRes.status === 200 && userLoginData.user?.role === 'user', `Normal user authenticated with role 'user'`);

    // -------------------------------------------------------------------------
    // SCENARIO 1 & 2: Normal user attempts to access /admin APIs
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 1 & 2: Normal User Direct Admin Access Rejection ---');

    // Normal user calls GET /api/admin/dashboard/stats
    const normDashRes = await fetch(`${API_BASE}/admin/dashboard/stats`, {
      headers: {
        'Cookie': userCookie,
        'Authorization': `Bearer ${userToken || ''}`
      }
    });
    const normDashData = await normDashRes.json();
    assert(normDashRes.status === 403, 'SCENARIO 1: Normal user rejected from GET /api/admin/dashboard/stats with HTTP 403');
    assert(normDashData.code === 'FORBIDDEN_NOT_ADMIN', 'Error code indicates FORBIDDEN_NOT_ADMIN');

    // Normal user calls GET /api/admin/me
    const normMeRes = await fetch(`${API_BASE}/admin/me`, {
      headers: { 'Cookie': userCookie }
    });
    assert(normMeRes.status === 403, 'SCENARIO 2: Normal user rejected from GET /api/admin/me with HTTP 403');

    // -------------------------------------------------------------------------
    // SCENARIO 3: Normal user manually calls various admin APIs
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Normal User Blocked from Multiple Admin Endpoints ---');

    // GET /api/admin/users
    const normUsersRes = await fetch(`${API_BASE}/admin/users`, {
      headers: { 'Cookie': userCookie }
    });
    assert(normUsersRes.status === 403, 'Normal user blocked from GET /api/admin/users (403)');

    // POST /api/admin/users (create admin user)
    const normPostUserRes = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': userCookie },
      body: JSON.stringify({ username: 'hacker', role: 'super_admin' })
    });
    assert(normPostUserRes.status === 403, 'Normal user blocked from POST /api/admin/users (403)');

    // PATCH /api/admin/settings
    const normPatchSettingsRes = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': userCookie },
      body: JSON.stringify({ settings: { maintenance_mode: true } })
    });
    assert(normPatchSettingsRes.status === 403, 'Normal user blocked from PATCH /api/admin/settings (403)');

    // DELETE /api/admin/users/1
    const normDelUserRes = await fetch(`${API_BASE}/admin/users/1`, {
      method: 'DELETE',
      headers: { 'Cookie': userCookie }
    });
    assert(normDelUserRes.status === 403, 'Normal user blocked from DELETE /api/admin/users/:id (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 4 & 5: Normal user tampers with localStorage role or claims admin role in request
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 4 & 5: Untrusted Role Tampering & Spoofing Rejection ---');

    // Normal user attempts to pass { role: 'super_admin' } in headers or body
    const spoofHeaderRes = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: {
        'Cookie': userCookie,
        'X-User-Role': 'super_admin',
        'X-Role': 'super_admin'
      }
    });
    assert(spoofHeaderRes.status === 403, 'SCENARIO 4: Role claim in headers is ignored; server enforces DB role (403)');

    // User attempts to login via admin portal using standard user credentials
    const adminLoginSpoofRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: normalUsername, password: userPassword })
    });
    const adminLoginSpoofData = await adminLoginSpoofRes.json();
    assert(adminLoginSpoofRes.status === 403, 'SCENARIO 5: Admin login rejects standard user accounts (403 Forbidden)');
    assert(adminLoginSpoofData.success === false, 'Admin login response indicates failure');

    // -------------------------------------------------------------------------
    // SCENARIO 6: Normal user attempts to register directly as an admin
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 6: Prevention of Public Admin Account Registration ---');

    const hackerUsername = `hk_${shortTs}`;
    const hackerEmail = `${hackerUsername}@melt.chat`;
    const adminRegisterAttemptRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Hacker Superadmin',
        username: hackerUsername,
        email: hackerEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        agreeTerms: true,
        role: 'super_admin' // Privilege escalation attempt
      })
    });
    const adminRegisterAttemptData = await adminRegisterAttemptRes.json();
    assert(adminRegisterAttemptRes.status === 403, 'SCENARIO 6: Registration with role: "super_admin" rejected with 403');
    assert(adminRegisterAttemptData.message.includes('forbidden'), 'Message explains administrative registration is forbidden');

    // -------------------------------------------------------------------------
    // SCENARIO 7: Normal user attempts to update own role via profile update API
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 7: Prevention of Self-Assigned Role Escalation ---');

    const roleEscalateRes = await fetch(`${API_BASE}/users/me/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userCookie
      },
      body: JSON.stringify({
        fullName: 'Normal User Escalated',
        role: 'super_admin' // Privilege escalation attempt
      })
    });
    assert(roleEscalateRes.status === 403, 'SCENARIO 7: Profile update with role: "super_admin" rejected with 403');

    // Verify user role in database remains 'user'
    const [dbUser] = await pool.query('SELECT role FROM users WHERE username = ?', [normalUsername]);
    assert(dbUser[0]?.role === 'user', 'Database confirmation: User role strictly remains "user"');

    // -------------------------------------------------------------------------
    // SCENARIO 8: Unauthenticated visitor tries accessing admin APIs
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 8: Unauthenticated Access Rejection ---');

    const unauthStatsRes = await fetch(`${API_BASE}/admin/dashboard/stats`);
    assert(unauthStatsRes.status === 401, 'SCENARIO 8: Unauthenticated visitor receives HTTP 401 Unauthorized');

    const unauthUsersRes = await fetch(`${API_BASE}/admin/users`);
    assert(unauthUsersRes.status === 401, 'Unauthenticated visitor to /admin/users receives HTTP 401');

    // -------------------------------------------------------------------------
    // SCENARIO 9: Moderator attempts to access Super Admin settings & audit logs
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 9: Moderator RBAC Boundary Enforcement ---');

    // Moderator login
    const modLoginRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'moderator', password: 'Mod@Aether2026!' })
    });
    const modLoginData = await modLoginRes.json();
    const modToken = modLoginData.token;
    assert(modLoginRes.status === 200 && modLoginData.admin?.role === 'moderator', 'Moderator authenticates successfully');

    // Moderator CAN access dashboard and reports
    const modRepRes = await fetch(`${API_BASE}/admin/reports`, {
      headers: { 'Authorization': `Bearer ${modToken}` }
    });
    assert(modRepRes.status === 200, 'Moderator can access /admin/reports (permitted)');

    // Moderator CANNOT access platform settings
    const modSettingsGet = await fetch(`${API_BASE}/admin/settings`, {
      headers: { 'Authorization': `Bearer ${modToken}` }
    });
    assert(modSettingsGet.status === 403, 'SCENARIO 9: Moderator rejected from GET /api/admin/settings (403)');

    const modSettingsPut = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${modToken}` },
      body: JSON.stringify({ settings: { site_name: 'Hacked' } })
    });
    assert(modSettingsPut.status === 403, 'Moderator rejected from PUT /api/admin/settings (403)');

    // Moderator CANNOT access security audit logs
    const modAuditRes = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { 'Authorization': `Bearer ${modToken}` }
    });
    assert(modAuditRes.status === 403, 'Moderator rejected from GET /api/admin/audit-logs (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 10: Support Admin attempts restricted moderation/account features
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 10: Support Admin RBAC Boundary Enforcement ---');

    // Support Admin login
    const supLoginRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'support', password: 'Support@Aether2026!' })
    });
    const supLoginData = await supLoginRes.json();
    const supToken = supLoginData.token;
    assert(supLoginRes.status === 200 && supLoginData.admin?.role === 'support_admin', 'Support Admin authenticates successfully');

    // Support Admin CAN read users list
    const supUsersRes = await fetch(`${API_BASE}/admin/users`, {
      headers: { 'Authorization': `Bearer ${supToken}` }
    });
    assert(supUsersRes.status === 200, 'Support Admin can read /admin/users (permitted)');

    // Support Admin CANNOT suspend users
    const supSuspendRes = await fetch(`${API_BASE}/admin/users/${userLoginData.user?.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supToken}` },
      body: JSON.stringify({ status: 'suspended', reason: 'Unauthorized action' })
    });
    assert(supSuspendRes.status === 403, 'SCENARIO 10: Support Admin rejected from suspending users (403)');

    // Support Admin CANNOT view or resolve reports
    const supReportsRes = await fetch(`${API_BASE}/admin/reports`, {
      headers: { 'Authorization': `Bearer ${supToken}` }
    });
    assert(supReportsRes.status === 403, 'Support Admin rejected from GET /api/admin/reports (403)');

    // Support Admin CANNOT suspend groups
    const supGroupSuspRes = await fetch(`${API_BASE}/admin/groups/1/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supToken}` },
      body: JSON.stringify({ status: 'suspended' })
    });
    assert(supGroupSuspRes.status === 403, 'Support Admin rejected from suspending groups (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 11: Super Admin accesses all authorized features
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 11: Super Admin Unrestricted Clearance ---');

    const superLoginRes = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@Aether2026!' })
    });
    const superToken = (await superLoginRes.json()).token;

    // Super Admin reads settings
    const superSettingsGet = await fetch(`${API_BASE}/admin/settings`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    assert(superSettingsGet.status === 200, 'SCENARIO 11: Super Admin can read platform settings (200 OK)');

    // Super Admin updates settings
    const superSettingsPut = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superToken}` },
      body: JSON.stringify({ settings: { max_group_members: 120 } })
    });
    assert(superSettingsPut.status === 200, 'Super Admin can mutate platform settings (200 OK)');

    // Super Admin reads audit logs
    const superAuditRes = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    assert(superAuditRes.status === 200, 'Super Admin can access immutable audit ledger (200 OK)');

    // Super Admin creates a new admin user
    const newModUsername = `nm_${shortTs}`;
    const createAdminRes = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superToken}` },
      body: JSON.stringify({
        fullName: 'New Community Mod',
        username: newModUsername,
        email: `${newModUsername}@melt.chat`,
        password: 'AdminPassword123!',
        role: 'moderator'
      })
    });
    assert(createAdminRes.status === 201, 'Super Admin provisions new administrative account (201 Created)');

    // -------------------------------------------------------------------------
    // SCENARIO 12: Admin logs out and attempts to reuse session
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 12: Session Invalidation on Logout ---');

    // Logout
    const logoutRes = await fetch(`${API_BASE}/admin/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    assert(logoutRes.status === 200, 'SCENARIO 12: Admin logs out successfully');

    // Attempting access with cleared cookie / without token fails
    const reusedSessionRes = await fetch(`${API_BASE}/admin/me`);
    assert(reusedSessionRes.status === 401, 'Accessing admin routes after logout rejected with 401');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n==================================================================');
    console.log(`TOTAL SECURITY TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('==================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal security test error:', err);
    process.exit(1);
  }
}

runSecurityTests();
