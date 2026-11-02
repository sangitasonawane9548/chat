const { pool } = require('../config/database');

(async () => {
  try {
    const [users] = await pool.query(
      `SELECT id, full_name, username, email, role, account_status FROM users WHERE role != 'user' OR username LIKE '%admin%'`
    );
    console.log('Existing admins/staff:', users);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

