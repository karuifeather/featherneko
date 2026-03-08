#!/usr/bin/env node
/**
 * Generate a bcrypt hash for your app password.
 * Run: node scripts/generate-password-hash.js "YourNewPassword"
 * Then put the output into .env as PASSWORD_HASH=<the hash>
 *
 * (Use quotes so special characters are preserved.)
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/generate-password-hash.js "YourNewPassword"');
  console.error('Use quotes around the password if it has spaces or special characters.');
  process.exit(1);
}

const saltRounds = 10;
bcrypt.hash(password, saltRounds).then((hash) => {
  console.log('\nAdd this to your .env file:\n');
  console.log('PASSWORD_HASH=' + hash);
  console.log('\n');
});
