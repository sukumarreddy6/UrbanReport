require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const { URBANREPORT_INITIAL_ADMIN_NAME: fullName, URBANREPORT_INITIAL_ADMIN_EMAIL: email, URBANREPORT_INITIAL_ADMIN_PASSWORD: password } = process.env;
  if (!fullName || !email || !password || password.length < 12) throw new Error('Set the three URBANREPORT_INITIAL_ADMIN_* values in .env; the password must be at least 12 characters.');
  await mongoose.connect(process.env.MONGODB_URI);
  if (await User.exists({ role: 'admin' })) throw new Error('An admin already exists. Create further accounts in the admin portal.');
  await User.register(new User({ fullName, email: email.toLowerCase(), role: 'admin' }), password);
  console.log('Initial admin account created. Remove the URBANREPORT_INITIAL_ADMIN_* values from .env now.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
