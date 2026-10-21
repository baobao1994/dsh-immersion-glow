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
 * ⚠ 字典是普通对象字面量：**重复的键不会报错，后写的静默覆盖先写的**。
 * 2026-10 曾因此让英文界面的「清除备注」显示成中文（同一个 key 写了两遍，
 * 第二遍是中文）。加词前先搜一遍 key。
 *
 * @module src/client/dict
 */

/** 字典命名空间。注册与取值都用它。 */
const NS = 'immersionGlow';

/** 简体中文。key 集合是事实来源，en 必须与之等长。 */
const ZH = {
  // ── 右上角读数 ───────────────────────────────────────────────────
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
  // 常态：告诉用户「下一次休息在什么时候」，而不是「这个 UI 元素还有多久收起」。
  'hud.next': '{duration} 后提醒你',
  // 到点：一句话 + 一张卡。卡片文案说的是这个人，不是这份数据。
  'hud.alert.body': '该歇了',
  'hud.alert.unread': '该歇了，点一下',
  'hud.alert.card.body': '起来走两步，或者看向 6 米外 20 秒。',
  'hud.alert.card.rest': '好，歇一下',
  'hud.alert.card.later': '先记着',
  'hud.alert.seconds': '{n}s',
  'hud.alert.dismiss': '知道了',
  // 休息态：点了「歇一下」之后的 20 秒。
  'hud.resting': '歇一会儿',
  'hud.resting.seconds': '看向远处 {n}s',
  'hud.openCard': '看这次记录',
  'hud.openSummary': '看汇总',

  'card.title': '沉浸记录',
  'card.turns': '对话轮次',
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
  'card.hero.meta': '{turns} 轮 · {tools} 次工具',
  'card.stops': '这次你停下来 {n} 次 · 最长 {longest}',
  'card.models': '各模型',
  'card.models.empty': '没有模型记录。发起一次询问后这里才会有数据。',
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
  'card.rating.summary': '{score} 分',
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
  'summary.clearNotes': '清除这 {n} 条备注',
  'summary.verdictRate': '达成率',
  'summary.judged': '已评价',
  'summary.kept': '收藏',
  'summary.verdictEmpty': '还没有评价过任何一次任务。',
  'summary.verdictBreakdown': '达到了 {yes} 次 · 基本达到 {partial} 次 · 没达到 {no} 次',
  // 「长跑有没有用」：不碰正文的半个「我常问什么」—— 时长 → 结果的对照。
  // 休息回执：只数「停」，不数「服从」。
  'summary.rest.title': '休息',
  'summary.rest.line': '提醒 {fired} 次 · 你停下来 {stops} 次 · 最长 {longest}',
  'summary.rest.lineNoCue': '你停下来 {stops} 次 · 最长 {longest}',
  'summary.rest.hint': '「停下来」= 连续 60 秒没有任何输入。它不需要按任何按钮。',
  'summary.rhythm.title': '长跑有没有用',
  'summary.rhythm.hint': '只统计评过的收藏。时间越长，达成率是升还是降？',
  'summary.rhythm.short': '30 分钟以内',
  'summary.rhythm.mid': '30–60 分钟',
  'summary.rhythm.long': '1 小时以上',
  'summary.rhythm.count': '{n} 次',

  'gallery.title': '收藏画廊',
  'gallery.openFromSettings': '查看收藏（{n}）',
  'gallery.emptyFromSettings': '收藏',
  'gallery.empty': '还没有收藏。展开记录卡后点「收藏这张记录」即可。',
  'gallery.count': '已积累 {n} 张',
  'gallery.remove': '删除这条',
  'gallery.remove.aria': '删除收藏记录',
  'gallery.review': '回看',
  'gallery.clear': '清空全部',
  'gallery.clear.confirm': '再点一次确认清空',

  'settings.title': '沉浸觉察',
  'settings.desc': '沉浸一段时间后，在右上角提醒你回看这次任务的账。',
  'settings.enabled': '启用',
  'settings.enabled.desc': '沉浸到阈值时，右上角的暖点会提醒你。',
  'settings.disabled.desc': '开启后，右上角才会出现读数。',
  'settings.thresholds': '触发阈值（分钟）',
  'settings.thresholds.hint': '用逗号分隔，最后一档之后按末档步长继续。留空则右上角不显示读数。',
  'settings.thresholds.invalid': '需要 1–6 个正整数，且严格递增。',
  'settings.idle': '空闲冻结（分钟）',
  'settings.idle.hint': '超过这段时间没有操作就不再累加。',
  'settings.cornerMeter': '在右上角显示常驻读数',
  'settings.cornerMeter.desc': '关掉后仍然计时与提醒，只是角落不出现读数。',
  'settings.records.title': '记录与数据',
  'settings.telemetry': '已提醒 {impressions} 次 · 你打开了 {opens} 次',
  'settings.copy': '复制统计',
  'settings.copied': '统计信息已复制到剪贴板',
  'settings.copyFailed': '复制失败，请手动选择文本',
  'settings.openSummary': '打开汇总',
  'settings.clearData': '清除本插件数据',
  'settings.clearData.action': '清除',
  'settings.clearData.desc': '设置、收藏、评价一并删除，无法恢复。',
  'settings.clearData.confirm': '再点一次确认清除',

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
  'unit.second': '{n}s',
  // 主数字的单位单独成词：记录卡把它拆成「大数字 + 小单位」两段排版。
  'unit.secondUnit': '秒',
  'unit.minuteUnit': '分钟',
  'unit.hourUnit': '小时',
};

