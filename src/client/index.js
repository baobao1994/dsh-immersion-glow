/**
 * 浏览器半入口：apply(ctx) 与三处注册。
 *
 * ## 架构（与 PRD §4.7 的关键偏离，原因见 state.js 文件头）
 *
 *   apply(ctx)
 *     ├─ defineStore + create()  → 唯一 root 实例
 *     ├─ ctx.slots.provideRoot({ hooks:{ immersionGlow }, props:{ immersionGlowActions, igReact } })
 *     ├─ locale 字典（惰性取用的服务）
 *     ├─ 计时器 / 交互监听 / 多标签同步 / 可见性（全部经 ctx.effect）
 *     └─ 三处 ctx.slots.inject(key, () => ctx.slots.register(...))
 *          ① shell.overlay            (root)    记录卡 + 画廊 + 右上角提醒卡
 *          ② settings.general.item    (root)    设置行
 *          ③ conversation.input.left  (session) 探针（默认 null）
 *
 * provideRoot 的 root 贡献会被合并进**所有 scope** 的 standard props，所以三处
 * 都能拿到同一个 useImmersionGlow / actions，不需要 slot 的 store 座，也就绕开
 * 了「one handle, one scope」的硬校验。
 *
 * ## cordis inject 只有一项
 * `export const inject = ['slots']` —— 只声明必然存在的服务。`locale` 与
 * `sessions` 走 ctx.get() 惰性取用 + 守卫：缺失时插件仍能加载，只是降级。
 * **绝不能**把可选服务写进 inject —— fiber 卡在 pending 会让整个 DSH 前端报
 * "did not activate" 而进不去。
 *
 * `dsh.client.inject`（package.json 里）是另一回事：只影响加载/预取排序，不提供
 * 任何服务（源码原文 "informational ... never apply sequencing"），故留空。
 *
 * @module src/client/index
 */

/**
 * 递归查询 clipboard 的稳定引用，避免每次渲染重建。
 * @deprecated 保留位置说明：实际实现见 clipboard.js 的 copyText。
 */

/**
 * 打包埋点与收藏为可复制 JSON（PRD §4.9，带版本标记便于后续解析）。
 *
 * @param state - store 快照。
 * @param now - 导出时间戳。
 * @returns 可直接 JSON.stringify 的对象。
 */
/**
 * 浏览器半的插件体。
 *
 * @param ctx - DSH 客户端 cordis 上下文。
 */
