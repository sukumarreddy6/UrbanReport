document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form').forEach(form => {
    const controls = [...form.querySelectorAll('input, select, textarea')]
      .filter(control => control.type !== 'hidden' && control.type !== 'submit' && control.type !== 'button');
    if (!controls.some(control => control.required || control.minLength > 0 || control.pattern)) return;

    form.noValidate = true;
    form.classList.add('needs-validation');

    controls.forEach((control, index) => {
      const feedbackId = `field-feedback-${index}-${Math.random().toString(36).slice(2, 8)}`;
      control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), feedbackId].filter(Boolean).join(' '));

      const feedback = document.createElement('div');
      feedback.id = feedbackId;
      feedback.className = 'invalid-feedback field-validation-message';
      const updateFeedback = () => {
        if (control.validity.valueMissing) feedback.textContent = 'This field is required.';
        else if (control.validity.typeMismatch) feedback.textContent = 'Enter a valid value.';
        else if (control.validity.tooShort) feedback.textContent = `Enter at least ${control.minLength} characters.`;
        else if (control.validity.patternMismatch) feedback.textContent = 'Use the requested format.';
        else feedback.textContent = 'Check this value and try again.';
        const invalid = form.classList.contains('was-validated') && !control.validity.valid;
        feedback.classList.toggle('is-visible', invalid);
        control.classList.toggle('is-invalid', invalid);
        control.setAttribute('aria-invalid', String(invalid));
      };

      const wrapper = control.closest('.password-input-wrap');
      (wrapper || control).insertAdjacentElement('afterend', feedback);
      control.addEventListener('input', updateFeedback);
      control.addEventListener('change', updateFeedback);
      control.addEventListener('blur', updateFeedback);
      control.addEventListener('invalid', updateFeedback);
    });

    form.addEventListener('submit', event => {
      form.classList.add('was-validated');
      let firstInvalid = null;
      controls.forEach(control => {
        if (!control.validity.valid && !firstInvalid) firstInvalid = control;
        control.dispatchEvent(new Event('input', { bubbles: false }));
      });
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
        firstInvalid?.focus();
      }
    });
  });
});
