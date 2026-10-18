/**
 * 构建产物的加载契约测试。
 *
 * 这一层测的不是「逻辑对不对」（那是 timing / metrics / state 的活），而是
 * **插件能不能被 DSH 装上并跑起来**。历史上最容易炸的三点都在这里：
 *
 *   1. `factory` 只收一个参数 `(require)`，不是 `(require, module, exports)`；
 *   2. `apply` 必须把三处插槽都注册上，少一处就少一个功能且无报错；
 *   3. 计时器与事件监听必须挂在 ctx.effect 上，否则插件卸载后还在跑。
 *
 * 测试前会自动构建，保证测的是最新产物。
 *
 * 运行： node --test test/client-load.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 保证测的是最新产物。
execFileSync(process.execPath, [join(ROOT, 'tools', 'build-client.mjs')], { stdio: 'ignore' });

const BUNDLE = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/** 最小 React 替身：足够让组件函数被调用并返回元素树。 */
function fakeReact() {
  const createElement = (type, props, ...children) => ({
    type,
    props: props ?? {},
    children: children.flat(),
  });
  return {
    createElement,
    Fragment: Symbol('Fragment'),
    useState: (value) => [value, () => {}],
    // 立即执行一次：探针的 writeSession 发生在 effect 里，noop 会让「写没写
    // store」的断言变成空转。副作用对真实 React 也是提交后立刻跑，语义一致。
    useEffect: (fn) => {
      fn();
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
  };
}

/**
 * 假的 store 引擎。
 *
 * 真的应用 actions（我们的 mutator 都是对普通对象直接赋值/展开，不需要 immer 代理），
 * 这样测试可以驱动真实的状态迁移，而不是对着空函数断言。
 *
 * ⚠ **必须复刻真实的恢复语义**：`dsh-client-store` 的 attachPersistence 是
 *
 *     const raw = localStorage.getItem(name);
 *     if (raw !== null) api.setState(devFreeze(JSON.parse(raw)), true);
 *
 * 即「从 localStorage 读、whole state 直接替换 init() 的结果」，**不是合并**。
 * 早先这里只做 `spec.init()` 就返回，于是「旧 schema 缺 sessions 字段导致
 * `draft.sessions` 为 undefined、switchSession 抛 TypeError、apply 整体失败」
 * 这条真实故障在 82 个测试全绿的情况下被完全掩盖。
 *
 * 它读的是 **storage 里的当前值**（而不是某个固定变量），这点很关键：只有这样
 * 才能验证 preparePersistedState 的迁移「确实发生在引擎读取之前」。
 *
 * @param storage - localStorage 替身。
 */
function fakeStoreModule(storage) {
  return {
    defineStore: (spec) => ({
      spec,
      create() {
        let state = spec.init();
        const raw = storage === undefined ? null : storage.getItem('immersion-glow.v1');
        if (raw !== null && raw !== undefined) {
          state = JSON.parse(raw); // 整体替换，而复刻「非合并」语义。
        }
        const actions = {};
        for (const [key, mutate] of Object.entries(spec.actions)) {
          actions[key] = (...args) => mutate(state, ...args);
        }
        return {
          actions,
          getSnapshot: () => state,
          subscribe: () => () => {},
          clearPersisted: () => {},
        };
      },
    }),
  };
}

/**
 * 记录所有注册与副作用，供断言。
 *
 * @param services - 可选：`ctx.get(name)` 的返回值表。用它可以注入真实的
 *   `sessions` 服务面，从而让「当前会话解析」这条路真的被跑到。
 */
function makeFakeCtx(services = {}) {
  const record = {
    effects: [],
    registered: [],
    provideRootCalls: [],
    domListeners: [],
    intervals: [],
  };

  let disposers = [];

  const ctx = {
    effect: (execute, label) => {
      record.effects.push(label ?? 'anonymous');
      const disposer = typeof execute === 'function' ? execute() : undefined;
      const normalized = typeof disposer === 'function' ? disposer : () => {};
      disposers.push(normalized);
      return normalized;
    },
    get: (name) => (Object.prototype.hasOwnProperty.call(services, name) ? services[name] : undefined),
    slots: {
      provideRoot: (contribution) => {
        record.provideRootCalls.push(contribution);
        return () => {};
      },
      inject: (key, callback) => {
        record.registered.push({ kind: 'inject', key });
        // 立即执行回调，等价于插槽已声明就绪的分支。
        const inner = callback();
        return typeof inner === 'function' ? inner : () => {};
      },
      register: (options, component) => {
        record.registered.push({ kind: 'register', name: options.name, id: options.id, component });
        return () => {};
      },
    },
  };

  /** 依次调用所有 effect 的 disposer，模拟插件卸载。 */
  const disposeAll = () => {
    for (const disposer of disposers) disposer();
    disposers = [];
  };

  return { ctx, record, disposeAll };
}

/**
 * 在沙箱里跑产物，返回 module.exports 与副作用记录。
 *
 * @param options - 可选 `persisted`：模拟 localStorage 里已有的旧值。
 */
function loadBundle(options = {}) {
  let spec = null;
  const record = { domListeners: [], intervals: [], timeouts: [], intervalFns: [], timeoutFns: [] };

  /** 极小的 localStorage 替身：迁移代码要真的读写它。 */
  const storage = new Map();
  if (options.persisted !== undefined) {
    storage.set('immersion-glow.v1', JSON.stringify(options.persisted));
  }
  const localStorageStub = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };

  const sandbox = {
    window: {
      __ModuleLoader__: { load: (value) => { spec = value; } },
      addEventListener: (type) => record.domListeners.push(`window:${type}`),
      removeEventListener: () => {},
      setInterval: (fn, ms) => {
        record.intervals.push(ms);
        record.intervalFns.push(fn);
        return record.intervals.length;
      },
      clearInterval: () => {},
      setTimeout: (fn, ms) => {
        record.timeouts.push(ms);
        record.timeoutFns.push(fn);
        return record.timeouts.length;
      },
      clearTimeout: () => {},
    },
    localStorage: localStorageStub,
    document: {
      visibilityState: 'visible',
      addEventListener: (type) => record.domListeners.push(`document:${type}`),
      removeEventListener: () => {},
      createElement: () => ({
        style: {},
        dataset: {},
        textContent: '',
        parentNode: null,
        setAttribute() {},
        select() {},
        appendChild() {},
        removeChild() {},
      }),
      querySelector: () => null,
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
    },
    navigator: { clipboard: { writeText: async () => {} } },
    require: (name) => {
      if (name === 'react') return fakeReact();
      if (name === '@deepseek-ai/dsh-client-store') return fakeStoreModule(localStorageStub);
      throw new Error(`unexpected require(${JSON.stringify(name)})`);
    },
    console,
    Date,
    Math,
    JSON,
    Number,
    Object,
    Array,
    Set,
    Map,
    RegExp,
    Symbol,
    Promise,
    Error,
    String,
    Boolean,
  };

  runInContext(BUNDLE, createContext(sandbox));
  return { spec, record, sandbox };
}

