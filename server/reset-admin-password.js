// For the store owner who is locked out of the admin (no email reset exists).
// Run on the server:  npm run reset-admin-password -- owner@example.com
// Prints a temporary password valid for 24 hours; the admin must choose a new
// one right after signing in. All their current sessions are signed out.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { TEMP_PASSWORD_TTL_HOURS, generateTempPassword } from './lib/tempPassword.js';

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run reset-admin-password -- <admin email>');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined });
try {
  const temporaryPassword = generateTempPassword();
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000);
  const result = await pool.query(
    'UPDATE admins SET password_hash = $1, must_change_password = true, temp_password_expires_at = $2 WHERE lower(email) = $3 RETURNING id, email',
    [await bcrypt.hash(temporaryPassword, 12), expiresAt, email]
  );
  if (!result.rowCount) {
    console.error(`No admin account with the email ${email}.`);
    process.exitCode = 1;
  } else {
    await pool.query('DELETE FROM sessions WHERE admin_id = $1', [result.rows[0].id]);
    await pool.query('INSERT INTO admin_audit_logs (admin_email, action, ip_address) VALUES ($1, $2, $3)', [result.rows[0].email, 'password_reset_from_server', 'server-console']);
    console.log(`Temporary password for ${result.rows[0].email}: ${temporaryPassword}`);
    console.log(`It expires ${expiresAt.toLocaleString()}. Sign in at /admin and choose a new password.`);
  }
} finally {
  await pool.end();
}
