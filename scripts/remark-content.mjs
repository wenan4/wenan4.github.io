import path from 'node:path';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';

export default function remarkContent({ routes, assets }) {
  return (tree, file) => {
    const data = file.data.astro?.frontmatter ?? {};
    const source = data.sourcePath;
    if (!source) return;
    const first = tree.children.find((node) => node.type === 'heading');
    if (first?.depth === 1 && toString(first) === data.title) tree.children.splice(tree.children.indexOf(first), 1);
    visit(tree, 'heading', (node) => { if (node.depth === 1) node.depth = 2; });
    const rewrite = (url) => {
      if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/|#(?!\/))/i.test(url)) return url;
      const legacy = url.startsWith('#/') || url.startsWith('/#/');
      const cleaned = url.replace(/^\/?#\//, '/');
      const separator = cleaned.search(/[?#]/);
      const pathname = separator < 0 ? cleaned : cleaned.slice(0, separator);
      const suffix = separator < 0 ? '' : cleaned.slice(separator);
      let decoded;
      try { decoded = decodeURIComponent(pathname); } catch { return url; }
      const resolved = path.posix.normalize(decoded.startsWith('/') ? decoded : `/${path.posix.dirname(source)}/${decoded}`);
      const route = routes[resolved] ?? routes[resolved.replace(/\/$/, '')];
      if (route) {
        if (legacy) {
          const id = new URLSearchParams(suffix.replace(/^\?/, '')).get('id');
          return route + (id ? `#${encodeURIComponent(id)}` : '');
        }
        return route + suffix;
      }
      const asset = resolved.slice(1);
      if (assets.includes(asset)) return `/content/${asset}${suffix}`;
      if (/^\/(?:neko|tezcatlipoca)\.png$/.test(resolved)) return resolved + suffix;
      return url;
    };
    visit(tree, (node) => {
      if (['link', 'image', 'definition'].includes(node.type)) node.url = rewrite(node.url);
      if (source === 'tech/markdown语法.md' && node.type === 'image' && /(?:^|\/)图片地址$/.test(node.url)) {
        // Original tutorial placeholder: leave the visible alt text intact,
        // but render a span instead of requesting a nonexistent local image.
        node.type = 'html';
        const alt = String(node.alt ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
        node.value = `<span role="img" aria-label="${alt}">${alt}</span>`;
      }
    });
  };
}
