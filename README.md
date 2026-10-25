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
├── astro.config.mjs
├── public/                  # 原样拷贝到产物根目录
│   ├── _headers             # Cloudflare 安全头与缓存策略
│   ├── favicon.svg
│   └── og.jpg               # 社交卡片图 1200×630
└── src/
    ├── content.config.ts    # 文章集合 schema
    ├── content/posts/       # Markdown 文章
    ├── components/
    │   ├── Mascot.astro     # 首页那条鱼（纯手写 SVG，会眨眼）
    │   └── TechBackground.astro  # 文章页粒子网络 + 鼠标互动
    ├── lib/post.ts          # 日期/阅读时长/排序等小工具
    ├── layouts/Base.astro   # 全站骨架（variant: anime | tech）
    ├── pages/
    │   ├── index.astro      # 首页：二次元立绘 + 文章卡片
    │   ├── about.astro      # 关于
    │   ├── 404.astro        # 自定义 404
    │   └── posts/[...slug].astro  # 正文 + 目录 + 阅读进度
    └── styles/global.css
```

## 视觉约定

两种页面氛围，由 `Base.astro` 的 `variant` 决定：

| variant | 用在 | 表现 |
|---|---|---|
| `anime` | 首页、404 | 蓝紫光斑 + 星点，立绘、气泡、胶囊卡片 |
| `tech` | 文章、关于 | 细网格 + canvas 粒子网络，鼠标靠近会连线、点击有冲击波 |

正文面板在小屏上会关掉 `backdrop-filter`，避免「粒子动画 + 大面积模糊」掉帧。

动效全部尊重 `prefers-reduced-motion`：系统开了减少动态效果，粒子和浮动都会停。

## 注意

- `draft: true` 的文章不会进入构建产物，可以放心先提交。
- **发布前过一遍脱敏**：不要写 API Key、本地绝对路径、内网信息。
- `dist/` 与 `node_modules/` 已在 `.gitignore` 里，不需要提交。
- `pnpm-workspace.yaml` 里的 `allowBuilds` 是 pnpm 11 的新写法，别删——
  删了 `pnpm install` 会以退出码 1 结束，CI 会直接失败。
