/**
 * 沉浸记录卡（v19 重排）。
 *
 * 一句话概括这次任务的账：坐了多久、花在哪个模型上、结果满不满意。
 *
 * ## 四块内容
 *   1. 任务名  —— 首次发起的首句（截断 60 字），来源见 session-log.js 的隐私说明
 *   2. 主数字  —— 这次坐了多久（activeMs），旁边一行是轮次与工具调用
 *   3. 模型明细 —— 逐模型一行，可展开逐条备注「这次用着怎么样」
 *   4. 目的确认 —— 达到了 / 基本达到 / 没达到，三档 + 一句备注
 *
 * ## 为什么只有一个主数字
 *
 * 旧版顶部是三格等重的灰卡片（模型耗时 / 轮次 / 工具调用）。三个数都重要，
 * 于是三个都不重要；而且它回答的其实不是「我坐了多久」，是「模型跑了多久」。
 * 现在主数字是沉浸时长，其余降成一行元信息 —— 用户第一眼看到的是自己。
 *
 * ## 为什么目的确认是三档不是开关
 *
 * 「基本做完但有返工」是最常见的真实状态。压成 boolean 会把它逼成两端之一，
 * 记录下来之后统计失真，几个月后回看就是一堆没信息量的 yes/no。
 *
 * ## 生命周期
 * 仅在展开时挂载；收起先播 0.18s 退场动画再卸载。
 *
 * @module src/client/record-card
 */

/** 退场动画时长，与 panel-css.js 里 .ig-panel--closing 的 0.18s 对齐。 */
const CLOSE_ANIMATION_MS = 180;

