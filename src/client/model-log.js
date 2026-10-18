/**
 * 模型耗时归属的推导（v4 核心新增）。
 *
 * ## 它回答什么问题
 * 「这次任务里，每个模型各花了多久」—— 记录卡里逐模型列出，汇总面板据此统计
 * 「得心应手的方面」与「偏爱的模型」。
 *
 * ## ⚠ 为什么这里必须从 chat 快照推导，而不是订阅 session 事件
 *
 * 最初的实现是订阅 `session/event`，按 `request/header` 确立当前模型、再用
 * `step/start` / `assistant/message` 划时间窗。**这条路在浏览器插件里不存在**：
 *
 *   - 客户端侧的 `ISessions` / `ISession`（dsh-cordis-client-runner 的类型声明）
 *     只有 `list` / `retain` / `retainInfo`，以及会话对象上的 `prompt` /
 *     `beginSubmission` / `loadOlder` / `rename` / `cancel` 等命令；
 *   - `ctx.on('session/event', …)` 只存在于**宿主半**（主进程）——
 *     `dsh-api-session-controller` 里这么用。浏览器半拿不到；
 *   - `useProjection(key)` 只能**读**已经注册好的投影，不能注册新的 fold。
 *
 * 所以改走 chat 快照。好在快照本身就带齐了推导所需的三样东西：
 *
 *   - assistant 节点带 `usage` 与 `timing: { stepStartTime, firstTokenTime,
 *     completedTime }`（ChatSnapshotBuilder 的 projectAssistant，见 chat 源码）；
 *   - assistant 节点带 `messageId`，而 `turnEnds` 把已完成轮次映射到 seq；
 *   - 轨迹投影 `trajectory` 里的 assistant 记录带
 *     `providerMetadata: { provider, model }`（取自
 *     `event.data.message.source`）。
 *
 * ## 归属规则
 *
 * 每个 assistant 节点是一次模型调用。它属于哪个模型，由 **trajectory 投影**里
 * 与它 `messageId` / seq 对应的那条记录的 `providerMetadata` 决定；
 * 取不到时退回 `modelSelection`（此时只能给出「当前模型」，并在 UI 上标明是
 * 近似值 —— 绝不把近似说成精确）。
 *
 * 时长口径与宿主 `sessionStats` 逐字一致：`completedTime - stepStartTime`，
 * 即「step 开始到该步产出消息」。被中断、没产出消息的步骤不计时长（它在快照里
 * 没有 timing），但会在 `steps` 计数上体现不出来 —— 宁可少算。
 *
 * @module src/client/model-log
 */

/**
 * 造一条空的模型记录。
 * @param key - `provider/model`。
 * @param provider - 提供方。
 * @param model - 模型名。
 * @returns 模型记录。
 */
function emptyModelEntry(key, provider, model) {
  return {
    key,
    provider,
    model,
    /** step 开始到产出消息的墙钟累加（模型净思考时间）。 */
    modelMs: 0,
    /** 完成并产出消息的调用次数。 */
    steps: 0,
    /** 该模型名下的轮次数（按 turn 去重）。 */
    turns: 0,
    /** 最后一次使用的时间戳。 */
    lastUsedAt: 0,
  };
}

/**
 * 从 assistant 节点的 timing 里取净耗时。
 *
 * 口径与宿主 sessionStats 一致：`completedTime - stepStartTime`。
 * 任一字段缺失或非有限即返回 0 —— 被中断的步骤没有 completedTime，
 * 宁可不算，也不猜。
 *
 * @param node - assistant 节点。
 * @returns 毫秒。
 */
