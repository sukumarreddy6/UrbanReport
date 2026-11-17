function employeeMembershipFilter(departmentId, extra = {}) {
  return {
    role: 'employee',
    ...extra,
    $or: [{ departmentIds: departmentId }, { departmentId }]
  };
}

function hasDepartmentMembership(employee, departmentId) {
  const target = String(departmentId);
  return String(employee.departmentId || '') === target
    || (employee.departmentIds || []).some(id => String(id?._id || id) === target);
}

module.exports = { employeeMembershipFilter, hasDepartmentMembership };
