# 沉浸觉察 · 决策记录（ADR）

本文件记录**实现阶段**的决策，尤其是与
[沉浸觉察-PRD-v0.2.md](/Users/gww/WorkBuddy/2026-10-17-11-53-59/沉浸觉察-PRD-v0.2.md)
（下称「v0.2」）的偏离及原因。设计意图与产品推理见原件，这里只记「为什么代码长这样」。

---

## ADR-101 不用 slot 的 `store:` 座，改走 `provideRoot`

**状态**：接受（**修正 v0.2 §4.7 的实现级错误**）

v0.2 §4.7 的骨架让光带（root scope）与探针（session scope）共用同一个 store handle：

```tsx
const store = defineStore(wardenSpec)
ctx.slots.register({ name: 'shell.overlay', state: store }, Glow)            // root
ctx.slots.register({ name: 'conversation.input.left', store }, SessionProbe) // session
```

这会撞上 `SlotCore.register` 的硬校验：

> `store handle mounted under "<插槽>" (scope "session") is already mounted under scope "root" — one handle, one scope`

**注册直接抛错 → 三处插槽全部挂不上。** 这是必然失败，不是「待验证」。

**改为**：`apply()` 内 `handle.create()` 出唯一 root 实例，用
`ctx.slots.provideRoot({ hooks: { immersionGlow }, props: { immersionGlowActions } })` 暴露。

**依据**：renderer 的 `standardProps()` 实现是

```js
standard = { ...materializeStandardBinding(rootBinding), ...materializeStandardBinding(scopeBinding) }
```

root 贡献会被合并进**所有 scope** 的 standard props。所以光带、设置行、探针三处都能同时
拿到 `useImmersionGlow`。hook 源名 `immersionGlow` 在宿主全库 grep 无冲突。

**额外好处**：不依赖 `resolveStore` 的实例缓存细节，也就没有「多 register 是否共享实例」这个
待验证项。

**复审触发**：若将来确实需要 session 级独立状态（如 F9 静默补记），那时**应当**新建一个
session-scope handle，而不是复用 root 的。

---

## ADR-102 `cordis inject` 只留 `slots`，可选服务一律惰性取用

**状态**：接受（**修正报告与 v0.2 的双重误解**）

v0.2 §4.5 把 6 个包写进 `dsh.client.inject`，报告进一步说「不 inject 则拿不到 ctx.slots」。
两处都不准：

1. **`dsh.client.inject` 不提供任何服务。** 源码注释原文：
   > `dsh.client.inject` edges are informational (loading/prefetch metadata, **never apply sequencing**)
   它只影响加载/预取顺序，与 cordis 服务注入无关。
2. **cordis 的 `export const inject` 才是真依赖。** 而一旦写进 inject 却拿不到服务，fiber 会
   卡在 pending，web boot 收尾时抛
   > `web boot: N entries did not activate`

   —— **整个 DSH 前端进不去**，不是「我这个插件不加载」。

**决定**：
- `exports.inject = ['slots']`，只声明必然存在的服务；
- `locale` 用 `ctx.get('locale')` + 守卫：缺失时退回内置字典，无翻译服务也能用；
- `package.json` 的 `dsh.client.inject` **留空**；
- `verify-bundle.mjs` 断言 `inject.length === 1`，防止后人往里堆包名。

**风险与对策**：M0 分两步安装（先空壳、再注册骨架），每步都重启验证，任何 pending 立刻回滚。

---

## ADR-103 纯 JS + 80 行构建脚本，不引 tsdown

**状态**：接受（**偏离 v0.2 §4.4**）

v0.2 的目录骨架要求 `tsdown.config.ts` + `.tsx`。但：

- 本机未安装 tsdown / typescript，安装需联网；
- DSH 的浏览器插件协议只有一条硬要求 —— 产物调用
  `window.__ModuleLoader__.load({ id, factory })`，且 `factory(require)` **单参数**；
- 本机 [dsh-trae-checkin/lib/client.js](/Users/gww/Desktop/开发项目/共创项目/dsh-trae-checkin/lib/client.js)
  已证明这种手写产物在生产可用。

**做法**：`src/client/*.js` 写成普通 JS（无 import/export，靠闭包共享），
`tools/build-client.mjs` 按 `MODULES` 顺序内联进工厂函数。

**收益**：零依赖、产物可读可 diff、源码可被 `node --test` 直接 vm 求值（不必为可测性改写）。
`verify-bundle.mjs` 断言目录里每个 `.js` 都被内联，防止新增模块忘了登记。

**代价**：没有类型检查。用 JSDoc + 测试兜底。

**复审触发**：模块数超 ~20 个或需要 npm 依赖时，改引 tsdown，源码结构不变。

---

## ADR-104 persist 落地 localStorage，且自带损坏兜底

**状态**：接受（**关闭 v0.2 ADR §4 的待验证项 #4**）

`@deepseek-ai/dsh-client-store` 的 `attachPersistence` 实现：

```js
try { const raw = localStorage.getItem(name); if (raw !== null) api.setState(JSON.parse(raw)) }
catch (error) { console.error(`snapshot store '${name}' rehydration failed:`, error) }
```

解析失败回退初始 state、只打日志、不抛错；storage 不可用（隐私模式、配额）只禁用持久化。

**结论**：报告 §3.3 要求的「自研 store 损坏兜底」**不需要写**。我们只加了一层 UI 的
「清除本插件数据」。

**但有一条 persist 不覆盖**：它只在实例创建时读一次、之后单向写入，**不监听 `storage` 事件**。
v0.2 §2.4 的多标签要求必须自己实现 —— 见 ADR-105。

---

## ADR-105 多标签同步必须手写 `storage` 监听

**状态**：接受（补 v0.2 §2.4 的实现空白）

因为 ADR-104 记录的 persist 行为，两个标签会各自计时、各自写键，后写的覆盖先写的，
`activeMs` 会来回跳。

