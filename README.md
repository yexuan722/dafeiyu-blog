# dafeiyu-blog · 大肥鱼的鱼塘

[yexuan.qzz.io](https://yexuan.qzz.io) 的源码。Astro 静态博客，零后端、零数据库，
构建产物托管在 Cloudflare Pages。

## 本地开发

```bash
pnpm install
pnpm dev          # http://localhost:4321
```

## 构建

```bash
pnpm build        # 输出到 dist/
pnpm preview      # 本地预览构建产物
```

> 需要 Node ≥ 20.3 与 pnpm 11（已通过 `packageManager` 字段锁定）。

## 写文章

在 `src/content/posts/` 下新建 `.md` 文件，**文件名就是 URL 后缀**。

```yaml
---
title: "文章标题"
description: "一句话摘要，会显示在列表页和 SEO 描述里"
pubDate: 2026-10-24
tags: ["标签1", "标签2"]
draft: false        # true 则不会出现在站点和构建产物里
---
```

frontmatter 写错会直接让构建失败，这是故意的——省得线上才发现。

## 发布

日常只需要一条：

```bash
git push
```

Cloudflare Pages 连上这个仓库后会自动构建并上线。

### 首次在 Cloudflare 创建项目

1. Workers & Pages → Create → Pages → **Connect to Git**
2. 选仓库 `yexuan722/dafeiyu-blog`
3. 构建配置：

   | 项 | 值 |
   |---|---|
   | Framework preset | `Astro` |
   | Build command | `pnpm build` |
   | Build output directory | `dist` |
   | Root directory | 留空 |

4. 保存并部署，先用 `*.pages.dev` 的地址验收
5. 项目 → Custom domains → 添加 `yexuan.qzz.io`

> 自定义域名同时只能挂在一个 Pages 项目上。先把旧项目里的 `yexuan.qzz.io`
> 移除，再添加到新项目。

### 手动部署（备用）

```powershell
.\deploy.ps1      # 构建 + wrangler 直传
```

## 目录结构

```
├── astro.config.mjs         # 站点地址 + Shiki 双主题（light / dark）
├── public/                  # 原样拷贝到产物根目录
│   ├── _headers             # Cloudflare 安全头与缓存策略
│   ├── favicon.svg
│   ├── hero.webp            # 首页 banner 插画（日间）1920×1071，91KB
│   ├── hero-dark.webp       # 同一张图的夜间版，73KB
│   ├── hero-2x.webp         # 141KB，高分屏（≥1.5 倍）用的 2880×1607
│   ├── hero-dark-2x.webp    # 103KB，同上，夜间版
│   ├── avatar.webp          # 从日间图裁的头像 288×288（15KB）
│   └── og.jpg               # 社交卡片图 1200×630
└── src/
    ├── content.config.ts    # 文章集合 schema
    ├── content/posts/       # Markdown 文章
    ├── components/
    │   ├── PostCard.astro       # 首页 / 归档 / 标签页共用文章卡片
    │   └── TechBackground.astro  # 文章页粒子网络 + 鼠标互动（跟随主题换色）
    ├── lib/post.ts          # 日期 / 阅读时长 / 排序 / 标签色相
    ├── layouts/Base.astro   # 全站骨架：顶栏、主题切换、页脚
    ├── pages/
    │   ├── index.astro      # 首页：介绍与鲸鱼娘 + 最新文章 + 单侧简介
    │   ├── posts/index.astro  # 全部文章列表
    │   ├── posts/[...slug].astro  # 正文 + 目录 + 阅读进度
    │   ├── tags.astro       # 标签云 + 筛选（?tag=xxx）
    │   ├── search.astro     # 关键词搜索（?q=xxx）
    │   ├── search.json.ts   # 搜索索引，构建时生成 /search.json
    │   ├── about.astro      # 关于
    │   └── 404.astro        # 自定义 404
    └── styles/global.css    # 设计 token + 两套主题
```

## 栏目

| 路径 | 作用 |
|---|---|
| `/` | 首页：插画与介绍，下方文章主栏 + 右侧简介和话题 |
| `/posts/` | 全部文章，按时间倒序 |
| `/tags/` | 标签云；点标签即时筛选，URL 同步成 `?tag=DeepSeek`，可以直接分享 |
| `/search/` | 前端搜索，索引是构建时生成的 `/search.json`；空格分隔多词＝全部命中 |
| `/about/` | 关于 |

标签的颜色由标签名 hash 出来（`tagHue()`），同一个标签永远是同一个色相，
换文章、重新构建都不会变色。字号随文章数微调。

## 首页

- 保留原有鲸鱼娘、蓝色主题、头像和日夜两套插画，没有重绘或替换素材。
- 桌面首屏约 590px 高。左边放介绍、文章数、标签数、最近发文日期和最新笔记；
  右边原图按高度缩放，保留人物比例。左侧渐变只融合空白背景，不遮盖角色。
- 高分屏仍使用 `hero-2x.webp` / `hero-dark-2x.webp`，日夜主题按需加载。
- 正文采用 `minmax(0, 1fr) | 252px` 两栏：文章 + 右侧简介、话题。
  820px 以下改为单列，先文章、后辅助信息。手机插画在介绍上方单独展示。
- 顶栏是主导航，名片和页脚不再重复“关于 / 文章 / 标签 / 搜索”。
- 首页、归档和标签页共用 `PostCard.astro`，最多显示三个主要标签；卡片空白区
  进入文章，标签独立进入筛选页。搜索结果采用相同的链接行为。
- 文章页在窄屏提供折叠目录，文末可返回文章列表；示例文章保留为草稿。

## 桌宠（大肥鱼）

左下角那只可以戳的，`src/components/FishPet.astro`。

- 7 个状态：干活 / 敲字 / 犯困 / 鱼脑过载 / 炸毛 / 有点烦 / 气鼓鼓。
  源素材是表情包里的 GIF，用 Pillow 转成 **240×240 动图 WebP**（`public/pet/*.webp`）：
  **16.3MB → 1.79MB**，超过 36 帧的会等差抽帧，单张 130–320KB。
- **点一下就换一只**：换图 + 冒气泡 + `fp-pop` 的 q 弹动画（压扁→回弹，带过冲）。
- **可以拖着走**：`pointerdown/move/up` + `setPointerCapture`，位置存 `localStorage["fishpet-pos"]`。
  - 位移超过 5px 才算拖动，松手不会误触发「换一只」（`suppressClick` 标记）。
  - 松手夹取到视口内（四边各留 8px），窗口 resize 时再夹一次。
  - 贴到上沿（`y < 160`）气泡翻到鱼下面；拖到右半边气泡改右对齐，不会顶出屏幕。
  - 拖动时 `cursor: grabbing`、暂停浮动动画、关掉 hover 位移。
- 气泡拆两行：正文 + 颜文字右对齐，避免 `(╬ Ò﹏Ó)` 被折成两截。
  **必须写 `width: max-content`**，否则绝对定位在只有鱼宽的父级里会被压成窄柱。
- 状态存 `localStorage["fishpet-state"]`，刷新后还是上次那只；`/#pet-3` 可以直接定格某一只。
- 首屏只加载当前这张，`requestIdleCallback` 里再预热其它；点过之后 1.2 秒再预热一轮。
- 尊重 `prefers-reduced-motion`（关掉浮动和弹跳）和 `saveData` / 2G（不预热）。
- 1024px 以下收起；1025–1400px 缩为 92px，宽屏 120px。开场不冒泡，
  点击才说话，避免遮住文章。首页鲸鱼娘插画不受这个断点影响。

## 主题（日间 / 夜间）

- `html[data-theme="dark" | "light"]`，颜色全在 `global.css` 的 CSS 变量里，组件不写死颜色。
- 首次访问跟随系统 `prefers-color-scheme`；手动切过就写 `localStorage["dafeiyu-theme"]`，
  只存在本机，没有 Cookie 也没有埋点。
- `Base.astro` 里有一段 `is:inline` 的同步脚本，在首屏绘制之前定主题，避免白闪一下。
- 代码高亮用 Shiki 双主题（`themes: { light, dark }`）：浅色是内联默认色，深色靠
  `color: var(--shiki-dark) !important` 覆盖。**别去 `var(--shiki-light)`**，那个变量不存在，
  写了解析成无效值，整块代码会掉成继承色。
- 文章页的 canvas 粒子会读 `--p1 / --p2 / --p3 / --link-rgb`，切主题时重新读一次，
  不用刷新。

## 视觉约定

一套 token，两种氛围，靠 `Base.astro` 的 `variant` 切换：

| variant | 用在 | 表现 |
|---|---|---|
| `anime` | 首页、文章列表、标签、搜索、404 | 蓝紫光斑 + 星点，胶囊卡片 |
| `tech` | 文章、关于 | 细网格 + canvas 粒子网络，鼠标靠近连线、点击冲击波 |

- 深色：藏青底 `#0a0d16`、冰蓝 `#dcefff`、主色 `#8fc0ff`、青色 `#6fd0ff`；
  浅色：底 `#f3f6fc`、文字 `#333d52`、主色 `#2f6fd0`。
- 渐变淡出**必须用「同色的 0 透明度」**（`rgba(10,13,22,0)`），不能直接写 `transparent`：
  CSS 渐变插值是按非预乘算的，从 `#f3f6fc` 淡到 `transparent`（= 透明黑）中间会冒出一条灰带。
  首页 banner 上之前那条「灰雾」就是这么来的。
- 正文面板在小屏上关掉 `backdrop-filter`，避免「粒子动画 + 大面积模糊」掉帧。
- 动效全部尊重 `prefers-reduced-motion`：开了减少动态效果就全部静止。

## 注意

- `draft: true` 的文章不会进入构建产物，可以放心先提交。
- **发布前过一遍脱敏**：不要写 API Key、本地绝对路径、内网信息。
- `dist/` 与 `node_modules/` 已在 `.gitignore` 里，不需要提交。
- `pnpm-workspace.yaml` 里的 `allowBuilds` 是 pnpm 11 的新写法，别删——
  删了 `pnpm install` 会以退出码 1 结束，CI 会直接失败。
- 首页 banner 那张插画由站长提供，来源与授权待确认，**只当站内装饰，别拿去商用**。