// ── 产物形状 ───────────────────────────────────────────────────────────
test('产物调用 __ModuleLoader__.load，且 id 等于包名', () => {
  const { spec } = loadBundle();
  assert.ok(spec !== null, '产物必须调用 window.__ModuleLoader__.load');
  assert.equal(spec.id, PKG.name);
});

test('factory 接受单个 require 参数并可执行', () => {
  const { spec, sandbox } = loadBundle();
  assert.equal(spec.factory.length, 1, 'DSH 只传一个 require，不能再要 module/exports');
  assert.doesNotThrow(() => spec.factory(sandbox.require));
});

test('导出 inject 只含 slots', () => {
  const { spec, sandbox } = loadBundle();
  const exported = spec.factory(sandbox.require);
  assert.deepEqual(JSON.parse(JSON.stringify(exported.inject)), ['slots']);
});

test('导出 apply 是函数', () => {
  const { spec, sandbox } = loadBundle();
  const exported = spec.factory(sandbox.require);
  assert.equal(typeof exported.apply, 'function');
});

// ── apply 的行为 ───────────────────────────────────────────────────────
test('apply 注册三处插槽，且 id 互不重复', () => {
  const { spec, sandbox } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  const injectKeys = record.registered.filter((item) => item.kind === 'inject').map((i) => i.key);
  for (const slot of ['shell.overlay', 'settings.general.item', 'conversation.input.left']) {
    assert.ok(injectKeys.includes(slot), `缺少 ${slot} 的 inject`);
  }

  const ids = record.registered.filter((item) => item.kind === 'register').map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, '插槽 id 必须唯一');
  assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0), 'list 插槽 id 必填');
});

