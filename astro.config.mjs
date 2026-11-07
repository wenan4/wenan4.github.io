import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { prepareContent } from './scripts/prepare-content.mjs';
import { contentIntegration } from './scripts/content-integration.mjs';
import remarkContent from './scripts/remark-content.mjs';

const catalog = await prepareContent();

export default defineConfig({
  site: 'https://wenan4.github.io',
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    processor: unified({
      smartypants: false,
      remarkPlugins: [remarkMath, [remarkContent, { routes: catalog.routes, assets: catalog.assets }]],
      rehypePlugins: [rehypeKatex],
    }),
  },
  integrations: [
    contentIntegration(),
    starlight({
      title: '吻安的主页',
      disable404Route: true,
      logo: { src: './public/neko.png' },
      favicon: '/neko.png',
      defaultLocale: 'root',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/wenan4/wenan4.github.io' }],
      sidebar: catalog.sidebar,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      customCss: ['katex/dist/katex.min.css', './src/styles/custom.css'],
      head: [{ tag: 'script', attrs: { src: '/legacy-redirect.js', defer: true } }],
    }),
  ],
});
