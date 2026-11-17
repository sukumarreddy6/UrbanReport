document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('complaint-images');
  const preview = document.getElementById('image-preview');
  if (!input || !preview) return;
  let previewUrls = [];

  function clearPreview() {
    preview.replaceChildren();
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    previewUrls = [];
  }

  input.addEventListener('change', () => {
    clearPreview();
    const files = Array.from(input.files || []);
    if (files.length > 5) {
      input.value = '';
      preview.textContent = 'Choose no more than five images.';
      return;
    }
    const invalid = files.find(file => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type));
    if (invalid) {
      input.value = '';
      preview.textContent = 'Images must be JPG, PNG, WebP, or AVIF and no larger than 5 MB each.';
      return;
    }
    for (const file of files) {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      const objectUrl = URL.createObjectURL(file);
      previewUrls.push(objectUrl);
      image.src = objectUrl;
      image.alt = file.name;
      image.onerror = () => {
        image.remove();
        const error = document.createElement('small');
        error.className = 'image-preview-error';
        error.textContent = 'Preview unavailable for this file.';
        figure.prepend(error);
      };
      const caption = document.createElement('figcaption');
      caption.textContent = file.name;
      figure.append(image, caption);
      preview.append(figure);
    }
  });

  window.addEventListener('pagehide', () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    previewUrls = [];
  }, { once: true });
});
