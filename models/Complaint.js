const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  assetId: { type: String, required: true },
  publicId: { type: String, required: true },
  url: { type: String, required: true },
  format: { type: String },
  bytes: { type: Number }
}, { _id: false });

const complaintSchema = new mongoose.Schema({
  sampleKey: { type: String, immutable: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  category: { type: String, required: true, enum: ['Road Damage', 'Waste & Sanitation', 'Water Supply', 'Street Lighting', 'Drainage & Sewage', 'Public Safety', 'Other'] },
  images: { type: [imageSchema], default: [] },
  resolutionImages: { type: [imageSchema], default: [] },
  location: {
    address: { type: String, required: true, trim: true, maxlength: 300 },
    coordinates: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } }
  },
  citizenId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  assignedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  priority: { type: String, enum: ['Low', 'Normal', 'High', 'Urgent'], default: 'Normal' },
  status: { type: String, enum: ['Submitted', 'Under Review', 'More Info Requested', 'Approved', 'Assigned', 'In Progress', 'Awaiting User Confirmation', 'Resolved', 'Rejected', 'Reopened'], default: 'Under Review', index: true },
  pendingResolutionRemarks: { type: String, trim: true, maxlength: 2000, default: '' },
  resolutionRemarks: { type: String, trim: true, maxlength: 2000, default: '' },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

complaintSchema.index({ citizenId: 1, createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });
complaintSchema.index({ assignedEmployeeId: 1, status: 1 });
complaintSchema.index({ 'location.coordinates': '2dsphere' });
complaintSchema.index({ sampleKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Complaint', complaintSchema);
