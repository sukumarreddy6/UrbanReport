const Complaint = require('../models/Complaint');
const ComplaintEvent = require('../models/ComplaintEvent');
const ComplaintMessage = require('../models/ComplaintMessage');
const { uploadImage, deleteImages } = require('../services/imageService');
const { changeStatus, recordEvent } = require('../services/complaintWorkflow');
const { cloudinary } = require('../config/cloudinary');
const wrapAsync = require('../utils/wrapAsync');
const AppError = require('../utils/AppError');
const { STATUSES, CATEGORIES } = require('../utils/constants');
const { notify } = require('../services/notificationService');
const User = require('../models/User');
const { issueOtp, verifyOtp } = require('../services/otpService');
const canonicalStatusCounts = require('../utils/statusCounts');

exports.dashboard = wrapAsync(async (req, res) => {
  const userId = req.user._id;
  const [total, recent, counts, pendingConfirmations] = await Promise.all([
    Complaint.countDocuments({ citizenId: userId }),
    Complaint.find({ citizenId: userId }).sort({ createdAt: -1 }).limit(5).lean(),
    Complaint.aggregate([{ $match: { citizenId: userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.find({ citizenId: userId, status: 'Awaiting User Confirmation' }).sort({ updatedAt: -1 }).limit(10).lean()
  ]);
  pendingConfirmations.forEach(complaint => {
    complaint.resolutionImages = (complaint.resolutionImages || []).map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  });
  res.render('citizen/dashboard', { title: 'My dashboard', activePage: 'dashboard', total, recent, pendingConfirmations, counts: canonicalStatusCounts(counts) });
});

exports.list = wrapAsync(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const filter = { citizenId: req.user._id };
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  const [complaints, total] = await Promise.all([
    Complaint.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 10).limit(10).lean(),
    Complaint.countDocuments(filter)
  ]);
  const paginationQuery = new URLSearchParams(Object.entries(req.query).filter(([key, value]) => key !== 'page' && value)).toString();
  res.render('citizen/complaints', { title: 'My reports', activePage: 'complaints', complaints, page, pages: Math.max(1, Math.ceil(total / 10)), statuses: STATUSES, categories: CATEGORIES, filters: req.query, paginationQuery });
});

exports.newForm = (_req, res) => res.render('citizen/new-complaint', { title: 'Report an issue', activePage: 'report', categories: CATEGORIES, complaint: null, isEdit: false });

exports.editForm = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, citizenId: req.user._id, status: { $in: ['Submitted', 'Under Review'] } }).lean();
  if (!complaint) throw new AppError(409, 'Reports can only be edited before review is complete.');
  complaint.images = complaint.images.map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  complaint.resolutionImages = (complaint.resolutionImages || []).map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  res.render('citizen/new-complaint', { title: 'Edit report', activePage: 'report', categories: CATEGORIES, complaint, isEdit: true });
});

exports.create = wrapAsync(async (req, res) => {
  const images = [];
  try { for (const file of req.files || []) images.push(await uploadImage(file)); }
  catch (error) { await deleteImages(images); throw error; }
  let complaint;
  try {
    const hasCoordinates = req.body.latitude !== '' && req.body.longitude !== '' && req.body.latitude != null && req.body.longitude != null;
    complaint = await Complaint.create({
      title: req.body.title, description: req.body.description, category: req.body.category,
      location: { address: req.body.locationAddress, ...(hasCoordinates ? { coordinates: { type: 'Point', coordinates: [Number(req.body.longitude), Number(req.body.latitude)] } } : {}) },
      images, citizenId: req.user._id, status: 'Under Review'
    });
    await recordEvent(complaint._id, req.user._id, 'created', 'Complaint submitted and placed Under Review.');
  } catch (error) { await deleteImages(images); throw error; }
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  await Promise.all(admins.map(admin => notify(admin._id, complaint._id, 'A new civic report is ready for review.', `/admin/complaints/${complaint._id}`)));
  req.flash('success', 'Your report has been submitted.');
  res.redirect('/citizen/dashboard');
});

exports.update = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, citizenId: req.user._id, status: { $in: ['Submitted', 'Under Review'] } });
  if (!complaint) throw new AppError(409, 'Reports can only be edited before review is complete.');
  if (complaint.images.length + (req.files || []).length > 5) throw new AppError(400, 'A report can have up to five photos.');
  const images = [];
  try { for (const file of req.files || []) images.push(await uploadImage(file)); }
  catch (error) { await deleteImages(images); throw error; }
  try {
    const hasCoordinates = req.body.latitude !== '' && req.body.longitude !== '' && req.body.latitude != null && req.body.longitude != null;
    const location = { address: req.body.locationAddress, ...(hasCoordinates ? { coordinates: { type: 'Point', coordinates: [Number(req.body.longitude), Number(req.body.latitude)] } } : {}) };
    const updated = await Complaint.findOneAndUpdate(
      { _id: complaint._id, citizenId: req.user._id, status: { $in: ['Submitted', 'Under Review'] } },
      { $set: { title: req.body.title, description: req.body.description, category: req.body.category, location }, $push: { images: { $each: images } } },
      { new: true, runValidators: true }
    );
    if (!updated) throw new AppError(409, 'This report has moved beyond review and can no longer be edited.');
    await recordEvent(updated._id, req.user._id, 'updated', 'Resident edited the report while it was under review.');
  } catch (error) { await deleteImages(images); throw error; }
  req.flash('success', 'Your report has been updated.');
  res.redirect(`/citizen/complaints/${complaint._id}`);
});

