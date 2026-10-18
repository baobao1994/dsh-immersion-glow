/**
 * 状态定义与写入口（PRD v0.2 §4.8）。
 *
 * ## 为什么不用 slot 的 `store:` 座
 * PRD §4.7 的原始写法是让光带（root scope）与探针（session scope）共用同一个
 * store handle。这会撞上 SlotCore.register 的硬校验：
 *
 *     store handle mounted under "<插槽>" (scope "session") is already mounted
 *     under scope "root" — one handle, one scope
 *
 * 注册会直接抛错，三处插槽全部挂不上。因此这里改为：在 apply() 内 create() 出
 * 唯一 root 实例，用 ctx.slots.provideRoot() 同时暴露 `useImmersionGlow` 与
 * `immersionGlowActions`。provideRoot 的 root 贡献会被合并进**所有 scope** 的
 * standard props（见 renderer 的 standardProps 实现），所以光带、设置行、探针
 * 三处都能拿到同一份。
 *
 * ## 为什么 handle 在 apply 内构造
 * 源码原文："Never export a handle at module level — module-cache identity is a
 * disguised singleton across plugin reloads." 模块级导出会在热重载时复用旧
 * 单例，导致状态错乱。本文件的 `createStoreHandle()` 是工厂，必须由 apply 调用。
 *
 * ## 持久化
 * defineStore 的 persist 落到 localStorage（`attachPersistence` 里
 * localStorage.getItem/setItem），且**自带损坏兜底**：JSON.parse 失败时回滚到
 * 初始 state 并 console.error，不会阻断插件。所以不需要再写一层 try/catch。
 *
 * 但有一条 persist 不覆盖：它只在实例创建时读一次，之后单向写入，**不监听
 * storage 事件**。PRD §2.4 要求的「多标签取最大 activeMs」必须由 index.js 手写。
 *
 * @module src/client/state
 */

/** 持久化键（PRD §3.3「数据仅存单一持久化键」）。 */
const PERSIST_KEY = 'immersion-glow.v1';

/** 画廊上限。超出时丢最旧的（FIFO）。 */
const GALLERY_LIMIT = 50;

/** 当前 state schema 版本。见 migrateState 的版本说明。 */
const STATE_VERSION = 3;

/** 阈值提醒卡在右上角停留多久；超时后转为未读徽标，直到用户点击。 */
const REMINDER_TIMEOUT_MS = 60 * 1000;

/**
 * 会话分区的零值。
 *
 * @param now - 起始时间戳。
 * @returns 一份全新的空 segment。
 */
function emptySegment(now) {
  return { startedAt: now, lastActiveAt: now, activeMs: 0, activeRuns: 0, firedCount: 0 };
}

/**
 * 默认设置。数值依据 PRD §2.1 / §4.8。
 */
const DEFAULT_SETTINGS = {
  enabled: true,
  thresholdsMin: [20, 40, 60],
  idleTimeoutMs: 3 * 60 * 1000, // 3 分钟冻结
  resetGapMs: 10 * 60 * 1000, // 10 分钟新时段
  showInlineTimer: false,
};

/**
 * 造一份全新的初始 state。
 *
 * defineStore 的 init 必须是**函数**，保证每个实例拿到互不共享的对象
 * （源码注释：a lambda so every instance gets a fresh state）。
 *
 * @param now - 当前毫秒时间戳，用于 seed 时段。
 * @returns 初始 state。
 */
function createInitialState(now) {
  const start = typeof now === 'number' ? now : 0;
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS, thresholdsMin: [...DEFAULT_SETTINGS.thresholdsMin] },
    /**
     * 当前页面视角下的活跃会话 id。
     *
     * 问题：一段沉浸时长属于**会话**，不属于窗口。原来只有一份全局 segment，
     * 于是开新窗口 / 切会话都继承上一轮的时间，读数骗人。
     *
     * 解法：segment 按 sessionId 分区存；`activeSessionId` 指出哪一份是当前视角。
     * 没有会话时（首页/欢迎页）沿用最后一个，但 UI 会标 stale。
     */
    activeSessionId: null,

    /**
     * sessionId -> 该会话的计时分区。
     *
     * 形如 { [sessionId]: { segment, metrics, updatedAt } }。上限 20 个，超出
     * 丢最久未更新的 —— 会话一多不可能无限膨胀 localStorage。
     */
    sessions: {},

    /** 今日统计，跨零点由 tick 侧重置。 */
    today: { date: start },
    /** 收藏库。 */
    collections: [],
    /** 本地埋点：阈值提醒触发 / 用户打开记录卡。 */
    telemetry: { impressions: 0, opens: 0 },
    /** 纯 UI 态（不跨会话持久有意义，但放一起省一个 store）。 */
    ui: {
      cardOpen: false,
      galleryOpen: false,
      /**
       * 右上角提醒卡（ADR-123）。
       *
       * null = 没有提醒。有值时形如：
       *   { message, sticky, at, deadlineAt, seq }
       *
       *   - sticky: true  → 阈值提醒。60s 倒计时结束还没点就**缩成未读徽标**，
       *     一直留着，直到用户点击（打开记录卡并清除）。
       *   - sticky: false → 「已收藏 / 已复制」这类确认。到点即消失，且**永远
       *     不覆盖**一条 sticky 提醒（见 showReminder 里的守卫）。
       *
       * seq 只用于让同文案的新提醒重播入场动画（作元素 key）。
       */
      reminder: null,
    },
  };
}

