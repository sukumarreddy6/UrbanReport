require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const ComplaintEvent = require('../models/ComplaintEvent');
const ComplaintMessage = require('../models/ComplaintMessage');
const Notification = require('../models/Notification');
const Department = require('../models/Department');
const EmailOtp = require('../models/EmailOtp');

const base = process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const tag = `codex-e2e-${Date.now()}`;
const email = `${tag}@example.com`;
let cookie = '';
let admin;
let manager;
let employee;
let department;
let createdDepartment = false;
let complaintId;

function assert(condition, message) { if (!condition) throw new Error(message); }
function csrf(html) {
  const match = html.match(/name="_csrf" value="([a-f0-9]+)"/i);
  assert(match, 'CSRF field was not rendered');
  return match[1];
}
async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set('cookie', cookie);
  let response;
  try { response = await fetch(`${base}${path}`, { ...options, headers, redirect: 'manual' }); }
  catch (error) { throw new Error(`request ${path} failed: ${error.message}`); }
  const setCookies = response.headers.getSetCookie?.() || [];
  for (const setCookie of setCookies) {
    if (/connect\.sid=/.test(setCookie)) cookie = setCookie.split(';')[0];
  }
  return response;
}
async function form(path, fields, referer) {
  return request(path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', referer: `${base}${referer}` }, body: new URLSearchParams(fields) });
}
async function login(emailAddress, password, portal = '') {
  const page = await request(`/login${portal ? `?portal=${portal}` : ''}`);
  assert(page.status === 200, 'sign-in page failed');
  const token = csrf(await page.text());
  const response = await form('/login', { _csrf: token, email: emailAddress, password, portal }, `/login${portal ? `?portal=${portal}` : ''}`);
  assert(response.status === 302 && response.headers.get('location') === '/dashboard', `sign-in failed for ${portal || 'default'} portal`);
}
async function logout() {
  const page = await request('/profile');
  assert(page.status === 200, 'profile page failed');
  const response = await form('/logout', { _csrf: csrf(await page.text()) }, '/profile');
  assert(response.status === 302 && response.headers.get('location') === '/', 'sign-out failed');
}

async function main() {
  assert(process.env.MONGODB_URI, 'MONGODB_URI is required');
  let user;
  try {
    const health = await request('/health');
    assert(health.status === 200 && (await health.json()).status === 'ok', 'health route failed');
    let response = await request('/');
    assert(response.status === 200 && (await response.text()).includes('UrbanReport'), 'landing page failed');

    response = await request('/register');
    assert(response.status === 200, 'register page failed');
    const registerToken = csrf(await response.text());
    response = await form('/register/send-otp', { _csrf: registerToken, email }, '/register');
    assert(response.status === 200, 'registration email verification code could not be issued');
    response = await form('/register', { _csrf: registerToken, fullName: 'UrbanReport E2E Resident', email, otp: '123456', password: 'UrbanReport-test-pass-12' }, '/register');
    if (response.status !== 302 || response.headers.get('location') !== '/dashboard') {
      const failedRegistration = await request('/register');
      const details = (await failedRegistration.text()).match(/class="alert[^>]*>(.*?)<\/div>/s)?.[1]?.replace(/<[^>]+>/g, ' ').trim();
      throw new Error(`registration failed (${response.status}, ${response.headers.get('location')}: ${details || 'no flash message'})`);
    }
    user = await User.findOne({ email });
    assert(user && user.role === 'citizen', 'resident account was not created with the citizen role');

    response = await request('/citizen/dashboard');
    assert(response.status === 200 && (await response.text()).includes('My reports'), 'resident dashboard failed');
    response = await request('/citizen/complaints');
    assert(response.status === 200 && (await response.text()).includes('My reports'), 'resident My Reports route failed');
    response = await request('/citizen/complaints/new');
    assert(response.status === 200, 'new report form failed');
    const reportToken = csrf(await response.text());
    response = await form('/citizen/complaints', {
      _csrf: reportToken, title: 'Broken sidewalk near the library', description: 'The sidewalk has a broken section that blocks safe walking for residents.', category: 'Road Damage', locationAddress: 'Central Library, Main Street'
    }, '/citizen/complaints/new');
    assert(response.status === 302 && /^\/citizen\/complaints\/[a-f0-9]{24}$/.test(response.headers.get('location') || ''), `report submission failed (${response.status})`);
    complaintId = response.headers.get('location').split('/').pop();
    assert(await Complaint.exists({ _id: complaintId, citizenId: user._id }), 'report was not saved for its resident');
    response = await request(`/citizen/complaints/${complaintId}`);
    assert(response.status === 200 && (await response.text()).includes('Broken sidewalk near the library'), 'report detail page failed');
    response = await request('/citizen/complaints?status=Under%20Review&category=Road%20Damage');
    const filteredMyReports = await response.text();
    assert(response.status === 200 && filteredMyReports.includes('Broken sidewalk near the library') && filteredMyReports.includes('value="Under Review" selected') && filteredMyReports.includes('value="Road Damage" selected') && filteredMyReports.includes('Clear filters'), 'citizen status/category filters failed to display matching report, selected values, and clear action');
    response = await request('/citizen/complaints');
    assert(response.status === 200 && !(await response.text()).includes('clear-filters'), 'clear filters destination still shows active filters');
    response = await request('/citizen/complaints?status=Resolved&category=Road%20Damage');
    assert(response.status === 200 && (await response.text()).includes('No matching reports'), 'citizen filters failed to hide non-matching reports');
    response = await request('/admin/dashboard');
    assert(response.status === 403, `citizen access to admin dashboard should be forbidden (${response.status})`);

    department = await Department.findOne({ name: 'Road Damage' });
    if (!department) {
      department = await Department.create({ name: 'Road Damage', description: 'Temporary e2e department' });
      createdDepartment = true;
    }
    admin = await User.register(new User({ fullName: 'UrbanReport E2E Admin', email: `${tag}-admin@example.com`, role: 'admin' }), 'UrbanReport-admin-pass-12');
    await logout();
    await login(admin.email, 'UrbanReport-admin-pass-12', 'admin');
    response = await request('/admin/dashboard');
    assert(response.status === 200 && (await response.text()).includes('Complaint activity'), 'admin analytics dashboard failed');
    response = await request('/admin/complaints');
    assert(response.status === 200, 'admin complaint queue failed');
    response = await request('/admin/complaints?status=Under%20Review&category=Road%20Damage');
    const filteredQueue = await response.text();
    assert(response.status === 200 && filteredQueue.includes('Broken sidewalk near the library') && filteredQueue.includes('Clear filters') && !filteredQueue.includes('Recent sample unrelated report'), 'admin status/category filters did not return the matching report and clear-filter action');
    response = await request('/admin/departments');
    assert(response.status === 200, 'admin department management page failed');
    const accountToken = csrf(await response.text());
    response = await form('/admin/departments/accounts', { _csrf: accountToken, fullName: 'UrbanReport E2E Department Lead', email: `${tag}-department@example.com`, password: 'UrbanReport-department-pass-12', departmentId: String(department._id) }, '/admin/departments');
    assert(response.status === 302, 'admin could not create department sign-in account');
    manager = await User.findOne({ email: `${tag}-department@example.com` });
    assert(manager?.role === 'department', 'department account was not provisioned');
    response = await request(`/admin/complaints/${complaintId}`);
    assert(response.status === 200, 'admin complaint review page failed');
    let adminPage = await response.text();
    let adminToken = csrf(adminPage);
    assert(adminPage.includes('Reject complaint') && adminPage.includes('Forward to department'), 'admin decision page did not offer reject and direct department routing');
    response = await request(`/admin/complaints/${complaintId}/assignment`, { method: 'PUT', headers: { 'content-type': 'application/x-www-form-urlencoded', referer: `${base}/admin/complaints/${complaintId}` }, body: new URLSearchParams({ _csrf: adminToken, departmentId: String(department._id) }) });
    assert(response.status === 302, 'admin department routing failed');
    const forwardedComplaint = await Complaint.findById(complaintId);
    assert(forwardedComplaint.status === 'In Progress' && String(forwardedComplaint.departmentId) === String(department._id), 'forwarding did not set the department and move the report into progress');
    await logout();
    await login(manager.email, 'UrbanReport-department-pass-12', 'department');
    response = await request('/department/dashboard');
    assert(response.status === 200 && (await response.text()).includes(department.name), 'department workspace failed');
    response = await request(`/department/complaints/${complaintId}`);
    assert(response.status === 200, 'department could not view its routed complaint');
    let departmentPage = await response.text();
    let departmentToken = csrf(departmentPage);
    response = await form('/department/employees', { _csrf: departmentToken, fullName: 'UrbanReport E2E Employee', email: `${tag}-employee@example.com`, password: 'UrbanReport-employee-pass-12', departmentId: String(department._id) }, '/department/complaints');
    assert(response.status === 302, 'department could not create its employee account');
    employee = await User.findOne({ email: `${tag}-employee@example.com` });
    assert(employee?.role === 'employee' && String(employee.departmentId) === String(department._id), 'employee was not created within the department');
    response = await request(`/department/complaints/${complaintId}`);
    departmentPage = await response.text(); departmentToken = csrf(departmentPage);
    response = await form(`/department/complaints/${complaintId}/assignment`, { _csrf: departmentToken, employeeId: String(employee._id) }, `/department/complaints/${complaintId}`);
    assert(response.status === 302, 'department could not assign a report to its employee');
    await logout();
    await login(employee.email, 'UrbanReport-employee-pass-12', 'employee');
    response = await request('/employee/dashboard');
    assert(response.status === 200, 'employee assigned work dashboard failed');
    response = await request(`/employee/complaints/${complaintId}`);
    assert(response.status === 200, 'employee complaint details failed');
    let employeePage = await response.text();
    let employeeToken = csrf(employeePage);
    response = await request(`/employee/complaints/${complaintId}/status`, { method: 'PATCH', headers: { 'content-type': 'application/x-www-form-urlencoded', referer: `${base}/employee/complaints/${complaintId}` }, body: new URLSearchParams({ _csrf: employeeToken, status: 'In Progress', remarks: '' }) });
    assert(response.status === 302, 'employee could not start assigned work');
    response = await request(`/employee/complaints/${complaintId}`);
    employeePage = await response.text(); employeeToken = csrf(employeePage);
    response = await request(`/employee/complaints/${complaintId}/status`, { method: 'PATCH', headers: { 'content-type': 'application/x-www-form-urlencoded', referer: `${base}/employee/complaints/${complaintId}` }, body: new URLSearchParams({ _csrf: employeeToken, status: 'Resolved', remarks: 'Sidewalk repaired and checked.' }) });
    assert(response.status === 302, 'employee could not resolve assigned work');
    await logout();
    await login(email, 'UrbanReport-test-pass-12', 'user');
    response = await request(`/citizen/complaints/${complaintId}`);
    let citizenPage = await response.text();
    assert(response.status === 200 && citizenPage.includes('Sidewalk repaired and checked.') && citizenPage.includes('Confirm resolution'), 'resident could not review resolution update');
    response = await form(`/citizen/complaints/${complaintId}/confirm-resolution`, { _csrf: csrf(citizenPage), otp: '123456' }, `/citizen/complaints/${complaintId}`);
    assert(response.status === 302, 'resident could not confirm completed work');
    response = await request(`/citizen/complaints/${complaintId}`);
    assert(response.status === 200 && (await Complaint.exists({ _id: complaintId, status: 'Resolved' })), 'resident confirmation did not resolve the report');
    const reopenPage = await request(`/citizen/complaints/${complaintId}`);
    const reopenToken = csrf(await reopenPage.text());
    response = await form(`/citizen/complaints/${complaintId}/reopen`, { _csrf: reopenToken, remarks: 'The sidewalk is still not safe for walking.' }, `/citizen/complaints/${complaintId}`);
    assert(response.status === 302, 'resident could not reopen a recently resolved report');
    response = await request('/citizen/complaints');
    const reportsPage = await response.text();
    response = await form('/language', { _csrf: csrf(reportsPage), language: 'ta', returnTo: '/citizen/complaints' }, '/citizen/complaints');
    assert(response.status === 302 && response.headers.get('location') === '/citizen/complaints', 'language switch did not return to My reports');
    response = await request('/citizen/complaints');
    assert(response.status === 200 && /[\u0B80-\u0BFF]/.test(await response.text()), 'language switch lost authentication or Tamil did not render on My reports');
    const tamilReports = await request('/citizen/complaints');
    response = await form('/language', { _csrf: csrf(await tamilReports.text()), language: 'en', returnTo: '/citizen/complaints' }, '/citizen/complaints');
    assert(response.status === 302 && response.headers.get('location') === '/citizen/complaints', 'switching back to English lost the current route');
    response = await request('/citizen/complaints');
    assert(response.status === 200 && (await response.text()).includes('My reports'), 'language switch back to English lost the citizen session');

    response = await request('/profile');
    assert(response.status === 200, 'profile page failed');
    const logoutToken = csrf(await response.text());
    response = await form('/logout', { _csrf: logoutToken }, '/profile');
    assert(response.status === 302 && response.headers.get('location') === '/', 'sign-out flow failed');
    response = await request('/forgot-password');
    assert(response.status === 200 && (await response.text()).includes('Send reset code'), 'forgot-password page failed');
    response = await form('/forgot-password/send-code', { _csrf: csrf(await (await request('/forgot-password')).text()), email }, '/forgot-password');
    assert(response.status === 302 && response.headers.get('location')?.includes('/forgot-password?email='), 'forgot-password code request failed');
    response = await request(`/forgot-password?email=${encodeURIComponent(email)}&stage=reset`);
    const resetPage = await response.text();
    assert(response.status === 200 && resetPage.includes('New password') && resetPage.includes('If an active account uses that email'), 'password-reset form failed');
    response = await form('/forgot-password/reset', { _csrf: csrf(resetPage), email, otp: '123456', password: 'UrbanReport-reset-pass-12', confirmPassword: 'different-password-12' }, `/forgot-password?email=${encodeURIComponent(email)}&stage=reset`);
    assert(response.status === 302 && await EmailOtp.exists({ email, purpose: 'password-reset' }), 'password reset accepted mismatched confirmation');
    response = await form('/forgot-password/reset', { _csrf: csrf(resetPage), email, otp: '123456', password: 'UrbanReport-reset-pass-12', confirmPassword: 'UrbanReport-reset-pass-12' }, `/forgot-password?email=${encodeURIComponent(email)}&stage=reset`);
    assert(response.status === 302 && response.headers.get('location') === '/login?portal=user', `password reset submission failed (${response.status}, ${response.headers.get('location')})`);
    await login(email, 'UrbanReport-reset-pass-12', 'user');
    response = await request('/profile/change-password');
    const changePasswordPage = await response.text();
    assert(response.status === 200 && changePasswordPage.includes('Current password') && changePasswordPage.includes('New password'), 'change-password page failed');
    response = await form('/profile/change-password', { _csrf: csrf(changePasswordPage), currentPassword: 'UrbanReport-reset-pass-12', newPassword: 'UrbanReport-changed-pass-12', confirmPassword: 'UrbanReport-changed-pass-12' }, '/profile/change-password');
    assert(response.status === 302, 'change-password submission failed');
    await logout();
    await login(email, 'UrbanReport-changed-pass-12', 'user');
    await logout();
    const unknownEmail = `${tag}-unknown@example.com`;
    response = await request('/forgot-password');
    response = await form('/forgot-password/send-code', { _csrf: csrf(await response.text()), email: unknownEmail }, '/forgot-password');
    assert(response.status === 302 && !(await EmailOtp.exists({ email: unknownEmail, purpose: 'password-reset' })), 'password-reset code was issued for an unregistered address');
    response = await request(`/forgot-password?email=${encodeURIComponent(unknownEmail)}&stage=reset`);
    const unknownResetPage = await response.text();
    response = await form('/forgot-password/reset', { _csrf: csrf(unknownResetPage), email: unknownEmail, otp: '123456', password: 'UrbanReport-reset-pass-12', confirmPassword: 'UrbanReport-reset-pass-12' }, `/forgot-password?email=${encodeURIComponent(unknownEmail)}&stage=reset`);
    assert(response.status === 302 && !(await User.exists({ email: unknownEmail })), `unregistered email unexpectedly reset a password (${response.status}, ${response.headers.get('location')})`);
    response = await request('/login');
    assert(response.status === 200, 'sign-in page failed');
    console.log('E2E passed: health, landing, OTP registration, resident reports, role access, admin queue filters/review/routing, department employee management, employee status/resolution request, resident confirmation/reopen, Tamil, password reset/change/sign-in, and sign-out.');
  } finally {
    user ||= await User.findOne({ email });
    if (complaintId) {
      await Promise.all([ComplaintEvent.deleteMany({ complaintId }), ComplaintMessage.deleteMany({ complaintId }), Notification.deleteMany({ complaintId }), Complaint.deleteOne({ _id: complaintId })]);
    }
    if (createdDepartment && department) await Department.deleteOne({ _id: department._id });
    if (employee) await User.deleteOne({ _id: employee._id });
    if (manager) await User.deleteOne({ _id: manager._id });
    if (admin) await User.deleteOne({ _id: admin._id });
    if (user) {
      await Promise.all([
        Complaint.deleteMany({ citizenId: user._id }),
        ComplaintEvent.deleteMany({ actorId: user._id }),
        ComplaintMessage.deleteMany({ authorId: user._id }),
        Notification.deleteMany({ userId: user._id })
      ]);
      await User.deleteOne({ _id: user._id });
    }
    await EmailOtp.deleteMany({ $or: [{ email }, ...(complaintId ? [{ complaintId: complaintId }] : [])] });
  }
}

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  .then(main)
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