test('apply 通过 provideRoot 暴露 useImmersionGlow 与 actions', () => {
  const { spec, sandbox } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  assert.equal(record.provideRootCalls.length, 1, '只应贡献一次 root 面');
  const contribution = record.provideRootCalls[0];
  assert.ok(contribution.hooks !== undefined, '必须提供 hooks');
  assert.ok(contribution.hooks.immersionGlow !== undefined, 'hook 源名必须是 immersionGlow');
  assert.equal(typeof contribution.hooks.immersionGlow.getSnapshot, 'function');
  assert.ok(
    contribution.props?.immersionGlowActions !== undefined,
    '必须暴露 immersionGlowActions',
  );
});

test('apply 不在插槽 register 里声明 store 座（避免一 handle 一 scope 冲突）', () => {
  const { spec, sandbox } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx, record } = makeFakeCtx();

  // 让 register 也记录 options，用于检查有没有 store 字段。
  const originalRegister = ctx.slots.register;
  const withOptions = [];
  ctx.slots.register = (options, component) => {
    withOptions.push(options);
    return originalRegister(options, component);
  };

  exported.apply(ctx);
  for (const options of withOptions) {
    assert.equal(options.store, undefined, `${options.name} 不应声明 store 座`);
  }
});

test('apply 注册 1s 定时器，并挂在 effect 上', () => {
  const { spec, sandbox, record: bundleRecord } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  assert.ok(
    bundleRecord.intervals.includes(1000),
    `应有一个 1000ms 定时器，实际 ${JSON.stringify(bundleRecord.intervals)}`,
  );
  assert.ok(
    record.effects.some((label) => String(label).includes('timer')),
    '定时器必须由 ctx.effect 持有，否则卸载后仍在跑',
  );
});

test('apply 监听交互信号（pointerdown / keydown / wheel / mousemove）', () => {
  const { spec, sandbox, record } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx } = makeFakeCtx();
  exported.apply(ctx);

  for (const type of ['pointerdown', 'keydown', 'wheel', 'mousemove']) {
    assert.ok(record.domListeners.includes(`window:${type}`), `缺 ${type} 监听`);
  }
});

test('apply 监听 storage（多标签同步）与 visibilitychange', () => {
  const { spec, sandbox, record } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx } = makeFakeCtx();
  exported.apply(ctx);

  assert.ok(record.domListeners.includes('window:storage'), '缺 storage 监听（PRD §2.4 多标签）');
  assert.ok(
    record.domListeners.includes('document:visibilitychange'),
    '缺 visibilitychange 监听',
  );
});

test('卸载时所有 effect disposer 不抛错', () => {
  const { spec, sandbox } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx, disposeAll } = makeFakeCtx();
  exported.apply(ctx);

  assert.doesNotThrow(() => disposeAll(), 'disposer 抛错会污染宿主卸载流程');
});

// ── 组件可以渲染 ───────────────────────────────────────────────────────
test('三处插槽的组件都能被调用且不抛错', () => {
  const { spec, sandbox } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  const components = record.registered
    .filter((item) => item.kind === 'register')
    .map((item) => item.component);

  assert.equal(components.length, 3, '应注册三个组件');

  /** 造一份最小的标准 props：selector hook 读真实 store 快照。 */
  const rootContribution = record.provideRootCalls[0];
  const instance = rootContribution.hooks.immersionGlow;
  const selectorHook = (selector) => selector(instance.getSnapshot());

  for (const component of components) {
    // conversation.input.left 的组件需要 useSession：给一份空快照。
    const props = {
      useImmersionGlow: selectorHook,
      useSessions: () => undefined,
      useSession: () => undefined,
      sessionId: 'session-render-smoke',
      immersionGlowActions: rootContribution.props.immersionGlowActions,
    };
    assert.doesNotThrow(() => component(props), '组件 render 抛错会顶掉整个插槽条目');
  }
});

test('探针在无会话数据时返回 null 而不是崩溃', () => {
  const { spec, sandbox } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  const probe = record.registered.find(
    (item) => item.kind === 'register' && item.name === 'conversation.input.left',
  );
  assert.ok(probe !== undefined, '探针必须注册在 conversation.input.left');

  const rootContribution = record.provideRootCalls[0];
  const instance = rootContribution.hooks.immersionGlow;
  const selectorHook = (selector) => selector(instance.getSnapshot());

  // useSession 返回 undefined（模拟无会话）——不能抛。
  const result = probe.component({
    useImmersionGlow: selectorHook,
    useSession: () => undefined,
    immersionGlowActions: rootContribution.props.immersionGlowActions,
  });
  assert.ok(result !== undefined, '返回值为 undefined 也算正常（React 视为不渲染）');
});

