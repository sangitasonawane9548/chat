const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runOptimizations() {
  console.log('🚀 Executing Day 10 Database Optimizations...');
  const sqlFile = path.join(__dirname, '../../database/day10_final_optimizations.sql');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  // Split into individual SQL statements
  const statements = sqlContent
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('use '));

  for (const statement of statements) {
    try {
      await pool.query(statement);
      console.log(`✅ Executed: ${statement.substring(0, 60)}...`);
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log(`ℹ️ Index already exists: ${statement.substring(0, 60)}...`);
      } else {
        console.warn(`⚠️ Warning executing statement: ${err.message}`);
      }
    }
  }

  console.log('🎉 Day 10 database optimizations completed successfully!');
  await pool.end();
}

runOptimizations();

