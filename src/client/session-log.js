/**
 * 会话投影读取与任务名提炼。
 *
 * 探针（session 作用域）能拿到三类宿主投影，本模块把它们翻译成本插件要的结构：
 *
 *   1. `sessionStats` —— 整会话的墙钟与计数（turns / steps / llmMs / toolMs /
 *      ttftMs / decodeMs / decodeTokens）。whole-log 口径，不受分页窗口影响。
 *   2. `modelSelection` —— { lastUsed, next }，各带 { provider, model,
 *      reasoningEffort }。用来回答「这次任务当前用哪个模型」。
 *   3. `tokenUsage` —— token 总量（uncachedInputTokens / outputTokens / 缓存读写）。
 *      汇总面板据此给出「烧了多少 token」的体感。
 *
 * 模型级的**精确**归属不在投影里，由 model-log.js 自己 fold（见那个文件的说明）。
 *
 * ## 任务名的隐私口径（本次改动的显式让步）
 * 旧承诺是「绝不触碰消息正文」。要拿到「第一次发起的任务名称」，唯一现成的来源
 * 就是首条 user message 的 content。所以这里**只读首条、只读 text part、截断到
 * 一個短长度、不写任何持久化正文**。README 与 known-limitations 已同步改写。
 *
 * 兜底顺序：首条 user message → 首条任意输入消息 → 占位文案。取不到就老实说
 * 「未命名」，不编。
 *
 * @module src/client/session-log
 */

/** 任务名最大长度。超出截断加省略号 —— 它是标签，不是正文。 */
const TASK_NAME_MAX = 60;

/**
 * 从一个 content parts 数组里取出全部 text。
 *
 * content 的形状（0.2.0-rc.2 实测）：`[{ type: 'text', text: '...' }, ...]`。
 * 但也容忍被 JSON 化过的普通对象、以及干脆是字符串的旧形状。
 *
 * @param content - 任意形状。
 * @returns 拼接后的纯文本（可能为空串）。
 */
function textOfContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const pieces = [];
  for (const part of content) {
    if (typeof part === 'string') {
      pieces.push(part);
      continue;
    }
    if (part === null || typeof part !== 'object') continue;
    if (part.type !== undefined && part.type !== 'text') continue;
    const text = part.text;
    if (typeof text === 'string') pieces.push(text);
  }
  return pieces.join(' ');
}

/**
 * 把一段文本压成可作标签的任务名。
 *
 * 折叠空白、截断。空文本返回 null —— 调用方据此走兜底。
 *
 * @param text - 原始文本。
 * @returns 任务名或 null。
 */
function condenseTaskName(text) {
  if (typeof text !== 'string') return null;
  const collapsed = text.replace(/\s+/gu, ' ').trim();
  if (collapsed.length === 0) return null;
  if (collapsed.length <= TASK_NAME_MAX) return collapsed;
  return `${collapsed.slice(0, TASK_NAME_MAX - 1).trimEnd()}…`;
}

/**
 * 从 chat 快照的节点里提炼「本次会话第一次发起的任务名称」。
 *
 * 只找 **user** 节点（kind === 'user'），且取 `time` 最早的那条 —— 首条。取不到
 * user 节点时退而找任意带 text 的输入类节点，再不行返回 null。
 *
 * 隐私：只取 text part；不读 tool-call 的 args、不读 assistant 的正文。
 *
 * @param nodes - chat 快照的 legacy.nodes 数组，形状任意。
 * @returns 任务名或 null。
 */
function firstTaskName(nodes) {
  if (!Array.isArray(nodes)) return null;

  let earliestUser = null;
  let earliestAny = null;

  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue;
    const text = textOfContent(node.content);
    const name = condenseTaskName(text);
    if (name === null) continue;
    const time = typeof node.time === 'number' ? node.time : 0;

    if (node.kind === 'user') {
      if (earliestUser === null || time < earliestUser.time) {
        earliestUser = { time, name };
      }
      continue;
    }
    // steering / context 之类也是用户侧输入，作为兜底候选。
    if (node.kind === 'steering' || node.kind === 'context') {
      if (earliestAny === null || time < earliestAny.time) {
        earliestAny = { time, name };
      }
    }
  }

  if (earliestUser !== null) return earliestUser.name;
  if (earliestAny !== null) return earliestAny.name;
  return null;
}

/**
 * 归一化 sessionStats 投影的快照。
 *
 * 投影可能缺失（宿主没挂 session-stats）、形状异常、字段是字符串。全部归一成
 * 数字，异常值按 0 —— 面板显示 0 比崩溃好，比 NaN 更好。
 *
 * @param value - `useProjection('sessionStats')` 的返回值，任意形状。
 * @returns 归一化后的统计。
 */
