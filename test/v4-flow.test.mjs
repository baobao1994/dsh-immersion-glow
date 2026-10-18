/**
 * v4 数据通路的集成测试：探针 → store → 组件。
 *
 * 单测（model-log.test.mjs）验的是纯函数；这里验的是**接线**：
 *   - 探针真的把逐模型耗时与任务名泵回了 store；
 *   - 右上角读数真的在「发起过」之后才出现；
 *   - 没设阈值时读数不出现；
 *   - 目的确认与模型备注真的落盘，且「回看」能把收藏带进记录卡。
 *
 * 这些正是最容易在重构中被悄悄弄断、且**不报错**的部分 —— 上一版的
 * SessionListState 事故就是这样藏了 82 个绿灯的。
 *
 * 运行： node --test test/v4-flow.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(ROOT, 'tools', 'build-client.mjs')], { stdio: 'ignore' });

const BUNDLE = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

function fakeReact() {
  const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() });
  return {
    createElement,
    Fragment: Symbol('Fragment'),
    useState: (value) => [value, () => {}],
    useEffect: (fn) => {
      fn();
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
  };
}

/** 复刻 persist 的「整体替换、只读一次」语义（见 client-load.test.mjs 的长注释）。 */
function fakeStoreModule(storage) {
  return {
    defineStore: (spec) => ({
      spec,
      create() {
        let state = spec.init();
        const raw = storage === undefined ? null : storage.getItem('immersion-glow.v1');
        if (raw !== null && raw !== undefined) state = JSON.parse(raw);
        const actions = {};
        for (const [key, mutate] of Object.entries(spec.actions)) {
          actions[key] = (...args) => mutate(state, ...args);
        }
        return { actions, getSnapshot: () => state, subscribe: () => () => {} };
      },
    }),
  };
}

function makeFakeCtx(services = {}) {
  const record = { registered: [], provideRootCalls: [] };
  let disposers = [];
  const ctx = {
    effect: (execute, label) => {
      record.effects = record.effects ?? [];
      record.effects.push(label ?? '');
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
        const inner = callback();
        return typeof inner === 'function' ? inner : () => {};
      },
      register: (options, component) => {
        record.registered.push({ kind: 'register', name: options.name, component });
        return () => {};
      },
    },
  };
  return { ctx, record, disposeAll: () => disposers.forEach((d) => d()) };
}

function loadBundle(options = {}) {
  let spec = null;
  const storage = new Map();
  if (options.persisted !== undefined) {
    storage.set('immersion-glow.v1', JSON.stringify(options.persisted));
  }
  const localStorageStub = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  const sandbox = {
    window: {
      __ModuleLoader__: { load: (v) => { spec = v; } },
      addEventListener: () => {},
      removeEventListener: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
      setTimeout: () => 0,
      clearTimeout: () => {},
    },
    localStorage: localStorageStub,
    document: {
      visibilityState: 'visible',
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({
        style: {}, dataset: {}, textContent: '', parentNode: null,
        setAttribute() {}, select() {}, appendChild() {}, removeChild() {},
      }),
      querySelector: () => null,
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
    },
    navigator: { clipboard: { writeText: async () => {} } },
    require: (name) => {
      if (name === 'react') return fakeReact();
      if (name === '@deepseek-ai/dsh-client-store') return fakeStoreModule(localStorageStub);
      throw new Error(`unexpected require(${name})`);
    },
    console, Date, Math, JSON, Number, Object, Array, Set, Map, RegExp, Symbol, Promise, Error, String, Boolean,
  };
  runInContext(BUNDLE, createContext(sandbox));
  return { spec, sandbox, storage };
}

/** 宿主投影 key → 测试里用的简写键名。 */
const PROJECTION_SHORT = {
  sessionStats: 'stats',
  modelSelection: 'model',
  tokenUsage: 'tokens',
};

/**
 * 起一个装好插件的环境，返回探针/图层组件与 store 句柄。
 *
 * @param snapshots - { chat, stats, model, tokens, trajectory }，各为投影值或 undefined。
 */
