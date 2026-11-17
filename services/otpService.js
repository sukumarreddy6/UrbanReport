const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const EmailOtp = require('../models/EmailOtp');
const AppError = require('../utils/AppError');

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) throw new AppError(503, 'Email verification is not configured. Add SMTP settings to .env.');
  transporter = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
  return transporter;
}
function hashCode(code) { return crypto.createHash('sha256').update(`${code}:${process.env.SESSION_SECRET}`).digest('hex'); }

async function issueOtp({ key, email, purpose, complaintId }) {
  const mail = process.env.NODE_ENV === 'test' ? null : getTransporter();
  const code = process.env.NODE_ENV === 'test' ? '123456' : String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await EmailOtp.findOneAndUpdate({ key }, { $set: { email: email.toLowerCase(), purpose, complaintId: complaintId || null, codeHash: hashCode(code), attempts: 0, expiresAt } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (process.env.NODE_ENV === 'test') return;
  try {
    const subject = purpose === 'registration'
      ? 'UrbanReport email verification code'
      : purpose === 'complaint-resolution'
        ? 'UrbanReport resident resolution confirmation code'
        : 'UrbanReport password reset code';
    await mail.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email.toLowerCase(), subject, text: `Your UrbanReport verification code is ${code}. It expires in 10 minutes. If you did not request it, you can ignore this email.` });
  } catch (error) {
    await EmailOtp.deleteOne({ key });
    throw new AppError(503, 'We could not send the verification email. Check your SMTP settings and try again.');
  }
}

async function verifyOtp(key, candidate) {
  const otp = await EmailOtp.findOne({ key, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } });
  if (!otp || !/^\d{6}$/.test(String(candidate || ''))) return false;
  const expected = Buffer.from(otp.codeHash, 'hex');
  const actual = Buffer.from(hashCode(String(candidate)), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    otp.attempts += 1;
    if (otp.attempts >= 5) await otp.deleteOne(); else await otp.save();
    return false;
  }
  await otp.deleteOne();
  return true;
}

async function invalidateOtp(key) { await EmailOtp.deleteOne({ key }); }

module.exports = { issueOtp, verifyOtp, invalidateOtp };
