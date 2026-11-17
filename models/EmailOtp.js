const mongoose = require('mongoose');

const emailOtpSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  purpose: { type: String, required: true, enum: ['registration', 'complaint-resolution', 'password-reset'] },
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('EmailOtp', emailOtpSchema);
