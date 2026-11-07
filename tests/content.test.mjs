import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { unified } from 'unified';
import remarkContent from '../scripts/remark-content.mjs';
import { readDocument, hasVisibleBody, createCatalog, parseMarkdown, serializeDocument } from '../scripts/content.mjs';
import { prepareContent } from '../scripts/prepare-content.mjs';

test('publish only visible body, including short text, images, code and math', () => {
  for (const raw of ['', ' \n\t', '---\ntitle: 有标题\n---\n', '<!-- 注释 -->', '<!-- one\n two -->\n', '[example]: /hello', '<div><!-- hidden --></div>']) {
    assert.equal(hasVisibleBody(readDocument(raw).body), false, raw);
  }
  for (const raw of ['一句正文。', '# 标题', '---\ntitle: CPTSD\n---\n很短。', '![图](a.png)', '`x`', '```python\nprint(1)\n```', '$F=ma$', '<div>文字</div>', '&lt;!-- 可见文字 --&gt;']) {
    assert.equal(hasVisibleBody(readDocument(raw).body), true, raw);
  }
});

test('title precedence, original order, dynamic discovery, filtering, cleanup and idempotence', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'starlight-content-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const content = path.join(root, 'content');
  const write = async (file, value) => {
    const filename = path.join(content, file);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, value);
  };
  await write('_sidebar.md', '* 心理学\n  * [认知功能&心理结构](/心理学/jungus)\n  * [简短](/心理学/cptsd)\n* 空分类\n  * [未写](/empty/draft)\n');
  await write('README.md', '# 首页\n原文。\n');
  await write('心理学/jungus.md', '## 不应作为标题\n正文');
  await write('心理学/cptsd.md', '---\ntitle: CPTSD\n---\n一句。');
  await write('empty/draft.md', '<!-- 未写 -->');
  await write('心理学/nested/笔记.md', '## 标题回退\n正文');
  await write('心理学/文件名.md', '没有标题。');
  await write('心理学/图.png', Buffer.from([1, 2, 3]));
  let catalog = await prepareContent(root);
  assert.equal(catalog.total, 4);
  assert.deepEqual(catalog.counts, { 心理学: 4 });
  assert.equal(catalog.published.find((entry) => entry.source.endsWith('jungus.md')).title, '认知功能&心理结构');
  assert.equal(catalog.published.find((entry) => entry.source.endsWith('cptsd.md')).title, 'CPTSD');
  assert.equal(catalog.published.find((entry) => entry.source.endsWith('笔记.md')).title, '标题回退');
  assert.equal(catalog.published.find((entry) => entry.source.endsWith('文件名.md')).title, '文件名');
  assert.deepEqual(catalog.sidebar[1].items.slice(0, 2).map((item) => item.label), ['认知功能&心理结构', 'CPTSD']);
  const output = path.join(root, 'src/content/docs/心理学/jungus.md');
  const stat = await fs.stat(output);
  await prepareContent(root);
  assert.equal((await fs.stat(output)).mtimeMs, stat.mtimeMs);
  assert.equal(readDocument(await fs.readFile(output, 'utf8')).body, '## 不应作为标题\n正文');
  await write('心理学/自动发布.md', '');
  assert.equal((await prepareContent(root)).total, 4);
  await write('心理学/自动发布.md', '一句即可自动发布。');
  catalog = await prepareContent(root);
  assert.equal(catalog.total, 5);
  assert.equal(catalog.routes['/心理学/自动发布.md'], '/心理学/自动发布/');
  const generated = path.join(root, 'src/content/docs/心理学/自动发布.md');
  assert.ok((await fs.stat(generated)).isFile());
  await write('心理学/自动发布.md', '---\ntitle: 仍为空白\n---\n<!-- 只有注释 -->');
  catalog = await prepareContent(root);
  assert.equal(catalog.total, 4);
  assert.equal(catalog.routes['/心理学/自动发布.md'], undefined);
  await assert.rejects(fs.stat(generated), { code: 'ENOENT' });
  await fs.unlink(path.join(content, '心理学/图.png'));
  await prepareContent(root);
  await assert.rejects(fs.stat(path.join(root, 'public/content/心理学/图.png')), { code: 'ENOENT' });
  await write('新分类/_新文章.md', '新分类也自动收录。');
  await write('根目录文章.md', '根目录文章自动归入未分类。');
  catalog = await prepareContent(root);
  assert.equal(catalog.total, 6);
  assert.equal(catalog.counts['新分类'], 1);
  assert.equal(catalog.counts['未分类'], 1);
  assert.ok(catalog.sidebar.find((group) => group.label === '新分类').items[0].link.includes('_新文章'));
});

test('rendering keeps original body, avoids duplicate H1, rewrites relative and old Docsify links', async () => {
  const body = '# 标题\n\n[中文](../心理学/BPD.md?from=test#依恋)\n\n[旧路由](/#/心理学/BPD?id=依恋)\n\n![图](./图.png)';
  const article = { title: '标题', source: 'tech/test.md', data: {}, body };
  assert.equal(readDocument(serializeDocument(article)).body, body);
  const tree = await unified().use(remarkContent, {
    routes: { '/心理学/BPD.md': '/心理学/BPD/', '/心理学/BPD': '/心理学/BPD/' },
    assets: ['tech/图.png'],
  }).run(parseMarkdown(body), { data: { astro: { frontmatter: { title: '标题', sourcePath: 'tech/test.md' } } } });
  assert.equal(tree.children.some((node) => node.type === 'heading'), false);
  assert.equal(tree.children[0].children[0].url, '/心理学/BPD/?from=test#依恋');
  assert.equal(tree.children[1].children[0].url, '/心理学/BPD/#%E4%BE%9D%E6%81%8B');
  assert.equal(tree.children[2].children[0].url, '/content/tech/图.png');
});
