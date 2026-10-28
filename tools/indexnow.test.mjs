import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { canonicalUrls, changedCanonicalUrls } from './indexnow-changed-urls.mjs';

const host = 'https://www.lucianirimie.com';
const homepage = host + '/';
const privacy = host + '/privacy/';
const keyFile = 'a0d400221a9ba4b739c3e61bf38bc4a6.txt';

const sitemap = (urls) => '<urlset>' + urls.map((url) => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>';
const both = sitemap([homepage, privacy]);

test('only canonical https://www.lucianirimie.com/ URLs are accepted', () => {
  const xml = sitemap([homepage, privacy, homepage, 'http://www.lucianirimie.com/',
    'https://lucianirimie.com/', 'https://unrelated.example/', homepage + '?utm_source=test']);
  assert.deepEqual(canonicalUrls(xml), [homepage, privacy]);
});

test('homepage and privacy edits notify only their own canonical URLs', () => {
  assert.deepEqual(changedCanonicalUrls(['index.html'], both, both), [homepage]);
  assert.deepEqual(changedCanonicalUrls(['privacy/index.html'], both, both), [privacy]);
  assert.deepEqual(changedCanonicalUrls(['index.html', 'privacy/index.html'], both, both), [homepage, privacy]);
});

test('style, workflow, sitemap timestamp and helper-only changes do not trigger noise', () => {
  assert.deepEqual(changedCanonicalUrls(['assets/site.css', 'tools/indexnow-submit.mjs'], both, both), []);
  assert.deepEqual(changedCanonicalUrls(['sitemap.xml'], both, both), []);
});

test('adding the new domain-specific key bootstraps the two current pages once', () => {
  assert.deepEqual(changedCanonicalUrls([keyFile], both, both), [homepage, privacy]);
});

test('real sitemap additions and removals are signalled', () => {
  const homepageOnly = sitemap([homepage]);
  assert.deepEqual(changedCanonicalUrls(['sitemap.xml'], both, homepageOnly), [privacy]);
  assert.deepEqual(changedCanonicalUrls(['sitemap.xml'], homepageOnly, both), [privacy]);
});

test('repository site metadata matches the canonical domain and verification key', async () => {
  const [actualSitemap, cname, robots, index, key] = await Promise.all([
    readFile('sitemap.xml', 'utf8'),
    readFile('CNAME', 'utf8'),
    readFile('robots.txt', 'utf8'),
    readFile('index.html', 'utf8'),
    readFile(keyFile, 'utf8'),
  ]);
  assert.equal(cname.trim(), 'www.lucianirimie.com');
  assert.deepEqual(canonicalUrls(actualSitemap), [homepage, privacy]);
  assert.match(robots, /Sitemap:\s*https:\/\/www\.lucianirimie\.com\/sitemap\.xml/);
  assert.match(index, /<link rel="canonical" href="https:\/\/www\.lucianirimie\.com\/">/);
  assert.equal(key.trim(), keyFile.slice(0, -4));
});
