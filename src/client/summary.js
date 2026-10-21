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

/** 时长分桶的边界（毫秒）：30 分钟 / 60 分钟。 */
const RHYTHM_SHORT_MS = 30 * 60000;
const RHYTHM_LONG_MS = 60 * 60000;

/** 汇总里至少要有这么多条「评过的记录」，这组数字才有可读性。 */
const RHYTHM_MIN_JUDGED = 3;

/**
 * 「长跑有没有用」：把**评过的收藏**按时长分三档，各算一个达成率。
 *
 * ## 为什么是这个问题
 *
 * 用户想知道「我这些时间换来了什么」。最直接的问法是「我常问什么」，但那要
 * 保存提问正文 —— 插件的承诺是只读首条消息的前 60 字作任务名，不读后续提问。
 * 换一个不碰正文、且更锋利的问法：**时间越长，结果越好还是越差？**
 *
 * 对沉迷 AI coding 的人来说，这组数字比任何劝告都有用：如果 60 分钟以上的
 * 达成率明显低于 30 分钟以内，那是他自己的数据在说话。
 *
 * ## 口径
 *
 * 只统计**既在收藏里、又评过档位**的记录（`verdicts[record.id]`）。没评的不进
 * 分母 —— 把「没评」当「没达成」会把达成率压到真实水平以下（与顶部总达成率同口径：
 * 达到 = 1 分，基本达到 = 0.5 分）。
 *
 * @param collections - 收藏记录数组。
 * @param verdicts - 按记录 id 索引的评价表。
 * @returns [{ key, judged, rate }]，只含非空桶；总数不足时返回空数组。
 */