exports.remove = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOneAndDelete({ _id: req.params.id, citizenId: req.user._id, status: { $in: ['Submitted', 'Under Review'] } });
  if (!complaint) throw new AppError(409, 'Reports can only be deleted before review is complete.');
  await Promise.all([
    deleteImages(complaint.images),
    ComplaintEvent.deleteMany({ complaintId: complaint._id }),
    ComplaintMessage.deleteMany({ complaintId: complaint._id })
  ]);
  req.flash('success', 'Your report has been deleted.');
  res.redirect('/citizen/complaints');
});

exports.show = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, citizenId: req.user._id }).populate('departmentId assignedEmployeeId', 'name fullName').lean();
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  complaint.images = complaint.images.map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  complaint.resolutionImages = (complaint.resolutionImages || []).map(image => ({ ...image, displayUrl: cloudinary.url(image.publicId, { secure: true, type: 'private', sign_url: true }) }));
  const [events, messages] = await Promise.all([
    ComplaintEvent.find({ complaintId: complaint._id }).populate('actorId', 'fullName role').sort({ createdAt: 1 }).lean(),
    ComplaintMessage.find({ complaintId: complaint._id }).populate('authorId', 'fullName role').sort({ createdAt: 1 }).lean()
  ]);
  res.render('citizen/complaint-detail', { title: complaint.title, activePage: 'complaints', complaint, events, messages });
});

exports.message = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, citizenId: req.user._id });
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  if (!['Under Review', 'In Progress', 'Approved', 'Assigned', 'Reopened', 'Awaiting User Confirmation', 'More Info Requested'].includes(complaint.status)) throw new AppError(409, 'Additional information can no longer be added to this report.');
  const message = await ComplaintMessage.create({ complaintId: complaint._id, authorId: req.user._id, body: req.body.body });
  await recordEvent(complaint._id, req.user._id, 'message', 'Additional information added.', { messageId: message._id });
  if (complaint.assignedEmployeeId) await notify(complaint.assignedEmployeeId, complaint._id, 'A resident added information to an assigned report.', `/employee/complaints/${complaint._id}`);
  if (complaint.status === 'More Info Requested') await changeStatus(complaint._id, 'Under Review', req.user._id, 'Citizen provided the requested information.');
  req.flash('success', 'Your update has been added.');
  res.redirect(`/citizen/complaints/${complaint._id}`);
});

exports.reopen = wrapAsync(async (req, res) => {
  const complaint = await Complaint.findOne({ _id: req.params.id, citizenId: req.user._id });
  if (!complaint) throw new AppError(404, 'Complaint not found.');
  if (!complaint.resolvedAt || Date.now() - complaint.resolvedAt.getTime() > 7 * 24 * 60 * 60 * 1000) throw new AppError(409, 'Resolved reports can be reopened within seven days.');
  await changeStatus(complaint._id, 'Reopened', req.user._id, req.body.remarks);
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  await Promise.all(admins.map(admin => notify(admin._id, complaint._id, 'A resident reopened a resolved report.', `/admin/complaints/${complaint._id}`)));
  req.flash('success', 'Your report has been reopened for review.');
  res.redirect(`/citizen/complaints/${complaint._id}`);
});

exports.confirmResolution = wrapAsync(async (req, res) => {
  const redirectTo = req.query.next === 'dashboard' ? '/citizen/dashboard' : `/citizen/complaints/${req.params.id}`;
  const complaint = await Complaint.findOne({ _id: req.params.id, citizenId: req.user._id, status: 'Awaiting User Confirmation' });
  if (!complaint) {
    req.flash('error', 'This report is no longer waiting for confirmation. Refresh your reports to see its current status.');
    return res.redirect(redirectTo);
  }
  if (!await verifyOtp(`complaint-resolution:${complaint._id}`, req.body.otp)) {
    req.flash('error', 'That code is invalid, expired, or already used. Request a new code and try again.');
    return res.redirect(redirectTo);
  }
  await changeStatus(complaint._id, 'Resolved', req.user._id, 'Resident confirmed the resolution by email code.');
  req.flash('success', 'Resolution confirmed. Thank you for reviewing the completed work.');
  res.redirect(redirectTo);
});

exports.resendResolutionCode = wrapAsync(async (req, res) => {
  const redirectTo = req.query.next === 'dashboard' ? '/citizen/dashboard' : `/citizen/complaints/${req.params.id}`;
  const complaint = await Complaint.findOne({ _id: req.params.id, citizenId: req.user._id, status: 'Awaiting User Confirmation' });
  if (!complaint) {
    req.flash('error', 'This report is no longer waiting for confirmation. Refresh your reports to see its current status.');
    return res.redirect(redirectTo);
  }
  if (!req.user.email) throw new AppError(409, 'Your account does not have an email address for confirmation.');
  await issueOtp({ key: `complaint-resolution:${complaint._id}`, email: req.user.email, purpose: 'complaint-resolution', complaintId: complaint._id });
  req.flash('success', `A new confirmation code was sent to ${req.user.email}. Any earlier code is no longer valid.`);
  res.redirect(redirectTo);
});

