document.addEventListener('DOMContentLoaded', () => {
  const dialog = document.getElementById('complaint-image-dialog');
  const fullImage = dialog?.querySelector('[data-image-lightbox-full]');
  const closeButton = dialog?.querySelector('[data-image-lightbox-close]');
  if (!dialog || !fullImage || !closeButton || typeof dialog.showModal !== 'function') return;

  document.querySelectorAll('[data-image-lightbox]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      fullImage.src = link.href;
      dialog.showModal();
      closeButton.focus();
    });
  });

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => fullImage.removeAttribute('src'));
});
