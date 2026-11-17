document.addEventListener('click', event => {
  const button = event.target.closest('[data-notification-expand]');
  if (!button) return;
  const row = button.closest('.notification-row');
  const message = row?.querySelector('[data-notification-message]');
  if (!message) return;

  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  message.classList.toggle('is-collapsed', expanded);
  button.textContent = expanded ? 'Read more' : 'Read less';
});
