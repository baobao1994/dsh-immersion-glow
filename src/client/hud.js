/**
 * 右上角读数（v19：圆环 → 一颗会呼吸的暖点）。
 *
 * ## 形态
 *   - 收拢  一颗暖点 + 一个数字 + 一句关于这个人的话
 *   - 到点  暖点停止呼吸、定在全亮，同一位置长出一张小暖卡（说坐了多久 + 「歇一下」）
 *   - 休息  点了「歇一下」之后，暖点把呼气拉长到 7 秒，数 20 秒再回来
 *   - 未读  暖点常亮，一句话变成「该歇了，点一下」
 *   - 展开  从暖点长出的面板：占比条 + 两格数字 + 逐模型明细（含历史评价）
 *
 * ## 为什么拿掉圆环
 *
 * 旧版圆环有三个说不清的地方：
 *   1. 环心那个数字和右边那个数字**是同一个值**（都是 activeMs），
 *      收拢态实际显示的是「14 14 分钟」；
 *   2. 环天生读作「完成度」，而它要表达的是「离该歇还有多远」——
 *      每个新用户都得先被解释一遍；
 *   3. 到提醒时它反而**变窄**（225px → 179px），越该被看见的时候越不显眼。
 *
 * 现在把「进度」交给暖点的光晕（`--ig-heat`），把「时间」交给唯一的那个数字。
 * 两个语义各自有形状，不再挤在一个环里。
 *
 * ## 为什么到点反而静止
 *
 * 呼吸是常态的语言。真到该提醒的时候，暖点停止呼吸、定在全亮 ——
 * 读起来是「它睁眼了」，比闪得更快更让人抬头。呼吸频率 5 秒一次
 * （= 12 次/分，接近安静坐着时的频率）也刻意选在「不像告警」的一侧。
 *
 * @module src/client/hud
 */

