const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  role: { type: String, enum: ['citizen', 'admin', 'department', 'employee'], default: 'citizen', required: true },
  emailVerified: { type: Boolean, default: false },
  phoneNumber: { type: String, trim: true, maxlength: 30 },
  address: { type: String, trim: true, maxlength: 300 },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  departmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.pre('validate', function () {
  if (this.role === 'department' && !this.departmentId) this.invalidate('departmentId', 'Department staff must belong to a department.');
  if (this.role === 'employee') {
    const memberships = [...(this.departmentIds || []).map(id => String(id))];
    if (this.departmentId && !memberships.includes(String(this.departmentId))) memberships.push(String(this.departmentId));
    this.departmentIds = [...new Set(memberships)];
    if (!this.departmentId && this.departmentIds.length) this.departmentId = this.departmentIds[0];
    if (this.isActive && !this.departmentIds.length) this.invalidate('departmentIds', 'Active employees must belong to at least one department.');
  } else {
    this.departmentIds = [];
    if (this.role !== 'department') this.departmentId = null;
  }
  if (this.role !== 'citizen') this.emailVerified = true;
});

userSchema.index({ role: 1, departmentIds: 1, isActive: 1 });

userSchema.plugin(passportLocalMongoose, {
  usernameField: 'email', usernameLowerCase: true, errorMessages: { UserExistsError: 'An account with that email already exists.' }
});

module.exports = mongoose.model('User', userSchema);
