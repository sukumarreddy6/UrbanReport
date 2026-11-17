const Complaint = require('../models/Complaint');
const ComplaintEvent = require('../models/ComplaintEvent');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { notify } = require('./notificationService');

const transitions = {
  'Submitted': ['Under Review', 'In Progress', 'Rejected'],
  'Under Review': ['Approved', 'In Progress', 'Rejected', 'More Info Requested'],
  'More Info Requested': ['Under Review'],
  'Approved': ['Assigned'],
  'Assigned': ['In Progress'],
  'In Progress': ['Assigned', 'Awaiting User Confirmation', 'Under Review', 'Rejected'],
  'Awaiting User Confirmation': ['Resolved', 'In Progress'],
  'Resolved': ['Reopened'],
  'Reopened': ['Assigned', 'Under Review']
};
transitions.Approved.push('Under Review');
transitions.Assigned.push('Under Review');

async function changeStatus(complaintId, newStatus, actorId, remarks = '') {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  if (!(transitions[complaint.status] || []).includes(newStatus)) throw new AppError(409, `Cannot move a complaint from ${complaint.status} to ${newStatus}.`);
  const previousStatus = complaint.status;
  const updates = { status: newStatus };
  if (newStatus === 'Awaiting User Confirmation') updates.pendingResolutionRemarks = remarks;
  if (newStatus === 'In Progress' && previousStatus === 'Awaiting User Confirmation') {
    updates.pendingResolutionRemarks = '';
    updates.resolutionImages = [];
  }
  if (newStatus === 'Resolved') { updates.resolutionRemarks = complaint.pendingResolutionRemarks || remarks; updates.pendingResolutionRemarks = ''; updates.resolvedAt = new Date(); }
  if (newStatus === 'Reopened') updates.resolvedAt = null;
  const result = await Complaint.findOneAndUpdate(
    { _id: complaintId, status: previousStatus },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!result) throw new AppError(409, 'This report changed while you were updating it. Refresh and try again.');
  await ComplaintEvent.create({ complaintId, actorId, type: 'status', previousStatus, newStatus, remarks });
  if (String(result.citizenId) !== String(actorId)) {
    let message = `Your report is now ${newStatus.toLowerCase()}.`;
    if (newStatus === 'Awaiting User Confirmation' && remarks) message = `The team reported this work complete: ${remarks}`;
    if (newStatus === 'Rejected') message = `Your report was rejected.${remarks ? ` Reason: ${remarks}` : ''}`;
    await notify(result.citizenId, result._id, message, `/citizen/complaints/${result._id}`);
  }
  if (['Rejected', 'Resolved'].includes(newStatus)) {
    const [departmentAccounts, admins] = await Promise.all([
      result.departmentId ? User.find({ role: 'department', departmentId: result.departmentId, isActive: true }).select('_id').lean() : [],
      User.find({ role: 'admin', isActive: true }).select('_id').lean()
    ]);
    const recipients = new Map();
    departmentAccounts.forEach(account => recipients.set(String(account._id), 'department'));
    admins.forEach(account => recipients.set(String(account._id), 'admin'));
    if (result.assignedEmployeeId) recipients.set(String(result.assignedEmployeeId), 'employee');
    recipients.delete(String(actorId));
    const detail = newStatus === 'Resolved' ? result.resolutionRemarks : remarks;
    const message = `${newStatus === 'Resolved' ? 'Resident confirmed the report as resolved.' : 'A report was rejected.'}${detail ? ` Details: ${detail}` : ''}`;
    await Promise.all([...recipients].map(([userId, role]) => notify(userId, result._id, message, `/${role}/complaints/${result._id}`)));
  }
  return result;
}

async function recordEvent(complaintId, actorId, type, remarks = '', metadata = {}) {
  await ComplaintEvent.create({ complaintId, actorId, type, remarks, metadata });
}

module.exports = { transitions, changeStatus, recordEvent };
