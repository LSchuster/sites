// Applies an explicitly chosen theme before first paint (no flash). Loaded as
// a blocking classic script in <head> — must stay tiny and dependency-free.
// Keep key + values in sync with src/theme.ts ('system' = no attribute).
(function () {
  try {
    var t = localStorage.getItem('invoice.theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {
    /* storage unavailable — system preference applies */
  }
})();
