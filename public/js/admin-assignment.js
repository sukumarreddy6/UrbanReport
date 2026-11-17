document.addEventListener('DOMContentLoaded', () => {
  const department = document.getElementById('department-select');
  const employee = document.getElementById('employee-select');
  if (!department || !employee) return;
  const filter = () => {
    const selected = department.value;
    for (const option of employee.querySelectorAll('option[data-department]')) {
      option.hidden = selected !== '' && option.dataset.department !== selected;
      if (option.hidden && option.selected) employee.value = '';
    }
  };
  department.addEventListener('change', filter);
  filter();
});
