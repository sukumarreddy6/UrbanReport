require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const ComplaintEvent = require('../models/ComplaintEvent');
const ComplaintMessage = require('../models/ComplaintMessage');
const Notification = require('../models/Notification');
const { CATEGORIES } = require('../utils/constants');

const demoPassword = process.env.URBANREPORT_DEMO_PASSWORD;
if (process.env.NODE_ENV === 'production') throw new Error('Demo accounts cannot be seeded in production.');
if (!demoPassword || demoPassword.length < 12) throw new Error('Set URBANREPORT_DEMO_PASSWORD in .env (at least 12 characters) before seeding demo accounts.');

const departmentKeys = {
  'Road Damage': 'works',
  'Waste & Sanitation': 'services',
  'Water Supply': 'water',
  'Street Lighting': 'lighting',
  'Drainage & Sewage': 'drainage',
  'Public Safety': 'safety',
  Other: 'other'
};
const departmentDescriptions = {
  'Road Damage': 'Road surface, sidewalk, and pothole maintenance.',
  'Waste & Sanitation': 'Waste collection and neighborhood cleanliness.',
  'Water Supply': 'Public water service and supply issues.',
  'Street Lighting': 'Streetlights and public lighting infrastructure.',
  'Drainage & Sewage': 'Storm drains, sewage, and waterlogging concerns.',
  'Public Safety': 'Safety concerns affecting public spaces.',
  Other: 'Civic concerns that do not fit another category.'
};
const departmentSpecs = CATEGORIES.map(name => ({ key: departmentKeys[name], name, description: departmentDescriptions[name] }));

const userSpecs = [
  { key: 'worksManager', fullName: 'Kiran Desai', email: 'roads.manager@example.com', role: 'department', department: 'works', phoneNumber: '+91 90000 10001' },
  { key: 'servicesManager', fullName: 'Lavanya Rao', email: 'sanitation.manager@example.com', role: 'department', department: 'services', phoneNumber: '+91 90000 10002' },
  { key: 'worksEmployee', fullName: 'Neel Kapoor', email: 'roads.employee@example.com', role: 'employee', department: 'works', phoneNumber: '+91 90000 10003' },
  { key: 'servicesEmployee', fullName: 'Trisha Nair', email: 'sanitation.employee@example.com', role: 'employee', department: 'services', phoneNumber: '+91 90000 10004' },
  { key: 'waterManager', fullName: 'Dev Malhotra', email: 'water.manager@example.com', role: 'department', department: 'water', phoneNumber: '+91 90000 10007' },
  { key: 'waterEmployee', fullName: 'Isha Verma', email: 'water.employee@example.com', role: 'employee', department: 'water', phoneNumber: '+91 90000 10008' },
  { key: 'lightingManager', fullName: 'Meera Iyer', email: 'lighting.manager@example.com', role: 'department', department: 'lighting', phoneNumber: '+91 90000 10009' },
  { key: 'drainageManager', fullName: 'Arjun Menon', email: 'drainage.manager@example.com', role: 'department', department: 'drainage', phoneNumber: '+91 90000 10010' },
  { key: 'safetyManager', fullName: 'Farah Khan', email: 'safety.manager@example.com', role: 'department', department: 'safety', phoneNumber: '+91 90000 10011' },
  { key: 'otherManager', fullName: 'Rohan Das', email: 'other.manager@example.com', role: 'department', department: 'other', phoneNumber: '+91 90000 10012' },
  { key: 'worksEmployeeTwo', fullName: 'Aditi Rao', email: 'roads.employee2@example.com', role: 'employee', department: 'works', phoneNumber: '+91 90000 10013' },
  { key: 'servicesEmployeeTwo', fullName: 'Kabir Shah', email: 'sanitation.employee2@example.com', role: 'employee', department: 'services', phoneNumber: '+91 90000 10014' },
  { key: 'waterEmployeeTwo', fullName: 'Nisha Reddy', email: 'water.employee2@example.com', role: 'employee', department: 'water', phoneNumber: '+91 90000 10015' },
  { key: 'lightingEmployee', fullName: 'Sanjay Pillai', email: 'lighting.employee@example.com', role: 'employee', department: 'lighting', phoneNumber: '+91 90000 10016' },
  { key: 'lightingEmployeeTwo', fullName: 'Pooja Nair', email: 'lighting.employee2@example.com', role: 'employee', department: 'lighting', phoneNumber: '+91 90000 10017' },
  { key: 'drainageEmployee', fullName: 'Vikram Joshi', email: 'drainage.employee@example.com', role: 'employee', department: 'drainage', phoneNumber: '+91 90000 10018' },
  { key: 'drainageEmployeeTwo', fullName: 'Sana Thomas', email: 'drainage.employee2@example.com', role: 'employee', department: 'drainage', phoneNumber: '+91 90000 10019' },
  { key: 'safetyEmployee', fullName: 'Manoj Kumar', email: 'safety.employee@example.com', role: 'employee', department: 'safety', phoneNumber: '+91 90000 10020' },
  { key: 'safetyEmployeeTwo', fullName: 'Ritu Banerjee', email: 'safety.employee2@example.com', role: 'employee', department: 'safety', phoneNumber: '+91 90000 10021' },
  { key: 'otherEmployee', fullName: 'Adil Fernandes', email: 'other.employee@example.com', role: 'employee', department: 'other', phoneNumber: '+91 90000 10022' },
  { key: 'otherEmployeeTwo', fullName: 'Kavya Suresh', email: 'other.employee2@example.com', role: 'employee', department: 'other', phoneNumber: '+91 90000 10023' },
  { key: 'citizenOne', fullName: 'Vivek Sharma', email: 'vivek.sharma@example.com', role: 'citizen', phoneNumber: '+91 90000 10005', address: 'Anna Nagar, Chennai' },
  { key: 'citizenTwo', fullName: 'Anika Pillai', email: 'anika.pillai@example.com', role: 'citizen', phoneNumber: '+91 90000 10006', address: 'Adyar, Chennai' }
];

