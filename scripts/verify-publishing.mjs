// Optional end-to-end regression: four real static builds, with a temporary
// source document. Always clean up and restore the real production output.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { load } from 'cheerio';
import { prepareContent, projectRoot } from './prepare-content.mjs';

const source = 'tech/_自动发布验收临时.md';
const filename = path.join(projectRoot, 'content', source);
const route = '/tech/_自动发布验收临时/';
const page = path.join(projectRoot, 'dist', route, 'index.html');
const original = await prepareContent();
const astroPackage = JSON.parse(await fs.readFile(path.join(projectRoot, 'node_modules/astro/package.json'), 'utf8'));
const astroCli = path.join('node_modules/astro', astroPackage.bin.astro);
await fs.writeFile(filename, '', { flag: 'wx' });

function build() {
  const result = spawnSync(process.execPath, [astroCli, 'build'], {
    cwd: projectRoot, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  console.log('Static build succeeded.');
}

async function searchUrls() {
  const directory = path.join(projectRoot, 'dist/pagefind/fragment');
  const urls = [];
  for (const file of await fs.readdir(directory)) {
    const text = gunzipSync(await fs.readFile(path.join(directory, file))).toString('utf8');
    const fragment = JSON.parse(text.slice(text.indexOf('{')));
    urls.push(decodeURI(fragment.url));
  }
  return urls;
}

try {
  build();
  assert.equal((await prepareContent()).total, original.total);
  await assert.rejects(fs.stat(page), { code: 'ENOENT' });
  assert.equal((await searchUrls()).includes(route), false);

  await fs.writeFile(filename, `# 自动发布验收临时

一句正文就会自动发布。

## 中文标题

| 测试 | 结果 |
| --- | --- |
| GFM | 正常 |

行内公式 $x^2$。

$$
F=G \\frac{Mm}{R^2}
$$

\`\`\`python
print("你好")
\`\`\`

\`\`\`c
int main(void) { return 0; }
\`\`\`

\`\`\`cpp
int main() { return 0; }
\`\`\`

[相对中文链接](../心理学/jungus.md)

![头像](../neko.png)
`);
  build();
  const catalog = await prepareContent();
  assert.equal(catalog.total, original.total + 1);
  assert.equal(catalog.counts['技术'], original.counts['技术'] + 1);
  assert.equal((await searchUrls()).includes(route), true);
  const $ = load(await fs.readFile(page, 'utf8'));
  assert.equal($('main h1').length, 1);
  assert.equal($('table').length, 1);
  assert.equal($('.katex').length, 2);
  assert.equal($('pre code').length, 3);
  assert.ok($('h2#中文标题').length);
  assert.ok($('a[href="/心理学/jungus/"]').length);
  assert.ok($('img[src="/neko.png"]').length);

  await fs.writeFile(filename, '---\ntitle: 只有元数据\n---\n<!-- 没有正文 -->\n');
  build();
  assert.equal((await prepareContent()).total, original.total);
  await assert.rejects(fs.stat(page), { code: 'ENOENT' });
  assert.equal((await searchUrls()).includes(route), false);
  console.log('Verified empty → published → cleared: pages, counts and Pagefind index stay synchronized; GFM, Python/C/C++, inline/block math, Chinese anchors and relative links render correctly.');
} finally {
  await fs.unlink(filename);
  build();
  await prepareContent();
}