/**
 * 造 actions 表。每个 mutator 收到的 draft 是 immer draft，直接改即可。
 *
 * 命名约定：读起来像命令，参数是「业务值」而不是内部字段名。
 *
 * @returns actions 表。
 */
function createActions() {
  return {
    /** 埋点：阈值提醒浮现。 */
    countImpression(draft) {
      draft.telemetry.impressions += 1;
    },

    /** 埋点：用户打开记录卡。 */
    countOpen(draft) {
      draft.telemetry.opens += 1;
    },

    /** 更新设置（部分字段）。 */
    updateSettings(draft, patch) {
      draft.settings = { ...draft.settings, ...patch };
    },

    /** 打开/关闭记录卡。 */
    setCardOpen(draft, open) {
      draft.ui.cardOpen = open === true;
    },

    /** 打开/关闭画廊。 */
    setGalleryOpen(draft, open) {
      draft.ui.galleryOpen = open === true;
    },

    /**
     * 弹一条右上角提醒（ADR-123）。
     *
     * @param draft - immer draft。
     * @param payload - { message: string, sticky?: boolean, now?: number }
     *   message 已本地化；sticky 缺省为 false（确认类）。
     *
     * 覆盖规则：
     *   - sticky → sticky：覆盖（新一轮阈值提醒取代旧一轮）；
     *   - 非 sticky → sticky：**不覆盖** —— 「已收藏」这种一闪而过的确认
     *     没资格顶掉一条用户还没读的阈值提醒（未读徽标会因此消失）；
     *   - 任意 → 非 sticky：覆盖（旧确认已经无所谓了）。
     */
    showReminder(draft, payload) {
      const message = typeof payload?.message === 'string' ? payload.message : '';
      if (message.length === 0) return;
      const sticky = payload.sticky === true;
      const existing = draft.ui.reminder;
      if (!sticky && existing !== null && existing !== undefined && existing.sticky === true) {
        return;
      }
      const now = typeof payload.now === 'number' ? payload.now : Date.now();
      draft.ui.reminder = {
        message,
        sticky,
        at: now,
        deadlineAt: now + REMINDER_TIMEOUT_MS,
        seq: (existing?.seq ?? 0) + 1,
      };
    },

    /**
     * 用户点开了提醒（徽标或仍在倒计时的卡片）：清掉它并打开记录卡。
     *
     * 语义上「点提醒」就是「我要看统计」，所以打开卡片也在这里一并做，
     * 调用方不用记两件事。
     */
    openFromReminder(draft) {
      draft.ui.reminder = null;
      draft.ui.cardOpen = true;
    },

    /** 关掉提醒（不打开记录卡）。倒计时结束的确认类提醒走卸载，不需要调它。 */
    dismissReminder(draft) {
      draft.ui.reminder = null;
    },

    /** 存一条收藏，超出上限丢最旧。 */
    saveRecord(draft, record) {
      const withId = { ...record, id: record.id ?? `r${record.createdAt}${draft.collections.length}` };
      const next = [withId, ...draft.collections];
      draft.collections = next.length > GALLERY_LIMIT ? next.slice(0, GALLERY_LIMIT) : next;
    },

    /** 删除单条收藏。 */
    removeRecord(draft, id) {
      draft.collections = draft.collections.filter((item) => item.id !== id);
    },

    /** 清空画廊。 */
    clearGallery(draft) {
      draft.collections = [];
    },

    /**
     * 切换当前视角的会话。
     *
     * 带 `seed` 时（该会话还没有分区）就建一个空分区；不带时只切指针。
     * 切过去**不继承**任何时长 —— 这正是「开新窗口不该看到上一轮时间」的修法。
     *
     * @param draft - immer draft。
     * @param payload - { sessionId: string|null, now: number }
     */
    switchSession(draft, payload) {
      const sessionId = payload.sessionId;
      draft.activeSessionId = sessionId ?? null;
      if (typeof sessionId !== 'string' || sessionId.length === 0) return;
      // 兜底：迁移之后这里应当总是对象，但 store 的快照可能来自任何路径
      // （旧数据整体替换、别的标签页写坏）。宁可就地补一个，也不要抛。
      if (draft.sessions === null || typeof draft.sessions !== 'object') draft.sessions = {};
      if (draft.sessions[sessionId] !== undefined) {
        draft.sessions[sessionId].updatedAt = payload.now;
        return;
      }
      draft.sessions[sessionId] = {
        segment: {
          startedAt: payload.now,
          lastActiveAt: payload.now,
          activeMs: 0,
          activeRuns: 0,
          firedCount: 0,
        },
        metrics: null,
        updatedAt: payload.now,
      };
      // 分区上限：超出时丢最久没更新的那个（当前会话永不丢）。
      const ids = Object.keys(draft.sessions);
      if (ids.length > 20) {
        const victims = ids
          .filter((id) => id !== sessionId)
          .sort((a, b) => draft.sessions[a].updatedAt - draft.sessions[b].updatedAt);
        for (const victim of victims.slice(0, ids.length - 20)) delete draft.sessions[victim];
      }
    },

    /**
     * 只更新某个会话的计时分区（不动指针）。
     *
     * @param draft - immer draft。
     * @param payload - { sessionId, segment?, metrics?, now? }
     */
    writeSession(draft, payload) {
      const sessionId = payload.sessionId;
      if (typeof sessionId !== 'string' || sessionId.length === 0) return;
      const now = payload.now ?? Date.now();
      // 同 switchSession：分区表必须存在，否则就地补一个空表。
      if (draft.sessions === null || typeof draft.sessions !== 'object') draft.sessions = {};
      // 分区可能还不存在：探针可能先于 sessions.list 的 sync 到达。
      // 这时建一个空分区再写，绝不借用别的会话的时长。
      if (draft.sessions[sessionId] === undefined) {
        draft.sessions[sessionId] = {
          segment: {
            startedAt: now,
            lastActiveAt: now,
            activeMs: 0,
            activeRuns: 0,
            firedCount: 0,
          },
          metrics: null,
          updatedAt: now,
        };
      }
      const bucket = draft.sessions[sessionId];
      if (payload.segment !== undefined) bucket.segment = payload.segment;
      if (payload.metrics !== undefined) bucket.metrics = payload.metrics;
      bucket.updatedAt = now;
    },

    /** 跨零点：重置今日统计（时段本身保留）。 */
    rollDay(draft, now) {
      draft.today = { date: now };
    },

    /**
     * 复位「只在当前页面生命周期内有效」的 UI 态。
     *
     * 为什么必须有这一步：defineStore 的 persist 把**整个 state** 写进
     * localStorage，刷新后原样读回。但 ui 里的字段一旦跨会话恢复就会出错 ——
     *
     *   1. `cardOpen: true` 会让刷新后凭空弹出一张记录卡；
     *   2. 提醒恢复回来时 `deadlineAt` 已是过去时：sticky 提醒会直接以「未读
     *      徽标」的形态闪一下，非 sticky 的会莫名露脸又立刻消失。
     *
     * 提醒是「刚刚发生了什么」的信号，不该跨页面生命周期存活 —— 所以这里
     * 一并清空。**取舍（ADR-123）**：未读徽标在页面生命周期内保持，刷新即清。
     * 要跨刷新持久化需要把 unread 单独搬出 persist 白名单并补迁移，复杂度
     * 不值得 —— 会话提示的时效性远大于存续性。
     */
    resetTransient(draft) {
      draft.ui = {
        cardOpen: false,
        galleryOpen: false,
        reminder: null,
      };
    },

    /**
     * 清除本插件全部数据，回到初始态。
     *
     * 设置行里的「清除本插件数据」直接调它；清完仍需用户手动刷新或重进会话，
     * 因为已渲染的组件拿的是旧快照（下一次 tick 会自然对齐）。
     */
    resetAll(draft, now) {
      const fresh = createInitialState(now);
      for (const key of Object.keys(fresh)) draft[key] = fresh[key];
    },
  };
}

