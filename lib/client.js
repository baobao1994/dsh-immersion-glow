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
  'reminder.body': '你已经沉浸了一段时间，点击查看这次任务的账。',
  'reminder.countdown': '{n} 秒后自动收起',
  'reminder.unread': '有一条未读的沉浸提醒',
  'reminder.aria': '沉浸提醒',

  // ── 右上角常驻读数 ───────────────────────────────────────────────
  'hud.title': '这次任务',
  'hud.noModel': '还没发起',
  'hud.untitled': '未命名任务',
  'hud.open.aria': '沉浸 {duration}，点击查看明细',
  'hud.collapse.aria': '收起明细',
  'hud.bar.aria': '各模型耗时占比',
  'hud.modelTime': '模型耗时',
  'hud.toolTime': '工具耗时',
  'hud.turns': '{n} 轮',
  'hud.steps': '{n} 步',
  'hud.empty': '还没有模型记录。发起一次询问后这里才会有数据。',
  'hud.verdictLabel': '你评过：',
  'hud.restIn': '下次提醒还有 {duration}',
  // 提醒现在是计时器的一种状态，文案因此是「一句话」而不是一张卡片的标题+正文。
  'hud.alert.body': '该歇一下了',
  'hud.alert.unread': '有提醒未看',
  'hud.alert.seconds': '{n}s 后收起',
  'hud.alert.dismiss': '知道了',
  'hud.openCard': '打开记录卡',
  'hud.openSummary': '看汇总',

  'card.title': '沉浸记录',
  'card.duration': '沉浸时长',
  'card.turns': '对话轮次',
  'card.toolCalls': '工具调用',
  'card.modelTime': '模型耗时',
  'card.tags': '时段',
  'card.close': '关闭',
  'common.back': '返回',
  'card.save': '收藏这张记录',
  'card.saved': '已收藏',
  'card.openGallery': '查看收藏',
  'card.openSummary': '看汇总',
  'card.untitled': '未命名任务',
  'card.windowTruncated': '仅统计当前窗口内的数据，更早的历史未加载。',
  'card.degraded': '数据暂不可用',
  'card.stale': '无打开会话，以下为上一次会话的统计。',
  'card.noData': '还没有可统计的会话数据。',
  'card.cancelled': '中断 {duration}',
  'card.models': '各模型',
  'card.models.empty': '没有模型记录。发起一次询问后这里才会有数据。',
  'card.history': '历史累计',
  'card.history.sessions': '累计 {n} 轮',
  'card.history.calls': '{n} 次调用',
  'card.note.add': '这次用着怎么样？',
  'card.note.edit': '改一下',
  'card.note.placeholder': '哪里顺手、哪里别扭（可留空）',
  'card.note.bare': '（只打了分，没写）',
  'card.rating.1': '差',
  'card.rating.2': '一般',
  'card.rating.3': '还好',
  'card.rating.4': '顺手',
  'card.rating.5': '极其顺手',
  'card.rating.aria': '打 {n} 分',
  'card.rating.summary': '你给 {score} 分',
  'card.verdict.title': '达到目的了吗',
  'card.verdict.hint': '只有你点过，这里才会被统计 —— 没评的不计入。',
  'card.verdict.yes': '达到了',
  'card.verdict.partial': '基本达到',
  'card.verdict.no': '没达到',
  'card.verdict.placeholder': '差在哪、返工了几轮（可留空）',

  'summary.title': '汇总',
  'summary.subtitle': '跨会话统计',
  'summary.models': '模型排行',
  'summary.disclaimer': '下面只有客观指标（耗时、首字延迟、解码速度），没有质量判断 —— 「得心应手」只能由你自己下结论。',
  'summary.empty': '还没有任何模型数据。发起几次询问，攒够数据再来。',
  'summary.ttft': '首字延迟',
  'summary.speed': '解码速度',
  'summary.turns': '总轮次',
  'summary.tps': '{value} tok/s',
  'summary.verdictRate': '达成率',
  'summary.judged': '已评价',
  'summary.kept': '收藏',
  'summary.verdictEmpty': '还没有评价过任何一次任务。',
  'summary.verdictBreakdown': '达到了 {yes} 次 · 基本达到 {partial} 次 · 没达到 {no} 次',

  'gallery.title': '收藏画廊',
  'gallery.openFromSettings': '查看收藏（{n}）',
  'gallery.emptyFromSettings': '收藏',
  'gallery.empty': '还没有收藏。展开记录卡后点「收藏」即可。',
  'gallery.count': '已积累 {n} 张',
  'gallery.remove': '删除这条',
  'gallery.remove.aria': '删除收藏记录',
  'gallery.review': '回看',
  'gallery.clear': '清空全部',
  'gallery.clear.confirm': '再点一次确认清空',
  'gallery.back': '返回',

  'settings.title': '沉浸觉察',
  'settings.desc': '沉浸一段时间后，在右上角提醒你回看这次任务的账。',
  'settings.enabled': '启用',
  'settings.thresholds': '触发阈值（分钟）',
  'settings.thresholds.hint': '用逗号分隔，最后一档之后按末档步长继续。留空则右上角不显示读数。',
  'settings.thresholds.invalid': '需要 1–6 个正整数，且严格递增。',
  'settings.idle': '空闲冻结（分钟）',
  'settings.idle.hint': '超过这段时间没有操作就不再累加。',
  'settings.cornerMeter': '在右上角显示常驻读数',
  'settings.telemetry': '已提醒 {impressions} 次 · 你打开了 {opens} 次',
  'settings.copy': '复制统计',
  'settings.copied': '统计信息已复制到剪贴板',
  'settings.copyFailed': '复制失败，请手动选择文本',
  'settings.openSummary': '打开汇总',
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
  // 耗时的专用精度：「不到 1 分钟」对模型时间没有信息量（57 秒和 3 秒都这样显示），
  // 所以不足一分钟时直接给秒。
  'unit.secondShort': '{n} 秒',
  'unit.minuteShort': '{n} 分',
  'unit.times': '{n} 次',
  'unit.ms': '{n}ms',
  'ring.seconds': '{n}s',
  'ring.hours': '{n}h',
  'unit.second': '{n}s',
  'unit.minuteShort': '{n} 分',
};

