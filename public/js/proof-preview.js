document.addEventListener('DOMContentLoaded', () => {
  const input = document.querySelector('[data-proof-images]');
  const preview = document.querySelector('[data-proof-preview]');
  if (!input || !preview) return;

  input.addEventListener('change', () => {
    preview.replaceChildren();
    [...input.files].slice(0, 5).forEach((file, index) => {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      const caption = document.createElement('figcaption');
      image.src = URL.createObjectURL(file);
      image.alt = `Proof photo ${index + 1}`;
      image.onload = () => URL.revokeObjectURL(image.src);
      caption.textContent = file.name;
      figure.append(image, caption);
      preview.append(figure);
    });
  });
});
