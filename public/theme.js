// Runs before rendering so a saved dark preference does not flash a light page.
(() => {
  const key = 'zhpath-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark', 'system'].includes(value);
  let preference = 'system';
  try { const value = localStorage.getItem(key); if (valid(value)) preference = value; } catch {}
  const apply = () => {
    const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = resolved;
    window.dispatchEvent(new Event('zhpath-theme-applied'));
  };
  window.addEventListener('zhpath-theme-change', event => {
    if (!valid(event.detail)) return;
    preference = event.detail;
    try { localStorage.setItem(key, preference); } catch {}
    apply();
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : 'system'; apply();
  });
  media.addEventListener('change', apply);
  apply();
})();
