# 沉浸觉察（dsh-immersion-glow）

DSH 会话内静默运行的时间觉察助手。净活跃时间到阈值时，它在界面右上角放一张提醒卡，
指向本次会话的统计；你愿意停下来时，把这段时间作为一张可收藏的记录卡交还给你。

**零网络。数据不出本机。**

[English](README.md) · [已知限制](docs/known-limitations.md) · [决策记录](docs/ADR.md)

---

## 安装

```sh
D="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$D" plugin --profile desktop add /绝对/路径/dsh-immersion-glow
```

**装完必须完全退出 DSH 再重新打开。** 刷新页面无效 —— 新增 bundle 属结构性变更，
`patchReload: live` 只覆盖配置热更。

卸载：

```sh
"$D" plugin --profile desktop remove dsh-immersion-glow
```

---

## 它会做什么

**是提醒卡，不是装饰。** 净活跃到 20 / 40 / 60 分钟时，右上角弹出一张提醒卡并开始 60 秒倒计时。
不拦截输入、不夺焦点、不发声。点卡片打开记录卡，点 `×` 关闭。到末档之后按该档步长继续
（80 / 100 / …），直到这段时间结束。

**不点就会留下未读徽标。** 到点还没点的阈值提醒，会缩成一条未读徽标一直留着，直到你点开；
「已收藏 / 已复制」这类确认走同一张卡但**不带**未读，到点即消失。

**记录卡才是回馈。** 它显示这段沉浸时长、对话轮次、工具调用数，
以及时段标签（晨间 / 深夜 / 长跑 / 碎片）。可以收藏；收藏进画廊，在设置行里随时可看可删。

**全部在本地。** 设置、计数、画廊都存在一个 `localStorage` 键（`immersion-glow.v1`）。
没有请求、没有上报端点、没有账号。唯一的数据出口是你自己点「复制统计」再粘贴出去。

---

## 它不会做什么

- **不读消息正文。** 探针只统计结构性事实（轮次编号、`callId`），绝不触碰文本。
- **不锁屏、不暂停输入、不强制休息。** 你始终拥有忽略权。
- **不计空闲时间。** 30 分钟没操作不等于 30 分钟专注。

完整清单见 [已知限制](docs/known-limitations.md)。

---

## 设置

`设置 → 通用` 里占一行：

| 设置项 | 默认 | 说明 |
|---|---|---|
| 启用 | 开 | 总开关 |
| 触发阈值 | `20, 40, 60` | 逗号分隔的分钟数，严格递增，1–6 个 |
| 空闲冻结 | 3 分钟 | 超过这段时间没有操作就不再累加 |
| 在输入框显示当前时长 | 关 | 极小的常驻计时，默认关闭以保持安静 |
| — | — | 「已提醒 N 次 · 你打开了 M 次」+ **复制统计** + **清除数据** |

---

## 环境要求

| 项 | 值 |
|---|---|
| DeepSeek Harness | `0.2.0-rc.2`（本次实测版本） |
| Cordis | `4.0.4` |
| 平台 | Desktop / Web profile 均可 |

`peerDependencies` 按上述实际版本声明，且都设为 `optional`。PRD 原文写的是 `0.1.0-rc.6`，
但该范围不匹配实际安装的 `0.1.1-rc.2` 预发布元组，会直接装不上。见 [ADR-102](docs/ADR.md)。

---

## 开发

```sh
npm run build    # 把 src/client/*.js 内联进 lib/client.js
npm test         # 69 项：计时、指标、状态、产物加载契约
npm run verify   # 清单 / patch / locale / 零网络 / require 白名单 / 沙箱
npm run check    # 以上全部
```

源码在 `src/client/*.js`，是**没有 import 的普通 JS**：模块共享同一个闭包，
由 `tools/build-client.mjs` 按固定顺序内联。这是刻意的 —— DSH 的浏览器插件协议只要求
`window.__ModuleLoader__.load({ id, factory })`，且 `factory(require)` 是单参数；
手写产物在本机已有生产先例（`dsh-trae-checkin`）。这么做的收益是构建零依赖，
且测试可以直接 vm 求值源文件，不必为可测性改写。

新增模块要在 `tools/build-client.mjs` 的 `MODULES` 里登记，忘了 `npm run verify` 会报错。

架构说明（含三处「不改就装不上」的 PRD 实现级修正）见 [docs/ADR.md](docs/ADR.md)。

---

## 许可

MIT