function normalizeSessionStats(value) {
  const empty = {
    turns: 0,
    steps: 0,
    llmMs: 0,
    toolMs: 0,
    ttftMs: 0,
    ttftSteps: 0,
    decodeMs: 0,
    decodeTokens: 0,
    available: false,
  };
  if (value === null || value === undefined || typeof value !== 'object') return empty;

  const num = (field) => {
    const raw = value[field];
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const hasAny = ['turns', 'steps', 'llmMs', 'toolMs'].some((field) => {
    const raw = value[field];
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) && parsed > 0;
  });

  return {
    turns: num('turns'),
    steps: num('steps'),
    llmMs: num('llmMs'),
    toolMs: num('toolMs'),
    ttftMs: num('ttftMs'),
    ttftSteps: num('ttftSteps'),
    decodeMs: num('decodeMs'),
    decodeTokens: num('decodeTokens'),
    // available 表示「投影真的给过值」，用来区分「0 步」与「没有投影」。
    available: hasAny,
  };
}

/**
 * 归一化 modelSelection 投影的快照。
 * @param value - `useProjection('modelSelection')` 的返回值，任意形状。
 * @returns {{ provider, model, key, reasoningEffort } | null} 当前模型。
 */
function normalizeModelSelection(value) {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  // next 是「下一次请求将使用的」，lastUsed 是「上一次请求用过的」。
  // 对「这次任务当前在用什么」来说 next 更贴近现状。
  const source = value.next !== undefined && value.next !== null ? value.next : value.lastUsed;
  if (source === null || source === undefined || typeof source !== 'object') return null;
  const provider = source.provider;
  const model = source.model;
  if (typeof provider !== 'string' || provider.length === 0) return null;
  if (typeof model !== 'string' || model.length === 0) return null;
  const effort = typeof source.reasoningEffort === 'string' ? source.reasoningEffort : null;
  return { provider, model, key: `${provider}/${model}`, reasoningEffort: effort };
}

/**
 * 归一化 tokenUsage 投影的快照。
 * @param value - `useProjection('tokenUsage')` 的返回值，任意形状。
 * @returns 归一化后的 token 账。
 */
function normalizeTokenUsage(value) {
  const empty = { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
  if (value === null || value === undefined || typeof value !== 'object') return empty;
  const num = (field) => {
    const raw = value[field];
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const inputTokens = num('uncachedInputTokens');
  const outputTokens = num('outputTokens');
  const cacheRead = num('cacheReadTokens');
  const cacheWrite = num('cacheWriteTokens');
  return {
    inputTokens,
    outputTokens,
    cacheRead,
    cacheWrite,
    total: inputTokens + outputTokens + cacheRead + cacheWrite,
  };
}

/**
 * 把一次模型调用渲染成给人看的名字。
 *
 * 例：`deepseek/deepseek-chat` → `deepseek-chat`（provider 与 model 同名时省略
 * provider，省一处噪音）；`anthropic/claude-opus-4` → `claude-opus-4`。
 * provider 与 model 不同名前缀时才带上 provider。
 *
 * @param entry - { provider, model }。
 * @returns 展示名。
 */
function modelLabel(entry) {
  if (entry === null || entry === undefined) return '';
  const provider = typeof entry.provider === 'string' ? entry.provider : '';
  const model = typeof entry.model === 'string' ? entry.model : '';
  if (model.length === 0) return provider;
  if (model === provider) return model;
  if (model.startsWith(`${provider}/`)) return model.slice(provider.length + 1);
  if (provider.length === 0) return model;
  return model;
}

/**
 * 把模型拆成「名字」与「provider」两段，给需要区分同名模型的列表用。
 *
 * ## 为什么单靠 modelLabel 不够
 *
 * 同一个模型可以经不同 provider 接入（`opencode-go/deepseek-v4.1-flash` 与
 * `workbuddy/deepseek-v4.1-flash`）。它们的 key 不同、耗时也分别记账，
 * 但 modelLabel **刻意省略 provider** —— 于是汇总排行里会出现两行一模一样的
 * `deepseek-v4.1-flash`：看起来像同一行重复渲染，也分不清哪条是刚才用的线路。
 *
 * 列表场景必须能区分，所以这里把 provider 单独拎出来由 UI 以弱化样式附着在
 * 名字后面。名字本身仍由 modelLabel 决定（保持已有省略规则一致）。
 *
 * provider 为空、或与展示名相同时返回 null —— 那种情况下再挂一遍是纯噪音。
 *
 * @param entry - { provider, model }。
 * @returns {{ name: string, provider: string | null }} provider 为 null 表示无需展示。
 */
function modelLabelParts(entry) {
  const name = modelLabel(entry);
  const raw = entry !== null && entry !== undefined && typeof entry.provider === 'string'
    ? entry.provider.trim()
    : '';
  if (raw.length === 0 || raw === name) return { name, provider: null };
  return { name, provider: raw };
}
