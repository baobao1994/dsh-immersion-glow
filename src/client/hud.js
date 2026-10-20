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

  // 环的进度与中心读数都用「活跃时长」（activeMs）：这是本插件要量的沉浸时长，
  // 发起后会随 tick 每秒走一格 —— 用户看到的圆环/耗时是个会动的秒表，而不是
  // 只在模型调用时跳一下的模型净耗时（用户反馈：读数卡住、不每秒更新）。
  // activeMs 的精确口径（空闲冻结 / 模型回答期间豁免）见 timing.tick。
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
      h('span', { class: 'ig-ring-text' }, compactElapsed(activeMs, t)),
    );

  // ── 收拢态 ────────────────────────────────────────────────────────
  if (!open) {
    return h(
      'button',
      {
        type: 'button',
        class: 'ig-hud',
        'aria-expanded': 'false',
        'aria-label': t('hud.open.aria', { duration: formatElapsed(activeMs, t) }),
        title: `${modelName} · ${formatElapsed(activeMs, t)}`,
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
          h('span', { class: 'ig-hud-time' }, formatElapsed(activeMs, t)),
        ),

        // ── 第二行：副行，只在需要解释第一行时才出现 ─────────────────
        // 常态：说清这个数是什么（「模型耗时 4 分钟」），因为中心那个「4」在
        // 44px 的圆里是个没有单位的数，不解释它就是天书。
        // 提醒态：换成「还有多久收起」——这是提醒态下唯一需要额外说明的事。
        alert === null
          ? h('span', { class: 'ig-hud-sub-line' }, t('hud.elapsed'), ' · ', progressLabel(t, progress, activeMs))
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
    // 同模型不同 provider 是两条账，列表里要能区分（见 modelLabelParts）。
    const label = modelLabelParts(entry);

    return h(
      'li',
      { class: 'ig-hud-row', key },

      h(
        'div',
        { class: 'ig-hud-row-head' },
        h(
          'span',
          { class: 'ig-hud-row-model' },
          label.name,
          label.provider === null
            ? null
            : h('span', { class: 'ig-model-provider' }, ` · ${label.provider}`),
        ),
        rating > 0 ? h('span', { class: 'ig-model-rating' }, ratingText(rating, t)) : null,
        h('span', { class: 'ig-hud-row-time' }, formatElapsed(entry.modelMs, t)),
      ),

      h(
        'div',
        { class: 'ig-hud-row-sub' },
        // 只有模型条目 schema 里真实存在的字段。早先这里还拼过一个
        // `entry.cancelledMs`，但那个字段**没有任何生产者**（见 model-log.js 的
        // emptyModelEntry）—— `undefined > 0` 恒为 false，整段是死代码，
        // 还让人误以为「中断耗时」这个能力存在。已删除。
        [t('hud.turns', { n: entry.turns }), t('hud.steps', { n: entry.steps })].join(' · '),
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
        h('span', { class: 'ig-hud-subtitle' }, `${modelName} · ${formatElapsed(activeMs, t)}`),
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
 * ⚠ 必须**接收算好的 progress**，不要在这里再调一次 ringProgress。
 *
 * 早先版本自己重算了一遍（相同输入），于是同一次渲染里同一语义算两次。两次
 * 结果一旦分叉，就会出现「环显示快满了、副行却说还有 12 分钟」这种自相矛盾 ——
 * 而这正是 v11「卡在 1 秒」的成因模式：**同一语义两处实现，其中一处漏了修正**。
 * 环与文案来自同一个数，就不可能互相打架。
 *
 * @param t - 翻译函数。
 * @param progress - 已经算好的 ringProgress 结果。
 * @param activeMs - 当前净活跃毫秒。
 * @returns 文案。
 */
function progressLabel(t, progress, activeMs) {
  if (progress === null || progress === undefined || progress.nextAtMs <= 0) return '';
  const elapsed = Number.isFinite(activeMs) ? activeMs : 0;
  const remainingMs = Math.max(0, progress.nextAtMs - elapsed);
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