const Complaint = require('../models/Complaint');
const ComplaintEvent = require('../models/ComplaintEvent');
const ComplaintMessage = require('../models/ComplaintMessage');
const { changeStatus, recordEvent } = require('../services/complaintWorkflow');
const wrapAsync = require('../utils/wrapAsync');
const AppError = require('../utils/AppError');
const { cloudinary } = require('../config/cloudinary');
const { issueOtp, invalidateOtp } = require('../services/otpService');
const canonicalStatusCounts = require('../utils/statusCounts');
const { uploadImage, deleteImages } = require('../services/imageService');
const { notify } = require('../services/notificationService');
const User = require('../models/User');

exports.dashboard = wrapAsync(async (req, res) => {
  const filter = { assignedEmployeeId: req.user._id };
  const [counts, recent] = await Promise.all([
    Complaint.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.find(filter).populate('departmentId', 'name').sort({ updatedAt: -1 }).limit(8).lean()
  ]);
  res.render('employee/dashboard', { title: 'My work', activePage: 'dashboard', counts: canonicalStatusCounts(counts), recent });
});

exports.list = wrapAsync(async (req, res) => {
  const filter = { assignedEmployeeId: req.user._id };
  if (['Assigned', 'In Progress', 'Awaiting User Confirmation', 'Resolved', 'Reopened'].includes(req.query.status)) filter.status = req.query.status;
  const complaints = await Complaint.find(filter).populate('departmentId', 'name').sort({ updatedAt: -1 }).limit(100).lean();
  res.render('employee/complaints', { title: 'Assigned complaints', activePage: 'complaints', complaints, selectedStatus: req.query.status || '' });
});

exports.show = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, assignedEmployeeId: req.user._id }).populate('departmentId', 'name').populate('citizenId', 'fullName').lean();
  if (!complaint) throw new AppError(404, 'Assigned complaint not found.');
  complaint.images = complaint.images.map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  complaint.resolutionImages = (complaint.resolutionImages || []).map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  const [events, messages] = await Promise.all([
    ComplaintEvent.find({ complaintId: complaint._id }).populate('actorId', 'fullName role').sort({ createdAt: 1 }).lean(),
    ComplaintMessage.find({ complaintId: complaint._id }).populate('authorId', 'fullName role').sort({ createdAt: 1 }).lean()
  ]);
  res.render('employee/complaint-detail', { title: complaint.title, activePage: 'complaints', complaint, events, messages });
});

exports.updateStatus = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, assignedEmployeeId: req.user._id }).populate('citizenId', 'email role');
  if (!complaint) throw new AppError(404, 'Assigned complaint not found.');
  if (req.body.status === 'Resolved') {
    if (complaint.status !== 'In Progress') throw new AppError(409, 'Start work before requesting resolution confirmation.');
    if (req.body.remarks.trim().length < 5) throw new AppError(400, 'Add resolution details before requesting confirmation.');
    if (!req.files?.length) throw new AppError(400, 'Upload at least one proof-of-work photo before submitting the completion request.');
    if ((complaint.resolutionImages?.length || 0) + req.files.length > 5) throw new AppError(400, 'A completion request can include up to five proof photos.');
    if (!complaint.citizenId || complaint.citizenId.role !== 'citizen' || !complaint.citizenId.email) throw new AppError(409, 'The report resident account is unavailable for confirmation. Contact an administrator.');
    const proofImages = [];
    try {
      for (const file of req.files) proofImages.push(await uploadImage(file));
      complaint.resolutionImages ||= [];
      complaint.resolutionImages.push(...proofImages);
      await complaint.save();
      await issueOtp({ key: `complaint-resolution:${complaint._id}`, email: complaint.citizenId.email, purpose: 'complaint-resolution', complaintId: complaint._id });
      await changeStatus(complaint._id, 'Awaiting User Confirmation', req.user._id, req.body.remarks);
    } catch (error) {
      if (proofImages.length) {
        await Complaint.updateOne({ _id: complaint._id }, { $pull: { resolutionImages: { publicId: { $in: proofImages.map(image => image.publicId) } } } });
        await deleteImages(proofImages);
      }
      throw error;
    }
    req.flash('success', 'Resolution details sent to the resident for email confirmation.');
  } else {
    await changeStatus(complaint._id, req.body.status, req.user._id, req.body.remarks || '');
    req.flash('success', `Complaint marked ${req.body.status.toLowerCase()}.`);
  }
  res.redirect(`/employee/complaints/${complaint._id}`);
});

exports.withdraw = wrapAsync(async (req, res) => {
  const remarks = 'Employee withdrew from active work; department may reassign this report.';
  const complaint = await Complaint.findOneAndUpdate(
    { _id: req.params.id, assignedEmployeeId: req.user._id, status: 'In Progress' },
    { $set: { status: 'Assigned', assignedEmployeeId: null } },
    { new: true, runValidators: true }
  );
  if (!complaint) throw new AppError(409, 'You can withdraw only from an active assignment you accepted, before submitting it for resolution.');
  await ComplaintEvent.create({ complaintId: complaint._id, actorId: req.user._id, type: 'status', previousStatus: 'In Progress', newStatus: 'Assigned', remarks });
  await recordEvent(complaint._id, req.user._id, 'assignment', 'Employee withdrew from the assignment.', { previousEmployeeId: req.user._id, departmentId: complaint.departmentId });
  await notify(complaint.citizenId, complaint._id, 'Your report is back with the department for reassignment.', `/citizen/complaints/${complaint._id}`);
  const departmentUsers = await User.find({ role: 'department', departmentId: complaint.departmentId, isActive: true }).select('_id').lean();
  await Promise.all(departmentUsers.map(account => notify(account._id, complaint._id, 'An employee withdrew from an active report. Reassignment is needed.', `/department/complaints/${complaint._id}`)));
  req.flash('success', 'You withdrew from this report. The department can now assign another employee.');
  res.redirect('/employee/complaints');
});

exports.withdrawResolution = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, assignedEmployeeId: req.user._id, status: 'Awaiting User Confirmation' });
  if (!complaint) throw new AppError(409, 'Only an unconfirmed resolution request can be withdrawn.');
  const proofImages = complaint.resolutionImages || [];
  await changeStatus(complaint._id, 'In Progress', req.user._id, 'Employee withdrew the resolution request before resident confirmation. Work returned to In Progress.');
  await invalidateOtp(`complaint-resolution:${complaint._id}`);
  await deleteImages(proofImages);
  req.flash('success', 'Resolution request withdrawn. The report is back In Progress.');
  res.redirect(`/employee/complaints/${complaint._id}`);
});

