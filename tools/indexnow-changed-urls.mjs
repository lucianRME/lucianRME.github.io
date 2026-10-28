#!/usr/bin/env node
// Select canonical URLs modified by a production commit for IndexNow.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'www.lucianirimie.com';
const KEY_FILENAME = 'a0d400221a9ba4b739c3e61bf38bc4a6.txt';

export function canonicalUrls(xml) {
  const seen = new Set();
  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    try {
      const url = new URL(match[1]);
      if (url.protocol === 'https:' && url.hostname === HOST && !url.search && !url.hash) {
        seen.add(url.href);
      }
    } catch {
      // Ignore malformed or off-domain URLs. Never submit untrusted destinations.
    }
  }
  return [...seen];
}

function documentPath(url) {
  const pathname = new URL(url).pathname;
  if (pathname === '/') return 'index.html';
  if (pathname.endsWith('/')) return pathname.slice(1) + 'index.html';
  return pathname.slice(1);
}

export function changedCanonicalUrls(changedFiles, newSitemap, oldSitemap = '') {
  const current = canonicalUrls(newSitemap);
  const previous = canonicalUrls(oldSitemap);
  const changed = new Set(changedFiles.map((path) => path.replace(/^\.\//, '')));
  const urls = new Set();
  const known = new Set([...current, ...previous]);

  // One-time registration after key deployment (also supports key rotation).
  if (changed.has(KEY_FILENAME)) current.forEach((url) => urls.add(url));

  for (const url of known) {
    if (changed.has(documentPath(url))) urls.add(url);
  }

  if (changed.has('sitemap.xml')) {
    const currentSet = new Set(current);
    const previousSet = new Set(previous);
    for (const url of currentSet) if (!previousSet.has(url)) urls.add(url);
    for (const url of previousSet) if (!currentSet.has(url)) urls.add(url);
  }

  return [...urls].sort();
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function main() {
  let before = process.argv[2];
  const head = process.argv[3] || 'HEAD';
  if (!before || /^0+$/.test(before)) before = head + '^';

  const changed = git('diff', '--name-only', '-z', before, head)
    .split('\0').filter(Boolean);
  const sitemap = readFileSync('sitemap.xml', 'utf8');
  let priorSitemap = '';
  try {
    priorSitemap = git('show', before + ':sitemap.xml');
  } catch {
    // A newly created sitemap has no previous version.
  }
  const urls = changedCanonicalUrls(changed, sitemap, priorSitemap);
  if (urls.length) process.stdout.write(urls.join('\n') + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