/**
 * 把任意历史版本的持久化值归一成当前 schema。
 *
 * ## 为什么必须有这一步（实测事故）
 * `dsh-client-store` 的恢复是**整体替换**，不是合并：
 *
 *     api.setState(devFreeze(JSON.parse(raw)), true)   // 第二个参数 true = replace
 *
 * 于是 `init()` 里给的 `sessions: {}` 会被旧数据直接覆盖掉 —— 旧数据没有
 * `sessions` 字段，恢复后 `state.sessions` 就是 `undefined`。之后
 * `switchSession` 里 `draft.sessions[sessionId] = …` 抛
 * `TypeError: Cannot read properties of undefined`，而 cordis 的 `ctx.effect()`
 * 对同步异常是**重抛**的，异常直接冲出 `apply()`，整个插件起不来。
 *
 * 版本沿革：
 *   v1（ADR-117 之前）：顶层 `segment` / `metrics`，只有一份全局时长。
 *   v2（ADR-117 之后）：改成 `sessions[id] = { segment, metrics, updatedAt }`
 *       + `activeSessionId`，v1 的两个顶层字段成为历史包袱。
 *   v3（ADR-123）：光带退役。`ui.hintVisible` / `ui.playSeq` / `ui.toast` /
 *       `settings.intensity` / `telemetry.dismisses` 一并删除，换成
 *       `ui.reminder`（右上角提醒卡）。
 *
 * 迁移策略：缺什么补什么，**绝不因为字段缺失就丢掉用户数据**。
 *   - v1 的顶层 `metrics.sessionId` 记录着那份时长属于哪个会话 —— 这是唯一
 *     忠实的归属证据，按它归档进对应分区，**不挂孤儿键、不冒充别的会话**。
 *     归属不明（没有 sessionId 或值无效）时才丢弃时长本体；设置、收藏、
 *     埋点、今日这些无归属歧义的数据一律保留。
 *   - v1 的顶层 `segment` / `metrics` 随后删除：它们已不是权威来源，留着
 *     就会有人再去读它（ADR-117 之后 slots.js 的常驻计时就是因此读到 0）。
 *
 * @param raw - 从 localStorage 解析出的对象，可能是任意历史版本或垃圾值。
 * @param now - 时间戳，用于补齐缺失的时间字段。
 * @returns {object} 可安全交给 store 的完整 state。
 */