// ── 回归：阈值触发必须弹右上角提醒卡（ADR-123）─────────────────────────
//
// 旧实现是底部光带 + 2.5s 首次提示；用户反馈「一下子就闪没了，也不知道是
// 什么意思」。新方案：sticky 提醒，60s 倒计时，超时转未读徽标。
test('阈值触发弹 sticky 提醒卡：60s 倒计时与未读流', () => {
  const { spec, sandbox, record } = loadBundle();
  const exported = spec.factory(sandbox.require);
  const { ctx, record: ctxRecord } = makeFakeCtx();

  // 可控时钟：sandbox 里的 Date 换成固定时刻推进的替身。
  const clock = { now: 1_000_000 };
  const OriginalDate = sandbox.Date;
  class FakeDate extends OriginalDate {
    constructor(...args) {
      super(...(args.length === 0 ? [clock.now] : args));
    }
    static now() {
      return clock.now;
    }
  }
  sandbox.Date = FakeDate;

  exported.apply(ctx);

  const rootContribution = ctxRecord.provideRootCalls[0];
  const instance = rootContribution.hooks.immersionGlow;
  const actions = rootContribution.props.immersionGlowActions;

  // 计时按会话分区；没有 activeSessionId 时 tick 直接返回，所以要先建分区。
  actions.switchSession({ sessionId: 'session-test', now: clock.now });
  // 阈值改成 1 分钟，方便快速越过第一档。
  actions.updateSettings({ thresholdsMin: [1] });

  const runTick = record.intervalFns[0];
  assert.equal(typeof runTick, 'function', '必须注册一个 tick 定时器');

  // 稳定推进 70 秒；每 10 秒喂一次活动，避免被 3 分钟空闲阈值冻结。
  for (let step = 1; step <= 70; step += 1) {
    clock.now = 1_000_000 + step * 1000;
    if (step % 10 === 0) runTick();
    runTick();
  }

  const snapshot = instance.getSnapshot();
  assert.equal(snapshot.telemetry.impressions > 0, true, '触发时必须记一次曝光');

  const reminder = snapshot.ui.reminder;
  assert.ok(reminder !== null, '越过阈值后必须有提醒');
  assert.equal(reminder.sticky, true, '阈值提醒必须 sticky（超时转未读，而不是凭空消失）');
  assert.equal(reminder.deadlineAt - reminder.at, 60_000, '倒计时必须是 60 秒');
  assert.ok(reminder.deadlineAt > clock.now, '刚触发时倒计时未到期');

  // 旧光带方案的定时器必须彻底消失。
  assert.equal(
    record.timeouts.includes(2500),
    false,
    `2.5s 提示定时器应已退役，实际 ${JSON.stringify(record.timeouts)}`,
  );
  assert.equal('hintVisible' in snapshot.ui, false, 'hintVisible 已随光带退役');

  // 超时（60s）后仍未点：sticky 提醒保留在 store 里 —— 组件把它渲染成
  // 未读徽标，直到用户点击。
  clock.now += 61_000;
  assert.ok(reminder.deadlineAt < clock.now, '已过倒计时');
  assert.equal(instance.getSnapshot().ui.reminder !== null, true, '未读必须保留，不能自己消失');

  // 用户点击徽标 → 打开记录卡并清除未读。
  actions.openFromReminder();
  const after = instance.getSnapshot();
  assert.equal(after.ui.reminder, null, '点击后未读清除');
  assert.equal(after.ui.cardOpen, true, '点击后打开记录卡');
});