/** English. 必须覆盖 ZH 的每一个 key。 */
const EN = {
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
  'hud.next': 'next reminder in {duration}',
  'hud.alert.body': 'Time to step away',
  'hud.alert.unread': 'Step away — click',
  'hud.alert.card.body': 'Stand up and walk a little, or look 6 m away for 20 s.',
  'hud.alert.card.rest': 'Take a break',
  'hud.alert.card.later': 'Later',
  'hud.alert.seconds': '{n}s',
  'hud.alert.dismiss': 'Got it',
  'hud.resting': 'Resting',
  'hud.resting.seconds': 'look far away {n}s',
  'hud.openCard': 'This record',
  'hud.openSummary': 'Summary',

  'card.title': 'Immersion record',
  'card.turns': 'Conversation turns',
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
  'card.hero.meta': '{turns} turns · {tools} tools',
  'card.stops': 'You stopped {n} times · longest {longest}',
  'card.models': 'By model',
  'card.models.empty': 'No model data yet. It appears once you send a request.',
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
  'card.rating.summary': '{score}',
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
  'summary.clearNotes': 'Clear these {n} notes',
  'summary.verdictRate': 'Hit rate',
  'summary.judged': 'Judged',
  'summary.kept': 'Kept',
  'summary.verdictEmpty': 'No task has been judged yet.',
  'summary.verdictBreakdown': '{yes} yes · {partial} mostly · {no} no',
  'summary.rest.title': 'Rest',
  'summary.rest.line': 'Cued {fired} times · you stopped {stops} times · longest {longest}',
  'summary.rest.lineNoCue': 'You stopped {stops} times · longest {longest}',
  'summary.rest.hint': '“Stopped” means 60 seconds with no input at all — no button required.',
  'summary.rhythm.title': 'Does the long haul pay off?',
  'summary.rhythm.hint': 'Only rated records count. As the time grows, does the hit rate?',
  'summary.rhythm.short': 'Under 30 min',
  'summary.rhythm.mid': '30–60 min',
  'summary.rhythm.long': 'Over an hour',
  'summary.rhythm.count': '{n} rated',

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

  'settings.title': 'Immersion awareness',
  'settings.desc': 'After a stretch of focus, a reminder in the top-right corner points you at this task’s ledger.',
  'settings.enabled': 'Enabled',
  'settings.enabled.desc': 'When you reach a threshold, the ember in the corner nudges you.',
  'settings.disabled.desc': 'The corner reading appears only when this is on.',
  'settings.thresholds': 'Thresholds (minutes)',
  'settings.thresholds.hint': 'Comma separated. After the last step it repeats at that step. Leave empty to hide the top-right reading.',
  'settings.thresholds.invalid': 'Needs 1–6 positive integers in strictly increasing order.',
  'settings.idle': 'Idle freeze (minutes)',
  'settings.idle.hint': 'Time without input stops the counter.',
  'settings.cornerMeter': 'Show a resident reading in the top-right',
  'settings.cornerMeter.desc': 'Timing and reminders keep working; only the corner reading is hidden.',
  'settings.records.title': 'Records & data',
  'settings.telemetry': 'Cued {impressions} times · you opened it {opens} times',
  'settings.copy': 'Copy stats',
  'settings.copied': 'Stats copied to the clipboard',
  'settings.copyFailed': 'Copy failed — select the text manually',
  'settings.openSummary': 'Open summary',
  'settings.clearData': 'Clear this plugin’s data',
  'settings.clearData.action': 'Clear',
  'settings.clearData.desc': 'Settings, kept records and ratings are deleted. This cannot be undone.',
  'settings.clearData.confirm': 'Click again to confirm',

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
  'unit.second': '{n}s',
  'unit.secondUnit': 'sec',
  'unit.minuteUnit': 'min',
  'unit.hourUnit': 'h',
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
 * 优先用 locale 服务给的 `t`；它返回 key 本身说明缺词，此时回退到本文件内置的
 * 同语言字典，再回退 zh，最后才是 key。
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
  // 秒档用 `Math.round` 后取 max(0,·)：0 就老老实实显示「0 秒」，不该因为
  // 想避免「亚秒也显示 1」而把真正的空态抬成「1 秒」（用户反馈：新会话空数据
  // 时读到 1 秒，误导以为已经算了 1 秒）。
  if (value < 60000) return t('unit.secondShort', { n: Math.max(0, Math.round(value / 1000)) });
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

/**
 * 把毫秒拆成「大数字 + 小单位」两段，供记录卡的主数字排版。
 *
 * 为什么不复用 formatElapsed：主数字要的是 `14` + `分钟` 两段分别设字号，
 * 而 formatElapsed 返回的是一整句。低于一分钟按秒给（57 秒不该显示「不到
 * 1 分钟」——那个粒度对时长没有信息量）。
 *
 * @param ms - 毫秒。
 * @param t - 翻译函数。
 * @returns {{ value: string, unit: string }}
 */
function durationParts(ms, t) {
  const value = Math.max(0, Number.isFinite(ms) ? ms : 0);
  if (value < 60000) {
    return { value: String(Math.round(value / 1000)), unit: t('unit.secondUnit') };
  }
  if (value < 3600000) {
    return { value: String(Math.floor(value / 60000)), unit: t('unit.minuteUnit') };
  }
  const hours = value / 3600000;
  return { value: (Math.round(hours * 10) / 10).toFixed(1), unit: t('unit.hourUnit') };
}
