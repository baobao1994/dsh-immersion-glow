/**
 * 从 ConversationSnapshot 推导结构性计数（PRD v0.2 §4.3 / ADR-003）。
 *
 * 为什么需要这个文件：`shell.overlay` 的 standardProps 只有 useSessions /
 * useWorkspaces（会话**列表**），拿不到当前会话内容；`useSession:
 * SnapshotSelectorHook<ConversationSnapshot>` 只在 session / session-maybe scope
 * 注入。所以光带留 root、另挂一个渲染 null 的探针在 session scope，把计数泵回
 * root store。本文件是探针里唯一有逻辑的部分。
 *
 * ## 隐私边界
 * 只读结构与计数，**绝不**读 content 正文、不拼接消息文本、不落任何消息内容。
 * 见 PRD §3.3 与 §1.2 零网络约束。
 *
 * ## 数据源（ADR-123 起以 chat 快照为主路径）
 *
 * 探针在 session 作用域能拿到 `useChat`（ui-chat 经 `uiSession.provide({
 * hooks: ['chat'] })` 注入）。chat 快照由 ChatSnapshotBuilder.snapshot() 造出：
 *
 *     { order, nodes: MutableChatNodeStore, locations, navigation, timeline, legacy }
 *
 * 计数只读 `legacy`（LegacySliceBuilder.snapshot()）：
 *
 *     legacy = { nodes: finalized[], turnTimings, turnEnds, partial, runningCalls }
 *
 * ⚠ chat 快照**没有** `sessionId` / `hasMore` —— 这两个仍在 useSession 的
 * ConversationSnapshot 上，由探针读出后经第二个参数补给（见 deriveMetrics）。
 *
 * 历史路径保留为兜底：探针旧版读的是 ConversationSnapshot，其顶层 nodes /
 * turnEnds 是"Legacy top-level compatibility field"镜像（0.2.0-rc.2 里不被
 * 填充，真数据在 `snapshot.chat.legacy`）。取值顺序统一为
 * 「legacy 顶层 → chat.legacy → 顶层镜像」，三处任一有数据即用，全空才报 0。
 *
 * 字段来源（本机 0.2.0-rc.2 实测）：
 *   chat.legacy.nodes        ConversationNode[]   含 assistant / tool-result
 *   chat.legacy.turnEnds     Map<turn, seq>       已完成轮次
 *   chat.legacy.runningCalls RunningToolCall[]    含嵌套 subCalls
 *   assistant.blocks[]       { kind:'tool-call', callId, name, argsRaw }
 *   assistant.turn           number               窗口内没有 turn/end 时兜底
 *   snapshot.hasMore         boolean              历史窗口是否还有更早的
 *
 * ## 窗口陷阱
 * `hasMore: true` 表示当前只加载了最近一段历史（向上还有分页）。此时 turns /
 * toolCalls **只覆盖已加载窗口**，不能当作全会话总量。必须把 truncated 透出到
 * UI，由文案说明口径 —— 否则读数会骗人。
 *
 * @module src/client/metrics
 */

/**
 * 取 Map 或普通对象的键集合，避免调用方传进来的是被 JSON 化过的普通对象。
 * @param value - 可能为 Map / 普通对象 / undefined。
 * @returns 键数组。
 */
function keysOf(value) {
  if (value === null || value === undefined) return [];
  if (typeof value.keys === 'function') {
    try {
      return Array.from(value.keys());
    } catch (_error) {
      return [];
    }
  }
  if (typeof value === 'object') return Object.keys(value);
  return [];
}

/**
 * 安全地读一个嵌套属性，全程不抛错。
 * @param value - 起点。
 * @param path - 属性名数组。
 * @returns 命中的值或 undefined。
 */
