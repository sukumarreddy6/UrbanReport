const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
  message: { type: String, required: true, maxlength: 2400 },
  href: { type: String, required: true, maxlength: 300 },
  readAt: { type: Date, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