/** 一行备注的最大长度（与 state.js 的 MODEL_NOTE_LIMIT 一致量级）。 */
const NOTE_MAX = 200;

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

  // 指向目的备注文本域的 DOM 节点：点档位按钮时要读它的当前值（非受控）。
  const verdictFieldRef = React.useRef(null);

  /** 播放退场动画后再真正卸载。 */
  const close = React.useCallback(() => {
    setClosing(true);
    const timer = window.setTimeout(() => {
      setClosing(false);
      handlers.closeCard();
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [handlers]);

  /**
   * 把目的备注落盘。
   *
   * ⚠ 这是 P0 修复的核心。原先备注**只在点档位按钮时**才提交，而文本域又是
   * 「选了档才出现」—— 自然顺序（先选档 → 再写备注）下备注必然丢失；想补存
   * 得点另一个档位，点同一个反而把整条评价清空（实测复现）。
   *
   * 设计取舍：文本域是**非受控**的（`defaultValue` + `key`），提交时从事件里读
   * 文本。这样：
   *   - 不需要本地草稿 state，也就没有「草稿没初始化 → 失焦把原备注冲成空」
   *     这类风险（我第一版用受控 state 就踩了这个坑）；
   *   - `key` 绑定记录 id，切换回看的记录时自动重挂载并回显该条备注；
   *   - 提交是**幂等**的（值没变不写 store），可放心重复调用。
   */
  const commitVerdictNote = (text) => {
    const key = typeof focusedId === 'string' && focusedId.length > 0 ? focusedId : 'current';
    const current = verdict[key] ?? null;
    // 还没选档就没有可挂靠的评价 —— 留白是正确行为，不凭空造一条。
    if (current === null) return;
    const next = typeof text === 'string' ? text.slice(0, NOTE_MAX) : '';
    if (next === (typeof current.note === 'string' ? current.note : '')) return;
    handlers.setVerdict({ recordId: key, verdict: current.verdict, note: next });
  };

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

  // ⚠ 分区的时长/起点在 `segment` 里，**不在分区顶层**。
  // 旧版这里读 `source.activeMs` / `source.startedAt`：对「回看某条收藏」是对的
  // （收藏把这两个字段摊平了），对「当前会话」恒为 undefined —— 于是正在用的
  // 会话永远只带一个「碎片」标签、也没有起点。两条路必须各取各的字段。
  const segment = source !== null && source !== undefined ? source.segment ?? null : null;
  const activeMsOfSource = isRecord
    ? Number.isFinite(source.activeMs) ? source.activeMs : 0
    : segment !== null && Number.isFinite(segment.activeMs) ? segment.activeMs : 0;
  const startedAtOfSource = isRecord
    ? Number.isFinite(source.startedAt) ? source.startedAt : 0
    : segment !== null && Number.isFinite(segment.startedAt) ? segment.startedAt : 0;

  const taskName =
    source !== null && source !== undefined && typeof source.taskName === 'string' && source.taskName.length > 0
      ? source.taskName
      : null;

  const tags = source !== null && source !== undefined ? tagsOf(startedAtOfSource, activeMsOfSource) : [];

  // 这次停过几次（≥60 秒没有输入）。与汇总同一个口径，只是限定在本段。
  const stopRuns = isRecord
    ? Number.isFinite(source.stopRuns) ? source.stopRuns : 0
    : segment !== null && Number.isFinite(segment.stopRuns) ? segment.stopRuns : 0;
  const longestStopMs = isRecord
    ? Number.isFinite(source.longestStopMs) ? source.longestStopMs : 0
    : segment !== null && Number.isFinite(segment.longestStopMs) ? segment.longestStopMs : 0;

  const currentVerdict = verdict[recordKey] ?? null;
  // 取不到数据时主数字给「—」而不是「0 秒」：后者看起来像「你刚坐下」，
  // 而真实情况是「这次读不到」。旧版的指标格对这种情况也是给破折号。
  const hero = metrics.degraded ? { value: '—', unit: '' } : durationParts(activeMsOfSource, t);

  // ── 小构件 ────────────────────────────────────────────────────────
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
    // provider 单独露出：同名的模型可能来自不同线路，两行不能长得一样。
    const label = modelLabelParts(entry);

    return h(
      'li',
      { class: 'ig-model', key },

      h(
        'div',
        { class: 'ig-model-head' },
        h(
          'span',
          { class: 'ig-model-name' },
          label.name,
          label.provider === null
            ? null
            : h('span', { class: 'ig-model-provider' }, ` · ${label.provider}`),
        ),
        rating > 0 ? h('span', { class: 'ig-model-rating' }, ratingText(rating, t)) : null,
        h('span', { class: 'ig-model-time' }, formatElapsed(entry.modelMs, t)),
      ),

      h(
        'div',
        { class: 'ig-model-sub' },
        t('card.turns') + ' ' + (Number.isFinite(entry.turns) ? entry.turns : 0),
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
          // 从文本域当前值取备注（非受控）。可能还是 null（用它自己的 onKeyDown
          // 提交），所以只在有值时带上。
          handlers.setVerdict({
            recordId: recordKey,
            verdict: value,
            note: verdictFieldRef.current === null ? '' : String(verdictFieldRef.current.value ?? ''),
          });
        },
      },
      t(`card.verdict.${value}`),
    ),
  );

  // 元信息：轮次必有，工具调用为 0 时不写出来（「0 次工具」只是噪音）。
  const metaParts = [];
  if (!metrics.degraded && turns > 0) {
    metaParts.push(
      metrics.toolCalls > 0
        ? t('card.hero.meta', { turns, tools: metrics.toolCalls })
        : t('hud.turns', { n: turns }),
    );
  }

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

      // ── 头部：任务名 + 返回 ───────────────────────────────────────
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
        // 「返回」而不是 ×：面板是从读数推进过来的，退出动作的语义是
        // 「回到上一层」，不是一个孤零零的关闭。
        h(
          'button',
          { type: 'button', className: 'ig-panel-back', onClick: handlers.backToMeter },
          h('span', { class: 'ig-back-icon', 'aria-hidden': 'true' }, '‹'),
          t('common.back'),
        ),
      ),

      // ── 主数字：这次坐了多久 ───────────────────────────────────────
      h(
        'div',
        null,
        h(
          'div',
          { className: 'ig-card-hero' },
          h('span', { className: 'ig-card-hero-value' }, hero.value),
          h('span', { className: 'ig-card-hero-unit' }, hero.unit),
          metaParts.length > 0 ? h('span', { className: 'ig-card-hero-meta' }, metaParts[0]) : null,
        ),
        tags.length > 0
          ? h(
              'p',
              { className: 'ig-card-tags' },
              tags.map((id) => t(`tag.${id}`)).join(' · '),
            )
          : null,
        // 「这次你停过 2 次」比汇总里那个累计数更即时：刚结束的一段里，
        // 你真的离开过键盘，值得被说出来。
        stopRuns > 0
          ? h(
              'p',
              { className: 'ig-card-stop' },
              t('card.stops', { n: stopRuns, longest: formatElapsed(longestStopMs, t) }),
            )
          : null,
      ),

      notes.length > 0 ? h('div', null, notes) : null,

      // ── 逐模型明细 ────────────────────────────────────────────────
      h(
        'div',
        { className: 'ig-card-section' },
        h('h3', { className: 'ig-card-label' }, t('card.models')),
        modelEntries.length > 0
          ? h('ul', { className: 'ig-models' }, modelEntries.map(modelRow))
          : h('p', { className: 'ig-note' }, t('card.models.empty')),
      ),

      // ── 目的确认 ──────────────────────────────────────────────────
      h(
        'div',
        { className: 'ig-card-section' },
        h('h3', { className: 'ig-card-label' }, t('card.verdict.title')),
        h('p', { className: 'ig-note' }, t('card.verdict.hint')),
        h('div', { className: 'ig-verdict' }, verdictButtons),
        currentVerdict !== null
          ? h('textarea', {
              class: 'ig-textarea',
              rows: 2,
              // key 绑定记录：切换回看的收藏时重挂载，defaultValue 随之回显该条备注。
              key: `verdict-note-${recordKey}`,
              ref: verdictFieldRef,
              defaultValue: typeof currentVerdict.note === 'string' ? currentVerdict.note : '',
              placeholder: t('card.verdict.placeholder'),
              // 失焦提交覆盖「点按钮离开」；Escape 提交覆盖「按 Esc 关闭面板」——
              // 后者不会触发 blur，不处理就会丢字。
              onBlur: (event) => commitVerdictNote(event.target.value),
              onKeyDown: (event) => {
                if (event.key !== 'Escape') return;
                commitVerdictNote(event.target.value);
              },
            })
          : null,
      ),

      // 主操作固定在面板底部（.ig-card-actions 是 sticky 的）：
      // 旧版内容比容器高、滚动条又被藏起来，正好把「收藏」裁到折线以下。
      h(
        'div',
        { className: 'ig-card-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'ig-btn ig-btn--primary',
            onClick: handlers.saveCurrentRecord,
            disabled: isRecord || source === null || source === undefined || modelMs + toolMs < 60000,
          },
          t('card.save'),
        ),
        h(
          'button',
          { type: 'button', className: 'ig-btn ig-btn--quiet', onClick: handlers.openGallery },
          // 收藏数量放在「查看收藏」上：它描述的是那个入口里有什么，
          // 放在「收藏」上会让主按钮变长、在 340px 里折行。
          savedCount > 0 ? t('gallery.openFromSettings', { n: savedCount }) : t('card.openGallery'),
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
