/**
 * 会话探针（PRD §4.3 / ADR-003；ADR-123 改读 chat 快照）。
 *
 * 挂在 `conversation.input.left`（kind: list, scope: session；已核实 occupants
 * 为空，是干净的追加位）。这个插槽的 standard props 里有
 * `useSession: SnapshotSelectorHook<ConversationSnapshot>` 与 `sessionId` ——
 * 那正是 root scope 拿不到的。
 *
 * ## 计数数据源（ADR-123，实测踩坑记录）
 *
 * 第一版读 `useSession`（ConversationSnapshot）推计数，结果轮次/工具调用恒为
 * 0：那份快照只有 pendingSubmissions / running / openState / hasMore 这类
 * **控制字段**，根本没有 nodes。真数据在 chat 快照里 —— ui-chat 经
 * `ctx.uiSession.provide({ hooks: ['chat'] })` 注入的 `useChat`，官方
 * StatsPills 就是这么读的：
 *
 *     const settledNodes = useChat((s) => s.legacy.nodes);
 *
 * chat 快照形状（ChatSnapshotBuilder.snapshot()，0.2.0-rc.2 逐行核实）：
 *
 *     { order, nodes: MutableChatNodeStore, locations, navigation, timeline,
 *       legacy: { nodes, turnTimings, turnEnds, partial, runningCalls } }
 *
 * ⚠ 它没有 sessionId / hasMore —— 这两个仍从 useSession 补给
 * （deriveMetrics 的第二个参数）。
 *
 * 职责只有一件：把结构性计数泵回 root store。默认渲染 null。
 *
 * 为什么返回 null 是安全的：list 型插槽外层是 `display: contents` 锚点，返回
 * null 不占位、不报错；崩溃边界只捕获 render 抛错，而本组件 render 永不抛错
 * （推导失败在 metrics.js 里已降级）。
 *
 * 隐私：只读 turnEnds 的键、nodes 的 kind、callId。绝不触碰 content 正文。
 *
 * @module src/client/probe
 */

/**
 * 会话探针组件。
 *
 * hook 调用顺序固定（useChat → useSession → useRef → useEffect），不受开关
 * 影响，因此打开/关闭常驻计时也不会改变 hook 数量。
 *
 * @param props - { React, t, useChat, useSession, useImmersionGlow, actions,
 *   durationText, showInlineTimer, sessionId }
 * @returns React 元素或 null。
 */
function SessionProbe(props) {
  const {
    React,
    t,
    useChat,
    useSession,
    useImmersionGlow,
    actions,
    durationText,
    showInlineTimer,
    sessionId,
  } = props;
  const h = React.createElement;

  // ── 数据源守卫（ADR-123，用户反馈 3）───────────────────────────────
  // useChat 是 ui-chat 注入的 hook；宿主降级或测试环境不传时**必须跳过
  // chat 快照**，绝不能裸调用 —— 裸调用 undefined 直接 ReferenceError，
  // 会顶掉整个输入框插槽。跳过时 metrics 全零且 degraded，探针只渲染
  // null，也不把零计数写回 store（见下方 effect 的 degraded 守卫）。
  const chatSnapshot = typeof useChat === 'function' ? useChat((value) => value) : null;

  // sessionId / hasMore 在 chat 快照上没有，只能来自 useSession 的
  // ConversationSnapshot。hasMore 缺失按 false —— 宁可少一条诚实提示，
  // 也不编造「截断了」。useSession 同样守卫（原因同上）。
  const conversation =
    typeof useSession === 'function' ? useSession((value) => value) : null;
  const hasMore =
    conversation !== null &&
    typeof conversation === 'object' &&
    conversation.hasMore === true;

  const metrics = deriveMetrics(chatSnapshot, { sessionId, hasMore });

  // 只在计数真的变了才写，避免每秒 tick 都触发 root 侧重渲染。
  //
  // 写进**当前会话的分区**（靠 metrics.sessionId 定位），而不是全局单值 ——
  // 这样每个会话各自记住自己的轮次/工具数，切回来还能看到。
  //
  // degraded（useChat 缺失、快照垃圾值）绝不落笔：写进去就是「有会话但
  // 全是 0」的假数据，记录卡会把上一份真实统计顶掉 —— 这正是用户反馈 3
  // 的病灶之一。宁可 store 里留着上一份好的，也不要用零顶掉它。
  const previous = React.useRef(null);
  React.useEffect(() => {
    if (metrics.degraded === true) return;
    if (previous.current !== null && metricsEqual(previous.current, metrics)) return;
    previous.current = metrics;
    const id = metrics.sessionId;
    if (typeof id !== 'string' || id.length === 0) return;
    actions.writeSession({ sessionId: id, metrics, now: Date.now() });
  }, [actions, metrics]);

  // 常驻计时由设置项控制（PRD §4.3「默认关闭，以保持不主动呈现时间的基调」）。
  const enabled = useImmersionGlow((state) => state.settings.enabled);
  if (!enabled || !showInlineTimer) return null;

  // ⚠ 「12 分钟」裸文本读不出是什么统计（用户反馈 1）—— 前面必须带语义标签。
  return h(
    'span',
    {
      className: 'ig-inline-timer',
      'aria-label': t('probe.timerLabel'),
      title: t('probe.timerLabel'),
    },
    t('probe.timer', { duration: durationText }),
  );
}
