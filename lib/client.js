/**
 * dsh-immersion-glow —— 浏览器半（构建产物，请勿手改）
 *
 * 源码在 src/client/，由 tools/build-client.mjs 生成。
 * 生成命令： npm run build
 */
window.__ModuleLoader__.load({
  id: "dsh-immersion-glow",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

  /* ===== src/client/dict.js ===== */
/**
 * i18n 字典与文案格式化。
 *
 * 两套机制别混：
 *   1. 包根 `locale/{en,zh}.json` —— 只给**插件管理卡**显示标题/描述用，
 *      由宿主读文件，不经运行时（见 readPluginMeta）。
 *   2. 本文件 —— 运行时字典，经 `ctx.locale.register(ns, { zh, en })` 注册，
 *      组件通过 `t` seat 取值。
 *
 * 缺 key 时 locale 服务会把 key 原样吐出来（lookup 走 fallback 链后仍缺失就
 * 显示 key 本身）。为了不让用户看到 `settings.row.label` 这种字面量，本文件
 * 的 tr() 在拿不到翻译时回退到 zh 字典，再不行才回退 key。
 *
 * @module src/client/dict
 */

/** 字典命名空间。注册与取值都用它。 */
const NS = 'immersionGlow';

/** 简体中文。key 集合是事实来源，en 必须与之等长。 */
const ZH = {
  'reminder.title': '沉浸觉察',
  'reminder.body': '你已经沉浸了一段时间，点击查看本次会话的统计。',
  'reminder.countdown': '{n} 秒后自动收起',
  'reminder.unread': '有一条未读的沉浸提醒',
  'reminder.aria': '沉浸提醒',

  'card.title': '沉浸记录',
  'card.duration': '沉浸时长',
  'card.turns': '对话轮次',
  'card.toolCalls': '工具调用',
  'card.tags': '时段',
  'card.close': '关闭',
  'card.save': '收藏这张记录',
  'card.saved': '已收藏',
  'card.openGallery': '查看收藏',
  'card.windowTruncated': '仅统计当前窗口内的数据，更早的历史未加载。',
  'card.degraded': '数据暂不可用',
  'card.stale': '无打开会话，以下为上一次会话的统计。',
  'card.noData': '还没有可统计的会话数据。',

  'gallery.title': '收藏画廊',
  'gallery.openFromSettings': '查看收藏（{n}）',
  'gallery.emptyFromSettings': '收藏',
  'gallery.empty': '还没有收藏。展开记录卡后点「收藏」即可。',
  'gallery.count': '已积累 {n} 张',
  'gallery.remove': '删除这条',
  'gallery.remove.aria': '删除收藏记录',
  'gallery.clear': '清空全部',
  'gallery.clear.confirm': '再点一次确认清空',
  'gallery.back': '返回',

  'settings.title': '沉浸觉察',
  'settings.desc': '沉浸一段时间后，在右上角提醒你查看本次会话的统计。',
  'settings.enabled': '启用',
  'settings.thresholds': '触发阈值（分钟）',
  'settings.thresholds.hint': '用逗号分隔，最后一档之后按末档步长继续。',
  'settings.thresholds.invalid': '需要 1–6 个正整数，且严格递增。',
  'settings.idle': '空闲冻结（分钟）',
  'settings.idle.hint': '超过这段时间没有操作就不再累加。',
  'settings.inlineTimer': '在输入框显示当前时长',
  'settings.telemetry': '已提醒 {impressions} 次 · 你打开了 {opens} 次',
  'settings.copy': '复制统计',
  'settings.copied': '统计信息已复制到剪贴板',
  'settings.copyFailed': '复制失败，请手动选择文本',
  'settings.clearData': '清除本插件数据',
  'settings.clearData.confirm': '再点一次确认清除',
  'settings.cleared': '已清除',

  'tag.morning': '晨间',
  'tag.lateNight': '深夜',
  'tag.longRun': '长跑',
  'tag.fragment': '碎片',

  'unit.minute': '{n} 分钟',
  'unit.hour': '{n} 小时',
  'unit.hourMinute': '{h} 小时 {m} 分钟',
  'unit.lessThanMinute': '不到 1 分钟',
  'unit.times': '{n} 次',

  'probe.timerLabel': '本次会话已沉浸',
  'probe.timer': '沉浸 {duration}',
};

/** English. 必须覆盖 ZH 的每一个 key。 */
const EN = {
  'reminder.title': 'Immersion awareness',
  'reminder.body': 'You have been at it for a while — click to see this session’s stats.',
  'reminder.countdown': 'Auto-dismiss in {n} s',
  'reminder.unread': 'An unread immersion reminder',
  'reminder.aria': 'Immersion reminder',

  'card.title': 'Immersion record',
  'card.duration': 'Focus time',
  'card.turns': 'Conversation turns',
  'card.toolCalls': 'Tool calls',
  'card.tags': 'Time of day',
  'card.close': 'Close',
  'card.save': 'Keep this record',
  'card.saved': 'Kept',
  'card.openGallery': 'View collection',
  'card.windowTruncated': 'Counts cover only the loaded window; older history is not included.',
  'card.degraded': 'Data unavailable',
  'card.stale': 'No session is open — showing the previous session’s stats.',
  'card.noData': 'No session data to count yet.',

  'gallery.title': 'Collection',
  'gallery.openFromSettings': 'View collection ({n})',
  'gallery.emptyFromSettings': 'Collection',
  'gallery.empty': 'Nothing kept yet. Open a record card and choose “Keep this record”.',
  'gallery.count': '{n} kept',
  'gallery.remove': 'Delete this record',
  'gallery.remove.aria': 'Delete collection record',
  'gallery.clear': 'Clear all',
  'gallery.clear.confirm': 'Click again to confirm',
  'gallery.back': 'Back',

  'settings.title': 'Immersion awareness',
  'settings.desc': 'After a stretch of focus, a reminder in the top-right corner points you to this session’s stats.',
  'settings.enabled': 'Enabled',
  'settings.thresholds': 'Thresholds (minutes)',
  'settings.thresholds.hint': 'Comma separated. After the last step, it repeats at that step.',
  'settings.thresholds.invalid': 'Needs 1–6 positive integers in strictly increasing order.',
  'settings.idle': 'Idle freeze (minutes)',
  'settings.idle.hint': 'Time without input stops the counter.',
  'settings.inlineTimer': 'Show the current duration in the composer',
  'settings.telemetry': 'Cued {impressions} times · you opened it {opens} times',
  'settings.copy': 'Copy stats',
  'settings.copied': 'Stats copied to the clipboard',
  'settings.copyFailed': 'Copy failed — select the text manually',
  'settings.clearData': 'Clear this plugin’s data',
  'settings.clearData.confirm': 'Click again to confirm',
  'settings.cleared': 'Cleared',

  'tag.morning': 'Morning',
  'tag.lateNight': 'Late night',
  'tag.longRun': 'Long run',
  'tag.fragment': 'Fragment',

  'unit.minute': '{n} min',
  'unit.hour': '{n} h',
  'unit.hourMinute': '{h} h {m} min',
  'unit.lessThanMinute': 'under 1 min',
  'unit.times': '{n}',

  'probe.timerLabel': 'Focused this session',
  'probe.timer': 'Focused {duration}',
};

/**
 * 用参数替换 `{name}` 占位。缺参保留占位原文，便于发现漏传。
 * @param template - 含 {name} 占位的模板。
 * @param params - 命名参数。
 * @returns 替换后的字符串。
 */
function fillTemplate(template, params) {
  if (params === undefined || params === null) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole,
  );
}

/**
 * 造一个绑定某份字典的翻译函数。
 *
 * 优先用 locale 服务给的 `t`；它返回 key 本身说明缺词，此时回退到本文件内置
 * 的同语言字典，再回退 zh，最后才是 key。
 *
 * @param localT - locale 服务注入的 `t`（可能为 undefined：locale 服务缺失时）。
 * @param lang - 'zh' | 'en'，决定内置回退字典。
 * @returns (key, params?) => string
 */
function createTranslator(localT, lang) {
  const primary = lang === 'en' ? EN : ZH;
  const secondary = ZH;
  return (key, params) => {
    if (typeof localT === 'function') {
      const viaService = localT(key, params);
      // 缺词时 locale 服务把 key 原样返回，据此判断是否需要本地兜底。
      if (typeof viaService === 'string' && viaService !== key) return viaService;
    }
    const fromPrimary = primary[key];
    if (typeof fromPrimary === 'string') return fillTemplate(fromPrimary, params);
    const fromSecondary = secondary[key];
    if (typeof fromSecondary === 'string') return fillTemplate(fromSecondary, params);
    return key;
  };
}

/**
 * 判断当前只读 locale 快照里的语言 id。
 * LocaleFace 的 getSnapshot() 带 active 字段；取不到时按中文（默认 zh）。
 * @param snapshot - locale 快照，可能为 undefined。
 * @returns 'zh' | 'en'
 */
function languageOf(snapshot) {
  const active = snapshot !== null && typeof snapshot === 'object' ? snapshot.active : undefined;
  return typeof active === 'string' && active.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

/**
 * 把毫秒格式化为人类可读时长。
 * @param ms - 毫秒。
 * @param t - 翻译函数。
 * @returns 例如「1 小时 12 分钟」。
 */
function formatDuration(ms, t) {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
  if (totalMinutes < 1) return t('unit.lessThanMinute');
  if (totalMinutes < 60) return t('unit.minute', { n: totalMinutes });
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return t('unit.hour', { n: hours });
  return t('unit.hourMinute', { h: hours, m: minutes });
}

  /* ===== src/client/timing.js ===== */
/**
 * 计时状态机（纯逻辑，无 DOM、无 React、无副作用）。
 *
 * 依据 PRD v0.2 §2.1 / §2.4 / §4.8。所有规则集中在此，便于 node --test 覆盖，
 * 也避免 UI 里散落 if 判断。
 *
 * 时间单位统一用毫秒；对外暴露的函数都接受显式 `now`，不读 Date.now()，
 * 这样测试可以完全控制时间。
 *
 * 三条核心语义（PRD §2.4 补齐的歧义）：
 *   1. 空闲 ≤ idleTimeoutMs(默认 3min) 视为连续，继续累加；
 *   2. 空闲 gap > resetGapMs(默认 10min) 视为新时段，重置 activeMs 与 startedAt；
 *   3. 超过末档后按末档步长继续（20/40/60 → 80/100/…）。
 *
 * 另加两条 PRD 未写但绕不开的：
 *   4. 页面隐藏时冻结计时（浏览器会节流甚至冻结定时器，累计会失真）；
 *      PRD 把「tab 休眠校正」列为 V1.1，此处只做冻结与切回后的重置判定，
 *      不做反向补算 —— 这是保守方向，不会多算。
 *   5. 时钟回拨（now < 上次 tick）时不累加、不触发。
 *
 * @module src/client/timing
 */

/** 一个活跃段达到多久才值得存进画廊（PRD §2.2 F7 的候选门槛）。 */
const MIN_SAVE_MS = 5 * 60 * 1000;

/**
 * 依据阈值数组算出某一档之后的下一个触发点。
 *
 * 语义：thresholdsMin 是「分钟」升序数组，例如 [20, 40, 60]。
 *   - 未触发任何档 → 第一档；
 *   - 已触发到末档 → 按末档步长递增（60 → 80 → 100 …）；
 *   - 中间档 → 下一档。
 *
 * @param thresholdsMin - 升序的阈值分钟数组，非空。
 * @param firedCount - 本时段已触发的档位数。
 * @returns 下一个触发点（毫秒）。
 */
function nextThresholdMs(thresholdsMin, firedCount) {
  const list = thresholdsMin;
  const last = list[list.length - 1];
  if (firedCount < list.length) return list[firedCount] * 60000;
  // 超过末档：以「末档 - 倒数第二档」为步长；只有一档时退化为末档本身。
  const step = list.length >= 2 ? last - list[list.length - 2] : last;
  const extra = firedCount - list.length + 1;
  return (last + step * extra) * 60000;
}

/**
 * 本时段当前应触发的档位数（可能一次越过多档，例如页面隐藏很久后回来）。
 *
 * @param thresholdsMin - 升序阈值。
 * @param activeMs - 本时段累计活跃毫秒。
 * @returns 已满足条件的总档位数。
 */
function satisfiedCount(thresholdsMin, activeMs) {
  let count = 0;
  // 上限保护：极端配置（如全 1 分钟）下不至于无限增长。
  const limit = 500;
  while (count < limit && activeMs >= nextThresholdMs(thresholdsMin, count)) count += 1;
  return count;
}

/**
 * 造一个全新的时段。
 * @param now - 当前毫秒时间戳。
 * @returns 新 segment。
 */
function createSegment(now) {
  return {
    startedAt: now,
    lastActiveAt: now,
    activeMs: 0,
    activeRuns: 0,
    firedCount: 0,
  };
}

/**
 * 记录一次用户交互（pointerdown / keydown / wheel / 节流 mousemove）。
 *
 * 只更新 lastActiveAt，并从空闲恢复时累加 activeRuns（PRD §2.4「交互轮次 =
 * 活跃段数」）。是否新开时段由 tick 统一裁决，这里不动 activeMs —— 交互本身
 * 不产生时长，时长只由 tick 按间隔累加。
 *
 * @param segment - 当前时段。
 * @param now - 当前毫秒时间戳。
 * @param idleTimeoutMs - 空闲阈值。
 * @returns 新的 segment（不改原对象）。
 */
function noteActivity(segment, now, idleTimeoutMs) {
  const wasIdle = now - segment.lastActiveAt > idleTimeoutMs;
  return {
    ...segment,
    lastActiveAt: now,
    activeRuns: wasIdle ? segment.activeRuns + 1 : segment.activeRuns,
  };
}

/**
 * 推进一个 tick。这是整个计时逻辑的唯一入口。
 *
 * 返回的 `effects` 让调用方决定如何落地（写 store、播动画），本函数保持纯净。
 *
 * @param params - 见下。
 * @param params.segment - 当前时段。
 * @param params.now - 本次 tick 的毫秒时间戳。
 * @param params.lastTickAt - 上一次 tick 的毫秒时间戳（null 表示首次）。
 * @param params.visible - 页面是否可见。
 * @param params.idleTimeoutMs - 空闲阈值。
 * @param params.resetGapMs - 新时段阈值。
 * @param params.thresholdsMin - 阈值分钟数组。
 * @returns {{ segment, effects }} effects 含 reset / saved / fire（null 表示无）。
 */
function tick(params) {
  const { segment, now, lastTickAt, visible, idleTimeoutMs, resetGapMs, thresholdsMin } = params;

  /** 默认无副作用。 */
  const noEffects = { reset: false, saved: null, fire: null };

  // 时钟回拨或首次 tick：不累加、不触发。
  if (lastTickAt === null || now < lastTickAt) {
    return { segment: { ...segment, lastActiveAt: segment.lastActiveAt }, effects: noEffects };
  }

  // 页面不可见：冻结。也不改 lastActiveAt —— 切回时由 gap 判定续算还是重置。
  if (!visible) {
    return { segment, effects: noEffects };
  }

  const gapSinceActive = now - segment.lastActiveAt;

  // 间隔过长 → 新时段。先把旧段结算成「可保存候选」，再重置。
  if (gapSinceActive > resetGapMs) {
    const saved = segment.activeMs >= MIN_SAVE_MS ? { ...segment } : null;
    return {
      segment: createSegment(now),
      effects: { reset: true, saved, fire: null },
    };
  }

  // 空闲但未到重置阈值：冻结累加（不补算空档）。
  if (gapSinceActive > idleTimeoutMs) {
    return { segment, effects: noEffects };
  }

  // 正常累加：本次 tick 覆盖的步长是「距上次 tick」的间隔。
  const step = Math.max(0, now - lastTickAt);
  const activeMs = segment.activeMs + step;
  const satisfied = satisfiedCount(thresholdsMin, activeMs);

  let next = { ...segment, activeMs };
  let fire = null;

  // 只有当越过新档位时才触发；一次 tick 可能跨多档，只播一次动画但记账全部。
  if (satisfied > segment.firedCount) {
    fire = { atMs: nextThresholdMs(thresholdsMin, satisfied - 1), count: satisfied };
    next.firedCount = satisfied;
  }

  return { segment: next, effects: { reset: false, saved: null, fire } };
}

/**
 * 把活跃段打包成一条可入库的收藏候选。
 * @param segment - 时段。
 * @param metrics - 该时段结束时的会话指标（可为 null）。
 * @param now - 入库时间。
 * @returns 收藏条目；不足 MIN_SAVE_MS 时返回 null。
 */
function toRecord(segment, metrics, now) {
  if (segment.activeMs < MIN_SAVE_MS) return null;
  return {
    createdAt: now,
    activeMs: segment.activeMs,
    activeRuns: segment.activeRuns,
    turns: metrics === null || metrics === undefined ? 0 : metrics.turns,
    toolCalls: metrics === null || metrics === undefined ? 0 : metrics.toolCalls,
    truncated: metrics !== null && metrics !== undefined ? metrics.truncated === true : false,
    sessionId: metrics === null || metrics === undefined ? null : metrics.sessionId,
  };
}

/**
 * 解析用户输入的阈值文本。
 *
 * 接受中英文逗号、空格分隔。要求 1–6 个正整数且严格递增（PRD §2.1 F4 的最小形态）。
 *
 * @param text - 用户输入。
 * @returns {{ ok: true, value: number[] } | { ok: false }}
 */
function parseThresholds(text) {
  if (typeof text !== 'string') return { ok: false };
  const parts = text
    .split(/[,，\s]+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
  if (parts.length < 1 || parts.length > 6) return { ok: false };
  const numbers = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return { ok: false };
    const value = Number(part);
    if (!Number.isSafeInteger(value) || value < 1 || value > 600) return { ok: false };
    numbers.push(value);
  }
  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] <= numbers[index - 1]) return { ok: false };
  }
  return { ok: true, value: numbers };
}

