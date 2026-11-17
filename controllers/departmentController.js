const Complaint = require('../models/Complaint');
const ComplaintEvent = require('../models/ComplaintEvent');
const ComplaintMessage = require('../models/ComplaintMessage');
const Department = require('../models/Department');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const wrapAsync = require('../utils/wrapAsync');
const { STATUS_FILTERS } = require('../utils/constants');
const { cloudinary } = require('../config/cloudinary');
const canonicalStatusCounts = require('../utils/statusCounts');
const { employeeMembershipFilter, hasDepartmentMembership } = require('../utils/employeeMembership');

exports.dashboard = wrapAsync(async (req, res) => {
  const departmentId = req.user.departmentId;
  const [department, total, awaitingEmployee, grouped, recent, teamSize, performance] = await Promise.all([
    Department.findOne({ _id: departmentId, isActive: true }).lean(),
    Complaint.countDocuments({ departmentId }),
    Complaint.countDocuments({ departmentId, assignedEmployeeId: null, status: { $in: ['In Progress', 'Approved', 'Assigned', 'Reopened'] } }),
    Complaint.aggregate([{ $match: { departmentId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.find({ departmentId }).populate('citizenId', 'fullName').populate('assignedEmployeeId', 'fullName').sort({ updatedAt: -1 }).limit(8).lean(),
    User.countDocuments(employeeMembershipFilter(departmentId, { isActive: true })),
    Complaint.aggregate([
      { $match: { departmentId, assignedEmployeeId: { $ne: null } } },
      { $group: { _id: '$assignedEmployeeId', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } }, active: { $sum: { $cond: [{ $ne: ['$status', 'Resolved'] }, 1, 0] } } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'employee' } }, { $unwind: '$employee' },
      { $project: { fullName: '$employee.fullName', total: 1, resolved: 1, active: 1 } }, { $sort: { resolved: -1, total: -1 } }, { $limit: 8 }
    ])
  ]);
  if (!department) throw new AppError(403, 'This department account is currently inactive. Contact an administrator.');
  res.render('department/dashboard', { title: 'Department overview', activePage: 'dashboard', department, total, awaitingEmployee, counts: canonicalStatusCounts(grouped), recent, teamSize, performance });
});

exports.list = wrapAsync(async (req, res) => {
  const filter = { departmentId: req.user.departmentId };
  const selectedStatus = STATUS_FILTERS.find(status => status.value === req.query.status);
  if (selectedStatus) filter.status = { $in: selectedStatus.statuses };
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const [complaints, total] = await Promise.all([
    Complaint.find(filter).populate('citizenId', 'fullName').populate('assignedEmployeeId', 'fullName').sort({ updatedAt: -1 }).skip((page - 1) * 15).limit(15).lean(),
    Complaint.countDocuments(filter)
  ]);
  res.render('department/complaints', { title: 'Department reports', activePage: 'complaints', complaints, statuses: STATUS_FILTERS, selectedStatus: selectedStatus?.value || '', page, pages: Math.max(1, Math.ceil(total / 15)) });
});

exports.show = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, departmentId: req.user.departmentId })
    .populate('citizenId', 'fullName').populate('assignedEmployeeId', 'fullName').populate('departmentId', 'name').lean();
  if (!complaint) throw new AppError(404, 'Report not found in this department.');
  complaint.images = complaint.images.map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  complaint.resolutionImages = (complaint.resolutionImages || []).map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  const [events, messages, employees] = await Promise.all([
    ComplaintEvent.find({ complaintId: complaint._id }).populate('actorId', 'fullName role').sort({ createdAt: 1 }).lean(),
    ComplaintMessage.find({ complaintId: complaint._id }).populate('authorId', 'fullName role').sort({ createdAt: 1 }).lean(),
    User.find(employeeMembershipFilter(req.user.departmentId, { isActive: true })).select('fullName').sort({ fullName: 1 }).lean()
  ]);
  res.render('department/complaint-detail', { title: complaint.title, activePage: 'complaints', complaint, events, messages, employees });
});

exports.assignEmployee = wrapAsync(async (req, res) => {
  const [complaint, employee] = await Promise.all([
    Complaint.findOne({ _id: req.params.id, departmentId: req.user.departmentId }),
    User.findOne(employeeMembershipFilter(req.user.departmentId, { _id: req.body.employeeId, isActive: true }))
  ]);
  if (!complaint) throw new AppError(404, 'Report not found in this department.');
  if (!employee) throw new AppError(400, 'Choose an active employee from your department.');
  if (!['Approved', 'Assigned', 'In Progress', 'Reopened'].includes(complaint.status)) throw new AppError(409, 'This report is not ready for department work.');
  if (complaint.assignedEmployeeId && complaint.status === 'In Progress') throw new AppError(409, 'The employee has accepted this assignment. Ask them to withdraw from work before reassigning it.');
  if (complaint.assignedEmployeeId && String(complaint.assignedEmployeeId) === String(employee._id)) throw new AppError(409, 'This report is already assigned to that employee. Choose a different employee.');
  const previousEmployeeId = complaint.assignedEmployeeId;
  complaint.assignedEmployeeId = employee._id;
  await complaint.save();
  const { recordEvent, changeStatus } = require('../services/complaintWorkflow');
  const { notify } = require('../services/notificationService');
  await recordEvent(complaint._id, req.user._id, 'assignment', `${previousEmployeeId ? 'Reassigned' : 'Assigned'} to ${employee.fullName}.`, { employeeId: employee._id, previousEmployeeId, departmentId: req.user.departmentId });
  if (complaint.status !== 'Assigned') await changeStatus(complaint._id, 'Assigned', req.user._id, 'Department assigned an employee.');
  await notify(employee._id, complaint._id, 'A report has been assigned to you.', `/employee/complaints/${complaint._id}`);
  req.flash('success', 'Report assigned to employee.');
  res.redirect(`/department/complaints/${complaint._id}`);
});