function migrateState(raw, now) {
  const fresh = createInitialState(now);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fresh;

  const merged = { ...fresh, ...raw };
  merged.version = STATE_VERSION;

  // settings 逐字段兜底：旧版本可能缺项，也可能整块不是对象。
  merged.settings =
    raw.settings !== null && typeof raw.settings === 'object'
      ? { ...fresh.settings, ...raw.settings }
      : { ...fresh.settings };
  // v3 起强度设置随光带退役；旧数据里留着这个键只会造成「设置了却没效果」
  // 的假象，迁移时删干净。
  delete merged.settings.intensity;

  // ── ui：提醒卡时代的形状。旧键（hintVisible/playSeq/toast）一律丢弃 ──
  // 语义见 resetTransient —— 它们只在页面生命周期内有意义，跨恢复必须清。
  merged.ui = { ...fresh.ui };
  if (raw.ui !== null && typeof raw.ui === 'object') {
    merged.ui.cardOpen = raw.ui.cardOpen === true;
    merged.ui.galleryOpen = raw.ui.galleryOpen === true;
  }
  merged.ui.reminder = null;

  // ── 分区表：这一步是崩溃的根因，必须保证它一定是对象 ──────────────
  const sessions = {};
  if (raw.sessions !== null && typeof raw.sessions === 'object' && !Array.isArray(raw.sessions)) {
    for (const id of Object.keys(raw.sessions)) {
      const bucket = raw.sessions[id];
      if (bucket === null || typeof bucket !== 'object') continue;
      sessions[id] = {
        segment:
          bucket.segment !== null && typeof bucket.segment === 'object'
            ? { ...emptySegment(now), ...bucket.segment }
            : emptySegment(now),
        metrics: bucket.metrics ?? null,
        updatedAt: Number.isFinite(bucket.updatedAt) ? bucket.updatedAt : now,
      };
    }
  }

  // ── v1 的顶层时长：按 metrics.sessionId 归档进正确分区 ──────────────
  const legacySegment = raw.segment !== null && typeof raw.segment === 'object' ? raw.segment : null;
  const legacyMetrics = raw.metrics !== null && typeof raw.metrics === 'object' ? raw.metrics : null;
  const legacyId =
    legacyMetrics === null ? null : typeof legacyMetrics.sessionId === 'string' ? legacyMetrics.sessionId : null;
  const hasLegacy = legacySegment !== null && Number.isFinite(legacySegment.activeMs);
  if (hasLegacy && typeof legacyId === 'string' && sessions[legacyId] === undefined) {
    // 归属明确：原样搬进那个会话的分区，回到该会话时时长还在。
    sessions[legacyId] = {
      segment: { ...emptySegment(now), ...legacySegment },
      metrics: legacyMetrics,
      updatedAt: Number.isFinite(legacySegment.lastActiveAt) ? legacySegment.lastActiveAt : now,
    };
  }
  // 归属不明的旧时长：宁可丢掉，也不能冒充某个会话（ADR-117 的原则）。
  merged.sessions = sessions;

  // ── 当前视角：必须是「确有分区」的 id，否则置空 ────────────────────
  const claimed = raw.activeSessionId;
  merged.activeSessionId =
    typeof claimed === 'string' && merged.sessions[claimed] !== undefined ? claimed : null;

  // ── 删除 v1 顶层 segment/metrics：它们已不是权威来源 ────────────────
  // 留着就必然有人再读（slots.js 的常驻计时曾因此永远显示 0）。
  delete merged.segment;
  delete merged.metrics;

  merged.today = raw.today !== null && typeof raw.today === 'object' ? raw.today : fresh.today;
  merged.collections = Array.isArray(raw.collections) ? raw.collections : [];
  // telemetry 兜底：v2 及更早有 dismisses，v3 删了 —— 合并后再按 fresh 的形状
  // 拷贝一遍，多余键自然剥落；缺的键（如旧版本没有 opens）用 0 补上。
  merged.telemetry =
    raw.telemetry !== null && typeof raw.telemetry === 'object'
      ? {
          impressions: Number.isFinite(raw.telemetry.impressions) ? raw.telemetry.impressions : 0,
          opens: Number.isFinite(raw.telemetry.opens) ? raw.telemetry.opens : 0,
        }
      : { ...fresh.telemetry };

  return merged;
}

