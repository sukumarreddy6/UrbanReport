document.querySelectorAll('[data-language-switch]').forEach(form => {
  const select = form.querySelector('select[name="language"]');
  if (!select) return;

  const menu = form.querySelector('.language-menu');
  const current = form.querySelector('[data-language-current]');
  const options = [...form.querySelectorAll('[data-language-value]')];

  const activeLanguage = form.dataset.activeLanguage;
  const updateVisibility = () => {
    const selectedOption = select.selectedOptions[0];
    if (current && selectedOption) current.textContent = selectedOption.textContent;
    options.forEach(option => {
      const selected = option.dataset.languageValue === select.value;
      option.classList.toggle('is-selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
  };

  select.addEventListener('change', updateVisibility);
  options.forEach(option => option.addEventListener('click', () => {
    if (option.dataset.languageValue === select.value) {
      if (menu) menu.open = false;
      return;
    }
    select.value = option.dataset.languageValue;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (menu) menu.open = false;
    form.requestSubmit();
  }));
  updateVisibility();
});
