// build-helpers.mjs: small helper functions used by build.mjs (and by the tests in tests/).

// Makes text safe to put inside HTML (for example inside content="...").
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// A placeholder name like "[Το όνομά σου]" means the name has not been filled in yet.
export function isPlaceholder(text) {
  return /^\[.*\]$/.test(String(text).trim());
}

// The year in Greece right now, for "© 2026".
export function athensYear() {
  return new Intl.DateTimeFormat('en', { timeZone: 'Europe/Athens', year: 'numeric' }).format(new Date());
}
