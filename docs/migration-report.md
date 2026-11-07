# Docsify → Astro Starlight 迁移验收报告

验收日期：2026-11-07（Asia/Shanghai）。原始提交：`8fc32ca998b57f892f8171f830ecfdfbd3d35572`。开发分支：`migration/astro-starlight`。

## 结果与范围

已替换 Docsify 入口及 CDN 插件，采用 Astro 7.4.7、Starlight 0.42.10、官方 Unified Markdown 处理器、原生主题切换/导航/目录、Pagefind、KaTeX。依赖版本和 lockfile 已锁定。所有页面均预渲染成静态文件。

网站名称、原背景图、头像与 favicon 保留；自定义 CSS 延续原站 85% 浅色遮罩，并为深色主题提供对应遮罩。布局与移动导航由 Starlight 原生组件负责，无整套组件复制、无 UI 框架或客户端 DOM 布局改造。

根据后续外观要求，全局强调色调整为奶油黄和暖棕色，分类数量改为无背景、无边框的括号文字。标题与导航使用 Adobe 思源黑体，正文使用 Adobe 思源宋体。字体静态托管，保留上游简体字库的完整字符覆盖；以后新增文章自动沿用，无需逐篇配置或重新裁字。字体许可和来源记录在 `public/fonts/`，字体加载声明在 `src/styles/fonts.css`。两份完整可变字体共约 18MB，下载期间先显示后备字体，加载完成后切换为思源字体。

没有合并到 `main`，没有上线，没有修改 Pages 发布源、DNS、Cloudflare、域名和仓库 Public 状态。

## 内容与完整性

原始 24 个 Markdown 文件（含首页与侧栏）和 2 张图片均与基准提交的 Git blob 逐字节核对一致，SHA-256 记录在 `docs/migration-baseline.json`。源文件只做目录迁移，没有改写正文。

| 分类 | 初始发布数 |
| --- | ---: |
| 技术 | 1 |
| 动漫/漫画 | 2 |
| 游戏 | 1 |
| 心理学 | 5 |
| 哲学 | 2 |
| 神秘学 | 2 |
| 月世界 | 4 |
| 合计 | 17 |

另有首页 1 页。最终输出 18 个内容页 + 1 个不进入搜索的 404 页。上表只是初次验收记录，运行时不读取它，计数完全由当前文件内容计算。

5 篇原有空白文件保留在源目录中，未生成公开页面、侧栏项或搜索索引：

- `game/p5r.md`
- `心理学/弗洛伊德-荣格-阿德勒.md`
- `哲学/飞天意面.md`
- `月球史-月世界/宝石翁.md`
- `月球史-月世界/斯卡哈·斯卡蒂.md`

`心理学/cptsd.md` 的短正文正常发布；`月球史-月世界/README.md` 作为「介绍」发布，并计入月世界 4 篇。

## 自动发布机制

`scripts/content.mjs` 先剥离 YAML frontmatter，再解析 Markdown 语法树，排除无可见正文的文件（包括仅注释和链接定义）。文字、短句、非空代码、数学公式及图片可作为可见内容。

`scripts/prepare-content.mjs` 使用同一份发布结果生成内容集合、嵌套侧栏、分类 badge、计数清单与旧链接映射；隐藏文章根本不会进入 Astro 内容集合，因此不产生 HTML 和 Pagefind 索引。每次生成都会移除过期文件，仅在输出变化时写入。

Astro 配置加载时自动准备内容，标准 `dev`、`build` 在全新克隆中即可运行。开发集成监听源 Markdown，正文改动触发原生内容更新；文章增删、标题或资产元数据变化通过官方 `addWatchFile` 自动刷新配置。

## 主要文件

| 文件/目录 | 用途 |
| --- | --- |
| `content/` | 唯一维护的文章源文件，含原首页和导航提示 |
| `public/neko.png`、`public/tezcatlipoca.png` | 原头像、favicon 和背景 |
| `astro.config.mjs` | 静态站点、Starlight、公式、中文、本机生成入口 |
| `src/content.config.ts` | 官方 glob 内容加载器与 Starlight schema，保留原路径大小写和中文 |
| `scripts/content.mjs`、`scripts/prepare-content.mjs` | 统一发布判断、标题回退、侧栏、计数与生成 |
| `scripts/content-integration.mjs` | 开发模式自动更新 |
| `scripts/remark-content.mjs` | 渲染阶段避免重复 H1、转换内部链接和附件路径 |
| `src/styles/custom.css` | 原视觉身份与明暗遮罩 |
| `public/legacy-redirect.js` | 旧 Docsify hash 路由兼容 |
| `src/pages/404.astro` | 原生 Starlight 布局的无索引错误页 |
| `.github/workflows/deploy.yml` | PR 构建验证、main 静态构建与 Pages 部署 |
| `tests/content.test.mjs`、`scripts/verify-*.mjs` | 发布规则与真实构建验收 |
| `package.json`、`package-lock.json`、`.nvmrc` | 固定依赖和 Node 环境 |

