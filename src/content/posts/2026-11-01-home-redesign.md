---
title: "给博客换了张脸：日间夜间两套图，还有一场跟「模糊」的死磕"
description: "一天之内把首页推倒重做：删掉 3.3MB 的 Live2D 看板娘、换成插画 banner + 三栏卡片、加上日间夜间切换、自己搓了一张深色版插画，最后为了「不糊」把 banner 的排法改了四遍。过程和坑都在这。"
pubDate: 2026-11-01
tags: ["博客美化", "前端", "设计", "踩坑", "图像处理"]
draft: false
---

一整天，只干了一件事：把首页拆了重装。

删掉了常驻右下角的 Live2D 看板娘，删掉了首页那条循环立绘视频，换成一整张插画 banner 加下面三栏卡片，顺手把全站的日间/夜间模式做了。

听起来是「换个皮」，实际有一半时间花在一件事上：**为什么这张图看起来这么糊。**

这篇按干的顺序记：删了什么、首页怎么搭、主题怎么切、深色版插画怎么搓出来的、banner 为什么改了四版。

---

## 一、先把不该有的删掉

旧版首页有两样东西：右下角一个 Live2D 看板娘（Cubism 4 的 DeepSeek 鲸鱼娘），和一张会动的立绘视频。

都很吃体积：

```
public/whale/        3.3 MB   （模型 2.1MB + 贴图 0.4MB + 运行时 0.8MB）
public/maid-loop.mp4 635 KB
```

删完重新构建：

```
dist 前：4.1 MB
dist 后：440 KB
```

降了 **九成**。这不是优化，是把整个功能端走了——但换来的是首屏一个字节都不用等模型加载。

> 顺手记一句：Cloudflare 边缘还缓存着已删除的 `/whale/*`，带个 `?x=1` 访问就是 404，说明源站干净了，等缓存过期自己会消失。

---

## 二、首页长什么样

结构很简单：

```
┌──────────────────────────────────────────┐
│              banner（整张插画）            │
│   DIVE DEEPER · 折腾笔记                  │
│   大肥鱼的鱼塘        ← 文案压在左边空白区   │
│   一句话介绍 / [翻翻文章] [按标签找]        │
└──────────────────────────────────────────┘
┌─────────┬────────────────────┬───────────┐
│  名片    │      最新文章        │ 站点统计   │
│ 头像/名字 │  卡片列表（带进度条箭头）│ 文章/标签/字数 │
└─────────┴────────────────────┴───────────┘
```

三栏是 `250px | 1fr | 250px`，1120px 以下名片横过来钉在顶上，820px 以下全堆一列。

文章列表从首页挪到了独立的 `/posts/`，首页只放「最新 8 篇」。这么切的好处是首页能专心当门面，不用一进来就是一大坨列表。

---

## 三、日间 / 夜间：靠一套 CSS 变量

没引任何主题库，就是 `html[data-theme]` 加一堆 CSS 变量：

```css
:root {
  --bg: #0a0d16;
  --text: #e9eefc;
  --line: rgba(140, 165, 220, 0.16);
  /* … */
}

:root[data-theme="light"] {
  --bg: #f3f6fc;
  --text: #333d52;
  --line: rgba(32, 58, 108, 0.12);
  /* … */
}
```

组件里一个颜色都不写死，全走 `var(--xxx)`。切主题就是改 `documentElement.dataset.theme`。

### 别让首屏闪一下

如果在 body 末尾才设主题，用户会先看到一帧错误的颜色。所以 `Base.astro` 的 `<head>` 里放一段同步脚本：

```html
<script is:inline>
  (() => {
    const KEY = "dafeiyu-theme";
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    const theme =
      saved === "light" || saved === "dark"
        ? saved
        : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
  })();
</script>
```

同步执行、在首屏绘制之前，所以不会闪。`is:inline` 是必须的，加了它 Astro 才不会把这段打包成异步模块。

### 代码高亮的坑

Astro 的 Shiki 支持双主题：

```js
markdown: {
  shikiConfig: {
    themes: { light: "github-light", dark: "github-dark-dimmed" },
  },
},
```

但切换的 CSS **不能这么写**：

```css
/* 错的 */
.astro-code span { color: var(--shiki-light) !important; }
```

因为 Shiki 输出的默认色是**内联**的（`style="color:#24292e;--shiki-dark:#adbac7"`），只有深色值挂成了变量。`--shiki-light` 这个变量压根不存在，`var()` 解析失败，整块代码会掉成继承色。

正确写法是只在深色下覆盖：

```css
html[data-theme="dark"] .astro-code,
html[data-theme="dark"] .astro-code span {
  color: var(--shiki-dark) !important;
}
```

### canvas 也得跟着变

文章页背景那层粒子网络是 canvas 画的，颜色写死在 JS 里就切不动。改成从 CSS 变量读：

```ts
function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  palette = [cs.getPropertyValue("--p1").trim(), /* … */];
}
window.addEventListener("themechange", readPalette);
```

切主题时 dispatch 一个自定义事件，canvas 自己重读一遍，不用刷新。

---

## 四、深色版插画是自己搓的

问题：手上只有一张浅色插画，夜间模式直接压暗会变成一块脏灰，字标也糊。

所以是重做了一张：**把背景换掉，人物一个像素不动**。

### 抠掉白底

做法是连通域：从图四边往里灌，只走「浅色」像素。

```python
light = lum >= 210
mask = border_flood(light)   # 从边框 BFS，只穿过 light
```

直接这么干会出事：女仆头饰的**蕾丝是白的**，和背景通着，一灌就把白边也抠掉了，人物脑袋上会破个洞。

解决办法是先腐蚀再膨胀：

