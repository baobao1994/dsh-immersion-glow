/**
 * 记录卡、画廊、设置行、右上角读数与提醒卡的样式。
 *
 * 光带（band-css.js）已随 ADR-123 退役，本文件是唯一的样式来源。
 *
 * ## 这一版的三条底层规则
 *
 *   1. **颜色只从语义层取。** 文件头的 `--ig-*` 是插件唯一的调色板，
 *      组件里不再出现裸色值。宿主改名只改那一处。
 *   2. **一个面板只有一层「面」。** 面板之上用留白与发丝线分组，
 *      不再套第二个、第三个灰底圆角块（旧版嵌套到三层，视觉上分不出层级）。
 *   3. **动效只描述「呼吸」和「推进」两件事。** 不用回弹曲线，
 *      不在 hover 上缩放；`prefers-reduced-motion` 必须覆盖到每一个动画。
 *
 * @module src/client/panel-css
 */

const PANEL_CSS = `/* ── 语义层 ─────────────────────────────────────────────────────── */
/*
 * 插件自己的调色板，只在这里定义一次。
 *
 * ## 为什么必须有这一层
 *
 * 旧版直接引用 --dsw-alias-text-brand / --dsw-alias-label-warning /
 * --dsw-alias-text-success / --dsw-alias-label-error —— 这四个名字在宿主
 * 主题里**都不存在**，于是 var(name, 兜底值) 全部静默落到硬编码的深色值上。
 * 浅色主题下实测对比度：提醒语 2.25:1、主按钮 2.80:1、绿色评分 3.04:1。
 * 也就是说：配色是按深色调的，用户一旦用浅色就全线失效，而且不报错。
 *
 * ## 为什么暖色要 color-mix
 *
 * state-warn-label（#dd8629）在白底只有 2.79:1。往当前主题的主文字色里压
 * 一档，两种主题就都自适应了：浅色 5.19:1、深色 9.06:1。ok / bad 同理。
 *
 * 兜底声明写在 color-mix 之前：不支持 color-mix 的环境只用第一种，
 * 颜色仍然可读（只是没那么贴合主题），不会整条属性失效。
 */
.ig-hud,
.ig-hud-card,
.ig-hud-panel,
.ig-panel,
.ig-settings {
  /* 暖：提醒、休息、以及「人的判断」都用它 */
  --ig-warm: var(--dsw-alias-state-warn-primary);
  --ig-warm-ink: var(--dsw-alias-state-warn-label);
  --ig-warm-ink: color-mix(in oklab, var(--dsw-alias-state-warn-label) 70%, var(--dsw-alias-label-primary));
  --ig-warm-surface: var(--dsw-alias-bg-module-platform);
  --ig-warm-surface: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 90%, var(--dsw-alias-state-warn-primary));
  --ig-warm-line: var(--dsw-alias-border-l3);
  --ig-warm-line: color-mix(in oklab, var(--dsw-alias-state-warn-primary) 30%, transparent);

  /* 文本：三级就够。11–12px 一律用 muted，不用 tertiary（浅色下 3.71:1）。 */
  --ig-ink: var(--dsw-alias-label-primary);
  --ig-muted: var(--dsw-alias-label-secondary);
  --ig-hairline: var(--dsw-alias-border-l3);

  /* 主操作：走宿主的主按钮 token（浅色是黑底白字 17.7:1，不是白字压蓝 4.23:1） */
  --ig-action: var(--dsw-alias-button-primary-fill);
  --ig-action-ink: var(--dsw-alias-label-primary-foreground);
  --ig-action-hover: var(--dsw-alias-button-primary-hover);

  /* 语义色：同样做过对比度补偿 */
  --ig-ok: var(--dsw-alias-state-success-primary);
  --ig-ok-ink: var(--dsw-alias-state-success-primary);
  --ig-ok-ink: color-mix(in oklab, var(--dsw-alias-state-success-primary) 68%, var(--dsw-alias-label-primary));
  --ig-bad: var(--dsw-alias-state-error-primary);
  --ig-bad-ink: var(--dsw-alias-state-error-primary);
  --ig-bad-ink: color-mix(in oklab, var(--dsw-alias-state-error-primary) 82%, var(--dsw-alias-label-primary));

  /* 节奏：4 / 8 / 12 / 18，只有这四档 */
  --ig-gap-xs: 4px;
  --ig-gap-sm: 8px;
  --ig-gap-md: 12px;
  --ig-gap-lg: 18px;
}

/* ── 遮罩 ───────────────────────────────────────────────────────── */
/*
 * 只做「点空白关闭」，不改变颜色：面板是贴着内容区右上角的侧面板，
 * 压暗整个窗口会让它看起来像模态对话框，而它不是。
 */
.ig-scrim {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background: transparent;
}

/* ── 面板（记录卡 / 画廊 / 汇总共用一个位置）────────────────────── */
/*
 * 三个面板**共用右上角这一个位置**，靠推进转场表达「上一层 → 下一层」。
 *
 * 材质：不透明底 + 一道发丝线 + 极浅的投影。
 * 旧版是「bg-layer-2（不透明）+ backdrop-filter: blur(18px) + 0 18px 48px 重阴影」，
 * 三件事都不作数：不透明底上模糊看不见；48px 重阴影配 0.5px 边框正好是
 * 「幽灵卡片」那种廉价浮起感。现在模糊去掉，投影收到 8px 以内。
 */
.ig-panel {
  position: absolute;
  top: var(--ig-safe-top, 52px);
  right: 16px;
  pointer-events: auto;
  width: min(340px, calc(100vw - 32px));
  max-height: min(78vh, 640px);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: var(--ig-gap-md);
  padding: 18px;
  border-radius: var(--dsw-radius-lg);
  border: 0.5px solid var(--ig-hairline);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--ig-ink);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  animation: ig-panel-push 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/*
 * 滚动条只藏不废：内容超出仍可滚。
 * ⚠ 但「藏起来」不等于「用户可以不知道」—— 所以主操作条是 sticky 的
 * （见 .ig-card-actions），不依赖用户猜到下面还有内容。
 */
.ig-panel::-webkit-scrollbar,
.ig-hud-panel::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* 推进：从上一层的位置向左让 6px 并淡入。位移小到像「换页」而不是「飞入」。 */
@keyframes ig-panel-push {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}

.ig-panel--closing {
  animation: ig-panel-out 0.18s cubic-bezier(0.4, 0, 1, 1) both;
}

@keyframes ig-panel-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-6px); }
}

.ig-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ig-gap-md);
}

.ig-panel-head-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.ig-panel-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: -0.01em;
  margin: 0;
}

/*
 * 「返回」而不是 ×：面板是从计时器**推进**过来的，退出动作的语义是
 * 「回到上一层」。一个向左的尖括号 + 文字比孤零零的 × 更准确。
 */
.ig-panel-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--ig-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  padding: 3px 8px 3px 5px;
  border-radius: var(--dsw-radius-sm);
}

.ig-panel-back:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--ig-ink);
}

.ig-panel-back:focus-visible,
.ig-hud:focus-visible,
.ig-hud-collapse:focus-visible,
.ig-hud-banner:focus-visible,
.ig-btn:focus-visible,
.ig-row-review:focus-visible,
.ig-row-remove:focus-visible,
.ig-rating-btn:focus-visible,
.ig-verdict-btn:focus-visible,
.ig-model-add:focus-visible,
.ig-summary-clear:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}

.ig-back-icon {
  font-size: 16px;
  line-height: 14px;
  margin-top: -2px;
}

/* ── 记录卡：主数字 + 发丝线分组 ─────────────────────────────────── */
/*
 * 旧版顶部是三格等重的灰卡片（模型耗时 / 轮次 / 工具调用）。三个数都重要，
 * 于是三个都不重要。现在只有一个主数字，其余降成一行元信息 ——
 * 「你这次坐了多久」是第一眼该看到的。
 */
.ig-card-hero {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 2px;
}

.ig-card-hero-value {
  font-size: 26px;
  line-height: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ig-ink);
}

.ig-card-hero-unit {
  font-size: 14px;
  line-height: 20px;
  color: var(--ig-muted);
}

.ig-card-hero-meta {
  margin-left: auto;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--ig-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/*
 * 时段标签不做成胶囊：它们是记录上的注脚，不是可以点的筛选器。
 * 旧版给每个标签一个灰底圆角，视觉重量和主数字一样，抢戏。
 */
.ig-card-stop {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ig-warm-ink);
}

.ig-card-tags {
  margin: 2px 0 0;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--ig-muted);
}

.ig-card-section {
  display: flex;
  flex-direction: column;
  gap: var(--ig-gap-sm);
  min-width: 0;
  padding-top: var(--ig-gap-md);
  border-top: 0.5px solid var(--ig-hairline);
}

.ig-card-label {
  font-size: 11.5px;
  line-height: 16px;
  font-weight: 500;
  color: var(--ig-muted);
  margin: 0;
}

/*
 * 主操作条固定在面板底部。
 *
 * 这一条是排版事故的修法：旧版记录卡内容 647px、容器上限 558px，被裁掉的
 * 正好是「收藏这张记录」，而滚动条又被藏了 —— 用户看到的是一个没有出口的卡片。
 * 现在无论内容多长，主操作都在视口内。
 */
.ig-card-actions {
  position: sticky;
  bottom: -18px;
  margin: 0 -18px -18px;
  padding: 10px 18px 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ig-gap-sm);
  background: var(--dsw-alias-bg-layer-2);
  /* 一条发丝线：内容滚到底下时，它是「边界」而不是「被裁掉」。 */
  border-top: 0.5px solid var(--ig-hairline);
}

/* ── 说明文字 ───────────────────────────────────────────────────── */
.ig-note {
  font-size: 12.5px;
  line-height: 18px;
  color: var(--ig-muted);
  margin: 0;
}

.ig-note--warn {
  color: var(--ig-warm-ink);
}

/* 引用：左侧一道发丝线明确「这是你说过的话，不是本插件的数据」。 */
.ig-note--quote {
  border-left: 1.5px solid var(--ig-warm-line);
  padding-left: 9px;
  color: var(--ig-muted);
  margin: 2px 0 0;
}

/* ── 按钮 ───────────────────────────────────────────────────────── */
.ig-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ig-gap-sm);
  align-items: center;
}

.ig-btn {
  font: inherit;
  font-size: 12.5px;
  line-height: 20px;
  padding: 5px 12px;
  border-radius: var(--dsw-radius-sm);
  border: 0.5px solid var(--ig-hairline);
  background: transparent;
  color: var(--ig-ink);
  cursor: pointer;
}

.ig-btn:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.ig-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

/* 主按钮走宿主主按钮：浅色黑底白字、深色白底黑字，不再自造一个蓝。 */
.ig-btn--primary {
  background: var(--ig-action);
  border-color: transparent;
  color: var(--ig-action-ink);
  font-weight: 500;
}

.ig-btn--primary:hover:not(:disabled) {
  background: var(--ig-action-hover);
}

.ig-btn--quiet {
  background: transparent;
}

.ig-btn--danger {
  color: var(--ig-bad-ink);
}

/* ── 画廊 ───────────────────────────────────────────────────────── */
.ig-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * 每行不再有自己的灰底：它们本来就是同一个列表的成员，
 * 灰底只是把「列表」切成一堆卡片。改成一排发丝线。
 */
.ig-row {
  display: flex;
  align-items: flex-start;
  gap: var(--ig-gap-md);
  padding: 10px 0;
}

.ig-row + .ig-row {
  border-top: 0.5px solid var(--ig-hairline);
}

.ig-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ig-row-title {
  font-size: 14px;
  line-height: 19px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-row-sub {
  font-size: 11.5px;
  line-height: 17px;
  color: var(--ig-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-row-review {
  flex: none;
  border: 0;
  background: transparent;
  color: var(--ig-muted);
  cursor: pointer;
  font: inherit;
  font-size: 11.5px;
  line-height: 16px;
  padding: 2px 6px;
  border-radius: var(--dsw-radius-xs);
}

.ig-row-review:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--ig-ink);
}

.ig-row-remove {
  flex: none;
  border: 0;
  background: transparent;
  color: var(--ig-muted);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  line-height: 16px;
  padding: 2px 6px;
  border-radius: var(--dsw-radius-xs);
}

.ig-row-remove:hover {
  color: var(--ig-bad-ink);
  background: var(--dsw-alias-interactive-bg-hover);
}

/* ── 右上角读数（v5 的圆环 → v16 的暖点）──────────────────────── */
/*
 * ## 为什么不再是圆环
 *
 * 圆环有两个问题，都不是审美问题：
 *   1. 环里那个数字和右边那个数字**是同一个值**（都是 activeMs），
 *      于是收缩态显示「14 14 分钟」；
 *   2. 环天生读作「完成度」。它指向的却是「离休息还有多久」，
 *      每个新用户都要先被解释一遍。
 *
 * ## 现在是什么
 *
 * 一颗会呼吸的暖点 + 一个数字 + 一句关于这个人的话。
 * 呼吸 5 秒一次 = 每分钟 12 次，接近安静坐着时的频率 —— 这是刻意的：
 * 它要像旁边坐着一个人，而不是一个在闪的告警灯。
 *
 * ## 到点为什么反而静止
 *
 * 呼吸是「常态」的语言。真到该提醒的时候，暖点**停止呼吸、定在全亮**，
 * 然后长出卡片。读起来是「它睁眼了」，比闪得更快更让人抬头。
 */
.ig-hud {
  position: absolute;
  top: var(--ig-safe-top, 52px);
  right: 16px;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--ig-gap-sm);
  padding: 5px 13px 5px 10px;
  border-radius: 999px;
  border: 0.5px solid var(--ig-warm-line);
  background: var(--ig-warm-surface);
  color: var(--ig-muted);
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  cursor: pointer;
  animation: ig-hud-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes ig-hud-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 悬停只加深一点点底色，不位移、不放大 —— 角落里的东西不该跳。 */
.ig-hud:hover {
  background: color-mix(in oklab, var(--ig-warm-surface) 88%, var(--dsw-alias-state-warn-primary));
}

.ig-hud-side {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  white-space: nowrap;
}

.ig-hud-time {
  font-size: 14px;
  line-height: 18px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.1px;
  color: var(--ig-ink);
}

.ig-hud-sep {
  color: var(--dsw-alias-label-tertiary);
}

.ig-hud-next {
  font-size: 12.5px;
  line-height: 18px;
  color: var(--ig-muted);
}

/* 提醒/未读时，那一句用暖色文字 —— 对白底的对比度 5.19:1，不再是 2.25:1。 */
.ig-hud-next--alert {
  color: var(--ig-warm-ink);
  font-weight: 500;
}

/*
 * 暖点。
 *
 * 结构：::before 是外圈光晕（呼吸），::after 是实心核（轻微的缩放）。
 * 只动 transform / opacity，不触发 layout / paint。
 *
 * --ig-heat（0..1）由组件按「离下一档提醒还有多远」写入：
 * 越接近休息，核外的光晕铺得越开。它是唯一的「进度」表达 ——
 * 不做成环，就不需要解释。
 */
.ig-ember {
  position: relative;
  flex: none;
  inline-size: 18px;
  block-size: 18px;
  display: inline-grid;
  place-items: center;
}

.ig-ember::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle,
    color-mix(in oklab, var(--ig-warm) 40%, transparent) 0%,
    color-mix(in oklab, var(--ig-warm) 10%, transparent) 46%,
    transparent 70%);
  animation: ig-breathe 5s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

.ig-ember::after {
  content: '';
  inline-size: 7px;
  block-size: 7px;
  border-radius: 50%;
  background: var(--ig-warm);
  box-shadow: 0 0 calc(4px + var(--ig-heat, 0) * 9px) color-mix(in oklab, var(--ig-warm) 55%, transparent);
  animation: ig-breathe-core 5s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

@keyframes ig-breathe {
  0%, 100% { opacity: 0.3; transform: scale(0.88); }
  50%      { opacity: 0.95; transform: scale(1.16); }
}

@keyframes ig-breathe-core {
  0%, 100% { transform: scale(0.94); }
  50%      { transform: scale(1.06); }
}

/* 到点：停止呼吸，定在全亮。 */
.ig-ember--alert::before {
  animation-play-state: paused;
  opacity: 0.95;
  transform: scale(1.1);
}

.ig-ember--alert::after {
  animation-play-state: paused;
  transform: scale(1.05);
}

/* 未读：比常态亮、比提醒态弱 —— 它在等你，但没有在喊。 */
.ig-ember--unread::before {
  animation-play-state: paused;
  opacity: 0.8;
  transform: scale(1.02);
}

.ig-ember--unread::after {
  animation-play-state: paused;
  transform: scale(1);
}

/* 休息中：呼气拉长到 7 秒。这是全文件唯一一处「更慢」的动画。 */
.ig-ember--rest::before {
  animation-duration: 7s;
  opacity: 0.55;
}

/* ── 提醒卡：同一位置长出来的那张小暖卡 ─────────────────────────── */
/*
 * 不再是「给药丸换个颜色」。到点是这次会话里唯一需要**做一件事**的时刻，
 * 所以它长成一张卡：说你坐了多久、给一个可以做的动作、留一个「先记着」。
 *
 * 卡头那一行仍然是按钮（点它 = 看这次任务的账），动作在卡身里 ——
 * 一个东西，两种意图，互不嵌套。
 */
.ig-hud-card {
  position: absolute;
  top: var(--ig-safe-top, 52px);
  right: 16px;
  width: min(316px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: var(--ig-gap-sm);
  padding: 14px 16px 12px;
  border-radius: var(--dsw-radius-lg);
  border: 0.5px solid var(--ig-warm-line);
  background: var(--ig-warm-surface);
  color: var(--ig-ink);
  animation: ig-hud-card-in 0.26s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes ig-hud-card-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.99); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* 卡头：复用收拢态那一行的结构，但去掉自己的胶囊外壳。 */
.ig-hud-card .ig-hud {
  position: static;
  width: 100%;
  /* 卡头仍是按钮（点它看账）：上下各留 2px，别让可点区域只有 22px 高。 */
  padding: 2px 0;
  border: 0;
  background: transparent;
  animation: none;
  text-align: left;
}

.ig-hud-card .ig-hud:hover {
  background: transparent;
}

.ig-hud-card .ig-hud-time {
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.ig-hud-card .ig-hud-next {
  font-size: 12.5px;
}

.ig-hud-card-body {
  margin: 0;
  font-size: 12.5px;
  line-height: 19px;
  color: var(--ig-warm-ink);
}

.ig-hud-card-actions {
  display: flex;
  align-items: center;
  gap: var(--ig-gap-sm);
  margin-top: 2px;
}

/* 倒计时：一个数字，跟着卡片右下角，不跟主文案抢。 */
.ig-hud-count {
  margin-left: auto;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ig-muted);
  font-variant-numeric: tabular-nums;
}

/* 提醒卡里的主按钮：强调，但不使用蓝色 —— 这是「歇一下」，不是提交表单。 */
.ig-hud-card-actions .ig-btn--primary {
  background: var(--ig-action);
  color: var(--ig-action-ink);
}

.ig-hud-card-actions .ig-btn--quiet {
  border-color: var(--ig-warm-line);
  color: var(--ig-warm-ink);
}

/* ── 展开面板 ───────────────────────────────────────────────────── */
.ig-hud-panel {
  position: absolute;
  top: var(--ig-safe-top, 52px);
  right: 16px;
  pointer-events: auto;
  width: min(340px, calc(100vw - 32px));
  max-height: min(78vh, 640px);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: var(--ig-gap-md);
  padding: 16px;
  border-radius: var(--dsw-radius-lg);
  border: 0.5px solid var(--ig-hairline);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--ig-ink);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  animation: ig-hud-panel-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes ig-hud-panel-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.ig-hud-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.ig-hud-head-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.ig-hud-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: -0.01em;
  /* 任务名常常是用户第一句话（最长 60 字）。给它两行，再长就截断 ——
     否则它会把下面三个区整体推走，面板一开就看不到数字。 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

/* 状态区：一个主数字 + 一行元信息。两者贴在一起，是一个整体。 */
.ig-hud-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.ig-hud-hero {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}

.ig-hud-hero-value {
  font-size: 26px;
  line-height: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ig-ink);
}

.ig-hud-hero-unit {
  font-size: 12.5px;
  line-height: 18px;
  color: var(--ig-muted);
}

/* 「跟谁一起坐了这么久」靠右，弱化：它回答的是上下文，不是主问题。 */
.ig-hud-hero-model {
  margin-left: auto;
  max-width: 55%;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--ig-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-hud-meta {
  margin: 0;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ig-muted);
  font-variant-numeric: tabular-nums;
}

.ig-hud-collapse {
  flex: none;
  border: 0;
  background: transparent;
  color: var(--ig-muted);
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  line-height: 18px;
  padding: 1px 7px;
  border-radius: var(--dsw-radius-xs);
}

.ig-hud-collapse:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--ig-ink);
}

/*
 * 提醒条：面板已经开着时收到提醒，这里是唯一的「标为已看」入口，
 * 所以它必须可点 —— 一行说明文字做不到这件事。
 */
.ig-hud-banner {
  display: flex;
  align-items: center;
  gap: var(--ig-gap-sm);
  width: 100%;
  box-sizing: border-box;
  border: 0.5px solid var(--ig-warm-line);
  font: inherit;
  font-size: 12.5px;
  line-height: 17px;
  color: var(--ig-warm-ink);
  background: var(--ig-warm-surface);
  margin: 0;
  padding: 7px 10px;
  border-radius: var(--dsw-radius-sm);
  cursor: pointer;
  text-align: left;
}

.ig-hud-banner:hover {
  filter: brightness(0.98);
}

.ig-hud-banner-text {
  flex: 1;
  min-width: 0;
}

.ig-hud-banner-action {
  flex: none;
  font-size: 11.5px;
  color: var(--ig-muted);
}

/*
 * 占比条：整条按模型分段，flex-grow 承担比例。
 * 4px 高 —— 再高就成了图表，而这里只需要「大致比例」的感觉。
 */
.ig-hud-bar {
  display: flex;
  gap: 1px;
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--dsw-alias-interactive-bg-hover);
}

.ig-hud-seg {
  background: var(--ig-warm);
  border-radius: 1px;
  min-width: 2px;
  height: 100%;
}

/* 共享占比（汇总页每个模型一行）：段按宽度算，轨道露出来才有「占比」可言。 */
.ig-hud-bar--share .ig-hud-seg {
  flex: none;
}

/*
 * 多模型用同一支暖色的三档深浅区分 —— 比彩虹好读，也不会把「暖」打散。
 * 模型行左侧的色点（.ig-hud-tone）用同一组值，条和行才对应得起来。
 */
.ig-hud-seg:nth-child(1),
.ig-hud-row:nth-child(1) .ig-hud-tone {
  background: var(--ig-warm);
}

.ig-hud-seg:nth-child(2),
.ig-hud-row:nth-child(2) .ig-hud-tone {
  background: var(--ig-warm-ink);
}

.ig-hud-seg:nth-child(3),
.ig-hud-row:nth-child(3) .ig-hud-tone {
  background: color-mix(in oklab, var(--ig-warm-ink) 55%, var(--ig-ink));
}

/*
 * 区段分隔。展开面板只有三段：状态（无分隔） / 明细 / 判断+动作。
 * 用发丝线而不是空白，是因为三段的「重量」不同 —— 留白分不开，线可以。
 */
.ig-hud-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 0.5px solid var(--ig-hairline);
  min-width: 0;
}

/* 占比条与模型列表是同一件事的两种读法：贴在一起，中间只留 8px。 */
.ig-hud-models {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.ig-hud-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-hud-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  min-width: 0;
}

.ig-hud-row + .ig-hud-row {
  border-top: 0.5px solid var(--ig-hairline);
}

.ig-hud-row-head {
  display: flex;
  align-items: baseline;
  gap: var(--ig-gap-sm);
  min-width: 0;
}

/* 与占比条同色的 6px 点：把「哪一段是哪个模型」这条对应关系画出来。 */
.ig-hud-tone {
  flex: none;
  align-self: center;
  inline-size: 6px;
  block-size: 6px;
  border-radius: 50%;
  background: var(--ig-warm);
}

.ig-hud-row-model {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 19px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-hud-row-time {
  font-size: 14px;
  line-height: 19px;
  font-variant-numeric: tabular-nums;
  color: var(--ig-ink);
}

.ig-hud-row-sub {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ig-muted);
}

/* 评分是「你」的判断，用暖色；它后面的轮次/步数是客观计数，保持灰。 */
.ig-hud-row-rating {
  color: var(--ig-warm-ink);
  font-variant-numeric: tabular-nums;
}

.ig-hud-verdict {
  font-size: 12.5px;
  line-height: 18px;
  color: var(--ig-muted);
  margin: 0;
}

.ig-hud-verdict-value {
  color: var(--ig-warm-ink);
  font-weight: 500;
}

/* ── 逐模型明细 ─────────────────────────────────────────────────── */
.ig-models {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-model {
  display: flex;
  flex-direction: column;
  gap: var(--ig-gap-xs);
  padding: 10px 0;
  min-width: 0;
}

/* 模型之间用发丝线而不是「几张小卡片」：它们属于同一个列表。 */
.ig-model + .ig-model {
  border-top: 0.5px solid var(--ig-hairline);
}

.ig-model-head {
  display: flex;
  align-items: baseline;
  gap: var(--ig-gap-sm);
  min-width: 0;
}

.ig-model-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 19px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * provider 后缀：同一个模型可以经不同线路接入（key 不同、分别记账），
 * 只显示模型名会让列表中两行完全一样。
 */
.ig-model-provider {
  font-size: 11.5px;
  font-weight: 400;
  color: var(--dsw-alias-label-tertiary);
}

.ig-model-time {
  font-size: 14px;
  line-height: 19px;
  font-variant-numeric: tabular-nums;
  color: var(--ig-ink);
}

/* 自评分：不是星星而是「4.2 分」的数字。星级无法表达 4.2。 */
.ig-model-rating {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ig-warm-ink);
  flex: none;
  font-variant-numeric: tabular-nums;
}

.ig-model-sub {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ig-muted);
}

.ig-model-note {
  display: flex;
  flex-direction: column;
  gap: var(--ig-gap-sm);
  padding-top: var(--ig-gap-xs);
}

/* 五档评分：等宽平铺。「顺手 / 极其顺手」在用户心里有稳定含义，「4 星」没有。 */
.ig-rating {
  display: flex;
  gap: var(--ig-gap-xs);
  flex-wrap: wrap;
}

.ig-rating-btn {
  font: inherit;
  font-size: 11.5px;
  line-height: 16px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 0.5px solid var(--ig-hairline);
  background: transparent;
  color: var(--ig-muted);
  cursor: pointer;
}

.ig-rating-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--ig-ink);
}

.ig-textarea {
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  padding: 6px 8px;
  border-radius: var(--dsw-radius-sm);
  border: 0.5px solid var(--ig-hairline);
  background: var(--dsw-alias-bg-base);
  color: var(--ig-ink);
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}

.ig-textarea::placeholder {
  color: var(--ig-muted);
}

.ig-textarea:focus-visible,
.ig-input:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}

.ig-model-add {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--ig-muted);
  cursor: pointer;
  font: inherit;
  font-size: 11.5px;
  line-height: 16px;
  padding: 2px 0;
  border-radius: var(--dsw-radius-xs);
}

.ig-model-add:hover {
  color: var(--ig-warm-ink);
}

/* ── 目的确认 ───────────────────────────────────────────────────── */
.ig-verdict {
  display: flex;
  gap: 6px;
}

/* 三档等宽：它们是同一个问题的三个答案，不该有主次。 */
.ig-verdict-btn {
  flex: 1;
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  padding: 5px 0;
  border-radius: var(--dsw-radius-sm);
  border: 0.5px solid var(--ig-hairline);
  background: transparent;
  color: var(--ig-muted);
  cursor: pointer;
}

.ig-verdict-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--ig-ink);
}

.ig-verdict-btn--on {
  background: var(--ig-action);
  border-color: transparent;
  color: var(--ig-action-ink);
}

/* 画廊行里的达成标记：三档各有语义色，但都用补偿过的「字色」变体。 */
.ig-verdict-dot {
  align-self: flex-start;
  font-size: 11.5px;
  line-height: 16px;
  padding: 0;
  flex: none;
}

.ig-verdict-dot--yes {
  color: var(--ig-ok-ink);
}

.ig-verdict-dot--partial {
  color: var(--ig-warm-ink);
}

.ig-verdict-dot--no {
  color: var(--ig-bad-ink);
}

/* ── 汇总面板 ───────────────────────────────────────────────────── */
.ig-panel--wide {
  width: min(400px, calc(100vw - 32px));
}

/* 汇总顶部的三格：和记录卡同一个语言 —— 一行数字，没有灰底卡片。 */
.ig-metrics {
  display: flex;
  gap: 24px;
  margin: 0;
}

.ig-metric {
  display: flex;
  align-items: baseline;
  gap: var(--ig-gap-xs);
  min-width: 0;
}

.ig-metric dt {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ig-muted);
  white-space: nowrap;
}

.ig-metric dd {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.ig-summary-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-summary-row {
  display: flex;
  flex-direction: column;
  gap: var(--ig-gap-sm);
  padding: 12px 0;
  min-width: 0;
}

.ig-summary-row + .ig-summary-row {
  border-top: 0.5px solid var(--ig-hairline);
}

.ig-summary-row-head {
  display: flex;
  align-items: baseline;
  gap: var(--ig-gap-sm);
  min-width: 0;
}

.ig-summary-row-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-summary-row-time {
  font-size: 12.5px;
  line-height: 19px;
  font-variant-numeric: tabular-nums;
  color: var(--ig-muted);
}

/* 客观指标三格：标签在上、值在下，靠间距分组，不再各自一块灰底。 */
.ig-summary-figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--ig-gap-sm);
}

.ig-summary-figures > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.ig-summary-figures dt {
  font-size: 11.5px;
  line-height: 15px;
  color: var(--ig-muted);
  white-space: nowrap;
}

.ig-summary-figures dd {
  font-size: 14px;
  line-height: 18px;
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.ig-summary-notes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-summary-notes li {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 9px;
  border-left: 1.5px solid var(--ig-warm-line);
  min-width: 0;
}

.ig-summary-note-task {
  font-size: 11.5px;
  line-height: 16px;
  color: var(--ig-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-summary-note-text {
  font-size: 12.5px;
  line-height: 17px;
  color: var(--ig-ink);
}

/*
 * 「长跑有没有用」：三行两列的对齐小表。
 *
 * 不做成条形图：汇总页已经有一条模型占比条，再来一组条会把「看数字」变成
 * 「看柱子」。这里要的是三行能竖着比，对齐就够。
 */
.ig-rhythm {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ig-rhythm-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 44px;
  align-items: baseline;
  gap: 12px;
  padding: 6px 0;
  font-size: 12.5px;
  line-height: 18px;
}

.ig-rhythm-row + .ig-rhythm-row {
  border-top: 0.5px solid var(--ig-hairline);
}

.ig-rhythm-label {
  color: var(--ig-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-rhythm-count {
  color: var(--ig-muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.ig-rhythm-rate {
  text-align: right;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--ig-ink);
}

/* 清除备注：低干扰的次级动作，靠左且弱色，不与主读数抢注意力。 */
.ig-summary-clear {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--ig-muted);
  cursor: pointer;
  font: inherit;
  font-size: 11.5px;
  line-height: 16px;
  padding: 2px 0;
}

.ig-summary-clear:hover {
  color: var(--ig-bad-ink);
}

/* ── 设置页 ─────────────────────────────────────────────────────── */
/*
 * 独立成一页之后，用宿主设置页的版式（对照 packages/client/ui-settings-plugins）：
 * max-width 760、标题 18/600、说明 13、行是「标题+说明 在左 / 控件 在右」，
 * 行间 0.5px 发丝线。
 *
 * 为什么不再用「标签在上、输入框在下」的竖排字段：那是表单的语法，不是设置项的
 * 语法。宿主每一行都是「一句话说清这是什么，右边是它的值」——跟着它，整页才像
 * 设置，而不是一张插件的配置表单。
 */
.ig-settings-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 760px;
  color: var(--ig-ink);
}

.ig-settings-page-title {
  margin: 0;
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
}

.ig-settings-page-intro {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ig-muted);
}

.ig-settings-rows {
  display: flex;
  flex-direction: column;
  margin-top: 4px;
}

.ig-settings-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}

.ig-settings-row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ig-settings-row-title {
  font-size: 14px;
  line-height: 22px;
}

.ig-settings-row-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--ig-muted);
}

.ig-settings-row-control {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  /* 与左侧标题的第一行视觉对齐（标题行高 22、控件高 18–36）。 */
  padding-top: 2px;
}

/* 危险操作：标题用错误色，按钮自己再红一次 —— 两处都在说同一件事。 */
.ig-settings-row--danger .ig-settings-row-title {
  color: var(--ig-bad-ink);
}

/*
 * 输入框：宿主设置里的控件是 36px 高、module-platform 底、无边框
 * （见 ClientSettings 的 stepper）。这里对齐它的尺寸，焦点时才现行。
 */
.ig-input {
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--dsw-radius-md);
  border: 0.5px solid transparent;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--ig-ink);
  box-sizing: border-box;
  font-variant-numeric: tabular-nums;
}

.ig-input:hover {
  border-color: var(--ig-hairline);
}

.ig-input--invalid {
  border-color: var(--ig-bad);
}

/*
 * 开关：宿主设置里的布尔项就是原生复选框，不另造一个 switch ——
 * 系统控件的语义、键盘、无障碍都是白送的。
 */
.ig-switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex: none;
}

.ig-switch input {
  inline-size: 18px;
  block-size: 18px;
  margin: 0;
  accent-color: var(--dsw-alias-state-business-primary);
  cursor: pointer;
}

/* 记录卡头部的任务名：两行截断，是定位信息，不该比标题重。 */
.ig-task {
  font-size: 12.5px;
  line-height: 18px;
  color: var(--ig-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

/* ── 动效偏好 ───────────────────────────────────────────────────── */
/*
 * 每一个动画都要在这里有替代：包括那个 2.4s 的旧呼吸环 ——
 * 它曾经漏在这里，于是开着「减少动态效果」的用户会看到一个永远在闪的环。
 * 现在暖点直接停在「呼气结束」的静息位，仍然能看出状态，但不动。
 */
@media (prefers-reduced-motion: reduce) {
  .ig-hud,
  .ig-hud-card,
  .ig-hud-panel,
  .ig-panel,
  .ig-panel--closing {
    animation: none;
  }

  .ig-ember::before,
  .ig-ember::after {
    animation: none;
  }

  .ig-ember::before {
    opacity: 0.75;
    transform: none;
  }

  .ig-ember::after {
    transform: none;
  }
}
`;
