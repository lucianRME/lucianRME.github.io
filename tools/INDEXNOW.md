# Automatic IndexNow for lucianirimie.com

This repository is the GitHub Pages source for **https://www.lucianirimie.com/**.

IndexNow enables Bing and other participating engines to learn about changed pages.
It does **not** notify Google, and a successful submission is not an indexing guarantee.

## Setup

- Dedicated IndexNow verification key:
  `a0d400221a9ba4b739c3e61bf38bc4a6`
- Public verification file:
  `https://www.lucianirimie.com/a0d400221a9ba4b739c3e61bf38bc4a6.txt`
- Canonical URL source: `sitemap.xml` (currently homepage and privacy).
- Automatic workflow: `.github/workflows/indexnow.yml`.

The key is public by design. It is distinct from the key for synapseworks.org.
No new analytics, cookies, secrets, JavaScript on the site, or third-party SDKs are added.

## Deployment and notification sequence

1. For a pull request, the workflow only tests URL selection; it never notifies IndexNow.
2. After a `main` push, the workflow computes the changed canonical pages in the Git diff.
   The root `index.html` maps to `/`, and `privacy/index.html` to `/privacy/`.
3. A change to the key file triggers one bootstrap notification for both current sitemap URLs.
   After that, only edited pages and actual sitemap additions/removals are submitted.
   Styles, scripts, documentation and unchanged sitemap timestamps are not submitted.
4. If there is anything to submit, the workflow waits for the **pages build and deployment**
   GitHub Pages run for exactly that Git commit to conclude `success`.
   A missing or failed deployment blocks notifications rather than reporting a false success.
5. The workflow verifies that the new key file is accessible on the canonical public host,
   then POSTs the selected URLs to `https://api.indexnow.org/indexnow`.
6. Only HTTP 200 and 202 are treated as accepted receipts. In Bing Webmaster Tools,
   check the IndexNow section to confirm reception.

This workflow is restricted to the correct repository and to `refs/heads/main`,
including when manually dispatched. It does not notify for preview branches.
It uses read-only GitHub Actions permissions.

## Google indexing

The canonical sitemap remains `https://www.lucianirimie.com/sitemap.xml`,
and `robots.txt` references it. Keep that sitemap registered in Google Search Console.

Google's Indexing API cannot be used for normal portfolio or product pages; it is
restricted to eligible JobPosting and live-stream BroadcastEvent pages.
Google automatically revisits URLs discovered through your sitemap and links.
Manual URL Inspection is optional for particularly important changes; it is
not needed after every deployment.

Docs: https://developers.google.com/search/apis/indexing-api/v3/using-api

## Verification and troubleshooting

- PR test: `node --test tools/indexnow.test.mjs`
- GitHub Actions: **IndexNow after GitHub Pages deployment**
- GitHub Pages: **pages build and deployment**
- Bing Webmaster Tools: IndexNow reporting

If the GitHub Pages workflow name, the canonical host or the site build mechanism
changes, update the guard rather than bypassing deployment confirmation.
The key must always be publicly reachable as plain UTF-8 text from the same host
being submitted.

A successful IndexNow POST confirms that the notification was received, not that
Bing or other participating engines have crawled or indexed a page.
