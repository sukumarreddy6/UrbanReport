document.addEventListener('DOMContentLoaded', () => {
  const carousel = document.querySelector('[data-political-carousel]');
  const track = carousel?.querySelector('[data-political-track]');
  const copyTrack = carousel?.querySelector('[data-political-copy-track]');
  if (!carousel || !track || !copyTrack) return;

  const slides = [...track.querySelectorAll('[data-political-slide]')];
  const copySlides = [...copyTrack.querySelectorAll('[data-political-copy-slide]')];
  const dots = [...carousel.querySelectorAll('[data-political-dot]')];
  const previous = carousel.querySelector('[data-political-prev]');
  const next = carousel.querySelector('[data-political-next]');
  const pause = carousel.querySelector('[data-political-pause]');
  const count = slides.length;
  if (!count || copySlides.length !== count) return;

  const clone = slide => {
    const copy = slide.cloneNode(true);
    copy.removeAttribute('data-political-slide');
    copy.classList.remove('is-active');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    const image = copy.querySelector('img');
    if (image) image.alt = '';
    return copy;
  };

  track.insertBefore(clone(slides[count - 1]), slides[0]);
  track.append(clone(slides[0]));
  const cloneCopy = slide => {
    const copy = slide.cloneNode(true);
    copy.removeAttribute('data-political-copy-slide');
    copy.classList.remove('is-active');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    return copy;
  };
  copyTrack.insertBefore(cloneCopy(copySlides[count - 1]), copySlides[0]);
  copyTrack.append(cloneCopy(copySlides[0]));

  let position = 1;
  let timer = null;
  let paused = false;
  const delay = 4000;

  function activeIndex() {
    return (position - 1 + count) % count;
  }

  function update() {
    const active = activeIndex();
    slides.forEach((slide, index) => {
      const visible = position === index + 1;
      slide.classList.toggle('is-active', visible);
      slide.setAttribute('aria-hidden', String(!visible));
      slide.inert = !visible;
      if (visible) {
        const image = slide.querySelector('img');
        if (image) image.loading = 'eager';
      }
    });
    copySlides.forEach((slide, index) => {
      const visible = position === index + 1;
      slide.classList.toggle('is-active', visible);
      slide.setAttribute('aria-hidden', String(!visible));
      slide.inert = !visible;
    });
    dots.forEach((dot, index) => {
      const selected = index === active;
      dot.classList.toggle('is-active', selected);
      if (selected) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  function render() {
    track.style.transform = `translate3d(-${position * 100}%, 0, 0)`;
    copyTrack.style.transform = `translate3d(-${position * 100}%, 0, 0)`;
    update();
  }

  function snapTo(realPosition) {
    track.classList.add('political-no-transition');
    copyTrack.classList.add('political-no-transition');
    position = realPosition;
    render();
    track.offsetHeight;
    copyTrack.offsetHeight;
    track.classList.remove('political-no-transition');
    copyTrack.classList.remove('political-no-transition');
  }

  function goTo(target) {
    position = target;
    render();
  }

  function stopTimer() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function startTimer() {
    stopTimer();
    if (paused || document.hidden) return;
    timer = window.setInterval(() => goTo(position + 1), delay);
  }

  function setPaused(value) {
    paused = value;
    if (pause) {
      pause.setAttribute('aria-pressed', String(paused));
      pause.setAttribute('aria-label', paused ? 'Play profiles' : 'Pause profiles');
      pause.innerHTML = `<span aria-hidden="true">${paused ? '▶' : 'Ⅱ'}</span>`;
    }
    if (paused) stopTimer();
    else startTimer();
  }

  track.addEventListener('transitionend', event => {
    if (event.propertyName !== 'transform') return;
    if (position === 0) snapTo(count);
    else if (position === count + 1) snapTo(1);
  });
  previous?.addEventListener('click', () => goTo(position - 1));
  next?.addEventListener('click', () => goTo(position + 1));
  pause?.addEventListener('click', () => setPaused(!paused));
  dots.forEach((dot, index) => dot.addEventListener('click', () => {
    if (index !== activeIndex()) goTo(index + 1);
  }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopTimer();
    else startTimer();
  });

  render();
  startTimer();
});
