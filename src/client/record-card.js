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
  // 只取前几条：记录卡是「看这次」的地方，历史越列越长就越界了。
  const historyRows = rankModels(props.sessions).slice(0, HISTORY_ROWS);

  /** 历史累计的一行。 */
  const historyRow = (entry) => {
    const key = entry.key;
    const notes = Array.isArray(modelNotes[key]?.notes) ? modelNotes[key].notes : [];
    const rating =
      notes.length > 0
        ? notes.reduce((sum, item) => sum + (Number.isFinite(item?.rating) ? item.rating : 0), 0) /
          notes.length
        : 0;
    const usedHere = modelEntries.some((item) => item.key === key);

    return h(
      'li',
      { class: 'ig-history-row', key },
      h(
        'div',
        { class: 'ig-hud-row-head' },
        h('span', { class: 'ig-hud-row-model' }, modelLabel(entry)),
        rating > 0 ? h('span', { class: 'ig-model-rating' }, ratingText(rating, t)) : null,
        usedHere ? h('span', { class: 'ig-history-now' }, t('card.history.now')) : null,
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
        h('button', { type: 'button', className: 'ig-panel-close', onClick: close }, t('card.close')),
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