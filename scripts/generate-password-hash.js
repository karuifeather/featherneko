#!/usr/bin/env node
/**
 * Generate a bcrypt hash for your app password.
 * Run: node scripts/generate-password-hash.js "YourNewPassword"
 * Use escaped output for .env, unescaped for GitHub secrets.
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
  const escaped = hash.replace(/\$/g, '\\$');
  console.log('\nFor .env file:\n  PASSWORD_HASH=' + escaped);
  console.log('\nFor GitHub secret PASSWORD_HASH:\n  ' + hash);
  console.log('');
});