function modelMsOf(node) {
  if (node === null || typeof node !== 'object') return 0;
  const timing = node.timing;
  if (timing === null || timing === undefined || typeof timing !== 'object') return 0;
  const start = timing.stepStartTime;
  const end = timing.completedTime;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

/**
 * 找出 chat 快照里的节点数组。
 *
 * 与 probe.js 的 chatNodesOf 同策略（legacy 顶层 → chat.legacy → 顶层镜像），
 * 形状探测只在这里写一次。
 *
 * @param snapshot - chat 快照。
 * @returns 节点数组。
 */
function nodesOf(snapshot) {
  if (snapshot === null || snapshot === undefined || typeof snapshot !== 'object') return [];
  const candidates = [
    snapshot.legacy !== null && typeof snapshot.legacy === 'object' ? snapshot.legacy.nodes : undefined,
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
 * 建一张「消息 id / seq → 模型」的索引表。
 *
 * 来源是 trajectory 快照里的 assistant 记录：它们带 `providerMetadata`
 * （provider + model）与 `resultSeq` / `messageId`，任一能对上就算。
 *
 * 匹配用 **messageId 优先、seq 兜底**：seq 在两种快照里都是单调递增的
 * 稳定标识，而 messageId 只有 assistant 记录与 chat 节点都有时才存在。
 *
 * @param trajectory - `useProjection('trajectory')` 的返回值，任意形状。
 * @returns { byMessage: Map, bySeq: Map, available: boolean }
 */
function buildRouteIndex(trajectory) {
  const byMessage = new Map();
  const bySeq = new Map();
  if (trajectory === null || trajectory === undefined || typeof trajectory !== 'object') {
    return { byMessage, bySeq, available: false };
  }

  const buckets = [
    Array.isArray(trajectory.requests) ? trajectory.requests : null,
    Array.isArray(trajectory.eventNodes) ? trajectory.eventNodes : null,
  ];

  let available = false;
  for (const bucket of buckets) {
    if (bucket === null) continue;
    for (const record of bucket) {
      if (record === null || typeof record !== 'object') continue;
      const meta = record.providerMetadata;
      if (meta === null || typeof meta !== 'object') continue;
      const provider = typeof meta.provider === 'string' ? meta.provider : null;
      const model = typeof meta.model === 'string' ? meta.model : null;
      if (provider === null || model === null || provider.length === 0 || model.length === 0) continue;
      available = true;

      const key = `${provider}/${model}`;
      // assistant 记录上，模型挂在 resultNode.providerMetadata；
      // 这里已经拿到了，只需把它登记到两种索引上。
      const messageId =
        typeof record.messageId === 'string'
          ? record.messageId
          : typeof record.resultNode?.messageId === 'string'
            ? record.resultNode.messageId
            : null;
      if (messageId !== null) byMessage.set(messageId, { key, provider, model });
      const seq = Number.isFinite(record.resultSeq)
        ? record.resultSeq
        : Number.isFinite(record.seq)
          ? record.seq
          : null;
      if (seq !== null) bySeq.set(seq, { key, provider, model });
    }
  }
  return { byMessage, bySeq, available };
}

/**
 * 算出这个会话的逐模型耗时。
 *
 * @param params - 见下。
 * @param params.nodes - chat 快照的节点数组（由 nodesOf 给出）。
 * @param params.trajectory - trajectory 投影快照，任意形状。
 * @param params.currentModel - modelSelection 归一化后的当前模型（可为 null）。
 * @returns { entries, exact } entries 按 modelMs 降序；exact 表示归属是否来自
 *   trajectory（false = 退回近似，UI 需注明）。
 */
function deriveModelEntries(params) {
  const nodes = Array.isArray(params?.nodes) ? params.nodes : [];
  const fallback = params?.currentModel ?? null;
  const index = buildRouteIndex(params?.trajectory);
  const entries = {};
  /** turn -> 已在该 turn 下数过的模型 key，避免一轮多步时重复计轮次。 */
  const countedTurns = {};

  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue;
    if (node.kind !== 'assistant') continue;

    const ms = modelMsOf(node);
    const time = Number.isFinite(node.time) ? node.time : 0;
    const turn = Number.isFinite(node.turn) ? node.turn : null;

    // 优先精确归属：trajectory 的 messageId 索引 → seq 索引。
    let route = null;
    if (typeof node.messageId === 'string') route = index.byMessage.get(node.messageId) ?? null;
    if (route === null && Number.isFinite(node.seq)) route = index.bySeq.get(node.seq) ?? null;

    // 退回近似：只有当前模型可用时，才能说「这些时间大致花在它身上」。
    let key;
    let provider;
    let model;
    if (route !== null) {
      key = route.key;
      provider = route.provider;
      model = route.model;
    } else if (fallback !== null) {
      key = fallback.key;
      provider = fallback.provider;
      model = fallback.model;
    } else {
      // 既没有精确归属也没有当前模型：这条调用不计入任何模型。
      // 凭空归到一个「未知」桶里会污染排行（而且它可能属于别的模型）。
      continue;
    }

    if (entries[key] === undefined) entries[key] = emptyModelEntry(key, provider, model);
    const entry = entries[key];

    entry.modelMs += ms;
    entry.steps += 1;
    entry.lastUsedAt = Math.max(entry.lastUsedAt, time);

    if (turn !== null) {
      if (countedTurns[turn] === undefined) countedTurns[turn] = {};
      if (countedTurns[turn][key] !== true) {
        countedTurns[turn][key] = true;
        entry.turns += 1;
      }
    }
  }

  const list = Object.keys(entries)
    .map((key) => entries[key])
    .sort((left, right) => right.modelMs - left.modelMs);

  // exact = 至少有一条调用是靠 trajectory 精确归属的。全靠 fallback 就是近似。
  return { entries: list, exact: index.available };
}

/**
 * 把模型条目数组转成可持久化的形状（剥掉渲染用不到的东西）。
 *
 * @param entries - deriveModelEntries 的 entries。
 * @returns 纯数组。
 */
function modelEntriesToArray(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return list.map((entry) => ({
    key: entry.key,
    provider: entry.provider,
    model: entry.model,
    modelMs: Number.isFinite(entry.modelMs) ? entry.modelMs : 0,
    steps: Number.isFinite(entry.steps) ? entry.steps : 0,
    turns: Number.isFinite(entry.turns) ? entry.turns : 0,
    lastUsedAt: Number.isFinite(entry.lastUsedAt) ? entry.lastUsedAt : 0,
  }));
}

/**
 * 校验持久化条目数组，丢掉形状不对的行。
 *
 * 不做「尽量修复」：一个字段缺失的条目若被放行，UI 会渲染出一片 NaN，
 * 那比少一行难看得多。
 *
 * @param raw - 持久化数组。
 * @returns 干净数组。
 */
function modelEntriesFromArray(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const key = typeof item.key === 'string' ? item.key : null;
    const provider = typeof item.provider === 'string' ? item.provider : null;
    const model = typeof item.model === 'string' ? item.model : null;
    if (key === null || provider === null || model === null) continue;
    out.push({
      key,
      provider,
      model,
      modelMs: Number.isFinite(item.modelMs) ? item.modelMs : 0,
      steps: Number.isFinite(item.steps) ? item.steps : 0,
      turns: Number.isFinite(item.turns) ? item.turns : 0,
      lastUsedAt: Number.isFinite(item.lastUsedAt) ? item.lastUsedAt : 0,
    });
  }
  out.sort((left, right) => right.modelMs - left.modelMs);
  return out;
}

/**
 * 判断「这个会话是否已经发起过至少一次询问」。
 *
 * 这是「在发起询问之前不能统计时间」的核心判据 —— 没发起过就没有时间可显示，
 * 右上角与记录卡都因此保持干净。
 *
 * 判据用「有没有任何宿主活动痕迹」而不是「时长是否 > 0」：后者在发起后、模型
 * 还没回完的那一瞬间是 0，会让读数闪一下再消失。
 *
 * @param bucket - 会话分区（可能为 null）。
 * @returns 是否已发起。
 */
function isTaskStarted(bucket) {
  if (bucket === null || bucket === undefined || typeof bucket !== 'object') return false;
  if (bucket.currentModel !== null && bucket.currentModel !== undefined) return true;
  if (Array.isArray(bucket.models) && bucket.models.length > 0) return true;
  const stats = bucket.stats;
  if (stats !== null && typeof stats === 'object') {
    if (Number.isFinite(stats.steps) && stats.steps > 0) return true;
    if (Number.isFinite(stats.turns) && stats.turns > 0) return true;
    if (Number.isFinite(stats.llmMs) && stats.llmMs > 0) return true;
  }
  return false;
}

/**
 * 合并多份模型条目数组（跨会话汇总）。
 *
 * 同一模型在不同会话出现时合并成一条；不同模型保持独立。
 *
 * @param lists - 条目数组的数组。
 * @returns 合并后按 modelMs 降序的数组。
 */
function mergeModelEntries(lists) {
  const merged = {};
  for (const list of Array.isArray(lists) ? lists : []) {
    for (const entry of Array.isArray(list) ? list : []) {
      if (entry === null || typeof entry !== 'object') continue;
      const key = typeof entry.key === 'string' ? entry.key : null;
      if (key === null) continue;
      const target = merged[key];
      if (target === undefined) {
        merged[key] = { ...entry };
        continue;
      }
      merged[key] = {
        key,
        provider: entry.provider,
        model: entry.model,
        modelMs: target.modelMs + (Number.isFinite(entry.modelMs) ? entry.modelMs : 0),
        steps: target.steps + (Number.isFinite(entry.steps) ? entry.steps : 0),
        turns: target.turns + (Number.isFinite(entry.turns) ? entry.turns : 0),
        lastUsedAt: Math.max(target.lastUsedAt, Number.isFinite(entry.lastUsedAt) ? entry.lastUsedAt : 0),
      };
    }
  }
  return Object.keys(merged)
    .map((key) => merged[key])
    .sort((left, right) => right.modelMs - left.modelMs);
}