/**
 * 判断两个时间戳是否落在不同的本地日期（用于跨零点重置「今日」统计）。
 * @param a - 毫秒时间戳。
 * @param b - 毫秒时间戳。
 * @returns 是否跨日。
 */
function isDifferentLocalDay(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() !== right.getFullYear() ||
    left.getMonth() !== right.getMonth() ||
    left.getDate() !== right.getDate()
  );
}

  /* ===== src/client/tags.js ===== */
/**
 * 时段标签（PRD v0.2 §2.2 F14）。
 *
 * 设计意图（ADR-011）：成长信号要从「收藏数」换成「即时可感知的时段标签」，
 * 因为收藏数是「沉浸 20 分钟才出一次机会、攒 20 张要数周」的长回路，撑不到
 * 习惯形成。标签在时段结束时立刻可见，反馈发生在行为当下。
 *
 * 两类标签可叠加，卡片最多显示两枚：
 *   - 时间类：晨间 / 深夜
 *   - 长度类：长跑 / 碎片
 *
 * 隐私边界：只用时长与时间戳，绝不触碰消息正文。
 *
 * @module src/client/tags
 */

/** 逻辑标签 id，UI 层用 t('tag.<id>') 取文案。 */
const TAG_MORNING = 'morning';
const TAG_LATE_NIGHT = 'lateNight';
const TAG_LONG_RUN = 'longRun';
const TAG_FRAGMENT = 'fragment';

/** 长跑门槛：单时段净活跃 ≥ 60 分钟。 */
const LONG_RUN_MS = 60 * 60 * 1000;

/** 碎片门槛：单时段净活跃 < 20 分钟。 */
const FRAGMENT_MS = 20 * 60 * 1000;

/**
 * 按开始时刻归类「晨间 / 深夜」。
 *
 * 区间取左闭右开：晨间 [5, 10)，深夜 [22, 24) ∪ [0, 5)。
 * 白天（10–22）不产出时间标签 —— 大多数会话发生在白天，给每个人都发「白天」
 * 标签等于没有信息量。
 *
 * @param startedAt - 时段开始毫秒时间戳。
 * @returns 标签 id 或 null。
 */
function timeTagOf(startedAt) {
  const hour = new Date(startedAt).getHours();
  if (hour >= 5 && hour < 10) return TAG_MORNING;
  if (hour >= 22 || hour < 5) return TAG_LATE_NIGHT;
  return null;
}

/**
 * 按时长归类「长跑 / 碎片」。
 * @param activeMs - 时段净活跃毫秒。
 * @returns 标签 id 或 null。
 */
function lengthTagOf(activeMs) {
  if (activeMs >= LONG_RUN_MS) return TAG_LONG_RUN;
  if (activeMs < FRAGMENT_MS) return TAG_FRAGMENT;
  return null;
}

/**
 * 计算一条记录的全部标签。
 *
 * 顺序固定为 [时间类, 长度类]，便于 UI 稳定渲染；最多两枚。
 *
 * @param startedAt - 时段开始时间戳。
 * @param activeMs - 时段净活跃毫秒。
 * @returns 标签 id 数组（0–2 项）。
 */
function tagsOf(startedAt, activeMs) {
  const result = [];
  const time = timeTagOf(startedAt);
  if (time !== null) result.push(time);
  const length = lengthTagOf(activeMs);
  if (length !== null) result.push(length);
  return result;
}

  /* ===== src/client/metrics.js ===== */
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

  /* ===== src/client/state.js ===== */
/**
 * 状态定义与写入口（PRD v0.2 §4.8）。
 *
 * ## 为什么不用 slot 的 `store:` 座
 * PRD §4.7 的原始写法是让光带（root scope）与探针（session scope）共用同一个
 * store handle。这会撞上 SlotCore.register 的硬校验：
 *
 *     store handle mounted under "<插槽>" (scope "session") is already mounted
 *     under scope "root" — one handle, one scope
 *
 * 注册会直接抛错，三处插槽全部挂不上。因此这里改为：在 apply() 内 create() 出
 * 唯一 root 实例，用 ctx.slots.provideRoot() 同时暴露 `useImmersionGlow` 与
 * `immersionGlowActions`。provideRoot 的 root 贡献会被合并进**所有 scope** 的
 * standard props（见 renderer 的 standardProps 实现），所以光带、设置行、探针
 * 三处都能拿到同一份。
 *
 * ## 为什么 handle 在 apply 内构造
 * 源码原文："Never export a handle at module level — module-cache identity is a
 * disguised singleton across plugin reloads." 模块级导出会在热重载时复用旧
 * 单例，导致状态错乱。本文件的 `createStoreHandle()` 是工厂，必须由 apply 调用。
 *
 * ## 持久化
 * defineStore 的 persist 落到 localStorage（`attachPersistence` 里
 * localStorage.getItem/setItem），且**自带损坏兜底**：JSON.parse 失败时回滚到
 * 初始 state 并 console.error，不会阻断插件。所以不需要再写一层 try/catch。
 *
 * 但有一条 persist 不覆盖：它只在实例创建时读一次，之后单向写入，**不监听
 * storage 事件**。PRD §2.4 要求的「多标签取最大 activeMs」必须由 index.js 手写。
 *
 * @module src/client/state
 */

/** 持久化键（PRD §3.3「数据仅存单一持久化键」）。 */
const PERSIST_KEY = 'immersion-glow.v1';

/** 画廊上限。超出时丢最旧的（FIFO）。 */
const GALLERY_LIMIT = 50;

/** 当前 state schema 版本。见 migrateState 的版本说明。 */
const STATE_VERSION = 3;

/** 阈值提醒卡在右上角停留多久；超时后转为未读徽标，直到用户点击。 */
const REMINDER_TIMEOUT_MS = 60 * 1000;

/**
 * 会话分区的零值。
 *
 * @param now - 起始时间戳。
 * @returns 一份全新的空 segment。
 */
function emptySegment(now) {
  return { startedAt: now, lastActiveAt: now, activeMs: 0, activeRuns: 0, firedCount: 0 };
}

/**
 * 默认设置。数值依据 PRD §2.1 / §4.8。
 */
const DEFAULT_SETTINGS = {
  enabled: true,
  thresholdsMin: [20, 40, 60],
  idleTimeoutMs: 3 * 60 * 1000, // 3 分钟冻结
  resetGapMs: 10 * 60 * 1000, // 10 分钟新时段
  showInlineTimer: false,
};

/**
 * 造一份全新的初始 state。
 *
 * defineStore 的 init 必须是**函数**，保证每个实例拿到互不共享的对象
 * （源码注释：a lambda so every instance gets a fresh state）。
 *
 * @param now - 当前毫秒时间戳，用于 seed 时段。
 * @returns 初始 state。
 */
