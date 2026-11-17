document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('send-email-code') || document.getElementById('home-send-email-code');
  const emailInput = document.getElementById('registration-email') || document.getElementById('home-registration-email');
  const status = document.getElementById('otp-status') || document.getElementById('home-otp-status');
  const token = document.querySelector('input[name="_csrf"]')?.value;
  if (!button || !emailInput || !status || !token) return;
  button.addEventListener('click', async () => {
    const form = emailInput.form;
    form?.classList.add('was-validated');
    if (!emailInput.checkValidity()) { emailInput.focus(); return; }
    button.disabled = true;
    status.textContent = 'Sending verification code…';
    status.dataset.state = 'pending';
    try {
      const response = await fetch('/register/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ email: emailInput.value.trim(), _csrf: token })
      });
      const result = await response.json().catch(() => ({}));
      status.textContent = response.ok ? result.message : (result.message || 'Unable to send a code. Check your email and try again.');
      status.dataset.state = response.ok ? 'success' : 'error';
    } catch {
      status.textContent = 'Unable to send a code right now. Please try again.';
      status.dataset.state = 'error';
    } finally { button.disabled = false; }
  });
});
