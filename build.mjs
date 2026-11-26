// build.mjs: builds the finished portfolio pages.
//
// It reads data/site.json, fills every {{placeholder}} in src/*.html (and src/robots.txt),
// pastes the shared pieces ({{> header}} = src/partials/header.html), and writes the finished
// files to the repo root. The GitHub Action (.github/workflows/deploy.yml) runs this and publishes
// the result on GitHub Pages. It is the same system as the Afra's Chop Shop site.
//
// Run it with:  npm run build   (from the repo folder). Only Node's built-in modules are used.
//
// Optional settings, used by the tests:
//   SITE_DATA=other.json   read this data file instead of data/site.json
//   OUT_DIR=some/folder    write the finished files there instead of the repo root

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { escapeHtml, isPlaceholder, athensYear } from './build-helpers.mjs';

const DATA_FILE = process.env.SITE_DATA || 'data/site.json';
const OUT_DIR = (process.env.OUT_DIR || '.') + '/';

// Stops the build with an error message; nothing is written, so the live site stays as it was.
function fail(message) {
  console.error('BUILD FAILED: ' + message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1: read and check the data file.
// ---------------------------------------------------------------------------
let site;
try {
  site = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
} catch (error) {
  fail(DATA_FILE + ' could not be read: ' + error.message + ' (a missing comma or quote?)');
}
if (!site.website.url.endsWith('/')) fail(DATA_FILE + ': website.url must end with "/"');

const c = site.contact;
if (c.email !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) {
  fail(DATA_FILE + ': contact.email "' + c.email + '" does not look like an email address');
}
for (const key of ['instagram', 'linkedin']) {
  if (c[key] !== '' && !c[key].startsWith('https://')) {
    fail(DATA_FILE + ': contact.' + key + ' should be a full link starting with https://');
  }
}
for (const item of site.work) {
  if (!existsSync(item.image)) fail(DATA_FILE + ': work "' + item.id + '" uses ' + item.image + ', which does not exist');
  for (const link of item.links) {
    if (!link.text || !link.href) fail(DATA_FILE + ': work "' + item.id + '" has a link without "text" or "href"');
  }
}
if (site.person.photo !== '' && !existsSync(site.person.photo)) {
  fail(DATA_FILE + ': person.photo ' + site.person.photo + ' does not exist');
}

// Not errors, but worth a reminder every time you build.
const nameMissing = isPlaceholder(site.person.name);
if (nameMissing) console.warn('Reminder: person.name is still "' + site.person.name + '" in ' + DATA_FILE);
if (c.email === '' && c.instagram === '' && c.linkedin === '') {
  console.warn('Reminder: no contact details yet (contact.email / instagram / linkedin in ' + DATA_FILE + ')');
}

// ---------------------------------------------------------------------------
// Step 2: the "values" table: placeholder name -> text to put in the page.
// ---------------------------------------------------------------------------
const values = {};

// 2a. Every simple value in site.json becomes a placeholder, e.g. {{person.name}}.
//     Lists are skipped here; they are turned into HTML below.
function addSimpleValues(prefix, object) {
  for (const key of Object.keys(object)) {
    const name = prefix === '' ? key : prefix + '.' + key;
    const value = object[key];
    if (Array.isArray(value)) continue;
    if (typeof value === 'object') addSimpleValues(name, value);
    else values[name] = escapeHtml(value);
  }
}
addSimpleValues('', site);
values['year'] = athensYear();
values['website.path'] = new URL(site.website.url).pathname;
values['shareImage.url'] = site.website.url + 'assets/img/share.jpg';

// 2b. Cache busting: a short fingerprint of the file's contents on the CSS/JS links.
function fingerprint(path) {
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  return path + '?v=' + hash.slice(0, 8);
}
values['asset.css'] = fingerprint('css/main.css');
values['asset.js'] = fingerprint('js/main.js');

// 2c. Visitor statistics with GoatCounter (no cookies). Off while analytics.goatcounterCode is "".
const gcCode = site.analytics.goatcounterCode;
if (gcCode === '') {
  values['analytics.meta'] = '';
  values['csp.imgSrc'] = "'self' data:";
  values['privacy.analytics'] = 'Αυτή τη στιγμή δεν μετράμε την επισκεψιμότητα του site.';
} else {
  if (!/^[a-z0-9-]+$/.test(gcCode)) fail(DATA_FILE + ': analytics.goatcounterCode should only have small latin letters, numbers and -');
  const gcHost = 'https://' + gcCode + '.goatcounter.com';
  values['analytics.meta'] = '\n  <meta name="goatcounter" content="' + gcHost + '/count">';
  values['csp.imgSrc'] = "'self' data: " + gcHost;
  values['privacy.analytics'] = 'Μετράμε πόσοι επισκέπτονται το site με την υπηρεσία GoatCounter. ' +
    'Δεν χρησιμοποιεί cookies, δεν αποθηκεύει τίποτα στη συσκευή σου και δεν κρατά τη διεύθυνση IP σου. ' +
    'Βλέπουμε μόνο συνολικούς αριθμούς, ποτέ ποιος είσαι.';
}

// 2d. The lists, turned into HTML. Every text goes through escapeHtml.
const e = escapeHtml;
const indent = (lines, spaces) => lines.map(line => ' '.repeat(spaces) + line).join('\n');

values['audiences.html'] = indent(site.audiences.map(a => '<li>' + e(a) + '</li>'), 10);

values['problems.html'] = indent(site.problems.map(p =>
  '<li class="card"><p class="card__quote">«' + e(p.quote) + '»</p><p class="card__text">' + e(p.solution) + '</p></li>'), 10);

values['services.html'] = indent(site.services.map(s =>
  '<li class="card"><h3 class="card__title">' + e(s.title) + '</h3><p class="card__text">' + e(s.text) + '</p></li>'), 10);

values['work.html'] = indent(site.work.map(w => {
  const links = w.links.map(link => link.external
    ? '<a class="btn btn--ghost" href="' + e(link.href) + '" target="_blank" rel="noopener">' + e(link.text) +
      '<span class="visually-hidden"> (ανοίγει σε νέα καρτέλα)</span></a>'
    : '<a class="btn btn--ghost" href="' + e(link.href) + '">' + e(link.text) + '</a>').join('');
  return '<li class="work" id="work-' + e(w.id) + '">' +
    '<img class="work__image" src="' + e(w.image) + '" alt="' + e(w.imageAlt) + '" width="390" height="844" loading="lazy" decoding="async">' +
    '<div class="work__body"><p class="tag">' + e(w.label) + '</p>' +
    '<h3 class="work__title">' + e(w.title) + '</h3><p class="work__subtitle">' + e(w.subtitle) + '</p>' +
    '<p>' + e(w.summary) + '</p>' + (links ? '<p class="work__links">' + links + '</p>' : '') + '</div></li>';
}), 10);

values['steps.html'] = indent(site.steps.map(s =>
  '<li class="step"><h3 class="step__title">' + e(s.title) + '</h3><p>' + e(s.text) + '</p></li>'), 10);

values['faq.html'] = indent(site.faq.map(f =>
  '<details class="faq__item"><summary>' + e(f.q) + '</summary><p>' + e(f.a) + '</p></details>'), 8);

values['about.html'] = indent(site.person.about.map(p => '<p>' + e(p) + '</p>'), 10);
values['photo.html'] = site.person.photo === '' ? '' :
  '<img class="about__photo" src="' + e(site.person.photo) + '" alt="' + e(site.person.name) + '" width="320" height="320" loading="lazy" decoding="async">';

// Contact: only the channels that are filled in.
const contactLinks = [];
if (c.email) contactLinks.push('<a class="btn btn--primary" href="mailto:' + e(c.email) + '?subject=' +
  encodeURIComponent('Ζητώ προσφορά') + '">Στείλε email<span class="contact__detail">' + e(c.email) + '</span></a>');
if (c.instagram) contactLinks.push('<a class="btn btn--ghost" href="' + e(c.instagram) + '" target="_blank" rel="noopener">Instagram<span class="visually-hidden"> (ανοίγει σε νέα καρτέλα)</span></a>');
if (c.linkedin) contactLinks.push('<a class="btn btn--ghost" href="' + e(c.linkedin) + '" target="_blank" rel="noopener">LinkedIn<span class="visually-hidden"> (ανοίγει σε νέα καρτέλα)</span></a>');
values['contact.html'] = contactLinks.length === 0
  ? '<p class="contact__soon">Τα στοιχεία επικοινωνίας έρχονται σύντομα.</p>'
  : '<p class="contact__links">' + contactLinks.join('') + '</p>';
// "Ζήτα προσφορά" opens an email if there is one, otherwise jumps to the contact section.
values['contact.ctaHref'] = c.email
  ? 'mailto:' + e(c.email) + '?subject=' + encodeURIComponent('Ζητώ προσφορά')
  : values['website.path'] + '#contact';

// The shop's testimonial, only when one has been given (never invented).
const t = site.testimonial;
values['testimonial.html'] = t.text === '' ? '' :
  '<figure class="quote"><blockquote><p>' + e(t.text) + '</p></blockquote><figcaption>' + e(t.author) + '</figcaption></figure>';

// Structured data for Google: only once the real name is filled in.
const sameAs = [c.instagram, c.linkedin].filter(Boolean);
values['jsonld.html'] = nameMissing ? '' :
  '\n  <script type="application/ld+json">\n  ' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.person.name,
    jobTitle: site.person.role,
    url: site.website.url,
    address: { '@type': 'PostalAddress', addressLocality: site.person.city, addressCountry: 'GR' },
    ...(sameAs.length ? { sameAs } : {}),
  }).replaceAll('<', '\\u003c') + '\n  </script>';