function createInitialState(now) {
  const start = typeof now === 'number' ? now : 0;
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS, thresholdsMin: [...DEFAULT_SETTINGS.thresholdsMin] },
    /**
     * 当前页面视角下的活跃会话 id。
     *
     * 问题：一段沉浸时长属于**会话**，不属于窗口。原来只有一份全局 segment，
     * 于是开新窗口 / 切会话都继承上一轮的时间，读数骗人。
     *
     * 解法：segment 按 sessionId 分区存；`activeSessionId` 指出哪一份是当前视角。
     * 没有会话时（首页/欢迎页）沿用最后一个，但 UI 会标 stale。
     */
    activeSessionId: null,

    /**
     * sessionId -> 该会话的计时分区。
     *
     * 形如 { [sessionId]: { segment, metrics, updatedAt } }。上限 20 个，超出
     * 丢最久未更新的 —— 会话一多不可能无限膨胀 localStorage。
     */
    sessions: {},

    /** 今日统计，跨零点由 tick 侧重置。 */
    today: { date: start },
    /** 收藏库。 */
    collections: [],
    /** 本地埋点：阈值提醒触发 / 用户打开记录卡。 */
    telemetry: { impressions: 0, opens: 0 },
    /** 纯 UI 态（不跨会话持久有意义，但放一起省一个 store）。 */
    ui: {
      cardOpen: false,
      galleryOpen: false,
      /**
       * 右上角提醒卡（ADR-123）。
       *
       * null = 没有提醒。有值时形如：
       *   { message, sticky, at, deadlineAt, seq }
       *
       *   - sticky: true  → 阈值提醒。60s 倒计时结束还没点就**缩成未读徽标**，
       *     一直留着，直到用户点击（打开记录卡并清除）。
       *   - sticky: false → 「已收藏 / 已复制」这类确认。到点即消失，且**永远
       *     不覆盖**一条 sticky 提醒（见 showReminder 里的守卫）。
       *
       * seq 只用于让同文案的新提醒重播入场动画（作元素 key）。
       */
      reminder: null,
    },
  };
}

/**
 * 造 actions 表。每个 mutator 收到的 draft 是 immer draft，直接改即可。
 *
 * 命名约定：读起来像命令，参数是「业务值」而不是内部字段名。
 *
 * @returns actions 表。
 */
function createActions() {
  return {
    /** 埋点：阈值提醒浮现。 */
    countImpression(draft) {
      draft.telemetry.impressions += 1;
    },

    /** 埋点：用户打开记录卡。 */
    countOpen(draft) {
      draft.telemetry.opens += 1;
    },

    /** 更新设置（部分字段）。 */
    updateSettings(draft, patch) {
      draft.settings = { ...draft.settings, ...patch };
    },

    /** 打开/关闭记录卡。 */
    setCardOpen(draft, open) {
      draft.ui.cardOpen = open === true;
    },

    /** 打开/关闭画廊。 */
    setGalleryOpen(draft, open) {
      draft.ui.galleryOpen = open === true;
    },

    /**
     * 弹一条右上角提醒（ADR-123）。
     *
     * @param draft - immer draft。
     * @param payload - { message: string, sticky?: boolean, now?: number }
     *   message 已本地化；sticky 缺省为 false（确认类）。
     *
     * 覆盖规则：
     *   - sticky → sticky：覆盖（新一轮阈值提醒取代旧一轮）；
     *   - 非 sticky → sticky：**不覆盖** —— 「已收藏」这种一闪而过的确认
     *     没资格顶掉一条用户还没读的阈值提醒（未读徽标会因此消失）；
     *   - 任意 → 非 sticky：覆盖（旧确认已经无所谓了）。
     */
    showReminder(draft, payload) {
      const message = typeof payload?.message === 'string' ? payload.message : '';
      if (message.length === 0) return;
      const sticky = payload.sticky === true;
      const existing = draft.ui.reminder;
      if (!sticky && existing !== null && existing !== undefined && existing.sticky === true) {
        return;
      }
      const now = typeof payload.now === 'number' ? payload.now : Date.now();
      draft.ui.reminder = {
        message,
        sticky,
        at: now,
        deadlineAt: now + REMINDER_TIMEOUT_MS,
        seq: (existing?.seq ?? 0) + 1,
      };
    },

    /**
     * 用户点开了提醒（徽标或仍在倒计时的卡片）：清掉它并打开记录卡。
     *
     * 语义上「点提醒」就是「我要看统计」，所以打开卡片也在这里一并做，
     * 调用方不用记两件事。
     */
    openFromReminder(draft) {
      draft.ui.reminder = null;
      draft.ui.cardOpen = true;
    },

    /** 关掉提醒（不打开记录卡）。倒计时结束的确认类提醒走卸载，不需要调它。 */
    dismissReminder(draft) {
      draft.ui.reminder = null;
    },

    /** 存一条收藏，超出上限丢最旧。 */
    saveRecord(draft, record) {
      const withId = { ...record, id: record.id ?? `r${record.createdAt}${draft.collections.length}` };
      const next = [withId, ...draft.collections];
      draft.collections = next.length > GALLERY_LIMIT ? next.slice(0, GALLERY_LIMIT) : next;
    },

    /** 删除单条收藏。 */
    removeRecord(draft, id) {
      draft.collections = draft.collections.filter((item) => item.id !== id);
    },

    /** 清空画廊。 */
    clearGallery(draft) {
      draft.collections = [];
    },

    /**
     * 切换当前视角的会话。
     *
     * 带 `seed` 时（该会话还没有分区）就建一个空分区；不带时只切指针。
     * 切过去**不继承**任何时长 —— 这正是「开新窗口不该看到上一轮时间」的修法。
     *
     * @param draft - immer draft。
     * @param payload - { sessionId: string|null, now: number }
     */
    switchSession(draft, payload) {
      const sessionId = payload.sessionId;
      draft.activeSessionId = sessionId ?? null;
      if (typeof sessionId !== 'string' || sessionId.length === 0) return;
      // 兜底：迁移之后这里应当总是对象，但 store 的快照可能来自任何路径
      // （旧数据整体替换、别的标签页写坏）。宁可就地补一个，也不要抛。
      if (draft.sessions === null || typeof draft.sessions !== 'object') draft.sessions = {};
      if (draft.sessions[sessionId] !== undefined) {
        draft.sessions[sessionId].updatedAt = payload.now;
        return;
      }
      draft.sessions[sessionId] = {
        segment: {
          startedAt: payload.now,
          lastActiveAt: payload.now,
          activeMs: 0,
          activeRuns: 0,
          firedCount: 0,
        },
        metrics: null,
        updatedAt: payload.now,
      };
      // 分区上限：超出时丢最久没更新的那个（当前会话永不丢）。
      const ids = Object.keys(draft.sessions);
      if (ids.length > 20) {
        const victims = ids
          .filter((id) => id !== sessionId)
          .sort((a, b) => draft.sessions[a].updatedAt - draft.sessions[b].updatedAt);
        for (const victim of victims.slice(0, ids.length - 20)) delete draft.sessions[victim];
      }
    },

    /**
     * 只更新某个会话的计时分区（不动指针）。
     *
     * @param draft - immer draft。
     * @param payload - { sessionId, segment?, metrics?, now? }
     */
    writeSession(draft, payload) {
      const sessionId = payload.sessionId;
      if (typeof sessionId !== 'string' || sessionId.length === 0) return;
      const now = payload.now ?? Date.now();
      // 同 switchSession：分区表必须存在，否则就地补一个空表。
      if (draft.sessions === null || typeof draft.sessions !== 'object') draft.sessions = {};
      // 分区可能还不存在：探针可能先于 sessions.list 的 sync 到达。
      // 这时建一个空分区再写，绝不借用别的会话的时长。
      if (draft.sessions[sessionId] === undefined) {
        draft.sessions[sessionId] = {
          segment: {
            startedAt: now,
            lastActiveAt: now,
            activeMs: 0,
            activeRuns: 0,
            firedCount: 0,
          },
          metrics: null,
          updatedAt: now,
        };
      }
      const bucket = draft.sessions[sessionId];
      if (payload.segment !== undefined) bucket.segment = payload.segment;
      if (payload.metrics !== undefined) bucket.metrics = payload.metrics;
      bucket.updatedAt = now;
    },

    /** 跨零点：重置今日统计（时段本身保留）。 */
    rollDay(draft, now) {
      draft.today = { date: now };
    },

    /**
     * 复位「只在当前页面生命周期内有效」的 UI 态。
     *
     * 为什么必须有这一步：defineStore 的 persist 把**整个 state** 写进
     * localStorage，刷新后原样读回。但 ui 里的字段一旦跨会话恢复就会出错 ——
     *
     *   1. `cardOpen: true` 会让刷新后凭空弹出一张记录卡；
     *   2. 提醒恢复回来时 `deadlineAt` 已是过去时：sticky 提醒会直接以「未读
     *      徽标」的形态闪一下，非 sticky 的会莫名露脸又立刻消失。
     *
     * 提醒是「刚刚发生了什么」的信号，不该跨页面生命周期存活 —— 所以这里
     * 一并清空。**取舍（ADR-123）**：未读徽标在页面生命周期内保持，刷新即清。
     * 要跨刷新持久化需要把 unread 单独搬出 persist 白名单并补迁移，复杂度
     * 不值得 —— 会话提示的时效性远大于存续性。
     */
    resetTransient(draft) {
      draft.ui = {
        cardOpen: false,
        galleryOpen: false,
        reminder: null,
      };
    },

    /**
     * 清除本插件全部数据，回到初始态。
     *
     * 设置行里的「清除本插件数据」直接调它；清完仍需用户手动刷新或重进会话，
     * 因为已渲染的组件拿的是旧快照（下一次 tick 会自然对齐）。
     */
    resetAll(draft, now) {
      const fresh = createInitialState(now);
      for (const key of Object.keys(fresh)) draft[key] = fresh[key];
    },
  };
}

/**
 * 把任意历史版本的持久化值归一成当前 schema。
 *
 * ## 为什么必须有这一步（实测事故）
 * `dsh-client-store` 的恢复是**整体替换**，不是合并：
 *
 *     api.setState(devFreeze(JSON.parse(raw)), true)   // 第二个参数 true = replace
 *
 * 于是 `init()` 里给的 `sessions: {}` 会被旧数据直接覆盖掉 —— 旧数据没有
 * `sessions` 字段，恢复后 `state.sessions` 就是 `undefined`。之后
 * `switchSession` 里 `draft.sessions[sessionId] = …` 抛
 * `TypeError: Cannot read properties of undefined`，而 cordis 的 `ctx.effect()`
 * 对同步异常是**重抛**的，异常直接冲出 `apply()`，整个插件起不来。
 *
 * 版本沿革：
 *   v1（ADR-117 之前）：顶层 `segment` / `metrics`，只有一份全局时长。
 *   v2（ADR-117 之后）：改成 `sessions[id] = { segment, metrics, updatedAt }`
 *       + `activeSessionId`，v1 的两个顶层字段成为历史包袱。
 *   v3（ADR-123）：光带退役。`ui.hintVisible` / `ui.playSeq` / `ui.toast` /
 *       `settings.intensity` / `telemetry.dismisses` 一并删除，换成
 *       `ui.reminder`（右上角提醒卡）。
 *
 * 迁移策略：缺什么补什么，**绝不因为字段缺失就丢掉用户数据**。
 *   - v1 的顶层 `metrics.sessionId` 记录着那份时长属于哪个会话 —— 这是唯一
 *     忠实的归属证据，按它归档进对应分区，**不挂孤儿键、不冒充别的会话**。
 *     归属不明（没有 sessionId 或值无效）时才丢弃时长本体；设置、收藏、
 *     埋点、今日这些无归属歧义的数据一律保留。
 *   - v1 的顶层 `segment` / `metrics` 随后删除：它们已不是权威来源，留着
 *     就会有人再去读它（ADR-117 之后 slots.js 的常驻计时就是因此读到 0）。
 *
 * @param raw - 从 localStorage 解析出的对象，可能是任意历史版本或垃圾值。
 * @param now - 时间戳，用于补齐缺失的时间字段。
 * @returns {object} 可安全交给 store 的完整 state。
 */
