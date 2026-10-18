/**
 * 会话探针（PRD §4.3 / ADR-003；ADR-123 改读 chat 快照；v4 再加投影与事件 fold）。
 *
 * 挂在 `conversation.input.left`（kind: list, scope: session；已核实 occupants
 * 为空，是干净的追加位）。这个插槽的 standard props 里有
 * `useSession: SessionSnapshotSelector`、`useChat`、`useProjection` 与
 * `sessionId` —— 那正是 root scope 拿不到的三样东西。
 *
 * ## v4 的变化：探针从「渲染者」彻底变成「数据泵」
 *
 * 旧版这里会在输入框左边画一个常驻计时。本版按用户要求**退役**：时间不再显示
 * 在编辑框附近，而是搬到右上角常驻读数（见 hud.js）。所以本组件现在**永远返回
 * null**，职责收敛为一件：把 session 作用域才有的数据泵回 root store。
 *
 * 为什么值得留一个渲染 null 的组件：root 作用域拿不到 useChat / useProjection /
 * sessionId，这是 slot 协议决定的，不是有组件结构问题。
 *
 * ## 泵三类数据
 *   1. metrics  —— chat 快照里的窗口内结构性计数（轮次 / 工具调用）
 *   2. stats    —— `sessionStats` 投影的 whole-log 墙钟与计数
 *   3. models   —— 从 chat 快照推导的逐模型耗时（见 model-log.js）
 *
 * ## 为什么模型归属要自己 fold
 * `sessionStats` 只有整会话汇总，不按模型拆；`modelSelection` 只有 lastUsed/next，
 * 没有历史。两个投影加起来也答不出「claude-opus 用了 8 分钟」。详见 model-log.js。
 *
 * ## 隐私
 * 任务名取首条 user message 的 text part 并截断到 60 字（见 session-log.js 的
 * 说明）。除此之外绝不读任何正文 —— 不读 assistant 输出、不读 tool-call 的 args。
 *
 * @module src/client/probe
 */

/**
 * 会话探针组件。
 *
 * hook 调用顺序固定，不受开关影响 —— 任何条件分支里增删 hook 都会破坏 React 的
 * 规则，所以这里没有 `if (!enabled) return` 之类的早退。
 *
 * @param props - { React, t, useChat, useSession, useProjection,
 *   useImmersionGlow, actions, sessionId }
 * @returns 恒为 null。
 */
