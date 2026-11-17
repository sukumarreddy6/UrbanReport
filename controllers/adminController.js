const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const ComplaintEvent = require('../models/ComplaintEvent');
const Department = require('../models/Department');
const User = require('../models/User');
const { changeStatus, recordEvent } = require('../services/complaintWorkflow');
const wrapAsync = require('../utils/wrapAsync');
const AppError = require('../utils/AppError');
const { CATEGORIES, STATUSES, PRIORITIES } = require('../utils/constants');
const { notify } = require('../services/notificationService');
const canonicalStatusCounts = require('../utils/statusCounts');

exports.dashboard = wrapAsync(async (_req, res) => {
  const since = new Date(); since.setDate(since.getDate() - 13); since.setHours(0, 0, 0, 0);
  const [total, grouped, recent, departments, departmentPerformance, categories, resolution, submittedTrend, resolvedTrend] = await Promise.all([
    Complaint.countDocuments(),
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.find().populate('citizenId', 'fullName').sort({ createdAt: -1 }).limit(8).lean(),
    Complaint.aggregate([{ $match: { departmentId: { $ne: null } } }, { $group: { _id: '$departmentId', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }, { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } }, { $unwind: '$department' }]),
    Complaint.aggregate([
      { $match: { departmentId: { $ne: null } } },
      { $group: {
        _id: '$departmentId', total: { $sum: 1 },
        // Every routed report contributes to the department total. Its active
        // workload includes all statuses except terminal resolved/rejected.
        inProgress: { $sum: { $cond: [{ $not: [{ $in: ['$status', ['Resolved', 'Rejected']] }] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } }
      } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: '$department' },
      { $project: { _id: 0, departmentId: '$_id', name: '$department.name', total: 1, inProgress: 1, resolved: 1, rejected: 1 } },
      { $sort: { total: -1, resolved: -1, name: 1 } }
    ]),
    Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Complaint.aggregate([{ $match: { status: 'Resolved', resolvedAt: { $ne: null } } }, { $project: { days: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 86400000] } } }, { $group: { _id: null, averageDays: { $avg: '$days' }, resolvedCount: { $sum: 1 } } }]),
    Complaint.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $match: { resolvedAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt' } }, count: { $sum: 1 } } }])
  ]);
  const dayLabels = Array.from({ length: 14 }, (_, index) => { const day = new Date(since); day.setDate(day.getDate() + index); return day.toISOString().slice(0, 10); });
  const byDate = rows => Object.fromEntries(rows.map(row => [row._id, row.count]));
  const submittedByDate = byDate(submittedTrend); const resolvedByDate = byDate(resolvedTrend);
  res.render('admin/dashboard', { title: 'Operations overview', activePage: 'dashboard', total, counts: canonicalStatusCounts(grouped), recent, departments, departmentPerformance, categories, resolution: resolution[0] || { averageDays: null, resolvedCount: 0 }, dayLabels, submittedTrend: dayLabels.map(day => submittedByDate[day] || 0), resolvedTrend: dayLabels.map(day => resolvedByDate[day] || 0) });
});

exports.listComplaints = wrapAsync(async (req, res) => {
  const pageValue = Number.parseInt(req.query.page, 10);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const filter = {};
  const queryValue = value => typeof value === 'string' ? value.trim() : '';
  const status = queryValue(req.query.status);
  const category = queryValue(req.query.category);
  const priority = queryValue(req.query.priority);
  const departmentId = queryValue(req.query.department);
  if (STATUSES.includes(status)) filter.status = status;
  if (CATEGORIES.includes(category)) filter.category = category;
  if (PRIORITIES.includes(priority)) filter.priority = priority;
  if (mongoose.isValidObjectId(departmentId)) filter.departmentId = new mongoose.Types.ObjectId(departmentId);
  const parseDateBoundary = (value, isEnd = false) => {
    const raw = queryValue(value);
    if (!raw) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) throw new AppError(400, 'Enter valid date filters.');
    const [, year, month, day] = match.map(Number);
    const date = new Date(year, month - 1, day, isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new AppError(400, 'Enter valid date filters.');
    return date;
  };
  const startDate = parseDateBoundary(req.query.start);
  const endDate = parseDateBoundary(req.query.end, true);
  if (startDate && endDate && startDate > endDate) throw new AppError(400, 'The start date must be on or before the end date.');
  if (startDate || endDate) filter.createdAt = { ...(startDate ? { $gte: startDate } : {}), ...(endDate ? { $lte: endDate } : {}) };
  const search = queryValue(req.query.q).slice(0, 120);
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: regex }, { description: regex }, { 'location.address': regex }];
  }
  const sortChoice = ['newest', 'oldest', 'priority'].includes(req.query.sort) ? req.query.sort : 'newest';
  let complaintsQuery;
  if (sortChoice === 'priority') {
    complaintsQuery = Complaint.aggregate([
      { $match: filter },
      { $addFields: { priorityOrder: { $indexOfArray: [['Urgent', 'High', 'Normal', 'Low'], '$priority'] } } },
      { $sort: { priorityOrder: 1, createdAt: -1 } }, { $skip: (page - 1) * 15 }, { $limit: 15 }, { $project: { priorityOrder: 0 } }
    ]).then(items => Complaint.populate(items, [
      { path: 'citizenId', select: 'fullName' }, { path: 'departmentId', select: 'name' }, { path: 'assignedEmployeeId', select: 'fullName' }
    ]));
  } else {
    complaintsQuery = Complaint.find(filter).populate('citizenId departmentId assignedEmployeeId', 'fullName name').sort({ createdAt: sortChoice === 'oldest' ? 1 : -1 }).skip((page - 1) * 15).limit(15).lean();
  }
  const [complaints, total, departments] = await Promise.all([
    complaintsQuery,
    Complaint.countDocuments(filter), Department.find({ isActive: true }).sort({ name: 1 }).lean()
  ]);
  const cleanQuery = { q: search, status, category, priority, department: departmentId, start: queryValue(req.query.start), end: queryValue(req.query.end), sort: sortChoice };
  const paginationQuery = new URLSearchParams(Object.entries(cleanQuery).filter(([, value]) => value)).toString();
  res.render('admin/complaints', { title: 'Complaint queue', activePage: 'complaints', complaints, page, pages: Math.max(1, Math.ceil(total / 15)), statuses: STATUSES, categories: CATEGORIES, priorities: PRIORITIES, departments, filters: { ...cleanQuery }, sortChoice, paginationQuery });
});

