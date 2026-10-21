#!/usr/bin/env python3
"""Validate the static site without installing dependencies.

Run: python3 tools/check_site.py [--external]
External checks are optional: social/store sites may reject automated clients.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://www.lucianirimie.com'
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.nodes = []
        self.ids = set()
        self.errors = []
        self.stack = []
        self.json_blocks = []
        self.json_text = None
        self.feed(path.read_text())
        self.close()
        if self.stack:
            self.errors.append(f'unclosed elements: {self.stack}')

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.nodes.append((tag, attrs))
        if attrs.get('id'):
            if attrs['id'] in self.ids:
                self.errors.append(f'duplicate id: {attrs["id"]}')
            self.ids.add(attrs['id'])
        if tag not in VOID:
            self.stack.append(tag)
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.json_text = ''

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == 'script' and self.json_text is not None:
            self.json_blocks.append(json.loads(self.json_text))
            self.json_text = None
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f'mismatched closing tag: {tag}')
        else:
            self.stack.pop()

    def handle_data(self, data):
        if self.json_text is not None:
            self.json_text += data


def check_external(url):
    try:
        request = Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; SiteLinkCheck/1.0)'})
        with urlopen(request, timeout=20) as response:
            return url, response.status
    except Exception as error:
        return url, str(error)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--external', action='store_true')
    args = parser.parse_args()
    pages = {path: Page(ROOT / path) for path in ('index.html', 'privacy/index.html')}
    failures = []
    external = set()
    for path, page in pages.items():
        errors = page.errors
        route = '/' if path == 'index.html' else '/privacy/'
        canonical = [attrs['href'] for tag, attrs in page.nodes if tag == 'link' and attrs.get('rel') == 'canonical']
        if canonical != [ORIGIN + route]:
            errors.append('missing or incorrect canonical URL')
        for required in ('title', 'h1', 'main'):
            if sum(tag == required for tag, _ in page.nodes) != 1:
                errors.append(f'expected exactly one {required}')
        for tag, attrs in page.nodes:
            if tag == 'html' and not attrs.get('lang'):
                errors.append('missing document language')
            if tag == 'img' and not all(key in attrs for key in ('alt', 'width', 'height')):
                errors.append('image missing alt text or intrinsic dimensions')
            for reference in ('aria-controls', 'aria-labelledby', 'aria-describedby'):
                for identifier in attrs.get(reference, '').split():
                    if identifier not in page.ids:
                        errors.append(f'{reference} references unknown id {identifier}')
            for key in ('href', 'src'):
                if key not in attrs:
                    continue
                url = urlsplit(urljoin(ORIGIN + route, attrs[key]))
                if url.scheme in ('mailto', 'tel'):
                    continue
                if url.scheme != 'https':
                    errors.append(f'unexpected URL scheme: {attrs[key]}')
                    continue
                if url.netloc != urlsplit(ORIGIN).netloc:
                    external.add(url.geturl())
                    continue
                target_path = unquote(url.path.lstrip('/'))
                if not target_path or target_path.endswith('/'):
                    target_path += 'index.html'
                target = ROOT / target_path
                if not target.is_file():
                    errors.append(f'missing local target: {attrs[key]}')
                elif url.fragment:
                    target_page = pages.get(target_path)
                    if target_page is None or unquote(url.fragment) not in target_page.ids:
                        errors.append(f'missing fragment: {attrs[key]}')
        failures.extend(f'{path}: {error}' for error in errors)
        print(f'{path}: {len(errors)} errors; {len(page.ids)} unique IDs; {len(page.json_blocks)} JSON-LD blocks')
    sitemap = ET.parse(ROOT / 'sitemap.xml')
    namespace = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    locations = {node.text for node in sitemap.findall('.//s:loc', namespace)}
    if locations != {ORIGIN + '/', ORIGIN + '/privacy/'}:
        failures.append('sitemap URLs do not match the canonical routes')
    if ORIGIN + '/sitemap.xml' not in (ROOT / 'robots.txt').read_text():
        failures.append('robots.txt does not reference the canonical sitemap')
    print(f'Sitemap: {len(locations)} canonical routes. Unique external URLs: {len(external)}.')
    if args.external:
        with ThreadPoolExecutor(max_workers=4) as pool:
            for url, status in pool.map(check_external, sorted(external)):
                print(f'{status}: {url}')
                if not isinstance(status, int) or not 200 <= status < 400:
                    failures.append(f'external link requires review: {url} ({status})')
    if failures:
        raise SystemExit('\n'.join(failures))
    print('PASS: static site validation')


if __name__ == '__main__':
    main()