function SessionProbe(props) {
  const { React, useChat, useSession, useProjection, useImmersionGlow, actions, sessionId } = props;

  // ── 数据源守卫 ────────────────────────────────────────────────────
  // 宿主降级或测试环境可能不传这些 hook。**必须守卫**：裸调用 undefined 直接
  // ReferenceError，会顶掉整个输入框插槽（list 型插槽里一个条目抛错，宿主就少
  // 一格，运气更差时整个面板空掉）。
  const chatSnapshot = typeof useChat === 'function' ? useChat((value) => value) : null;
  const conversation =
    typeof useSession === 'function' ? useSession((value) => value) : null;

  const hasMore =
    conversation !== null &&
    typeof conversation === 'object' &&
    conversation.hasMore === true;

  // ── 宿主投影 ──────────────────────────────────────────────────────
  // 三个投影互相独立，缺任何一个都只降级对应的一块，互不影响。
  const readProjection = (key) => {
    if (typeof useProjection !== 'function') return undefined;
    try {
      return useProjection(key);
    } catch (_error) {
      // 投影未注册时部分实现会抛。数据统计是增强项，不该因为它拖垮整个探针。
      return undefined;
    }
  };
  const rawStats = readProjection('sessionStats');
  const rawModel = readProjection('modelSelection');
  const rawTokens = readProjection('tokenUsage');
  // trajectory 携带逐次模型调用的 providerMetadata —— 精确归属的唯一来源。
  const rawTrajectory = readProjection('trajectory');

  const metrics = deriveMetrics(chatSnapshot, { sessionId, hasMore });
  const stats = normalizeSessionStats(rawStats);
  const currentModel = normalizeModelSelection(rawModel);
  const tokens = normalizeTokenUsage(rawTokens);
  const taskName = firstTaskName(chatNodesOf(chatSnapshot));

  // ── 逐模型耗时 ────────────────────────────────────────────────────
  // 从 chat 快照的 assistant 节点推导（每个节点一次模型调用，带 timing）。
  // 为什么不能用宿主投影直接分：sessionStats 只有整会话汇总，不按模型拆；
  // modelSelection 只有 lastUsed/next，没有历史。详见 model-log.js 的文件头。
  const derived = deriveModelEntries({
    nodes: chatNodesOf(chatSnapshot),
    trajectory: rawTrajectory,
    currentModel,
  });
  const models = derived.entries;
  const modelsExact = derived.exact;

  // ── 泵回 root store ───────────────────────────────────────────────
  //
  // 只在真的变了才写。上面每一项每秒都可能拿到新对象，无条件写会把 persist 写爆
  // （实测过：每秒一次 JSON.stringify 整个 state）。
  const previous = React.useRef(null);
  React.useEffect(() => {
    const id = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
    if (id === null) return;

    // metrics 的 degraded 守卫与旧版一致：useChat 缺失时是「还没数据」，不是
    // 「零」。拿零去覆盖上一份真实统计，比停更糟得多。
    const nextMetrics = metrics.degraded === true ? null : metrics;
    const nextStats = stats.available === true ? { ...stats, tokens } : null;

    const snapshotKey = stableKeyOf(nextMetrics);
    const statsKey = stableKeyOf(nextStats);
    const modelsKey = models
      .map((entry) => `${entry.key}:${entry.modelMs}:${entry.steps}`)
      .join(',');
    const nameKey = taskName === null ? '' : taskName;
    const modelKey = currentModel === null ? '' : currentModel.key;

    const last = previous.current;
    if (
      last !== null &&
      last.id === id &&
      last.metricsKey === snapshotKey &&
      last.statsKey === statsKey &&
      last.modelsKey === modelsKey &&
      last.exact === modelsExact &&
      last.nameKey === nameKey &&
      last.modelKey === modelKey
    ) {
      return;
    }
    previous.current = {
      id,
      metricsKey: snapshotKey,
      statsKey,
      modelsKey,
      exact: modelsExact,
      nameKey,
      modelKey,
    };

    const payload = { sessionId: id, now: Date.now() };
    if (nextMetrics !== null) payload.metrics = nextMetrics;
    if (nextStats !== null) payload.stats = nextStats;
    if (taskName !== null) payload.taskName = taskName;
    // models 每次都写：它由 assistant 节点推导，随消息推进而变；没有它就没法
    // 回答「这个模型花了多久」。空数组也要写，否则首次渲染的空会一直停在旧值。
    payload.models = models;
    actions.writeSession(payload);
  }, [actions, metrics, stats, tokens, models, modelsExact, currentModel, taskName, sessionId]);

  // 订阅时把「当前在用哪个模型」记进 store：这是记录卡顶部那行模型名的来源。
  // 它与 models 的区别：这里是「此刻」，models 是「累计归属」。
  React.useEffect(() => {
    const id = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
    if (id === null || currentModel === null) return;
    actions.setSessionModel({ sessionId: id, model: currentModel, now: Date.now() });
  }, [actions, currentModel, sessionId]);

  // store 存在性只用于确认接线正常；本组件不渲染任何东西。
  useImmersionGlow((value) => value.settings.enabled);

  return null;
}

/**
 * 从 chat 快照里取出节点数组（user 节点的任务名在这里）。
 *
 * 复用 metrics.js 的取值顺序（legacy 顶层 → chat.legacy → 顶层镜像），避免两处
 * 各写一套形状探测 —— 形状一变只改一处。
 *
 * @param snapshot - chat 快照。
 * @returns 节点数组（可能为空）。
 */
function chatNodesOf(snapshot) {
  if (snapshot === null || snapshot === undefined || typeof snapshot !== 'object') return [];
  const candidates = [
    snapshot.legacy !== null && typeof snapshot.legacy === 'object'
      ? snapshot.legacy.nodes
      : undefined,
    snapshot.chat !== null && typeof snapshot.chat === 'object' &&
    snapshot.chat.legacy !== null && typeof snapshot.chat.legacy === 'object'
      ? snapshot.chat.legacy.nodes
      : undefined,
    snapshot.nodes,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  return [];
}

/**
 * 把一个对象压成可比较的字符串键，供「变了才写」的浅比较用。
 *
 * 只取本插件关心的标量字段。投影对象每次渲染都是新引用，若直接比引用会永远判定
 * 为「变了」，persist 就会被打爆。
 *
 * @param value - 任意对象或 null。
 * @returns 短字符串。
 */
function stableKeyOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  return [
    value.sessionId ?? '',
    value.turns ?? '',
    value.steps ?? '',
    value.toolCalls ?? '',
    value.llmMs ?? '',
    value.toolMs ?? '',
    value.ttftMs ?? '',
    value.ttftSteps ?? '',
    value.decodeMs ?? '',
    value.decodeTokens ?? '',
    value.truncated === true ? 1 : 0,
    value.degraded === true ? 1 : 0,
    value.available === true ? 1 : 0,
    value.inputTokens ?? '',
    value.outputTokens ?? '',
    value.cacheRead ?? '',
    value.cacheWrite ?? '',
  ].join('|');
}