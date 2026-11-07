# 吻安的主页

使用 Astro 7 + 官方 Starlight 的纯静态个人站点，部署目标为 <https://wenan4.github.io/>。

## 本地运行

使用 Node.js 24（`.nvmrc`），最低 Node.js 22.23.4。

```sh
git clone --branch migration/astro-starlight https://github.com/wenan4/wenan4.github.io.git
cd wenan4.github.io
npm ci
npm run dev
```

开发服务默认在 `http://localhost:4321/`。修改 `content/` 后自动准备文章；文章增删、标题和分类计数变化通过 Astro 官方 `addWatchFile` 机制自动重载配置。

```sh
npm run build
npm run preview
```

构建输出在 `dist/`，只需静态文件托管，不需要 Node.js 服务器。开发模式不提供生产搜索索引，请用 `build` + `preview` 检查搜索。

## 写文章

- 只维护 `content/` 中的文章；首页是 `content/README.md`。
- 原文章和中文文件名完整保留。新 Markdown 放进对应分类目录即可，不用填写新导航链接。新目录会自动成为新分类，子目录成为可折叠分组。
- 空文件、空格、仅 YAML frontmatter、仅注释均不会生成页面、侧栏链接和搜索记录；一句正文也会发布。
- `content/_sidebar.md` 只作为原分类顺序、旧标题和文章顺序的兼容提示。新增文章无需更新它；空分类自动隐藏。
- 标题优先级：frontmatter `title` → 原侧栏名称 → 第一处标题 → 文件名。
- `src/content/docs/`、`src/generated/`、`public/legacy-routes.json`、`public/content/` 自动生成，不提交、不手工编辑。
- 本地附件可放进 `content/`，在正文中用相对路径引用；脚本会同步到静态资源目录并转换链接。站点标识保留在 `public/neko.png`，背景在 `public/tezcatlipoca.png`。
- 原文保持不变。渲染时仅移除与页面标题完全相同的首个 H1，其他 H1 转为 H2，避免文章中出现多个页面主标题。
- 全站使用淡黄色暖色强调，分类计数为无色块的括号文字。标题和导航使用思源黑体，文章正文使用思源宋体；全局样式会自动用于未来新增文章。
- 思源字体随站点静态托管，保留上游简体中文字库的完整字符覆盖；无需访客安装字体，也无需新增文章后重新生成字体。字体下载期间先显示后备字体，来源与许可证见 `public/fonts/`。

## 验证

```sh
npm test
npm run verify
npm run test:publishing
```

`verify` 执行发布规则测试、正式构建和构建产物检查（计数、链接、资源、锚点、数学公式、代码块、隐藏页面、纯静态输出）。

`test:publishing` 是较慢的完整回归：临时创建文章，实际构建空白、已发布、清空三个状态，直接核验 Pagefind 搜索片段，并测试 GFM、中文锚点、Python/C/C++、行内和块级公式。结束时删除临时文章并恢复正常构建。不要同时运行开发服务或其他构建任务。

## 上线

迁移分支不会发布。请先审阅 [迁移验收报告](docs/migration-report.md)。确认上线后，再将本分支合并到 `main`，在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，然后在 Actions 中手动运行 `Build and deploy Astro` 的 `main` 工作流（或推送一次 `main`）。

工作流在 PR 中只构建和验证；只有 `main` 可以部署。`site` 为 `https://wenan4.github.io`，未配置仓库子路径 `base`。无需修改 DNS、Cloudflare、域名或仓库公开状态。