**做法**：`window.addEventListener('storage')`，对比 `event.key === 'immersion-glow.v1'`，
解析 `newValue` 后**取两者中更大的 `activeMs`**，`lastActiveAt` 取较大值。

**只在对方更大时写**，避免两个标签互相推送形成回声。

---

## ADR-106 `settings.general.item` 不传 `label`，标题自己画

**状态**：接受（**关闭待验证项 #5/#6，并删掉 v0.2 的死代码**）

官方插槽文档原文：

> The section column only stacks rows, so a row draws its own internals, including its label:
> **nothing projects a `label` here**

且该插槽 `ownerProps` 为空。所以 v0.2 §4.7 的 `label: () => t('settings.row.label')` **是死代码**。

**决定**：三处注册一律不传 `label`；`shell.overlay` 同理（owner 不投影 label）。
`verify-bundle` 不强制这一条，但 review 时应人工确认。

---

## ADR-107 页面隐藏冻结计时（不做反向补算）

**状态**：接受（**MVP 内新增，v0.2 把它整个推到 V1.1**）

v0.2 §3.3 承认浏览器会节流定时器，把「tab 休眠校正」列为 V1.1。但**明知失真还照旧累计**
不合理：隐藏 2 小时回来，`activeMs` 若按 `now - lastTick` 累加会直接跳 2 小时。

**做法**：
- `visibilitychange === 'hidden'` 时 `tick` 直接返回，不累加；
- 切回 `visible` 时立即跑一次 `tick`，按 `gap` 判定续算（≤10 分钟）还是重置（>10 分钟）；
- **不做反向补算**（不去猜隐藏期间用户是否在别处活跃）。

这是保守方向：可能少算，绝不会多算。V1.1 要做的是更精细的校正，不是纠正这个方向。

---

## ADR-108 指标推导带「窗口」口径与递归去重

**状态**：接受（**关闭待验证项 #1**）

`ConversationSnapshot` 的字段已静态核实（本机 client 包 `0.1.1-rc.2` 类型声明）：

| 来源 | 用途 |
|---|---|
| `turnEnds: Map<turn, seq>` | 已完成轮次 = 最大键 |
| `nodes[]` 里 `kind:'assistant'` 的 `blocks(kind:'tool-call').callId` | 工具调用 |
| `nodes[]` 里 `kind:'tool-result'.callId` | 工具调用（窗口内 call 头可能被裁掉） |
| `runningCalls[].callId` 及其**递归** `subCalls` | 工具调用（进行中/子代理） |
| `hasMore` | **窗口口径标记** |

**三条实现纪律**：
1. 三来源合并后按 `callId` **Set 去重**，否则 assistant blocks 与 tool-result 会翻倍；
2. `subCalls` 递归带深度上限 12，防异常数据爆栈；
3. `hasMore === true` 时必须把 `truncated` 透出到 UI —— 否则用户会以为看到的是全会话总量。

**降级**：任何字段缺失/类型错误都返回 `{ turns:0, toolCalls:0, degraded:true }` 而**不抛错**，
UI 显示「数据暂不可用」。`deriveMetrics(undefined)` 也有测试覆盖。

---

## ADR-109 stale 状态用 root 侧派生，不存额外状态

**状态**：接受（补 v0.2 §6 与 §4.8 的矛盾）

v0.2 §6 要求「无会话时 `sessionMetrics` 标记 stale」，但 §4.8 的 `WardenState` 没有该字段。

**做法**：不新增字段。root 层拿得到 `useSessions`（虽然拿不到 `useSession`），
用「列表里的当前会话 id」与「探针最后写入的 `sessionId`」比对即可派生：

```
stale = metrics !== null && (metrics.sessionId === null || current == null || metrics.sessionId !== current)
```

零额外状态、零同步问题。

---

## ADR-110 自己写剪贴板，不 require ui-primitives

**状态**：接受（**偏离 v0.2 §4.9**）

ADR-009 说「走官方 `writeClipboard` primitive」。`writeClipboard` 确实在
`PLATFORM_MODULES` 静态表里、今天可用，但官方插件守则明确禁止：

> **Do not `require('@deepseek-ai/dsh-client-ui-primitives')`** or load any other Harness Client
> package as a module ... They change without notice, a plain-JS plugin has no type check.

为一个复制功能引入这份风险不划算。`clipboard.js` 20 行，三级降级：
`navigator.clipboard` → `execCommand('copy')` → 返回 false 让 UI 提示手动选择。

**连带影响**：v0.2 §3.2 说「徽标/标签优先复用官方 `Pill` / `StateDot`」同样不能做，
改为自绘 `.ig-tag`，只用 `--dsw-alias-*` token 保证主题跟随。

---

## ADR-111 两套 locale 机制都实现了

**状态**：接受（补 v0.2 §4.10 的遗漏）

v0.2 只写了 `ctx.locale.register(ns, { zh, en })`（运行时字典）。还缺一套：

| 机制 | 位置 | 用途 |
|---|---|---|
| 包根 `locale/{en,zh}.json` | `{"meta":{"title","description"}}` | **插件管理卡**的标题/描述，宿主直接读文件 |
| `ctx.locale.register` | `src/client/dict.js` | 运行时 `t()` |

少了前者，插件在「设置 → 插件」里会显示包名 `dsh-immersion-glow` 而不是「沉浸觉察」。
`exports` 必须带 `"./locale/*.json"`，`files` 必须含 `locale`。

**翻译缺失兜底**：locale 服务缺词时把 key 原样返回。`createTranslator()` 检测到
`t(key) === key` 就回退到内置字典（同语言 → zh → key），避免用户看到 `settings.row.label`。

---

## ADR-112 阈值默认 [20,40,60]、空闲 3 分钟、重置 10 分钟

**状态**：接受（按 v0.2 §2.1/§4.8 原文）