// ── 回归 A：当前会话 id 必须从真实的 SessionListState 解析出来 ──────────
//
// 真实事故：插件读 `sessions.list.getSnapshot().current`，但 DSH 0.2.0-rc.2 的
// SessionListState 只有 { ids, byId, phase, projectionsBySession } —— 没有
// current。于是恒得 undefined → activeSessionId 恒为 null → runTick 每秒在第一道
// 守卫处提前返回 → activeMs 永不增长 → 光带永不触发。**全程不报错**。
test('回归：从真实 SessionListState（无 current 字段）解析出当前会话并开始计时', () => {
  const bundle = loadBundle();
  const sandbox = bundle.sandbox;
  const exported = bundle.spec.factory(sandbox.require);

  const SID = 'session-real-shape';
  const listStore = {
    getSnapshot: () => ({
      ids: ['session-other', SID],
      byId: {
        'session-other': { id: 'session-other', displayTitle: 'x', retainedBy: { mainView: 0 } },
        [SID]: { id: SID, displayTitle: 'y', retainedBy: { mainView: 1 } },
      },
      phase: 'ready',
      projectionsBySession: {},
    }),
    subscribe: () => () => {},
  };

  const { ctx, record } = makeFakeCtx({ sessions: { list: listStore } });

  // 可控时钟。
  const clock = { now: 5_000_000 };
  const OriginalDate = sandbox.Date;
  class FakeDate extends OriginalDate {
    constructor(...args) {
      super(...(args.length === 0 ? [clock.now] : args));
    }
    static now() {
      return clock.now;
    }
  }
  sandbox.Date = FakeDate;

  exported.apply(ctx);

  const instance = record.provideRootCalls[0].hooks.immersionGlow;
  assert.equal(
    instance.getSnapshot().activeSessionId,
    SID,
    '必须解析出 retainedBy.mainView>0 的那个会话，而不是 undefined',
  );

  // 阈值调成 1 分钟，推进 70 秒，验证真的会计时并触发。
  const actions = record.provideRootCalls[0].props.immersionGlowActions;
  actions.updateSettings({ thresholdsMin: [1] });

  // 定时器回调记在 bundle 的 record 上（沙箱里 setInterval 的记录），不是 ctx 的。
  const runTick = bundle.record.intervalFns[0];
  assert.equal(typeof runTick, 'function', '必须注册一个 tick 定时器');
  for (let step = 1; step <= 70; step += 1) {
    clock.now = 5_000_000 + step * 1000;
    if (step % 10 === 0) runTick();
    runTick();
  }

  const snapshot = instance.getSnapshot();
  const bucket = snapshot.sessions[SID];
  assert.ok(bucket !== undefined, '必须为当前会话建立分区');
  assert.ok(bucket.segment.activeMs > 0, `activeMs 必须真的增长，实际 ${bucket.segment.activeMs}`);
  assert.equal(snapshot.ui.reminder !== null, true, '越过 1 分钟阈值后必须弹 sticky 提醒');
});

// ── 回归 B：旧 schema 数据不得让 apply 崩溃 ────────────────────────────
//
// 真实事故：v1 持久化值只有顶层 segment/metrics，没有 sessions/activeSessionId。
// dsh-client-store 的恢复是**整体替换**（setState(raw, true)），init() 里的
// sessions:{} 被覆盖成 undefined，随后 switchSession 抛 TypeError，而 cordis 的
// ctx.effect 对同步异常是重抛的 —— 异常冲出 apply()，整个插件起不来。
test('回归：旧 v1 schema 的持久化值不会让 apply 抛错（迁移成完整 state）', () => {
  const legacy = {
    version: 1,
    settings: { enabled: true, intensity: 'breathing', thresholdsMin: [20, 40, 60] },
    // ⚠ 关键：只有顶层 segment，没有 sessions / activeSessionId
    segment: { startedAt: 1_600_000_000_000, lastActiveAt: 1_600_000_100_000, activeMs: 3_103_524, activeRuns: 1, firedCount: 51 },
    metrics: { sessionId: 'session-legacy', turns: 3, toolCalls: 5, truncated: false, degraded: false },
    today: { date: 1_600_000_000_000 },
    collections: [],
    telemetry: { impressions: 12, opens: 1, dismisses: 14 },
    ui: { cardOpen: false, galleryOpen: false, hintVisible: false, playSeq: 0, toast: null },
  };

  const bundle = loadBundle({ persisted: legacy });
  const exported = bundle.spec.factory(bundle.sandbox.require);

  const SID = 'session-after-migrate';
  const listStore = {
    getSnapshot: () => ({
      ids: [SID],
      byId: { [SID]: { id: SID, displayTitle: 'z', retainedBy: { mainView: 1 } } },
      phase: 'ready',
      projectionsBySession: {},
    }),
    subscribe: () => () => {},
  };
  const { ctx, record } = makeFakeCtx({ sessions: { list: listStore } });

  assert.doesNotThrow(() => exported.apply(ctx), '旧数据不得让 apply 抛错');

  const instance = record.provideRootCalls[0].hooks.immersionGlow;
  const snapshot = instance.getSnapshot();

  // 分区表必须存在且是对象 —— 这正是崩溃点。
  assert.equal(typeof snapshot.sessions, 'object');
  assert.ok(snapshot.sessions !== null, 'sessions 不能是 null');

  // 用户数据不能丢：v1 的 51 分钟收进孤儿分区。
  const preserved = Object.values(snapshot.sessions).some(
    (bucket) => bucket?.segment?.activeMs === 3_103_524,
  );
  assert.equal(preserved, true, 'v1 的时长不应在迁移时丢失');

  // 设置/埋点也要保留。
  assert.equal(snapshot.telemetry.impressions, 12, '埋点必须保留');

  // 当前会话指针必须指向真实存在分区的 id。
  assert.equal(snapshot.activeSessionId, SID);
  assert.ok(snapshot.sessions[SID] !== undefined);
});