/**
 * 在 store 创建**之前**把 localStorage 里的旧 schema 归一好。
 *
 * 为什么必须在 store 外面做：`dsh-client-store` 的 attachPersistence 是
 * 自己去 `localStorage.getItem(name)` 然后 `setState(JSON.parse(raw), true)`，
 * 全程不经过我们的代码、也没有 migrate 钩子。所以唯一能拦住的时机就是
 * 「handle.create() 之前」——先把键里的旧值改写成当前 schema，引擎随后读到
 * 的就是已经安全的完整 state。
 *
 * 损坏值直接删键：留着只会让引擎每次启动都 `console.error` 一次并整体替换成
 * 垃圾，不如回到干净初始态。
 *
 * @param storage - localStorage 兼容对象；缺失时静默跳过。
 * @param now - 时间戳。
 * @returns {boolean} 是否真的改写过存储。
 */
function preparePersistedState(storage, now) {
  if (storage === null || storage === undefined || typeof storage.getItem !== 'function') {
    return false;
  }
  let raw = null;
  try {
    raw = storage.getItem(PERSIST_KEY);
  } catch (_error) {
    return false; // 隐私模式等：读不到就交给引擎自己走「无持久化」分支。
  }
  if (raw === null || raw === undefined) return false;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    try {
      storage.removeItem(PERSIST_KEY);
      return true;
    } catch (_ignored) {
      return false;
    }
  }

  const migrated = migrateState(parsed, now);
  try {
    storage.setItem(PERSIST_KEY, JSON.stringify(migrated));
    return true;
  } catch (_error) {
    return false; // 配额等：迁移失败也不该阻断插件，兜底守卫仍在。
  }
}

/**
 * 判断某个会话是否真的有一份分区。
 *
 * 集中成一个函数，是为了让「sessions 可能是 undefined」这件事只有一个
 * 判断点 —— 旧 schema 数据被整体替换进来时就是这样。
 *
 * @param snapshot - store 快照。
 * @param sessionId - 待查会话 id。
 * @returns {boolean} 有分区即真。
 */
function hasSessionBucket(snapshot, sessionId) {
  if (typeof sessionId !== 'string') return false;
  const sessions = snapshot === null || snapshot === undefined ? undefined : snapshot.sessions;
  if (sessions === null || typeof sessions !== 'object') return false;
  return sessions[sessionId] !== undefined;
}

/**
 * 声明 store。
 *
 * @param defineStore - 由 client bundle 通过 require('@deepseek-ai/dsh-client-store') 注入。
 * @returns store handle（必须在 apply 内 create）。
 */
function createStoreHandle(defineStore) {
  return defineStore({
    init: () => createInitialState(Date.now()),
    persist: PERSIST_KEY,
    actions: createActions(),
  });
}