/** 点「好，歇一下」之后，读数进入休息态多久（毫秒）。 */
const REST_MS = 20000;

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

  // 「只有设置了阈值后才会出现」—— 阈值为空即视为没设，也就没有下一次可报。
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
 * 渲染右上角读数。
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
  // 而提醒卡与读数是两个组件。本地 state 做不到，得靠事件总线 —— 不值得。
  const open = useImmersionGlow((value) => value.ui.meterOpen === true);
  // 收起面板。⚠ 别再用匿名箭头里的临时变量取代它：v19 重写时这一行被漏掉，
  // × 的 onClick 里引用了不存在的 setOpen，点了直接抛 ReferenceError ——
  // 「按钮没反应」的真因就是这个（不是层级、不是 pointer-events）。
  const setOpen = (next) => actions.setMeterOpen(next);
  const reminder = useImmersionGlow((value) => value.ui.reminder ?? null);
  // 订阅整个快照：门槛判定、阈值、耗时、自评任何一处变化都要立刻反映。
  const snapshot = useImmersionGlow((value) => value);

  // 走秒驱动：提醒倒计时与休息倒计时都靠它。
  // 刻意用急切求值 `Date.now()` 而不是惰性初始化：测试里的假 React 不会执行
  // useState 的惰性函数，惰性写法会让 nowMs 永远是初始值。
  const [tick, setTick] = React.useState(Date.now());
  // 休息态的截止时刻。0 = 没在休息。
  // 放组件本地而不是 store：它是「这一次点击之后 20 秒内」的临时状态，
  // 刷新页面后继续数秒没有意义（甚至会让人以为休息还在进行）。
  const [restUntil, setRestUntil] = React.useState(0);

  const hasReminder = reminder !== null && reminder !== undefined;
  const reminderSeq = hasReminder ? reminder.seq ?? 0 : 0;

  React.useEffect(() => {
    if (!hasReminder && restUntil === 0) return undefined;
    const timer = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [reminderSeq, restUntil]);

  // 休息结束：把截止时刻清回 0，上面的 interval 随之停掉。
  React.useEffect(() => {
    if (restUntil !== 0 && tick >= restUntil) setRestUntil(0);
  }, [tick, restUntil]);

  // 倒计时/休息态取「tick 与真实时间中较新的那个」。
  //
  // tick 只有在提醒或休息存在时才走秒；提醒刚到的那一帧 tick 还停在挂载时刻，
  // 直接拿它算会先闪出一个大得离谱的数字（差了多久就显示多久），半秒后才被纠正。
  // 取较大值等于「永远用最新的那个」，而 tick 仍然负责在每 500ms 推动一次渲染。
  const nowMs = hasReminder || restUntil !== 0 ? Math.max(tick, Date.now()) : tick;
  const alert = reminderStateOf(reminder, nowMs);
  const resting = restUntil > nowMs;
  const restSecondsLeft = resting ? Math.max(1, Math.ceil((restUntil - nowMs) / 1000)) : 0;

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

  // 进度与读数用同一个口径（activeMs）：这是本插件要量的沉浸时长，
  // 发起后随 tick 每秒走一格。档位语义见 timing.nextThresholdMs（不封顶）。
  const progress = ringProgress({
    elapsedMs: activeMs,
    thresholdsMin: snapshot.settings.thresholdsMin,
    modelMs,
  });

  // 暖点的「热度」：本档内走了多少。它只影响光晕铺开的半径，不影响颜色 ——
  // 颜色变化留给「到点」那一次，否则整个小时都在变色，反而没人注意得到。
  const heat = Math.min(1, Math.max(0, progress.ratio));

  // 提醒卡正文：时段决定动作（白天起来走，深夜去睡），次数决定说哪一条。
  // impressions 在弹出前自增，所以减一才是「第几次」的 0 基序号。
  const alertSeq = Math.max(0, Number(snapshot.telemetry?.impressions ?? 1) - 1);
  const alertLine = reminderLine(new Date().getHours(), alertSeq);

  const activeModel = currentModel === null || currentModel === undefined ? null : currentModel;
  const modelName = activeModel === null ? t('hud.noModel') : modelLabel(activeModel);
  const list = Array.isArray(entries) ? entries : [];
  const segments = buildSegments(list, modelMs);
  const notesTable = modelNotes ?? {};
  const verdictTable = verdicts ?? {};

  // ── 小构件 ────────────────────────────────────────────────────────
  /** 暖点。heat 通过自定义属性传给 CSS，不参与任何 JS 动画。 */
  const ember = (modifier) =>
    h('span', {
      class: `ig-ember${modifier === undefined ? '' : ` ${modifier}`}`,
      style: { '--ig-heat': heat.toFixed(2) },
      'aria-hidden': 'true',
    });

  /**
   * 收拢态的第二段文字。
   *
   * 常态说的是「下一次休息在什么时候」（用户在意的未来），不是「这个 UI 元素
   * 还有多久收起」。取不到下一次档位时返回 null —— 让分隔点也一起消失，
   * 不留一个孤零零的「·」。
   *
   * ⚠ 必须**接收算好的 progress**，不要在这里再调一次 ringProgress：
   * 同一语义两处实现，一旦分叉就会出现「暖点快满了、副行却说还有 12 分钟」
   * 这种自相矛盾（v11「卡在 1 秒」就是这个成因模式）。
   *
   * @param mode - 'normal' | 'alert' | 'unread' | 'rest'。
   * @returns 文案或 null。
   */
  const nextLine = (mode) => {
    if (mode === 'rest') return t('hud.resting.seconds', { n: restSecondsLeft });
    if (mode === 'unread') return t('hud.alert.unread');
    if (mode === 'alert') return t('hud.alert.body');
    if (progress === null || progress === undefined || progress.nextAtMs <= 0) return null;
    const remainingMs = Math.max(0, progress.nextAtMs - activeMs);
    return t('hud.next', { duration: formatElapsed(remainingMs, t) });
  };

  /** 收拢态的那一行字：一个数字 + 一句话。 */
  const side = (mode) => {
    const timeText = mode === 'rest' ? t('hud.resting') : formatElapsed(activeMs, t);
    const next = nextLine(mode);
    return h(
      'span',
      { class: 'ig-hud-side' },
      h('span', { class: 'ig-hud-time' }, timeText),
      next === null
        ? null
        : h('span', { class: 'ig-hud-sep', 'aria-hidden': 'true' }, '·'),
      next === null
        ? null
        : h(
            'span',
            { class: mode === 'alert' || mode === 'unread' ? 'ig-hud-next ig-hud-next--alert' : 'ig-hud-next' },
            next,
          ),
    );
  };

  /**
   * 收拢态（以及提醒卡卡头）的那一行。
   *
   * 它始终是 button：点它 = 看这次任务的账 = 已看。
   * 提醒卡把这一行放进卡里，所以卡片本身不必再套一个可点区域。
   */
  const row = (mode) => {
    const modifier =
      mode === 'alert'
        ? ' ig-hud--alert'
        : mode === 'unread'
          ? ' ig-hud--unread'
          : mode === 'rest'
            ? ' ig-hud--rest'
            : '';
    const emberModifier =
      mode === 'alert'
        ? 'ig-ember--alert'
        : mode === 'unread'
          ? 'ig-ember--unread'
          : mode === 'rest'
            ? 'ig-ember--rest'
            : undefined;
    const label = t('hud.open.aria', { duration: formatElapsed(activeMs, t) });
    return h(
      'button',
      {
        type: 'button',
        class: `ig-hud${modifier}`,
        'aria-expanded': 'false',
        'aria-label': label,
        title: label,
        // 点开 = 已看。走 handler 而不是 setOpen，否则提醒永远消不掉（v6 的坑）。
        onClick: () => handlers.openMeter(),
      },
      ember(emberModifier),
      side(mode),
    );
  };

  // ── 到点：一张小暖卡 ──────────────────────────────────────────────
  //
  // 这是全流程里唯一需要用户「做一件事」的时刻，所以它不长在药丸里换个颜色，
  // 而是长成一张卡：说你坐了多久、给一个可以立刻做的动作、留一个「先记着」。
  // 卡头仍然是按钮（点它看账），动作在卡身里 —— 一个东西，两种意图，互不嵌套。
  //
  // ⚠ 只在收起态替换药丸。面板已经开着的时候必须让面板留着、顶部出提醒条：
  // 否则用户正在看明细，提醒一到面板突然变成一张卡，比「多出一个浮层」更糟。
  const alertCard = () =>
    h(
      'div',
      { class: 'ig-hud-card', role: 'alert' },
      row('alert'),
      h('p', { class: 'ig-hud-card-body' }, t(alertLine.key)),
      h(
        'div',
        { class: 'ig-hud-card-actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'ig-btn ig-btn--primary',
            // 两个动作都清提醒；「歇一下」额外把读数切进休息态。
            // 清提醒是必须的：否则这个卡片会永远占着右上角。
            onClick: () => {
              handlers.dismissAlert();
              setRestUntil(Date.now() + REST_MS);
            },
          },
          t('hud.alert.card.rest'),
        ),
        h(
          'button',
          { type: 'button', class: 'ig-btn ig-btn--quiet', onClick: () => handlers.dismissAlert() },
          t('hud.alert.card.later'),
        ),
        h(
          'span',
          { class: 'ig-hud-count', 'aria-hidden': 'true' },
          t('hud.alert.seconds', { n: alert.secondsLeft }),
        ),
      ),
    );

  // ── 收拢态：到点 / 休息 / 未读 / 常态 ─────────────────────────────
  if (!open) {
    if (alert !== null && alert.mode === 'countdown') return alertCard();
    if (resting) return row('rest');
    if (alert !== null && alert.mode === 'unread') return row('unread');
    return row('normal');
  }

  // ── 展开态 ────────────────────────────────────────────────────────
  //
  // 四块，从上到下只有一个焦点：
  //
  //   ① 状态   这次任务叫什么 · 坐了多久 · 现在哪个模型
  //   ② 明细   占比条 + 逐模型（每个模型只有一个数字：耗时）
  //   ③ 判断   你评过什么（没有就不占位）
  //   ④ 动作   看这次记录 / 看汇总
  //
  // 旧版把「模型耗时·工具耗时」做成两格、每个模型行里又重复一遍同样的时间，
  // 再加一条没有标签的占比条 —— 五块同权重的文字堆在 340px 里，所以「抓不到重点」。
  // 现在状态区只剩一个主数字，其余全部降成一行元信息。
  /**
   * 占比条只在**两个以上**模型时才画。
   *
   * 单模型时它是 100%，一整条纯色 —— 读起来像进度条，实际零信息量
   * （用户实测反馈：以为是自己设置错了）。模型行本身已经写着各自的耗时。
   */
  const showShare = segments.length > 1;

  /**
   * 一个模型一行。
   *
   * 一行里只有两个强信息：**名字**（左）与**耗时**（右对齐）。
   * 评分、轮次、步数全部降成第二行的元信息 —— 旧版把评分塞在名字和耗时中间，
   * 一行四个东西，扫不过去。
   */
  const rowOf = (entry) => {
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
        showShare ? h('span', { class: 'ig-hud-tone', 'aria-hidden': 'true' }) : null,
        h(
          'span',
          { class: 'ig-hud-row-model' },
          label.name,
          label.provider === null
            ? null
            : h('span', { class: 'ig-model-provider' }, ` · ${label.provider}`),
        ),
        h('span', { class: 'ig-hud-row-time' }, formatElapsed(entry.modelMs, t)),
      ),

      h(
        'div',
        { class: 'ig-hud-row-sub' },
        rating > 0 ? h('span', { class: 'ig-hud-row-rating' }, ratingText(rating, t)) : null,
        h('span', null, `${t('hud.turns', { n: entry.turns })} · ${t('hud.steps', { n: entry.steps })}`),
      ),

      // 历史评价：把上次那句备注直接亮出来，否则数字与判断是脱节的。
      notes.length > 0 && typeof notes[0].note === 'string' && notes[0].note.length > 0
        ? h('p', { class: 'ig-note ig-note--quote' }, notes[0].note)
        : null,
    );
  };

  const hero = durationParts(activeMs, t);

  const totalTurns = sumField(list, 'turns');
  const totalSteps = sumField(list, 'steps');
  const metaParts = [];
  if (totalTurns > 0) metaParts.push(t('hud.turns', { n: totalTurns }));
  if (totalSteps > 0) metaParts.push(t('hud.steps', { n: totalSteps }));
  if (toolMs > 0) metaParts.push(`${t('hud.toolTime')} ${formatElapsed(toolMs, t)}`);

  const currentVerdict = verdictTable['current'];

  return h(
    'div',
    { class: 'ig-hud-panel', role: 'dialog', 'aria-label': t('hud.title') },

    // ① 状态
    h(
      'div',
      { class: 'ig-hud-head' },
      ember(),
      h(
        'div',
        { class: 'ig-hud-head-text' },
        // 任务名是「这次是哪件事」的唯一线索，给它两行；再长就截断，
        // 不允许它把下面三个区推走（旧版没有截断，长任务名能把面板撑到溢屏）。
        h('span', { class: 'ig-hud-title' }, bucket?.taskName ?? t('hud.untitled')),
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

    h(
      'div',
      { class: 'ig-hud-summary' },
      h(
        'div',
        { class: 'ig-hud-hero' },
        h('span', { class: 'ig-hud-hero-value' }, hero.value),
        h('span', { class: 'ig-hud-hero-unit' }, hero.unit),
        h('span', { class: 'ig-hud-hero-model' }, modelName),
      ),
      metaParts.length > 0 ? h('p', { class: 'ig-hud-meta' }, metaParts.join(' · ')) : null,
    ),

    // 面板已经开着时收到提醒：这里必须可点，否则未读同样消不掉。
    alert !== null
      ? h(
          'button',
          {
            type: 'button',
            class: 'ig-hud-banner',
            onClick: () => handlers.dismissAlert(),
            title: t('hud.alert.dismiss'),
          },
          h(
            'span',
            { class: 'ig-hud-banner-text' },
            t(alert.mode === 'unread' ? 'hud.alert.unread' : 'hud.alert.body'),
          ),
          h('span', { class: 'ig-hud-banner-action' }, t('hud.alert.dismiss')),
        )
      : null,

    // ② 明细：占比条与模型列表是同一个东西的两种读法，贴在一起。
    h(
      'div',
      { class: 'ig-hud-section' },
      list.length > 0
        ? h(
            'div',
            { class: 'ig-hud-models' },
            showShare
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
            h('ul', { class: 'ig-hud-list' }, list.map(rowOf)),
          )
        : h('p', { class: 'ig-note' }, t('hud.empty')),
    ),

    // ③④ 判断 + 动作
    h(
      'div',
      { class: 'ig-hud-section' },
      // 已经答过就显示答案，不再逼用户点进卡片才知道自己评过什么。
      currentVerdict !== null && currentVerdict !== undefined && currentVerdict.verdict
        ? h(
            'p',
            { class: 'ig-hud-verdict' },
            `${t('hud.verdictLabel')} `,
            h('span', { class: 'ig-hud-verdict-value' }, t(`card.verdict.${currentVerdict.verdict}`)),
          )
        : null,
      h(
        'div',
        { class: 'ig-actions' },
        h(
          'button',
          { type: 'button', class: 'ig-btn ig-btn--primary', onClick: handlers.openCard },
          t('hud.openCard'),
        ),
        h(
          'button',
          { type: 'button', class: 'ig-btn ig-btn--quiet', onClick: handlers.openSummary },
          t('hud.openSummary'),
        ),
      ),
    ),
  );
}

/**
 * 一格「标签 + 数值」。汇总面板的三格客观指标在用它。
 *
 * ⚠ 必须接收 React 作为参数：模块级没有 `h`，它只在组件里是局部变量。
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
  return h('div', null, h('dt', null, label), h('dd', null, value));
}
