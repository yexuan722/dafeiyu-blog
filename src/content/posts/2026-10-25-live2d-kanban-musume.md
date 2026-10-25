---
title: "三个看板娘：从 2018 年的方案，到一只 DeepSeek 鲸鱼娘"
description: "想在博客右下角放个会呼吸的小人，前后换过三套方案：2018 年的 waifu.js、Cubism 2 的 Rem、最后是 Cubism 4 的深寻鲸鱼娘。换渲染器、砍体积、量取景，踩过的坑都记在这。"
pubDate: 2026-10-25
tags: ["博客美化", "Live2D", "前端", "踩坑"]
draft: false
---

目标很简单：右下角放一个会呼吸、会看你鼠标的小人。

前后换了三套方案才定下来。这篇记的是每次为什么换、换的时候卡在哪，以及一串可以直接抄的参数。

先说结论：最后用的是开源项目 [dsh-whale-girl-live2d](https://github.com/Andersen216/dsh-whale-girl-live2d) 里的 **DeepSeek 鲸鱼娘**（Cubism 4），代码 MIT、素材 CC BY-NC-SA 非商业，自托管约 3.3MB，只在宽屏、非省流、允许动效时才懒加载。

---

## 零、为啥不用 B站 2233

本来想找 22 娘 / 33 娘的模型，毕竟"同款桌宠"最直观。

查下来放弃了：**这两个是 bilibili 的官方角色形象**，网上能下到的 Live2D 模型基本是同人拆包和改模，没有一份带明确授权。挂在公开站点上属于典型的来源不明 IP，随时可能被要求下架。

换成鲸鱼娘之后，除了许可干净，还有个额外好处：她是 DeepSeek 的二次创作形象，跟这个站的主题本来就是一家人。

---

## 一、第一版：照抄 2018 年的方案

起点是博客园那篇很有名的《[给你博客添加一个萌萌的看板娘吧](https://www.cnblogs.com/yjlaugus/p/8724881.html)》（2018 年，十万多阅读）。

它给的清单是：

```
waifu.css          # 定位和外观
waifu-tips.js      # 对话气泡
live2d.js          # 渲染
jquery 3.2.1       # 依赖
flat-ui.min.css    # 菜单图标字体
```

模型和对话都走作者的 API。

**这里我要先纠正自己一个误判。** 我一开始以为这套东西已经全挂了，实际测了一遍：

```text
cdn.bootcss.com/jquery/3.2.1/jquery.min.js   → 200
api.fghrsh.net/live2d/switch/                → 200（返回 "error"）
www.fghrsh.net/                              → 200
```

都没死。所以真正的问题不是"挂了"，是**过时**：

1. **只支持 Cubism 2**（`.moc` / `.model.json`）。现在的新模型是 Cubism 3/4（`.moc3` / `.model3.json`），这个运行时**根本不认**。
2. 绑死 jQuery，还要额外引一个图标字体。
3. 模型和对话靠第三方 API，等于把自己的页面挂到别人的服务上。
4. 那篇文章里的跨域坑，根源是博客园不让传 `.json` 文件。静态站自己托管就没这问题。

**能抄的是思路**：往页面塞一个 canvas，拉一份模型描述 json，交给运行时去画。这一层现在没变，变的是运行时。

---

## 二、第二版：Rem（Cubism 2）

按这个思路，第一版用的是 `live2d-widget@3.1.4`（GPL-2.0）+ npm 上的 `live2d-widget-model-rem`，全部自托管，零外部请求。

那一版已经把体积压过一轮：

| 处理 | 效果 |
|---|---|
| 纹理 2048 PNG → 1024 WebP | 604KB → 289KB |
| 动作 34 个 → 9 个 | 500KB → 130KB |
| 删掉 `snd/` 音效 | −1MB |
| **合计** | **1.45MB → 900KB** |

跑是能跑，但两个问题：

- Rem 同样是别人的 IP，跟"DeepSeek 站"不对味；
- Cubism 2 的模型本身表现力有限，表情少、贴图糊，放大到 200px 就露怯。

---

## 三、第三版：DeepSeek 鲸鱼娘（Cubism 4）

找到的仓库许可写得很干净，值得原文列一下：

| 范围 | 许可 |
|---|---|
| 代码（`lib/`、`tools/`） | MIT |
| 模型素材（moc3 / 贴图 / 表情 / 动作） | CC BY-NC-SA 4.0，**非商业** |
| 播放器运行时 | Live2D 官方 Cubism Core 的可分发条款 |

形象版权链是三段接力：

```text
上善无形「溟月」→ ZipZipPipe 女仆鲸鱼娘 → 氵六青 绑定成 Live2D
```

作者还照录了模型作者的使用须知：「商用直播 √ / 自印物料 √ / 禁止任何形式的盗用以及出售」。

### 坑一：Cubism 2 的运行时读不了 Cubism 4 的模型

打开模型包一看，全是新格式：

```
c_0120.model3.json      # 不是 .model.json
c_0120.moc3             # 不是 .moc
c_0120.physics3.json
expressions/*.exp3.json
motions/*.motion3.json
```

旧的 `live2d-widget` 直接报错。整条渲染链得换：

```text
pixi.min.js              460KB   PIXI v6
live2dcubismcore.min.js  207KB   Live2D 官方核心
cubism4.min.js           120KB   pixi-live2d-display 0.4
```

顺序不能乱：PIXI → CubismCore → cubism4，逐个 `load` 完再初始化。

### 坑二：原包没有 model3.json

这个模型原本是给 VTube Studio 用的，那个软件直接按文件名加载动作，**不需要 model3.json**。所以渲染器根本不知道有哪些动作和表情。

自己写一份：注册 idle 组，挑 5 个动作、6 个表情。

```json
"Expressions": [
  { "Name": "happy", "File": "expressions/happy.exp3.json" },
  { "Name": "blush", "File": "expressions/blush.exp3.json" }
]
```

表情文件本身是标准的 `.exp3.json`（一串参数 + 混合方式），原包里躺着 40 多个（腮红、星星眼、爱心眼、哭、猫猫贴纸……），挑几个够用的就行。

---

## 四、坑三：5.3MB 太重，砍到 3.3MB

原始素材加起来 5.3MB。对一个装饰件来说不能接受，能砍的都砍了：

| 文件 | 原始 | 处理后 | 手段 |
|---|---|---|---|
| `texture_00` | 1727KB | **367KB** | 2048 PNG → 1024 WebP q92 |
| `texture_01` | 88KB | **19KB** | 512 WebP |
| `moc3` | 2119KB | 2119KB | 压缩不了，只能认 |
| 动作 | 8 个 | 5 个 | 丢掉没意思的 |
| 表情 | 40+ | 6 | 只留能看出区别的 |
| **合计** | **5.3MB** | **3.3MB** | |

两个说明：

- **纹理降分辨率是安全的**。Live2D 的 UV 是归一化的 0~1，贴图尺寸不影响绑定，只影响清晰度。显示区只有 220px，1024 已经 4 倍有余。
- **moc3 压不动**。它是二进制网格数据，gzip 也就再省 10% 左右。这 2.1MB 是最硬的一块。

---

## 五、坑四：取景 —— 用洋红底量包围盒

这个最容易被忽略：模型画布是 **4068×4068 的正方形**，但人物只占下面一小块。你要是直接"缩放到画布宽度"，结果是又小又偏。

不想靠肉眼试，就量：

1. 把页面背景铺成洋红 `#ff00ff`，模型整体按画布铺满渲染一次；
2. 截图，用 Python 找非洋红的像素范围；
3. 换算回模型坐标系。

```python
from PIL import Image
import numpy as np

a = np.asarray(Image.open("shot.png").convert("RGB")).astype(np.int16)
not_bg = ~((abs(a[:, :, 0] - 255) < 14) & (a[:, :, 1] < 14) & (abs(a[:, :, 2] - 255) < 14))
ys, xs = np.nonzero(not_bg)
```

量出来是这个：

```js
// 模型坐标系里人物的实际包围盒
const ART = { x: 567, y: 369, w: 3447, h: 3148 };
```

有了它，缩放和偏移就是纯算术，不用试：

```js
const s = Math.min((W * 0.96) / ART.w, (H * 0.96) / ART.h);
model.scale.set(s);
model.x = (W - ART.w * s) / 2 - ART.x * s;
model.y = (H - ART.h * s) / 2 - ART.y * s;
```

那个 `0.96` 是留的边距：idle 动作会让头和尾巴晃，卡得太满会被画布切掉。

---

## 六、什么时候该加载

3.3MB 摆在首页，不能无脑加载。现在的条件清单：

```js
if (off) return;                              // 关过就不再烦你
if (window.innerWidth < 900) return;          // 手机上不加载
if (prefersReducedMotion) return;             // 系统要求减少动效
if (conn?.saveData || /2g$/.test(conn?.effectiveType)) return;  // 省流 / 2G
```

再加一层时机：`requestIdleCallback` 之后才插 script，不跟首屏抢带宽。

```js
requestIdleCallback(boot, { timeout: 3000 });
```

跑起来之后还有两个省电动作：

- 切到别的标签页：`app.ticker.stop()`，回来再 `start()`；
- 关掉按钮写进 `localStorage`，下次直接不出现。

---

## 七、交互其实很少几行

**眼睛跟着鼠标**：把鼠标位置换算成方向，喂给 `focus()`，离开归零。

```js
model.focus(
  r.left + r.width / 2 - e.clientX > 0 ? -1 : 1,
  e.clientY < r.top + r.height * 0.45 ? 1 : -1,
);
```

**点一下**：随机表情 + 随机动作 + 一句台词，2.6 秒后表情复位。

```js
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

model.expression(pick(EXPRESSIONS));
model.motion(pick(MOTIONS));
setTimeout(() => model.expression(), 2600);
```

**关闭按钮**平时是隐藏的，鼠标移上去才淡入 —— 平时不挡视线，想关也能关。

---

## 八、许可与署名（这个别省）

CC BY-NC-SA 是**必须署名**的，而且要求三个作者都写全。所以：

- 页脚加了一行常驻署名；
- 关于页写了完整形象链；
- 仓库 README 记了来源、许可、以及"非商业"这条红线。

顺带说一句：**"非商业"是硬条件**。这个站没有广告、没有付费内容，属于合规；哪天要接广告或者卖东西，这个模型就得换掉。

---

## 九、结论

如果只留五条：

1. **2018 年那套方案没死，但只认 Cubism 2**。要跑新模型必须换 `pixi-live2d-display`。
2. **模型包里没有 `model3.json` 是常态**（VTube Studio 用不上），得自己写，动作和表情要手动注册。
3. **体积先砍纹理**：降分辨率 + WebP，通常能省 70~80%；`moc3` 那块认命。
4. **取景别靠眼睛**。铺个纯色底截图，用脚本量包围盒，一次量完永久可用。
5. **给装饰件设加载门槛**。宽屏、非省流、允许动效，三条都满足才下载 —— 这不是洁癖，是手机流量。

最后一句：**能显示许可证的素材，比"看着最像"的素材重要**。2233 是好看，但归属不是我的。
