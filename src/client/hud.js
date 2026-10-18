/**
 * 右上角常驻读数（v4 新增，取代输入框常驻计时）。
 *
 * ## 为什么它必须常驻而不是只在跨阈值时闪
 * 阈值提醒卡只解决「你该歇了」，解决不了「我这次到底花了多久、在哪个模型上」。
 * 后者需要一个一直在的、小到不打扰的读数 —— 点它才展开明细。
 *
 * ## 显示门槛（两个条件都满足才出现）
 *   1. 插件启用，且**用户设过阈值**（阈值数组非空）；
 *   2. 本次会话**发起过至少一次询问**（分区里有 stats 或 models）。
 *
 * 第 2 条就是「在发起询问之前不统计时间」的实现：没发起过就没有时间可显示，
 * 右上角干净。这与用户的要求一致，也天然替代了「设了阈值才出现」。
 *
 * ## 三种形态
 *   - 收拢   一行：模型名 · 累计耗时。点它展开。
 *   - 展开   明细面板：逐模型耗时条 + 工具时间 + token。
 *   - 未读   阈值提醒超时后的徽标（由 reminder.js 渲染，本组件不碰）。
 *
 * 收拢态刻意只放两个数：再多就成了仪表盘，而它该是环境的一部分。
 *
 * @module src/client/hud
 */

/** 收拢态一行放不下时，模型名的截断长度。 */
const HUD_MODEL_MAX = 22;

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

  // 「只有设置了阈值后才会出现」—— 阈值为空即视为没设。
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
 * 截断模型名用于收拢态显示。
 *
 * 从中间省略而不是尾部截断 —— 「deepseek-chat…」比「deepseek-ch…」可辨认得多。
 *
 * @param label - 完整模型名。
 * @returns 适合单行显示的短名。
 */
function shortModelLabel(label) {
  if (typeof label !== 'string') return '';
  if (label.length <= HUD_MODEL_MAX) return label;
  const keep = Math.floor((HUD_MODEL_MAX - 1) / 2);
  return `${label.slice(0, keep)}…${label.slice(-keep)}`;
}

/**
 * 算出一条横向占比条的分段。
 *
 * 用途：让「哪个模型占掉了我这次的时间」一眼可见 —— 纯数字要心算，条不用。
 * 全零时返回一条满格占位，避免渲染出一条 0 宽的碎条看起来像 bug。
 *
 * @param entries - 模型条目数组（已按 modelMs 降序）。
 * @param totalMs - 总耗时（modelMs + toolMs）。
 * @returns [{ key, fraction }]，fraction ∈ (0,1]。
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
  // 取整到小数点后 3 位，避免多个极小分段各自显示成 "0%"。
  return segments.map((segment) => ({
    key: segment.key,
    entry: segment.entry,
    fraction: Math.round(segment.fraction * 1000) / 1000,
  }));
}

/**
 * 渲染右上角常驻读数。
 *
 * @param props - { React, t, useImmersionGlow, actions, bucket, entries,
 *   stats, currentModel, handlers }
 * @returns React 元素或 null。
 */
function CornerMeter(props) {
  const { React, t, useImmersionGlow, actions, bucket, entries, stats, currentModel } = props;
  const h = React.createElement;

  const [open, setOpen] = React.useState(false);
  // 订阅 settings 只为触发门槛判定：enabled / showCornerMeter / thresholds 任意
  // 一个变化都要立刻反映到「显不显示」上。
  const snapshot = useImmersionGlow((value) => value);

  // 卸载时不必保留展开态：读数是常驻的，下次打开本来就在同一屏。
  React.useEffect(() => {
    if (snapshot?.settings?.enabled !== true) setOpen(false);
  }, [snapshot?.settings?.enabled]);

  if (!shouldShowMeter(snapshot, bucket)) return null;

  // ── 数据 ──────────────────────────────────────────────────────────
  const modelMs = sumField(entries, 'modelMs');
  const toolMs = stats !== null && stats !== undefined && Number.isFinite(stats.toolMs) ? stats.toolMs : 0;
  const cancelledMs = sumField(entries, 'cancelledMs');
  const totalMs = modelMs + toolMs;

  const activeModel = currentModel === null || currentModel === undefined ? null : currentModel;
  const headline =
    activeModel === null
      ? t('hud.noModel')
      : shortModelLabel(modelLabel(activeModel));

  const list = Array.isArray(entries) ? entries : [];
  const segments = buildSegments(list, modelMs);

  // ── 收拢态 ────────────────────────────────────────────────────────
  if (!open) {
    return h(
      'button',
      {
        type: 'button',
        class: 'ig-hud',
        'aria-expanded': 'false',
        'aria-label': t('hud.open.aria', { duration: formatDuration(modelMs, t) }),
        title: t('hud.open.aria', { duration: formatDuration(modelMs, t) }),
        onClick: () => setOpen(true),
      },
      // 小圆点：与右上角提醒卡的未读点同一语言，但更淡 —— 它是常态，不是事件。
      h('span', { class: 'ig-hud-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'ig-hud-model' }, headline),
      h('span', { class: 'ig-hud-time' }, formatDuration(modelMs, t)),
    );
  }

  // ── 展开态 ────────────────────────────────────────────────────────
  const row = (entry) =>
    h(
      'li',
      { class: 'ig-hud-row', key: entry.key },
      h(
        'div',
        { class: 'ig-hud-row-head' },
        h('span', { class: 'ig-hud-row-model' }, modelLabel(entry)),
        h('span', { class: 'ig-hud-row-time' }, formatDuration(entry.modelMs, t)),
      ),
      h(
        'div',
        { class: 'ig-hud-row-sub' },
        [
          t('hud.turns', { n: entry.turns }),
          t('hud.steps', { n: entry.steps }),
          entry.cancelledMs > 0 ? formatDuration(entry.cancelledMs, t) : null,
        ]
          .filter((piece) => piece !== null && String(piece).length > 0)
          .join(' · '),
      ),
    );

  return h(
    'div',
    { class: 'ig-hud-panel', role: 'dialog', 'aria-label': t('hud.title') },

    h(
      'div',
      { class: 'ig-hud-head' },
      h(
        'div',
        { class: 'ig-hud-head-text' },
        h('span', { class: 'ig-hud-title' }, t('hud.title')),
        h(
          'span',
          { class: 'ig-hud-subtitle' },
          bucket !== null && bucket !== undefined && bucket.taskName
            ? bucket.taskName
            : t('hud.untitled'),
        ),
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
        '−',
      ),
    ),

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
              title: `${modelLabel(segment.entry)} · ${formatDuration(segment.entry.modelMs, t)}`,
            }),
          ),
        )
      : null,

    h(
      'dl',
      { class: 'ig-hud-figures' },
      figure(t('hud.modelTime'), formatDuration(modelMs, t)),
      figure(t('hud.toolTime'), toolMs > 0 ? formatDuration(toolMs, t) : '—'),
    ),

    list.length > 0
      ? h('ul', { class: 'ig-hud-list' }, list.map(row))
      : h('p', { class: 'ig-note' }, t('hud.empty')),

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
 * 一格「标签 + 数值」。收拢的 dl > div > span，避免给读数堆不必要的语义。
 * @param label - 标签文案。
 * @param value - 数值文案。
 * @returns React 元素。
 */
function figure(label, value) {
  return h(
    'div',
    { class: 'ig-hud-figure' },
    h('dt', null, label),
    h('dd', null, value),
  );
}