exports.showComplaint = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id).populate('citizenId departmentId assignedEmployeeId', 'fullName name email').lean();
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  const [events, messages] = await Promise.all([
    ComplaintEvent.find({ complaintId: complaint._id }).populate('actorId', 'fullName role').sort({ createdAt: 1 }).lean(),
    require('../models/ComplaintMessage').find({ complaintId: complaint._id }).populate('authorId', 'fullName role').sort({ createdAt: 1 }).lean()
  ]);
  const departments = await Department.find({ isActive: true }).sort({ name: 1 }).lean();
  const { cloudinary } = require('../config/cloudinary');
  complaint.images = complaint.images.map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  complaint.resolutionImages = (complaint.resolutionImages || []).map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  res.render('admin/complaint-detail', { title: complaint.title, activePage: 'complaints', complaint, events, messages, departments, priorities: PRIORITIES });
});

exports.review = wrapAsync(async (req, res) => {
  if (req.body.decision !== 'reject') throw new AppError(400, 'Choose Reject or forward the complaint to a department.');
  if (!req.body.remarks?.trim()) throw new AppError(400, 'Add a reason for rejecting this complaint.');
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  if (!['Submitted', 'Under Review'].includes(complaint.status) && !(complaint.departmentId && !complaint.assignedEmployeeId && complaint.status === 'In Progress')) throw new AppError(409, 'This complaint can no longer be rejected by an administrator.');
  await changeStatus(req.params.id, 'Rejected', req.user._id, req.body.remarks.trim());
  req.flash('success', 'Complaint rejected.');
  res.redirect(`/admin/complaints/${req.params.id}`);
});

exports.assign = wrapAsync(async (req, res) => {
  const [complaint, department] = await Promise.all([
    Complaint.findById(req.params.id), Department.findOne({ _id: req.body.departmentId, isActive: true })
  ]);
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  if (!department) throw new AppError(400, 'Choose an active department.');
  if (!['Submitted', 'Under Review', 'More Info Requested', 'Approved', 'Assigned', 'In Progress', 'Reopened'].includes(complaint.status)) throw new AppError(409, 'This complaint is not awaiting department routing.');
  if (complaint.assignedEmployeeId) throw new AppError(409, 'The department cannot be changed after an employee has been assigned.');
  const previousDepartmentId = complaint.departmentId;
  if (previousDepartmentId && String(previousDepartmentId) === String(department._id)) throw new AppError(409, 'This complaint is already assigned to that department. Choose a different department.');
  complaint.departmentId = department._id;
  await complaint.save();
  if (['Submitted', 'Under Review'].includes(complaint.status)) {
    await changeStatus(complaint._id, 'In Progress', req.user._id, `Forwarded to ${department.name}.`);
  }
  const action = previousDepartmentId ? `Department changed to ${department.name}.` : `Forwarded to ${department.name}.`;
  await recordEvent(complaint._id, req.user._id, 'assignment', action, { departmentId: department._id, previousDepartmentId });
  const departmentUsers = await User.find({ role: 'department', departmentId: department._id, isActive: true }).select('_id').lean();
  await Promise.all(departmentUsers.map(account => notify(account._id, complaint._id, 'A report was assigned to your department.', `/department/complaints/${complaint._id}`)));
  req.flash('success', 'Complaint routed to department.');
  res.redirect(`/admin/complaints/${complaint._id}`);
});