| 参数 | 值 | 来源 |
|---|---|---|
| `thresholdsMin` | `[20, 40, 60]` | v0.2 §2.1 F2 |
| `idleTimeoutMs` | `180_000`（3 分钟） | v0.2 §2.1 F1 |
| `resetGapMs` | `600_000`（10 分钟） | v0.2 §2.4 |
| 末档之后 | 按末档步长继续（80/100/…） | v0.2 §2.4 |
| 入库门槛 | 5 分钟 | 实现选择，避免碎片记录堆垃圾 |

**注意**：空闲 3 分钟冻结意味着**没有活动信号时计时停住**，20 分钟档需要持续操作才能达到。
这是 v0.2 的语义（沉浸 = 活跃时长），不是 bug。测试里用 `advanceActive()` 模拟持续操作。

---

## ADR-113 首次提示 2.5s 后收起，由 store 计时

**状态**：接受（v0.2 §2.5 只说了 2.5s，没说谁来计时）

放在 `index.js` 的 `ctx.effect` 里用 `setTimeout`，而不是 CSS 动画延迟 —— 因为提示要能
被「用户点开卡片」提前收掉，纯 CSS 做不到条件撤销。

---

## 待 M1.5 真机确认的项

以下只能肉眼调，代码里给的是初值：

| 项 | 初值 | 调整位置 |
|---|---|---|
| 光带宽度 | `62%` / `max 720px` | `styles.js` `.ig-band` |
| A 段 | 4px / opacity .95 | `glow.js` + `styles.js` |
| B 段 | 2.5px / opacity .55 | 同上 |
| 呼吸周期 | 6.5s | `styles.js` `@keyframes` |
| 与 `dsh-pet` 浮球是否打架 | — | 必要时调 `order` |

---

## ADR-114 保留一处 `console.warn`，其余不写日志

**状态**：接受（回应 review 的「调试残留」提示）

`lib/client.js` 里唯一一处 `console.warn` 在 `metrics.js` 的 `catch` 分支：

```js
console.warn('[immersion-glow] 指标推导失败，已降级：', error);
```

保留理由：
1. 它是**降级信号**，不是调试输出 —— 触发说明 `ConversationSnapshot` 的结构与预期不符，
   属于「需要被人看见一次」的异常，而不是正常路径；
2. 带 `[immersion-glow]` 前缀，便于在宿主控制台里过滤；
3. 有 `typeof console !== 'undefined'` 守卫，无 console 的环境不会因此抛错；
4. 该分支被测试覆盖（`deriveMetrics` 的畸形输入用例），不是死代码。

**不写的部分**：计时、阈值、光带播放、store 写入都不打日志。它们每秒发生，
打日志会污染宿主控制台并拖慢渲染。需要排查时用 DevTools 断点，而不是日志开关。

工具脚本（`tools/*.mjs`）里的 `console.log` 是 CLI 输出，不在产物中。

---

## ADR-115 页面级 UI 态必须每次启动复位（实测发现的 bug）

**状态**：接受（**上线后从 localStorage 实测数据反推出来的缺陷**）

### 现象

真实运行一段时间后，从 Electron 的 localStorage 里读到的状态是：

```json
"telemetry": { "impressions": 1, "opens": 0, "dismisses": 3 }
```

**3 次 dismiss 但只有 1 次 impression** —— 逻辑上不可能：dismiss 只在光带播完时才记，
而光带只在 impression 时才出现。

### 根因

`persist` 把**整个 state** 写进 localStorage，刷新后原样读回。`ui.playSeq` 也在其中。

于是每次刷新页面：
1. `playSeq` 仍是上一轮的 `1`；
2. `Glow` 用 `playKey > 0` 判断「刚触发过」→ **重播一次从未真正触发的光带**；
3. 播完走 `onAnimationEnd` → `countDismiss()` → 又记一笔假 dismiss。

顺带还有两个同类问题：`cardOpen: true` 会让刷新后凭空弹出记录卡；
`toast` 会复活一条早已过期的提示。

### 修法

新增 `resetTransient` action，在 `apply()` 里 `handle.create()` 之后**立刻**调用，
只复位 `ui` 整块，不动设置、时段、埋点与画廊。

### 教训

**凡是「只对当前页面生命周期有意义」的字段，都不能和持久化状态混在同一个 store 里。**
当时把它们放在一起是为了省一个 store，代价是必须在启动时补一次手工复位 —— 而且
这个复位一旦漏写，症状是「看起来正常，但计数器在慢慢说谎」，比崩溃更难发现。

复审触发：若要再加页面级状态，优先考虑放进组件 `useState`，而不是塞进 store 的 `ui`。

---

## ADR-116 光带是「一轮事件」，播完必须真正卸载

**状态**：接受（同上，实测期间发现）

原本的写法只靠 CSS 动画把 `opacity` 收到 0，元素一直留在树上。两个后果：

1. **无障碍缺陷**：元素不可见但仍可点击、仍能被 Tab 聚焦 —— 键盘用户会停在一个
   看不见的按钮上；
2. 它继续压在底边，占着 `pointer-events: auto` 的区域。

**改法**：`Glow` 用本地 `dismissedSeq` 记住「哪一轮已经放完」，`playKey > dismissedSeq`
才渲染。用序号而不是动画事件判定，是因为在 `prefers-reduced-motion` 或系统禁用动画时
`animationend` 可能根本不触发，而序号一定准。

动画事件仍然保留，只用来做两件事：收提示、记 dismiss。

---

## ADR-117 计时按会话分区，不按窗口（用户反馈的 bug #1）

**状态**：接受（**用户实测发现**）

### 现象

> 开新窗口时间还是上一轮的时间

### 根因

原来只有一份全局 `segment`。它被 persist 写进 localStorage，于是：

- 新窗口读回同一份 → 继承上一轮时长；
- 切换会话也不重置 → 把 A 会话的沉浸时长算到 B 会话头上。