## 已验证

- 依赖安装与 lockfile；Node.js 24。依赖审计为 0 项已知漏洞。数学插件的传递 KaTeX 统一使用直接依赖的 0.19.1，避免旧版本问题与 CSS/渲染器版本不一致。
- `npm test`：发布规则、frontmatter、仅注释、标题优先级、旧顺序、新文章自动发现、子目录、生成幂等、附件清理、内部链接、首个 H1 去重通过。
- `npm run verify`：生产静态构建、17 篇分类文章 + 首页、5 篇草稿隐藏、分类总数、所有意外站内死链、资源和 TOC 锚点检查通过；无构建警告。
- `npm run test:publishing`：实际执行四次构建，验证空白 → 写入正文 → 清空正文，并恢复基准。页面、分类数、旧路由映射与 Pagefind 片段同步增加和移除。GFM 表格、中文 H2 锚点、Python/C/C++、行内与块级公式、相对中文链接和本地图片均通过。
- 开发服务启动成功，实际验证新增文章及导航自动出现、清空后同时移除，原路径返回 404。
- Edge 浏览器：1440 × 1000 桌面三栏；左栏 300px、中栏 780px、右栏 360px。背景固定、头像正常加载。
- Edge 浏览器：390 × 844 手机页面无横向溢出（scrollWidth = 390px），原生菜单可展开，明暗主题可切换且正文清晰。
- Pagefind 中文正文搜索「自性化」返回「认知功能&心理结构」与「共时性」；空白文档不在搜索片段中。
- 语法页 `F=G \\frac{Mm}{R^2}` 实际输出 KaTeX，而非原始公式；Python 代码高亮正常。
- `/#/心理学/jungus?id=两种普遍态度` 实际跳转到新中文 URL 并定位对应标题；中文路径、分类 README 和大写 BPD 保留。
- 验收页面浏览器控制台无错误和警告。

## 兼容性边界与旧链接风险

1. 所有现有已发布文章的 `/#/路径`、`/#/路径.md` 和带中文编码的 hash 链接均有生成的兼容映射。通过浏览器脚本执行静态跳转，因此关闭 JavaScript 的客户端不会进行旧 hash 跳转；新静态 URL 的正文仍可访问。
2. 已验证常见旧 `?id=中文标题` 目录定位。含特殊标点、重复标题或原首页 H1 的旧锚点可能与 Starlight 的锚点算法不同，页面跳转仍可完成，但个别锚点可能只能到页面顶部；本次没有声称所有历史标题锚点完全等价。
3. 5 个空白文档不再具有公开页面，这是发布规则要求。指向这些草稿的旧链接不会转换成一个空白页；以后写入正文后自动恢复到映射中。
4. 旧的原始 `.md` 文件 HTTP 地址随源目录迁移改变；站内 Markdown 相对链接已在渲染阶段转成页面 URL，但外部直接链接原始 Markdown 文件的地址不在 hash 路由兼容范围内。
5. `tech/markdown语法.md` 原有「链接地址」「图片地址」是教学占位符，不是实际资源。正文原文完整保留；图片占位符渲染成保留替代文本的占位元素，避免请求不存在图片。链接示例仍保留原占位地址，点击会 404；验收脚本明确列出这一个预期示例，不将其当成真实导航。未擅自替换为新文章或外部图片。
6. 开发模式使用 Starlight 原生行为，不生成正式 Pagefind 索引。搜索应在生产构建后用 `npm run preview` 验证。
7. 未做线上发布，因此生产域名的 Actions 部署与线上验证仍待用户确认上线后执行。

## 本地命令与上线操作

```sh
npm ci
npm run dev
npm run build
npm run preview
npm test
npm run verify
npm run test:publishing
```

确认上线后：审阅并合并迁移分支到 `main`；进入仓库 Settings → Pages，将 Source 选择为 GitHub Actions；在 Actions 中对 `main` 手动运行 `Build and deploy Astro`，或再推送一次 `main`。等待 build/deploy 成功，再访问 <https://wenan4.github.io/> 验证首页、搜索、中文文章、旧链接和手机导航。无需配置 `/wenan4.github.io/` base，也无需更改 DNS 或 Cloudflare。

工作流等价采用 Astro 官方文档中的标准 Pages 构建与部署方式，并在部署前增加测试。参考：[Astro GitHub Pages](https://docs.astro.build/en/guides/deploy/github/)、[Astro Markdown 处理器](https://docs.astro.build/en/guides/markdown-content/)、[Starlight 侧栏](https://starlight.astro.build/guides/sidebar/)。