// ── 回归 C：迁移必须真的改写 localStorage，而不是只改内存 ──────────────
test('回归：迁移把 localStorage 里的旧值改写成当前 schema', () => {
  const legacy = {
    version: 1,
    settings: { enabled: true, intensity: 'breathing', thresholdsMin: [20, 40, 60] },
    segment: { startedAt: 1, lastActiveAt: 2, activeMs: 600000, activeRuns: 1, firedCount: 1 },
    metrics: null,
    today: { date: 1 },
    collections: [],
    telemetry: { impressions: 1, opens: 0, dismisses: 0 },
    ui: { cardOpen: false, galleryOpen: false, hintVisible: false, playSeq: 0, toast: null },
  };

  const { spec, sandbox } = loadBundle({ persisted: legacy });
  const exported = spec.factory(sandbox.require);
  const { ctx } = makeFakeCtx();
  exported.apply(ctx);

  const stored = JSON.parse(sandbox.localStorage.getItem('immersion-glow.v1'));
  assert.equal(typeof stored.sessions, 'object', '落盘值必须带 sessions');
  assert.ok(stored.sessions !== null);
  assert.equal(stored.version, 4, '落盘值应升级到当前 schema 版本');
  assert.equal('hintVisible' in stored.ui, false, '旧 ui 键必须在迁移时剥落');
  assert.equal(stored.ui.reminder, null, '提醒恢复必须置空（页面生命周期状态）');
  // v4：输入框常驻计时退役，右上角读数上位。
  assert.equal('showInlineTimer' in stored.settings, false, '旧设置键必须在迁移时剥落');
  assert.equal(stored.settings.showCornerMeter, true, '右上角读数开关应有默认值');
  // v4：两个自评表必须存在，哪怕旧数据里完全没有 —— UI 直接读它们。
  assert.deepEqual(stored.verdicts, {}, 'verdicts 表必须存在');
  assert.deepEqual(stored.modelNotes, {}, 'modelNotes 表必须存在');
  // v4：新建分区必须补齐新字段，且 models 是**数组**（UI 会 .length 它）。
  //
  // 注意这份 fixture 的 metrics 是 null —— v1 的顶层时长因此「归属不明」，
  // 按 ADR-117 的原则被丢弃（宁可少算也不冒充某个会话）。所以这里只能验
  // sessions 为空对象时的迁移不炸，不能断言有分区。
  assert.deepEqual(stored.sessions, {}, '归属不明的旧时长应被丢弃，不挂孤儿分区');
  assert.equal('segment' in stored, false, 'v1 顶层时长键应被剥除');
  assert.equal('metrics' in stored, false, 'v1 顶层指标键应被剥除');
});

