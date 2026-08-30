const themeButton = document.querySelector('#theme-toggle');

themeButton?.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = current
    ? (current === 'dark' ? 'light' : 'dark')
    : (systemDark ? 'light' : 'dark');

  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {
    // The selected theme still applies to the current page.
  }
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealTargets = document.querySelectorAll('[data-reveal]');

if (reducedMotion || !('IntersectionObserver' in window)) {
  revealTargets.forEach((element) => element.classList.add('in'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  revealTargets.forEach((element) => observer.observe(element));
}

document.querySelectorAll('[data-reveal-blur]').forEach((element) => {
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  const show = () => element.classList.add('shown');

  element.addEventListener('click', show);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      show();
    }
  });
});