**一段沉浸时长属于会话，不属于窗口** —— 这个建模一开始就错了。

### 修法

`state.sessions` 变成 `{ [sessionId]: { segment, metrics, updatedAt } }` 的分区表，
由 `activeSessionId` 指出当前视角：

- 切到没有分区的会话 → **建空分区**，绝不继承；
- 切回有分区的会话 → 恢复原时长；
- 分区上限 20 个，超出淘汰最久未更新的；当前会话永不淘汰；
- `writeSession` 允许自建分区（探针可能先于 `sessions.list` 的 sync 到达）。

组件拿不到当前分区时回退到**零值分区**，而不是别人的数据 —— 宁可显示 0，
也不显示不属于你的时间。

---

## ADR-118 指标必须读 `chat.legacy.*`（用户反馈的 bug #2）

**状态**：接受（**用户实测发现，且我的静态核验当时读错了层**）

### 现象

> 对话轮次和工具调用都是 0

### 根因

`ConversationSnapshot` 顶层确实有 `nodes` / `turnEnds`，类型注释也写了它们存在。
但那行注释的完整内容是：

> **Legacy** top-level compatibility field **mirrored from** the registered Chat Definitions

在 0.2.0-rc.2 里这套镜像**并不会被填上**，真数据在 `snapshot.chat.legacy`。
官方组件自己就是这么读的：

```js
const settledNodes = useChat((s) => s.legacy.nodes);   // ui-chat/StatsPills
```

我按类型声明读顶层字段，于是恒为 0。

### 修法

`resolveNodes` / `resolveTurnEnds` 采用「优先 `chat.legacy` → 顶层兜底」；
`runningCalls` 两处都试；`turnEnds` 为空时用 assistant 节点上的 `turn` 号兜底。
两边都空才敢报 0，且已补 5 条回归测试锁定这个结构。

### 教训

**类型上说「有这个字段」，不等于运行时「这个字段有值」。** 我此前把
「字段在类型声明里」当成了「字段可用」，这是把静态核验当成真机验证的典型失误。
判断某个字段是否真的被填，要看**官方自己的代码怎么读它**。

---

## ADR-119 收藏入口必须常驻（用户反馈的 bug #3）

**状态**：接受（**用户实测发现**）

### 现象

> 收藏完后，并关闭窗口后，不知道在哪里查看

### 根因

画廊唯一的入口是记录卡里的「查看收藏」按钮。记录卡一关，就再也没有任何地方
能打开画廊 —— 数据其实还在 `collections` 里，但用户够不着。

### 修法

`settings.general.item` 那行常驻的设置里增加一个按钮：
`查看收藏（N）`，无收藏时禁用并显示 `收藏`。这是关闭卡片后唯一稳定的入口。

---

## ADR-120 光带改为「居中飞入的卡片」（用户反馈的 bug #4）

**状态**：接受（**偏离 v0.2 §3.1，因为原方案实测察觉不到**）

### 现象

> 这个呼吸的效果有点弱化，根本就察觉不到，可以做成居中的飞入动效，比较大的感观

### 判断

v0.2 §3.1 的规格是「底边 2.5px 细线，6.5s 呼吸一轮」。ADR-010 与 P2-15
当时就担心过「2–3px 在暗色信息密集界面里余光可察觉性存疑」，并把它列为
「最大调参变量」。**实测结论是：确实察觉不到。** 这不是调参不够，是形态选错了。

一条 2.5px 的线在 1200px 宽的界面里只占 0.2% 的视觉面积，而且贴死在窗口边缘
——人眼会自动把它归为「边框」而不是「事件」。

### 修法

改为**居中浮起的胶囊卡片**（`bottom: 28px`，不再是 `bottom: 0`）：

| 维度 | 原来 | 现在 |
|---|---|---|
| 形态 | 2.5–4px 贴底细线 | 带光晕的胶囊，内含时长文字 |
| 位置 | 窗口最底边 | 底边上方 28px 居中 |
| 入场 | 原地 `scaleY` | 从下方 18px **飞入 + 回弹**（`cubic-bezier(.16,.84,.3,1)`） |
| 驻留 | 单次呼吸 | 飞入后**缓慢呼吸 2 轮**再淡出 |
| 余光线索 | 一条渐隐线 | 顶部亮线 + 外发光 + 文字 |

**仍然是纯 CSS + 只动 `opacity`/`transform`**，没有引入动画库，
`prefers-reduced-motion` 下退化为透明度起伏。

**顺带修的一个 bug**：元素上挂了两条动画（飞入 + 呼吸）加两个伪元素光晕，
`animationend` 会触发多次，导致一次展示记多笔 dismiss。现在只认
`ig-hover-breathe` 那条。

**复审触发**：若 M1.5 调参发现还是太吵，优先降 `--ig-peak` 与呼吸轮数，
不要退回细线形态。

---

## ADR-121 备忘提醒与 Apple 动效：一个不在范围，一个已实现

**状态**：说明（回应「方案里还有备忘提醒、苹果动效，这些是都没做吗」）

### 备忘提醒 —— PRD 里没有这个功能

逐字核对 v0.2 与 ADR，**「备忘」「reminder」「memo」没有任何一处**提到备忘提醒。
「提醒」只在两处出现，都不是功能：

1. §1.2 设计原则：「**视觉本身就是提醒** —— 存在感来自质感与节奏，不是文字或声音」
   （明确说的是**不做**文字/声音提醒）；
2. §4.9：「已**提醒** N 次 · 你打开了 M 次」—— 埋点文案。

唯一沾边的是 **F9「会话自然结束时静默补记」**（P2，MVP 明确不做）与
**F10–F12 意图锚定**（P2，不做）。如果你想要的「备忘提醒」是别的意思
（比如记一条提醒到某个时间点），那是一个**新功能**，需要单独评审 ——
它也和 PRD §1.2「不拦截，只显现」的基调有张力。

