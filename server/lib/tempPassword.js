import crypto from 'node:crypto';

// Temporary passwords are read aloud or sent over WhatsApp, so they avoid
// look-alike characters (0/O, 1/l/I). 12 characters from 54 symbols is about
// 69 bits — plenty for a password that expires in 24 hours and must be
// changed on first use.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export const TEMP_PASSWORD_TTL_HOURS = 24;

export function generateTempPassword() {
  const chars = Array.from({ length: 12 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
}
