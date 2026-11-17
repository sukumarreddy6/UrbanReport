document.addEventListener('DOMContentLoaded', () => {
  const description = document.querySelector('[data-home-description]');
  if (!description || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const messages = [
    'Report local issues, follow every update, and connect with the civic teams working to make your community better.',
    'Share neighborhood concerns and stay informed as local teams work on a response.',
    'A clearer way for residents and civic teams to move local issues toward resolution.'
  ];
  let current = 0;

  window.setInterval(() => {
    description.classList.add('is-changing');
    window.setTimeout(() => {
      current = (current + 1) % messages.length;
      description.textContent = messages[current];
      description.classList.remove('is-changing');
    }, 260);
  }, 7000);
});