// ---------------------------------------------------------------------------
// Step 3: fill every page in src/ and keep the results in memory.
// ---------------------------------------------------------------------------
const pages = readdirSync('src').filter(file => file.endsWith('.html') || file.endsWith('.txt'));
const finished = {};
const missing = [];

for (const file of pages) {
  let template = readFileSync('src/' + file, 'utf8');

  // 3a. Paste in the shared pieces: {{> footer}} is replaced by src/partials/footer.html.
  template = template.replace(/\{\{>\s*([\w-]+)\s*\}\}\n?/g, (match, name) => {
    const partialFile = 'src/partials/' + name + '.html';
    if (!existsSync(partialFile)) {
      missing.push('src/' + file + ': ' + match.trim() + ' (no file ' + partialFile + ')');
      return '';
    }
    return readFileSync(partialFile, 'utf8');
  });

  // 3b. Values that differ per page.
  const pageValues = { ...values };
  pageValues['page.url'] = site.website.url + (file === 'index.html' ? '' : file);

  // 3c. Replace each {{name}} with its value. Unknown names are collected as errors.
  let html = template.replace(/\{\{(.*?)\}\}/g, (match, name) => {
    name = name.trim();
    if (!(name in pageValues)) {
      missing.push('src/' + file + ': ' + match);
      return match;
    }
    return pageValues[name];
  });
  html = html.replace('<!doctype html>',
    '<!doctype html>\n<!-- GENERATED FILE: edit src/' + file + ' and data/site.json, then run "npm run build". -->');
  finished[file] = html;
}

// 3d. sitemap.xml for Google (the 404 page is left out).
finished['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages.filter(f => f.endsWith('.html') && f !== '404.html')
    .map(f => '  <url><loc>' + site.website.url + (f === 'index.html' ? '' : f) + '</loc></url>').join('\n') +
  '\n</urlset>\n';

// ---------------------------------------------------------------------------
// Step 4: write everything, but only if there were no errors.
// ---------------------------------------------------------------------------
if (missing.length > 0) fail('these placeholders have no value:\n  ' + missing.join('\n  '));
mkdirSync(OUT_DIR, { recursive: true });
for (const file of Object.keys(finished)) writeFileSync(OUT_DIR + file, finished[file]);
console.log('Built ' + Object.keys(finished).join(', '));
