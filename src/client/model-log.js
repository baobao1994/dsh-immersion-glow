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
 * ## ⚠ 为什么有 `remembered`
 *
 * 归属有两条路：trajectory 的精确记录，以及「当时的当前模型」这个近似。
 * 问题在于**近似值会随时间变化**：你先用 deepseek-chat 跑了 3 分钟，中途切到
 * claude-opus。那么此后再做一次全量重算时，`currentModel` 已经是 claude-opus 了 ——
 * 早先那 3 分钟没有任何轨迹可查，于是会被**重新归到 claude-opus 名下**。
 * 用户看到的现象就是「一换模型，新模型就背上旧账」，越用越离谱。
 *
 * 解法是 `remembered`：调用方（探针，页面生命周期内）把「每个节点当时被判给谁」
 * 记下来，重算时优先采用。只有**从未判过**的节点才用当次传入的 currentModel。
 * 这样近似值只在那个节点出现的**那一刻**生效一次，之后就冻结成事实。
 *
 * @param params - 见下。
 * @param params.nodes - chat 快照的节点数组（由 nodesOf 给出）。
 * @param params.trajectory - trajectory 投影快照，任意形状。
 * @param params.currentModel - modelSelection 归一化后的当前模型（可为 null）。
 * @param params.remembered - { [节点标识]: {key,provider,model} }，上一次的归属结果。
 *   传 null 等于没有记忆（首次渲染）。
 * @returns { entries, exact, memory } memory 是本次记下的归属，供下次传入。
 */
function deriveModelEntries(params) {
  const nodes = Array.isArray(params?.nodes) ? params.nodes : [];
  const fallback = params?.currentModel ?? null;
  const index = buildRouteIndex(params?.trajectory);
  const remembered = params?.remembered !== null && typeof params?.remembered === 'object' ? params.remembered : {};
  const entries = {};
  /** turn -> 已在该 turn 下数过的模型 key，避免一轮多步时重复计轮次。 */
  const countedTurns = {};
  /** 本次记下的归属。只增不改 —— 已判定的事实不允许被后来的近似值改写。 */
  const memory = { ...remembered };
  /** 有多少条靠 trajectory 精确归属（用于 exact 的诚实判定）。 */
  let preciseCount = 0;

  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue;
    if (node.kind !== 'assistant') continue;

    const ms = modelMsOf(node);
    const time = Number.isFinite(node.time) ? node.time : 0;
    const turn = Number.isFinite(node.turn) ? node.turn : null;
    const nodeId = nodeIdentity(node);

    // ── 归属三级优先 ────────────────────────────────────────────────
    // 1) 记忆：之前已经判过，冻结。
    // 2) 精确：trajectory 的 messageId 索引 → seq 索引。
    // 3) 近似：当次的 currentModel，仅对该节点生效一次并写入记忆。
    const memorized = nodeId === null ? null : remembered[nodeId] ?? null;
    let route = null;
    let exactHit = false;

    if (memorized !== null) {
      route = memorized;
    } else {
      if (typeof node.messageId === 'string') route = index.byMessage.get(node.messageId) ?? null;
      if (route === null && Number.isFinite(node.seq)) route = index.bySeq.get(node.seq) ?? null;
      if (route !== null) exactHit = true;
      if (route === null && fallback !== null) {
        route = { key: fallback.key, provider: fallback.provider, model: fallback.model };
      }
    }

    if (route === null) {
      // 既没有精确归属也没有当前模型：这条调用不计入任何模型。
      // 凭空归到一个「未知」桶里会污染排行（而且它可能属于别的模型）。
      continue;
    }
    if (exactHit) preciseCount += 1;

    const key = route.key;
    if (nodeId !== null) memory[nodeId] = { key, provider: route.provider, model: route.model };

    if (entries[key] === undefined) entries[key] = emptyModelEntry(key, route.provider, route.model);
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

  // exact 只在「每一条都有精确归属」时才为真。混进了近似就是近似 ——
  // 声称精确而实际有猜测，比明说近似更糟。
  const covered = list.reduce((sum, entry) => sum + entry.steps, 0);
  return { entries: list, exact: covered > 0 && preciseCount >= covered, memory };
}

/**
 * 给一个 assistant 节点算一个稳定标识，用作归属记忆的键。
 *
 * 优先 messageId（跨重渲染稳定），其次 seq（会话内单调递增，也稳定）。
 * 都没有时返回 null —— 那这条节点只能当次近似，无法记忆。
 *
 * @param node - assistant 节点。
 * @returns 字符串标识或 null。
 */
