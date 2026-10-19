/**
 * 记录卡、画廊、设置行、提醒卡的样式。
 *
 * 光带（band-css.js）已随 ADR-123 退役，本文件是唯一的样式来源。
 *
 * @module src/client/panel-css
 */

const PANEL_CSS = `/* ── 记录卡 / 画廊的公共面板 ─────────────────────────────────────── */
/*
 * 遮罩：只做「点空白关闭」，不改变颜色。
 *
 * 之前记录卡在底部居中时它需要压暗一点来建立层次；现在面板贴着内容区右上角，
 * 压暗整个窗口反而像弹出了模态对话框 —— 而它其实是个侧面板。所以保持透明，
 * 只承担点击关闭的职责。
 */
.ig-scrim {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background: transparent;
}

/*
 * 记录卡 / 画廊 / 汇总 / 计时器明细**共用右上角这一个位置**。
 *
 * 之前记录卡在底部居中、计时器在右上角，同时开就是两个不相干的浮层飘在
 * 屏幕两端 —— 看着乱，视线要在两个地方来回跳。现在统一到一处，配合
 * ig-panel--push 的推进转场，「上一层 → 下一层」是连续的动作而不是
 * 突然多出一个东西。
 */
.ig-panel {
  position: absolute;
  top: var(--ig-safe-top, 64px);
  right: 16px;
  pointer-events: auto;
  width: min(360px, calc(100vw - 32px));
  max-height: min(70vh, 560px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--dsw-radius-lg, 14px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.12));
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  backdrop-filter: blur(18px) saturate(1.4);
  color: var(--dsw-alias-label-primary, currentColor);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  animation: ig-panel-push 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/*
 * 推进转场：从上一层的位置向左让 8px 并淡入。
 *
 * 位移很小（8px）且只动 transform —— 这是同一锚点上的「换页」，不是
 * 飞入。若给大幅度，边缘的框会突然跳一下，反而更像两个东西。
 */
@keyframes ig-panel-push {
  from { opacity: 0; transform: translateX(-8px) scale(0.985); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}

.ig-panel--closing {
  animation: ig-panel-out 0.45s cubic-bezier(0.4, 0, 0.2, 1) both;
}

/* 收起：向右让 8px 并淡出，与推进方向相反 —— 形成「推进 → 推出」的一对。 */
@keyframes ig-panel-out {
  from { opacity: 1; transform: translateX(0) scale(1); }
  to   { opacity: 0; transform: translateX(-8px) scale(0.985); }
}

.ig-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ig-panel-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  margin: 0;
}

.ig-panel-close {
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: var(--dsw-radius-sm, 6px);
}

.ig-panel-close:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

/* ── 指标栅格 ───────────────────────────────────────────────────── */
.ig-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.ig-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
  min-width: 0;
}

.ig-metric dt {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-metric dd {
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 标签 ───────────────────────────────────────────────────────── */
.ig-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ig-tag {
  font-size: 12px;
  line-height: 18px;
  padding: 2px 8px;
  border-radius: var(--dsw-radius-full, 999px);
  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.14));
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

/* ── 说明文字 ───────────────────────────────────────────────────── */
.ig-note {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  margin: 0;
}

.ig-note--warn {
  color: var(--dsw-alias-label-warning, #b7791f);
}

/* ── 按钮 ───────────────────────────────────────────────────────── */
.ig-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ig-btn {
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  padding: 6px 12px;
  border-radius: var(--dsw-radius-md, 10px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
  color: var(--dsw-alias-label-primary, currentColor);
  cursor: pointer;
}

.ig-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.16));
}

.ig-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.ig-btn--primary {
  background: var(--dsw-alias-text-brand, #539cfa);
  border-color: transparent;
  color: #fff;
}

.ig-btn--quiet {
  background: transparent;
}

.ig-btn--danger {
  color: var(--dsw-alias-label-error, #d64545);
}

/* ── 画廊列表 ───────────────────────────────────────────────────── */
.ig-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
}

.ig-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ig-row-duration {
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
}

.ig-row-sub {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-row-remove {
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: var(--dsw-radius-sm, 6px);
  flex: none;
}

.ig-row-remove:hover {
  color: var(--dsw-alias-label-error, #d64545);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

/* ── 右上角圆形计时器（v5）──────────────────────────────────────── */
/*
 * 收拢态是一个 44px 的圆环 + 一行字。圆环表示「离下一次该歇了还有多远」，
 * 中心数字表示「模型已经跑了多久」，右侧是当前模型名。
 *
 * 三个信息量是上限。再多它就从环境的一部分变成一个仪表盘，而它该是前者。
 *
 * 材质与提醒卡同源（blur + 一道极细描边）但弱一档：提醒是事件，读数是常态。
 */
/*
 * ⚠ top 用 var(--ig-safe-top) 而**不是写死数值**：窗口右上角那排按钮属于宿主，
 * 写死偏移必然会在换行 / 窄窗 / 宿主改版时压上去。该变量由 safe-top.js 在
 * 运行时量出「外壳底边 + 12px」写入（见那个文件的说明）。
 *
 * 兜底值写在 calc 里，万一测量失败也还在导航栏之下。
 */
.ig-hud {
  position: absolute;
  top: var(--ig-safe-top, 52px);
  right: 16px;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border-radius: var(--dsw-radius-full, 999px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.24));
  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.1));
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  backdrop-filter: blur(18px) saturate(1.3);
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  animation: ig-hud-in 0.32s cubic-bezier(0.34, 1.4, 0.64, 1) both;
}

@keyframes ig-hud-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ig-hud:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.14));
  color: var(--dsw-alias-label-primary, currentColor);
}

.ig-hud:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}

/*
 * 圆环本体。
 *
 * 中心数字用 HTML 而非 SVG <text>：SVG 文本的字号与基线在各 WebView 上表现
 * 不一、垂直居中尤其难控，绝对定位的 span 更稳。数字与环同色系但更深一档，
 * 靠 font-variant-numeric 的等宽数字避免每秒跳动导致宽度抖动。
 */
.ig-ring {
  position: relative;
  display: inline-grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;
  flex: none;
}

.ig-ring-svg {
  display: block;
  transform: rotate(0deg);
}

.ig-ring-track {
  stroke: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.18));
}

.ig-ring-value {
  stroke: var(--dsw-alias-text-brand, #539cfa);
  /* 进度只靠 dasharray 变化，不动 transition —— 每秒一跳的动画会一直重绘。 */
}

.ig-ring-text {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 12px;
  line-height: 1;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, currentColor);
  letter-spacing: -0.2px;
  user-select: none;
}

/*
 * 提醒态变体（v6）。
 *
 * 不用「换一张卡片」表达提醒，而是让计时器**自己转成警示色**。这样右上角永远
 * 只有一个浮层，提醒是它的状态而不是它的邻居。
 *
 * 倒计时中：警示色 + 轻微呼吸（只在 countdown 态，unread 态不闪 —— 未读已经
 * 足够引人注意，再闪就是噪音）。
 */
.ig-ring--alert .ig-ring-value {
  stroke: var(--dsw-alias-label-warning, #d9a441);
  animation: ig-ring-breathe 2.4s ease-in-out infinite;
}

.ig-ring--unread .ig-ring-value {
  stroke: var(--dsw-alias-label-warning, #d9a441);
}

@keyframes ig-ring-breathe {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}

/* 提醒态的提示语：与平时一样的字重，只是换色 —— 它不该突然变大变重。 */
.ig-hud-model--alert {
  color: var(--dsw-alias-label-warning, #d9a441);
}

.ig-hud-countdown {
  font-size: 11px;
  line-height: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.8));
}

/* 未读点：与提醒卡时代的未读点同语言，位置跟着提示语走。 */
.ig-hud-dot {
  inline-size: 5px;
  block-size: 5px;
  border-radius: 50%;
  flex: none;
  background: var(--dsw-alias-label-warning, #d9a441);
  align-self: center;
}

/* 展开面板顶部的提醒条。 */
.ig-hud-banner {
  font-size: 12px;
  line-height: 17px;
  color: var(--dsw-alias-label-warning, #d9a441);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
  margin: 0;
  padding: 6px 9px;
  border-radius: var(--dsw-radius-sm, 6px);
}

.ig-hud-banner--unread {
  color: var(--dsw-alias-label-warning, #d9a441);
}

/*
 * 收拢态的两行文字。
 *
 * 分工是刻意的（用户反馈 v6 指出了原先左右含义混乱）：
 *   第一行 = 「现在是什么」 + 「一共多久」   ← 主信息，最易读
 *   第二行 = 一句解释「这个数是什么」或「还有多久收起」 ← 副信息，降一级
 *
 * 第二行不是装饰：中心圆里那个「4」没有单位，不解释就是天书。
 */
.ig-hud-side {
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: flex-start;
  min-width: 0;
  max-width: 168px;
}

.ig-hud-row-line {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 100%;
}

.ig-hud-sub-line {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 15px;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.8));
  font-variant-numeric: tabular-nums;
}

.ig-hud-sub-line--alert {
  color: var(--dsw-alias-label-warning, #d9a441);
}

.ig-hud-model {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-hud-time {
  flex: none;
  font-size: 12.5px;
  line-height: 16px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, currentColor);
}

/* 展开态：从收拢的那个圆点长出来，视觉上是同一个东西打开了。 */
.ig-hud-panel {
  position: absolute;
  top: var(--ig-safe-top, 52px);
  right: 16px;
  pointer-events: auto;
  width: min(340px, calc(100vw - 32px));
  max-height: min(70vh, 560px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: var(--dsw-radius-lg, 14px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.12));
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  backdrop-filter: blur(18px) saturate(1.4);
  color: var(--dsw-alias-label-primary, currentColor);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  animation: ig-hud-panel-in 0.3s cubic-bezier(0.34, 1.4, 0.64, 1) both;
}

@keyframes ig-hud-panel-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ig-hud-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

/* 展开态标题升级成任务名：它是最能认出「这次是哪件事」的信息。 */
.ig-hud-head-text .ig-hud-title {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, currentColor);
}

/* 已答过「达到了吗」时的一行回显，让用户不必再开卡片确认自己评过什么。 */
.ig-hud-verdict {
  font-size: 12px;
  line-height: 17px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  margin: 0;
  padding: 6px 8px;
  border-radius: var(--dsw-radius-sm, 6px);
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
}

.ig-hud-head-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ig-hud-title {
  font-size: 13px;
  line-height: 19px;
  font-weight: 500;
}

/* 任务名：两行截断。副标题形态 —— 它是定位信息，不该比标题重。 */
.ig-hud-subtitle {
  font-size: 12px;
  line-height: 17px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ig-hud-collapse {
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  line-height: 18px;
  padding: 1px 7px;
  border-radius: var(--dsw-radius-sm, 6px);
  flex: none;
}

.ig-hud-collapse:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

/*
 * 占比条：整条按模型分段，flex-grow 承担比例。
 * 高度 4px —— 再高就成了图表，而这里只需要一个「大致比例」的感觉。
 */
.ig-hud-bar {
  display: flex;
  gap: 1px;
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.14));
}

.ig-hud-seg {
  background: var(--dsw-alias-text-brand, #539cfa);
  border-radius: 1px;
  min-width: 2px;
  height: 100%;
}

/* 多模型时用不同色相区分：相邻色相，比彩虹好读。 */
.ig-hud-seg:nth-child(2n) { background: var(--dsw-static-neutral-bluish-400, #7c9cff); }
.ig-hud-seg:nth-child(3n) { background: var(--dsw-alias-text-success, #3fa672); }

.ig-hud-figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.ig-hud-figure {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 10px;
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
  min-width: 0;
}

.ig-hud-figure dt {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-hud-figure dd {
  font-size: 15px;
  line-height: 21px;
  font-weight: 500;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.ig-hud-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-hud-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0;
  border-radius: var(--dsw-radius-sm, 6px);
  min-width: 0;
}

.ig-hud-row + .ig-hud-row {
  border-top: 0.5px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.16));
}

.ig-hud-row-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.ig-hud-row-model {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 19px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-hud-row-time {
  font-size: 13px;
  line-height: 19px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, currentColor);
}

.ig-hud-row-sub {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.8));
}

/* ── 设置行 ─────────────────────────────────────────────────────── */
.ig-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  color: var(--dsw-alias-label-primary, currentColor);
  font-size: 14px;
  line-height: 22px;
}

.ig-settings-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.ig-settings-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ig-settings-title {
  font-size: 14px;
  line-height: 20px;
}

.ig-settings-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-settings-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.ig-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ig-field-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-input {
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  padding: 5px 8px;
  border-radius: var(--dsw-radius-sm, 6px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
  color: var(--dsw-alias-label-primary, currentColor);
  width: 100%;
  box-sizing: border-box;
}

.ig-input--invalid {
  border-color: var(--dsw-alias-label-error, #d64545);
}

.ig-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  flex: none;
}

.ig-switch input {
  inline-size: 16px;
  block-size: 16px;
  accent-color: var(--dsw-alias-text-brand, #539cfa);
  cursor: pointer;
}

.ig-inline-timer {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  user-select: none;
  white-space: nowrap;
  padding: 0 4px;
}

/* ── 记录卡：任务名 / 模型明细 / 目的确认（v4）───────────────────── */

/*
 * 任务名是这张卡的主角：它是唯一能让用户「认出这次任务」的东西，所以给它一行
 * 独立的、可换行的正文样式，而不是塞进指标格。
 */
.ig-task {
  font-size: 13px;
  line-height: 19px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.ig-panel-head-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

/* 汇总面板比记录卡宽：它要并排放三格客观指标，窄了会挤成一团。 */
.ig-panel--wide {
  width: min(400px, calc(100vw - 32px));
}

.ig-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ig-block-title {
  font-size: 12px;
  line-height: 17px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  margin: 0;
}

/* ── 逐模型明细 ───────────────────────────────────────────────────── */
.ig-models {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * 每个模型一块独立底板而不是一条分隔线：卡片里可能出现 4–6 个模型，分隔线会
 * 让它读起来像一张表，而它其实是「几张小卡片」。
 */
.ig-model {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
  min-width: 0;
}

.ig-model-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.ig-model-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 19px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-model-time {
  font-size: 13px;
  line-height: 19px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, currentColor);
}

/* 自评分：不是星星而是「4.2 分」的数字。星级无法表达 4.2。 */
.ig-model-rating {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-text-success, #3fa672);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
  padding: 1px 6px;
  border-radius: var(--dsw-radius-full, 999px);
  flex: none;
  font-variant-numeric: tabular-nums;
}

.ig-model-sub {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.8));
}

/* 已有备注：左侧一道竖线，视觉上明确「这是引用，不是本插件的数据」。 */
.ig-note--quote {
  border-left: 2px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.24));
  padding-left: 8px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-model-note {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
}

/*
 * 五档评分按钮：等宽平铺，选中态用 brand 底色。
 * 文字标签而非星星 —— 「顺手 / 极其顺手」在用户心里有稳定含义，「4 星」没有。
 */
.ig-rating {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.ig-rating-btn {
  font: inherit;
  font-size: 11.5px;
  line-height: 16px;
  padding: 3px 8px;
  border-radius: var(--dsw-radius-full, 999px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
}

.ig-rating-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.14));
  color: var(--dsw-alias-label-primary, currentColor);
}

.ig-textarea {
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  padding: 6px 8px;
  border-radius: var(--dsw-radius-sm, 6px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-base, transparent);
  color: var(--dsw-alias-label-primary, currentColor);
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}

.ig-textarea:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}

.ig-model-add {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.8));
  cursor: pointer;
  font: inherit;
  font-size: 11.5px;
  line-height: 16px;
  padding: 2px 0;
  border-radius: var(--dsw-radius-sm, 6px);
}

.ig-model-add:hover {
  color: var(--dsw-alias-text-brand, #539cfa);
}

/* ── 目的确认 ─────────────────────────────────────────────────────── */
.ig-verdict {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ig-verdict-btn {
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  padding: 5px 12px;
  border-radius: var(--dsw-radius-full, 999px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
}

.ig-verdict-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.14));
}

.ig-verdict-btn--on {
  background: var(--dsw-alias-text-brand, #539cfa);
  border-color: transparent;
  color: #fff;
}

/* 画廊行里的达成标记：三档各有语义色，绿 / 黄 / 红。 */
.ig-verdict-dot {
  align-self: flex-start;
  font-size: 11px;
  line-height: 16px;
  padding: 1px 7px;
  border-radius: var(--dsw-radius-full, 999px);
  flex: none;
}

.ig-verdict-dot--yes {
  color: var(--dsw-alias-text-success, #3fa672);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

.ig-verdict-dot--partial {
  color: var(--dsw-alias-label-warning, #b7791f);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

.ig-verdict-dot--no {
  color: var(--dsw-alias-label-error, #d64545);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

/* ── 历史累计（v5）───────────────────────────────────────────────── */
/*
 * 与逐模型明细视觉上刻意不同：历史是「背景信息」，本次才是主角。所以它用
 * 更轻的底色（透明 + 一道细边），而本次明细用实心底板。两者放在一起时
 * 眼睛会先落在本次上 —— 顺序与权重一致。
 */
.ig-history {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-history-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  border-radius: var(--dsw-radius-md, 10px);
  border: 0.5px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.16));
  min-width: 0;
}

/* 「本次」标记：说明这个模型正在这次任务里被用，别和历史条目混淆。 */
.ig-history-now {
  font-size: 10.5px;
  line-height: 15px;
  padding: 0 5px;
  border-radius: var(--dsw-radius-full, 999px);
  color: var(--dsw-alias-text-brand, #539cfa);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
  flex: none;
}

/* ── 汇总面板 ─────────────────────────────────────────────────────── */
.ig-summary-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-summary-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.08));
  min-width: 0;
}

.ig-summary-row-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.ig-summary-row-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  line-height: 20px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-summary-row-time {
  font-size: 13px;
  line-height: 19px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-summary-figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.ig-summary-figures > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.ig-summary-figures dt {
  font-size: 11px;
  line-height: 15px;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.8));
  white-space: nowrap;
}

.ig-summary-figures dd {
  font-size: 13px;
  line-height: 18px;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.ig-summary-notes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-summary-notes li {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 8px;
  border-left: 2px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.24));
  min-width: 0;
}

.ig-summary-note-task {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.8));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-summary-note-text {
  font-size: 12px;
  line-height: 17px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

/* ── 画廊：任务名优先 ─────────────────────────────────────────────── */
.ig-row-title {
  font-size: 13px;
  line-height: 19px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-row-review {
  flex: none;
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
  font: inherit;
  font-size: 11.5px;
  line-height: 16px;
  padding: 3px 8px;
  border-radius: var(--dsw-radius-full, 999px);
}

.ig-row-review:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.14));
  color: var(--dsw-alias-label-primary, currentColor);
}

/* ── 动效偏好 ───────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .ig-hud,
  .ig-hud-panel,
  .ig-panel,
  .ig-panel--closing {
    animation: none;
  }
}
`;