### Apple 动效 —— 参数已经用上了

v0.2 §3.1 有一张表，把 v0.1 的 spring 参数换算成了 CSS 曲线：

| 动作 | PRD 给的曲线 | 实现位置 |
|---|---|---|
| 光带浮起 | `cubic-bezier(.16,.84,.3,1)`（≡ spring duration .55 / bounce .15） | `.ig-band` 的 `ig-fly-in` |
| 光带退去 | `cubic-bezier(.5,0,.75,.2)` | 呼吸尾段 |
| 记录卡展开 | `cubic-bezier(.34,1.56,.64,1)`（≡ bounce .2，**这条就是回弹感**） | `.ig-panel` 的 `ig-panel-in` |
| 记录卡收起 | `cubic-bezier(.4,0,.2,1)` | `.ig-panel--closing` |

**没有引入 Framer Motion**，这是 v0.2 ADR-006 的明确决定：6.5s 的呼吸是时间曲线，
不是需要中断的物理交互，CSS keyframes 足够；spring 的价值在「可拖动、可中断」，
本场景没有。ADR-006 还写了复审触发条件：将来做「拖拽收起记录卡」时再引
`LazyMotion + domAnimation`（约 5KB）。

所以「苹果动效」不是没做，是**用了 PRD 自己换算出来的 CSS 曲线**。
如果你觉得现在的观感还不够「果味」，正确的做法是调上表第三行
（记录卡展开）的 `bounce` 强度，而不是引入动画库。

---

## ADR-122 v1 旧 schema 迁移：在 store 之外、create 之前拦（线上事故复盘）

**状态**：接受（**修复两个让插件整体失效的线上 bug**）

### 事故一：读不存在的 `sessions.list.current`，全程静默

`apply()` 里的会话跟随 effect 写的是 `list.getSnapshot().current`。DSH 0.2.0-rc.2 的
`SessionListState` 实际形状是 `{ ids, byId, phase, projectionsBySession }` —— **没有
`current` 字段**（`service.d.ts` 可查，权威的「当前会话」判定是 `retainedBy.mainView > 0`）。

于是 `activeSessionId` 恒为 null → `runTick` 每秒在第一道守卫处提前返回 →
activeMs 永不增长 → 光带永不触发。**没有任何报错**，82 个测试全绿 —— 因为测试
fake 的 store 恰好有 `current` 字段，测的是自己的想象。

**修复**：新增 `session-id.js` 的 `resolveCurrentSessionId()`，候选优先级：
① `list.current`（将来宿主若补上此字段则直接受益）→ ② 按 `ids`/`byId` 顺序找
`retainedBy.mainView > 0` 的会话 → ③ 兜底最后一个 id → ④ null。
`conversation.input.left` 的 `props.sessionId`（会话作用域）同时用于探针认领，
这是最权威的来源。

### 事故二：v1 持久化值让 `apply()` 整体崩溃

`dsh-client-store` 的 `attachPersistence` 恢复逻辑是
`setState(JSON.parse(raw), true)` —— **整体替换**，不经过我们的任何代码，也没有
migrate 钩子。v1 数据只有顶层 `segment`/`metrics`，没有 `sessions`/`activeSessionId`，
替换后 `state.sessions` 变成 `undefined`，`switchSession` 抛
`TypeError: Cannot read properties of undefined`，而 cordis 的 `ctx.effect` 对同步
异常是**重抛**的 → `apply()` 中止 → 三个插槽一个都没注册。

**修复**：`preparePersistedState()` 在 `handle.create()` **之前**读
`immersion-glow.v1`，跑 `migrateState()` 后写回。这是唯一能拦住的时机。要点：

- **在 store 外做**，因为引擎不给我们钩子；顺带把 JSON 损坏值直接删键。
- **幂等**：HMR 重载会多次触发，v2 数据过一遍迁移必须字节级不变（已验证）。
- **归档按归属**：v1 的 `metrics.sessionId` 是那份时长唯一的忠实归属证据，
  按它搬进对应分区；归属不明时宁可丢弃也不冒充（ADR-117 原则）。孤儿键方案
  被否决——UI 永远不会显示 `__legacy__`，等于变相丢数据。
- **顶层 `segment`/`metrics` 一律删除**：留着必然有人再去读（slots.js 的常驻
  计时曾因此永远显示 0）。
- **actions 兜底**：`switchSession`/`writeSession` 遇到 `sessions` 非对象时就地
  补空表 —— 迁移是 belt，这里是 suspenders。

### 事故三（顺带修复）：stale 徽章恒亮

同源问题：`slots.js` 读 `useSessions((v) => v.current)` 恒得 undefined，只要
metrics 存在，记录卡永远显示「无打开会话」。改为用本插槽的 `props.sessionId` 判定。

### 测试必须贴真实形状

`test/client-load.test.mjs` 的 fake 重写：localStorage stub 模拟**整体替换**语义、
`makeFakeCtx(services)` 可注入真实形状的服务表、回归 A–E 分别锁住
「无 current 字段可解析」「旧 schema 不崩 + 数据保留 + 落盘升级」「迁移幂等」
「探针认领」「stale 不恒亮」。另有端到端脚本（真实 dsh-client-store 引擎 +
线上 leveldb 解出的真实 v1 数据）在开发期复核过完整用户旅程。

## ADR-123 光带退役，右上角提醒卡（用户反馈的三件套）

日期：2026-02（本轮）。状态：已实现。

### 背景：三条用户反馈

1. 「编辑框底部的时间显示，目前看不出是什么统计」——裸的「12 分钟」没有语义。
2. 「提醒的那个从底下弹出后也不知道是什么意思，而且一下子就闪没了……我希望的
   是显示在页面的右上角，然后给出 1 分钟的倒计时关闭，如果时间到了还没有点击，
   则会有一个未读的状态在那边」——底部光带 + 2.5s 首次提示方案被整体否决。
