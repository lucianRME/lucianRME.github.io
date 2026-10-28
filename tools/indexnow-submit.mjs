#!/usr/bin/env node
// Notify IndexNow participants only for approved canonical personal-site URLs.
const HOST = 'www.lucianirimie.com';
const KEY = 'a0d400221a9ba4b739c3e61bf38bc4a6';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node tools/indexnow-submit.mjs <canonical-url> [canonical-url ...]');
  process.exit(2);
}

const urls = [...new Set(args.map((value) => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== HOST || url.port || url.search || url.hash) {
    throw new Error('IndexNow only accepts canonical https://' + HOST + '/ URLs: ' + value);
  }
  return url.href;
}))];

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: 'https://' + HOST + '/' + KEY + '.txt',
    urlList: urls,
  }),
});

const body = (await response.text()).trim();
console.log('IndexNow response: HTTP ' + response.status + ', URLs submitted: ' + urls.length);
if (body) console.log(body);
if (![200, 202].includes(response.status)) process.exit(1);
