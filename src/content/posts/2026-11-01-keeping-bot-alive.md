---
title: "让一个 bot 活着，比写它难多了"
description: "功能一周就写完了，剩下全在学怎么让它不死：开机自启要管理员、看门狗被自己杀了、面板活着但网络瞎了、搬个目录把 pnpm 依赖搬断。四条运维教训，带日志。"
pubDate: 2026-11-01
tags: ["运维", "Python", "Windows", "踩坑", "B站"]
draft: false
---

上一篇写的是[功能怎么跑通](https://yexuan.qzz.io/posts/2026-10-25-bilibili-ai-bot/)——四个接口字段把我教做人。

这一篇写后半段：**东西能用之后，怎么让它一直能用。**

结论先放这儿：**写功能是一周，让它活着是另一周。** 而且坑全在你想不到的地方——不是算法，是进程、是权限、是系统在半夜偷偷做了什么。

---

## 一、开机自启：计划任务要管理员，注册表不用

第一版用的是标准做法：

```powershell
schtasks /Create /TN FeiyuBot /TR "pythonw feiyu_bot.py up" /SC ONLOGON
```

结果：

```
ERROR: Access is denied.
```

`ONLOGON` 和 `ONSTART` 的任务写在系统级任务库，**必须提权**。普通用户直接被拒。

换成当前用户的注册表启动项，一行就够，**不需要管理员**：

```powershell
# HKCU\Software\Microsoft\Windows\CurrentVersion\Run
Set-ItemProperty -Path 'HKCU:\...\Run' -Name FeiyuBot `
  -Value '"C:\...\pythonw.exe" "C:\...\feiyu_bot.py" watchdog'
```

用 `pythonw.exe` 而不是 `python.exe`，才不会弹一个黑窗口。

顺带一个反直觉的坑：**从别的程序里 `Start-Process` 起的子进程，会随父程序一起被杀。** 我第一次是从 DSH 里启动 bot 的，DSH 一重启，bot 就没了——日志停在 20:32，DSH 重启于 20:33。

要脱离父进程树，用 WMI 创建，父进程会变成 `WmiPrvSE.exe`：

```powershell
Invoke-CimMethod -ClassName Win32_Process -MethodName Create `
  -Arguments @{ CommandLine = '"...pythonw.exe" "...feiyu_bot.py" up --no-browser' }
```

---

## 二、看门狗：`os.kill(pid, 0)` 在 Windows 上是**杀进程**

加看门狗的原因很朴素：进程崩了没人管。

设计很直白：自启指向看门狗，看门狗盯着 bot。

```python
def _pid_alive(pid):
    try:
        os.kill(pid, 0)     # ← 我以为这是「探活」
        return True
    except OSError:
        return False
```

跑 `daemon` 查状态时：

```
OSError: [WinError 87] 参数错误
```

然后发现**看门狗自己不见了**。

原因：在 Windows 上 `os.kill(pid, sig)` 不是发信号，是调 `TerminateProcess(pid, sig)`。**`os.kill(pid, 0)` 等于「以退出码 0 杀掉那个进程」**——只有 `CTRL_C_EVENT` / `CTRL_BREAK_EVENT` 是例外。

正确写法是 ctypes：

```python
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
code = wintypes.DWORD()
kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
alive = code.value == 259  # STILL_ACTIVE
```

改完之后实测：手动 `taskkill` 掉 bot，

```
[20:42:19] 看门狗上线：每 180 秒检查一次，端口 8765
[20:45:26] bot 不在了，重新拉起
[20:45:26] 已重新拉起，等 20 秒再看
[20:45:40] 复查：正常
```

**恢复时间 179 秒**——3 分钟巡检，最坏就是一整个周期。

配套加了 `pause` / `resume`：不然你想停 bot 也停不了，三分钟后它又活了。

```powershell
python feiyu_bot.py pause    # 写 data/stop.flag + 停进程
python feiyu_bot.py resume   # 清标记 + 拉起
```

---

## 三、面板正常 ≠ 活着：DNS 卡死那次

某天早上开面板，日志在刷：

```
[10:24:28]  ! 未登录：-1 网络不通：[Errno 11001] getaddrinfo failed
```

第一反应是网络断了。测了一下：

- `Resolve-DnsName api.bilibili.com` → 正常
- 新起一个 Python 进程解析 → 正常
- 只有那个 bot 进程不行

**问题在进程，不在网络。**

翻系统日志还原时间线：

```
10:11:02  系统进入睡眠
10:11:08  恢复
10:11:22  又进 Modern Standby
10:11:23  从休眠恢复
10:12:20  看门狗被登录项拉起
10:12:24  WLAN 模块才启动        ← WiFi 还在连
10:12:27  看门狗把 bot 拉起来    ← 生在了网络没就绪的窗口期
10:12:27  第一条日志就是 getaddrinfo failed
```

**这个进程从出生起就没连上过网**，而且 15 分钟都没自愈。重启一次，一秒恢复。

看门狗为什么没发现？因为它只探 `127.0.0.1:8765/api/health`——本机 HTTP 当然通。

### 修法：让「活着」有三层

| 层次 | 判断方式 | 之前 | 现在 |
|---|---|---|---|
| 进程在 | 查 PID | ✅ | ✅ |
| 服务在 | 本机 `/api/health` | ✅ | ✅ |
| **真的能干活** | 最近一次成功访问 B站的时间 | ❌ | ✅ |

具体三件事：

**1. 请求级重试**——网络抖动自己扛：

```python
for attempt in range(3):
    try:
        resp = urlopen(req, timeout=...)
        break
    except URLError as exc:
        if attempt < 2:
            time.sleep(1.0 + attempt)   # 1s, 2s
            continue
        raise
self.last_ok = time.time()          # 记下「最后一次真的连通」
```

**2. `/api/health` 带上新鲜度**：

```json
{"ok": true, "bili_age": 59}
```

`bili_age` = 距上次成功访问 B站多少秒。

**3. 看门狗先自证清白，再动手**：

```
bili_age ≥ 900 且连续两轮（约 6 分钟）
   → 看门狗自己连一次 api.bilibili.com:443
       → 自己也连不上：判定网络问题，不动手
       → 自己连得上：判定进程瞎了，重启 bot（15 分钟内只干一次）
```

关键在「先自测」这一步。不然网络真断的时候，看门狗会每 6 分钟杀一次进程，纯属添乱。

面板上也加了个灯：绿色「网络正常」，断网变红显示「连不上 B站 N 分钟」。

---

## 四、搬个目录，把依赖搬断了

工作区堆了二十来个条目，两个会话的东西混在一起。整理成：

```
workspace/
├── sessions/
│   ├── 2026-10-23-electron-reverse/
│   ├── 2026-10-24-blog-and-kanban/
│   └── 2026-10-25-bilibili-bot/
├── tools/
└── _shots/
```

顺便把规则写进了 `AGENTS.md`：**每个新会话先建自己的子目录；删本机原有文件前必须先问用户。**

搬完两个坑：

**坑一：`pnpm` 的 `node_modules` 是 junction，记的是绝对路径。**

```
node_modules\astro → D:\...\default-workspace\site\node_modules\.pnpm\...   ← 旧路径，已经不存在
```

搬完 `astro build` 直接 `Cannot find module`。在新位置重跑 `pnpm install --offline` 重建链接就好（`--offline` 走本地 store，不用联网）。

> 结论：**搬 pnpm 项目之后一定要重装依赖。** 这不是脏，是符号链接的物理限制。

**坑二：`.gitignore` 里的 `config.*.json` 把模板也吞了。**

我为了让 `config.local.json` 之类的文件不进仓库，写了：

```
config.*.json
```

结果 `config.example.json` 也被忽略——**仓库发布了六天，里面一直没有配置模板**，别人 clone 下来没东西可抄。直到某次 `git show HEAD:config.example.json` 报：

```
fatal: path 'config.example.json' exists on disk, but not in 'HEAD'
```

改成白名单：

```
config.local.json
config.test.json
!config.example.json
```

---

## 五、顺便：同类插件的「服务」和「宠物」

B站 bot 这件事，社区里已经有更完整的东西了，比如 DSH 的 [`dsh-dafeiyu-life`](https://github.com/minedalang/dsh-dafeiyu-life)。

它和我这套的底层是**同一根管子**：都是扫码/抄 Cookie 拿登录态，之后全靠 `SESSDATA` + `bili_jct` + WBI 签名打网页接口。B站 没给第三方开任何写入 API，谁都得这么干。

但上面的房子完全不同：

| | 我的 bot | 那个插件 |
|---|---|---|
| 形态 | 独立进程 + 看门狗 | DSH 插件，DSH 关了它就睡 |
| 定位 | **服务**：按配置干活 | **宠物**：有记忆、情绪、能拒绝你 |
| 决策 | 全部听配置 | 双域意愿，可以拖延、沉默 |
| 能力 | 评论、私信、每日投喂 | 还包动态、点赞、收藏、关注 |
| 记忆 | SQLite 队列 | 双层：永久档案 + 会遗忘的副本 |

一句话：**服务要常开，宠物你回家它才醒。**

两者别在同一个号上同时跑——限速、去重、私信拉取会互相打架，风控也更敏感。

---

## 收尾

这四件事有个共同点：**都不是代码写错，是我对平台的假设错了。**

- 假设「计划任务普通用户能建」→ 要提权
- 假设「`os.kill` 是探活」→ 它是杀人
- 假设「HTTP 200 就是活着」→ 那只是本机还醒着
- 假设「移动目录不影响依赖」→ junction 记的是绝对路径

上一篇的结论是「先 dump，再写代码」。这篇的版本是：

> **先看日志和进程状态，再猜原因。**

日志不会骗你。它只会告诉你「10:12:27 就是第一条错误」——而那一刻，正好是 WiFi 启动后的第三秒。

代码还是那个 [feiyu-bot](https://github.com/yexuan722/feiyu-bot)，现在多了看门狗、网络自愈和一份能抄的配置模板。
