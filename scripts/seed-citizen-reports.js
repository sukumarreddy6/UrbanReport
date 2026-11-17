require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const ComplaintEvent = require('../models/ComplaintEvent');
const { CATEGORIES } = require('../utils/constants');

if (process.env.NODE_ENV === 'production') throw new Error('Sample citizen reports cannot be seeded in production.');

const departmentKeys = {
  'Road Damage': 'roads',
  'Waste & Sanitation': 'waste',
  'Water Supply': 'water',
  'Street Lighting': 'lighting',
  'Drainage & Sewage': 'drainage',
  'Public Safety': 'safety',
  Other: 'other'
};

const samples = [
  { title: 'Pothole near the neighborhood bus stop', category: 'Road Damage', address: 'Anna Nagar 2nd Avenue, Chennai', status: 'Submitted' },
  { title: 'Streetlight not working near the park', category: 'Street Lighting', address: 'Shanti Colony Park entrance, Chennai', status: 'Under Review' },
  { title: 'Missed garbage collection on our street', category: 'Waste & Sanitation', address: 'Anna Nagar 5th Main Road, Chennai', status: 'More Info Requested' },
  { title: 'Damaged public notice board', category: 'Other', address: 'Community Library, Anna Nagar, Chennai', status: 'Rejected' },
  { title: 'Broken pavement beside the school', category: 'Road Damage', address: 'Shenoy Nagar School Road, Chennai', department: 'roads', status: 'Assigned' },
  { title: 'Road surface is sinking after the rain', category: 'Road Damage', address: 'Anna Nagar West, Chennai', department: 'roads', status: 'In Progress' },
  { title: 'Overflowing public waste bins', category: 'Waste & Sanitation', address: 'Market Street, Anna Nagar, Chennai', department: 'waste', status: 'Assigned' },
  { title: 'Street cleaning requested near the market', category: 'Waste & Sanitation', address: 'Anna Nagar East Market, Chennai', department: 'waste', status: 'Awaiting User Confirmation', resolutionRemarks: 'The overflowing bins were cleared and the surrounding area was cleaned.' },
  { title: 'Low water pressure in the apartment block', category: 'Water Supply', address: 'Mogappair Main Road, Chennai', department: 'water', status: 'Approved' },
  { title: 'Leaking public water tap', category: 'Water Supply', address: 'Corporation Park, Anna Nagar, Chennai', department: 'water', status: 'Resolved', resolutionRemarks: 'The damaged valve was replaced and the tap was checked for leaks.' },
  { title: 'Flickering streetlight at the junction', category: 'Street Lighting', address: 'W Block Junction, Anna Nagar, Chennai', department: 'lighting', status: 'In Progress' },
  { title: 'Streetlight repaired near the walking path', category: 'Street Lighting', address: 'Thirumangalam Walking Path, Chennai', department: 'lighting', status: 'Resolved', resolutionRemarks: 'The light fitting was repaired and tested after dark.' },
  { title: 'Waterlogging near the storm drain', category: 'Drainage & Sewage', address: 'Canal Bank Road, Chennai', department: 'drainage', status: 'Reopened', resolutionRemarks: 'The drain was cleared, but waterlogging returned after rainfall.' },
  { title: 'Drain cover is loose on the sidewalk', category: 'Drainage & Sewage', address: 'Anna Nagar 3rd Avenue, Chennai', department: 'drainage', status: 'Assigned' },
  { title: 'Damaged safety barrier beside the playground', category: 'Public Safety', address: 'Neighborhood Playground, Anna Nagar, Chennai', department: 'safety', status: 'In Progress' },
  { title: 'Exposed wiring near a public walkway', category: 'Public Safety', address: 'Community Hall Walkway, Chennai', department: 'safety', status: 'Assigned' },
  { title: 'Broken bench at the public garden', category: 'Other', address: 'Anna Nagar Tower Park, Chennai', department: 'other', status: 'In Progress' },
  { title: 'Damaged sign near the community center', category: 'Other', address: 'Anna Nagar Community Center, Chennai', department: 'other', status: 'Approved' }
];

