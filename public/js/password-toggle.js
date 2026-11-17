const passwordEyeMarkup = '<svg class="password-eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><svg class="password-eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3.1 3.9M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 4-.8"/></svg>';

document.querySelectorAll('[data-password-toggle]').forEach(button => { button.innerHTML = passwordEyeMarkup; });

document.addEventListener('click', event => {
  const button = event.target.closest('[data-password-toggle]');
  if (!button) return;
  const input = document.getElementById(button.dataset.passwordToggle);
  if (!input) return;
  const showing = input.type === 'password';
  const relatedIds = (button.dataset.passwordToggleAlso || '').split(',').map(id => id.trim()).filter(Boolean);
  [input, ...relatedIds.map(id => document.getElementById(id)).filter(Boolean)].forEach(field => {
    field.type = showing ? 'text' : 'password';
  });
  button.classList.toggle('is-visible', showing);
  const label = relatedIds.length ? (showing ? 'Hide passwords' : 'Show passwords') : (showing ? 'Hide password' : 'Show password');
  button.setAttribute('aria-label', label);
  button.title = label;
});
