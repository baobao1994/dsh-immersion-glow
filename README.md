<div align="center">

# dsh-immersion-glow · 沉浸觉察

**一个不打扰你的时间觉察助手。**
它只在右上角呼吸；到点了，才开口叫你歇一会儿。

[![npm version](https://img.shields.io/badge/npm-0.1.2-c9a24b)](https://www.npmjs.com/package/dsh-immersion-glow)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-green.svg)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-288%20passing-brightgreen)](test/)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。
**零网络**：不请求、不遥测、不上报，所有数据只在这台机器的 `localStorage` 里。

[English](README.en.md) · [设计](docs/DESIGN.md) · [已知限制](docs/known-limitations.md) · [决策记录](docs/ADR.md)

</div>

---

## 📸 效果

| 角落读数 | 到点提醒 | 这次记录 | 汇总 |
| --- | --- | --- | --- |
| ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/reading-light.png) | ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/alert-light.png) | ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/record-light.png) | ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/summary-light.png) |

| 明细面板 | 设置页 |
| --- | --- |
| ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/panel-light.png) | ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/settings-light.png) |

---

## ✨ 它做什么

### 1. 只在你要干活的时候出现

没有发起过请求之前，角落里什么都不显示。你打开会话、翻文档、想事情——它不打扰。
阈值清空，读数也整个消失：**你设的阈值，就是它的开关。**

一旦开始，右上角出现一个会呼吸的暖点（位置按宿主标题栏底部实测，不写死，永远不压住按钮）：

```
● 14 分钟 · 6 分钟后提醒你
```

一个数字——**本次会话的净活跃时间**，每秒走一次，不是模型的推理耗时；一句关于你时间的提醒。
暖点 **5 秒一次呼吸**（每分钟 12 次），越接近下一个阈值，光晕越铺开——**光晕就是唯一的进度信号，没有环形进度条**：环会读成"完成度"，而这件事是关于休息的。

### 2. 到点，它会停下来

到 20 / 40 / 60 分钟（净活跃时间），呼吸停止，暖点停在最亮，同一角落长出一张暖色卡片：

```
● 40 分钟 · 该歇了
起来走走，看看六米外的东西。
[好，歇一下]  [先记着]            42s
```

正文**按时段和次数换**：白天是「起来走走」，深夜是「该停下来了。屏幕不会跑，明天再改」；
同一时段内按提醒次数轮换，不会连着两次说同一句。卡头始终是「40 分钟 · 该歇了」——那是识别符号，不随文案变。

主按钮是**「好，歇一下」**，不是"给我看看数据"——重点不是让你继续盯着屏幕。
按下去进入 20 秒休息态（7 秒一次的长呼气）；按「先记着」则不打断你。没理它，暖点会一直亮着：
"该歇了 —— 点一下"。

### 3. 它记得这一段值不值

记录卡只问一个问题：**这次达到了吗？** —— 达到了 / 基本达到 / 没达到。
三个档，不是一个勾选框：「基本达到，但返工了不少」才是最常见的诚实答案。

每个模型还可以留一个五档评分和一行备注。**分是你打的，它不猜。**

### 4. 攒够之后，它只摆证据

汇总页三块：

- **达成率**：你评过档的记录里，达到 / 基本达到的比例；
- **休息回执**：提醒过几次、你停下来几次、最长停了多久。它数的是**连续 60 秒没有输入**，不是你点了几次按钮；
- **长跑有没有用**：按会话时长分桶（≤30 分钟 / 30–60 分钟 / >60 分钟），各自算达成率。

它不给你排名、不替你下结论，只把时间和你的评分摆在一起。

---

## 📦 安装

> [!IMPORTANT]
> 务必走官方安装器，不要手改 profile 的 `package.json` / `node_modules`。
> DSH 桌面版把这些当作一个原子事务，只改一部分会让启动时判定组合不一致。

### 桌面版