3. 「目前点击后的统计还是有问题：无打开会话，以下为上一次会话的统计。导致数量
   都是 0」——统计卡显示 stale 文案的同时数字全是 0，自相矛盾。

### 决定一：光带方案整体退役

底部光带（glow.js + band-css.js）、「点我看看」首次提示（hint）、介入强度设置
（breathing/silent）全部删除。理由：用户实测后否定了「底部事件型视觉」这条路；
它的三个支撑系统（提示、强度、dismiss 埋点）也随之失去意义。`ui.playSeq`、
`ui.hintVisible`、`ui.toast`、`telemetry.dismisses`、`settings.intensity` 从
state schema 移除，schema 升到 v3，migrateState 负责把旧键剥落。

### 决定二：toast 合并进提醒卡，而不是单独保留

排查发现 `ui.toast` 只有 state.js 的定义和 index.js 的两处调用，**全项目没有
任何渲染器**——「已收藏 / 已复制」的反馈此前完全不可见。为它单做一个组件不如
并进新提醒卡：非粘性（到点即消失、无未读徽标），且在 `showReminder` 里守卫
**不得覆盖**一条未读的 sticky 提醒——确认类消息没有资格顶掉用户还没读的阈值
提醒（那会让未读徽标凭空消失）。

### 决定三：提醒卡的状态机

`ui.reminder = { message, sticky, at, deadlineAt, seq }`：

- **倒计时内**：右上角卡片，标题 + 正文 + 「{n} 秒后自动收起」（tabular-nums），
  右上 × 关闭。点击卡片本体 = 打开记录卡并清除。
- **超时，sticky（阈值提醒）**：缩成一条未读徽标（圆点 + 文案），常驻直到被点；
  点击 = 打开记录卡并清除未读。**倒计时用组件本地的 useState + setInterval，
  绝不进 store**——每秒 setState 会打爆 persist；过期判定一律用绝对时间戳
  （deadlineAt），页面挂起、断点续跑都不会算错。测试环境的 fake React
  useEffect 是立即执行，组件里的 interval 不会真的启动（安全）。
- **超时，非 sticky（确认类）**：直接卸载，无痕消失。

`openFromReminder` 把「清提醒 + 开记录卡」合成一个 action——语义上点提醒就是
「我要看统计」，调用方不用记两件事。

### 决定四：stale 判定与计数真源（反馈 3 的根治）

- **stale 权威来源**：`shell.overlay` 挂在 root 作用域，没有 `props.sessionId`
  （第一版因此恒 stale）。改为 `useSessions` 快照里 `retainedBy.mainView > 0`
  的行——与宿主 ui-session `publishMain()` 的选主判据逐字相同；解析不出时退回
  `activeSessionId`（探针认领的指针）双保险。`useSessions` 缺失（测试/降级）
  时守卫成 null，绝不裸引用。
- **计数真源**：`useChat` 的 chat 快照 `legacy.*`（ADR-118 已定）；`useChat`
  缺失时探针**跳过 chat 快照**，`deriveMetrics(null, …)` 降级，且 degraded 的
  结果**绝不写回 store**——写进去就是「有会话但全是 0」的假数据，会顶掉分区里
  上一份真实统计。宁可 store 留旧值，也不用零顶掉它。
- **内联计时器**：加语义标签——`aria-label/title` 为「本次会话已沉浸」，
  正文「沉浸 {duration}」（反馈 1）。

### 取舍：未读状态只保页面生命周期

persist 是整体替换、没有字段白名单，未读徽标若跨刷新存活，恢复回来的
`deadlineAt` 已是过去时，会以怪形态闪一下。因此 `resetTransient` 把 reminder
一并清空：**未读在页面生命周期内保持，刷新即清**。要跨刷新需要把 unread 搬出
persist 并补迁移，复杂度与「会话提示的时效性」不成比例，不做。

### 测试与验证

- state.test：reminder 状态族全覆盖（60s/seq/sticky 守卫/空 message 忽略/
  openFromReminder/dismissReminder/resetTransient）。
- client-load：阈值触发 → sticky 提醒 + 60s + 未读保留 + 点击清除（真实时钟
  推进的时钟替身驱动 tick）；回归 A 改断言为 reminder；回归 C 验证落盘升级到
  v3 且旧 ui 键剥落；回归 E 重写为 useSessions mainView 判 stale（三种情况）；
  新增回归 F（useChat 缺失不写零计数）与 G（chat 快照泵真实计数）。
- metrics.test：补 overrides（{sessionId, hasMore}）用例与垃圾 overrides 防御。
- 端到端（真实 dsh-client-store + 线上 leveldb 解出的真实 v1 数据）：
  apply ACTIVE、三插槽、迁移保留旧时长、零错误。

---

## ADR-130（v4）：时间读数搬到右上角、发起后才计、加入模型维度与自评

用户诉求四条：① 不在输入框显示时间，挪到右上角（设了阈值才出现）；② 发起询问之前不统计；
③ 提炼第一次发起的任务名；④ 逐模型耗时 + 「得心应手」与「偏爱的模型」汇总。
实现上有一处**平台硬约束**改变了 ④ 的方案，先记在这里。

### 浏览器插件拿不到 session 事件流

最初按「订阅 `session/event`，用 `request/header` 确立当前模型、`step/start` 与
`assistant/message` 划时间窗」实现。写完去核对宿主类型才发现这条路在浏览器半**不存在**：

- 客户端侧 `ISessions` / `ISession`（`dsh-cordis-client-runner` 的声明）只有
  `list` / `retain` / `retainInfo`，会话对象上只有 `prompt` / `beginSubmission` /
  `loadOlder` / `rename` / `cancel` 这类**命令**，没有任何事件订阅；
- `ctx.on('session/event', …)` 只存在于**宿主半**（主进程，`dsh-api-session-controller`
  里就这么用）。浏览器半拿不到；
