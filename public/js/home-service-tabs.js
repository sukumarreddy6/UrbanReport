document.addEventListener('DOMContentLoaded', () => {
  const tabs = [...document.querySelectorAll('[data-service-tab]')];
  const panels = [...document.querySelectorAll('[data-service-panel]')];
  if (!tabs.length || !panels.length) return;

  function activate(name, moveFocus = false) {
    tabs.forEach(tab => {
      const selected = tab.dataset.serviceTab === name;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) tab.focus();
    });
    panels.forEach(panel => {
      const selected = panel.dataset.servicePanel === name;
      panel.hidden = !selected;
      panel.classList.toggle('is-active', selected);
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.serviceTab));
    tab.addEventListener('keydown', event => {
      let target = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target === null) return;
      event.preventDefault();
      activate(tabs[target].dataset.serviceTab, true);
    });
  });
});
