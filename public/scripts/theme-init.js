document.documentElement.classList.add('js');

try {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    document.documentElement.dataset.theme = savedTheme;
  }
} catch {
  // The system preference remains active when storage is unavailable.
}