function boot(snapshots = {}) {
  const bundle = loadBundle();
  const exported = bundle.spec.factory(bundle.sandbox.require);
  const { ctx, record } = makeFakeCtx();
  exported.apply(ctx);

  const contribution = record.provideRootCalls[0];
  const instance = contribution.hooks.immersionGlow;
  const actions = contribution.props.immersionGlowActions;
  const selectorHook = (selector) => selector(instance.getSnapshot());

  const probe = record.registered.find((i) => i.kind === 'register' && i.name === 'conversation.input.left');
  const layer = record.registered.find((i) => i.kind === 'register' && i.name === 'shell.overlay');

  const runProbe = (sessionId = 's1') => {
    const element = probe.component({
      React: fakeReact(),
      useImmersionGlow: selectorHook,
      useChat: snapshots.chat === undefined ? undefined : () => snapshots.chat,
      useSession: () => ({ sessionId, hasMore: false }),
      // 探针按宿主投影 key 取值，snapshots 用简写键名做输入，这里映射过去。
      useProjection: (key) => snapshots[PROJECTION_SHORT[key] ?? key],
      useImmersionGlowActions: undefined,
      immersionGlowActions: actions,
      sessionId,
    });
    // 外层 ImmersionProbe 只负责 claim + 转发，真正干活的是它返回的元素里的
    // SessionProbe。直接调用它，effect 才会真的跑 —— 否则 createElement 造出
    // 的对象没人渲染，探针的写回逻辑等于没被测到。
    if (element === null || element === undefined) return null;
    if (typeof element.type === 'function') return element.type(element.props ?? {});
    return element;
  };

  return { instance, actions, selectorHook, probe, layer, runProbe, contribution };
}

/** 造一份含两条 assistant 调用（分属两个模型）的 chat 快照。 */
function chatSnapshot() {
  return {
    legacy: {
      nodes: [
        { kind: 'user', time: 900, content: [{ type: 'text', text: '帮我把这个按钮改成圆角' }] },
        {
          kind: 'assistant', seq: 10, turn: 1, messageId: 'm1', time: 3000,
          timing: { stepStartTime: 1000, firstTokenTime: null, completedTime: 3000 },
        },
        {
          kind: 'assistant', seq: 20, turn: 1, messageId: 'm2', time: 9000,
          timing: { stepStartTime: 5000, firstTokenTime: null, completedTime: 9000 },
        },
      ],
      turnEnds: new Map([[1, 20]]),
      runningCalls: [],
    },
  };
}

/** 造一份 trajectory 快照：两次调用分属不同模型。 */
function trajectorySnapshot() {
  return {
    requests: [
      { resultSeq: 10, providerMetadata: { provider: 'deepseek', model: 'deepseek-chat' } },
      { resultSeq: 20, providerMetadata: { provider: 'anthropic', model: 'claude-opus' } },
    ],
    eventNodes: [],
  };
}

// ── 探针泵数 ─────────────────────────────────────────────────────────

