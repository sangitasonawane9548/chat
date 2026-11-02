const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runAdminMigrations() {
  console.log('🚀 Running Day 10 Admin Panel database migrations...');
  const sqlFile = path.join(__dirname, '../../database/day10_admin_tables.sql');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  const connection = await pool.getConnection();
  try {
    // 1. Update users.role
    console.log('1. Updating users.role column enum...');
    await connection.query(`
      ALTER TABLE \`users\` 
      MODIFY COLUMN \`role\` ENUM('user', 'admin', 'super_admin', 'moderator', 'support_admin') NOT NULL DEFAULT 'user'
    `);

    // 2. Add status to groups table if not exists
    console.log('2. Ensuring groups.status column exists...');
    const [cols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'status'
    `);
    if (cols.length === 0) {
      await connection.query(`
        ALTER TABLE \`groups\` 
        ADD COLUMN \`status\` ENUM('active', 'suspended', 'archived') NOT NULL DEFAULT 'active' AFTER \`created_by\`
      `);
      console.log('   -> Added status column to groups table');
    }

    // 3. Create admin_roles
    console.log('3. Creating admin_roles table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`admin_roles\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`role_name\` VARCHAR(50) NOT NULL UNIQUE,
        \`display_name\` VARCHAR(100) NOT NULL,
        \`description\` VARCHAR(255) NULL,
        \`permissions\` JSON NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_role_name\` (\`role_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 4. Create admin_audit_logs
    console.log('4. Creating admin_audit_logs table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`admin_audit_logs\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`admin_id\` BIGINT UNSIGNED NOT NULL,
        \`action\` VARCHAR(100) NOT NULL,
        \`target_type\` VARCHAR(50) NOT NULL,
        \`target_id\` VARCHAR(100) NULL,
        \`details\` JSON NULL,
        \`ip_address\` VARCHAR(45) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_audit_admin\` (\`admin_id\`),
        INDEX \`idx_audit_action\` (\`action\`),
        INDEX \`idx_audit_target\` (\`target_type\`, \`target_id\`),
        INDEX \`idx_audit_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 5. Create user_reports
    console.log('5. Creating user_reports table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`user_reports\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`reporter_id\` BIGINT UNSIGNED NOT NULL,
        \`reported_user_id\` BIGINT UNSIGNED NULL,
        \`group_id\` BIGINT UNSIGNED NULL,
        \`message_id\` BIGINT UNSIGNED NULL,
        \`status_id\` BIGINT UNSIGNED NULL,
        \`reason\` VARCHAR(150) NOT NULL,
        \`description\` TEXT NULL,
        \`status\` ENUM('pending', 'under_review', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
        \`reviewed_by\` BIGINT UNSIGNED NULL,
        \`admin_notes\` TEXT NULL,
        \`action_taken\` VARCHAR(100) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_rep_reporter\` (\`reporter_id\`),
        INDEX \`idx_rep_reported_user\` (\`reported_user_id\`),
        INDEX \`idx_rep_group\` (\`group_id\`),
        INDEX \`idx_rep_status\` (\`status\`),
        INDEX \`idx_rep_created\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 6. Create admin_notifications
    console.log('6. Creating admin_notifications table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`admin_notifications\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`admin_id\` BIGINT UNSIGNED NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`notification_type\` VARCHAR(50) NOT NULL,
        \`is_read\` TINYINT(1) NOT NULL DEFAULT 0,
        \`reference_id\` VARCHAR(100) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_admin_notif_unread\` (\`admin_id\`, \`is_read\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 7. Create platform_settings
    console.log('7. Creating platform_settings table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`platform_settings\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`setting_key\` VARCHAR(100) NOT NULL UNIQUE,
        \`setting_value\` TEXT NOT NULL,
        \`data_type\` ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
        \`description\` VARCHAR(255) NULL,
        \`updated_by\` BIGINT UNSIGNED NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_setting_key\` (\`setting_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ Admin Panel database migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    connection.release();
  }
}

runAdminMigrations();