function at(value, path) {
  let cursor = value;
  for (const key of path) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

/**
 * 找出节点数组真正的所在。
 *
 * chat 快照的 legacy 在顶层；ConversationSnapshot 的真数据在 chat.legacy，
 * 顶层只有不被填充的兼容镜像。按可信度依次取第一个非空数组。
 * @param snapshot - chat 快照或 ConversationSnapshot。
 * @returns 节点数组。
 */
function resolveNodes(snapshot) {
  const fromLegacy = at(snapshot, ['legacy', 'nodes']);
  if (Array.isArray(fromLegacy) && fromLegacy.length > 0) return fromLegacy;
  const fromChat = at(snapshot, ['chat', 'legacy', 'nodes']);
  if (Array.isArray(fromChat) && fromChat.length > 0) return fromChat;
  const fromTop = at(snapshot, ['nodes']);
  if (Array.isArray(fromTop) && fromTop.length > 0) return fromTop;
  return [];
}

/**
 * 找出 turnEnds 真正的所在（同 resolveNodes 策略）。
 * @param snapshot - chat 快照或 ConversationSnapshot。
 * @returns Map 或普通对象。
 */
function resolveTurnEnds(snapshot) {
  const fromLegacy = at(snapshot, ['legacy', 'turnEnds']);
  if (keysOf(fromLegacy).length > 0) return fromLegacy;
  const fromChat = at(snapshot, ['chat', 'legacy', 'turnEnds']);
  if (keysOf(fromChat).length > 0) return fromChat;
  return at(snapshot, ['turnEnds']);
}

/**
 * 从一个 assistant 消息节点的 blocks 里收集 tool-call 的 callId，
 * 并返回该节点的 turn 号（用于 turnEnds 缺失时兜底数轮次）。
 * @param node - 可能为任意节点。
 * @param sink - 收集器。
 * @returns turn 号，或 null。
 */
function collectFromAssistantBlocks(node, sink) {
  const blocks = node === null || node === undefined ? undefined : node.blocks;
  if (Array.isArray(blocks)) {
    for (const block of blocks) {
      if (block === null || typeof block !== 'object') continue;
      if (block.kind !== 'tool-call') continue;
      if (typeof block.callId === 'string') sink.add(block.callId);
    }
  }
  return Number.isFinite(node === null || node === undefined ? NaN : node.turn) ? node.turn : null;
}

/**
 * 递归收集一个 running call 及其子调用的 callId。
 *
 * subCalls 是嵌套结构（RunningToolCall | ToolResultNode），必须递归，
 * 否则子代理/并行工具调用会被漏掉。
 *
 * @param call - RunningToolCall 或 ToolResultNode。
 * @param sink - 收集器。
 * @param depth - 递归深度（防御异常数据导致栈溢出）。
 */
function collectRunningCall(call, sink, depth) {
  if (depth > 12) return;
  if (call === null || typeof call !== 'object') return;
  if (typeof call.callId === 'string') sink.add(call.callId);
  const subCalls = call.subCalls;
  if (!Array.isArray(subCalls)) return;
  for (const child of subCalls) collectRunningCall(child, sink, depth + 1);
}

/**
 * 计算「窗口内」的轮次与工具调用数。
 *
 * 永不抛错：任何字段缺失或类型异常都退化为 0，并把 degraded 置 true，
 * 让 UI 显示「数据暂不可用」而不是让插槽崩溃。
 *
 * @param snapshot - chat 快照（preferred：legacy 在顶层）或 ConversationSnapshot
 *   （兜底：真数据在 chat.legacy）。可能为 undefined（无会话）。
 * @param fallbacks - 可选补给：chat 快照上没有的字段从这里拿。
 * @param fallbacks.sessionId - 当前会话 id（来自 useSession 的 props）。
 * @param fallbacks.hasMore - 历史窗口是否还有更早的（来自 useSession）。
 * @returns {{ sessionId, turns, toolCalls, truncated, degraded }}
 */
function deriveMetrics(snapshot, fallbacks) {
  /** 缺数据时的统一降级结果。 */
  const degradedResult = {
    sessionId: null,
    turns: 0,
    toolCalls: 0,
    truncated: false,
    degraded: true,
  };

  if (snapshot === null || typeof snapshot !== 'object') return degradedResult;

  try {
    // sessionId / hasMore 优先用调用方补给（chat 快照上没有）；直接读快照仅是
    // 兼容 ConversationSnapshot 的旧路径。
    const overrides = fallbacks === null || typeof fallbacks !== 'object' ? {} : fallbacks;
    const sessionId =
      typeof overrides.sessionId === 'string' && overrides.sessionId.length > 0
        ? overrides.sessionId
        : typeof snapshot.sessionId === 'string'
          ? snapshot.sessionId
          : null;

    // ── 轮次：turnEnds 的最大键 = 已完成的最后一轮。
    let turns = 0;
    for (const key of keysOf(resolveTurnEnds(snapshot))) {
      const turn = Number(key);
      if (Number.isFinite(turn) && turn > turns) turns = turn;
    }

    // ── 工具调用：三条来源合并去重，同时记录节点上的最大 turn 号。
    const callIds = new Set();
    const nodes = resolveNodes(snapshot);
    let maxTurnFromNodes = 0;

    for (const node of nodes) {
      if (node === null || typeof node !== 'object') continue;
      if (node.kind === 'assistant') {
        const turn = collectFromAssistantBlocks(node, callIds);
        if (turn !== null && turn > maxTurnFromNodes) maxTurnFromNodes = turn;
      } else if (node.kind === 'tool-result' && typeof node.callId === 'string') {
        callIds.add(node.callId);
      }
    }

    // turnEnds 为空（窗口内没有 turn/end 事件）时，用节点上的 turn 号兜底。
    if (turns === 0) turns = maxTurnFromNodes;

    // 进行中的调用：chat 快照顶层 legacy → ConversationSnapshot 兼容路径。
    const runningLegacy = at(snapshot, ['legacy', 'runningCalls']);
    const runningChat = at(snapshot, ['chat', 'legacy', 'runningCalls']);
    const runningTop = at(snapshot, ['runningCalls']);
    const running = [runningLegacy, runningChat, runningTop].find(
      (candidate) => Array.isArray(candidate) && candidate.length > 0,
    );
    if (Array.isArray(running)) {
      for (const call of running) collectRunningCall(call, callIds, 0);
    }

    // truncated：补给优先，其次旧路径的顶层 hasMore。
    const truncated =
      overrides.hasMore === true || (overrides.hasMore === undefined && snapshot.hasMore === true);

    // 有 sessionId 但一个计数都没有，且没有任何节点 —— 更像「还没数据」而非
    // 「降级」。真正的降级由上面 try/catch 兜住。
    return {
      sessionId,
      turns,
      toolCalls: callIds.size,
      truncated,
      degraded: false,
    };
  } catch (error) {
    // 防御性兜底：绝不让探针把插槽打崩（守则：字段缺失友好降级、不抛异常）。
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[immersion-glow] 指标推导失败，已降级：', error);
    }
    return degradedResult;
  }
}