function apply(ctx) {
  const React = require('react');
  const { defineStore } = require('@deepseek-ai/dsh-client-store');
  const h = React.createElement;

  // ── 服务惰性取用（不进 inject，见文件头） ──────────────────────────
  const locale = ctx.get('locale');

  // ── 状态实例：apply 内构造，绝不放模块级 ───────────────────────────
  //
  // ⚠ 顺序有讲究：先把 localStorage 里的旧 schema 归一，再 handle.create()。
  // 引擎的 attachPersistence 会在 create() 内部直接 setState(旧值, true) 整体
  // 替换，没有 migrate 钩子 —— 这里是唯一能拦住旧数据的地方。see state.js。
  preparePersistedState(typeof localStorage === 'undefined' ? undefined : localStorage, Date.now());

  const handle = createStoreHandle(defineStore);
  const instance = handle.create();
  const state = () => instance.getSnapshot();
  const actions = instance.actions;

  // 立刻复位「只在本次页面生命周期内有效」的 UI 态。
  //
  // persist 会把整个 state 从 localStorage 读回来，包括 ui.cardOpen / reminder。
  // 不复位的话，刷新后会凭空弹出记录卡；提醒恢复回来时 deadlineAt 已是过去时，
  // 会以「未读徽标」的怪形态闪一下。语义与取舍见 resetTransient / ADR-123。
  actions.resetTransient();

  // ── 样式：随 ctx.effect 卸载 ──────────────────────────────────────
  ctx.effect(
    () => installStyles(typeof document === 'undefined' ? undefined : document),
    'immersion-glow: styles',
  );

  // ── i18n ─────────────────────────────────────────────────────────
  if (locale !== undefined && locale !== null) {
    ctx.effect(
      () => locale.register(NS, { zh: ZH, en: EN }),
      'immersion-glow: dictionaries',
    );
  }

  /** 当前语言下的翻译函数。字典重注册时 locale 会推进 revision，组件自然跟随。 */
  const translator = () => {
    let lang = 'zh';
    if (locale !== undefined && locale !== null && typeof locale.getSnapshot === 'function') {
      lang = languageOf(locale.getSnapshot());
    }
    return createTranslator(undefined, lang);
  };

  // ── 分区读取器 ───────────────────────────────────────────────────
  /**
   * 取「当前视角」的计时分区。
   *
   * 为什么需要这一层：一段沉浸时长属于**会话**，不属于窗口。只有一份全局
   * segment 时，开新窗口或切会话都会继承上一轮的时间（实测 bug）。
   *
   * 拿不到分区时回退到一份零值分区，**绝不**回退到别的会话 —— 宁可显示 0，
   * 也不显示不属于你的时间。
   *
   * @param snapshot - store 快照。
   * @returns {{ segment, metrics }} 当前会话的分区。
   */
  const currentBucket = (snapshot) => {
    const id = snapshot.activeSessionId;
    const sessions = snapshot.sessions;
    const bucket =
      typeof id === 'string' && sessions !== null && typeof sessions === 'object'
        ? sessions[id]
        : undefined;
    if (bucket !== undefined) return bucket;
    // 无会话 / 尚未建立分区：用 epoch 起点的空分区。
    return {
      segment: { startedAt: 0, lastActiveAt: 0, activeMs: 0, activeRuns: 0, firedCount: 0 },
      metrics: null,
    };
  };

  // ── 会话跟随：切会话即切分区 ──────────────────────────────────────
  //
  // 探针在 session scope 里能用 useSession，但它在 render 里不该写状态。
  // 这里在 root 侧订阅 sessions.list，让「当前会话变了」第一时间反映到分区。
  //
  // ⚠ 解析逻辑在 session-id.js：DSH 0.2.0-rc.2 的 SessionListState **没有**
  // `current` 字段（只有 ids / byId / phase / projectionsBySession）。这里直接
  // 读 list.current 会恒得 undefined，导致计时器整个空转 —— 已实测踩过。
  ctx.effect(() => {
    const sessions = ctx.get('sessions');
    if (sessions === undefined || sessions === null || sessions.list === undefined) {
      return () => {};
    }
    let lastSeen = null;
    const sync = () => {
      const current = resolveCurrentSessionId(sessions.list.getSnapshot());
      if (current === lastSeen) return;
      lastSeen = current;
      if (current === null) return;
      // 切到没有分区的会话时建一个空分区 —— 不继承别的会话的时长。
      actions.switchSession({ sessionId: current, now: Date.now() });
    };
    sync();
    return sessions.list.subscribe(sync);
  }, 'immersion-glow: follow current session');

  // ── root 共享面 ──────────────────────────────────────────────────
  // hooks 的 key 会变成 use<Name>；props 原样透传给所有插槽组件。
  ctx.slots.provideRoot({
    hooks: { immersionGlow: instance },
    props: {
      immersionGlowActions: actions,
      /** 平台注入的 React：组件经 props 拿，不做 ESM import。 */
      igReact: React,
      /**
       * 当前分区的读取器。
       *
       * 组件不能直接读 state.segment（那已不再是权威来源），一律经它取。
       * 放进 props 而不是 hooks，是因为它是普通函数、不参与订阅；
       * 订阅仍走 useImmersionGlow 选到 activeSessionId / sessions 上。
       */
      igCurrentBucket: currentBucket,
    },
  });

  // ── 计时器 ───────────────────────────────────────────────────────
  let lastTickAt = null;

  /** 一次 tick：推进状态机并落地副作用。 */
  const runTick = () => {
    const now = Date.now();
    const snapshot = state();
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';

    // 当前会话没有分区时（例如启动瞬间还没拿到 current），本 tick 不计时。
    const sessionId = snapshot.activeSessionId;
    if (!hasSessionBucket(snapshot, sessionId)) {
      lastTickAt = now;
      return;
    }

    const bucket = currentBucket(snapshot);
    const result = tick({
      segment: bucket.segment,
      now,
      lastTickAt,
      visible,
      idleTimeoutMs: snapshot.settings.idleTimeoutMs,
      resetGapMs: snapshot.settings.resetGapMs,
      thresholdsMin: snapshot.settings.thresholdsMin,
    });

    const before = bucket.segment;
    const after = result.segment;
    if (
      after !== before ||
      after.activeMs !== before.activeMs ||
      after.firedCount !== before.firedCount ||
      after.activeRuns !== before.activeRuns ||
      after.lastActiveAt !== before.lastActiveAt
    ) {
      actions.writeSession({ sessionId, segment: after, now });
    }
    lastTickAt = now;

    // 跨零点：重置今日统计（时段保留）。
    if (isDifferentLocalDay(snapshot.today.date, now)) actions.rollDay(now);

    // 旧时段结束 → 达门槛就入库。
    if (result.effects.reset && result.effects.saved !== null) {
      const saved = result.effects.saved;
      const record = toRecord(saved, bucket.metrics, now);
      if (record !== null) {
        actions.saveRecord({ ...record, tags: tagsOf(saved.startedAt, saved.activeMs) });
      }
    }

    // 越过阈值 → 右上角提醒卡（sticky：60s 倒计时，超时转未读徽标）。
    if (result.effects.fire !== null) {
      actions.countImpression();
      actions.showReminder({ message: translator()('reminder.body'), sticky: true });
    }
  };

  ctx.effect(() => {
    const timer = window.setInterval(runTick, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, 'immersion-glow: timer');

  // 交互信号：pointerdown / keydown / wheel + 500ms 节流 mousemove（PRD §2.1 F1）。
  ctx.effect(() => {
    let lastMove = 0;
    const note = () => {
      const snapshot = state();
      const sessionId = snapshot.activeSessionId;
      if (!hasSessionBucket(snapshot, sessionId)) return;
      const now = Date.now();
      actions.writeSession({
        sessionId,
        segment: noteActivity(currentBucket(snapshot).segment, now, snapshot.settings.idleTimeoutMs),
        now,
      });
    };
    const onMove = () => {
      const now = Date.now();
      if (now - lastMove < 500) return;
      lastMove = now;
      note();
    };

    window.addEventListener('pointerdown', note, { passive: true });
    window.addEventListener('keydown', note, { passive: true });
    window.addEventListener('wheel', note, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', note);
      window.removeEventListener('keydown', note);
      window.removeEventListener('wheel', note);
      window.removeEventListener('mousemove', onMove);
    };
  }, 'immersion-glow: activity listeners');

  // 多标签同步（PRD §2.4）。defineStore 的 persist 只在创建时读一次、之后单向
  // 写入，**不监听 storage**，所以这一层必须自己写：单键共享，取更大的 activeMs。
  ctx.effect(() => {
    const onStorage = (event) => {
      if (event.key !== PERSIST_KEY || typeof event.newValue !== 'string') return;
      try {
        const incoming = JSON.parse(event.newValue);
        // persist 写的是整个 state，所以对方的分区在 sessions[对方 activeSessionId]。
        const theirId = incoming?.activeSessionId;
        const theirSeg =
          typeof theirId === 'string' && incoming?.sessions?.[theirId]
            ? incoming.sessions[theirId].segment
            : incoming?.segment;
        const theirMs = theirSeg?.activeMs;
        const theirAt = theirSeg?.lastActiveAt;
        if (!Number.isFinite(theirMs) || !Number.isFinite(theirAt)) return;
        const local = state();
        const sessionId = local.activeSessionId;
        if (!hasSessionBucket(local, sessionId)) return;
        const localSeg = currentBucket(local).segment;
        if (theirMs > localSeg.activeMs) {
          actions.writeSession({
            sessionId,
            segment: {
              ...localSeg,
              activeMs: theirMs,
              lastActiveAt: Math.max(localSeg.lastActiveAt, theirAt),
            },
            now: Date.now(),
          });
        }
      } catch (_error) {
        // 坏数据忽略，不影响本标签。
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, 'immersion-glow: cross-tab sync');

  // 页面可见性：切回时立即跑一次 tick，让「续算 / 重置」判定及时生效。
  ctx.effect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runTick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, 'immersion-glow: visibility');

  // ── 共用处理函数（供各组件 props 传递） ────────────────────────────
  const handlers = {
    openCard: () => {
      actions.countOpen();
      // 手动打开 = 看「当前这次」，所以清掉可能残留的聚焦。
      actions.setFocusedRecord(null);
      actions.setCardOpen(true);
    },
    closeCard: () => actions.setCardOpen(false),
    openGallery: () => actions.setGalleryOpen(true),
    closeGallery: () => actions.setGalleryOpen(false),
    openSummary: () => actions.setSummaryOpen(true),
    closeSummary: () => actions.setSummaryOpen(false),

    /**
     * 从画廊「回看」某条收藏：关掉画廊，带焦点打开记录卡。
     *
     * 收藏不是静态墓碑 —— 回看之后还能补「达到目的了吗」和模型备注。
     */
    reviewRecord: (id) => {
      actions.countOpen();
      actions.setGalleryOpen(false);
      actions.setCardOpen(false);
      actions.setSummaryOpen(false);
      actions.setFocusedRecord(id);
      actions.setCardOpen(true);
    },

    /** 记「达到了吗」。recordKey 为 'current' 表示正在看还没收藏的当前时段。 */
    setVerdict: (payload) => actions.setVerdict(payload),
    clearVerdict: (recordKey) => actions.clearVerdict(recordKey),

    /** 记一条模型自评。 */
    rateModel: (payload) => actions.addModelNote({ ...payload, now: Date.now() }),

    /** 收藏当前时段。 */
    saveCurrentRecord: () => {
      const snapshot = state();
      const bucket = currentBucket(snapshot);
      const record = toRecord(bucket.segment, bucket.metrics, Date.now());
      const t = translator();
      if (record === null) return;

      // 分区里已经存着探针推导好的条目，这里只需校验形状。
      const entries = modelEntriesFromArray(bucket.models ?? []);
      // 收藏 id 在这里生成（而不是让 action 内部生成），因为紧接着的「把
      // 当前时段的自评迁到这条收藏」需要用到它。actions 拿不到返回值。
      const recordId = `r${record.createdAt}${snapshot.collections.length}`;
      actions.saveRecord({
        ...record,
        id: recordId,
        // 任务名与模型明细一起存进收藏，这样画廊/汇总不需要回查会话就能渲染。
        taskName: typeof bucket.taskName === 'string' ? bucket.taskName : null,
        models: entries,
        stats: bucket.stats ?? null,
        tags: tagsOf(bucket.segment.startedAt, bucket.segment.activeMs),
      });
      // 把当前时段已有的自评迁到这条收藏上，否则「收藏后再评价」会记到
      // 'current' 这个假 key 上，收藏里看不到。
      const currentVerdict = snapshot.verdicts?.current;
      if (currentVerdict !== null && currentVerdict !== undefined) {
        actions.setVerdict({
          recordId,
          verdict: currentVerdict.verdict,
          note: currentVerdict.note,
        });
      }
      actions.showReminder({ message: t('card.saved') });
    },

    /** 复制统计 JSON 到剪贴板（PRD §4.9）。 */
    copyStats: async () => {
      const payload = buildStatsPayload(state(), Date.now());
      const ok = await copyText(
        JSON.stringify(payload, null, 2),
        typeof navigator === 'undefined' ? undefined : navigator,
        typeof document === 'undefined' ? undefined : document,
      );
      const t = translator();
      actions.showReminder({ message: ok ? t('settings.copied') : t('settings.copyFailed') });
    },
  };

  // ── 三处插槽 ─────────────────────────────────────────────────────
  registerSlots({ ctx, React, actions, translator, handlers });
}

exports.inject = ['slots'];
exports.apply = apply;
