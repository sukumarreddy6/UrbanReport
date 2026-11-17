document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-flash-message]').forEach(message => {
    let removalTimer;
    const dismiss = () => {
      if (removalTimer) window.clearTimeout(removalTimer);
      message.classList.add('flash-message-leaving');
      window.setTimeout(() => message.remove(), 180);
    };

    message.querySelector('[data-flash-dismiss]')?.addEventListener('click', dismiss);
    removalTimer = window.setTimeout(dismiss, 2000);
  });
});
