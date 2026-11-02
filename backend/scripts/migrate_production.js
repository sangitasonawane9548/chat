/**
 * Production Database Migration Script
 * Safe, idempotent initialization of all 35 tables for Aiven MySQL
 * Preserves existing data, tables, indexes, and constraints.
 */
const fs = require('fs');
const path = require('path');
const { pool, testDatabaseConnection } = require('../config/database');

const runMigration = async () => {
  console.log('====================================================');
  console.log('🚀 Starting MELT Production Database Migration...');
  console.log('====================================================');

  // 1. Verify Database Connection
  const health = await testDatabaseConnection();
  if (!health.connected) {
    console.error('❌ Failed to connect to MySQL database:', health.message);
    console.error('   Please check your DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, and DB_NAME in environment variables.');
    process.exit(1);
  }
  console.log('✅ Database Connection: Verified & Ready');

  // 2. Read Production Schema
  const schemaPath = path.join(__dirname, '../../database/production_schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Schema file not found at:', schemaPath);
    process.exit(1);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // 3. Execute Statements
  const connection = await pool.getConnection();
  try {
    console.log('🔄 Executing schema initialization statements...');
    
    // Strip single-line comments and extract individual statements
    const cleanSql = schemaSql.replace(/--.*$/gm, '');
    const statements = cleanSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let executedCount = 0;
    for (const stmt of statements) {
      await connection.query(stmt);
      if (stmt.toLowerCase().startsWith('create table')) {
        executedCount++;
      }
    }
    console.log(`✅ Verified/Executed ${executedCount} table definitions successfully.`);

    // 4. Verify Tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log(`📊 Verified Tables Count: ${tableNames.length} tables present in database.`);

    // 5. Seed default platform settings if empty
    if (tableNames.includes('platform_settings')) {
      const [settings] = await connection.query('SELECT COUNT(*) as cnt FROM platform_settings');
      if (settings[0].cnt === 0) {
        console.log('⚙️ Initializing default platform settings...');
        await connection.query(`
          INSERT INTO platform_settings (setting_key, setting_value, category, description) VALUES
          ('app_name', 'MELT', 'general', 'Platform Name'),
          ('maintenance_mode', 'false', 'general', 'Global maintenance mode toggle'),
          ('max_file_size_mb', '25', 'uploads', 'Maximum allowed attachment size in MB'),
          ('allowed_upload_types', 'image/jpeg,image/png,image/webp,video/mp4,audio/webm,application/pdf', 'uploads', 'MIME types allowed for chat attachments'),
          ('call_timeout_seconds', '45', 'calls', 'Duration in seconds before call is marked as missed')
        `);
        console.log('✅ Default platform settings initialized.');
      }
    }

    console.log('====================================================');
    console.log('🎉 Production Database Migration Completed Successfully!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration Error:', err.message);
    process.exit(1);
  } finally {
    connection.release();
  }
};

runMigration();
