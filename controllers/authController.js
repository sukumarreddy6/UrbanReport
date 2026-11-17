const passport = require('passport');
const User = require('../models/User');
const wrapAsync = require('../utils/wrapAsync');
const AppError = require('../utils/AppError');
const Notification = require('../models/Notification');
const { issueOtp, verifyOtp } = require('../services/otpService');
const EmailOtp = require('../models/EmailOtp');

exports.showRegister = (_req, res) => res.render('auth/register', { title: 'Create account' });
exports.register = wrapAsync(async (req, res, next) => {
  const email = req.body.email.toLowerCase();
  if (!await verifyOtp(`registration:${email}`, req.body.otp)) { req.flash('error', 'The email verification code is invalid or expired.'); return res.redirect('/register'); }
  const user = new User({ fullName: req.body.fullName, email, role: 'citizen', emailVerified: true });
  try { await User.register(user, req.body.password); }
  catch (error) {
    if (error.name === 'UserExistsError' || error.code === 11000) { req.flash('error', 'An account with that email already exists.'); return res.redirect('/register'); }
    throw error;
  }
  const language = req.session.language;
  req.login(user, error => {
    if (error) return next(error);
    if (language) req.session.language = language;
    req.flash('success', 'Your citizen account is ready.');
    req.session.save(saveError => saveError ? next(saveError) : res.redirect('/dashboard'));
  });
});

exports.sendRegistrationOtp = wrapAsync(async (req, res) => {
  const email = req.body.email.toLowerCase();
  if (await User.exists({ email })) throw new AppError(409, 'An account with that email already exists.');
  await issueOtp({ key: `registration:${email}`, email, purpose: 'registration' });
  res.json({ message: 'Verification code sent. It is valid for 10 minutes.' });
});

exports.showForgotPassword = (req, res) => res.render('auth/forgot-password', { title: 'Reset password', stage: req.query.stage === 'reset' ? 'reset' : 'request', email: String(req.query.email || '') });
exports.sendPasswordResetOtp = wrapAsync(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email, isActive: true });
  if (user) await issueOtp({ key: `password-reset:${email}`, email, purpose: 'password-reset' });
  req.flash('success', 'If an active account uses that email, a reset code was sent.');
  res.redirect(`/forgot-password?email=${encodeURIComponent(email)}&stage=reset`);
});
exports.resetPassword = wrapAsync(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email, isActive: true });
  if (!user || !await verifyOtp(`password-reset:${email}`, req.body.otp)) {
    req.flash('error', 'The email or reset code is invalid or expired.');
    return res.redirect(`/forgot-password?email=${encodeURIComponent(email)}&stage=reset`);
  }
  await user.setPassword(req.body.password);
  await user.save();
  await EmailOtp.deleteMany({ email, purpose: 'password-reset' });
  req.flash('success', 'Password updated. Sign in with your new password.');
  res.redirect(`/login${user.role === 'citizen' ? '?portal=user' : `?portal=${user.role}`}`);
});

const portalRoles = { user: 'citizen', admin: 'admin', department: 'department', employee: 'employee' };
const portalTitles = { user: 'User sign in', admin: 'Admin sign in', department: 'Department sign in', employee: 'Employee sign in' };
exports.showLogin = (req, res) => {
  const portal = Object.hasOwn(portalRoles, req.query.portal) ? req.query.portal : '';
  res.render('auth/login', { title: portalTitles[portal] || 'Sign in', portal });
};
exports.login = (req, res, next) => passport.authenticate('local', (error, user) => {
  if (error) return next(error);
  const portal = Object.hasOwn(portalRoles, req.body.portal) ? req.body.portal : '';
  if (!user || !user.isActive || (portal && user.role !== portalRoles[portal])) { req.flash('error', 'Email or password is incorrect for this portal.'); return res.redirect(`/login${portal ? `?portal=${portal}` : ''}`); }
  const language = req.session.language;
  req.logIn(user, loginError => {
    if (loginError) return next(loginError);
    if (language) req.session.language = language;
    req.session.save(saveError => saveError ? next(saveError) : res.redirect('/dashboard'));
  });
})(req, res, next);

exports.logout = (req, res, next) => req.logout(error => {
  if (error) return next(error);
  req.session.destroy(sessionError => {
    if (sessionError) return next(sessionError);
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

exports.dashboard = (req, res) => {
  const destination = { citizen: '/citizen/dashboard', admin: '/admin/dashboard', department: '/department/dashboard', employee: '/employee/dashboard' }[req.user.role];
  if (!destination) throw new AppError(403, 'This account has no dashboard.');
  res.redirect(destination);
};

exports.profile = (_req, res) => res.render('auth/profile', { title: 'My profile' });
exports.updateProfile = wrapAsync(async (req, res) => {
  const { fullName, phoneNumber, address } = req.body;
  if (!fullName || fullName.trim().length < 2 || fullName.length > 100) { req.flash('error', 'Enter a name between 2 and 100 characters.'); return res.redirect('/profile'); }
  await User.updateOne({ _id: req.user._id }, { $set: { fullName: fullName.trim(), phoneNumber: String(phoneNumber || '').trim().slice(0, 30), address: String(address || '').trim().slice(0, 300) } });
  req.flash('success', 'Profile updated.');
  res.redirect('/profile');
});
exports.showChangePassword = (_req, res) => res.render('auth/change-password', { title: 'Change password', activePage: 'password' });
exports.changePassword = wrapAsync(async (req, res) => {
  if (req.body.currentPassword === req.body.newPassword) {
    req.flash('error', 'Choose a new password that differs from your current password.');
    return res.redirect('/profile/change-password');
  }
  try {
    await req.user.changePassword(req.body.currentPassword, req.body.newPassword);
  } catch (error) {
    if (['IncorrectPasswordError', 'MissingPasswordError'].includes(error.name)) {
      req.flash('error', 'Your current password is incorrect.');
      return res.redirect('/profile/change-password');
    }
    throw error;
  }
  req.flash('success', 'Your password has been changed.');
  res.redirect('/profile/change-password');
});
exports.notifications = wrapAsync(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.render('auth/notifications', { title: 'Notifications', activePage: 'notifications', notifications });
});
exports.readAllNotifications = wrapAsync(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  req.flash('success', 'Notifications marked as read.');
  res.redirect('/notifications');
});
exports.deleteNotification = wrapAsync(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, userId: req.user._id });
  req.flash('success', 'Notification removed.');
  res.redirect('/notifications');
});
exports.clearNotifications = wrapAsync(async (req, res) => {
  await Notification.deleteMany({ userId: req.user._id });
  req.flash('success', 'All notifications cleared.');
  res.redirect('/notifications');
});