exports.removeDepartmentAssignment = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id).populate('departmentId', 'name');
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  if (!complaint.departmentId) throw new AppError(409, 'This complaint has no department assignment to remove.');
  if (complaint.assignedEmployeeId) throw new AppError(409, 'The department cannot be removed after an employee has been assigned.');
  if (!['Submitted', 'Under Review', 'More Info Requested', 'Approved', 'Assigned', 'In Progress', 'Reopened'].includes(complaint.status)) throw new AppError(409, 'This complaint can no longer be returned to review.');
  const previousDepartmentId = complaint.departmentId._id;
  const previousDepartmentName = complaint.departmentId.name;
  const previousStatus = complaint.status;
  const remarks = `Returned to review after removing ${previousDepartmentName} department assignment.`;
  const updated = await Complaint.findOneAndUpdate(
    { _id: complaint._id, departmentId: previousDepartmentId, assignedEmployeeId: null, status: previousStatus },
    { $set: { departmentId: null, assignedEmployeeId: null, status: 'Under Review' } },
    { new: true, runValidators: true }
  );
  if (!updated) throw new AppError(409, 'The assignment changed while you were removing it. Refresh the report and try again.');
  if (previousStatus !== 'Under Review') {
    await ComplaintEvent.create({ complaintId: complaint._id, actorId: req.user._id, type: 'status', previousStatus, newStatus: 'Under Review', remarks });
    await notify(updated.citizenId, updated._id, 'Your report is back Under Review for department assignment.', `/citizen/complaints/${updated._id}`);
  }
  await recordEvent(complaint._id, req.user._id, 'assignment', `Department assignment to ${previousDepartmentName} was removed.`, { previousDepartmentId });
  const departmentUsers = await User.find({ role: 'department', departmentId: previousDepartmentId, isActive: true }).select('_id').lean();
  await Promise.all(departmentUsers.map(account => notify(account._id, complaint._id, 'A report was returned to administrator review.', `/admin/complaints/${complaint._id}`)));
  req.flash('success', 'Department assignment removed. The report is back Under Review.');
  res.redirect(`/admin/complaints/${complaint._id}`);
});

exports.updateUnassignedComplaintStatus = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  if (!complaint.departmentId || complaint.assignedEmployeeId) throw new AppError(409, 'Admin status changes are only available before the department assigns an employee.');
  if (!['Submitted', 'Under Review', 'In Progress'].includes(complaint.status)) throw new AppError(409, 'This complaint is no longer awaiting department assignment.');
  if (req.body.status === 'Rejected' && !req.body.remarks?.trim()) throw new AppError(400, 'Add a reason for rejecting this complaint.');
  await changeStatus(complaint._id, req.body.status, req.user._id, req.body.remarks?.trim() || 'Status updated by administrator before employee assignment.');
  req.flash('success', `Complaint status changed to ${req.body.status}.`);
  res.redirect(`/admin/complaints/${complaint._id}`);
});

exports.setPriority = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  const previous = complaint.priority;
  complaint.priority = req.body.priority;
  await complaint.save();
  await recordEvent(complaint._id, req.user._id, 'priority', `Priority changed from ${previous} to ${complaint.priority}.`);
  req.flash('success', 'Priority updated.');
  res.redirect(`/admin/complaints/${complaint._id}`);
});

exports.departments = wrapAsync(async (_req, res) => {
  const [departments, departmentUsers] = await Promise.all([
    Department.find().sort({ name: 1 }).lean(),
    User.find({ role: 'department' }).populate('departmentId', 'name').sort({ createdAt: -1 }).lean()
  ]);
  res.render('admin/departments', { title: 'Departments', activePage: 'departments', departments, departmentUsers, activeDepartments: departments.filter(d => d.isActive), categories: CATEGORIES });
});
exports.createDepartment = wrapAsync(async (req, res) => {
  try { await Department.create({ name: req.body.name, description: req.body.description }); }
  catch (error) { if (error.code === 11000) { req.flash('error', 'A department with that name already exists.'); return res.redirect('/admin/departments'); } throw error; }
  req.flash('success', 'Department created.'); res.redirect('/admin/departments');
});
exports.toggleDepartment = wrapAsync(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw new AppError(404, 'Department not found.');
  department.isActive = !department.isActive; await department.save();
  req.flash('success', `Department ${department.isActive ? 'activated' : 'deactivated'}.`); res.redirect('/admin/departments');
});

exports.createDepartmentAccount = wrapAsync(async (req, res) => {
  const department = await Department.findOne({ _id: req.body.departmentId, isActive: true });
  if (!department) throw new AppError(400, 'Choose an active department.');
  try {
    await User.register(new User({ fullName: req.body.fullName, email: req.body.email.toLowerCase(), role: 'department', departmentId: department._id }), req.body.password);
  } catch (error) {
    if (error.name === 'UserExistsError' || error.code === 11000) { req.flash('error', 'An account with that email already exists.'); return res.redirect('/admin/departments'); }
    throw error;
  }
  req.flash('success', 'Department account created.');
  res.redirect('/admin/departments');
});

exports.toggleDepartmentAccount = wrapAsync(async (req, res) => {
  const account = await User.findOne({ _id: req.params.id, role: 'department' });
  if (!account) throw new AppError(404, 'Department account not found.');
  account.isActive = !account.isActive;
  await account.save();
  req.flash('success', `Department account ${account.isActive ? 'activated' : 'deactivated'}.`);
  res.redirect('/admin/departments');
});