function migrateState(raw, now) {
  const fresh = createInitialState(now);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fresh;

  const merged = { ...fresh, ...raw };
  merged.version = STATE_VERSION;

  // settings 逐字段兜底：旧版本可能缺项，也可能整块不是对象。
  merged.settings =
    raw.settings !== null && typeof raw.settings === 'object'
      ? { ...fresh.settings, ...raw.settings }
      : { ...fresh.settings };
  // v3 起强度设置随光带退役；旧数据里留着这个键只会造成「设置了却没效果」
  // 的假象，迁移时删干净。
  delete merged.settings.intensity;

  // ── ui：提醒卡时代的形状。旧键（hintVisible/playSeq/toast）一律丢弃 ──
  // 语义见 resetTransient —— 它们只在页面生命周期内有意义，跨恢复必须清。
  merged.ui = { ...fresh.ui };
  if (raw.ui !== null && typeof raw.ui === 'object') {
    merged.ui.cardOpen = raw.ui.cardOpen === true;
    merged.ui.galleryOpen = raw.ui.galleryOpen === true;
  }
  merged.ui.reminder = null;

  // ── 分区表：这一步是崩溃的根因，必须保证它一定是对象 ──────────────
  const sessions = {};
  if (raw.sessions !== null && typeof raw.sessions === 'object' && !Array.isArray(raw.sessions)) {
    for (const id of Object.keys(raw.sessions)) {
      const bucket = raw.sessions[id];
      if (bucket === null || typeof bucket !== 'object') continue;
      sessions[id] = {
        segment:
          bucket.segment !== null && typeof bucket.segment === 'object'
            ? { ...emptySegment(now), ...bucket.segment }
            : emptySegment(now),
        metrics: bucket.metrics ?? null,
        updatedAt: Number.isFinite(bucket.updatedAt) ? bucket.updatedAt : now,
      };
    }
  }

  // ── v1 的顶层时长：按 metrics.sessionId 归档进正确分区 ──────────────
  const legacySegment = raw.segment !== null && typeof raw.segment === 'object' ? raw.segment : null;
  const legacyMetrics = raw.metrics !== null && typeof raw.metrics === 'object' ? raw.metrics : null;
  const legacyId =
    legacyMetrics === null ? null : typeof legacyMetrics.sessionId === 'string' ? legacyMetrics.sessionId : null;
  const hasLegacy = legacySegment !== null && Number.isFinite(legacySegment.activeMs);
  if (hasLegacy && typeof legacyId === 'string' && sessions[legacyId] === undefined) {
    // 归属明确：原样搬进那个会话的分区，回到该会话时时长还在。
    sessions[legacyId] = {
      segment: { ...emptySegment(now), ...legacySegment },
      metrics: legacyMetrics,
      updatedAt: Number.isFinite(legacySegment.lastActiveAt) ? legacySegment.lastActiveAt : now,
    };
  }
  // 归属不明的旧时长：宁可丢掉，也不能冒充某个会话（ADR-117 的原则）。
  merged.sessions = sessions;

  // ── 当前视角：必须是「确有分区」的 id，否则置空 ────────────────────
  const claimed = raw.activeSessionId;
  merged.activeSessionId =
    typeof claimed === 'string' && merged.sessions[claimed] !== undefined ? claimed : null;

  // ── 删除 v1 顶层 segment/metrics：它们已不是权威来源 ────────────────
  // 留着就必然有人再读（slots.js 的常驻计时曾因此永远显示 0）。
  delete merged.segment;
  delete merged.metrics;

  merged.today = raw.today !== null && typeof raw.today === 'object' ? raw.today : fresh.today;
  merged.collections = Array.isArray(raw.collections) ? raw.collections : [];
  // telemetry 兜底：v2 及更早有 dismisses，v3 删了 —— 合并后再按 fresh 的形状
  // 拷贝一遍，多余键自然剥落；缺的键（如旧版本没有 opens）用 0 补上。
  merged.telemetry =
    raw.telemetry !== null && typeof raw.telemetry === 'object'
      ? {
          impressions: Number.isFinite(raw.telemetry.impressions) ? raw.telemetry.impressions : 0,
          opens: Number.isFinite(raw.telemetry.opens) ? raw.telemetry.opens : 0,
        }
      : { ...fresh.telemetry };

  return merged;
}

/**
 * 在 store 创建**之前**把 localStorage 里的旧 schema 归一好。
 *
 * 为什么必须在 store 外面做：`dsh-client-store` 的 attachPersistence 是
 * 自己去 `localStorage.getItem(name)` 然后 `setState(JSON.parse(raw), true)`，
 * 全程不经过我们的代码、也没有 migrate 钩子。所以唯一能拦住的时机就是
 * 「handle.create() 之前」——先把键里的旧值改写成当前 schema，引擎随后读到
 * 的就是已经安全的完整 state。
 *
 * 损坏值直接删键：留着只会让引擎每次启动都 `console.error` 一次并整体替换成
 * 垃圾，不如回到干净初始态。
 *
 * @param storage - localStorage 兼容对象；缺失时静默跳过。
 * @param now - 时间戳。
 * @returns {boolean} 是否真的改写过存储。
 */
function preparePersistedState(storage, now) {
  if (storage === null || storage === undefined || typeof storage.getItem !== 'function') {
    return false;
  }
  let raw = null;
  try {
    raw = storage.getItem(PERSIST_KEY);
  } catch (_error) {
    return false; // 隐私模式等：读不到就交给引擎自己走「无持久化」分支。
  }
  if (raw === null || raw === undefined) return false;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    try {
      storage.removeItem(PERSIST_KEY);
      return true;
    } catch (_ignored) {
      return false;
    }
  }

  const migrated = migrateState(parsed, now);
  try {
    storage.setItem(PERSIST_KEY, JSON.stringify(migrated));
    return true;
  } catch (_error) {
    return false; // 配额等：迁移失败也不该阻断插件，兜底守卫仍在。
  }
}

/**
 * 判断某个会话是否真的有一份分区。
 *
 * 集中成一个函数，是为了让「sessions 可能是 undefined」这件事只有一个
 * 判断点 —— 旧 schema 数据被整体替换进来时就是这样。
 *
 * @param snapshot - store 快照。
 * @param sessionId - 待查会话 id。
 * @returns {boolean} 有分区即真。
 */
function hasSessionBucket(snapshot, sessionId) {
  if (typeof sessionId !== 'string') return false;
  const sessions = snapshot === null || snapshot === undefined ? undefined : snapshot.sessions;
  if (sessions === null || typeof sessions !== 'object') return false;
  return sessions[sessionId] !== undefined;
}

/**
 * 声明 store。
 *
 * @param defineStore - 由 client bundle 通过 require('@deepseek-ai/dsh-client-store') 注入。
 * @returns store handle（必须在 apply 内 create）。
 */
function createStoreHandle(defineStore) {
  return defineStore({
    init: () => createInitialState(Date.now()),
    persist: PERSIST_KEY,
    actions: createActions(),
  });
}

  /* ===== src/client/session-id.js ===== */
/**
 * 「当前会话 id」的解析。
 *
 * ## 为什么需要单独一个模块
 * 这是本插件最容易随宿主升级而静默失效的地方 —— 而且**不会报错**，
 * 只是永远解析不出 id，于是计时器每秒都在第一道守卫处提前返回，
 * 光带永远不触发。实测踩过一次：
 *
 *   插件原写法是 `sessions.list.getSnapshot().current`。
 *   但 DSH 0.2.0-rc.2 的 SessionListState 实际只有
 *   { ids, byId, phase, projectionsBySession } —— **没有 current 字段**。
 *   运行时 `this.list.set({ ids, byId, phase, projectionsBySession })` 也只写这四个。
 *   结果 current 恒为 undefined，activeSessionId 恒为 null，计时器整个空转。
 *
 * 所以这里把「多种可能的形状」集中成一处显式声明，按可信度依次尝试，
 * 任何一种可用即生效；全都拿不到时返回 null，由调用方按「无会话」处理。
 *
 * ## 候选来源（按可信度排序）
 *   1. 快照上的 `current` —— 老版本 ui-session 的会话列表曾直接暴露它。
 *      新版本没有，但读它无害（有就比别处更准）。
 *   2. `retainedBy.mainView > 0` 的行 —— 这正是 ui-session 自己 publishMain()
 *      判定「当前主视图是哪个会话」的依据：
 *
 *          currentId && retainInfo(currentId).retainedBy.mainView > 0 ? currentId
 *            : Object.values(byId).find(c => c.retainedBy.mainView > 0)?.id
 *
 *      我们照抄这个判据，就能和宿主选中同一个会话。
 *   3. `ids` 的**末位**兜底：列表按宿主顺序给出，配合 session-scope 探针
 *      （见 session-id.js 的 `resolveFromProps`）通常不必走到这一步。
 *
 * @module src/client/session-id
 */

/**
 * 判断一个值是不是可用的会话 id。
 *
 * @param value - 待判值。
 * @returns {boolean} 是非空字符串即真。
 */
function isSessionId(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * 从一行的 retainedBy 里读 mainView 计数（缺失按 0）。
 *
 * @param row - SessionSummary 候选。
 * @returns {number} 主视图持有数。
 */
function mainViewCount(row) {
  const retainedBy = row === null || row === undefined ? undefined : row.retainedBy;
  const count = retainedBy === null || retainedBy === undefined ? undefined : retainedBy.mainView;
  return typeof count === 'number' && count > 0 ? count : 0;
}

/**
 * 从 SessionListState 快照解析当前会话 id。
 *
 * 对任意形状都不抛错：非对象、缺字段、byId 不是对象，一律返回 null。
 *
 * @param list - `sessions.list.getSnapshot()` 的返回值。
 * @returns {string|null} 当前会话 id，或 null。
 */
function resolveCurrentSessionId(list) {
  if (list === null || typeof list !== 'object') return null;

  // ① 老版本直接暴露的 current。
  if (isSessionId(list.current)) return list.current;

  const byId = list.byId;
  const ids = Array.isArray(list.ids) ? list.ids : null;

  // ② 与 ui-session publishMain() 同一个判据：主视图正在持有哪个会话。
  if (byId !== null && typeof byId === 'object') {
    if (ids !== null) {
      // 有 ids 时按宿主列表顺序找，保证「唯一主视图」时结果稳定。
      for (const id of ids) {
        if (mainViewCount(byId[id]) > 0) return id;
      }
    } else {
      for (const id of Object.keys(byId)) {
        if (mainViewCount(byId[id]) > 0) return id;
      }
    }
  }

  // ③ 末位兜底：列表按宿主顺序（通常最新在后）。
  if (ids !== null && ids.length > 0) {
    const last = ids[ids.length - 1];
    if (isSessionId(last)) return last;
  }

  return null;
}

/**
 * 在 session 作用域里把「当前渲染的会话」泵回 root。
 *
 * session-scope 插槽（`conversation.input.left`）的 standard props 里有
 * `sessionId: SessionId`，那是宿主直接给的、比在 root 侧反推更权威的答案。
 * 探针每次渲染都调它，root 侧据此把分区指针切过去。
 *
 * @param actions - store actions。
 * @param props - 插槽组件收到的 props。
 * @param now - 时间戳。
 * @returns {void}
 */
function claimSessionFromProps(actions, props, now) {
  const id = props === null || props === undefined ? undefined : props.sessionId;
  if (!isSessionId(id)) return;
  actions.switchSession({ sessionId: id, now });
}

  /* ===== src/client/stats.js ===== */
/**
 * 埋点与收藏的导出载荷（PRD §4.9）。
 *
 * 抽成独立纯函数是为了可单测：复制出去的 JSON 是**用户唯一会看的数据**，
 * 它的 schema 版本与字段口径不该埋在 apply() 里。
 *
 * @module src/client/stats
 */

function buildStatsPayload(state, now) {
  const { impressions, opens } = state.telemetry;
  const telemetry = state.telemetry ?? {};
  const settings = state.settings ?? {};
  return {
    schema: 'immersion-glow/stats',
    version: 2,
    exportedAt: new Date(now).toISOString(),
    telemetry: {
      impressions,
      opens,
      /** 点击率；零曝光时给 null 而不是 NaN。 */
      openRate: impressions > 0 ? Number((opens / impressions).toFixed(3)) : null,
    },
    collections: {
      count: state.collections.length,
      totalActiveMs: state.collections.reduce(
        (sum, item) => sum + (Number.isFinite(item.activeMs) ? item.activeMs : 0),
        0,
      ),
    },
    settings: {
      thresholdsMin: settings.thresholdsMin,
      idleTimeoutMs: settings.idleTimeoutMs,
    },
  };
}

  /* ===== src/client/clipboard.js ===== */
/**
 * 剪贴板写入（PRD §4.9 的「复制统计」）。
 *
 * 为什么不 require('@deepseek-ai/dsh-client-ui-primitives') 的 writeClipboard：
 * 它确实在平台静态表里、今天可用，但官方插件守则明确写着
 *   "Do not `require('@deepseek-ai/dsh-client-ui-primitives')` or load any other
 *    Harness Client package as a module ... They change without notice, a
 *    plain-JS plugin has no type check."
 * 为一个复制功能引入这份风险不划算。自己写 20 行，行为一致，零依赖。
 *
 * 三级降级：navigator.clipboard → execCommand('copy') → 返回 false 让 UI 提示
 * 用户手动选择文本。
 *
 * @module src/client/clipboard
 */

/**
 * 把文本写进系统剪贴板。
 *
 * @param text - 要复制的文本。
 * @param nav - navigator 对象（测试可注入）。
 * @param doc - document 对象（测试可注入）。
 * @returns Promise<boolean> 是否成功。
 */
async function copyText(text, nav, doc) {
  if (typeof text !== 'string' || text.length === 0) return false;

  // 一级：异步剪贴板 API（需要安全上下文，DSH 的本地页面满足）。
  try {
    const clipboard = nav === undefined || nav === null ? undefined : nav.clipboard;
    if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
      await clipboard.writeText(text);
      return true;
    }
  } catch (_error) {
    // 落到下一级；不向上抛，复制失败不该打断 UI。
  }

  // 二级：隐藏 textarea + execCommand。老 WebView / 权限被拒时兜底。
  try {
    if (doc === undefined || doc === null || typeof doc.createElement !== 'function') return false;
    const holder = doc.createElement('textarea');
    holder.value = text;
    holder.setAttribute('readonly', '');
    holder.style.position = 'fixed';
    holder.style.top = '-1000px';
    holder.style.opacity = '0';
    (doc.body ?? doc.documentElement).appendChild(holder);
    if (typeof holder.select === 'function') holder.select();
    const ok =
      typeof doc.execCommand === 'function' ? doc.execCommand('copy') === true : false;
    if (holder.parentNode !== null) holder.parentNode.removeChild(holder);
    return ok;
  } catch (_error) {
    return false;
  }
}

  /* ===== src/client/panel-css.js ===== */
