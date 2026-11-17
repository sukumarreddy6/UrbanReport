const statusGroups = {
  'Under Review': ['Submitted', 'Reopened'],
  'In Progress': ['Approved', 'Assigned']
};

function canonicalStatusCounts(rows) {
  const counts = Object.fromEntries(rows.map(row => [row._id, row.count]));
  for (const [canonical, aliases] of Object.entries(statusGroups)) {
    counts[canonical] = (counts[canonical] || 0) + aliases.reduce((sum, alias) => sum + (counts[alias] || 0), 0);
    aliases.forEach(alias => delete counts[alias]);
  }
  return counts;
}

module.exports = canonicalStatusCounts;
