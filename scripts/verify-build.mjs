import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { createCatalog, routeFor, walk } from './content.mjs';
import { projectRoot } from './prepare-content.mjs';

const dist = path.join(projectRoot, 'dist');
const catalog = await createCatalog(path.join(projectRoot, 'content'));
const pages = (await walk(dist)).filter((filename) => filename.endsWith('.html'));
assert.equal(pages.length, catalog.published.length + 1, 'only published pages plus 404');
assert.equal(Object.values(catalog.counts).reduce((sum, count) => sum + count, 0), catalog.total);
for (const entry of catalog.published) {
  const filename = path.join(dist, entry.route, 'index.html');
  const $ = load(await fs.readFile(filename, 'utf8'));
  assert.equal($('main h1').length, 1, `${entry.source}: one page title`);
  assert.equal($('html').attr('lang'), 'zh-CN');
  assert.ok($('[data-pagefind-body]').length, `${entry.source}: searchable`);
  for (const item of catalog.sidebar.slice(1)) {
    assert.ok($('#starlight__sidebar').text().includes(item.label), `sidebar label ${item.label}`);
  }
}
for (const source of catalog.hidden) {
  await assert.rejects(fs.stat(path.join(dist, routeFor(source), 'index.html')), { code: 'ENOENT' });
  assert.equal(catalog.routes[`/${source}`], undefined);
}

const broken = [];
const expectedPlaceholders = [];
for (const filename of pages) {
  const relative = path.relative(dist, filename).split(path.sep).join('/');
  const pageUrl = new URL(relative, 'https://wenan4.github.io/');
  const $ = load(await fs.readFile(filename, 'utf8'));
  for (const element of $('a[href], img[src], script[src], link[href]').toArray()) {
    const value = $(element).attr('href') ?? $(element).attr('src');
    if (!value || /^(?:data:|mailto:|tel:|javascript:)/.test(value)) continue;
    const url = new URL(value, pageUrl);
    if (url.origin !== pageUrl.origin) continue;
    const pathname = decodeURIComponent(url.pathname);
    // These are literal demonstration URLs already present in the original
    // Markdown syntax tutorial. They are not real site navigation or assets.
    if (relative === 'tech/markdown语法/index.html' && /\/(链接地址|图片地址)$/.test(pathname)) {
      expectedPlaceholders.push({ page: relative, href: value });
      continue;
    }
    let target = path.join(dist, pathname);
    let stat = await fs.stat(target).catch(() => null);
    if (stat?.isDirectory()) { target = path.join(target, 'index.html'); stat = await fs.stat(target).catch(() => null); }
    if (!stat?.isFile()) { broken.push({ page: relative, href: value }); continue; }
    if (url.hash && target.endsWith('.html')) {
      const targetDoc = load(await fs.readFile(target, 'utf8'));
      const id = decodeURIComponent(url.hash.slice(1));
      if (!targetDoc('[id]').toArray().some((node) => targetDoc(node).attr('id') === id)) broken.push({ page: relative, href: value, reason: 'missing anchor' });
    }
  }
}
assert.deepEqual(broken, [], 'no unexpected broken internal links or assets');
const tutorial = load(await fs.readFile(path.join(dist, 'tech/markdown语法/index.html'), 'utf8'));
assert.ok(tutorial('.katex').length, 'LaTeX renders to KaTeX');
assert.ok(tutorial('pre code').length, 'highlighted code is present');
assert.ok((await fs.stat(path.join(dist, 'pagefind/pagefind.js'))).isFile(), 'native Pagefind index exists');
await assert.rejects(fs.stat(path.join(dist, 'server')), { code: 'ENOENT' });
console.log(`Verified ${catalog.total} articles + homepage, ${catalog.hidden.length} hidden drafts, counts, links, assets, anchors, KaTeX, code and static output.`);
if (expectedPlaceholders.length) console.log('Original tutorial placeholders (expected):', expectedPlaceholders);