```bash
# 桌面版要用安装目录自带的 CLI，普通 dsh CLI 会被 Electron 拒绝
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add dsh-immersion-glow
```

### Web 版

```bash
dsh plugin --profile web add dsh-immersion-glow
```

### 从源码安装

```bash
git clone git@github.com:baobao1994/dsh-immersion-glow.git
cd dsh-immersion-glow
npm install && npm run build
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add "$PWD"
```

**装完必须完整退出并重开 DSH**——刷新页面不够，新 bundle 是结构变更，不是配置热更新。

卸载：

```bash
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop remove dsh-immersion-glow
```

---

## 🔒 隐私

**零网络。** 没有请求、没有遥测端点、没有账号。设置、记录、评分和汇总都写在一个 `localStorage` 键里（`immersion-glow.v1`）。

**它读什么：**

- **结构**：轮次与步骤边界、模型 / 提供商 id、token 数；
- **你第一条消息的第一句**，截断到 60 字，用作任务名，好让你事后认出这段跑的是什么。

**它不读什么**：你的后续消息、助手的输出、工具参数，一概不读。

> 早期版本承诺"绝不碰消息文本"。要让任务名有意义就必须读那一句，所以现在这个承诺变得更窄、但更诚实。

---

## ⚙️ 设置

设置里新增独立一页：**设置 → 沉浸觉察**。

| 设置项 | 默认 | 说明 |
| --- | --- | --- |
| 启用 | 开 | 总开关 |
| 阈值 | `20, 40, 60` | 逗号分隔的分钟数，1–6 个、严格递增；**留空则整个读数隐藏** |
| 空闲冻结 | 3 分钟 | 无输入时停止计入活跃时间；**模型回答期间豁免** |
| 右上角读数 | 开 | 常驻读数与明细面板 |
| — | — | 记录 / 汇总入口、提醒次数与打开次数、复制统计、清空数据 |

---

## 🧠 它不会做什么

**它不替你评判模型。**
汇总只给客观信号——耗时、首字延迟、解码速度、轮次——加上一块"长跑有没有用"的对照，以及休息回执。
宿主没有质量信号，所以任何"哪个模型更会写代码"的自动结论都是编的。面板把证据摆在你自己的评分旁边，结论留给你。

完整清单见 [已知限制](docs/known-limitations.md)。

---

## 🛠 开发

```bash
npm run build    # 把 src/client/*.js 内联成 lib/client.js
npm test         # 288 个测试：计时、指标、状态、模型归属、数据流、bundle 契约
npm run verify   # manifest、patch、locale、零网络、require 白名单
npm run check    # 以上全部
```

源码在 `src/client/*.js`，是**没有 import 的纯 JS**：所有模块共享一个闭包，由 `tools/build-client.mjs`
按固定顺序内联。这是刻意的——DSH 的浏览器插件协议只要求
`window.__ModuleLoader__.load({ id, factory })` 配一个单参 `factory(require)`，手写 bundle 在这台机器上已经过验证，
而且零依赖、测试可以直接读源码求值。

新增模块要在 `tools/build-client.mjs` 的 `MODULES` 里登记，忘了 `npm run verify` 会失败。

### 发布

```bash
npm login                 # 需要 2FA
npm run check
npm publish               # publishConfig.access = public
```

`files` 只包含 `lib`、`locale`、`cordis.patch.yml`、两个 README 和 `docs/img`——
源码、测试、设计文档留在仓库里，不随包发布。

---

## 📋 要求

| 项 | 值 |
| --- | --- |
| DeepSeek Harness | `0.2.0-rc.2`（已实测） |
| Cordis | `4.0.4` |
| Node | `>=20` |
| 平台 | 桌面版与 Web 版 profile |

`peerDependencies` 声明为 optional 并锁在上面这两个版本。早期 PRD 写的是 `0.1.0-rc.6`，
那个范围不满足已安装的 `0.1.1-rc.2` 预发布元组，装不上。见 [ADR-102](docs/ADR.md)。

---

## 📄 License

MIT