/**
 * 记录卡、画廊、设置行、提醒卡的样式。
 *
 * 光带（band-css.js）已随 ADR-123 退役，本文件是唯一的样式来源。
 *
 * @module src/client/panel-css
 */

const PANEL_CSS = `/* ── 记录卡 / 画廊的公共面板 ─────────────────────────────────────── */
.ig-scrim {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  background: transparent;
}

.ig-panel {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  width: min(420px, calc(100vw - 32px));
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
  animation: ig-panel-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.ig-panel--closing {
  animation: ig-panel-out 0.45s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes ig-panel-in {
  from { opacity: 0; transform: translateX(-50%) translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

@keyframes ig-panel-out {
  from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  to   { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.98); }
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

/* ── 右上角提醒卡（ADR-123）─────────────────────────────────────── */
/* 卡片与未读徽标共用 .ig-reminder 定位：挂在宿主 overlay 的右上角。 */
.ig-reminder {
  position: absolute;
  top: 16px;
  right: 16px;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: min(320px, calc(100vw - 48px));
  padding: 12px 14px;
  border-radius: var(--dsw-radius-lg, 14px);
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.28));
  background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.12));
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  backdrop-filter: blur(18px) saturate(1.4);
  color: var(--dsw-alias-label-primary, currentColor);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.22);
  animation: ig-reminder-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes ig-reminder-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ig-reminder-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
}

.ig-reminder-title {
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
}

.ig-reminder-message {
  font-size: 12.5px;
  line-height: 19px;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
}

.ig-reminder-countdown {
  font-size: 11.5px;
  line-height: 17px;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.8));
  font-variant-numeric: tabular-nums;
}

.ig-reminder-close {
  position: absolute;
  top: 6px;
  right: 6px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  line-height: 18px;
  padding: 2px 6px;
  border-radius: var(--dsw-radius-sm, 6px);
}

.ig-reminder-close:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

/* 未读徽标：倒计时结束后 sticky 提醒的常驻形态，点了才消失。 */
.ig-reminder-badge {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  padding: 4px 8px;
  max-width: none;
  box-shadow: none;
  cursor: pointer;
  border-radius: var(--dsw-radius-full, 999px);
  animation: none;
}

.ig-reminder-badge:hover {
  color: var(--dsw-alias-label-primary, currentColor);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
}

.ig-reminder-badge-dot {
  inline-size: 6px;
  block-size: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--dsw-alias-text-brand, #539cfa);
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

/* ── 动效偏好 ───────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .ig-reminder,
  .ig-panel,
  .ig-panel--closing {
    animation: none;
  }
}
`;

  /* ===== src/client/styles.js ===== */
/**
 * 样式注入器。
 *
 * CSS 本体在 panel-css.js（模块间共享闭包，构建时按序内联）。
 * 光带样式（band-css.js）已随 ADR-123 退役。
 *
 * 三条纪律（PRD §3.1 / §3.2 / 官方插件守则）：
 *   1. 所有类名带 `ig-` 前缀，不污染宿主；
 *   2. 动画只动 `opacity` / `transform`，不触发 layout / paint；
 *   3. 颜色与圆角一律走 `--dsw-alias-*` / `--dsw-radius-*` 主题 token，
 *      取不到时才回落到中性值 —— token 改名只影响观感，不会让组件崩掉。
 *
 * @module src/client/styles
 */

/** 注入标记，用于幂等与卸载清理。 */
const STYLE_TAG_ID = 'dsh-immersion-glow';

/**
 * 注入样式表。重复调用是幂等的；返回 disposer。
 *
 * @param doc - 文档对象（无 DOM 环境传入 undefined，直接跳过）。
 * @returns 清理函数。
 */
function installStyles(doc) {
  if (doc === undefined || doc === null || typeof doc.createElement !== 'function') {
    return () => {};
  }
  const selector = `style[data-plugin=${JSON.stringify(STYLE_TAG_ID)}]`;
  const existing = typeof doc.querySelector === 'function' ? doc.querySelector(selector) : null;
  if (existing !== null) return () => {};

  const tag = doc.createElement('style');
  tag.dataset.plugin = STYLE_TAG_ID;
  tag.textContent = PANEL_CSS;
  (doc.head ?? doc.body).appendChild(tag);
  return () => {
    if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
  };
}

  /* ===== src/client/reminder.js ===== */
/**
 * 右上角提醒卡（ADR-123）。
 *
 * 取代退役的底部光带 + toast：阈值触发时弹出、60 秒倒计时；到点还没点，
 * 阈值提醒（sticky）缩成一条**未读徽标**一直留着，直到用户点击 —— 点击打开
 * 记录卡并清除未读。「已收藏 / 已复制」这类确认走同一张卡但**非粘性**：
 * 到点即消失，也永远不会顶掉一条未读的阈值提醒（守卫在 state.showReminder）。
 *
 * 倒计时是组件本地的 `useState` + `window.setInterval`，**不进 store** ——
 * 每秒 setState 一次会打爆 persist。判断一律用绝对时间戳（deadlineAt），
 * 页面被挂起、断点续跑都不会算错。
 *
 * 测试环境的 fake React 的 useEffect 是 noop，interval 不会真的启动；
 * useState 返回初值本身（不执行惰性初始化函数），所以这里**刻意用急切求值**
 * `useState(Date.now())`，绝不能写 `useState(() => Date.now())`。
 *
 * @module src/client/reminder
 */

/**
 * 渲染提醒（卡片 / 徽标 / 无）。
 *
 * 三种形态：
 *   1. 倒计时内        → 右上角卡片：标题 + 正文 + 倒计时 + 关闭按钮；
 *   2. sticky 已超时   → 未读徽标，常驻直到被点；
 *   3. 非 sticky 已超时 → null（卸载，无痕消失）。
 *
 * @param props - { React, t, reminder, actions }
 *   reminder：store 里的 ui.reminder（null 或 { message, sticky, deadlineAt, seq }）。
 *   actions：store 的 actions 表（用 countOpen / openFromReminder / dismissReminder）。
 * @returns 虚拟 DOM 节点，无提醒或已过期时为 null。
 */