function dateHoursAgo(hours) { return new Date(Date.now() - hours * 60 * 60 * 1000); }

async function getOrCreateUser(spec, departments, counts) {
  const email = spec.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== spec.role) throw new Error(`Demo email ${email} already belongs to role ${existing.role}; no existing account was changed.`);
    if (spec.role === 'employee') {
      const departmentId = String(departments[spec.department]._id);
      const memberships = [...new Set([...(existing.departmentIds || []).map(id => String(id)), ...(existing.departmentId ? [String(existing.departmentId)] : []), departmentId])];
      existing.departmentIds = memberships;
      if (!existing.departmentId) existing.departmentId = departmentId;
      existing.isActive = true;
      await existing.save();
    }
    counts.usersReused += 1;
    return existing;
  }
  const user = new User({
    fullName: spec.fullName,
    email,
    role: spec.role,
    emailVerified: spec.role === 'citizen',
    phoneNumber: spec.phoneNumber,
    address: spec.address || '',
    departmentId: spec.department ? departments[spec.department]._id : null
  });
  await User.register(user, demoPassword);
  counts.usersCreated += 1;
  return user;
}

function pushStatus(events, complaintId, actorId, previousStatus, newStatus, remarks, createdAt) {
  events.push({ complaintId, actorId, type: 'status', previousStatus, newStatus, remarks, createdAt });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const staffOnly = process.argv.includes('--staff-only');
  const counts = { usersCreated: 0, usersReused: 0, complaintsCreated: 0, complaintsReused: 0 };
  for (const [oldName, newName] of [['Public Works & Roads', 'Road Damage'], ['Water & Sanitation Services', 'Waste & Sanitation']]) {
    const legacy = await Department.findOne({ name: oldName });
    if (!legacy) continue;
    const existingCategoryDepartment = await Department.findOne({ name: newName });
    if (!existingCategoryDepartment) {
      legacy.name = newName;
      legacy.description = departmentDescriptions[newName];
      await legacy.save();
    } else {
      await Promise.all([
        User.updateMany({ departmentId: legacy._id }, { $set: { departmentId: existingCategoryDepartment._id } }),
        Complaint.updateMany({ departmentId: legacy._id }, { $set: { departmentId: existingCategoryDepartment._id } })
      ]);
      await legacy.deleteOne();
    }
  }
  const departments = {};
  for (const spec of departmentSpecs) {
    departments[spec.key] = await Department.findOneAndUpdate(
      { name: spec.name },
      { $setOnInsert: { name: spec.name, description: spec.description, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const users = {};
  for (const spec of userSpecs) {
    if (staffOnly && !['department', 'employee'].includes(spec.role)) continue;
    users[spec.key] = await getOrCreateUser(spec, departments, counts);
  }
  if (staffOnly) {
    const staffByDepartment = Object.fromEntries(await Promise.all(departmentSpecs.map(async spec => [
      spec.name,
      {
        departmentAccounts: await User.countDocuments({ role: 'department', departmentId: departments[spec.key]._id, isActive: true }),
        employees: await User.countDocuments({ role: 'employee', isActive: true, $or: [{ departmentIds: departments[spec.key]._id }, { departmentId: departments[spec.key]._id }] })
      }
    ])));
    console.log(JSON.stringify({ ...counts, departments: departmentSpecs.length, staffByDepartment, demoPasswordSource: 'URBANREPORT_DEMO_PASSWORD in .env', emailsSent: 0 }, null, 2));
    return;
  }
  const admin = await User.findOne({ role: 'admin', isActive: true }).sort({ createdAt: 1 });
  if (!admin) throw new Error('Create an admin account before seeding demo reports.');

  const citizenOne = users.citizenOne;
  const citizenTwo = users.citizenTwo;
  const employeeOne = users.worksEmployee;
  const employeeTwo = users.servicesEmployee;
  const managerOne = users.worksManager;
  const managerTwo = users.servicesManager;
  const managerByDepartment = {
    works: managerOne, services: managerTwo, water: users.waterManager,
    lighting: users.lightingManager, drainage: users.drainageManager,
    safety: users.safetyManager, other: users.otherManager
  };
  const reportSpecs = [
    { key: 'sample-01', citizen: citizenOne, title: 'Pothole forming at the bus stop', category: 'Road Damage', address: '12th Main Road, Anna Nagar, Chennai', priority: 'High', status: 'Submitted', age: 3 },
    { key: 'sample-02', citizen: citizenTwo, title: 'Streetlight out near the park entrance', category: 'Street Lighting', address: 'Gandhi Park entrance, Adyar, Chennai', priority: 'Normal', status: 'Under Review', age: 20 },
    { key: 'sample-03', citizen: citizenOne, title: 'Waste bins overflowing beside the market', category: 'Waste & Sanitation', address: 'Market Road, Anna Nagar, Chennai', priority: 'High', status: 'More Info Requested', age: 30 },
    { key: 'sample-04', citizen: citizenTwo, title: 'Water pooling across the footpath', category: 'Drainage & Sewage', address: 'Canal Bank Road, Adyar, Chennai', priority: 'Normal', status: 'Rejected', age: 42 },
    { key: 'sample-05', citizen: citizenOne, title: 'Low water pressure in the neighborhood', category: 'Water Supply', address: '6th Avenue, Anna Nagar, Chennai', priority: 'Urgent', status: 'Approved', department: 'water', age: 52 },
    { key: 'sample-06', citizen: citizenTwo, title: 'Broken paving near the community hall', category: 'Road Damage', address: 'Community Hall Lane, Adyar, Chennai', priority: 'Normal', status: 'Assigned', department: 'works', employee: 'worksEmployee', age: 63 },
    { key: 'sample-07', citizen: citizenOne, title: 'Damaged road surface on the main street', category: 'Road Damage', address: '2nd Cross Street, Anna Nagar, Chennai', priority: 'Urgent', status: 'In Progress', department: 'works', employee: 'worksEmployee', age: 75 },
    { key: 'sample-08', citizen: citizenTwo, title: 'Public tap leaking continuously', category: 'Water Supply', address: 'Corporation Park, Adyar, Chennai', priority: 'High', status: 'Resolved', department: 'water', employee: 'waterEmployee', age: 92, resolutionRemarks: 'Replaced the damaged valve and checked that the leak stopped.' },
    { key: 'sample-09', citizen: citizenOne, title: 'Road damage needs a follow-up repair', category: 'Road Damage', address: '5th Street, Anna Nagar, Chennai', priority: 'High', status: 'Reopened', department: 'works', employee: 'worksEmployee', age: 105, resolutionRemarks: 'Temporary patch completed; resident reported the road surface remains uneven.' },
    { key: 'sample-10', citizen: citizenTwo, title: 'Missed waste collection this week', category: 'Waste & Sanitation', address: 'Greenways Road, Adyar, Chennai', priority: 'Normal', status: 'Assigned', department: 'services', employee: 'servicesEmployee', age: 116 },
    { key: 'sample-11', citizen: citizenOne, title: 'Uneven road surface after recent rain', category: 'Road Damage', address: 'School Road, Anna Nagar, Chennai', priority: 'High', status: 'In Progress', department: 'works', employee: 'worksEmployee', age: 128 },
    { key: 'sample-12', citizen: citizenTwo, title: 'Loose paving beside the public walkway', category: 'Road Damage', address: 'Riverside Walkway, Adyar, Chennai', priority: 'Low', status: 'Resolved', department: 'works', employee: 'worksEmployee', age: 145, resolutionRemarks: 'The loose paving section was secured and checked for stability.' },
    { key: 'sample-13', citizen: citizenOne, title: 'Damaged safety barrier beside a public space', category: 'Public Safety', address: 'Community playground, Anna Nagar, Chennai', priority: 'High', status: 'Approved', department: 'safety', age: 156 },
    { key: 'sample-14', citizen: citizenTwo, title: 'Public notice board needs repair', category: 'Other', address: 'Neighborhood library, Adyar, Chennai', priority: 'Low', status: 'Submitted', age: 168 }
  ];

  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  for (const spec of reportSpecs) {
    const createdAt = dateHoursAgo(spec.age);
    const assignedEmployeeId = spec.employee ? users[spec.employee]._id : null;
    const departmentId = spec.department ? departments[spec.department]._id : null;
    const complaintValues = {
      sampleKey: spec.key,
      title: spec.title,
      description: `Sample civic report: ${spec.title.toLowerCase()}. Please review the location and coordinate the appropriate neighborhood response.`,
      category: spec.category,
      location: { address: spec.address },
      citizenId: spec.citizen._id,
      departmentId,
      assignedEmployeeId,
      priority: spec.priority,
      status: spec.status,
      resolutionRemarks: spec.resolutionRemarks || '',
      resolvedAt: spec.status === 'Resolved' ? dateHoursAgo(24) : null,
      createdAt,
      updatedAt: dateHoursAgo(Math.max(1, Math.floor(spec.age / 3)))
    };
    let complaint = await Complaint.findOne({ sampleKey: spec.key });
    if (complaint) {
      Object.assign(complaint, complaintValues);
      await complaint.save();
      counts.complaintsReused += 1;
      await Promise.all([
        ComplaintEvent.deleteMany({ complaintId: complaint._id }),
        ComplaintMessage.deleteMany({ complaintId: complaint._id }),
        Notification.deleteMany({ complaintId: complaint._id })
      ]);
    } else {
      complaint = await Complaint.create(complaintValues);
      counts.complaintsCreated += 1;
    }

    const events = [{ complaintId: complaint._id, actorId: spec.citizen._id, type: 'created', remarks: 'Sample report submitted by a resident.', createdAt }];
    let previous = 'Submitted';
    const adminReviewPath = ['Under Review'];
    if (['More Info Requested', 'Rejected', 'Approved', 'Assigned', 'In Progress', 'Resolved', 'Reopened'].includes(spec.status)) adminReviewPath.push(spec.status === 'More Info Requested' ? 'More Info Requested' : spec.status === 'Rejected' ? 'Rejected' : 'Approved');
    for (const next of adminReviewPath) {
      if (next === 'Submitted' || next === previous) continue;
      const actor = next === 'In Progress' ? assignedEmployeeId : admin._id;
      pushStatus(events, complaint._id, actor, previous, next, next === 'More Info Requested' ? 'Please add a nearby landmark so the team can locate the issue.' : next === 'Rejected' ? 'This sample report does not meet the public-service reporting criteria.' : `Report moved to ${next.toLowerCase()}.`, dateHoursAgo(Math.max(0, spec.age - 1)));
      previous = next;
    }
    if (spec.department && ['Approved', 'Assigned', 'In Progress', 'Resolved', 'Reopened'].includes(spec.status)) {
      events.push({ complaintId: complaint._id, actorId: admin._id, type: 'assignment', remarks: `Routed to ${departments[spec.department].name}.`, metadata: { departmentId }, createdAt: dateHoursAgo(Math.max(0, spec.age - 2)) });
      if (spec.employee && previous === 'Approved') {
        const manager = managerByDepartment[spec.department];
        events.push({ complaintId: complaint._id, actorId: manager._id, type: 'assignment', remarks: `Assigned to ${users[spec.employee].fullName}.`, metadata: { employeeId: assignedEmployeeId, departmentId }, createdAt: dateHoursAgo(Math.max(0, spec.age - 3)) });
        pushStatus(events, complaint._id, manager._id, 'Approved', 'Assigned', 'Department assigned an employee.', dateHoursAgo(Math.max(0, spec.age - 3)));
        previous = 'Assigned';
      }
    }
    if (spec.status === 'In Progress' || spec.status === 'Resolved' || spec.status === 'Reopened') {
      if (previous === 'Assigned') {
        pushStatus(events, complaint._id, assignedEmployeeId, 'Assigned', 'In Progress', 'Employee started work on the report.', dateHoursAgo(Math.max(0, spec.age - 4)));
        previous = 'In Progress';
      }
      if (spec.status === 'Resolved' || spec.status === 'Reopened') {
        pushStatus(events, complaint._id, assignedEmployeeId, 'In Progress', 'Awaiting User Confirmation', spec.resolutionRemarks || 'Work completed; awaiting resident confirmation.', dateHoursAgo(Math.max(0, spec.age - 5)));
        pushStatus(events, complaint._id, spec.citizen._id, 'Awaiting User Confirmation', 'Resolved', 'Resident confirmed the completed work.', dateHoursAgo(Math.max(0, spec.age - 6)));
        if (spec.status === 'Reopened') pushStatus(events, complaint._id, spec.citizen._id, 'Resolved', 'Reopened', 'Resident requested follow-up because the issue remains.', dateHoursAgo(1));
      }
    }
    await ComplaintEvent.insertMany(events);
    if (spec.status === 'More Info Requested') {
      await ComplaintMessage.create({ complaintId: complaint._id, authorId: admin._id, body: 'Could you add a nearby landmark or exact entrance so the field team can find the bins?' });
    }
    if (spec.status === 'In Progress') {
      await ComplaintMessage.create({ complaintId: complaint._id, authorId: spec.citizen._id, body: 'The issue is near the main entrance. Thank you for looking into it.' });
    }
    await Promise.all([
      ...admins.map(user => Notification.create({ userId: user._id, complaintId: complaint._id, message: 'Sample civic report is available in the review queue.', href: `/admin/complaints/${complaint._id}` })),
      Notification.create({ userId: spec.citizen._id, complaintId: complaint._id, message: `Sample report status: ${spec.status}.`, href: `/citizen/complaints/${complaint._id}` }),
      ...(managerByDepartment[spec.department] ? [Notification.create({ userId: managerByDepartment[spec.department]._id, complaintId: complaint._id, message: 'A sample report is available in your department workspace.', href: `/department/complaints/${complaint._id}` })] : []),
      ...(assignedEmployeeId ? [Notification.create({ userId: assignedEmployeeId, complaintId: complaint._id, message: 'A sample report is assigned to your team.', href: `/employee/complaints/${complaint._id}` })] : [])
    ]);
  }

  const staffByDepartment = Object.fromEntries(await Promise.all(departmentSpecs.map(async spec => [
    spec.name,
    {
      departmentAccounts: await User.countDocuments({ role: 'department', departmentId: departments[spec.key]._id, isActive: true }),
      employees: await User.countDocuments({ role: 'employee', isActive: true, $or: [{ departmentIds: departments[spec.key]._id }, { departmentId: departments[spec.key]._id }] })
    }
  ])));
  console.log(JSON.stringify({ ...counts, departments: departmentSpecs.length, staffByDepartment, demoPasswordSource: 'URBANREPORT_DEMO_PASSWORD in .env', emailsSent: 0 }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
