// Tests for build.mjs: it runs the real build into a temporary folder and checks the result.
// Run with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isPlaceholder } from '../build-helpers.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const realData = JSON.parse(readFileSync(join(ROOT, 'data/site.json'), 'utf8'));
const PAGES = ['index.html', 'work-afras.html', 'privacy.html', '404.html'];

// Runs "node build.mjs" with a data file; returns { ok, output, files, read(file) }.
function build(data) {
  const dir = mkdtempSync(join(tmpdir(), 'portfolio-build-'));
  const dataFile = join(dir, 'site.json');
  writeFileSync(dataFile, JSON.stringify(data));
  const out = join(dir, 'out');
  const result = spawnSync(process.execPath, ['build.mjs'], {
    cwd: ROOT, env: { ...process.env, SITE_DATA: dataFile, OUT_DIR: out }, encoding: 'utf8',
  });
  let files = [];
  try { files = readdirSync(out); } catch { /* nothing written */ }
  return { ok: result.status === 0, output: result.stdout + result.stderr, files, read: f => readFileSync(join(out, f), 'utf8') };
}
const withContact = { ...realData, contact: { email: 'hello@example.com', instagram: 'https://instagram.com/example', linkedin: '' } };

test('the real data builds every page, with no placeholders left', () => {
  const result = build(realData);
  assert.ok(result.ok, result.output);
  for (const file of [...PAGES, 'sitemap.xml', 'robots.txt']) {
    assert.ok(result.files.includes(file), file + ' was not built');
    assert.doesNotMatch(result.read(file), /\{\{|\}\}/, file + ' still has a {{placeholder}}');
  }
});

test('with no contact details yet: no empty links, a "coming soon" note, and a reminder', () => {
  const result = build(realData);
  const index = result.read('index.html');
  assert.doesNotMatch(index, /mailto:/);
  assert.match(index, /Τα στοιχεία επικοινωνίας έρχονται σύντομα/);
  const path = new URL(realData.website.url).pathname;     // e.g. "/geskam-portfolio/"
  assert.ok(index.includes('href="' + path + '#contact">Ζήτα προσφορά'));   // the offer button jumps to the contact section
  assert.match(result.output, /Reminder: no contact details/);
});

test('contact details appear only for the channels that are filled in', () => {
  const index = build(withContact).read('index.html');
  assert.match(index, /href="mailto:hello@example\.com\?subject=/);
  assert.match(index, /href="https:\/\/instagram\.com\/example"/);
  assert.doesNotMatch(index, />LinkedIn</);                 // empty, so not shown
  assert.doesNotMatch(index, /έρχονται σύντομα/);
});

test('structured data for Google only once the real name is set', () => {
  assert.ok(isPlaceholder(realData.person.name));
  assert.doesNotMatch(build(realData).read('index.html'), /application\/ld\+json/);
  const named = { ...withContact, person: { ...realData.person, name: 'Γιώργος Π.' } };
  const index = build(named).read('index.html');
  const json = JSON.parse(index.split('<script type="application/ld+json">')[1].split('</script>')[0]);
  assert.equal(json.name, 'Γιώργος Π.');
  assert.deepEqual(json.sameAs, ['https://instagram.com/example']);
  assert.match(index, /<title>Γιώργος Π\. ·/);
});

test('the testimonial is shown only when it has been given (never invented)', () => {
  assert.doesNotMatch(build(realData).read('work-afras.html'), /<blockquote>/);
  const given = { ...realData, testimonial: { text: 'Πολύ καλή δουλειά.', author: 'Σ., Afra\'s Chop Shop' } };
  assert.match(build(given).read('work-afras.html'), /<blockquote><p>Πολύ καλή δουλειά\.<\/p><\/blockquote>/);
});

test('every project has an existing image and its links', () => {
  const index = build(realData).read('index.html');
  for (const work of realData.work) {
    assert.match(index, new RegExp('src="' + work.image + '"'));
    for (const link of work.links) assert.ok(index.includes('href="' + link.href + '"'), link.href);
  }
});

test('sitemap and robots use the website address and leave out the 404 page', () => {
  const result = build(realData);
  assert.match(result.read('sitemap.xml'), /work-afras\.html/);
  assert.doesNotMatch(result.read('sitemap.xml'), /404/);
  assert.match(result.read('robots.txt'), new RegExp('Sitemap: ' + realData.website.url + 'sitemap.xml'));
});

test('mistakes in the data stop the build, and nothing is written', () => {
  const cases = [
    [{ ...realData, contact: { ...realData.contact, email: 'not-an-email' } }, /does not look like an email/],
    [{ ...realData, contact: { ...realData.contact, linkedin: 'linkedin.com/in/x' } }, /should be a full link/],
    [{ ...realData, work: [{ ...realData.work[0], image: 'assets/img/missing.jpg' }] }, /does not exist/],
    [{ ...realData, website: { url: 'https://example.com' } }, /must end with/],
  ];
  for (const [data, message] of cases) {
    const result = build(data);
    assert.equal(result.ok, false);
    assert.match(result.output, message);
    assert.deepEqual(result.files, []);
  }
});