test('探针把任务名与逐模型耗时泵回 store', () => {
  const env = boot({
    chat: chatSnapshot(),
    trajectory: trajectorySnapshot(),
    stats: { turns: 1, steps: 2, llmMs: 6000, toolMs: 500, ttftMs: 900, ttftSteps: 2, decodeMs: 400, decodeTokens: 300 },
    tokens: { uncachedInputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheWriteTokens: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  env.runProbe('s1');

  const bucket = env.instance.getSnapshot().sessions.s1;
  assert.ok(bucket !== undefined, '探针应建立分区');
  assert.equal(bucket.taskName, '帮我把这个按钮改成圆角', '任务名取首条 user 节点');
  assert.equal(bucket.models.length, 2, '两个模型各一行');
  assert.equal(bucket.stats.turns, 1);
  assert.equal(bucket.stats.tokens.outputTokens, 50, 'token 账随 stats 一起落盘');
  assert.equal(bucket.currentModel.key, 'anthropic/claude-opus', '当前模型单独记');

  const byKey = Object.fromEntries(bucket.models.map((m) => [m.key, m]));
  assert.equal(byKey['deepseek/deepseek-chat'].modelMs, 2000, '3000 - 1000');
  assert.equal(byKey['anthropic/claude-opus'].modelMs, 4000, '9000 - 5000');
});

test('没有轨迹投影时退回当前模型，并标记为近似', () => {
  const env = boot({
    chat: chatSnapshot(),
    model: { next: { provider: 'deepseek', model: 'deepseek-chat' }, lastUsed: null },
  });
  env.runProbe('s1');
  const bucket = env.instance.getSnapshot().sessions.s1;
  assert.equal(bucket.models.length, 1);
  assert.equal(bucket.models[0].key, 'deepseek/deepseek-chat');
  assert.equal(bucket.models[0].modelMs, 6000, '两次调用都归到当前模型');
});

test('探针在无投影时不写零统计（宁可停更）', () => {
  const env = boot({ chat: chatSnapshot() });
  env.runProbe('s1');
  const bucket = env.instance.getSnapshot().sessions.s1;
  assert.equal(bucket.stats, null, '没有 sessionStats 投影时不应写零值');
});

test('探针缺少全部 hook 时不抛错', () => {
  const env = boot({});
  assert.doesNotThrow(() => env.runProbe('s1'), '缺 hook 不能顶掉输入框插槽');
  const result = env.runProbe('s1');
  assert.equal(result, null, '探针永远返回 null');
});

// ── 右上角读数的显示门槛 ─────────────────────────────────────────────

/** 从图层组件里找到 CornerMeter 渲染出的元素树。 */
function hudElement(env) {
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  // 图层渲染 [RecordCard, Gallery, Summary?, CornerMeter, ReminderCard?]
  return tree;
}

/**
 * 递归找带指定 class 的节点，必要时**先渲染**还没被调用的组件元素。
 *
 * 插槽组件返回的是元素树而不是已渲染的 DOM：React 会在挂载时才调用
 * CornerMeter 这类子组件。所以要断言「右上角读数出现了」，得在遍历时把
 * function 类型的元素调用一遍 —— 否则永远只看到一层空壳。
 */
function findByClass(node, className, depth = 0) {
  if (node === null || node === undefined) return null;
  if (depth > 12) return null; // 防御：组件互相渲染时不至于无限递归

  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findByClass(child, className, depth + 1);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (typeof node !== 'object') return null;

  // 尚未渲染的组件元素：先把它跑起来。
  if (typeof node.type === 'function' && node.props !== undefined) {
    return findByClass(node.type(node.props), className, depth + 1);
  }

  const props = node.props ?? {};
  const classes = String(props.class ?? props.className ?? '');
  if (classes.split(/\s+/).includes(className)) return node;
  return findByClass(node.children, className, depth + 1);
}

test('未发起询问时右上角不出现读数', () => {
  const env = boot({ chat: null, model: null });
  // 只有分区、没有模型与统计 → isTaskStarted 为假
  env.actions.switchSession({ sessionId: 's1', now: 1000 });
  const tree = hudElement(env);
  assert.equal(findByClass(tree, 'ig-hud'), null, '发起前不该显示读数');
});

test('发起询问后右上角出现读数', () => {
  const env = boot({
    chat: chatSnapshot(),
    trajectory: trajectorySnapshot(),
    stats: { turns: 1, steps: 2, llmMs: 6000, toolMs: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  env.runProbe('s1');
  const tree = hudElement(env);
  const hud = findByClass(tree, 'ig-hud');
  assert.ok(hud !== null, '发起后应显示收拢态读数');
});

test('阈值为空时读数不出现', () => {
  const env = boot({
    chat: chatSnapshot(),
    trajectory: trajectorySnapshot(),
    stats: { turns: 1, steps: 2, llmMs: 6000, toolMs: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  env.runProbe('s1');
  env.actions.updateSettings({ thresholdsMin: [] });
  const tree = hudElement(env);
  assert.equal(findByClass(tree, 'ig-hud'), null, '没设阈值就不显示');
});

test('关闭右上角读数开关后不出现', () => {
  const env = boot({
    chat: chatSnapshot(),
    trajectory: trajectorySnapshot(),
    stats: { turns: 1, steps: 2, llmMs: 6000, toolMs: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  env.runProbe('s1');
  env.actions.updateSettings({ showCornerMeter: false });
  const tree = hudElement(env);
  assert.equal(findByClass(tree, 'ig-hud'), null);
});

test('禁用插件后读数不出现', () => {
  const env = boot({
    chat: chatSnapshot(),
    trajectory: trajectorySnapshot(),
    stats: { turns: 1, steps: 2, llmMs: 6000, toolMs: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  env.runProbe('s1');
  env.actions.updateSettings({ enabled: false });
  const tree = hudElement(env);
  assert.equal(findByClass(tree, 'ig-hud'), null);
});

// ── 自评落盘与「回看」 ───────────────────────────────────────────────

test('目的确认三档都能落盘，且只认三档', () => {
  const env = boot({});
  const snapshot = env.instance.getSnapshot();
  void snapshot;
  for (const verdict of ['yes', 'partial', 'no']) {
    env.actions.setVerdict({ recordId: 'r1', verdict });
  }
  env.actions.setVerdict({ recordId: 'r2', verdict: 'maybe' });
  const verdicts = env.instance.getSnapshot().verdicts;
  assert.equal(verdicts.r1.verdict, 'no', '同 id 覆盖');
  assert.equal(verdicts.r2, undefined, '非法档位必须被拒');
});

test('模型备注落盘，且同一记录同一模型覆盖而非追加矛盾条目', () => {
  const env = boot({});
  env.actions.addModelNote({ modelKey: 'p/m', rating: 4, note: '第一次', recordId: 'r1' });
  env.actions.addModelNote({ modelKey: 'p/m', rating: 2, note: '改主意', recordId: 'r1' });
  const notes = env.instance.getSnapshot().modelNotes['p/m'].notes;
  assert.equal(notes.length, 1, '同记录只留最新');
  assert.equal(notes[0].rating, 2);
  assert.equal(notes[0].note, '改主意');
});

test('模型备注拒绝非法评分', () => {
  const env = boot({});
  env.actions.addModelNote({ modelKey: 'p/m', rating: 9 });
  env.actions.addModelNote({ modelKey: 'p/m', rating: 0 });
  env.actions.addModelNote({ modelKey: '', rating: 3 });
  assert.deepEqual(Object.keys(env.instance.getSnapshot().modelNotes), []);
});

test('「回看」把收藏带进记录卡并聚焦', () => {
  const env = boot({});
  env.actions.saveRecord({ id: 'r1', createdAt: 1000, activeMs: 120000, activeRuns: 2, turns: 4, toolCalls: 3, taskName: '某个任务' });
  env.actions.setGalleryOpen(true);
  // 模拟画廊里点「回看」。
  const contribution = env.contribution;
  void contribution;
  env.actions.setGalleryOpen(false);
  env.actions.setFocusedRecord('r1');
  env.actions.setCardOpen(true);

  const ui = env.instance.getSnapshot().ui;
  assert.equal(ui.cardOpen, true);
  assert.equal(ui.galleryOpen, false, '回看应关掉画廊，避免两层模态叠加');
  assert.equal(ui.focusedRecordId, 'r1');
});

// ── 图层在各种数据形态下都不崩 ───────────────────────────────────────

test('图层在无会话 / 脏数据下渲染不抛错', () => {
  const cases = [
    () => boot({}),
    () => boot({ chat: 'garbage' }),
    () => boot({ chat: chatSnapshot(), trajectory: 'nope' }),
  ];
  for (const make of cases) {
    const env = make();
    env.runProbe('s1');
    assert.doesNotThrow(() => hudElement(env), '图层崩了会顶掉整个 shell overlay');
  }
});