// ── 回归 D：session 探针认领 sessionId（最权威的当前会话来源） ──────────
test('回归：探针用 session-scope 的 sessionId prop 认领当前会话', () => {
  const bundle = loadBundle();
  const exported = bundle.spec.factory(bundle.sandbox.require);
  // 故意不提供 sessions 服务，逼它走 props 这条路。
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  const probe = record.registered.find(
    (item) => item.kind === 'register' && item.name === 'conversation.input.left',
  );
  assert.ok(probe !== undefined);

  const rootContribution = record.provideRootCalls[0];
  const instance = rootContribution.hooks.immersionGlow;
  const selectorHook = (selector) => selector(instance.getSnapshot());

  probe.component({
    useImmersionGlow: selectorHook,
    useSession: () => undefined,
    sessionId: 'session-from-props',
    immersionGlowActions: rootContribution.props.immersionGlowActions,
  });

  assert.equal(
    instance.getSnapshot().activeSessionId,
    'session-from-props',
    '探针必须把宿主给的 sessionId 认领成当前会话',
  );
});

// ── 回归 E：stale 徽章不得恒亮 ─────────────────────────────────────────
//
// 真实事故：shell.overlay 挂在 root 作用域，root 束没有 sessionId props。
// 第一版读 props.sessionId → 恒 undefined → 只要 metrics 存在，stale 恒为
// true，记录卡永远显示「无打开会话，以下为上一次会话的统计」（用户反馈 3
// 的另一半）。权威来源是 useSessions 快照里 retainedBy.mainView > 0 的行。
test('回归：stale 判定跟随 useSessions 的 mainView 会话，与 metrics 对齐', () => {
  const bundle = loadBundle();
  const exported = bundle.spec.factory(bundle.sandbox.require);
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  const layer = record.registered.find(
    (item) => item.kind === 'register' && item.name === 'shell.overlay',
  );
  assert.ok(layer !== undefined, '必须注册 shell.overlay 图层');

  const rootContribution = record.provideRootCalls[0];
  const instance = rootContribution.hooks.immersionGlow;
  const actions = rootContribution.props.immersionGlowActions;
  const selectorHook = (selector) => selector(instance.getSnapshot());

  // 造一份带 metrics 的分区（模拟探针已经泵过计数）。注意必须真的切过去：
  // writeSession 不动指针，activeSessionId 为 null 时 metrics 派生恒为 null。
  actions.switchSession({ sessionId: 'session-live', now: 1000 });
  actions.writeSession({
    sessionId: 'session-live',
    metrics: { sessionId: 'session-live', turns: 3, toolCalls: 1, truncated: false, degraded: false },
    now: 1000,
  });

  /** 造一份贴近真实的 SessionListState。 */
  const listOf = (mainViewId) => ({
    ids: ['session-live', 'session-other'],
    byId: {
      'session-live': { id: 'session-live', retainedBy: { mainView: mainViewId === 'session-live' ? 1 : 0 } },
      'session-other': { id: 'session-other', retainedBy: { mainView: mainViewId === 'session-other' ? 1 : 0 } },
    },
    phase: 'ready',
    projectionsBySession: {},
  });

  /** 渲染图层，从元素树里找 RecordCard 元素，取它的 stale prop。 */
  const staleOf = (sessionList) => {
    const tree = layer.component({
      useImmersionGlow: selectorHook,
      useSessions: (selector) => selector(sessionList),
      immersionGlowActions: actions,
    });
    const queue = Array.isArray(tree?.children) ? [...tree.children] : [];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === null || node === undefined || typeof node !== 'object') continue;
      if (node.type?.name === 'RecordCard') return node.props.stale;
      if (Array.isArray(node.children)) queue.push(...node.children);
    }
    return undefined;
  };

  // 主视图正持有 metrics 所属的会话 → 不 stale。
  assert.equal(staleOf(listOf('session-live')), false, 'mainView 会话与 metrics 一致时不得标 stale');
  // 主视图换成了另一个会话 → metrics 属于上一场，必须 stale。
  assert.equal(staleOf(listOf('session-other')), true, 'mainView 换会话后 metrics 就是旧数据，必须 stale');
  // useSessions 缺失（老宿主/降级）也不能崩：退回 activeSessionId 比对。
  assert.doesNotThrow(() => staleOf(undefined), 'useSessions 返回垃圾值时不得抛错');
});