function ReminderCard(props) {
  const { React, t, reminder, actions } = props;
  const useState = React.useState;
  const useEffect = React.useEffect;

  // 急切求值（见文件头说明）。remind 变化时由调用方的 key=seq 强制重挂，
  // 状态自然复位，不需要在这里追同步。
  const [nowMs, setNowMs] = useState(Date.now());

  const hasReminder = reminder !== null && reminder !== undefined && typeof reminder === 'object';
  const deadlineAt = hasReminder && Number.isFinite(reminder.deadlineAt) ? reminder.deadlineAt : 0;
  const sticky = hasReminder === true && reminder.sticky === true;
  const expired = nowMs >= deadlineAt;

  useEffect(() => {
    if (hasReminder !== true || expired === true) return undefined;
    const timer = window.setInterval(() => {
      // 只负责让页面「走秒」；过期判定每帧用绝对时间戳算，不靠它累积。
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasReminder, expired, reminder === null || reminder === undefined ? 0 : reminder.seq]);

  // ── 形态判定 ─────────────────────────────────────────────────────────
  if (hasReminder !== true) return null;
  if (expired === true) {
    if (sticky !== true) return null;
    // 未读徽标：点击 = 打开记录卡并清除未读。
    return React.createElement(
      'button',
      {
        class: 'ig-reminder ig-reminder-badge',
        type: 'button',
        title: t('reminder.unread'),
        'aria-label': t('reminder.unread'),
        onClick: () => {
          actions.countOpen();
          actions.openFromReminder();
        },
      },
      React.createElement('span', { class: 'ig-reminder-badge-dot', 'aria-hidden': 'true' }),
      t('reminder.unread'),
    );
  }

  // 剩余秒数：向上取整，让「60」完整出现一秒，而不是开局就显示 59。
  const secondsLeft = Math.max(0, Math.ceil((deadlineAt - nowMs) / 1000));

  // ── 倒计时内的卡片 ──────────────────────────────────────────────────
  return React.createElement(
    'div',
    {
      class: 'ig-reminder',
      role: 'status',
      'aria-label': t('reminder.aria'),
    },
    React.createElement(
      'button',
      {
        class: 'ig-reminder-body',
        type: 'button',
        onClick: () => {
          actions.countOpen();
          actions.openFromReminder();
        },
      },
      React.createElement('span', { class: 'ig-reminder-title' }, t('reminder.title')),
      React.createElement('span', { class: 'ig-reminder-message' }, reminder.message),
      React.createElement(
        'span',
        { class: 'ig-reminder-countdown' },
        t('reminder.countdown', { n: secondsLeft }),
      ),
    ),
    React.createElement(
      'button',
      {
        class: 'ig-reminder-close',
        type: 'button',
        title: t('reminder.unread'),
        'aria-label': t('reminder.unread'),
        onClick: () => actions.dismissReminder(),
      },
      '×',
    ),
  );
}

  /* ===== src/client/record-card.js ===== */
/**
 * 沉浸记录卡（PRD §2.2 F5/F6/F7 + §3.1 展开/收起动效）。
 *
 * 三格指标：沉浸时长、对话轮次、工具调用；再加时段标签（F14）。
 *
 * 三条口径诚实性要求（PRD §6 已知限制）：
 *   1. 探针只取结构性计数、取不到正文 → 卡片不展示任何内容摘要；
 *   2. 无会话时探针不挂载 → 显示 stale 文案，不静默用旧数据冒充新数据；
 *   3. `hasMore` 为真时统计只覆盖已加载窗口 → 必须显式说明。
 *
 * 生命周期：仅在展开时挂载；收起先播 0.45s 退场动画，再真正卸载
 * （PRD §3.2「仅在展开时挂载，动画结束即卸载」）。
 *
 * @module src/client/record-card
 */

/** 退场动画时长，与 styles.js 里 .ig-panel--closing 的 0.45s 对齐。 */
const CLOSE_ANIMATION_MS = 450;

/**
 * 安全取值：把可能为 undefined 的指标变成可渲染值。
 * @param metrics - store 里的 metrics。
 * @returns 归一化后的指标。
 */
function normalizeMetrics(metrics) {
  if (metrics === null || typeof metrics !== 'object') {
    return { turns: 0, toolCalls: 0, truncated: false, degraded: true, sessionId: null };
  }
  return {
    turns: Number.isFinite(metrics.turns) ? metrics.turns : 0,
    toolCalls: Number.isFinite(metrics.toolCalls) ? metrics.toolCalls : 0,
    truncated: metrics.truncated === true,
    degraded: metrics.degraded === true,
    sessionId: typeof metrics.sessionId === 'string' ? metrics.sessionId : null,
  };
}

/**
 * 渲染沉浸记录卡。
 *
 * @param props - { React, t, useImmersionGlow, durationText, stale, handlers, segment, metrics }
 * @returns React 元素或 null。
 */
function RecordCard(props) {
  const { React, t, useImmersionGlow, durationText, stale, handlers } = props;
  const h = React.createElement;

  const cardOpen = useImmersionGlow((state) => state.ui.cardOpen);
  const savedCount = useImmersionGlow((state) => state.collections.length);

  // segment / metrics 由父层按「当前会话分区」算好后传入 —— 卡片不该自己猜
  // 该显示哪个会话的数据。
  const metricsRaw = props.metrics ?? null;
  const segment = props.segment ?? { startedAt: 0, activeMs: 0 };

  const [closing, setClosing] = React.useState(false);

  /** 播放退场动画后再真正卸载。 */
  const close = React.useCallback(() => {
    setClosing(true);
    const timer = window.setTimeout(() => {
      setClosing(false);
      handlers.closeCard();
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [handlers]);

  // Esc 关闭 + 关闭后清掉 transient closing 态。
  React.useEffect(() => {
    if (!cardOpen) {
      setClosing(false);
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cardOpen, close]);

  if (!cardOpen) return null;

  const metrics = normalizeMetrics(metricsRaw);
  const tags = tagsOf(segment.startedAt, segment.activeMs);

  /** 一格指标。 */
  const metric = (label, value) =>
    h(
      'div',
      { className: 'ig-metric', key: label },
      h('dt', null, label),
      h('dd', null, value),
    );

  /** 一条说明，warn 为真时用警示色。 */
  const note = (text, warn) =>
    h('p', { className: warn === true ? 'ig-note ig-note--warn' : 'ig-note', key: text }, text);

  const notes = [];
  if (stale) notes.push(note(t('card.stale'), true));
  if (metrics.degraded) notes.push(note(t('card.degraded'), true));
  else if (metricsRaw === null) notes.push(note(t('card.noData')));
  if (metrics.truncated) notes.push(note(t('card.windowTruncated')));

  return h(
    React.Fragment,
    null,
    h('div', { className: 'ig-scrim', onClick: close, 'aria-hidden': 'true' }),
    h(
      'div',
      {
        className: closing ? 'ig-panel ig-panel--closing' : 'ig-panel',
        role: 'dialog',
        'aria-modal': 'false',
        'aria-label': t('card.title'),
      },
      h(
        'div',
        { className: 'ig-panel-head' },
        h('h2', { className: 'ig-panel-title' }, t('card.title')),
        h('button', { type: 'button', className: 'ig-panel-close', onClick: close }, t('card.close')),
      ),

      h(
        'dl',
        { className: 'ig-metrics' },
        metric(t('card.duration'), durationText),
        metric(t('card.turns'), metrics.degraded ? '—' : String(metrics.turns)),
        metric(t('card.toolCalls'), metrics.degraded ? '—' : String(metrics.toolCalls)),
      ),

      tags.length > 0
        ? h(
            'div',
            { className: 'ig-tags' },
            tags.map((id) => h('span', { className: 'ig-tag', key: id }, t(`tag.${id}`))),
          )
        : null,

      notes.length > 0 ? h('div', null, notes) : null,

      h(
        'div',
        { className: 'ig-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'ig-btn ig-btn--primary',
            onClick: handlers.saveCurrentRecord,
            // 不足 1 分钟的记录没有收藏价值，禁用避免堆垃圾。
            disabled: segment.activeMs < 60000,
          },
          savedCount > 0
            ? `${t('card.save')} · ${t('gallery.count', { n: savedCount })}`
            : t('card.save'),
        ),
        h(
          'button',
          { type: 'button', className: 'ig-btn ig-btn--quiet', onClick: handlers.openGallery },
          t('card.openGallery'),
        ),
      ),
    ),
  );
}

  /* ===== src/client/gallery.js ===== */
/**
 * 收藏画廊（PRD §2.2 F7 + 报告的必做补充项）。
 *
 * MVP 必需的两条删除能力（报告 §3.4 明确指出缺失）：
 *   1. 删除单条收藏；
 *   2. 清空全部（两次点击确认，避免误触）。
 *
 * @module src/client/gallery
 */

/**
 * 渲染收藏画廊。
 *
 * @returns React 元素或 null。
 */
function Gallery(props) {
  const { React, t, useImmersionGlow, actions, handlers } = props;
  const h = React.createElement;

  const open = useImmersionGlow((state) => state.ui.galleryOpen);
  const collections = useImmersionGlow((state) => state.collections);
  const [confirmClear, setConfirmClear] = React.useState(false);

  // 关闭时清掉确认态，避免下次打开还停在「再点一次」。
  React.useEffect(() => {
    if (!open) setConfirmClear(false);
  }, [open]);

  if (!open) return null;

  const remove = (id) => actions.removeRecord(id);

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    actions.clearGallery();
    setConfirmClear(false);
  };

  const row = (item) => {
    const tags = Array.isArray(item.tags) ? item.tags : tagsOf(item.createdAt, item.activeMs);
    return h(
      'li',
      { className: 'ig-row', key: item.id },
      h(
        'div',
        { className: 'ig-row-main' },
        h('span', { className: 'ig-row-duration' }, formatDuration(item.activeMs, t)),
        h(
          'span',
          { className: 'ig-row-sub' },
          [
            t('card.turns') + ' ' + (Number.isFinite(item.turns) ? item.turns : 0),
            t('card.toolCalls') + ' ' + (Number.isFinite(item.toolCalls) ? item.toolCalls : 0),
            tags.map((id) => t(`tag.${id}`)).join(' · '),
          ]
            .filter((piece) => piece.length > 0)
            .join(' · '),
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'ig-row-remove',
          onClick: () => remove(item.id),
          'aria-label': t('gallery.remove.aria'),
          title: t('gallery.remove'),
        },
        '×',
      ),
    );
  };

  return h(
    React.Fragment,
    null,
    h('div', { className: 'ig-scrim', onClick: handlers.closeGallery, 'aria-hidden': 'true' }),
    h(
      'div',
      { className: 'ig-panel', role: 'dialog', 'aria-modal': 'false', 'aria-label': t('gallery.title') },
      h(
        'div',
        { className: 'ig-panel-head' },
        h('h2', { className: 'ig-panel-title' }, t('gallery.title')),
        h('button', { type: 'button', className: 'ig-panel-close', onClick: handlers.closeGallery }, t('gallery.back')),
      ),
      h('p', { className: 'ig-note' }, t('gallery.count', { n: collections.length })),
      collections.length === 0
        ? h('p', { className: 'ig-note' }, t('gallery.empty'))
        : h('ul', { className: 'ig-list' }, collections.map(row)),
      collections.length > 0
        ? h(
            'div',
            { className: 'ig-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'ig-btn ig-btn--danger',
                onClick: clearAll,
              },
              confirmClear ? t('gallery.clear.confirm') : t('gallery.clear'),
            ),
          )
        : null,
    ),
  );
}

  /* ===== src/client/settings-row.js ===== */
/**
 * 设置行（PRD §2.1 F4 最小形态 + §4.9 埋点展示）。
 *
 * 挂载点：`settings.general.item`（kind: list, scope: root）。
 *
 * 关键事实（已核对插槽目录）：这个插槽的 ownerProps 是空的，**没有任何人投影
 * `label`** —— 官方文档写明 "[the row] draws its own internals, including its
 * label: nothing projects a `label` here"。所以 PRD §4.7 里的
 * `label: () => t('settings.row.label')` 是死代码，本实现不传 label，标题自己画。
 *
 * 行内容：
 *   - 标题 + 描述 + 启用开关
 *   - 触发阈值（逗号分隔的数字列表，非法输入就地标红且不写回）
 *   - 空闲冻结分钟
 *   - 输入框常驻计时开关
 *   - 埋点一行 + 复制统计
 *   - 清除本插件数据（两次确认）
 *
 * 强度选择（呼吸 / 静默）已随光带退役删除（ADR-123）。
 *
 * @module src/client/settings-row
 */

/**
 * 渲染设置行。
 *
 * @returns React 元素。
 */
function SettingsRow(props) {
  const { React, t, useImmersionGlow, actions, onCopyStats, onOpenGallery } = props;
  const h = React.createElement;

  const settings = useImmersionGlow((state) => state.settings);
  const telemetry = useImmersionGlow((state) => state.telemetry);
  const collectionCount = useImmersionGlow((state) => state.collections.length);

  // 阈值输入用本地受控态：允许用户输到一半（如空串、结尾逗号）而不写回 store。
  const [thresholdText, setThresholdText] = React.useState(
    settings.thresholdsMin.join(', '),
  );
  const [thresholdInvalid, setThresholdInvalid] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);

  // 外部改动（如清除数据）后同步回输入框。
  React.useEffect(() => {
    setThresholdText(settings.thresholdsMin.join(', '));
    setThresholdInvalid(false);
  }, [settings.thresholdsMin]);

  const commitThresholds = (text) => {
    setThresholdText(text);
    const parsed = parseThresholds(text);
    if (!parsed.ok) {
      setThresholdInvalid(true);
      return;
    }
    setThresholdInvalid(false);
    // 值没变就不写，避免无意义持久化。
    const current = settings.thresholdsMin.join(',');
    if (parsed.value.join(',') !== current) {
      actions.updateSettings({ thresholdsMin: parsed.value });
    }
  };

  const commitIdleMinutes = (raw) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1 || value > 120) return;
    actions.updateSettings({ idleTimeoutMs: Math.round(value) * 60000 });
  };

  const clearData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    actions.resetAll(Date.now());
    setConfirmClear(false);
  };

  const switchRow = (labelText, checked, onChange) =>
    h(
      'label',
      { className: 'ig-switch' },
      h('input', { type: 'checkbox', checked, onChange: (event) => onChange(event.target.checked) }),
      labelText,
    );

  return h(
    'div',
    { className: 'ig-settings' },

    h(
      'div',
      { className: 'ig-settings-head' },
      h(
        'div',
        { className: 'ig-settings-text' },
        h('span', { className: 'ig-settings-title' }, t('settings.title')),
        h('span', { className: 'ig-settings-desc' }, t('settings.desc')),
      ),
      switchRow(t('settings.enabled'), settings.enabled, (checked) =>
        actions.updateSettings({ enabled: checked }),
      ),
    ),

    settings.enabled
      ? h(
          'div',
          null,

          h(
            'div',
            { className: 'ig-settings-fields' },

            // 阈值
            h(
              'label',
              { className: 'ig-field' },
              h('span', { className: 'ig-field-label' }, t('settings.thresholds')),
              h('input', {
                className: thresholdInvalid ? 'ig-input ig-input--invalid' : 'ig-input',
                type: 'text',
                value: thresholdText,
                onChange: (event) => commitThresholds(event.target.value),
                'aria-invalid': thresholdInvalid,
                inputMode: 'numeric',
              }),
            ),

            // 空闲冻结
            h(
              'label',
              { className: 'ig-field' },
              h('span', { className: 'ig-field-label' }, t('settings.idle')),
              h('input', {
                className: 'ig-input',
                type: 'number',
                min: 1,
                max: 120,
                step: 1,
                value: String(Math.round(settings.idleTimeoutMs / 60000)),
                onChange: (event) => commitIdleMinutes(event.target.value),
              }),
            ),
          ),

          thresholdInvalid
            ? h('p', { className: 'ig-note ig-note--warn' }, t('settings.thresholds.invalid'))
            : h('p', { className: 'ig-note' }, t('settings.thresholds.hint')),

          switchRow(t('settings.inlineTimer'), settings.showInlineTimer, (checked) =>
            actions.updateSettings({ showInlineTimer: checked }),
          ),
        )
      : null,

    // 收藏入口。
    //
    // 以前画廊只能从记录卡里的按钮进 —— 卡片一关就再也找不到收藏了。
    // 设置行是常驻的，把它放这里才是「收藏完之后去哪里看」的答案。
    h(
      'div',
      { className: 'ig-actions' },
      h(
        'button',
        {
          type: 'button',
          className: 'ig-btn',
          onClick: onOpenGallery,
          disabled: collectionCount === 0,
        },
        collectionCount > 0
          ? t('gallery.openFromSettings', { n: collectionCount })
          : t('gallery.emptyFromSettings'),
      ),
    ),

    // 埋点展示 —— 解 PRD §0 变更 12 的「零网络却要验证点击率」矛盾
    h(
      'div',
      { className: 'ig-actions' },
      h(
        'span',
        { className: 'ig-note' },
        t('settings.telemetry', {
          impressions: telemetry.impressions,
          opens: telemetry.opens,
        }),
      ),
      h(
        'button',
        { type: 'button', className: 'ig-btn ig-btn--quiet', onClick: onCopyStats },
        t('settings.copy'),
      ),
      h(
        'button',
        { type: 'button', className: 'ig-btn ig-btn--quiet ig-btn--danger', onClick: clearData },
        confirmClear ? t('settings.clearData.confirm') : t('settings.clearData'),
      ),
    ),
  );
}

  /* ===== src/client/probe.js ===== */
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

  /* ===== src/client/slots.js ===== */
