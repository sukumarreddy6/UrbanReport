const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true, enum: ['created', 'updated', 'status', 'assignment', 'priority', 'message', 'resolution'] },
  previousStatus: { type: String, default: null },
  newStatus: { type: String, default: null },
  remarks: { type: String, trim: true, maxlength: 2000, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });

eventSchema.index({ complaintId: 1, createdAt: 1 });
module.exports = mongoose.model('ComplaintEvent', eventSchema);