/**
 * 判断「模型此刻是否正在回答」。
 *
 * 供计时器使用（见 timing.tick 的 `busy` 语义）：模型生成中或工具调用进行中时，
 * 这段等待也算沉浸时长，不应因用户不操作而冻结。
 *
 * 判据两根（任一成立即视为忙）：
 *   1. `legacy.partial` 非空 —— 正在流式产出本轮 assistant 消息；
 *   2. `legacy.runningCalls` 非空数组 —— 有工具调用（含子代理/并行）在跑。
 *
 * 取值沿用 deriveMetrics 的兼容策略（legacy 顶层 → chat.legacy → 顶层镜像），
 * 形状一变只改一处。不抛错：任何字段缺失都当「不在忙」，宁可不计，也不误报。
 *
 * @param snapshot - chat 快照或 ConversationSnapshot。
 * @returns {boolean} 是否正在回答。
 */
function isModelBusy(snapshot) {
  if (snapshot === null || typeof snapshot !== 'object') return false;
  try {
    // 直接看 snapshot.legacy，其次 chat.legacy，再次顶层兼容镜像。
    const legacy =
      snapshot.legacy !== null && typeof snapshot.legacy === 'object'
        ? snapshot.legacy
        : null;
    const chatLegacy =
      snapshot.chat !== null && typeof snapshot.chat === 'object' &&
      snapshot.chat.legacy !== null && typeof snapshot.chat.legacy === 'object'
        ? snapshot.chat.legacy
        : null;
    const topRunning = snapshot.runningCalls;

    const running = [legacy, chatLegacy]
      .map((block) => (block === null ? undefined : block.runningCalls))
      .find((value) => Array.isArray(value) && value.length > 0);
    if (running !== undefined || (Array.isArray(topRunning) && topRunning.length > 0)) {
      return true;
    }

    // partial：仍是 in-progress 的 assistant 节点即代表正在生成。
    for (const block of [legacy, chatLegacy]) {
      if (block !== null && block.partial !== null && block.partial !== undefined) return true;
    }
    return false;
  } catch (_error) {
    return false;
  }
}

/**
 * 判断两份指标是否等价，供 selector 做浅比较以抑制无意义重渲染。
 * @param a - 指标。
 * @param b - 指标。
 * @returns 是否等价。
 */
function metricsEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  return (
    a.sessionId === b.sessionId &&
    a.turns === b.turns &&
    a.toolCalls === b.toolCalls &&
    a.truncated === b.truncated &&
    a.degraded === b.degraded
  );
}
