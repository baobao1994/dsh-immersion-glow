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
