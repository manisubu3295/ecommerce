import nodemailer from 'nodemailer';

let transporter;
let warned = false;

// True only for real SMTP settings — the .env.example placeholders
// (smtp.example.com, replace-with-…) count as "not set up". Customer sign-in
// depends on this because every login is confirmed by an emailed code.
export function isEmailConfigured() {
  const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASS: pass } = process.env;
  if (!host || !user || !pass) return false;
  return !/(^|\.)example\.(com|org|net)$/i.test(host) && !/^replace-with/i.test(pass);
}

function getTransporter() {
  if (transporter !== undefined) return transporter;
  if (!isEmailConfigured()) {
    if (!warned) {
      console.log('Email sending is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing or placeholders). Transactional emails are skipped and customer sign-in is off.');
      warned = true;
    }
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

/**
 * Fire-and-forget-safe: never throws. Returns { sent: boolean, reason?: string }
 * so callers can log without needing a try/catch at every call site.
 */
export async function sendMail({ to, subject, text, html }) {
  if (!to) return { sent: false, reason: 'no_recipient' };
  const client = getTransporter();
  if (!client) return { sent: false, reason: 'not_configured' };
  try {
    await client.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
    return { sent: true };
  } catch (error) {
    console.error('Email send failed:', error.message);
    return { sent: false, reason: 'send_failed' };
  }
}
