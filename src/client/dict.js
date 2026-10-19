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
  // 提醒现在是计时器的一种状态，文案因此是「一句话」而不是一张卡片的标题+正文。
  'hud.alert.body': '该歇一下了',
  'hud.alert.unread': '有提醒未看',
  'hud.alert.seconds': '{n}s 后收起',
  'hud.openCard': '打开记录卡',
  'hud.openSummary': '看汇总',

  'card.title': '沉浸记录',
  'card.duration': '沉浸时长',
  'card.turns': '对话轮次',
  'card.toolCalls': '工具调用',
  'card.modelTime': '模型耗时',
  'card.tags': '时段',
  'card.close': '关闭',
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
  'card.history.now': '本次',
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
  'hud.alert.body': 'Time to step away',
  'hud.alert.unread': 'Unread reminder',
  'hud.alert.seconds': 'hides in {n}s',
  'hud.openCard': 'Open record',
  'hud.openSummary': 'Summary',

  'card.title': 'Immersion record',
  'card.duration': 'Focus time',
  'card.turns': 'Conversation turns',
  'card.toolCalls': 'Tool calls',
  'card.modelTime': 'Model time',
  'card.tags': 'Time of day',
  'card.close': 'Close',
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
  'card.history.now': 'this run',
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