- `useProjection(key)` 只能**读**已注册的投影，不能注册新 fold。

结论：任何「自己 fold 事件流」的浏览器插件设计在这版宿主上都是空中楼阁。

### 改走 chat 快照推导（采纳）

chat 快照本身带齐了推导所需：`legacy.nodes` 里每个 assistant 节点就是一次模型调用，
带 `timing: { stepStartTime, firstTokenTime, completedTime }`；`trajectory` 投影里的
assistant 记录带 `providerMetadata: { provider, model }`（取自
`event.data.message.source`）。

于是 `model-log.js` 从快照推导：计时 `completedTime - stepStartTime`（**与宿主
`sessionStats` 逐字同口径**），归属优先按 `messageId`、其次按 `seq` 匹配 `trajectory`；
匹配不到才退回 `modelSelection` 的当前模型，并把 `exact` 标为 false 供 UI 注明是近似。
既没有路由也没有当前模型时，那次调用**不计入任何模型** —— 归进「未知」桶会污染排行，
而且它可能属于别的模型。

### ②「发起后才计」的实现

判据是 `isTaskStarted(bucket)`：分区里有 `currentModel` / 非空 `models` /
`stats.steps|turns|llmMs > 0` 任一即算发起过。**不用「时长 > 0」** —— 后者在发起后、
模型还没回完的一瞬间是 0，会让读数闪一下再消失。右上角读数与记录卡都受这个判据控制，
所以「发起之前右上角是干净的」是自然结果，不需要额外的开关。

### ③ 任务名 = 隐私边界的一次显式放宽

旧承诺「绝不触碰正文」，要拿到能认出这次任务的名字只能读首条 user 消息。
因此把承诺改写成**更窄但明确**的版本：只读首条、只取 text part、只留 60 字。
README 与 known-limitations 都据此重写。取不到就显示「未命名任务」，不编。

### ④ 汇总明确不做自动判断

可得的只有耗时、首字延迟、解码速度、轮次 —— 全是客观量，**没有质量信号**。
从耗时反推「擅长写代码」是伪科学，所以汇总只把证据与用户自评并排展示，
「得心应手 / 偏爱」由用户自己下结论。这一条写进了 UI 文案（`summary.disclaimer`），
不只是文档。

### 目的确认为什么是三档

「基本做完但有返工」是最常见的真实状态，压成 boolean 会把它逼成两端之一，
统计随即失真。三档（达到 / 基本达到 / 没达到）保留了这个中间态。
达成率按「基本达到 = 0.5 分」计，且**分母只算已评价的记录** —— 把「没评」当「没达成」
会把完成率压到真实水平以下，那是在骗用户。

### 测试

- model-log.test（26 项）：精确归属 / 退回近似 / 两者共存、轮次去重、排序、
  持久化往返与脏数据丢弃、中断步骤不计耗时、畸形输入不抛。
- v4-flow.test（14 项）：探针泵数、右上角读数的四个门槛（发起前 / 阈值空 /
  开关关 / 插件禁用）、自评落盘与覆盖、图层在脏数据下不崩。
  这批测试当场抓到一个真 bug：`CornerMeter` 里读了一个已删除的 `enabled` 变量，
  会让展开态面板一渲染就抛 —— 单测覆盖不到「组件真的被渲染」这条路径。

---

## ADR-131（v5）：修「换模型串账」，计时器改圆环，提醒卡改为展开计时器

三条用户反馈，其中第一条是**真 bug**，不是观感问题。

### ① 换模型后旧账被记到新模型名下（真 bug，已修）

现象：先用 deepseek-chat 跑了一段，中途切到 claude-opus，之后新模型的耗时里
把前面 deepseek 的时间也算进去了，且随重算次数越来越离谱。

根因：`deriveModelEntries` 每次从整个 chat 快照**全量重算**。当某个 assistant
节点匹配不到 `trajectory` 路由时，它会退回 `currentModel` —— 而此时
`currentModel` 已经是**切过之后**的那个模型。于是历史节点每被重算一次，
就被当前模型重新认领一次。

修法：引入**归属记忆**（`deriveModelEntries` 的 `remembered` / 返回的 `memory`）。
调用方（探针）用 `useRef` 持有它（页面生命周期内，**不进 store**）：

- 记忆里有 → 直接采用，冻结为事实；
- 记忆没有 → 走 trajectory 精确路由；
- 仍没有 → 才用当次 `currentModel`，并且**只对该节点生效一次**并写入记忆。

这样近似值只在那个节点出现的那一刻生效一次，之后不再被重算改写。

顺带把 `exact` 的定义改严：以前「trajectory 存在」就算精确，现在是
**每条调用都有精确归属**才算精确。混进任何一条近似就为 false ——
声称精确而实际含猜测，比明说近似更糟。

### ② 展开面板与记录卡都要能看到历史评价

「这次任务里哪个模型好使」和「我历次用下来觉得哪个好使」是两个问题。
- 右上角展开面板：逐模型行右侧直接挂评分与最近一条备注，数字与判断并排；
- 记录卡新增「历史累计」区块（跨会话排行的前 4 条），本次用到的模型带「本次」标记。

视觉上历史区块刻意更轻（透明底 + 细边），本次明细用实心底板 ——
顺序与权重一致，眼睛先落在本次上。

### ③ 圆形计时器，以及提醒卡改为展开它

圆环表示**离下一次该歇了还有多远**（锚在下一档阈值上），中心数字表示模型耗时。
两者语义不同是刻意的：用户不会为一次任务设时长上限，所以「已用 / 总时」的
分母根本不存在；锚在阈值上则「环满 = 该起身了」与右上角弹出的提醒卡是同一时刻。

提醒卡的点击目标从「打开记录卡」改成「展开计时器」：提醒本就在计时器旁边，
而计时器已经装着全部明细，多弹一张卡只是让人多点一次关掉。要评价/收藏，
展开面板底部有「打开记录卡」。为此把展开态从组件本地 `useState` 提到 store
（`ui.meterOpen`）—— 提醒卡与计时器是两个组件，本地 state 做不到。