function nodeIdentity(node) {
  if (node === null || typeof node !== 'object') return null;
  if (typeof node.messageId === 'string' && node.messageId.length > 0) return `m:${node.messageId}`;
  if (Number.isFinite(node.seq)) return `s:${node.seq}`;
  return null;
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
  // ⚠ 「发起过」只看**真实产生痕迹**，不看配置：currentModel 是 modelSelection 的
  // next（下一次请求将使用的模型），在**空白的新会话里也是非空的** —— 拿它当
  // 已发起，右上角就会在用户还没发第一句时就冒出来，还带出 1 秒的假耗时
  // （用户反馈：新开会话就显示读数）。真正「发起过」的标志是模型真用过
  // （models 有耗时/次数）或有统计（轮次 / 步骤 / 模型耗时）。
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
/**
 * 算圆形进度环的「进度」。
 *
 * ## 为什么进度不是「已用时长 / 总时长」
 *
 * 总时长没有意义 —— 用户不会为了一次任务设一个上限。所以进度锚在**下一档提醒
 * 阈值**上：「离下一次该歇了还有多远」。这样环满 = 该起身了，跟右上角弹出的
 * 提醒卡是同一个时刻，不会出现环满了但没提醒的矛盾。
 *
 * 阈值用尽时（末档之后按末档步长继续，语义见 timing.nextThresholdMs），
 * 进度对「下一个虚拟档位」计算。
 *
 * @param params - 见下。
 * @param params.elapsedMs - 本次任务的累计净活跃毫秒（用于旧口径的阈值提醒）。
 * @param params.thresholdsMin - 用户设置的阈值分钟数组。
 * @param params.modelMs - 本次任务的模型净耗时毫秒（用于计数环）。
 * @returns {{ ratio: number, nextAtMs: number, crossed: boolean }}
 *   ratio ∈ [0,1)；crossed 表示已经越过下一档（环该回到起点重新蓄）。
 */
function ringProgress(params) {
  const elapsed = Number.isFinite(params?.elapsedMs) && params.elapsedMs > 0 ? params.elapsedMs : 0;
  const list = Array.isArray(params?.thresholdsMin) && params.thresholdsMin.length > 0
    ? params.thresholdsMin
    : null;
  if (list === null) return { ratio: 0, nextAtMs: 0, crossed: false };

  // 进度受阈值档位约束，阈值提醒计的是「你自己的活跃时长」（activeMs）。
  // 读数（在 hud.js 里）也显示 activeMs —— 使它每秒都在走，而不是在模型调用
  // 之间卡住。模型净耗时仍记在逐模型明细里（ig-hud-list / 展开面板）。
  // 返回值里的 ratio 现在驱动暖点的光晕半径（--ig-heat），不再是圆环的弧长。
  // 这里只负责进度档位，与显示口径解耦。
  //
  // ⚠⚠ 档位数必须**不封顶**。
  //
  // 阈值数组只有三档（20/40/60），但「末档之后按末档步长继续」意味着虚拟档位会
  // 一直往后延伸：80、100、120…（语义见 timing.nextThresholdMs）。
  // 早先这里写的是 `while (index < list.length && …)`，把 index 封顶在 3，
  // 于是 nextAtMs 恒等于 nextThresholdMs(list, 3) = 80 分钟 —— 活跃时长一旦超过
  // 80 分钟，剩余就永远是 max(0, 80 - elapsed) = 0，界面卡在「下次提醒还有 1 秒」
  // 再也不动（实测 bug）。同时环也被钉在满格。
  //
  // 复用 timing.satisfiedCount：它用 nextThresholdMs 迭代，天然不封顶。
  const index = satisfiedCount(list, elapsed);
  const nextAtMs = nextThresholdMs(list, index);

  // 本档的起点 = 上一档的边界（第一档的起点是 0）。这样 ratio 始终是
  // 「在本档内走了多少」，跨档时归零重新蓄满。
  const bandStart = index === 0 ? 0 : nextThresholdMs(list, index - 1);
  const bandSpan = nextAtMs - bandStart;
  const ratio = bandSpan > 0
    ? Math.min(0.999, Math.max(0, (elapsed - bandStart) / bandSpan))
    : 0;
  return { ratio, nextAtMs, crossed: index > 0 };
}