function eventTime(createdAt, index, total) {
  return new Date(createdAt.getTime() + Math.floor((index / Math.max(total, 1)) * 60 * 60 * 1000));
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) throw new Error('Pass the citizen email address as an argument.');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in .env.');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const citizen = await User.findOne({ email, role: 'citizen', isActive: true });
  if (!citizen) throw new Error(`No active citizen account was found for ${email}.`);
  const admin = await User.findOne({ role: 'admin', isActive: true }).sort({ createdAt: 1 });
  if (!admin) throw new Error('Create an active admin account before seeding reports.');

  const departments = {};
  const staff = {};
  for (const category of CATEGORIES) {
    const key = departmentKeys[category];
    const department = await Department.findOne({ name: category, isActive: true });
    if (!department) throw new Error(`The active ${category} department was not found. Seed departments first.`);
    departments[key] = department;
    const membershipQuery = { role: 'employee', isActive: true, $or: [{ departmentIds: department._id }, { departmentId: department._id }] };
    staff[key] = await User.find(membershipQuery).sort({ fullName: 1 }).limit(2);
    if (!staff[key].length) throw new Error(`No active employees are available in ${category}.`);
  }

  let created = 0;
  let reused = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const spec = samples[index];
    const sampleKey = `sukumar-personal-${String(index + 1).padStart(2, '0')}`;
    let complaint = await Complaint.findOne({ sampleKey });
    if (complaint && String(complaint.citizenId) !== String(citizen._id)) {
      throw new Error(`Sample key ${sampleKey} already belongs to another citizen; no complaint was changed.`);
    }
    if (complaint) {
      reused += 1;
      continue;
    }

    const department = spec.department ? departments[spec.department] : null;
    const employee = spec.department && ['Assigned', 'In Progress', 'Awaiting User Confirmation', 'Resolved', 'Reopened'].includes(spec.status)
      ? staff[spec.department][index % staff[spec.department].length]
      : null;
    const ageDays = samples.length - index;
    const createdAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
    complaint = await Complaint.create({
      sampleKey,
      title: spec.title,
      description: `Sample report submitted by the resident. ${spec.title} is affecting people who use this public area. Please inspect the location and take the appropriate action.`,
      category: spec.category,
      location: { address: spec.address },
      citizenId: citizen._id,
      departmentId: department?._id || null,
      assignedEmployeeId: employee?._id || null,
      priority: index % 4 === 0 ? 'High' : 'Normal',
      status: spec.status,
      pendingResolutionRemarks: spec.status === 'Awaiting User Confirmation' ? spec.resolutionRemarks : '',
      resolutionRemarks: ['Resolved', 'Reopened'].includes(spec.status) ? spec.resolutionRemarks : '',
      resolvedAt: spec.status === 'Resolved' ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) : null,
      createdAt,
      updatedAt: new Date(createdAt.getTime() + 3 * 60 * 60 * 1000)
    });
    created += 1;

    const events = [{ complaintId: complaint._id, actorId: citizen._id, type: 'created', remarks: 'Sample report submitted by the resident.', createdAt }];
    const addStatus = (actorId, previousStatus, newStatus, remarks) => {
      events.push({ complaintId: complaint._id, actorId, type: 'status', previousStatus, newStatus, remarks, createdAt: eventTime(createdAt, events.length, 6) });
    };
    if (spec.status === 'More Info Requested') addStatus(admin._id, 'Under Review', 'More Info Requested', 'Please add a nearby landmark to help the team locate the issue.');
    else if (spec.status === 'Rejected') addStatus(admin._id, 'Under Review', 'Rejected', 'This sample report needs to be reviewed for eligibility.');
    else if (department) {
      if (['Approved', 'Assigned', 'In Progress', 'Awaiting User Confirmation', 'Resolved', 'Reopened'].includes(spec.status)) {
        addStatus(admin._id, 'Under Review', 'Approved', `Routed to ${department.name}.`);
        events.push({ complaintId: complaint._id, actorId: admin._id, type: 'assignment', remarks: `Forwarded to ${department.name}.`, metadata: { departmentId: department._id }, createdAt: eventTime(createdAt, events.length, 6) });
      }
      if (employee) {
        events.push({ complaintId: complaint._id, actorId: admin._id, type: 'assignment', remarks: `Assigned to ${employee.fullName}.`, metadata: { employeeId: employee._id, departmentId: department._id }, createdAt: eventTime(createdAt, events.length, 6) });
        addStatus(employee._id, 'Approved', 'Assigned', 'Department assigned an employee.');
        if (['In Progress', 'Awaiting User Confirmation', 'Resolved', 'Reopened'].includes(spec.status)) addStatus(employee._id, 'Assigned', 'In Progress', 'Employee started work on the report.');
        if (['Awaiting User Confirmation', 'Resolved', 'Reopened'].includes(spec.status)) addStatus(employee._id, 'In Progress', 'Awaiting User Confirmation', spec.resolutionRemarks || 'The team submitted its work for resident confirmation.');
        if (['Resolved', 'Reopened'].includes(spec.status)) addStatus(citizen._id, 'Awaiting User Confirmation', 'Resolved', 'Resident confirmed the completed work.');
        if (spec.status === 'Reopened') addStatus(citizen._id, 'Resolved', 'Reopened', spec.resolutionRemarks);
      }
    }
    await ComplaintEvent.insertMany(events);
  }

  const summary = await Complaint.aggregate([
    { $match: { citizenId: citizen._id, sampleKey: /^sukumar-personal-/ } },
    { $group: { _id: { status: '$status', category: '$category' }, count: { $sum: 1 } } },
    { $sort: { '_id.category': 1, '_id.status': 1 } }
  ]);
  console.log(JSON.stringify({ citizen: email, reportsCreated: created, existingSampleReports: reused, statusAndCategoryCounts: summary }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
