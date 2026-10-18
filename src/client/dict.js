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
