# yexuan.qzz.io

Astro 静态博客。零后端、零数据库，构建产物直接托管在 Cloudflare Pages。

## 本地开发

```bash
cd site
pnpm install
pnpm dev          # http://localhost:4321
```

## 构建

```bash
cd site
pnpm build        # 输出到 site/dist/
pnpm preview      # 本地预览构建产物
```

## 写文章

在 `site/src/content/posts/` 下新建 `.md` 文件，文件名就是 URL 后缀。

```yaml
---
title: "文章标题"
description: "一句话摘要，会显示在列表页和 SEO 描述里"
pubDate: 2026-10-24
tags: ["标签1", "标签2"]
draft: false        # true 则不会出现在站点和构建产物里
---
```

## 部署到 Cloudflare Pages

### 方式 A：直传（最快）

```bash
pnpm dlx wrangler pages deploy dist --project-name=yexuan-blog
```

首次会打开浏览器做 OAuth 登录。之后每次改完内容，重新 `pnpm build` 再执行一次即可。

### 方式 B：连 Git 仓库（推荐，长期）

1. 把仓库推到 GitHub；
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git；
3. 构建配置：
   - Framework preset: `Astro`
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Root directory: `site`
4. 保存后每次 `git push` 自动部署。

### 方式 C：拖拽上传

`pnpm build` 之后，把 `site/dist/` 整个文件夹拖进 Cloudflare Dashboard 的
Pages「Direct Upload」区域即可。

## 绑定自定义域名

Pages 项目 → Custom domains → 添加 `yexuan.qzz.io`。

因为 `qzz.io` 这个 zone 已经托管在 Cloudflare，DNS 记录会自动创建，
不需要手动加 CNAME。HTTPS 证书也会自动签发。

如果用的是根域或需要重定向 `www`，在 Pages 的 Redirects 里另配。

## 目录结构

```
site/
├── astro.config.mjs
├── public/                  # 原样拷贝到产物根目录
│   └── favicon.svg
└── src/
    ├── content.config.ts    # 文章集合的 schema
    ├── content/posts/       # Markdown 文章
    ├── layouts/Base.astro   # 全站骨架
    ├── pages/
    │   ├── index.astro      # 首页列表
    │   ├── about.astro      # 关于
    │   └── posts/[...slug].astro
    └── styles/global.css
```

## 注意

- `draft: true` 的文章不会进入构建产物，可以放心先提交。
- 文章里不要写 API Key、本地绝对路径、内网信息 —— 发布前过一遍。
- 构建产物在 `dist/`，已加入 `.gitignore`，不需要提交。
