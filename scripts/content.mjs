import fs from 'node:fs/promises';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { toString } from 'mdast-util-to-string';
import { parse, stringify } from 'yaml';

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
export const parseMarkdown = (body) => parser.parse(body);
export const posix = (value) => value.replaceAll('\\', '/');
export const routeFor = (source) => source === 'README.md' ? '/' : `/${source.replace(/\.md$/i, '')}/`;

export function readDocument(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/);
  const data = match ? parse(match[1]) ?? {} : {};
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Frontmatter must be a YAML mapping');
  return { data, body: match ? text.slice(match[0].length) : text };
}

// Parse Markdown, rather than counting raw characters: comments and link
// definitions are invisible; short text, code, math and images are publishable.
export function hasVisibleBody(body) {
  function visible(node) {
    if (['definition', 'footnoteDefinition'].includes(node.type)) return false;
    if (node.type === 'html') {
      const html = node.value.replace(/<!--[\s\S]*?(?:-->|$)/g, '')
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
      return /<(img|video|audio|iframe|svg|hr)\b/i.test(html) ||
        /\S/u.test(html.replace(/<[^>]*>/g, '').replace(/&(?:nbsp|#160|#xA0);/gi, ' '));
    }
    if (['image', 'imageReference', 'thematicBreak'].includes(node.type)) return true;
    if (typeof node.value === 'string') return /[^\s\u200B\uFEFF]/u.test(node.value);
    return node.children?.some(visible) ?? false;
  }
  return visible(parseMarkdown(body));
}

export async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')).map(async (entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : entry.isFile() ? [filename] : [];
  }));
  return files.flat();
}

function legacyNavigation(markdown) {
  const groups = [];
  const hints = new Map();
  let group;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^\* ([^\[].*)$/);
    if (heading) {
      group = { label: heading[1].trim(), directory: undefined, sources: [] };
      groups.push(group);
    }
    const link = line.match(/^\s+\* \[([^\]]+)\]\(([^)]+)\)/);
    if (link && group) {
      const source = decodeURIComponent(link[2]).replace(/^\/#?\/?|^#\//, '').replace(/\/$/, '').replace(/\.md$/i, '') + '.md';
      group.directory ??= source.split('/')[0];
      group.sources.push(source);
      hints.set(source, { title: link[1], order: group.sources.length });
    }
  }
  return { groups, hints };
}

function treeSidebar(articles, prefix, hints) {
  const children = new Map();
  for (const article of articles) {
    const rest = article.source.slice(prefix.length);
    const directory = rest.includes('/') ? rest.split('/')[0] : undefined;
    const key = directory ? `${prefix}${directory}/` : article.source;
    if (!children.has(key)) children.set(key, { directory, articles: [] });
    children.get(key).articles.push(article);
  }
  return [...children.entries()].sort(([keyA, a], [keyB, b]) => {
    const order = (entry) => Math.min(...entry.articles.map((article) => hints.get(article.source)?.order ?? Infinity));
    return order(a) - order(b) || keyA.localeCompare(keyB, 'zh-CN');
  }).map(([key, child]) => child.directory ? {
    label: child.directory, badge: String(child.articles.length), collapsed: true,
    items: treeSidebar(child.articles, key, hints),
  } : { label: child.articles[0].title, link: child.articles[0].route });
}

export async function createCatalog(contentDir) {
  const navigation = await fs.readFile(path.join(contentDir, '_sidebar.md'), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const { groups, hints } = legacyNavigation(navigation);
  const published = [];
  const hidden = [];
  const assets = [];
  for (const filename of await walk(contentDir)) {
    const source = posix(path.relative(contentDir, filename));
    if (!/\.md$/i.test(source)) { assets.push(source); continue; }
    if (source === '_sidebar.md') continue;
    const raw = await fs.readFile(filename, 'utf8');
    const { data, body } = readDocument(raw);
    if (!hasVisibleBody(body)) { hidden.push(source); continue; }
    const heading = parseMarkdown(body).children.find((node) => node.type === 'heading');
    const title = String(data.title || hints.get(source)?.title || (heading && toString(heading)) || path.basename(source, '.md'));
    published.push({ source, title, route: routeFor(source), data, body, raw });
  }
  const articles = published.filter((entry) => entry.source !== 'README.md');
  const directories = [...new Set(articles.filter((entry) => entry.source.includes('/')).map((entry) => entry.source.split('/')[0]))];
  for (const directory of directories) {
    if (!groups.some((group) => group.directory === directory)) groups.push({ label: directory, directory });
  }
  const sidebar = [{ label: '返回首页', link: '/' }];
  const counts = {};
  for (const group of groups) {
    const entries = articles.filter((article) => article.source.startsWith(`${group.directory}/`));
    if (!entries.length) continue;
    counts[group.label] = entries.length;
    sidebar.push({ label: group.label, badge: String(entries.length), collapsed: false,
      items: treeSidebar(entries, `${group.directory}/`, hints) });
  }
  const ungrouped = articles.filter((entry) => !entry.source.includes('/'));
  if (ungrouped.length) {
    counts['未分类'] = ungrouped.length;
    sidebar.push({ label: '未分类', badge: String(ungrouped.length), collapsed: false,
      items: treeSidebar(ungrouped, '', hints) });
  }
  const routes = { '/': '/', '/README': '/', '/README.md': '/' };
  for (const article of published) {
    const withoutExtension = `/${article.source.replace(/\.md$/i, '')}`;
    routes[withoutExtension] = article.route;
    routes[`${withoutExtension}.md`] = article.route;
    routes[`${withoutExtension}/`] = article.route;
  }
  return { published, hidden, assets, sidebar, counts, routes, total: articles.length };
}

export function serializeDocument(article) {
  // The source body stays byte-for-byte intact; heading/link changes happen in
  // the renderer only, not in either the maintained or generated Markdown.
  return `---\n${stringify({ ...article.data, title: article.title, sourcePath: article.source })}---\n${article.body}`;
}