exports.removeEmployeeAssignment = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, departmentId: req.user.departmentId });
  if (!complaint) throw new AppError(404, 'Report not found in this department.');
  if (!complaint.assignedEmployeeId) throw new AppError(409, 'This report has no employee assignment to remove.');
  if (complaint.status !== 'Assigned') throw new AppError(409, 'An employee who has started work must withdraw before the department can change the assignment.');
  const previousEmployeeId = complaint.assignedEmployeeId;
  complaint.assignedEmployeeId = null;
  await complaint.save();
  await require('../services/complaintWorkflow').recordEvent(complaint._id, req.user._id, 'assignment', 'Employee assignment removed before acceptance.', { previousEmployeeId, departmentId: req.user.departmentId });
  await require('../services/notificationService').notify(previousEmployeeId, complaint._id, 'Your assignment was removed by the department before work started.', `/employee/complaints`);
  req.flash('success', 'Employee assignment removed. You can assign another employee.');
  res.redirect(`/department/complaints/${complaint._id}`);
});

exports.employees = wrapAsync(async (req, res) => {
  const [department, employees] = await Promise.all([
    Department.findOne({ _id: req.user.departmentId, isActive: true }).lean(),
    User.find(employeeMembershipFilter(req.user.departmentId)).populate('departmentIds', 'name').populate('departmentId', 'name').sort({ fullName: 1 }).lean()
  ]);
  if (!department) throw new AppError(403, 'This department account is currently inactive. Contact an administrator.');
  res.render('department/employees', { title: 'Department employees', activePage: 'employees', department, employees });
});

exports.createEmployee = wrapAsync(async (req, res) => {
  const department = await Department.findOne({ _id: req.user.departmentId, isActive: true });
  if (!department) throw new AppError(403, 'This department account is currently inactive. Contact an administrator.');
  try {
    await User.register(new User({ fullName: req.body.fullName, email: req.body.email.toLowerCase(), role: 'employee', departmentId: department._id, departmentIds: [department._id] }), req.body.password);
  } catch (error) {
    if (error.name === 'UserExistsError' || error.code === 11000) { req.flash('error', 'An account with that email already exists. Use “Add existing employee” to give that employee access to this department.'); return res.redirect('/department/employees'); }
    throw error;
  }
  req.flash('success', 'Employee account created.');
  res.redirect('/department/employees');
});

exports.addExistingEmployee = wrapAsync(async (req, res) => {
  const department = await Department.findOne({ _id: req.user.departmentId, isActive: true });
  if (!department) throw new AppError(403, 'This department account is currently inactive. Contact an administrator.');
  const employee = await User.findOne({ role: 'employee', email: req.body.email.toLowerCase() });
  if (!employee) throw new AppError(404, 'No employee account was found for that email. Create an employee account first or check the address.');
  if (hasDepartmentMembership(employee, department._id)) throw new AppError(409, 'This employee already belongs to your department.');
  employee.departmentIds = [...new Set([...(employee.departmentIds || []).map(id => String(id)), String(department._id)])];
  if (!employee.departmentId) employee.departmentId = department._id;
  employee.isActive = true;
  await employee.save();
  req.flash('success', `${employee.fullName} can now receive assignments from ${department.name}.`);
  res.redirect('/department/employees');
});

exports.removeEmployeeMembership = wrapAsync(async (req, res) => {
  const [employee, activeAssignments] = await Promise.all([
    User.findOne(employeeMembershipFilter(req.user.departmentId, { _id: req.params.id })),
    Complaint.countDocuments({ assignedEmployeeId: req.params.id, departmentId: req.user.departmentId, status: { $nin: ['Resolved', 'Rejected'] } })
  ]);
  if (!employee) throw new AppError(404, 'Employee not found in this department.');
  if (activeAssignments) throw new AppError(409, 'Reassign this employee’s active reports before removing their department membership.');
  const departmentId = String(req.user.departmentId);
  const memberships = [...new Set([...(employee.departmentIds || []).map(id => String(id)), ...(employee.departmentId ? [String(employee.departmentId)] : [])])]
    .filter(id => id !== departmentId);
  employee.departmentIds = memberships;
  employee.departmentId = memberships[0] || null;
  if (!memberships.length) employee.isActive = false;
  await employee.save();
  req.flash('success', memberships.length ? 'Employee removed from this department. Their other department memberships remain active.' : 'Employee removed from the department and account deactivated because it has no remaining department memberships.');
  res.redirect('/department/employees');
});
