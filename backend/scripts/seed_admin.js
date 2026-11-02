const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function seedAdmin() {
  console.log('🌱 Seeding Admin Roles, Platform Settings, and Initial Super Admin...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Seed Roles
    const roles = [
      {
        name: 'super_admin',
        displayName: 'Super Administrator',
        description: 'Unrestricted master access to all platform, infrastructure, and user data',
        permissions: JSON.stringify(['*'])
      },
      {
        name: 'moderator',
        displayName: 'Community Moderator',
        description: 'Inspect user reports, review flagged messages/content, issue warnings & suspensions',
        permissions: JSON.stringify([
          'dashboard:read',
          'stats:read',
          'reports:read',
          'reports:write',
          'users:read',
          'users:warn',
          'users:suspend',
          'content:moderate',
          'groups:read',
          'groups:suspend'
        ])
      },
      {
        name: 'support_admin',
        displayName: 'Support Specialist',
        description: 'Inspect basic account telemetry, verify session status, manage customer tickets',
        permissions: JSON.stringify([
          'dashboard:read',
          'stats:read',
          'users:read',
          'support:read',
          'support:write',
          'groups:read'
        ])
      }
    ];

    for (const r of roles) {
      await connection.query(
        `INSERT INTO admin_roles (role_name, display_name, description, permissions)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           display_name = VALUES(display_name),
           description = VALUES(description),
           permissions = VALUES(permissions)`,
        [r.name, r.displayName, r.description, r.permissions]
      );
    }
    console.log('   ✓ Admin roles seeded: super_admin, moderator, support_admin');

    // 2. Seed Default Platform Settings
    const settings = [
      { key: 'site_name', val: 'MELT', type: 'string', desc: 'Public platform branding name' },
      { key: 'allow_registration', val: 'true', type: 'boolean', desc: 'Allows new visitors to create accounts' },
      { key: 'maintenance_mode', val: 'false', type: 'boolean', desc: 'Restricts user access during system updates' },
      { key: 'max_group_members', val: '100', type: 'number', desc: 'Maximum allowable member count per group conversation' },
      { key: 'max_file_size_mb', val: '50', type: 'number', desc: 'Maximum file size in megabytes for conversation attachments' },
      { key: 'stun_server', val: 'stun:stun.l.google.com:19302', type: 'string', desc: 'Default STUN server for WebRTC peer connections' },
      { key: 'rate_limit_per_minute', val: '120', type: 'number', desc: 'Global API rate limit per client IP' }
    ];

    for (const s of settings) {
      await connection.query(
        `INSERT INTO platform_settings (setting_key, setting_value, data_type, description)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           description = VALUES(description)`,
        [s.key, s.val, s.type, s.desc]
      );
    }
    console.log('   ✓ Platform global settings seeded');

    // 3. Seed Initial Super Admin
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@aether.chat';
    const adminName = process.env.ADMIN_NAME || 'Platform Administrator';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Aether2026!';

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const [existingAdmin] = await connection.query(
      `SELECT id, username, email FROM users WHERE username = ? OR email = ?`,
      [adminUsername, adminEmail]
    );

    let adminUserId;
    if (existingAdmin.length === 0) {
      const [res] = await connection.query(
        `INSERT INTO users (full_name, username, email, password_hash, email_verified, account_status, role)
         VALUES (?, ?, ?, ?, 1, 'active', 'super_admin')`,
        [adminName, adminUsername, adminEmail, passwordHash]
      );
      adminUserId = res.insertId;
      console.log(`   ✓ Super Admin created (ID: ${adminUserId}, @${adminUsername})`);
    } else {
      adminUserId = existingAdmin[0].id;
      await connection.query(
        `UPDATE users 
         SET full_name = ?, password_hash = ?, email_verified = 1, account_status = 'active', role = 'super_admin'
         WHERE id = ?`,
        [adminName, passwordHash, adminUserId]
      );
      console.log(`   ✓ Existing admin updated to super_admin (ID: ${adminUserId}, @${adminUsername})`);
    }

    // 4. Seed Demo Moderator
    const modUsername = 'moderator';
    const modEmail = 'moderator@aether.chat';
    const modPassword = 'Mod@Aether2026!';
    const modHash = await bcrypt.hash(modPassword, 12);

    const [existingMod] = await connection.query(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [modUsername, modEmail]
    );

    if (existingMod.length === 0) {
      await connection.query(
        `INSERT INTO users (full_name, username, email, password_hash, email_verified, account_status, role)
         VALUES ('Community Moderator', ?, ?, ?, 1, 'active', 'moderator')`,
        [modUsername, modEmail, modHash]
      );
      console.log(`   ✓ Demo Moderator created (@${modUsername})`);
    }

    // 5. Seed Support Admin
    const supUsername = 'support';
    const supEmail = 'support@aether.chat';
    const supPassword = 'Support@Aether2026!';
    const supHash = await bcrypt.hash(supPassword, 12);

    const [existingSup] = await connection.query(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [supUsername, supEmail]
    );

    if (existingSup.length === 0) {
      await connection.query(
        `INSERT INTO users (full_name, username, email, password_hash, email_verified, account_status, role)
         VALUES ('Support Specialist', ?, ?, ?, 1, 'active', 'support_admin')`,
        [supUsername, supEmail, supHash]
      );
      console.log(`   ✓ Support Admin created (@${supUsername})`);
    }

    // 6. Initial Audit Log
    await connection.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, ip_address)
       VALUES (?, 'ADMIN_SEED_INITIALIZED', 'system', 'cluster', ?, '127.0.0.1')`,
      [adminUserId, JSON.stringify({ note: 'Initial Super Admin & platform seed executed' })]
    );

    await connection.commit();
    console.log('🎉 Admin seed completed successfully!');
    console.log(`-----------------------------------------------`);
    console.log(`🔑 Super Admin credentials:`);
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`🔑 Moderator credentials:`);
    console.log(`   Username: ${modUsername}`);
    console.log(`   Password: ${modPassword}`);
    console.log(`-----------------------------------------------`);
    process.exit(0);
  } catch (err) {
    await connection.rollback();
    console.error('❌ Admin seed failed:', err);
    process.exit(1);
  } finally {
    connection.release();
  }
}

seedAdmin();
