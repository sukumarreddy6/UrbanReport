document.addEventListener('DOMContentLoaded', () => {
  const carousel = document.querySelector('[data-landmark-carousel]');
  const track = carousel?.querySelector('[data-landmark-track]');
  if (!carousel || !track) return;

  const slides = [...track.querySelectorAll('[data-landmark-slide]')];
  const dots = [...carousel.querySelectorAll('[data-landmark-dot]')];
  const previous = carousel.querySelector('[data-landmark-previous]');
  const next = carousel.querySelector('[data-landmark-next]');
  const pause = carousel.querySelector('[data-landmark-pause]');
  const slideCount = slides.length;
  if (!slideCount) return;

  const makeClone = slide => {
    const clone = slide.cloneNode(true);
    clone.removeAttribute('data-landmark-slide');
    clone.classList.remove('is-active');
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
    const image = clone.querySelector('img');
    if (image) image.alt = '';
    return clone;
  };

  track.insertBefore(makeClone(slides[slideCount - 1]), slides[0]);
  track.append(makeClone(slides[0]));

  let position = 1;
  let timer = null;
  let isPaused = false;
  const delay = 2500;

  const activeIndex = () => (position - 1 + slideCount) % slideCount;

  function update() {
    const index = activeIndex();
    slides.forEach((slide, slideIndex) => {
      const active = position === slideIndex + 1;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });
    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === index;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  function renderPosition() {
    track.style.transform = `translate3d(-${position * 100}%, 0, 0)`;
    update();
  }

  function snapTo(realPosition) {
    track.classList.add('landmark-no-transition');
    position = realPosition;
    renderPosition();
    track.offsetHeight;
    track.classList.remove('landmark-no-transition');
  }

  function goTo(target) {
    position = target;
    renderPosition();
  }

  function stopTimer() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function startTimer() {
    stopTimer();
    if (isPaused || document.hidden) return;
    timer = window.setInterval(() => goTo(position + 1), delay);
  }

  function setPaused(paused) {
    isPaused = paused;
    if (pause) {
      pause.setAttribute('aria-pressed', String(isPaused));
      pause.setAttribute('aria-label', isPaused ? 'Play slideshow' : 'Pause slideshow');
      pause.innerHTML = `<span aria-hidden="true">${isPaused ? '▶' : 'Ⅱ'}</span>`;
    }
    if (isPaused) stopTimer();
    else startTimer();
  }

  track.addEventListener('transitionend', event => {
    if (event.propertyName !== 'transform') return;
    if (position === 0) snapTo(slideCount);
    else if (position === slideCount + 1) snapTo(1);
  });

  previous?.addEventListener('click', () => goTo(position - 1));
  next?.addEventListener('click', () => goTo(position + 1));
  pause?.addEventListener('click', () => setPaused(!isPaused));
  dots.forEach((dot, index) => dot.addEventListener('click', () => {
    if (index !== activeIndex()) goTo(index + 1);
  }));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTimer();
    else startTimer();
  });

  renderPosition();
  startTimer();
});