function outcomeBuckets(collections, verdicts) {
  const list = Array.isArray(collections) ? collections : [];
  const table = verdicts === null || typeof verdicts !== 'object' ? {} : verdicts;
  const buckets = [
    { key: 'short', judged: 0, score: 0 },
    { key: 'mid', judged: 0, score: 0 },
    { key: 'long', judged: 0, score: 0 },
  ];

  for (const record of list) {
    if (record === null || record === undefined) continue;
    const verdict = table[record.id];
    const value = verdict === null || verdict === undefined ? null : verdict.verdict;
    if (value !== 'yes' && value !== 'partial' && value !== 'no') continue;
    const ms = Number.isFinite(record.activeMs) ? record.activeMs : 0;
    const index = ms <= RHYTHM_SHORT_MS ? 0 : ms <= RHYTHM_LONG_MS ? 1 : 2;
    buckets[index].judged += 1;
    buckets[index].score += value === 'yes' ? 1 : value === 'partial' ? 0.5 : 0;
  }

  const judgedTotal = buckets.reduce((sum, bucket) => sum + bucket.judged, 0);
  if (judgedTotal < RHYTHM_MIN_JUDGED) return [];

  return buckets
    .filter((bucket) => bucket.judged > 0)
    .map((bucket) => ({
      key: bucket.key,
      judged: bucket.judged,
      rate: bucket.score / bucket.judged,
    }));
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
  const telemetry = useImmersionGlow((state) => state.telemetry ?? {});

  if (!open) return null;

  const ranked = rankModels(sessions);
  const list = Array.isArray(collections) ? collections : [];
  const rhythm = outcomeBuckets(list, verdicts);

  // 休息回执：只数「停」，不数「服从」。
  //
  // 提醒弹出后「看到了但没点」是观测不到的 —— 我们只看得到输入安静了多久。
  // 所以这里不出现「继续了几次」，也不出现完成率：默认行为不是失败。
  const cued = Number.isFinite(telemetry.impressions) ? telemetry.impressions : 0;
  const stops = Number.isFinite(telemetry.stops) ? telemetry.stops : 0;
  const longestStopMs = Number.isFinite(telemetry.longestStopMs) ? telemetry.longestStopMs : 0;

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
    // 同一模型名可能来自不同 provider（key 不同、分别记账）。modelLabel 会省略
    // provider，于是两行长得一模一样 —— 汇总里必须把 provider 露出来才分得清。
    const label = modelLabelParts(entry);

    return h(
      'li',
      { class: 'ig-summary-row', key: entry.key },
      h(
        'div',
        { class: 'ig-summary-row-head' },
        h(
          'span',
          { class: 'ig-summary-row-name' },
          label.name,
          label.provider === null
            ? null
            : h('span', { class: 'ig-model-provider' }, ` · ${label.provider}`),
        ),
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
      //
      // ⚠ 这里必须用 `--share` 变体。旧版给唯一那一段设 flex-grow，而容器里
      // 没有别的孩子 —— 它永远把整条撑满，两行都是满格，等于没有信息。
      // share 模式下段用宽度百分比，剩下的就是轨道。
      totalModelMs(ranked) > 0
        ? h(
            'div',
            { class: 'ig-hud-bar ig-hud-bar--share' },
            h('span', {
              class: 'ig-hud-seg',
              style: { width: `${Math.max(2, Math.round((entry.modelMs / totalModelMs(ranked)) * 100))}%` },
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

      // 清除这个模型的全部备注。
      //
      // 这个入口不只是「方便」：modelNotes 是**按模型 key 无限增长**的持久化表
      // （键数量没有上限，单个模型下最多 200 条），而 clearModelNotes 在此之前
      // 是唯一定义了却没有任何调用点的 action —— 也就是说这张表只进不出，
      // 会一直吃 localStorage 配额。接线它既是补上缺失的功能，也是止住泄漏。
      notes.length > 0
        ? h(
            'button',
            {
              type: 'button',
              class: 'ig-summary-clear',
              onClick: () => handlers.clearModelNotes(entry.key),
            },
            t('summary.clearNotes', { n: notes.length }),
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

      // ── 休息回执 ──────────────────────────────────────────────────
      //
      // 只在真的停下来过时出现：没有「你还没歇过」这种句子。
      stops > 0
        ? h(
            'div',
            { className: 'ig-card-section' },
            h('h3', { className: 'ig-card-label' }, t('summary.rest.title')),
            h(
              'p',
              { className: 'ig-note' },
              t(cued > 0 ? 'summary.rest.line' : 'summary.rest.lineNoCue', {
                fired: cued,
                stops,
                longest: formatElapsed(longestStopMs, t),
              }),
            ),
            h('p', { className: 'ig-note' }, t('summary.rest.hint')),
          )
        : null,

      // ── 长跑有没有用 ──────────────────────────────────────────────
      //
      // 不碰正文的那半个「我常问什么」：时长 → 结果。数据全在收藏与评价里，
      // 不新增任何采集。
      rhythm.length >= 2
        ? h(
            'div',
            { className: 'ig-card-section' },
            h('h3', { className: 'ig-card-label' }, t('summary.rhythm.title')),
            h('p', { className: 'ig-note' }, t('summary.rhythm.hint')),
            h(
              'ul',
              { className: 'ig-rhythm' },
              rhythm.map((bucket) =>
                h(
                  'li',
                  { className: 'ig-rhythm-row', key: bucket.key },
                  h('span', { className: 'ig-rhythm-label' }, t(`summary.rhythm.${bucket.key}`)),
                  h(
                    'span',
                    { className: 'ig-rhythm-count' },
                    t('summary.rhythm.count', { n: bucket.judged }),
                  ),
                  h(
                    'span',
                    { className: 'ig-rhythm-rate' },
                    `${Math.round(bucket.rate * 100)}%`,
                  ),
                ),
              ),
            ),
          )
        : null,

      // ── 模型排行 ──────────────────────────────────────────────────
      ranked.length === 0
        ? h('p', { className: 'ig-note' }, t('summary.empty'))
        : h(
            'div',
            { className: 'ig-card-section' },
            h('h3', { className: 'ig-card-label' }, t('summary.models')),
            // 把「我们不做自动判断」写在明面上，避免用户把客观指标误读成评分。
            h('p', { className: 'ig-note' }, t('summary.disclaimer')),
            h('ul', { className: 'ig-summary-list' }, ranked.map(modelRow)),
          ),

      // 主出口固定在底部：加了「长跑有没有用」之后内容稳定超过 640px，
      // 不留 sticky 的话「查看收藏」会被推到折线以下，而滚动条是藏起来的。
      h(
        'div',
        { className: 'ig-card-actions' },
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