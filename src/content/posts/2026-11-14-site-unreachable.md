---
title: "打不开自己的网站时，先证明不是站点的问题"
description: "今天博客转圈超时，第一反应是自己改坏了什么。结果一路查下来：DNS 正常、80 端口能通还能回 301、443 却连 TLS 都握不上；最后让第三方节点去取，200 OK，安全头还是我写的那几个。这篇记录排障顺序，顺带把 anycast、网段、TLS 拦截这些词讲成人话。"
pubDate: 2026-11-14
tags: ["运维", "排障", "网络", "DNS", "踩坑"]
draft: false
---

今天打开自己的博客，转圈，然后超时。

第一反应跟所有人一样：**是不是我昨天改坏了什么。**

十分钟后结论是：站点好得很，坏的是我这里到它的那条路。

这篇把过程记下来，主要是给以后的自己看——下次别一上来就慌着回滚代码。

---

## 一、先分清三件事

服务器出问题，可能是三个层面：

```
域名解析（DNS）→ 网络通路（TCP/TLS）→ 服务本身（HTTP）
```

从下往上查，一次只动一层。

### 1. DNS 通不通

```powershell
Resolve-DnsName yexuan.qzz.io
```

```
yexuan.qzz.io  A     104.21.56.174
yexuan.qzz.io  A     172.67.187.89
yexuan.qzz.io  AAAA  2606:4700:3033::ac43:bb59
```

两个 IPv4、两个 IPv6，都是 Cloudflare 的地址。**解析没问题。**

### 2. 端口通不通

这一步最关键，用 `curl` 分别戳 80 和 443：

```powershell
curl.exe -sS -o NUL -w "%{http_code}`n" --max-time 15 https://yexuan.qzz.io/
curl.exe -sS -o NUL -w "%{http_code}`n" --max-time 15 http://yexuan.qzz.io/
```

```
https → 000      （20 秒后超时，连 TCP 都没建起来）
http  → 301      （秒回，从 104.21.56.174 来的）
```

同一个域名、同一个 IP，**80 能连、443 连不上**。

这一条信息量很大：服务器是活的（否则 80 也不会回 301），问题出在“加密的那条路”上。

### 3. 服务本身返回什么

本机已经证明不了自己了，得找个**第三方视角**。用一个公开的 HTTP 探测接口：

```powershell
Invoke-WebRequest 'https://api.hackertarget.com/httpheaders/?q=https://yexuan.qzz.io'
```

```
HTTP/1.1 200 OK
Server: cloudflare
x-frame-options: DENY
permissions-policy: geolocation=(), microphone=(), camera=()
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
cf-cache-status: DYNAMIC
CF-RAY: a5a55c07cb35fa7f-IAD
```

**200 OK**，而且这几个安全头正是我在 `public/_headers` 里写的那几行——所以对面跑的就是我这个站，不是我缓存里的旧页面。

`CF-RAY` 结尾的 `IAD` 说明这次请求落在华盛顿的机房。

到这一步可以下结论：**站点没问题，是我这条网络到它的路断了。**

---

## 二、anycast 是什么，为什么要按“网段”封

排查报告里出现了几个词，这里一次讲清楚。

**IP 地址**就是门牌号，比如 `104.21.56.174`。

**anycast（任播）**是“一个门牌号挂在全世界上百个机房”：Cloudflare 在几十个城市都写着“我就是 104.21.56.174”，你从上海敲门就是上海的分点接，从纽约敲门就是纽约接。同一个号，最近的机房出来接待。

**网段**是门牌号按号段成片分的，`104.21.x.x`、`172.67.x.x` 就是两大片 Cloudflare 的号段。

**“被挡”**是中间的网络设备在这个号段上设了卡：发往这些地址的包直接被扔掉，所以是“超时”，不是“拒绝”。

打个比方：

> 这条街上几十家店共用一个取餐口编号。取餐口一贴封条，整条街的外卖都送不出来。
> 不是你的店做错了什么，是取餐口被封了。

Cloudflare 这几段上挂着几百万个网站，所以封的时候没法只封你一家，只能整段封。这也解释了为什么**昨天还好好的**——封是动态的，跟代码一个字都没关系。

---

## 三、为什么偏偏是 443

```
80  = HTTP，明文，中间设备看得懂内容
443 = HTTPS，握手就加密，看不懂里面是什么
```

看不懂，就干脆不让连。

于是就出现了那个很典型的组合：

```
:80  → 秒回 301（说明 IP 可达、服务在线）
:443 → TCP 超时（说明加密连接被掐）
```

把常见报错按层对一下，以后可以直接看症状：

| 现象 | 大概率的层 |
|---|---|
| `Connection timed out` / `ERR_CONNECTION_TIMED_OUT` | 网络层，包被丢 |
| `SSL handshake failed` / 证书报错 | TLS 层 |
| `522` / `1016` | Cloudflare 连不上你的源站 |
| 能连上但 404 / 500 | 应用层，这时候才该看代码 |

我这次是第一种，所以连“证书对不对”都还没轮到。

---

## 四、自救顺序

从最快能分清责任的一步开始：

1. **换网络**。手机流量、关 Wi-Fi，开一下。
   能开 → 你这台机器/路由器/运营商的问题；打不开 → 才轮到怀疑站点。
   *（这一步应该第一个做，成本最低。）*
2. **看代理软件**。Clash、v2ray 这类工具，规则里如果让 `cloudflare` 或 `104.21.0.0/16` 走“直连”，就会被墙。改成走代理，或者临时开全局。
   *（我顺手查了本机，当时没有任何代理进程在听端口，系统代理也是空的——所以排除这一项。）*
3. **换 DNS + 刷缓存**。

   ```powershell
   ipconfig /flushdns
   ```

   换 `223.5.5.5` 或 `119.29.29.29`。
   但这次我把 223.5.5.5、8.8.8.8、1.1.1.1 都查了一遍，**三个解析器返回的都是同样两个 IP**，所以换 DNS 救不了这种封锁——它只能排除“解析到了错的地址”这一种情况。
4. **用备用入口**。Cloudflare Pages 自带 `xxx.pages.dev` 域名，走的是另一段 IP，能直接看内容。

---

## 五、几个可以带走的东西

- **排障按层走**：DNS → TCP → TLS → HTTP → 内容。一次只验证一层，别跳。
- **本机测不出来时，找第三方视角**。我这台机器怎么戳都是超时，但换一个机房去取就是 200，一句话就把责任分清了。
- **静态站的好处**：源站不动，入口可以换。网站是文件，不是进程，只要文件还在，换个域名照样活。
- **别一上来就回滚代码**。这次如果我先慌着 `git revert`，那就是白改一通，还会以为自己修好了。

顺便留个小抄，下次直接跑：

```powershell
# 1 解析
Resolve-DnsName yexuan.qzz.io

# 2 端口（分别测 80 / 443）
curl.exe -sS -o NUL -w "https=%{http_code}`n" --max-time 12 https://yexuan.qzz.io/
curl.exe -sS -o NUL -w "http=%{http_code}`n"  --max-time 12 http://yexuan.qzz.io/

# 3 换个网络 / 换个机房看
Invoke-WebRequest 'https://api.hackertarget.com/httpheaders/?q=https://yexuan.qzz.io'
```