### 顺带：耗时精度

发现「不到 1 分钟」对模型耗时没有信息量（57 秒和 3 秒显示同一句话）。
新增 `formatElapsed`：不足一分钟直接给秒，一分钟以上沿用原口径。
右上角、展开面板、记录卡逐模型行全部改用它。

### 测试

158 项。model-log 新增 9 项（归属记忆、exact 收紧、ringProgress、formatElapsed），
v4-flow 新增 6 项（圆环结构、展开、历史评价、提醒联动）。

这批测试抓到一个真 bug：`figure()` 引用了 `CornerMeter` 的局部变量 `h`，
而收拢态从不调用它 —— 展开路径一旦走到就 ReferenceError，
**汇总页复用同一个 helper，所以它也一直藏着**。已改为显式接收 React。
这条提醒了一个通用教训：只在「另一条分支」里调用的 helper，
如果它抓了外层作用域的变量，那个分支就从来没被执行过。

---

## ADR-132（v7）：面板统一锚点 + 收拢态两行分工

三条用户反馈：位置仍偏高、收拢态左右含义混乱、两个弹窗重叠难看。

### 位置再下沉一段

`measureSafeTop` 的结果在「外壳底边 + 间距」之后，再加一个 `CONTENT_INSET`（16px，
约一个正文行距）。贴着导航栏底边会让计时器**看起来属于导航栏**；往下沉一点，
它才明确属于内容区。这是纯观感判断，但判据写成了常量与注释，不是散落的魔数。

### 收拢态的两行分工

原先是「模型名 / 耗时 / 倒计时」混在一行里，左右含义随提醒态切换而变 ——
用户反馈原话是「还是分不清」。现在固定成两行：

| 行 | 内容 | 角色 |
|---|---|---|
| 第一行 | 模型名（或提醒语）+ 右端总耗时 | 主信息：现在是什么、一共多久 |
| 第二行 | 常态「模型耗时 · 下次提醒还有 X」／提醒态「X 后收起」 | 副信息：解释第一行 |

第二行的常态形态是**新增**的：环里那个「4」没有单位，光标一个数字不解释就是天书。
常态说「下次提醒还有多久」（用户在意的未来时间点），提醒态才说「X 后收起」
（即将消失的 UI 元素）—— 两种形态的措辞刻意不同，因为它们回答的不是同一个问题。

### 三个面板统一锚点 + 推进转场

记录卡原先在**底部居中**，计时器在右上角，同时开就是两个不相干的浮层飘在屏幕
两端。现在全部移到右上角同一锚点，`ig-panel--push` 做推进转场
（左让 8px + 淡入 0.28s），退场方向相反，形成「推进 → 推出」的一对。

位移刻意只有 8px：这是同一锚点上的**换页**，大幅位移会让边缘的框突然跳一下，
反而更像两个东西。

遮罩改为完全透明 —— 它现在只承担「点空白关闭」，不再压暗整窗。面板贴着内容区时
压暗会像弹出了模态对话框，而它其实是个侧面板。

互斥规则实现在 handler 里（打开 A 关掉 B、C）。为让它**测得到**，handlers 经
`provideRoot` 暴露出去：先前单元测试是在测试文件里**复制了一份 handler 逻辑**，
等于在测复制品 —— 改坏真代码测试照样绿。暴露之后测试驱动的是真代码。

`provideRoot` 因此调用两次（第二次补 handlers，它依赖第一次之后才构造的闭包），
既有断言「只贡献一次 root 面」已更新并说明理由；渲染器会合并 root 的 props，
对组件透明。

---

## ADR-133（v8）：间距再降；面板打开时收拢态让位

两条反馈，都很直接。

### 位置：两段偏移压到 14px

v7 用了「间距 12 + 内容区内缩 16 = 28px」，用户连着反馈偏高。压到
`EDGE_GAP 8 + CONTENT_INSET 6 = 14px`：仍与外壳留出可见间隔（边框不会视觉上
贴着导航栏下沿），整体低一档。兜底值同步 64 → 44px。

两段偏移拆成具名常量而不是一个数，是为了「与外壳留一点缝」和「沉进内容区」
这两个意图能被分别调整 —— 它们不是同一个理由。测试直接引用常量而不是抄数字：
间距是纯观感参数，已经调过三轮，抄数字的断言会变成一片假红。

### 面板打开时收拢态完全不渲染

v7 把记录卡/画廊/汇总都移到了与计时器同一个锚点，于是收拢态就在面板正上方
那个位置 —— 用户反馈「会被顶上的遮住」。

修法是**在 slots.js 里按 `panelOpen` 短路掉 CornerMeter 的渲染**，不是调
z-index。层级只能决定谁在上面，**不能消除重叠本身**；两个东西占着同一个位置
时，正确的做法是让一个消失，而不是让它被压住。

顺带把「收起面板后」的行为定成**回到展开态**（`setMeterOpen(true)`）：
用户刚在记录卡/汇总里看完，注意力还在这一块，塌回一行小球等于逼他再点一次。
同时避免收拢态闪现一瞬。

### 顺带修：历史区块与「各模型」重复

渲染实测截图时发现：历史累计区块把本次用过的模型又列了一遍，附带同样的评分
和备注 —— 同一屏出现两遍同样的内容。历史区块的价值恰恰在于「本次没用到、
你以前常用」的那些模型，所以按本次的 key 过滤掉。

去重后 `usedHere` / `ig-history-now`「本次」标记成了永远为假的死代码，一并删除。

**教训**：这次的重复在单元测试里看不见 —— 测试只断言「历史区块存在」，
而它确实存在（只是内容重复）。视觉问题要么靠截图，要么靠断言**内容**而不是
存在性。