/** English. 必须覆盖 ZH 的每一个 key。 */
const EN = {
  'reminder.title': 'Immersion awareness',
  'reminder.body': 'You have been at it for a while — click to review this task’s ledger.',
  'reminder.countdown': 'Auto-dismiss in {n} s',
  'reminder.unread': 'An unread immersion reminder',
  'reminder.aria': 'Immersion reminder',

  'hud.title': 'This task',
  'hud.noModel': 'Not started',
  'hud.untitled': 'Untitled task',
  'hud.open.aria': '{duration} in — click for details',
  'hud.collapse.aria': 'Collapse details',
  'hud.bar.aria': 'Share of time by model',
  'hud.modelTime': 'Model time',
  'hud.toolTime': 'Tool time',
  'hud.turns': '{n} turns',
  'hud.steps': '{n} steps',
  'hud.empty': 'No model data yet. It appears once you send a request.',
  'hud.verdictLabel': 'You rated it:',
  'hud.restIn': 'next reminder in {duration}',
  'hud.alert.body': 'Time to step away',
  'hud.alert.unread': 'Unread reminder',
  'hud.alert.seconds': 'hides in {n}s',
  'hud.alert.dismiss': 'Got it',
  'hud.openCard': 'Open record',
  'hud.openSummary': 'Summary',

  'card.title': 'Immersion record',
  'card.duration': 'Focus time',
  'card.turns': 'Conversation turns',
  'card.toolCalls': 'Tool calls',
  'card.modelTime': 'Model time',
  'card.tags': 'Time of day',
  'card.close': 'Close',
  'common.back': 'Back',
  'card.save': 'Keep this record',
  'card.saved': 'Kept',
  'card.openGallery': 'View collection',
  'card.openSummary': 'Summary',
  'card.untitled': 'Untitled task',
  'card.windowTruncated': 'Counts cover only the loaded window; older history is not included.',
  'card.degraded': 'Data unavailable',
  'card.stale': 'No session is open — showing the previous session’s stats.',
  'card.noData': 'No session data to count yet.',
  'card.cancelled': '{duration} interrupted',
  'card.models': 'By model',
  'card.models.empty': 'No model data yet. It appears once you send a request.',
  'card.history': 'All time',
  'card.history.sessions': '{n} turns',
  'card.history.calls': '{n} calls',
  'card.note.add': 'How did it feel?',
  'card.note.edit': 'Edit',
  'card.note.placeholder': 'What worked, what did not (optional)',
  'card.note.bare': '(rated, no note)',
  'card.rating.1': 'Bad',
  'card.rating.2': 'Meh',
  'card.rating.3': 'Fine',
  'card.rating.4': 'Smooth',
  'card.rating.5': 'Excellent',
  'card.rating.aria': 'Rate {n}',
  'card.rating.summary': 'You rated it {score}',
  'card.verdict.title': 'Did it get you there?',
  'card.verdict.hint': 'Only what you tap here is counted — unrated runs stay out of the average.',
  'card.verdict.yes': 'Yes',
  'card.verdict.partial': 'Mostly',
  'card.verdict.no': 'No',
  'card.verdict.placeholder': 'What was missing, how much rework (optional)',

  'summary.title': 'Summary',
  'summary.subtitle': 'Across sessions',
  'summary.models': 'Model ranking',
  'summary.disclaimer': 'Only objective signals below — time, first-token latency, decode speed. No quality judgement; “what works for you” is yours to conclude.',
  'summary.empty': 'No model data yet. Send a few requests and come back.',
  'summary.ttft': 'First token',
  'summary.speed': 'Decode speed',
  'summary.turns': 'Total turns',
  'summary.tps': '{value} tok/s',
  'summary.verdictRate': 'Hit rate',
  'summary.judged': 'Judged',
  'summary.kept': 'Kept',
  'summary.verdictEmpty': 'No task has been judged yet.',
  'summary.verdictBreakdown': '{yes} yes · {partial} mostly · {no} no',

  'gallery.title': 'Collection',
  'gallery.openFromSettings': 'View collection ({n})',
  'gallery.emptyFromSettings': 'Collection',
  'gallery.empty': 'Nothing kept yet. Open a record card and choose “Keep this record”.',
  'gallery.count': '{n} kept',
  'gallery.remove': 'Delete this record',
  'gallery.remove.aria': 'Delete collection record',
  'gallery.review': 'Review',
  'gallery.clear': 'Clear all',
  'gallery.clear.confirm': 'Click again to confirm',
  'gallery.back': 'Back',

  'settings.title': 'Immersion awareness',
  'settings.desc': 'After a stretch of focus, a reminder in the top-right corner points you at this task’s ledger.',
  'settings.enabled': 'Enabled',
  'settings.thresholds': 'Thresholds (minutes)',
  'settings.thresholds.hint': 'Comma separated. After the last step it repeats at that step. Leave empty to hide the top-right reading.',
  'settings.thresholds.invalid': 'Needs 1–6 positive integers in strictly increasing order.',
  'settings.idle': 'Idle freeze (minutes)',
  'settings.idle.hint': 'Time without input stops the counter.',
  'settings.cornerMeter': 'Show a resident reading in the top-right',
  'settings.telemetry': 'Cued {impressions} times · you opened it {opens} times',
  'settings.copy': 'Copy stats',
  'settings.copied': 'Stats copied to the clipboard',
  'settings.copyFailed': 'Copy failed — select the text manually',
  'settings.openSummary': 'Open summary',
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
  'unit.secondShort': '{n}s',
  'unit.minuteShort': '{n}m',
  'unit.times': '{n}',
  'unit.ms': '{n}ms',
  'ring.seconds': '{n}s',
  'ring.hours': '{n}h',
  'unit.second': '{n}s',
  'unit.minuteShort': '{n} min',
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
function formatElapsed(ms, t) {
  const value = Math.max(0, Number.isFinite(ms) ? ms : 0);
  if (value < 60000) return t('unit.secondShort', { n: Math.max(1, Math.round(value / 1000)) });
  return formatDuration(value, t);
}

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

/**
 * 对一组条目求某个字段之和。
 *
 * 刻意忽略非有限值与负值 —— 数据可能来自持久化恢复（脏数据）或投影降级，
 * 让它们污染总和会直接显示成一个荒谬的数字。宁可少算，不可显示 NaN。
 *
 * @param entries - 条目数组（可能不是数组）。
 * @param field - 字段名。
 * @returns 总和（非负有限数）。
 */
function sumField(entries, field) {
  const list = Array.isArray(entries) ? entries : [];
  let sum = 0;
  for (const entry of list) {
    const value = entry === null || entry === undefined ? undefined : entry[field];
    if (Number.isFinite(value) && value > 0) sum += value;
  }
  return sum;
}

/**
 * 把平均评分渲染成一句话。
 *
 * 用「4.2」而不是星星：星级在 4.2 的情况下无法表达，而数字能。
 * 低于 3.0 时不必显示 —— 两三条备注的平均值没有意义，容易被误读成定论。
 *
 * @param value - 平均分。
 * @param t - 翻译函数。
 * @returns 文案。
 */
function ratingText(value, t) {
  if (!Number.isFinite(value) || value < 3) return '';
  const rounded = Math.round(value * 10) / 10;
  return t('card.rating.summary', { score: rounded.toFixed(1) });
}

  /* ===== src/client/session-log.js ===== */
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

  /* ===== src/client/model-log.js ===== */
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

  // 本次任务的模型耗时可能远大于活跃时长（模型思考时用户不操作），但阈值提醒
  // 计的是「你自己的活跃时间」。两者口径不同，这里用活跃时长对阈值，环形读数
  // 仍然显示模型耗时 —— 环表示「休息进度」，中心数字表示「模型花了多久」。
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
const STATE_VERSION = 4;

/** 阈值提醒卡在右上角停留多久；超时后转为未读徽标，直到用户点击。 */
const REMINDER_TIMEOUT_MS = 60 * 1000;

/** 汇总面板里每个模型最多保留多少条历史备注。 */
const MODEL_NOTE_LIMIT = 200;

/**
 * 会话分区的零值。
 *
 * v4 起一个分区携带四类数据：
 *   - segment  本会话的净活跃时间（旧的「你自己在打字」口径，保留）
 *   - metrics  窗口内的结构性计数（轮次 / 工具调用）
 *   - stats    宿主 sessionStats 投影的 whole-log 墙钟与计数
 *   - models   逐模型耗时归属（model-log.js 从 chat 快照推导）
 *   - taskName 第一次发起的任务名称
 *
 * @param now - 起始时间戳。
 * @returns 一份全新的空 segment。
 */
function emptySegment(now) {
  return { startedAt: now, lastActiveAt: now, activeMs: 0, activeRuns: 0, firedCount: 0 };
}

/**
 * 一个会话分区的零值。
 *
 * 抽成函数是因为 switchSession / writeSession / migrate 三处都要建同样的空壳，
 * 三处各写一遍必然漂移。
 *
 * @param now - 起始时间戳。
 * @returns 空分区。
 */
function emptyBucket(now) {
  return {
    segment: emptySegment(now),
    metrics: null,
    stats: null,
    models: [],
    taskName: null,
    currentModel: null,
    updatedAt: now,
  };
}

/**
 * 默认设置。数值依据 PRD §2.1 / §4.8。
 */
const DEFAULT_SETTINGS = {
  enabled: true,
  thresholdsMin: [20, 40, 60],
  idleTimeoutMs: 3 * 60 * 1000, // 3 分钟冻结
  resetGapMs: 10 * 60 * 1000, // 10 分钟新时段
  /**
   * 是否显示右上角常驻读数。
   *
   * v4 新增：读数只在「设了阈值」且「本次会话发起过至少一次询问」时出现。
   * 后一个条件由 isTaskStarted 推导，不额外记开关 —— 门槛本身就是发起这个动作。
   *
   * ⚠ 这里**没有** showInlineTimer：输入框常驻计时已退役，迁移时删干净
   * （见 migrateState 里的 delete）。
   */
  showCornerMeter: true,
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
     * 形如 { [sessionId]: { segment, metrics, stats, models, taskName, updatedAt } }。
     * 上限 20 个，超出丢最久未更新的 —— 会话一多不可能无限膨胀 localStorage。
     */
    sessions: {},

    /** 今日统计，跨零点由 tick 侧重置。 */
    today: { date: start },
    /** 收藏库。 */
    collections: [],

    /**
     * 「是否达到了你想要的目的」的自评记录。
     *
     * 形如 { [recordId]: { verdict: 'yes'|'partial'|'no', note, at } }。
     * verdict 是三档而非布尔 —— 「基本完成但有返工」是最常见的真实状态，
     * 压成 boolean 会把它逼成两端之一，统计随即失真。
     */
    verdicts: {},

    /**
     * 「这次任务用哪个模型得心应手」的自评备注。
     *
     * 形如 { [modelKey]: { rating, notes: [{ recordId, taskName, rating, note, at }] } }。
     *
     * ⚠ 这里**不做**「自动判断哪个模型擅长什么」：我们只有耗时、首 token 延迟、
     * 解码速度这类客观量，没有质量信号。任何自动结论都是伪科学。所以只存人写的。
     */
    modelNotes: {},

    /** 本地埋点：阈值提醒触发 / 用户打开记录卡。 */
    telemetry: { impressions: 0, opens: 0 },
    /** 纯 UI 态（不跨会话持久有意义，但放一起省一个 store）。 */
    ui: {
      cardOpen: false,
      galleryOpen: false,
      /** 汇总面板（模型实用性总览）。 */
      summaryOpen: false,
      /** 右上角圆形计时器是否展开明细。 */
      meterOpen: false,
      /**
       * 记录卡当前聚焦的收藏 id。
       *
       * 从画廊点「回看」进来时带上，卡片据此渲染那条记录而不是「当前时段」；
       * 手动打开卡片时置空。
       */
      focusedRecordId: null,
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

    /** 打开/关闭汇总面板（模型实用性总览）。 */
    setSummaryOpen(draft, open) {
      draft.ui.summaryOpen = open === true;
    },

    /**
     * 展开/收起右上角圆形计时器的详情。
     *
     * 为什么展开态要进 store 而不是组件本地：提醒卡的「点击看详情」要能把它
     * 展开，而提醒卡与计时器是两个组件。用组件本地 state 的话，提醒卡要么拿不到
     * 计时器实例，要么得靠一层事件总线 —— 都是把简单事情复杂化。
     */
    setMeterOpen(draft, open) {
      draft.ui.meterOpen = open === true;
    },

    /** 打开记录卡时可指定聚焦哪条收藏（画廊里点「回看」进来时用）。 */
    setFocusedRecord(draft, id) {
      draft.ui.focusedRecordId = typeof id === 'string' && id.length > 0 ? id : null;
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
     * 用户点开了提醒（徽标或仍在倒计时的卡片）：清掉未读并展开右上角计时器。
     *
     * v5 改语义：此前是「打开记录卡」，但提醒卡本就在计时器旁边，而计时器已经
     * 装着全部明细 —— 多弹一张卡只是让人多点一次关掉。计时器展开后如果用户还
     * 想要评价与收藏，展开面板底部就有「打开记录卡」。
     */
    openMeter(draft) {
      draft.ui.reminder = null;
      draft.ui.cardOpen = false;
      draft.ui.galleryOpen = false;
      draft.ui.summaryOpen = false;
      draft.ui.meterOpen = true;
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
      draft.sessions[sessionId] = emptyBucket(payload.now);
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
     * @param payload - { sessionId, segment?, metrics?, stats?, models?,
     *   taskName?, now? }
     *   各字段 undefined 表示「这次不碰它」，所以探针可以只推变化的部分。
     */
    writeSession(draft, payload) {
      const sessionId = payload.sessionId;
      if (typeof sessionId !== 'string' || sessionId.length === 0) return;
      const now = payload.now ?? Date.now();
      // 同 switchSession：分区表必须存在，否则就地补一个空表。
      if (draft.sessions === null || typeof draft.sessions !== 'object') draft.sessions = {};
      // 分区可能还不存在：探针可能先于 sessions.list 的 sync 到达。
      // 这时建一个空分区再写，绝不借用别的会话的时长。
      if (draft.sessions[sessionId] === undefined) draft.sessions[sessionId] = emptyBucket(now);
      const bucket = draft.sessions[sessionId];
      if (payload.segment !== undefined) bucket.segment = payload.segment;
      if (payload.metrics !== undefined) bucket.metrics = payload.metrics;
      if (payload.stats !== undefined) bucket.stats = payload.stats;
      if (payload.models !== undefined) bucket.models = payload.models;
      if (payload.taskName !== undefined) bucket.taskName = payload.taskName;
      bucket.updatedAt = now;
    },

    /**
     * 记「此刻在用哪个模型」。
     *
     * 与 models 的分工：这里是**当下**（记录卡顶部那行模型名、下一次请求会用
     * 什么），models 是**累计**（谁各用了多久）。前者每轮会变，后者只增。
     *
     * @param draft - immer draft。
     * @param payload - { sessionId, model: { provider, model, key }, now? }
     */
    setSessionModel(draft, payload) {
      const sessionId = payload?.sessionId;
      const model = payload?.model;
      if (typeof sessionId !== 'string' || sessionId.length === 0) return;
      if (model === null || typeof model !== 'object') return;
      if (typeof model.provider !== 'string' || model.provider.length === 0) return;
      if (typeof model.model !== 'string' || model.model.length === 0) return;
      const now = typeof payload.now === 'number' ? payload.now : Date.now();
      if (draft.sessions === null || typeof draft.sessions !== 'object') draft.sessions = {};
      if (draft.sessions[sessionId] === undefined) draft.sessions[sessionId] = emptyBucket(now);
      draft.sessions[sessionId].currentModel = {
        provider: model.provider,
        model: model.model,
        key: typeof model.key === 'string' && model.key.length > 0 ? model.key : `${model.provider}/${model.model}`,
        reasoningEffort: typeof model.reasoningEffort === 'string' ? model.reasoningEffort : null,
        at: now,
      };
      draft.sessions[sessionId].updatedAt = now;
    },

    /**
     * 记一次「达到了你想要的目的吗」的自评。
     *
     * 三档：yes / partial / no。压成 boolean 是错的 —— 「基本做完但有返工」是
     * 最常见的真实状态，逼进两端会让后面的统计失真。
     *
     * @param draft - immer draft。
     * @param payload - { recordId: string, verdict: 'yes'|'partial'|'no',
     *   note?: string, now?: number }
     */
    setVerdict(draft, payload) {
      const id = payload?.recordId;
      if (typeof id !== 'string' || id.length === 0) return;
      const verdict = payload?.verdict;
      if (verdict !== 'yes' && verdict !== 'partial' && verdict !== 'no') return;
      if (draft.verdicts === null || typeof draft.verdicts !== 'object') draft.verdicts = {};
      const note = typeof payload.note === 'string' ? payload.note.slice(0, MODEL_NOTE_LIMIT) : '';
      draft.verdicts[id] = {
        verdict,
        note,
        at: typeof payload.now === 'number' ? payload.now : Date.now(),
      };
    },

    /** 撤销一条自评（用户想改主意时）。 */
    clearVerdict(draft, recordId) {
      if (draft.verdicts === null || typeof draft.verdicts !== 'object') return;
      delete draft.verdicts[recordId];
    },

    /**
     * 记一条「这个模型在这次任务里得心应手吗」的备注。
     *
     * @param draft - immer draft。
     * @param payload - { modelKey: string, rating: 1..5, note?: string,
     *   recordId?: string, taskName?: string, now?: number }
     */
    addModelNote(draft, payload) {
      const key = payload?.modelKey;
      if (typeof key !== 'string' || key.length === 0) return;
      const rating = Math.round(Number(payload?.rating));
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return;
      if (draft.modelNotes === null || typeof draft.modelNotes !== 'object') draft.modelNotes = {};

      const bucket = draft.modelNotes[key];
      const notes = Array.isArray(bucket?.notes) ? bucket.notes : [];
      const now = typeof payload.now === 'number' ? payload.now : Date.now();
      const entry = {
        recordId: typeof payload.recordId === 'string' ? payload.recordId : null,
        taskName: typeof payload.taskName === 'string' ? payload.taskName : null,
        rating,
        note: typeof payload.note === 'string' ? payload.note.slice(0, 200) : '',
        at: now,
      };
      // 同一份记录、同一模型只留最新一条自评（改了主意就覆盖，不追加矛盾条目）。
      const kept = notes.filter((item) => !(entry.recordId !== null && item.recordId === entry.recordId));
      const next = [entry, ...kept];
      draft.modelNotes[key] = {
        notes: next.length > MODEL_NOTE_LIMIT ? next.slice(0, MODEL_NOTE_LIMIT) : next,
      };
    },

    /** 清空某个模型的全部备注（模型列表里「不再用它了」）。 */
    clearModelNotes(draft, modelKey) {
      if (draft.modelNotes === null || typeof draft.modelNotes !== 'object') return;
      delete draft.modelNotes[modelKey];
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
        summaryOpen: false,
        meterOpen: false,
        focusedRecordId: null,
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
 *   v4（本次改版）：分区扩成 `{ segment, metrics, stats, models, taskName }`；
 *       顶层新增 `verdicts` / `modelNotes`；`ui` 新增 `summaryOpen` /
 *       `focusedRecordId`；`settings.showInlineTimer` 退役，换 `showCornerMeter`。
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
  // v4 起常驻计时从输入框搬到右上角；旧键留着会让设置行显示一个已不存在的开关。
  delete merged.settings.showInlineTimer;

  // ── ui：提醒卡时代的形状。旧键（hintVisible/playSeq/toast）一律丢弃 ──
  // 语义见 resetTransient —— 它们只在页面生命周期内有意义，跨恢复必须清。
  merged.ui = { ...fresh.ui };
  if (raw.ui !== null && typeof raw.ui === 'object') {
    merged.ui.cardOpen = raw.ui.cardOpen === true;
    merged.ui.galleryOpen = raw.ui.galleryOpen === true;
  }
  // 这三个只在本次页面生命周期内有意义，跨恢复一律回初值（理由同 reminder）。
  merged.ui.reminder = null;
  merged.ui.summaryOpen = false;
  merged.ui.meterOpen = false;
  merged.ui.focusedRecordId = null;

  // ── 分区表：这一步是崩溃的根因，必须保证它一定是对象 ──────────────
  const sessions = {};
  if (raw.sessions !== null && typeof raw.sessions === 'object' && !Array.isArray(raw.sessions)) {
    for (const id of Object.keys(raw.sessions)) {
      const bucket = raw.sessions[id];
      if (bucket === null || typeof bucket !== 'object') continue;
      // 逐字段兜底而不是浅拷贝整个 bucket：v3 的 bucket 缺 stats/models/
      // taskName，直接展开会把 undefined 写进 store，UI 读到 undefined 后
      // 再去 .entries 就会抛。
      sessions[id] = {
        segment:
          bucket.segment !== null && typeof bucket.segment === 'object'
            ? { ...emptySegment(now), ...bucket.segment }
            : emptySegment(now),
        metrics: bucket.metrics ?? null,
        stats: bucket.stats !== null && typeof bucket.stats === 'object' ? bucket.stats : null,
        models: modelEntriesFromArray(bucket.models),
        taskName: typeof bucket.taskName === 'string' ? bucket.taskName : null,
        currentModel:
          bucket.currentModel !== null && typeof bucket.currentModel === 'object'
            ? {
                provider: String(bucket.currentModel.provider ?? ''),
                model: String(bucket.currentModel.model ?? ''),
                key: String(bucket.currentModel.key ?? ''),
                reasoningEffort:
                  typeof bucket.currentModel.reasoningEffort === 'string'
                    ? bucket.currentModel.reasoningEffort
                    : null,
                at: Number.isFinite(bucket.currentModel.at) ? bucket.currentModel.at : now,
              }
            : null,
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
      stats: null,
      models: [],
      taskName: null,
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

  // ── v4 新增的两个自评表 ────────────────────────────────────────────
  // 它们是「人写的判断」，不是派生数据，迁移时逐条校验而不是整体搬 —— 一个坏
  // 条目不该连累整张表，也不该因为形状怪就被原样存回去再在 UI 里炸。
  merged.verdicts = {};
  if (raw.verdicts !== null && typeof raw.verdicts === 'object' && !Array.isArray(raw.verdicts)) {
    for (const id of Object.keys(raw.verdicts)) {
      const item = raw.verdicts[id];
      if (item === null || typeof item !== 'object') continue;
      if (item.verdict !== 'yes' && item.verdict !== 'partial' && item.verdict !== 'no') continue;
      merged.verdicts[id] = {
        verdict: item.verdict,
        note: typeof item.note === 'string' ? item.note : '',
        at: Number.isFinite(item.at) ? item.at : now,
      };
    }
  }

  merged.modelNotes = {};
  if (raw.modelNotes !== null && typeof raw.modelNotes === 'object' && !Array.isArray(raw.modelNotes)) {
    for (const key of Object.keys(raw.modelNotes)) {
      const bucket = raw.modelNotes[key];
      const notes = Array.isArray(bucket?.notes) ? bucket.notes : [];
      const kept = notes
        .filter((item) => item !== null && typeof item === 'object')
        .map((item) => ({
          recordId: typeof item.recordId === 'string' ? item.recordId : null,
          taskName: typeof item.taskName === 'string' ? item.taskName : null,
          rating: Math.min(5, Math.max(1, Math.round(Number(item.rating)) || 3)),
          note: typeof item.note === 'string' ? item.note : '',
          at: Number.isFinite(item.at) ? item.at : now,
        }));
      if (kept.length > 0) {
        merged.modelNotes[key] = {
          notes: kept.length > MODEL_NOTE_LIMIT ? kept.slice(0, MODEL_NOTE_LIMIT) : kept,
        };
      }
    }
  }

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

/*
 * 「返回」按钮（v9 起三个面板统一用它取代 ×）。
 *
 * 面板是从计时器**推进**过来的，所以退出动作的语义是「回到上一层」而不是
 * 「关掉这个东西」。一个向左的尖括号 + 文字，比一个孤零零的 × 更准确地
 * 表达这个动作 —— × 说的是关闭，返回说的是回去。
 */
.ig-panel-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, rgba(128, 128, 128, 1));
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  padding: 4px 8px 4px 5px;
  border-radius: var(--dsw-radius-sm, 6px);
}

.ig-panel-back:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
  color: var(--dsw-alias-label-primary, currentColor);
}

.ig-panel-back:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}

/* 尖括号：比 SVG 图标轻，且各 WebView 字体对 ‹ 的字形一致，无需额外资源。 */
.ig-back-icon {
  font-size: 16px;
  line-height: 14px;
  margin-top: -2px;
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

/*
 * 展开面板顶部的提醒条。
 *
 * 它是**可点的按钮**而不是一行说明文字：面板已经开着时收到提醒，收拢态的点击
 * 路径走不到，这里就是唯一的「标为已看」入口。
 */
.ig-hud-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  border: 0;
  font: inherit;
  font-size: 12px;
  line-height: 17px;
  color: var(--dsw-alias-label-warning, #d9a441);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));
  margin: 0;
  padding: 7px 10px;
  border-radius: var(--dsw-radius-sm, 6px);
  cursor: pointer;
  text-align: left;
}

.ig-hud-banner:hover {
  background: var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.2));
}

.ig-hud-banner:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}

.ig-hud-banner-text {
  flex: 1;
  min-width: 0;
}

/* 「知道了」的动作提示：弱一档，不跟主文案抢注意力。 */
.ig-hud-banner-action {
  flex: none;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, rgba(128, 128, 128, 0.85));
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
 * 阈值提醒（v6 重做：不再是独立卡片，而是计时器的一种状态）。
 *
 * ## 为什么降级
 *
 * v5 之前提醒是右上角独立弹的一张卡，与常驻计时器**同时存在**。用户反馈指出
 * 那是两个东西争同一个位置：提醒一弹就把计时器挤到旁边（甚至叠上去），
 * 视觉上像出了两个互不相干的浮层。
 *
 * 现在提醒是计时器的一种状态：
 *
 *   常态    圆环 + 模型名 + 耗时
 *   提醒态  圆环转警示色 + 冒出一行提示 + 倒计时；点它 = 展开明细
 *   未读态  圆环持续警示色 + 一个待读点，直到用户点过
 *
 * 一个位置、一个组件、一套材质语言。提醒变成「计时器注意到了你」，
 * 而不是「又来了一张卡」。UI 画在 hud.js —— 只有那里知道圆环长什么样；
 * 本模块只负责把 store 里的提醒翻译成状态。
 *
 * @module src/client/reminder
 */

/**
 * 把 store 里的提醒翻译成计时器需要的提醒态。
 *
 * @param reminder - store 的 ui.reminder（null 或对象）。
 * @param nowMs - 当前时间戳。
 * @returns {null | { mode: 'countdown'|'unread', secondsLeft: number }}
 *   null = 当前没有提醒，计时器按常态渲染。
 */
function reminderStateOf(reminder, nowMs) {
  if (reminder === null || reminder === undefined || typeof reminder !== 'object') return null;

  const deadlineAt = Number.isFinite(reminder.deadlineAt) ? reminder.deadlineAt : 0;
  const sticky = reminder.sticky === true;
  const now = Number.isFinite(nowMs) ? nowMs : 0;
  const expired = now >= deadlineAt;

  if (expired === true) {
    // 只有 sticky 提醒（阈值提醒）留在未读态；「已收藏」这类确认到点即消失。
    return sticky === true ? { mode: 'unread', secondsLeft: 0 } : null;
  }
  // 向上取整，让「60」完整出现一秒，而不是开局就显示 59。
  return { mode: 'countdown', secondsLeft: Math.max(1, Math.ceil((deadlineAt - now) / 1000)) };
}

/**
 * 倒计时读数。
 *
 * 纯函数便于测试；不读 Date.now()，时间由调用方注入。
 *
 * @param reminder - store 的 ui.reminder。
 * @param nowMs - 当前时间戳。
 * @returns 剩余秒数；无提醒时为 0。
 */
function secondsLeftOf(reminder, nowMs) {
  const state = reminderStateOf(reminder, nowMs);
  return state === null ? 0 : state.secondsLeft;
}

  /* ===== src/client/safe-top.js ===== */
/**
 * 顶部安全区的测量。
 *
 * ## 它到底在量什么
 *
 * 量的是**会话面板头部的下沿** —— 标题与右上角那排按钮所在的那一条。
 * 计时器要落在它下面、并且明显进入对话区内部。
 *
 * ## 为什么必须测量
 *
 * 那个头部的高度是**内容驱动**的：带标签页时 `.ST7X_W_header` 是
 * `min-height:76px`，不带标签页时 `min-height:0; padding-bottom:10px`，
 * 实际约 50px —— 差近 26px。而且宿主升级会改这些值。写死一个数迟早错位。
 *
 * ## 两个曾经搞错的事实（都是没查清布局就动手）
 *
 *   1. `[data-shell-overlay]` **不是**顶部边界。它的 CSS 是
 *      `position:absolute; inset:0`，是覆盖整个窗口的浮层容器，`top` 恒为 0。
 *      v9 拿它当「外壳让开的位置」，算出 0+32=32px，比头部还高。
 *   2. frame 里**没有导航栏**。它是 `grid-template-rows: minmax(0,1fr) auto`，
 *      只有「内容 + 底部条」两行。用户看到的标题与按钮属于会话面板内部。
 *
 * ## 判据
 *
 * 不依赖任何类名（宿主会改），纯几何：宽度 ≥ 视口 40%、顶边贴近顶端
 * （≤ 视口高 20%）、高度在 20px 与半屏之间、且有子节点。
 * 取满足者中**底边最大**的那个 —— 那正是最外层头部块的下沿。
 *
 * 取最大而非最小：v7 取最小会选中头部内部更靠上的行包装层（标题行底边才 30
 * 左右），于是 EDGE_GAP 调多大都被压回去，表现为「越调越上」。
 *
 * 结果 = 头部下沿 + EDGE_GAP，写进 CSS 变量 `--ig-safe-top`，HUD 只读这一个变量。
 *
 * @module src/client/safe-top
 */

/**
 * 从会话头部下沿再向下让出的距离（px）。
 *
 * ⚠⚠ **数值越大 = 视觉上越靠下**。这是 `top` 的语义：它是「距容器顶部的距离」。
 *
 * v9 之前我把 28 → 14 → 10 一路调小，本意是「让它下来一点」，实际效果是
 * **一路往上推** —— 用户连着三轮反馈「越来越高」，我才发现方向弄反了。
 * 留下这行注释就是为了不再犯：要下来就**加大**这个数。
 *
 * 20px 让落点明确在对话区内部，而不是贴着头部下沿那条分隔线。
 */
const EDGE_GAP = 20;

/**
 * 无候选时的兜底偏移（px）。
 *
 * 按「顶部块约 76px + 一点留白」估。同样遵循「越大越靠下」。
 */
const FALLBACK_TOP = 90;

function measureSafeTop(root, doc) {
  // doc 本身可能为 undefined/null（无 DOM 环境、测试替身缺省）——
  // 上一版直接读 doc.defaultView 会抛，而兜底本来就是这里该做的事。
  const view = doc === null || doc === undefined ? null : (doc.defaultView ?? null);
  const vw = view !== null && Number.isFinite(view.innerWidth) ? view.innerWidth : 0;
  const vh = view !== null && Number.isFinite(view.innerHeight) ? view.innerHeight : 0;
  if (root === null || root === undefined || typeof root.querySelectorAll !== 'function') {
    return FALLBACK_TOP;
  }
  if (vw <= 0 || vh <= 0) return FALLBACK_TOP;

  // ── 量的是「会话面板头部」的下沿 ───────────────────────────────────
  //
  // ⚠ 纠正两轮错误认知（都来自没查清真实布局就动手）：
  //
  //   1. **`[data-shell-overlay]` 不是顶部边界**。它的 CSS 是
  //      `position:absolute; inset:0` —— 覆盖整个窗口的浮层容器，`top` 恒为 0。
  //      v9 把它当「外壳让开的位置」，于是算出 0+32=32px，比头部还高，
  //      表现为「并不在对话框内」。那条路径已删除。
  //
  //   2. **frame 里没有导航栏**。它只有 `grid-template-rows: minmax(0,1fr) auto`
  //      两行（内容 + 底部条），没有 header 行。用户看到的标题与右上角按钮属于
  //      **会话面板内部的头部**（`.ST7X_W_header`，`min-height:76px`；没有标签页时
  //      `min-height:0; padding-bottom:10px`，实际约 50px）。
  //
  // 结论：要量的就是那个头部块的下沿。它的高度是**内容驱动**的（有没有标签页差
  // 近 26px），所以只能测量、不能写死。
  //
  // 几何判据：宽度占视口大半、贴着顶端、高度不到半屏、且有子节点的容器；
  // 取其中**底边最大**的那个 —— 那正是最外层头部块的下沿。
  //
  // 取最大而不是最小：v7 取最小，结果选中头部内部一个更高的行包装层
  // （比如标题行本身，底边只有 30 左右），于是无论把 EDGE_GAP 调多大都被它
  // 压回去，表现为「越调越上」。
  let best = 0;
  // 只看前若干个元素：外壳类容器极少，通读整个 DOM 反而可能命中内容区的某个
  // 恰好又宽又靠上的东西。上限同时是性能保险。
  const nodes = root.querySelectorAll('div, header, nav');
  const limit = Math.min(nodes.length, 400);
  for (let index = 0; index < limit; index += 1) {
    const node = nodes[index];
    if (node === null || typeof node.getBoundingClientRect !== 'function') continue;
    // 只看有子节点的容器：叶子节点多半是按钮或图标。
    if (typeof node.childElementCount === 'number' && node.childElementCount === 0) continue;

    let rect;
    try {
      rect = node.getBoundingClientRect();
    } catch (_error) {
      continue;
    }
    // 宽度门槛：头部占会话列（视口减去侧边栏）的大半，40% 留出浮动窗口的余量。
    if (!Number.isFinite(rect.width) || rect.width < vw * 0.4) continue;
    // 必须贴着顶端：离顶端太远的不是头部。
    if (!Number.isFinite(rect.top) || rect.top > vh * 0.2) continue;
    // 高度上限：占到半屏的多半是内容容器而不是头部。
    if (!Number.isFinite(rect.height) || rect.height < 20 || rect.height >= vh * 0.5) continue;

    const bottom = rect.bottom;
    if (Number.isFinite(bottom) && bottom > best) best = bottom;
  }
  return best === 0 ? FALLBACK_TOP : Math.ceil(best) + EDGE_GAP;
}

/**
 * 开始跟踪顶部安全区，把结果写进 `--ig-safe-top`。
 *
 * 重新测量的时机：首次、窗口尺寸变化、DOM 结构变化（宿主异步渲染外壳，
 * 首次测量很可能早于它出现）。
 *
 * @param doc - 文档对象；缺失时返回空 disposer。
 * @returns 清理函数。
 */
function installSafeTop(doc) {
  if (doc === undefined || doc === null || typeof doc.querySelectorAll !== 'function') {
    return () => {};
  }
  const view = doc.defaultView;
  const root = doc.body ?? doc.documentElement;
  if (root === null || root === undefined) return () => {};

  let frame = 0;
  let last = -1;

  /** 测量并在变化时写入变量。 */
  const apply = () => {
    const value = measureSafeTop(root, doc);
    if (value === last) return;
    last = value;
    // 写到 :root 上，HUD 读 var(--ig-safe-top)。用 CSS 变量而不是直接改元素
    // 的 style，是因为 HUD 可能还没挂载（发起询问之前不显示）。
    const target = doc.documentElement;
    if (target !== null && target !== undefined && typeof target.style?.setProperty === 'function') {
      target.style.setProperty('--ig-safe-top', `${value}px`);
    }
  };

  /** 合并到下一帧执行，避免连续事件把测量打爆。 */
  const schedule = () => {
    if (frame !== 0) return;
    const raf = view !== null && typeof view.requestAnimationFrame === 'function'
      ? view.requestAnimationFrame.bind(view)
      : (fn) => setTimeout(fn, 16);
    frame = raf(() => {
      frame = 0;
      apply();
    });
  };

  apply();
  if (view !== null) view.addEventListener('resize', schedule);

  // 宿主是异步渲染外壳的，DOM 结构变化后重测。
  const observer =
    view !== null && typeof view.MutationObserver === 'function'
      ? new view.MutationObserver(schedule)
      : null;
  if (observer !== null && typeof root === 'object') {
    observer.observe(root, { childList: true, subtree: true });
  }

  return () => {
    if (frame !== 0 && view !== null && typeof view.cancelAnimationFrame === 'function') {
      view.cancelAnimationFrame(frame);
    }
    frame = 0;
    if (view !== null) view.removeEventListener('resize', schedule);
    if (observer !== null) observer.disconnect();
  };
}

  /* ===== src/client/hud.js ===== */
/**
 * 右上角圆形计时器（v5 重做）。
 *
 * ## 形态
 *   - 收拢  一个圆环：环是「休息进度」，中心是「本次任务已耗时」，右侧是模型名。
 *   - 展开  从圆环长出的面板：占比条 + 两格数字 + 逐模型明细（含历史评价）。
 *   - 未读  阈值提醒超时后的徽标（reminder.js 渲染，本组件不碰）。
 *
 * ## 环为什么表示「休息进度」而不是「已用时长占比」
 *
 * 用户不会为一次任务设时长上限，所以「已用 / 总时」的分母根本不存在。把环锚在
 * **下一档提醒阈值**上才对：环满 = 该起身了，与右上角弹出的提醒卡是同一时刻。
 * 环表示休息进度，中心数字表示模型耗时，两个语义各自独立不打架。
 *
 * ## 为什么展开面板要带历史
 *
 * 「这次任务里哪个模型好使」和「我历次用下来觉得哪个好使」是两个问题。
 * 收拢态答前者（当前这次），展开态两个都答 —— 逐模型行右侧直接挂着你之前给
 * 它的评分与备注，否则要翻到汇总页才知道，数字与判断就脱节了。
 *
 * @module src/client/hud
 */

/** 圆环直径（px）。 */
const RING_SIZE = 44;

/** 环的线宽（px）。细一点更像发丝，不像表盘。 */
const RING_WIDTH = 3;

/** 圆周长：2πr。进度用 stroke-dasharray 的 dash 部分表示。 */
const RING_CIRCUMFERENCE = 2 * Math.PI * (RING_SIZE / 2 - RING_WIDTH / 2);

/**
 * 判断右上角读数此刻该不该出现。
 *
 * @param snapshot - store 快照。
 * @param bucket - 当前分区（可能为 null）。
 * @returns 是否显示。
 */
function shouldShowMeter(snapshot, bucket) {
  if (snapshot === null || snapshot === undefined) return false;
  const settings = snapshot.settings;
  if (settings === null || settings === undefined) return false;
  if (settings.enabled !== true) return false;
  if (settings.showCornerMeter !== true) return false;

  // 「只有设置了阈值后才会出现」—— 阈值为空即视为没设，也就没有环可画。
  const thresholds = settings.thresholdsMin;
  if (!Array.isArray(thresholds) || thresholds.length === 0) return false;

  if (bucket === null || bucket === undefined) return false;

  // 「发起询问之前不能统计时间」—— 没有任何会话活动痕迹就不显示。
  const started = bucket.started === true;
  const hasStats = bucket.stats !== null && bucket.stats !== undefined;
  const hasModels = Array.isArray(bucket.models) && bucket.models.length > 0;
  return started || hasStats || hasModels;
}

/**
 * 把毫秒压成圆环中心那种极简的读数。
 *
 * 不能用 formatDuration（「1 小时 12 分钟」塞不进 44px 的圆里）。这里取一个
 * 始终 2–3 个字符的形状，靠**约等于**换取可读性：秒级看秒、分钟级看分、
 * 小时级看小时。它是「量级指示」而不是精确读数 —— 精确的在展开面板里。
 *
 * @param ms - 毫秒。
 * @param t - 翻译函数。
 * @returns 短读数文本。
 */
function compactElapsed(ms, t) {
  const value = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const minutes = value / 60000;
  if (minutes < 1) return t('ring.seconds', { n: Math.floor(value / 1000) });
  if (minutes < 60) return `${Math.floor(minutes)}`;
  const hours = value / 3600000;
  return t('ring.hours', { n: hours < 10 ? (Math.round(hours * 10) / 10).toFixed(1) : Math.floor(hours) });
}

/**
 * 算出一条横向占比条的分段。
 *
 * 用途：让「哪个模型占掉了我这次的时间」一眼可见 —— 纯数字要心算，条不用。
 *
 * @param entries - 模型条目数组（已按 modelMs 降序）。
 * @param totalMs - 总耗时。
 * @returns [{ key, fraction, entry }]，fraction ∈ (0,1]。
 */
function buildSegments(entries, totalMs) {
  const list = Array.isArray(entries) ? entries : [];
  const total = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 0;
  if (total <= 0) return [];

  const segments = [];
  for (const entry of list) {
    const ms = Number.isFinite(entry?.modelMs) ? entry.modelMs : 0;
    if (ms <= 0) continue;
    const fraction = ms / total;
    if (fraction <= 0) continue;
    segments.push({ key: entry.key, fraction: Math.min(1, fraction), entry });
  }
  return segments.map((segment) => ({
    key: segment.key,
    entry: segment.entry,
    fraction: Math.round(segment.fraction * 1000) / 1000,
  }));
}

/**
 * 渲染右上角圆形计时器。
 *
 * @param props - { React, t, useImmersionGlow, bucket, entries, stats,
 *   currentModel, verdicts, modelNotes, handlers }
 * @returns React 元素或 null。
 */
function CornerMeter(props) {
  const { React, t, useImmersionGlow, bucket, entries, stats, currentModel, verdicts, modelNotes, handlers } =
    props;
  const h = React.createElement;

  const actions = props.actions;
  // 展开态存在 store 里（不是组件本地）：提醒卡的「点击看详情」要能把它展开，
  // 而提醒卡与计时器是两个组件。本地 state 做不到，得靠事件总线 —— 不值得。
  const open = useImmersionGlow((value) => value.ui.meterOpen === true);
  const setOpen = (next) => actions.setMeterOpen(next);
  const reminder = useImmersionGlow((value) => value.ui.reminder ?? null);
  // 订阅整个快照：门槛判定、阈值、耗时、自评任何一处变化都要立刻反映。
  const snapshot = useImmersionGlow((value) => value);

  // 倒计时驱动（v6）：提醒不再是独立组件，它变成计时器的一种状态。
  // 所以走秒的 interval 也必须挂在计时器这里 —— 否则收拢态不渲染时倒计时会停。
  // 刻意用急切求值 `Date.now()` 而不是惰性初始化：测试里的假 React 不会执行
  // useState 的惰性函数，惰性写法会让 nowMs 永远是初始值。
  const [tick, setTick] = React.useState(Date.now());
  React.useEffect(() => {
    if (reminder === null || reminder === undefined) return undefined;
    const timer = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [reminder === null || reminder === undefined ? 0 : (reminder.seq ?? 0)]);

  const alert = reminderStateOf(reminder, tick);

  React.useEffect(() => {
    if (snapshot?.settings?.enabled !== true && open === true) actions.setMeterOpen(false);
  }, [snapshot?.settings?.enabled, open, actions]);

  if (!shouldShowMeter(snapshot, bucket)) return null;

  // ── 数据 ──────────────────────────────────────────────────────────
  const modelMs = sumField(entries, 'modelMs');
  const toolMs = stats !== null && stats !== undefined && Number.isFinite(stats.toolMs) ? stats.toolMs : 0;
  const activeMs = bucket?.segment !== undefined && Number.isFinite(bucket.segment.activeMs)
    ? bucket.segment.activeMs
    : 0;

  // 环表示「离下一次该歇了还有多远」，阈值用的是你自己的活跃时长；
  // 中心数字表示模型净耗时。两者口径不同是**有意的**，所以不共用一个数。
  const progress = ringProgress({
    elapsedMs: activeMs,
    thresholdsMin: snapshot.settings.thresholdsMin,
    modelMs,
  });
  const dash = RING_CIRCUMFERENCE * progress.ratio;

  const activeModel = currentModel === null || currentModel === undefined ? null : currentModel;
  const modelName = activeModel === null ? t('hud.noModel') : modelLabel(activeModel);
  const list = Array.isArray(entries) ? entries : [];
  const segments = buildSegments(list, modelMs);
  const notesTable = modelNotes ?? {};
  const verdictTable = verdicts ?? {};

  // 提醒态：计时器转警示色。这是「同一个东西在说话」，不是另一个浮层。
  const alertClass = alert === null ? '' : alert.mode === 'unread' ? ' ig-ring--unread' : ' ig-ring--alert';

  // ── 圆环本体（收拢与展开共用）─────────────────────────────────────
  const ring = () =>
    h(
      'span',
      { class: `ig-ring${alertClass}` },
      h(
        'svg',
        {
          class: 'ig-ring-svg',
          viewBox: `0 0 ${RING_SIZE} ${RING_SIZE}`,
          width: RING_SIZE,
          height: RING_SIZE,
          'aria-hidden': 'true',
          focusable: 'false',
        },
        // 底环：轨道，不随进度变。
        h('circle', {
          class: 'ig-ring-track',
          cx: RING_SIZE / 2,
          cy: RING_SIZE / 2,
          r: RING_SIZE / 2 - RING_WIDTH / 2,
          fill: 'none',
          strokeWidth: RING_WIDTH,
        }),
        // 进度弧：dash 段随 ratio 增长。rotate(-90) 让起点在 12 点方向。
        h('circle', {
          class: 'ig-ring-value',
          cx: RING_SIZE / 2,
          cy: RING_SIZE / 2,
          r: RING_SIZE / 2 - RING_WIDTH / 2,
          fill: 'none',
          strokeWidth: RING_WIDTH,
          strokeLinecap: 'round',
          strokeDasharray: `${dash} ${RING_CIRCUMFERENCE}`,
          transform: `rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`,
        }),
      ),
      // 中心读数用 HTML 而非 <text>：SVG 文本的字号/基线在各家 WebView 上
      // 表现不一、居中尤其难控。绝对定位的 span 更稳。
      h('span', { class: 'ig-ring-text' }, compactElapsed(modelMs, t)),
    );

  // ── 收拢态 ────────────────────────────────────────────────────────
  if (!open) {
    return h(
      'button',
      {
        type: 'button',
        class: 'ig-hud',
        'aria-expanded': 'false',
        'aria-label': t('hud.open.aria', { duration: formatElapsed(modelMs, t) }),
        title: `${modelName} · ${formatElapsed(modelMs, t)}`,
        // 点开 = 已看。走 handler 而不是 setOpen，否则提醒永远消不掉（v6 的坑）。
        onClick: () => handlers.openMeter(),
      },
      ring(),
      h(
        'span',
        { class: 'ig-hud-side' },

        // ── 第一行：主体 ────────────────────────────────────────────
        // 常态 = 模型名；提醒态 = 提示语（此刻该知道的是「该歇了」，而不是
        // 「你在用 claude-opus」）。总耗时恒在右端 —— 它是背景信息，任何时候
        // 都不该被提醒语挤掉。
        h(
          'span',
          { class: 'ig-hud-row-line' },
          h(
            'span',
            { class: alert === null ? 'ig-hud-model' : 'ig-hud-model ig-hud-model--alert' },
            alert === null
              ? modelName
              : t(alert.mode === 'unread' ? 'hud.alert.unread' : 'hud.alert.body'),
          ),
          alert !== null && alert.mode === 'unread'
            ? h('span', { class: 'ig-hud-dot', 'aria-hidden': 'true' })
            : null,
          h('span', { class: 'ig-hud-time' }, formatElapsed(modelMs, t)),
        ),

        // ── 第二行：副行，只在需要解释第一行时才出现 ─────────────────
        // 常态：说清这个数是什么（「模型耗时 4 分钟」），因为中心那个「4」在
        // 44px 的圆里是个没有单位的数，不解释它就是天书。
        // 提醒态：换成「还有多久收起」——这是提醒态下唯一需要额���说明的事。
        alert === null
          ? h('span', { class: 'ig-hud-sub-line' }, t('hud.modelTime'), ' · ', progressLabel(t, activeMs, snapshot.settings.thresholdsMin))
          : alert.mode === 'countdown'
            ? h('span', { class: 'ig-hud-sub-line ig-hud-sub-line--alert' }, t('hud.alert.seconds', { n: alert.secondsLeft }))
            : null,
      ),
    );
  }

  // ── 展开态 ────────────────────────────────────────────────────────
  // 逐模型行：这次任务的数字 + 你历来给它的评价并排。
  const row = (entry) => {
    const key = entry.key;
    const notes = Array.isArray(notesTable[key]?.notes) ? notesTable[key].notes : [];
    const rating =
      notes.length > 0
        ? notes.reduce((sum, item) => sum + (Number.isFinite(item?.rating) ? item.rating : 0), 0) /
          notes.length
        : 0;

    return h(
      'li',
      { class: 'ig-hud-row', key },

      h(
        'div',
        { class: 'ig-hud-row-head' },
        h('span', { class: 'ig-hud-row-model' }, modelLabel(entry)),
        rating > 0 ? h('span', { class: 'ig-model-rating' }, ratingText(rating, t)) : null,
        h('span', { class: 'ig-hud-row-time' }, formatElapsed(entry.modelMs, t)),
      ),

      h(
        'div',
        { class: 'ig-hud-row-sub' },
        [
          t('hud.turns', { n: entry.turns }),
          t('hud.steps', { n: entry.steps }),
          entry.cancelledMs > 0 ? formatElapsed(entry.cancelledMs, t) : null,
        ]
          .filter((piece) => piece !== null && String(piece).length > 0)
          .join(' · '),
      ),

      // 历史评价：把上次那句备注直接亮出来，否则数字与判断是脱节的。
      notes.length > 0 && typeof notes[0].note === 'string' && notes[0].note.length > 0
        ? h('p', { class: 'ig-note ig-note--quote' }, notes[0].note)
        : null,
    );
  };

  const currentVerdict = verdictTable['current'];

  return h(
    'div',
    { class: 'ig-hud-panel', role: 'dialog', 'aria-label': t('hud.title') },

    h(
      'div',
      { class: 'ig-hud-head' },
      ring(),
      h(
        'div',
        { class: 'ig-hud-head-text' },
        h('span', { class: 'ig-hud-title' }, bucket?.taskName ?? t('hud.untitled')),
        h('span', { class: 'ig-hud-subtitle' }, `${modelName} · ${formatElapsed(modelMs, t)}`),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'ig-hud-collapse',
          onClick: () => setOpen(false),
          'aria-label': t('hud.collapse.aria'),
          title: t('hud.collapse.aria'),
        },
        '×',
      ),
    ),

    // 提醒态下，面板顶部也保留一行提示：用户可能是面板已经开着的时候才收到的提醒
    // （那种情况下收拢态的点击路径走不到）。所以这行**必须可点**，否则未读同样
    // 消不掉 —— 这是收拢态之外的第二条「标为已看」路径。
    alert !== null
      ? h(
          'button',
          {
            type: 'button',
            class: `ig-hud-banner${alert.mode === 'unread' ? ' ig-hud-banner--unread' : ''}`,
            onClick: () => handlers.dismissAlert(),
            title: t('hud.alert.dismiss'),
          },
          h('span', { class: 'ig-hud-banner-text' }, t(alert.mode === 'unread' ? 'hud.alert.unread' : 'hud.alert.body')),
          h('span', { class: 'ig-hud-banner-action' }, t('hud.alert.dismiss')),
        )
      : null,

    // 占比条：一整条按模型分段，长度即占比。
    segments.length > 0
      ? h(
          'div',
          { class: 'ig-hud-bar', role: 'img', 'aria-label': t('hud.bar.aria') },
          segments.map((segment) =>
            h('span', {
              class: 'ig-hud-seg',
              key: segment.key,
              style: { flexGrow: String(segment.fraction) },
              title: `${modelLabel(segment.entry)} · ${formatElapsed(segment.entry.modelMs, t)}`,
            }),
          ),
        )
      : null,

    h(
      'dl',
      { class: 'ig-hud-figures' },
      figure(React, t('hud.modelTime'), formatElapsed(modelMs, t)),
      figure(React, t('hud.toolTime'), toolMs > 0 ? formatElapsed(toolMs, t) : '—'),
    ),

    list.length > 0
      ? h('ul', { class: 'ig-hud-list' }, list.map(row))
      : h('p', { class: 'ig-note' }, t('hud.empty')),

    // 已经答过就显示答案，不再逼用户点进卡片才知道自己评过什么。
    currentVerdict !== null && currentVerdict !== undefined && currentVerdict.verdict
      ? h(
          'p',
          { class: 'ig-hud-verdict' },
          `${t('hud.verdictLabel')} ${t(`card.verdict.${currentVerdict.verdict}`)}`,
        )
      : null,

    h(
      'div',
      { class: 'ig-actions' },
      h(
        'button',
        { type: 'button', class: 'ig-btn ig-btn--quiet', onClick: handlers.openCard },
        t('hud.openCard'),
      ),
      h(
        'button',
        { type: 'button', class: 'ig-btn ig-btn--quiet', onClick: handlers.openSummary },
        t('hud.openSummary'),
      ),
    ),
  );
}

/**
 * 生成副行里的「距下次提醒还有多久」。
 *
 * 常驻提示形态（「还有 12 分钟」）比倒计时形态（「12s 后收起」）适合常态：
 * 前者说的是用户在意的未来时间点，后者说的是一个即将消失的 UI 元素。
 *
 * @param t - 翻译函数。
 * @param activeMs - 当前净活跃毫秒。
 * @param thresholdsMin - 阈值数组。
 * @returns 文案。
 */
function progressLabel(t, activeMs, thresholdsMin) {
  const progress = ringProgress({ elapsedMs: activeMs, thresholdsMin, modelMs: 0 });
  const remainingMs = Math.max(0, progress.nextAtMs - (Number.isFinite(activeMs) ? activeMs : 0));
  if (progress.nextAtMs <= 0) return '';
  return t('hud.restIn', { duration: formatElapsed(remainingMs, t) });
}

/**
 * 一格「标签 + 数值」。
 *
 * ⚠ 必须接收 React 作为参数：模块级没有 `h`，它只在 CornerMeter 里是局部变量。
 * 早期版本直接引用 `h`，因为收拢态从不调用本函数而侥幸没炸 —— 一展开就
 * ReferenceError。helper 要么自己拿 React，要么显式接收。
 *
 * @param React - React 对象。
 * @param label - 标签文案。
 * @param value - 数值文案。
 * @returns React 元素。
 */
function figure(React, label, value) {
  const h = React.createElement;
  return h(
    'div',
    { class: 'ig-hud-figure' },
    h('dt', null, label),
    h('dd', null, value),
  );
}

  /* ===== src/client/summary.js ===== */
/**
 * 汇总面板（v4 新增）：跨会话统计「哪个模型在你这儿得心应手」。
 *
 * ## 它明确不做的事
 *
 * **不自动判断「哪个模型擅长什么」。** 我们手里只有客观量：
 *
 *   - 净耗时（模型思考墙钟）
 *   - 首 token 延迟（ttft）
 *   - 解码速度（decodeTokens / decodeMs）
 *   - 取消/失败时长
 *   - 用户自己打的分与写的备注
 *
 * 没有任何一项是「质量」。让脚本从耗时反推「擅长写代码」是伪科学 —— 快不等于好。
 * 所以这个面板做的是**把证据摆出来，让人自己下结论**：客观指标 + 人的自评并排，
 * 看得见的关联由用户自己读。
 *
 * ## 三块
 *   1. 总览 —— 本次任务（聚焦的收藏，或当前会话）的逐模型账
 *   2. 跨会话模型排行 —— 按累计净耗时排序，带客观指标列
 *   3. 你的自评 —— 平均分、备注条数、最近几条原文
 *
 * @module src/client/summary
 */

/** 模型行里最多显示几条备注原文。 */
const SUMMARY_NOTES = 3;

/**
 * 从多个分区的 models 汇总出跨会话排行。
 *
 * @param sessions - sessions 表。
 * @returns 条目数组，按 modelMs 降序（由 mergeModelLogs 保证）。
 */
function rankModels(sessions) {
  const map = sessions === null || typeof sessions !== 'object' ? {} : sessions;
  const lists = [];
  const statsByKey = {};

  for (const id of Object.keys(map)) {
    const bucket = map[id];
    if (bucket === null || typeof bucket !== 'object') continue;

    const list = modelEntriesFromArray(bucket.models);
    if (list.length > 0) lists.push(list);

    // sessionStats 是 whole-log 的：一个会话里每个模型各有份，但同一个模型会
    // 在多个会话出现。所以 ttft 这类**会话级**指标只能按轮次加权平均，不能相加。
    const stats = bucket.stats;
    if (stats === null || typeof stats !== 'object') continue;
    for (const entry of list) {
      const weight = Number.isFinite(entry.turns) && entry.turns > 0 ? entry.turns : 1;
      const ttft = avgTtft(stats);
      const speed = avgDecodeSpeed(stats);
      const current = statsByKey[entry.key];
      if (current === undefined) {
        statsByKey[entry.key] = { ttftSum: ttft * weight, speedSum: speed * weight, weight };
        continue;
      }
      current.ttftSum += ttft * weight;
      current.speedSum += speed * weight;
      current.weight += weight;
    }
  }

  return mergeModelEntries(lists).map((entry) => {
    const stat = statsByKey[entry.key];
    const weight = stat !== undefined && stat.weight > 0 ? stat.weight : 0;
    return {
      ...entry,
      // 只有真取到数据才给数；否则 null，UI 显示「—」。0 会看起来像「极快」。
      avgTtftMs: weight > 0 && stat.ttftSum > 0 ? stat.ttftSum / weight : null,
      avgDecodeTps: weight > 0 && stat.speedSum > 0 ? stat.speedSum / weight : null,
    };
  });
}

/**
 * 一个会话的平均首 token 延迟。
 * @param stats - sessionStats 归一化值。
 * @returns 毫秒；无数据返回 0。
 */
function avgTtft(stats) {
  if (stats === null || typeof stats !== 'object') return 0;
  const steps = Number.isFinite(stats.ttftSteps) ? stats.ttftSteps : 0;
  const total = Number.isFinite(stats.ttftMs) ? stats.ttftMs : 0;
  return steps > 0 ? total / steps : 0;
}

/**
 * 一个会话的平均解码速度（token / 秒）。
 * @param stats - sessionStats 归一化值。
 * @returns tokens per second；无数据返回 0。
 */
function avgDecodeSpeed(stats) {
  if (stats === null || typeof stats !== 'object') return 0;
  const ms = Number.isFinite(stats.decodeMs) ? stats.decodeMs : 0;
  const tokens = Number.isFinite(stats.decodeTokens) ? stats.decodeTokens : 0;
  return ms > 0 ? tokens / (ms / 1000) : 0;
}

/**
 * 渲染汇总面板。
 *
 * @param props - { React, t, useImmersionGlow, handlers }
 * @returns React 元素或 null。
 */
function Summary(props) {
  const { React, t, useImmersionGlow, handlers } = props;
  const h = React.createElement;

  const open = useImmersionGlow((state) => state.ui.summaryOpen);
  const sessions = useImmersionGlow((state) => state.sessions);
  const collections = useImmersionGlow((state) => state.collections);
  const verdicts = useImmersionGlow((state) => state.verdicts ?? {});
  const modelNotes = useImmersionGlow((state) => state.modelNotes ?? {});

  if (!open) return null;

  const ranked = rankModels(sessions);
  const list = Array.isArray(collections) ? collections : [];

  // ── 目的达成率 ────────────────────────────────────────────────────
  // 只统计**已自评**的记录。没评的不进分母 —— 把「没评」当「没达成」会把完成率
  // 压到真实水平以下，那是在骗用户。
  const judged = Object.keys(verdicts);
  const yesCount = judged.filter((id) => verdicts[id]?.verdict === 'yes').length;
  const partialCount = judged.filter((id) => verdicts[id]?.verdict === 'partial').length;
  const noCount = judged.filter((id) => verdicts[id]?.verdict === 'no').length;
  // 「基本达到」按半分计：它是达成与未达成之间最诚实的读数。
  const score = judged.length > 0 ? (yesCount + partialCount * 0.5) / judged.length : null;

  const modelRow = (entry) => {
    const notes = Array.isArray(modelNotes[entry.key]?.notes) ? modelNotes[entry.key].notes : [];
    const rating =
      notes.length > 0
        ? notes.reduce((sum, item) => sum + (Number.isFinite(item.rating) ? item.rating : 0), 0) / notes.length
        : 0;

    return h(
      'li',
      { class: 'ig-summary-row', key: entry.key },
      h(
        'div',
        { class: 'ig-summary-row-head' },
        h('span', { class: 'ig-summary-row-name' }, modelLabel(entry)),
        rating > 0 ? h('span', { class: 'ig-model-rating' }, ratingText(rating, t)) : null,
        h('span', { class: 'ig-summary-row-time' }, formatDuration(entry.modelMs, t)),
      ),

      // 客观指标：只有取到才显示。显示"—"比编一个数字诚实。
      h(
        'div',
        { class: 'ig-summary-figures' },
        figure(React, t('summary.ttft'), entry.avgTtftMs === null ? '—' : formatCompactMs(entry.avgTtftMs, t)),
        figure(React, t('summary.speed'), entry.avgDecodeTps === null ? '—' : formatTps(entry.avgDecodeTps, t)),
        figure(React, t('summary.turns'), String(entry.turns)),
      ),

      // 占比条：一眼看出这个模型吃掉了你多少时间。
      totalModelMs(ranked) > 0
        ? h(
            'div',
            { class: 'ig-hud-bar' },
            h('span', {
              class: 'ig-hud-seg',
              style: { flexGrow: String(Math.max(0.02, entry.modelMs / totalModelMs(ranked))) },
            }),
          )
        : null,

      notes.length > 0
        ? h(
            'ul',
            { class: 'ig-summary-notes' },
            notes.slice(0, SUMMARY_NOTES).map((item, index) =>
              h(
                'li',
                { key: `${entry.key}-${index}` },
                h('span', { class: 'ig-summary-note-task' }, item.taskName ?? t('card.untitled')),
                h('span', { class: 'ig-summary-note-text' }, item.note || t('card.note.bare')),
              ),
            ),
          )
        : null,
    );
  };

  return h(
    React.Fragment,
    null,
    h('div', { className: 'ig-scrim', onClick: handlers.closeSummary, 'aria-hidden': 'true' }),
    h(
      'div',
      { className: 'ig-panel ig-panel--wide', role: 'dialog', 'aria-modal': 'false', 'aria-label': t('summary.title') },

      h(
        'div',
        { className: 'ig-panel-head' },
        h(
          'div',
          { className: 'ig-panel-head-text' },
          h('h2', { className: 'ig-panel-title' }, t('summary.title')),
          h('span', { className: 'ig-task' }, t('summary.subtitle')),
        ),
        h(
          'button',
          { type: 'button', className: 'ig-panel-back', onClick: handlers.backToMeter },
          h('span', { class: 'ig-back-icon', 'aria-hidden': 'true' }, '‹'),
          t('common.back'),
        ),
      ),

      // ── 达成率 ────────────────────────────────────────────────────
      h(
        'dl',
        { className: 'ig-metrics' },
        h(
          'div',
          { className: 'ig-metric' },
          h('dt', null, t('summary.verdictRate')),
          h('dd', null, score === null ? '—' : `${Math.round(score * 100)}%`),
        ),
        h(
          'div',
          { className: 'ig-metric' },
          h('dt', null, t('summary.judged')),
          h('dd', null, String(judged.length)),
        ),
        h(
          'div',
          { className: 'ig-metric' },
          h('dt', null, t('summary.kept')),
          h('dd', null, String(list.length)),
        ),
      ),

      judged.length === 0
        ? h('p', { className: 'ig-note' }, t('summary.verdictEmpty'))
        : h(
            'p',
            { className: 'ig-note' },
            t('summary.verdictBreakdown', { yes: yesCount, partial: partialCount, no: noCount }),
          ),

      // ── 模型排行 ──────────────────────────────────────────────────
      ranked.length === 0
        ? h('p', { className: 'ig-note' }, t('summary.empty'))
        : h(
            'div',
            { className: 'ig-block' },
            h('h3', { className: 'ig-block-title' }, t('summary.models')),
            // 把「我们不做自动判断」写在明面上，避免用户把客观指标误读成评分。
            h('p', { className: 'ig-note' }, t('summary.disclaimer')),
            h('ul', { className: 'ig-summary-list' }, ranked.map(modelRow)),
          ),

      h(
        'div',
        { className: 'ig-actions' },
        h(
          'button',
          { type: 'button', class: 'ig-btn ig-btn--quiet', onClick: handlers.openGallery },
          t('card.openGallery'),
        ),
      ),
    ),
  );
}

/**
 * 排行里所有模型的净耗时之和（占比条的分母）。
 * @param ranked - rankModels 的产物。
 * @returns 总毫秒。
 */
function totalModelMs(ranked) {
  return sumField(ranked, 'modelMs');
}

/**
 * 格式化毫秒为紧凑形（首 token 延迟用）。1200ms → 1.2s，45000ms → 45s。
 *
 * 刻意不走 formatDuration —— 那里的「小时/分钟」对亚秒级的延迟毫无意义。
 *
 * @param ms - 毫秒。
 * @param t - 翻译函数。
 * @returns 文案。
 */
function formatCompactMs(ms, t) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const seconds = ms / 1000;
  if (seconds < 10) return t('unit.ms', { n: Math.round(ms) });
  if (seconds < 60) return t('unit.second', { n: (Math.round(seconds * 10) / 10).toFixed(1) });
  return t('unit.minuteShort', { n: Math.round(seconds / 60) });
}

/**
 * 格式化解码速度。
 * @param tps - tokens per second。
 * @param t - 翻译函数。
 * @returns 文案。
 */
function formatTps(tps, t) {
  if (!Number.isFinite(tps) || tps <= 0) return '—';
  return t('summary.tps', { value: Math.round(tps) });
}

  /* ===== src/client/record-card.js ===== */
/**
 * 沉浸记录卡（v4 重做）。
 *
 * 一句话概括这次任务的账：叫什么、跑了多久、花在哪个模型上、结果满不满意。
 *
 * ## 四块内容
 *   1. 任务名  —— 首次发起的首句（截断 60 字），来源见 session-log.js 的隐私说明
 *   2. 总账    —— 模型净耗时 / 工具耗时 / 轮次
 *   3. 模型明细 —— 逐模型一行，可展开逐条备注「这次用着怎么样」
 *   4. 目的确认 —— 达到了 / 基本达到 / 没达到，三档 + 一句备注
 *
 * ## 为什么目的确认是三档不是开关
 * 「基本做完但有返工」是最常见的真实状态。压成 boolean 会把它逼成两端之一，
 * 记录下来之后统计失真，几个月后回看就是一堆没信息量的 yes/no。
 *
 * ## 生命周期
 * 仅在展开时挂载；收起先播 0.45s 退场动画再卸载。
 *
 * @module src/client/record-card
 */

/** 退场动画时长，与 panel-css.js 里 .ig-panel--closing 的 0.45s 对齐。 */
const CLOSE_ANIMATION_MS = 450;

/** 一行备注的最大长度（与 state.js 的 MODEL_NOTE_LIMIT 一致量级）。 */
const NOTE_MAX = 200;

/** 记录卡里「历史累计」最多列几个模型。多于此就该去汇总页看了。 */
const HISTORY_ROWS = 4;

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
 * @param props - { React, t, useImmersionGlow, handlers, bucket, entries,
 *   metrics, stale }
 * @returns React 元素或 null。
 */
function RecordCard(props) {
  const { React, t, useImmersionGlow, handlers, bucket, entries, stale } = props;
  const h = React.createElement;

  const cardOpen = useImmersionGlow((state) => state.ui.cardOpen);
  const focusedId = useImmersionGlow((state) => state.ui.focusedRecordId);
  const savedCount = useImmersionGlow((state) => state.collections.length);
  const collections = useImmersionGlow((state) => state.collections);
  const verdict = useImmersionGlow((state) => state.verdicts ?? {});
  const modelNotes = useImmersionGlow((state) => state.modelNotes ?? {});

  const [closing, setClosing] = React.useState(false);
  // 「记一条模型备注」的展开态按模型 key 存：多模型时不至于只剩一个能展开。
  const [noteOpen, setNoteOpen] = React.useState(null);
  const [noteDraft, setNoteDraft] = React.useState('');
  const [verdictDraft, setVerdictDraft] = React.useState('');

  /** 播放退场动画后再真正卸载。 */
  const close = React.useCallback(() => {
    setClosing(true);
    const timer = window.setTimeout(() => {
      setClosing(false);
      handlers.closeCard();
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [handlers]);

  React.useEffect(() => {
    if (!cardOpen) {
      setClosing(false);
      setNoteOpen(null);
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cardOpen, close]);

  if (!cardOpen) return null;

  // ── 数据源：聚焦某条收藏时以它为准，否则看当前时段 ──────────────────
  const focused =
    typeof focusedId === 'string' && focusedId.length > 0
      ? (Array.isArray(collections) ? collections : []).find((item) => item.id === focusedId) ?? null
      : null;

  const source = focused !== null ? focused : bucket;
  const isRecord = focused !== null;
  const recordKey = isRecord ? focused.id : 'current';

  const metrics = normalizeMetrics(focused === null ? props.metrics ?? null : focused);
  const modelEntries = Array.isArray(entries) ? entries : [];
  const stats = source !== null && source !== undefined ? source.stats ?? null : null;

  const modelMs = sumField(modelEntries, 'modelMs');
  const toolMs = stats !== null && Number.isFinite(stats.toolMs) ? stats.toolMs : 0;
  const turns = stats !== null && Number.isFinite(stats.turns) && stats.turns > 0
    ? stats.turns
    : metrics.turns;

  const taskName =
    source !== null && source !== undefined && typeof source.taskName === 'string' && source.taskName.length > 0
      ? source.taskName
      : null;

  const tags = source !== null && source !== undefined
    ? tagsOf(
        Number.isFinite(source.startedAt) ? source.startedAt : 0,
        Number.isFinite(source.activeMs) ? source.activeMs : 0,
      )
    : [];

  const currentVerdict = verdict[recordKey] ?? null;

  // ── 小构件 ────────────────────────────────────────────────────────
  const metric = (label, value) =>
    h('div', { className: 'ig-metric', key: label }, h('dt', null, label), h('dd', null, value));

  const note = (text, warn) =>
    h('p', { class: warn === true ? 'ig-note ig-note--warn' : 'ig-note', key: text }, text);

  const notes = [];
  if (stale) notes.push(note(t('card.stale'), true));
  if (metrics.degraded) notes.push(note(t('card.degraded'), true));
  else if (focused === null && (props.metrics ?? null) === null) notes.push(note(t('card.noData')));
  if (metrics.truncated) notes.push(note(t('card.windowTruncated')));

  // ── 逐模型行 ──────────────────────────────────────────────────────
  const modelRow = (entry) => {
    const key = entry.key;
    const notesForModel = Array.isArray(modelNotes[key]?.notes) ? modelNotes[key].notes : [];
    const rating =
      notesForModel.length > 0
        ? notesForModel.reduce((sum, item) => sum + (Number.isFinite(item.rating) ? item.rating : 0), 0) /
          notesForModel.length
        : 0;
    const isOpen = noteOpen === key;

    return h(
      'li',
      { class: 'ig-model', key },

      h(
        'div',
        { class: 'ig-model-head' },
        h('span', { class: 'ig-model-name' }, modelLabel(entry)),
        rating > 0 ? h('span', { class: 'ig-model-rating' }, ratingText(rating, t)) : null,
        h('span', { class: 'ig-model-time' }, formatElapsed(entry.modelMs, t)),
      ),

      h(
        'div',
        { class: 'ig-model-sub' },
        [
          t('card.turns') + ' ' + (Number.isFinite(entry.turns) ? entry.turns : 0),
          entry.cancelledMs > 0 ? t('card.cancelled', { duration: formatElapsed(entry.cancelledMs, t) }) : null,
        ]
          .filter((piece) => piece !== null && String(piece).length > 0)
          .join(' · '),
      ),

      // 已有备注：显示最近一条，不藏起来。
      !isOpen && notesForModel.length > 0
        ? h('p', { class: 'ig-note ig-note--quote' }, notesForModel[0].note || t('card.note.bare'))
        : null,

      isOpen
        ? h(
            'div',
            { class: 'ig-model-note' },
            // 五档：差 / 一般 / 还好 / 顺手 / 极其顺手。文字档比星星更诚实 ——
            // 「4 星」在用户心里没有稳定含义，文字有。
            h(
              'div',
              { class: 'ig-rating' },
              [1, 2, 3, 4, 5].map((value) =>
                h(
                  'button',
                  {
                    type: 'button',
                    key: value,
                    class: 'ig-rating-btn',
                    'aria-label': t('card.rating.aria', { n: value }),
                    title: t(`card.rating.${value}`),
                    onClick: () => {
                      const text = noteDraft.slice(0, NOTE_MAX);
                      handlers.rateModel({
                        modelKey: key,
                        rating: value,
                        note: text,
                        recordId: isRecord ? recordKey : null,
                        taskName,
                      });
                      setNoteDraft('');
                      setNoteOpen(null);
                    },
                  },
                  t(`card.rating.${value}`),
                ),
              ),
            ),
            h('textarea', {
              class: 'ig-textarea',
              rows: 2,
              placeholder: t('card.note.placeholder'),
              value: noteDraft,
              onChange: (event) => setNoteDraft(event.target.value),
            }),
          )
        : h(
            'button',
            {
              type: 'button',
              class: 'ig-model-add',
              onClick: () => {
                setNoteOpen(key);
                setNoteDraft(notesForModel.length > 0 ? notesForModel[0].note : '');
              },
            },
            notesForModel.length > 0 ? t('card.note.edit') : t('card.note.add'),
          ),
    );
  };

  // ── 目的确认 ──────────────────────────────────────────────────────
  // ── 历史累计行 ─────────────────────────────────────────────────────
  // rankModels 是纯函数（summary.js），复用它算跨会话排行。
  //
  // ⚠ **必须排除本次已出现的模型**：上面「各模型」区块已经列了它们，连带评分和
  // 备注。在历史里再列一遍就是同一屏出现两遍同样的内容（实测截图确认）——
  // 历史区块的价值恰恰在于「本次没用到、你以前常用」的那些模型。
  //
  // 只取前几条：记录卡是「看这次」的地方，历史越列越长就越界了。
  const presentKeys = modelEntries.map((item) => item.key);
  const historyRows = rankModels(props.sessions)
    .filter((entry) => presentKeys.indexOf(entry.key) === -1)
    .slice(0, HISTORY_ROWS);

  /** 历史累计的一行。 */
  const historyRow = (entry) => {
    const key = entry.key;
    const notes = Array.isArray(modelNotes[key]?.notes) ? modelNotes[key].notes : [];
    const rating =
      notes.length > 0
        ? notes.reduce((sum, item) => sum + (Number.isFinite(item?.rating) ? item.rating : 0), 0) /
          notes.length
        : 0;
    return h(
      'li',
      { class: 'ig-history-row', key },
      h(
        'div',
        { class: 'ig-hud-row-head' },
        h('span', { class: 'ig-hud-row-model' }, modelLabel(entry)),
        rating > 0 ? h('span', { class: 'ig-model-rating' }, ratingText(rating, t)) : null,
        h('span', { class: 'ig-hud-row-time' }, formatElapsed(entry.modelMs, t)),
      ),
      h(
        'div',
        { class: 'ig-hud-row-sub' },
        [t('card.history.sessions', { n: entry.turns }), t('card.history.calls', { n: entry.steps })]
          .join(' · '),
      ),
      notes.length > 0 && typeof notes[0].note === 'string' && notes[0].note.length > 0
        ? h('p', { class: 'ig-note ig-note--quote' }, notes[0].note)
        : null,
    );
  };

  const verdictButtons = ['yes', 'partial', 'no'].map((value) =>
    h(
      'button',
      {
        type: 'button',
        key: value,
        class: currentVerdict !== null && currentVerdict.verdict === value
          ? 'ig-verdict-btn ig-verdict-btn--on'
          : 'ig-verdict-btn',
        'aria-pressed': currentVerdict !== null && currentVerdict.verdict === value,
        onClick: () => {
          if (currentVerdict !== null && currentVerdict.verdict === value) {
            handlers.clearVerdict(recordKey);
            return;
          }
          handlers.setVerdict({ recordId: recordKey, verdict: value, note: verdictDraft.slice(0, NOTE_MAX) });
        },
      },
      t(`card.verdict.${value}`),
    ),
  );

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

      // ── 头部：任务名 + 关闭 ────────────────────────────────────────
      h(
        'div',
        { className: 'ig-panel-head' },
        h(
          'div',
          { className: 'ig-panel-head-text' },
          h('h2', { className: 'ig-panel-title' }, t('card.title')),
          h(
            'span',
            { className: 'ig-task' },
            taskName === null ? t('card.untitled') : taskName,
          ),
        ),
        // 「返回」而不是「×」（v9）：面板是从计时器推进过来的，× 语义是
        // 「关闭这个东西」，返回的语义是「回到上一层」—— 后者才对应用户的动作。
        h(
          'button',
          { type: 'button', className: 'ig-panel-back', onClick: handlers.backToMeter },
          h('span', { class: 'ig-back-icon', 'aria-hidden': 'true' }, '‹'),
          t('common.back'),
        ),
      ),

      // ── 总账 ──────────────────────────────────────────────────────
      h(
        'dl',
        { className: 'ig-metrics' },
        metric(t('card.modelTime'), formatElapsed(modelMs, t)),
        metric(t('card.turns'), metrics.degraded && turns === 0 ? '—' : String(turns)),
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

      // ── 逐模型明细 ────────────────────────────────────────────────
      modelEntries.length > 0
        ? h(
            'div',
            { className: 'ig-block' },
            h('h3', { className: 'ig-block-title' }, t('card.models')),
            h('ul', { className: 'ig-models' }, modelEntries.map(modelRow)),
          )
        : h('p', { className: 'ig-note' }, t('card.models.empty')),

      // ── 历史累计（v5）────────────────────────────────────────────
      // 「这次任务里哪个模型好使」和「我历次用下来觉得哪个好使」是两个问题。
      // 上面那份答前者；这里答后者 —— 每个模型累计跑了多久、写过几次、评分多少。
      // 不做单独页面，因为评价与数字并排才看得出关联，拆开就没意义了。
      historyRows.length > 0
        ? h(
            'div',
            { className: 'ig-block' },
            h('h3', { className: 'ig-block-title' }, t('card.history')),
            h('ul', { className: 'ig-history' }, historyRows.map(historyRow)),
          )
        : null,

      // ── 目的确认 ──────────────────────────────────────────────────
      h(
        'div',
        { className: 'ig-block' },
        h('h3', { className: 'ig-block-title' }, t('card.verdict.title')),
        h('p', { className: 'ig-note' }, t('card.verdict.hint')),
        h('div', { className: 'ig-verdict' }, verdictButtons),
        currentVerdict !== null || verdictDraft.length > 0
          ? h('textarea', {
              class: 'ig-textarea',
              rows: 2,
              placeholder: t('card.verdict.placeholder'),
              value: verdictDraft,
              onChange: (event) => setVerdictDraft(event.target.value),
            })
          : null,
      ),

      h(
        'div',
        { className: 'ig-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'ig-btn ig-btn--primary',
            onClick: handlers.saveCurrentRecord,
            disabled: isRecord || source === null || source === undefined || modelMs + toolMs < 60000,
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
        h(
          'button',
          { type: 'button', className: 'ig-btn ig-btn--quiet', onClick: handlers.openSummary },
          t('card.openSummary'),
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
    const name = typeof item.taskName === 'string' && item.taskName.length > 0 ? item.taskName : null;
    const verdict = item.verdict ?? null;

    return h(
      'li',
      { className: 'ig-row', key: item.id },

      // 左侧任务名：这是画廊里最该被看见的东西，比时长重要。
      h(
        'div',
        { className: 'ig-row-main' },
        h(
          'span',
          { className: 'ig-row-title' },
          name === null ? t('card.untitled') : name,
        ),
        h(
          'span',
          { className: 'ig-row-sub' },
          [
            formatDuration(item.activeMs, t),
            Array.isArray(item.models) && item.models.length > 0
              ? item.models.map((entry) => modelLabel(entry)).join(' · ')
              : null,
            t('card.turns') + ' ' + (Number.isFinite(item.turns) ? item.turns : 0),
            tags.map((id) => t(`tag.${id}`)).join(' · '),
          ]
            .filter((piece) => piece !== null && String(piece).length > 0)
            .join(' · '),
        ),
        verdict !== null && verdict !== undefined && verdict.verdict
          ? h(
              'span',
              { className: `ig-verdict-dot ig-verdict-dot--${verdict.verdict}` },
              t(`card.verdict.${verdict.verdict}`),
            )
          : null,
      ),

      // 回看：把这条记录带进记录卡，可以补评价和备注 —— 收藏不该是静态墓碑。
      h(
        'button',
        {
          type: 'button',
          className: 'ig-row-review',
          onClick: () => handlers.reviewRecord(item.id),
          title: t('gallery.review'),
          'aria-label': `${t('gallery.review')}: ${name === null ? t('card.untitled') : name}`,
        },
        t('gallery.review'),
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
        h(
          'button',
          { type: 'button', className: 'ig-panel-back', onClick: handlers.backToMeter },
          h('span', { class: 'ig-back-icon', 'aria-hidden': 'true' }, '‹'),
          t('common.back'),
        ),
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
 *   - 右上角常驻读数开关
 *   - 收藏 / 汇总入口
 *   - 埋点一行 + 复制统计
 *   - 清除本插件数据（两次确认）
 *
 * 强度选择（呼吸 / 静默）已随光带退役删除（ADR-123）；输入框常驻计时已在
 * v4 搬到右上角（见 hud.js），本行不再有那个开关。
 *
 * @module src/client/settings-row
 */

/**
 * 渲染设置行。
 *
 * @returns React 元素。
 */
function SettingsRow(props) {
  const { React, t, useImmersionGlow, actions, onCopyStats, onOpenGallery, onOpenSummary } = props;
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

          switchRow(t('settings.cornerMeter'), settings.showCornerMeter, (checked) =>
            actions.updateSettings({ showCornerMeter: checked }),
          ),
        )
      : null,

    // 收藏与汇总入口。
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
      h('button', { type: 'button', className: 'ig-btn', onClick: onOpenSummary }, t('settings.openSummary')),
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
  //
  // ⚠ attribution 是**记忆**：它存放在 useRef 里（页面生命周期内），不进 store。
  // 没有它，中途换模型后早期节点会被「当前模型」重新归一遍，于是新模型背上旧账。
  const attribution = React.useRef(null);
  const derived = deriveModelEntries({
    nodes: chatNodesOf(chatSnapshot),
    trajectory: rawTrajectory,
    currentModel,
    remembered: attribution.current,
  });
  attribution.current = derived.memory;
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

  // ① shell.overlay：记录卡 + 画廊 + 右上角读数 + 提醒卡 ────────────
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: 'immersion-glow.layer', order: 100 },
      function ImmersionLayer(props) {
        const useImmersionGlow = props.useImmersionGlow;
        const t = translator();

        // 分区随 activeSessionId / sessions 变化，selector 两个都要选到。
        const activeSessionId = useImmersionGlow((value) => value.activeSessionId);
        const sessionsMap = useImmersionGlow((value) => value.sessions);
        const summaryOpen = useImmersionGlow((value) => value.ui.summaryOpen);
        const cardOpen = useImmersionGlow((value) => value.ui.cardOpen);
        const galleryOpen = useImmersionGlow((value) => value.ui.galleryOpen);
        // 右上角展开面板要显示「我历来给这个模型评过什么」（v5）。
        const verdicts = useImmersionGlow((value) => value.verdicts ?? {});
        const modelNotes = useImmersionGlow((value) => value.modelNotes ?? {});

        // 记录卡的时段标签从分区起止时间推导（tagsOf），必须把分区本体传下去。
        // 时长读数也一并算好 —— hud 与 record-card 共用同一口径，避免两处各算一遍
        // 出现「右上角 8 分钟、卡片里 7 分钟」这种自相矛盾。
        const bucket = React.useMemo(() => {
          const found = sessionsMap?.[activeSessionId];
          return found === undefined ? null : found;
        }, [sessionsMap, activeSessionId]);

        const durationMs = React.useMemo(
          () => (bucket?.segment === undefined ? 0 : bucket.segment.activeMs),
          [bucket],
        );
        const durationText = React.useMemo(() => formatDuration(durationMs, t), [durationMs, t]);

        // 模型级条目：分区里存的是数组（可持久化），这里转成渲染要的形态。
        const entries = React.useMemo(
          () => modelEntriesFromArray(bucket?.models),
          [bucket],
        );

        const metrics = bucket?.metrics ?? null;
        const currentModel = bucket?.currentModel ?? null;
        // 「发起过询问」标志：记录卡与右上角都用它判断该不该显示数据。
        const started = isTaskStarted(bucket);

        const hudBucket = React.useMemo(
          () => (bucket === null ? null : { ...bucket, started }),
          [bucket, started],
        );

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
            : metrics.sessionId === null || currentId === null || metrics.sessionId !== currentId;

        const actionsRef = props.immersionGlowActions ?? actions;

        const shared = {
          React,
          t,
          useImmersionGlow,
          actions: actionsRef,
          durationText,
          stale,
          handlers,
          bucket,
          entries,
          metrics,
        };

        // ── 面板互斥（v8）───────────────────────────────────────────
        // 记录卡 / 画廊 / 汇总与计时器共用同一个锚点，同一时刻只显示一个。
        // 收拢态尤其必须让位：它就贴在面板正上方那个位置，两个同时在必然重叠 ——
        // 用户反馈「会被顶上的遮住」。所以这里直接**不渲染**它，而不是靠 z-index
        // 压层级；层级只能决定谁在上面，不能消除重叠本身。
        const panelOpen = cardOpen || galleryOpen || summaryOpen;

        return h(
          React.Fragment,
          null,
          panelOpen ? null : h(CornerMeter, {
            ...shared,
            bucket: hudBucket,
            stats: bucket?.stats ?? null,
            currentModel,
            verdicts,
            modelNotes,
          }),
          h(RecordCard, {
            ...shared,
            // 记录卡的「历史累计」用它算跨会话模型排行。
            sessions: sessionsMap,
          }),
          h(Gallery, { ...shared, actions: actionsRef }),
          summaryOpen ? h(Summary, shared) : null,
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
          onOpenSummary: handlers.openSummary,
        });
      },
    ),
  );

  // ── ③ conversation.input.left：探针（永远返回 null） ───────────────
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      { name: 'conversation.input.left', id: 'immersion-glow.probe', order: 100 },
      function ImmersionProbe(props) {
        // session 作用域的 standard props 里有 `sessionId: SessionId` —— 宿主
        // 直接给的、比在 root 侧反推更权威。探针每次渲染都把它认领回 root，
        // 于是即便 sessions.list 的解析在某个版本失效，分区指针仍然能切对。
        // （认领是幂等的：同一个 id 再 switchSession 只是刷新 updatedAt。）
        claimSessionFromProps(props.immersionGlowActions ?? actions, props, Date.now());

        // v4：探针不再渲染任何东西（时间搬去了右上角），只负责把 session 作用域
        // 才有的数据泵回 root。所以这里不需要 durationText / showInlineTimer。
        return h(SessionProbe, {
          React,
          t: translator(),
          // 计数的真实数据源：ui-chat 注入的 chat 快照（useSession 的
          // ConversationSnapshot 只有控制字段，数节点恒为 0 —— ADR-123）。
          useChat: props.useChat,
          useSession: props.useSession,
          // v4 新增：sessionStats / modelSelection / tokenUsage 三个投影。
          // 已核实这三个都在 conversation.input.left 的 standardProps 里。
          useProjection: props.useProjection,
          useImmersionGlow: props.useImmersionGlow,
          actions: props.immersionGlowActions ?? actions,
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

  // ── 顶部安全区：运行时量出导航栏底边，写进 --ig-safe-top ────────────
  // 计时器用它避开宿主右上角那排按钮。不写死数值的原因见 safe-top.js。
  ctx.effect(
    () => installSafeTop(typeof document === 'undefined' ? undefined : document),
    'immersion-glow: safe top',
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
    // 三个面板（计时器明细 / 记录卡 / 汇总）**互斥**：同一时刻只开一个，
    // 否则两个模态叠在一起，既看不清也点不准（用户反馈 v6）。
    openCard: () => {
      actions.countOpen();
      // 手动打开 = 看「当前这次」，所以清掉可能残留的聚焦。
      actions.setFocusedRecord(null);
      actions.setGalleryOpen(false);
      actions.setSummaryOpen(false);
      actions.setCardOpen(true);
    },
    /**
     * 打开（或展开）计时器明细 —— 这是「已看」的**唯一入口**。
     *
     * ⚠ v6 把提醒从「独立卡片」改成「计时器的一种状态」时，删掉了提醒卡组件，
     * 而清未读的唯一调用点在那个组件里 —— 于是提醒变成永远消不掉的红点
     * （用户实测反馈「有提醒未看，点进去永远触发不了已看」）。
     *
     * 现在语义收敛成一句：**点开计时器 = 已看**。收拢态点击与展开态的提醒条
     * 都走这里，不再依赖某个被删掉的组件。
     */
    openMeter: () => {
      actions.countOpen();
      actions.openMeter();
    },

    /** 只清掉提醒（展开态下点提醒条），不动面板的展开状态。 */
    dismissAlert: () => actions.dismissReminder(),

    /**
     * 从任何面板「返回」到展开态的计时器。
     *
     * 这是面板的唯一退出路径（顶部的「返回」按钮、以及点空白）。三件事一起做：
     * 关掉面板、把计时器展开、聚焦记录清空（否则下次打开记录卡还会停在
     * 「回看某条收藏」的语境里）。
     */
    backToMeter: () => {
      actions.setCardOpen(false);
      actions.setGalleryOpen(false);
      actions.setSummaryOpen(false);
      actions.setMeterOpen(true);
      actions.setFocusedRecord(null);
    },
    openGallery: () => {
      actions.setCardOpen(false);
      actions.setSummaryOpen(false);
      actions.setGalleryOpen(true);
    },
    /** 只关画廊（点遮罩用）；顶部按钮走 backToMeter。 */
    closeGallery: () => actions.setGalleryOpen(false),
    openSummary: () => {
      actions.setCardOpen(false);
      actions.setGalleryOpen(false);
      actions.setSummaryOpen(true);
    },
    closeSummary: () => actions.setSummaryOpen(false),

    /**
     * 从画廊「回看」某条收藏：关掉画廊，带焦点打开记录卡。
     *
     * 收藏不是静态墓碑 —— 回看之后还能补「达到目的了吗」和模型备注。
     */
    reviewRecord: (id) => {
      actions.countOpen();
      actions.setGalleryOpen(false);
      actions.setSummaryOpen(false);
      actions.setFocusedRecord(id);
      actions.setCardOpen(true);
    },

    /** 记「达到了吗」。recordKey 为 'current' 表示正在看还没收藏的当前时段。 */
    setVerdict: (payload) => actions.setVerdict(payload),
    clearVerdict: (recordKey) => actions.clearVerdict(recordKey),

    /** 记一条模型自评。 */
    rateModel: (payload) => actions.addModelNote({ ...payload, now: Date.now() }),

    /** 收藏当前时段。 */
    saveCurrentRecord: () => {
      const snapshot = state();
      const bucket = currentBucket(snapshot);
      const record = toRecord(bucket.segment, bucket.metrics, Date.now());
      const t = translator();
      if (record === null) return;

      // 分区里已经存着探针推导好的条目，这里只需校验形状。
      const entries = modelEntriesFromArray(bucket.models ?? []);
      // 收藏 id 在这里生成（而不是让 action 内部生成），因为紧接着的「把
      // 当前时段的自评迁到这条收藏」需要用到它。actions 拿不到返回值。
      const recordId = `r${record.createdAt}${snapshot.collections.length}`;
      actions.saveRecord({
        ...record,
        id: recordId,
        // 任务名与模型明细一起存进收藏，这样画廊/汇总不需要回查会话就能渲染。
        taskName: typeof bucket.taskName === 'string' ? bucket.taskName : null,
        models: entries,
        stats: bucket.stats ?? null,
        tags: tagsOf(bucket.segment.startedAt, bucket.segment.activeMs),
      });
      // 把当前时段已有的自评迁到这条收藏上，否则「收藏后再评价」会记到
      // 'current' 这个假 key 上，收藏里看不到。
      const currentVerdict = snapshot.verdicts?.current;
      if (currentVerdict !== null && currentVerdict !== undefined) {
        actions.setVerdict({
          recordId,
          verdict: currentVerdict.verdict,
          note: currentVerdict.note,
        });
      }
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
  // handlers 也经 root 面暴露出去。
  //
  // 为什么不只留在闭包里：三个面板「互斥」这条规则（打开记录卡要关掉汇总与
  // 画廊）正是 handler 里实现的，而它是**只有测得到才守得住**的不变量 ——
  // 单元测试过去复制了一份 handler 逻辑，等于在测复制品。暴露之后测试驱动的是
  // 真代码。组件侧也省得层层透传。
  ctx.slots.provideRoot({ props: { igHandlers: handlers } });

  registerSlots({ ctx, React, actions, translator, handlers });
}

exports.inject = ['slots'];
exports.apply = apply;

    return module.exports;
  },
});