```python
core  = erode(mask, 3)       # 掐断蕾丝与背景之间的细脖子
kept  = border_flood(core)   # 重新从边框灌
mask  = dilate(kept, 3) & mask
```

腐蚀 3px 之后那条细连接断了，蕾丝里腔就灌不进去。

### 换成深色底

按原图亮度映射成深蓝：

```python
t = clip((lum - 205) / 48, 0, 1)
bg_dark = DARK_A + (DARK_B - DARK_A) * t   # #090c16 → #1a2744
```

再往角色身后叠三层径向光晕，图就有「打光」了。

### 左边的字标要重新上色

原图左边印着 DEEPSEEK 字样和鲸鱼 logo。深底上它们是灰蓝的，几乎看不见。

做法是把左边整块当成「墨层」重画：用原图亮度反推墨的浓度，再按冷暖挑墨色。

```python
alpha = clip((250 - lum) / 118, 0, 1)
ink   = where(蓝通道更强, 浅蓝, 浅灰)
left  = bg_dark * (1 - alpha) + ink * alpha
```

用这个模型，细笔画的抗锯齿不会碎成噪点——我第一版是「按饱和度套色」，结果小字全成了白点。

### 一个 CSS 的坑，顺带

上一版我在 banner 上压了一层渐变，结果中间冒出一条**灰带**。

原因：CSS 渐变的颜色插值不是预乘的。从 `#f3f6fc` 淡到 `transparent`（= 透明黑），中点会变成灰色。

```css
/* 错的 */
background: linear-gradient(to bottom, #f3f6fc, transparent);

/* 对的：淡出用「同色的 0 透明度」 */
background: linear-gradient(to bottom, #f3f6fc, rgba(243, 246, 252, 0));
```

---

## 五、banner 改了四版

这是今天最有意思的部分，因为每一版都是被上一版的毛病逼出来的。

### 第一版：用遮罩把左边抠掉

原图左边印着 DEEPSEEK 字样，标题压上去会字叠字。

```css
.hero-img {
  mask-image: linear-gradient(to right, transparent 0%, transparent 38%, #000 66%);
}
```

效果：左边一块死黑的空白，跟图片接不上。**Pass。**

### 第二版：铺满整宽，文案压上去

图铺满了，但标题正好压在那行 DEEPSEEK 上，糊成一团。**Pass。**

### 第三版：图在上、文案在下

干净了，但图是用 `contain` 的——窗口一矮，两侧就露出空白条，而那两条空白跟背景**有色差**，一眼就看出来。**Pass。**

### 第四版：cover + 底部一小段渐变

```css
.home-hero {
  min-height: min(55.8vw, 100vh);   /* 55.8vw = 100 / 1.793，跟原图同比例 */
  overflow: hidden;
}
.hero-img {
  background: var(--hero-art) center 20% / cover no-repeat;
}
.hero-veil {
  background: linear-gradient(to top, var(--bg) 0%, var(--veil-fade) 13%);
}
```

- `cover` 保证铺满，两侧不再有空白；
- 高度按原图比例算，16:9 的窗口下刚好 1:1，不裁也不留白；
- 窗口更扁时上下合起来裁 10% 左右，先裁头顶那片留白；
- 底部 13% 的渐变只负责把裁口收进背景——**不是为了遮人，是为了别让裙摆硬断在一半**。

从 `mask` 一整套，到最后只剩一条 13% 的渐变。

---

## 六、还有一场跟「模糊」的死磕

第一版图只有 **1280×714**。

铺到 1900 多的窗口上就是 1.5 倍放大；如果屏幕还是 2 倍屏（Retina），浏览器要 3800 多像素宽的图，等于 **3 倍放大**。

放大不会凭空长出细节，所以看着就是糊的。

补救做了两层：

1. 宽屏（≥1000px）换成 2560 宽的 2 倍图，Lanczos 放大 + 轻锐化，用 `image-set` 或者媒体查询按像素密度挑；
2. 后来换成一张 1920 宽的干净原图，1917 的窗口下基本 1:1，问题才算真的解决。

最后落地的配置：

```css
.hero-img { background-image: url("/hero-dark.webp"); }

@media (min-width: 1000px) and (min-resolution: 1.5dppx) {
  .hero-img { background-image: url("/hero-dark-2x.webp"); }  /* 2880 宽 */
}
```

两张图 74KB / 91KB，2 倍图 103KB / 141KB，只在真的需要时才下。

> 结论：**清晰度是物理问题，不是 CSS 问题。** 源图不够大，写什么滤镜都救不回来。

---

## 七、留一个能回滚的存档点

改这么大，最怕的是「改坏了想回去」。

每次改完都 commit + push，Cloudflare 自动构建上线。另外打了两个 tag：

```bash
git tag -a v1.0 48c321e -m "改版前：看板娘 + 首页视频"
git tag -a v2.0 fc50ffd -m "新首页：banner + 三栏 + 日间夜间"
git push origin --tags
```

真要回滚，三条路：

1. **线上**：Cloudflare Pages → Deployments → 选旧版本 → Rollback（最快，不动代码）；
2. **看代码**：`git checkout v1.0`；
3. **真退**：`git revert <sha>`（保留历史，推荐）。

---

## 今天学到的东西

- 一张图能不能用，先看它的像素宽度够不够铺满目标宽度 × 屏幕密度；
- CSS 渐变淡出**永远**写 `rgba(同色, 0)`，别写 `transparent`；
- `contain` 省事，但两侧的空白是隐形的坑——它跟背景有色差；
- 抠图这类活，腐蚀一次再膨胀，比调一百次阈值管用；
- 排版改到第四版的时候，往往不是审美问题，是前面的技术约束没解开。

代码全在 [yexuan722/dafeiyu-blog](https://github.com/yexuan722/dafeiyu-blog)，tag `v2.0` 就是现在这版。
