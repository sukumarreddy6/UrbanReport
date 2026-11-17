const initializeHomeAuth = () => {
  const backdrop = document.querySelector('[data-home-auth-backdrop]');
  if (!backdrop) return;
  const panels = [...backdrop.querySelectorAll('[data-home-auth-panel]')];
  const switches = [...backdrop.querySelectorAll('[data-home-auth-switch]')];
  const closeButton = backdrop.querySelector('[data-home-auth-close]');
  const portalInput = backdrop.querySelector('[data-home-auth-portal]');
  const loginSwitch = backdrop.querySelector('.home-auth-panel[data-home-auth-panel="login"] .home-auth-switch');
  const roleCopy = {
    user: { label: 'CITIZEN PORTAL', title: 'Welcome back', intro: 'Sign in to follow your reports and updates.' },
    admin: { label: 'ADMIN PORTAL', title: 'Administrator sign in', intro: 'Sign in with your administrator account.' },
    department: { label: 'DEPARTMENT PORTAL', title: 'Department sign in', intro: 'Sign in with the account provided to your department.' },
    employee: { label: 'EMPLOYEE PORTAL', title: 'Employee sign in', intro: 'Sign in with the account provided to you.' }
  };
  let returnFocus = null;

  const setMode = (mode) => {
    panels.forEach((panel) => { panel.hidden = panel.dataset.homeAuthPanel !== mode; });
    backdrop.querySelector('#home-auth-title')?.focus?.();
  };
  const open = (mode, trigger) => {
    const portal = trigger?.dataset.homePortal || 'user';
    const copy = roleCopy[portal] || roleCopy.user;
    const isCitizen = portal === 'user';
    returnFocus = trigger;
    backdrop.hidden = false;
    document.body.classList.add('home-auth-open');
    if (portalInput) portalInput.value = portal;
    backdrop.querySelector('[data-home-auth-eyebrow]').textContent = copy.label;
    backdrop.querySelector('[data-home-auth-title]').textContent = copy.title;
    backdrop.querySelector('[data-home-auth-intro]').textContent = copy.intro;
    if (loginSwitch) loginSwitch.hidden = !isCitizen;
    setMode(mode);
    (mode === 'login' ? backdrop.querySelector('[name="email"]') : backdrop.querySelector('[name="fullName"]'))?.focus();
  };
  const close = () => {
    backdrop.hidden = true;
    document.body.classList.remove('home-auth-open');
    returnFocus?.focus();
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-home-auth]');
    if (!trigger) return;
    event.preventDefault();
    document.querySelector('.civic-user-menu')?.removeAttribute('open');
    open(trigger.dataset.homeAuth, trigger);
  });
  switches.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.homeAuthSwitch)));
  closeButton?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !backdrop.hidden) close(); });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeHomeAuth, { once: true });
} else {
  initializeHomeAuth();
}