/**
 * 三处插槽的注册。
 *
 * 单独成文件的原因：每个组件都要把「标准 props + store 选择器 + handlers」
 * 组装成子组件的入参，这部分样板占了 apply() 的一半以上。抽出来后
 * index.js 只剩「装配与副作用生命周期」，读起来能一眼看完。
 *
 * 三处挂载点（已核实 kind/scope）：
 *   ① shell.overlay            list / root     记录卡 + 画廊 + 右上角提醒卡
 *   ② settings.general.item    list / root     设置行
 *   ③ conversation.input.left  list / session  探针（默认 null）
 *
 * ## stale 判定的权威来源（ADR-123，两次实测事故的结论）
 *
 * `shell.overlay` 挂在 **root** 作用域：root 束只有 ui-session 的
 * `{ hooks: { sessions, sessionStatus }, keyedHooks: { sessionRetainInfo } }`
 * 与 layout 的 `{ hooks: { panelInfo } }`。**没有 `sessionId` props** —— 它只
 * 在 session 作用域注入（BUILTIN_SOURCE）。第一版在这里读 `props.sessionId`，
 * 恒为 undefined，stale 恒真。
 *
 * 所以 root 侧的「当前会话」只能自己解析：读 `useSessions`（SessionListState
 * 的快照）取 `retainedBy.mainView > 0` 的行 —— 这与 ui-session 自己
 * `publishMain()` 选主视图会话的判据逐字相同（0.2.0-rc.2 ext-big.js:74471）。
 * 解析不出（首页/无会话）时才允许 stale 生效；此时再对照
 * activeSessionId 与 metrics.sessionId 是否一致，双保险。
 *
 * @module src/client/slots
 */

/**
 * 从 SessionListState 快照解析「主视图正在持有的会话 id」。
 *
 * 与 session-id.js 的 resolveCurrentSessionId 判据一致（mainView > 0 → ids
 * 末位兜底），但独立成小函数，因为它只服务 stale 派生，不参与计时认领。
 *
 * @param list - `useSessions((s) => s)` 的返回值，形状任意。
 * @returns {string|null} 当前会话 id 或 null。
 */
function resolveMainViewSessionId(list) {
  if (list === null || typeof list !== 'object') return null;

  // ui-session 的 SessionListState：{ ids, byId, phase, projectionsBySession }。
  const byId = list.byId;
  const ids = Array.isArray(list.ids) ? list.ids : null;
  const mainViewOf = (row) => {
    const retainedBy = row === null || row === undefined ? undefined : row.retainedBy;
    const count = retainedBy === null || retainedBy === undefined ? undefined : retainedBy.mainView;
    return typeof count === 'number' && count > 0;
  };

  if (byId !== null && typeof byId === 'object') {
    if (ids !== null) {
      for (const id of ids) {
        if (mainViewOf(byId[id])) return id;
      }
    } else {
      for (const id of Object.keys(byId)) {
        if (mainViewOf(byId[id])) return id;
      }
    }
  }

  // 老版本可能直接暴露 current；读它无害。
  if (typeof list.current === 'string' && list.current.length > 0) return list.current;

  // 末位兜底（宿主按「最新在后」排序列表）。
  if (ids !== null && ids.length > 0) {
    const last = ids[ids.length - 1];
    if (typeof last === 'string' && last.length > 0) return last;
  }
  return null;
}

/**
 * 注册全部插槽。
 *
 * @param params - { ctx, React, actions, translator, handlers, webState }
 * @returns 无。
 */
function registerSlots(params) {
  const { ctx, React, actions, translator, handlers } = params;
  const h = React.createElement;

  // ① shell.overlay：记录卡 + 画廊 + 右上角提醒卡 ────────────────────
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: 'immersion-glow.layer', order: 100 },
      function ImmersionLayer(props) {
        const useImmersionGlow = props.useImmersionGlow;
        const t = translator();

        // 分区随 activeSessionId / sessions 变化，selector 两个都要选到。
        const activeSessionId = useImmersionGlow((value) => value.activeSessionId);
        const sessionsMap = useImmersionGlow((value) => value.sessions);
        const durationText = React.useMemo(() => {
          const seg = (sessionsMap?.[activeSessionId] || {}).segment;
          return formatDuration(seg === undefined ? 0 : seg.activeMs, t);
        }, [sessionsMap, activeSessionId, t]);

        const reminder = useImmersionGlow((value) => value.ui.reminder);
        // 记录卡的时段标签从分区起止时间推导（tagsOf），必须把分区本体传下去。
        const segment = React.useMemo(() => {
          const seg = (sessionsMap?.[activeSessionId] || {}).segment;
          return seg ?? { startedAt: 0, lastActiveAt: 0, activeMs: 0, activeRuns: 0, firedCount: 0 };
        }, [sessionsMap, activeSessionId]);
        const metrics = React.useMemo(() => {
          const bucket = sessionsMap?.[activeSessionId];
          return bucket === undefined ? null : bucket.metrics;
        }, [sessionsMap, activeSessionId]);

        // ── stale 判定（ADR-123）────────────────────────────────────
        // root 作用域没有 props.sessionId；「当前会话」由 useSessions 的
        // mainView 判据解析（与宿主 publishMain 同源）。解析不出来时退回
        // activeSessionId（探针认领的指针），两个都没有才当「无会话」。
        // useSessions 是宿主束的标准 hook，但测试环境可能不传 —— 守卫成
        // null，绝不能裸引用（未传时是 ReferenceError，会顶掉整个图层）。
        const useSessions = typeof props.useSessions === 'function' ? props.useSessions : null;
        const sessionList = useSessions === null ? null : useSessions((value) => value);
        const mainViewId = React.useMemo(() => resolveMainViewSessionId(sessionList), [sessionList]);
        const currentId = mainViewId ?? activeSessionId;
        const stale =
          metrics === null
            ? false
            : metrics.sessionId === null ||
              currentId === null ||
              metrics.sessionId !== currentId;

        const shared = {
          React,
          t,
          useImmersionGlow,
          actions: props.immersionGlowActions ?? actions,
          durationText,
          stale,
          handlers,
          segment,
          metrics,
        };

        // 提醒卡（ADR-123）：倒计时 / 未读徽标都封装在 ReminderCard 里，
        // 这层只负责「有提醒就挂上」。key=seq 让新提醒强制重挂，组件里的
        // 本地计时状态随之复位。
        return h(
          React.Fragment,
          null,
          h(RecordCard, shared),
          h(Gallery, shared),
          reminder !== null && reminder !== undefined
            ? h(ReminderCard, {
                key: reminder.seq,
                React,
                t,
                reminder,
                actions: props.immersionGlowActions ?? actions,
              })
            : null,
        );
      },
    ),
  );

  // ── ② settings.general.item：设置行 ───────────────────────────────
  ctx.slots.inject('settings.general.item', () =>
    ctx.slots.register(
      { name: 'settings.general.item', id: 'immersion-glow.settings', order: 100 },
      function ImmersionSettings(props) {
        return h(SettingsRow, {
          React,
          t: translator(),
          useImmersionGlow: props.useImmersionGlow,
          actions: props.immersionGlowActions ?? actions,
          onCopyStats: handlers.copyStats,
          // 关闭记录卡后仍能进画廊的唯一入口（画廊面板挂在 shell.overlay）。
          onOpenGallery: () => {
            actions.setCardOpen(false);
            actions.setGalleryOpen(true);
          },
        });
      },
    ),
  );

  // ── ③ conversation.input.left：探针（默认 null） ───────────────────
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      { name: 'conversation.input.left', id: 'immersion-glow.probe', order: 100 },
      function ImmersionProbe(props) {
        const t = translator();

        // session 作用域的 standard props 里有 `sessionId: SessionId` —— 宿主
        // 直接给的、比在 root 侧反推更权威。探针每次渲染都把它认领回 root，
        // 于是即便 sessions.list 的解析在某个版本失效，分区指针仍然能切对。
        // （认领是幂等的：同一个 id 再 switchSession 只是刷新 updatedAt。）
        claimSessionFromProps(props.immersionGlowActions ?? actions, props, Date.now());

        const durationText = props.useImmersionGlow((value) => {
          // 常驻计时读**当前会话的分区**，不是顶层 segment。
          const seg = (value.sessions?.[value.activeSessionId] || {}).segment;
          return formatDuration(seg === undefined ? 0 : seg.activeMs, t);
        });
        const showInlineTimer = props.useImmersionGlow((value) => value.settings.showInlineTimer);
        return h(SessionProbe, {
          React,
          t,
          // 计数的真实数据源：ui-chat 注入的 chat 快照（useSession 的
          // ConversationSnapshot 只有控制字段，数节点恒为 0 —— ADR-123）。
          useChat: props.useChat,
          useSession: props.useSession,
          useImmersionGlow: props.useImmersionGlow,
          actions: props.immersionGlowActions ?? actions,
          showInlineTimer,
          durationText,
          sessionId: props.sessionId,
        });
      },
    ),
  );
}

  /* ===== src/client/index.js ===== */
/**
 * 浏览器半入口：apply(ctx) 与三处注册。
 *
 * ## 架构（与 PRD §4.7 的关键偏离，原因见 state.js 文件头）
 *
 *   apply(ctx)
 *     ├─ defineStore + create()  → 唯一 root 实例
 *     ├─ ctx.slots.provideRoot({ hooks:{ immersionGlow }, props:{ immersionGlowActions, igReact } })
 *     ├─ locale 字典（惰性取用的服务）
 *     ├─ 计时器 / 交互监听 / 多标签同步 / 可见性（全部经 ctx.effect）
 *     └─ 三处 ctx.slots.inject(key, () => ctx.slots.register(...))
 *          ① shell.overlay            (root)    记录卡 + 画廊 + 右上角提醒卡
 *          ② settings.general.item    (root)    设置行
 *          ③ conversation.input.left  (session) 探针（默认 null）
 *
 * provideRoot 的 root 贡献会被合并进**所有 scope** 的 standard props，所以三处
 * 都能拿到同一个 useImmersionGlow / actions，不需要 slot 的 store 座，也就绕开
 * 了「one handle, one scope」的硬校验。
 *
 * ## cordis inject 只有一项
 * `export const inject = ['slots']` —— 只声明必然存在的服务。`locale` 与
 * `sessions` 走 ctx.get() 惰性取用 + 守卫：缺失时插件仍能加载，只是降级。
 * **绝不能**把可选服务写进 inject —— fiber 卡在 pending 会让整个 DSH 前端报
 * "did not activate" 而进不去。
 *
 * `dsh.client.inject`（package.json 里）是另一回事：只影响加载/预取排序，不提供
 * 任何服务（源码原文 "informational ... never apply sequencing"），故留空。
 *
 * @module src/client/index
 */

