const mongoose = require('mongoose');
const { CATEGORIES } = require('../utils/constants');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, enum: CATEGORIES },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);
