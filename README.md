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
│   ├── og.jpg               # 社交卡片图 1200×630
│   ├── maid-loop.mp4        # 首页立绘循环视频（440×560 / 60fps / 635KB）
│   ├── maid-poster.jpg      # 视频封面（省流、减少动效时显示）
│   ├── maid-still.webp      # 透明底静帧，给 404 / 关于页
│   └── whale/               # 看板娘：Live2D 模型 + 运行时（约 3.3MB，懒加载）
└── src/
    ├── content.config.ts    # 文章集合 schema
    ├── content/posts/       # Markdown 文章
    ├── components/
    │   ├── WhalePet.astro   # 看板娘（Cubism 4，pixi-live2d-display）
    │   └── TechBackground.astro  # 文章页粒子网络 + 鼠标互动
    ├── lib/post.ts          # 日期 / 阅读时长 / 排序 / 标签色相
    ├── layouts/Base.astro   # 全站骨架（variant: anime | tech）
    ├── pages/
    │   ├── index.astro      # 首页：立绘视频 + 文章卡片
    │   ├── tags.astro       # 标签云 + 筛选（?tag=xxx）
    │   ├── search.astro     # 关键词搜索（?q=xxx）
    │   ├── search.json.ts   # 搜索索引，构建时生成 /search.json
    │   ├── about.astro      # 关于
    │   ├── 404.astro        # 自定义 404
    │   └── posts/[...slug].astro  # 正文 + 目录 + 阅读进度
    └── styles/global.css
```

## 栏目

| 路径 | 作用 |
|---|---|
| `/` | 文章列表 |
| `/tags/` | 标签云；点标签即时筛选，URL 同步成 `?tag=DeepSeek`，可以直接分享 |
| `/search/` | 前端搜索，索引是构建时生成的 `/search.json`；空格分隔多词＝全部命中 |
| `/about/` | 关于 |

标签的颜色由标签名 hash 出来（`tagHue()`），同一个标签永远是同一个色相，
换文章、重新构建都不会变色。字号随文章数微调。

## 首页立绘视频

`maid-loop.mp4` 不是直接丢进来的素材，是从一段 24fps 的 VP9 黑底 webm 处理出来的：

1. **扔掉坏帧**——源里有 10 帧轮廓被背景啃掉一圈（前景面积突然少 2 个百分点），
   按「面积 / 质心偏离局部中位数」检测后删掉；
2. **闭环**——结尾 8 帧和开头 8 帧交叉淡化，首尾差从 11.6 降到 4.1（比正常相邻帧还小）；
3. **补帧**——`minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`
   从 24fps 补到 60fps；
4. **轻降噪**——`hqdn3d=2:1.5:5:4`，源自带的压缩噪声很吃码率；
5. **编码**——440×560，x264 CRF 26。同一素材 H.264 比 VP9 小 30%，而且 iOS 也能放。

播放这块有三个坑：

- 视频是**黑底、没有 alpha 通道**，靠 `mix-blend-mode: screen` 把黑色吃掉，等于自带透明；
  为此 `.scene` 用 `z-index:-1`、`.wrap` 不能有 `z-index`——一旦有祖先形成 stacking context，混合立刻失效，黑方块就露出来了。
- `<video preload="none">` + JS 按需加载：`prefers-reduced-motion` 或 `saveData` / 2G 时
  **一个字节都不下载**，只显示封面图。
- 滚出视口自动暂停，切回标签页再继续。

## 看板娘（DeepSeek 鲸鱼娘）

右下角坐在桌前那个是 Live2D（Cubism 4）。

来源：[Andersen216/dsh-whale-girl-live2d](https://github.com/Andersen216/dsh-whale-girl-live2d)
（代码 MIT）。形象链：**上善无形「溟月」→ ZipZipPipe 女仆鲸鱼娘 → 氵六青 绑定 Live2D**，
素材按 **CC BY-NC-SA 4.0 非商业**使用，页脚保留署名。

```
public/whale/
├── pixi.min.js              # 460KB  PIXI v6
├── live2dcubismcore.min.js  # 207KB  Live2D 官方 Cubism Core
├── cubism4.min.js           # 120KB  pixi-live2d-display v0.4
└── model/
    ├── model3.json          # 自己写的：注册动作 + 6 个表情
    ├── c_0120.moc3          # 2.1MB  骨骼（压不动）
    ├── c_0120.physics3.json # 头发/尾巴物理
    ├── textures/*.webp      # 1.8MB PNG → 386KB WebP（2048→1024）
    ├── motions/*.motion3.json   # idle + 自拍/番茄酱/吹泡泡/喷水/开盖
    └── expressions/*.exp3.json  # 开心/生气/脸红/星星眼/爱心眼/哭
```

合计约 **3.3MB**，只在 `min-width: 900px` 且非 `prefers-reduced-motion` 时懒加载。

实现要点：

- 用 `requestIdleCallback` 之后再依次插 pixi → cubism core → cubism4，不抢首屏；
- 人物在模型坐标系里只占下面一块，所以先用洋红底截图量出真实包围盒
  （`ART = {x:567, y:369, w:3447, h:3148}`），再按这个盒子算缩放和偏移，
  留 4% 边距防止动作幅度大时被切；
- 鼠标移动时 `model.focus()` 让她看过来，离开归位；
- 点一下：随机表情 + 随机动作 + 一句台词（台词在 `WhalePet.astro` 的 `TIPS` 里）；
- 悬停才出现 ✕，关掉写 `localStorage`；切到后台 `app.ticker.stop()` 省电。

> 许可提醒：**非商业**。形象由 上善无形、ZipZipPipe、氵六青 以 CC BY-NC-SA 4.0 发布，
> 页脚已署名。真要商用得换成自己画的模型，或者另找授权。

## 视觉约定

一套配色，两种氛围，靠 `Base.astro` 的 `variant` 切换：

| variant | 用在 | 表现 |
|---|---|---|
| `anime` | 首页、标签、搜索、404 | 蓝紫光斑 + 星点，立绘、气泡、胶囊卡片 |
| `tech` | 文章、关于 | 细网格 + canvas 粒子网络，鼠标靠近连线、点击冲击波 |

- 色板：藏青底 `#0a0d16`、冰蓝 `#dcefff`、主色 `#8fc0ff`、青色 `#6fd0ff`；
  粉色只留给立绘的腮红和蝴蝶结，不参与 UI。
- 立绘动效（`global.css` 里的 `.ch-*`）：后发整体轻摆、两侧发绺各自晃、
  鲸鱼鳍耳朵偶尔抖一下、眼睛每 7.5 秒眨一次、整只人上下浮。
- 正文面板在小屏上关掉 `backdrop-filter`，避免「粒子动画 + 大面积模糊」掉帧。
- 动效全部尊重 `prefers-reduced-motion`：开了减少动态效果就全部静止。

## 注意

- `draft: true` 的文章不会进入构建产物，可以放心先提交。
- **发布前过一遍脱敏**：不要写 API Key、本地绝对路径、内网信息。
- `dist/` 与 `node_modules/` 已在 `.gitignore` 里，不需要提交。
- `pnpm-workspace.yaml` 里的 `allowBuilds` 是 pnpm 11 的新写法，别删——
  删了 `pnpm install` 会以退出码 1 结束，CI 会直接失败。
