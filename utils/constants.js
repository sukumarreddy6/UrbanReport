const CATEGORIES = ['Road Damage', 'Waste & Sanitation', 'Water Supply', 'Street Lighting', 'Drainage & Sewage', 'Public Safety', 'Other'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const STATUSES = ['Submitted', 'Under Review', 'More Info Requested', 'Approved', 'Assigned', 'In Progress', 'Awaiting User Confirmation', 'Resolved', 'Rejected', 'Reopened'];
const STATUS_FILTERS = [
  { label: 'Under Review', value: 'Under Review', statuses: ['Submitted', 'Under Review', 'Reopened'] },
  { label: 'More Info Requested', value: 'More Info Requested', statuses: ['More Info Requested'] },
  { label: 'In Progress', value: 'In Progress', statuses: ['Approved', 'Assigned', 'In Progress'] },
  { label: 'Awaiting User Confirmation', value: 'Awaiting User Confirmation', statuses: ['Awaiting User Confirmation'] },
  { label: 'Resolved', value: 'Resolved', statuses: ['Resolved'] },
  { label: 'Rejected', value: 'Rejected', statuses: ['Rejected'] }
];
module.exports = { CATEGORIES, PRIORITIES, STATUSES, STATUS_FILTERS };