// ── 回归 F：useChat 缺失时探针必须静默跳过，绝不写零计数 ────────────────
//
// 用户反馈 3：无打开会话时统计卡显示「上一次会话的统计」但数量全是 0。
// 病灶之一：useChat 缺失时 deriveMetrics 降级，探针若照写不误，就会用一份
// 全零 metrics 顶掉分区里的真实统计。
test('回归：探针在 useChat 缺失时不写 store（零计数不得顶掉真实统计）', () => {
  const bundle = loadBundle();
  const exported = bundle.spec.factory(bundle.sandbox.require);
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  const probe = record.registered.find(
    (item) => item.kind === 'register' && item.name === 'conversation.input.left',
  );

  const rootContribution = record.provideRootCalls[0];
  const instance = rootContribution.hooks.immersionGlow;
  const actions = rootContribution.props.immersionGlowActions;
  const selectorHook = (selector) => selector(instance.getSnapshot());

  // 先放一份真实统计，再让探针在 useChat 缺失的情况下跑。
  actions.switchSession({ sessionId: 'session-live', now: 1000 });
  actions.writeSession({
    sessionId: 'session-live',
    metrics: { sessionId: 'session-live', turns: 7, toolCalls: 9, truncated: false, degraded: false },
    now: 1000,
  });

  const render = () =>
    probe.component({
      useImmersionGlow: selectorHook,
      useSession: () => undefined,
      sessionId: 'session-live',
      immersionGlowActions: actions,
    });

  // 外层组件（ImmersionProbe）只做认领与组装，返回内层 SessionProbe 元素。
  // 渲染它才走到数据泵与守卫本体。
  const renderProbe = (extraProps = {}) => {
    const element = probe.component({
      useImmersionGlow: selectorHook,
      useSession: () => undefined,
      sessionId: 'session-live',
      immersionGlowActions: actions,
      ...extraProps,
    });
    assert.equal(element.type.name, 'SessionProbe', '外层必须返回 SessionProbe 元素');
    return element.type(element.props);
  };

  assert.doesNotThrow(renderProbe, 'useChat 缺失不得抛错（裸调用 undefined 会顶掉插槽）');
  assert.equal(renderProbe(), null, '无内联计时开关时应渲染 null');

  const bucket = instance.getSnapshot().sessions['session-live'];
  assert.equal(bucket.metrics.turns, 7, '真实统计必须原样保留');
  assert.equal(bucket.metrics.toolCalls, 9, '全零降级结果不得写入');
});

// ── 回归 G：useChat 在场时探针把 chat 快照的 legacy 计数泵回 store ──────
//
// 用户反馈 3 的根治：计数真源是 useChat 的 chat 快照（legacy.*），不是
// useSession 的 ConversationSnapshot（那里数节点恒为 0）。
test('回归：探针从 useChat 的 chat 快照泵真实计数进 store', () => {
  const bundle = loadBundle();
  const exported = bundle.spec.factory(bundle.sandbox.require);
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  const probe = record.registered.find(
    (item) => item.kind === 'register' && item.name === 'conversation.input.left',
  );

  const rootContribution = record.provideRootCalls[0];
  const instance = rootContribution.hooks.immersionGlow;
  const actions = rootContribution.props.immersionGlowActions;
  const selectorHook = (selector) => selector(instance.getSnapshot());

  actions.switchSession({ sessionId: 'session-live', now: 1000 });

  const chatSnapshot = {
    order: [],
    nodes: [],
    locations: {},
    navigation: {},
    timeline: {},
    legacy: {
      nodes: [
        { kind: 'user', seq: 1 },
        {
          kind: 'assistant',
          seq: 2,
          turn: 2,
          blocks: [
            { kind: 'tool-call', callId: 'c1', name: 'grep' },
            { kind: 'tool-call', callId: 'c2', name: 'read' },
          ],
        },
        { kind: 'tool-result', seq: 3, callId: 'c1' },
        { kind: 'tool-result', seq: 4, callId: 'c2' },
      ],
      turnTimings: {},
      turnEnds: { 1: 100, 2: 200 },
      partial: null,
      runningCalls: [],
    },
  };

  const element = probe.component({
    useImmersionGlow: selectorHook,
    useChat: (selector) => selector(chatSnapshot),
    useSession: () => ({ hasMore: false }),
    sessionId: 'session-live',
    immersionGlowActions: actions,
  });

  // 渲染内层组件：effect 立即执行（fake React），写库发生在这次渲染里。
  element.type(element.props);

  const metrics = instance.getSnapshot().sessions['session-live'].metrics;
  assert.equal(metrics.sessionId, 'session-live');
  assert.equal(metrics.turns, 2, 'turnEnds 最大键');
  assert.equal(metrics.toolCalls, 2, '两个工具调用（call 头与 result 去重）');
  assert.equal(metrics.degraded, false);
});
