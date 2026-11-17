const Joi = require('joi');
const { CATEGORIES, PRIORITIES, STATUSES } = require('../utils/constants');

const register = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().max(254).required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
  password: Joi.string().min(12).max(128).required(),
  _csrf: Joi.string().required()
});
const emailOtp = Joi.object({ email: Joi.string().trim().email().max(254).required(), _csrf: Joi.string().required() });
const passwordReset = Joi.object({ email: Joi.string().trim().email().max(254).required(), otp: Joi.string().pattern(/^\d{6}$/).required(), password: Joi.string().min(12).max(128).required(), confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords must match.' }), _csrf: Joi.string().required() });
const changePassword = Joi.object({ currentPassword: Joi.string().required(), newPassword: Joi.string().min(12).max(128).required(), confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required().messages({ 'any.only': 'Passwords must match.' }), _csrf: Joi.string().required() });
const login = Joi.object({ email: Joi.string().trim().email().required(), password: Joi.string().required(), portal: Joi.string().valid('user', 'admin', 'department', 'employee', '').allow('').optional(), _csrf: Joi.string().required() });
const complaint = Joi.object({
  title: Joi.string().trim().min(5).max(120).required(),
  description: Joi.string().trim().min(20).max(5000).required(),
  category: Joi.string().valid(...CATEGORIES).required(),
  locationAddress: Joi.string().trim().min(5).max(300).required(),
  latitude: Joi.number().min(-90).max(90).allow('', null),
  longitude: Joi.number().min(-180).max(180).allow('', null),
  _csrf: Joi.string().required()
});
const message = Joi.object({ body: Joi.string().trim().min(2).max(3000).required(), _csrf: Joi.string().required() });
const adminReview = Joi.object({ decision: Joi.string().valid('reject').required(), remarks: Joi.string().trim().max(2000).allow(''), _csrf: Joi.string().required() });
const assignment = Joi.object({ departmentId: Joi.string().hex().length(24).required(), _csrf: Joi.string().required() });
const adminComplaintStatus = Joi.object({ status: Joi.string().valid('Under Review', 'In Progress', 'Rejected').required(), remarks: Joi.string().trim().max(2000).allow(''), _csrf: Joi.string().required() });
const employeeAssignment = Joi.object({ employeeId: Joi.string().hex().length(24).required(), _csrf: Joi.string().required() });
const priority = Joi.object({ priority: Joi.string().valid(...PRIORITIES).required(), _csrf: Joi.string().required() });
const employeeStatus = Joi.object({ status: Joi.string().valid('In Progress', 'Resolved').required(), remarks: Joi.string().trim().max(2000).allow(''), _csrf: Joi.string().required() });
const department = Joi.object({ name: Joi.string().valid(...CATEGORIES).required(), description: Joi.string().trim().max(500).allow(''), _csrf: Joi.string().required() });
const employee = Joi.object({ fullName: Joi.string().trim().min(2).max(100).required(), email: Joi.string().trim().email().max(254).required(), password: Joi.string().min(12).max(128).required(), departmentId: Joi.string().hex().length(24).required(), _csrf: Joi.string().required() });
const employeeMembership = Joi.object({ email: Joi.string().trim().email().max(254).required(), _csrf: Joi.string().required() });
const departmentAccount = Joi.object({ fullName: Joi.string().trim().min(2).max(100).required(), email: Joi.string().trim().email().max(254).required(), password: Joi.string().min(12).max(128).required(), departmentId: Joi.string().hex().length(24).required(), _csrf: Joi.string().required() });
const reopen = Joi.object({ remarks: Joi.string().trim().min(5).max(1000).required(), _csrf: Joi.string().required() });
const resolutionOtp = Joi.object({ otp: Joi.string().pattern(/^\d{6}$/).required(), _csrf: Joi.string().required() });

module.exports = { register, emailOtp, passwordReset, changePassword, login, complaint, message, adminReview, assignment, adminComplaintStatus, employeeAssignment, priority, employeeStatus, department, employee, employeeMembership, departmentAccount, reopen, resolutionOtp };