/**
 * 递归查询 clipboard 的稳定引用，避免每次渲染重建。
 * @deprecated 保留位置说明：实际实现见 clipboard.js 的 copyText。
 */

/**
 * 打包埋点与收藏为可复制 JSON（PRD §4.9，带版本标记便于后续解析）。
 *
 * @param state - store 快照。
 * @param now - 导出时间戳。
 * @returns 可直接 JSON.stringify 的对象。
 */
/**
 * 浏览器半的插件体。
 *
 * @param ctx - DSH 客户端 cordis 上下文。
 */
function apply(ctx) {
  const React = require('react');
  const { defineStore } = require('@deepseek-ai/dsh-client-store');
  const h = React.createElement;

  // ── 服务惰性取用（不进 inject，见文件头） ──────────────────────────
  const locale = ctx.get('locale');

  // ── 状态实例：apply 内构造，绝不放模块级 ───────────────────────────
  //
  // ⚠ 顺序有讲究：先把 localStorage 里的旧 schema 归一，再 handle.create()。
  // 引擎的 attachPersistence 会在 create() 内部直接 setState(旧值, true) 整体
  // 替换，没有 migrate 钩子 —— 这里是唯一能拦住旧数据的地方。see state.js。
  preparePersistedState(typeof localStorage === 'undefined' ? undefined : localStorage, Date.now());

  const handle = createStoreHandle(defineStore);
  const instance = handle.create();
  const state = () => instance.getSnapshot();
  const actions = instance.actions;

  // 立刻复位「只在本次页面生命周期内有效」的 UI 态。
  //
  // persist 会把整个 state 从 localStorage 读回来，包括 ui.cardOpen / reminder。
  // 不复位的话，刷新后会凭空弹出记录卡；提醒恢复回来时 deadlineAt 已是过去时，
  // 会以「未读徽标」的怪形态闪一下。语义与取舍见 resetTransient / ADR-123。
  actions.resetTransient();

  // ── 样式：随 ctx.effect 卸载 ──────────────────────────────────────
  ctx.effect(
    () => installStyles(typeof document === 'undefined' ? undefined : document),
    'immersion-glow: styles',
  );

  // ── i18n ─────────────────────────────────────────────────────────
  if (locale !== undefined && locale !== null) {
    ctx.effect(
      () => locale.register(NS, { zh: ZH, en: EN }),
      'immersion-glow: dictionaries',
    );
  }

  /** 当前语言下的翻译函数。字典重注册时 locale 会推进 revision，组件自然跟随。 */
  const translator = () => {
    let lang = 'zh';
    if (locale !== undefined && locale !== null && typeof locale.getSnapshot === 'function') {
      lang = languageOf(locale.getSnapshot());
    }
    return createTranslator(undefined, lang);
  };

  // ── 分区读取器 ───────────────────────────────────────────────────
  /**
   * 取「当前视角」的计时分区。
   *
   * 为什么需要这一层：一段沉浸时长属于**会话**，不属于窗口。只有一份全局
   * segment 时，开新窗口或切会话都会继承上一轮的时间（实测 bug）。
   *
   * 拿不到分区时回退到一份零值分区，**绝不**回退到别的会话 —— 宁可显示 0，
   * 也不显示不属于你的时间。
   *
   * @param snapshot - store 快照。
   * @returns {{ segment, metrics }} 当前会话的分区。
   */
  const currentBucket = (snapshot) => {
    const id = snapshot.activeSessionId;
    const sessions = snapshot.sessions;
    const bucket =
      typeof id === 'string' && sessions !== null && typeof sessions === 'object'
        ? sessions[id]
        : undefined;
    if (bucket !== undefined) return bucket;
    // 无会话 / 尚未建立分区：用 epoch 起点的空分区。
    return {
      segment: { startedAt: 0, lastActiveAt: 0, activeMs: 0, activeRuns: 0, firedCount: 0 },
      metrics: null,
    };
  };

  // ── 会话跟随：切会话即切分区 ──────────────────────────────────────
  //
  // 探针在 session scope 里能用 useSession，但它在 render 里不该写状态。
  // 这里在 root 侧订阅 sessions.list，让「当前会话变了」第一时间反映到分区。
  //
  // ⚠ 解析逻辑在 session-id.js：DSH 0.2.0-rc.2 的 SessionListState **没有**
  // `current` 字段（只有 ids / byId / phase / projectionsBySession）。这里直接
  // 读 list.current 会恒得 undefined，导致计时器整个空转 —— 已实测踩过。
  ctx.effect(() => {
    const sessions = ctx.get('sessions');
    if (sessions === undefined || sessions === null || sessions.list === undefined) {
      return () => {};
    }
    let lastSeen = null;
    const sync = () => {
      const current = resolveCurrentSessionId(sessions.list.getSnapshot());
      if (current === lastSeen) return;
      lastSeen = current;
      if (current === null) return;
      // 切到没有分区的会话时建一个空分区 —— 不继承别的会话的时长。
      actions.switchSession({ sessionId: current, now: Date.now() });
    };
    sync();
    return sessions.list.subscribe(sync);
  }, 'immersion-glow: follow current session');

  // ── root 共享面 ──────────────────────────────────────────────────
  // hooks 的 key 会变成 use<Name>；props 原样透传给所有插槽组件。
  ctx.slots.provideRoot({
    hooks: { immersionGlow: instance },
    props: {
      immersionGlowActions: actions,
      /** 平台注入的 React：组件经 props 拿，不做 ESM import。 */
      igReact: React,
      /**
       * 当前分区的读取器。
       *
       * 组件不能直接读 state.segment（那已不再是权威来源），一律经它取。
       * 放进 props 而不是 hooks，是因为它是普通函数、不参与订阅；
       * 订阅仍走 useImmersionGlow 选到 activeSessionId / sessions 上。
       */
      igCurrentBucket: currentBucket,
    },
  });

  // ── 计时器 ───────────────────────────────────────────────────────
  let lastTickAt = null;

  /** 一次 tick：推进状态机并落地副作用。 */
  const runTick = () => {
    const now = Date.now();
    const snapshot = state();
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';

    // 当前会话没有分区时（例如启动瞬间还没拿到 current），本 tick 不计时。
    const sessionId = snapshot.activeSessionId;
    if (!hasSessionBucket(snapshot, sessionId)) {
      lastTickAt = now;
      return;
    }

    const bucket = currentBucket(snapshot);
    const result = tick({
      segment: bucket.segment,
      now,
      lastTickAt,
      visible,
      idleTimeoutMs: snapshot.settings.idleTimeoutMs,
      resetGapMs: snapshot.settings.resetGapMs,
      thresholdsMin: snapshot.settings.thresholdsMin,
    });

    const before = bucket.segment;
    const after = result.segment;
    if (
      after !== before ||
      after.activeMs !== before.activeMs ||
      after.firedCount !== before.firedCount ||
      after.activeRuns !== before.activeRuns ||
      after.lastActiveAt !== before.lastActiveAt
    ) {
      actions.writeSession({ sessionId, segment: after, now });
    }
    lastTickAt = now;

    // 跨零点：重置今日统计（时段保留）。
    if (isDifferentLocalDay(snapshot.today.date, now)) actions.rollDay(now);

    // 旧时段结束 → 达门槛就入库。
    if (result.effects.reset && result.effects.saved !== null) {
      const saved = result.effects.saved;
      const record = toRecord(saved, bucket.metrics, now);
      if (record !== null) {
        actions.saveRecord({ ...record, tags: tagsOf(saved.startedAt, saved.activeMs) });
      }
    }

    // 越过阈值 → 右上角提醒卡（sticky：60s 倒计时，超时转未读徽标）。
    if (result.effects.fire !== null) {
      actions.countImpression();
      actions.showReminder({ message: translator()('reminder.body'), sticky: true });
    }
  };

  ctx.effect(() => {
    const timer = window.setInterval(runTick, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, 'immersion-glow: timer');

  // 交互信号：pointerdown / keydown / wheel + 500ms 节流 mousemove（PRD §2.1 F1）。
  ctx.effect(() => {
    let lastMove = 0;
    const note = () => {
      const snapshot = state();
      const sessionId = snapshot.activeSessionId;
      if (!hasSessionBucket(snapshot, sessionId)) return;
      const now = Date.now();
      actions.writeSession({
        sessionId,
        segment: noteActivity(currentBucket(snapshot).segment, now, snapshot.settings.idleTimeoutMs),
        now,
      });
    };
    const onMove = () => {
      const now = Date.now();
      if (now - lastMove < 500) return;
      lastMove = now;
      note();
    };

    window.addEventListener('pointerdown', note, { passive: true });
    window.addEventListener('keydown', note, { passive: true });
    window.addEventListener('wheel', note, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', note);
      window.removeEventListener('keydown', note);
      window.removeEventListener('wheel', note);
      window.removeEventListener('mousemove', onMove);
    };
  }, 'immersion-glow: activity listeners');

  // 多标签同步（PRD §2.4）。defineStore 的 persist 只在创建时读一次、之后单向
  // 写入，**不监听 storage**，所以这一层必须自己写：单键共享，取更大的 activeMs。
  ctx.effect(() => {
    const onStorage = (event) => {
      if (event.key !== PERSIST_KEY || typeof event.newValue !== 'string') return;
      try {
        const incoming = JSON.parse(event.newValue);
        // persist 写的是整个 state，所以对方的分区在 sessions[对方 activeSessionId]。
        const theirId = incoming?.activeSessionId;
        const theirSeg =
          typeof theirId === 'string' && incoming?.sessions?.[theirId]
            ? incoming.sessions[theirId].segment
            : incoming?.segment;
        const theirMs = theirSeg?.activeMs;
        const theirAt = theirSeg?.lastActiveAt;
        if (!Number.isFinite(theirMs) || !Number.isFinite(theirAt)) return;
        const local = state();
        const sessionId = local.activeSessionId;
        if (!hasSessionBucket(local, sessionId)) return;
        const localSeg = currentBucket(local).segment;
        if (theirMs > localSeg.activeMs) {
          actions.writeSession({
            sessionId,
            segment: {
              ...localSeg,
              activeMs: theirMs,
              lastActiveAt: Math.max(localSeg.lastActiveAt, theirAt),
            },
            now: Date.now(),
          });
        }
      } catch (_error) {
        // 坏数据忽略，不影响本标签。
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, 'immersion-glow: cross-tab sync');

  // 页面可见性：切回时立即跑一次 tick，让「续算 / 重置」判定及时生效。
  ctx.effect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runTick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, 'immersion-glow: visibility');

  // ── 共用处理函数（供各组件 props 传递） ────────────────────────────
  const handlers = {
    openCard: () => {
      actions.countOpen();
      actions.setCardOpen(true);
    },
    closeCard: () => actions.setCardOpen(false),
    openGallery: () => actions.setGalleryOpen(true),
    closeGallery: () => actions.setGalleryOpen(false),
    /** 收藏当前时段。 */
    saveCurrentRecord: () => {
      const snapshot = state();
      const bucket = currentBucket(snapshot);
      const record = toRecord(bucket.segment, bucket.metrics, Date.now());
      const t = translator();
      if (record === null) return;
      actions.saveRecord({
        ...record,
        tags: tagsOf(bucket.segment.startedAt, bucket.segment.activeMs),
      });
      // 确认走同一张提醒卡（非 sticky：到点即消失，不产生未读）。
      actions.showReminder({ message: t('card.saved') });
    },
    /** 复制统计 JSON 到剪贴板（PRD §4.9）。 */
    copyStats: async () => {
      const payload = buildStatsPayload(state(), Date.now());
      const ok = await copyText(
        JSON.stringify(payload, null, 2),
        typeof navigator === 'undefined' ? undefined : navigator,
        typeof document === 'undefined' ? undefined : document,
      );
      const t = translator();
      actions.showReminder({ message: ok ? t('settings.copied') : t('settings.copyFailed') });
    },
  };

  // ── 三处插槽 ─────────────────────────────────────────────────────
  registerSlots({ ctx, React, actions, translator, handlers });
}

exports.inject = ['slots'];
exports.apply = apply;

    return module.exports;
  },
});
