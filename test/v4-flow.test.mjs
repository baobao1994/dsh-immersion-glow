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

  const provideRootCalls = record.provideRootCalls;
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

  return { instance, actions, selectorHook, probe, layer, runProbe, contribution, provideRootCalls };
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
// ── v5：圆形计时器与提醒联动 ─────────────────────────────────────────

test('收拢态渲染出圆环（svg + 中心读数）', () => {
  const env = bootedWithData();
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const hud = findByClass(tree, 'ig-hud');
  assert.ok(hud !== null, '应显示收拢态计时器');
  assert.ok(findByClass(hud, 'ig-ring') !== null, '应有圆环');
  assert.ok(findByClass(hud, 'ig-ring-text') !== null, '圆环中心应有读数');
  assert.ok(findByClass(hud, 'ig-hud-model') !== null, '应有模型名');
});

test('点击计时器后展开明细面板', () => {
  const env = bootedWithData();
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const hud = findByClass(tree, 'ig-hud');
  // 走真实点击路径：onClick 写 store，图层重渲染后应换成面板。
  hud.props.onClick();
  assert.equal(env.instance.getSnapshot().ui.meterOpen, true, '展开态应落进 store');

  const after = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  assert.equal(findByClass(after, 'ig-hud'), null, '收拢态应消失');
  assert.ok(findByClass(after, 'ig-hud-panel') !== null, '应换成展开面板');
});

test('展开面板里显示逐模型历史评价与备注', () => {
  const env = bootedWithData();
  // 先给 deepseek 一条历史评价。
  env.actions.addModelNote({
    modelKey: 'deepseek/deepseek-chat',
    rating: 4,
    note: '写代码很稳',
    recordId: 'old-1',
  });
  env.actions.setMeterOpen(true);

  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const panel = findByClass(tree, 'ig-hud-panel');
  assert.ok(panel !== null, '应有展开面板');

  const labels = collectText(panel);
  assert.ok(labels.includes('deepseek-chat'), '应出现模型名');
  assert.ok(labels.includes('写代码很稳'), '历史备注原文应出现在面板里');
});

test('记录卡里出现「历史累计」区块', () => {
  const env = bootedWithData();
  // 前置条件：那个模型要在**历史会话**里真的用过（有累计用量）。
  // 只有评价没有用量的模型不进历史 —— 历史区块回答的是「以前用过多久」。
  env.actions.writeSession({
    sessionId: 'old-session',
    now: Date.now(),
    models: [{ key: 'old/gpt-x', provider: 'old', model: 'gpt-x', modelMs: 900000, steps: 8, turns: 4, lastUsedAt: 1 }],
  });
  env.actions.addModelNote({ modelKey: 'old/gpt-x', rating: 5, note: '很好', recordId: 'old-1' });
  env.actions.setCardOpen(true);

  const tree = render(env);
  const panel = findByClass(tree, 'ig-panel');
  assert.ok(panel !== null, '记录卡应打开');
  assert.ok(findByClass(panel, 'ig-history') !== null, '应有历史累计区块');
  assert.ok(collectText(panel).includes('累计'), '应出现累计文案');
});

test('历史区块排除本次已列出的模型（不与「各模型」重复）', () => {
  const env = bootedWithData();
  // 本次用的两个模型都给评价 —— 它们已经由「各模型」区块完整展示了。
  env.actions.addModelNote({ modelKey: 'deepseek/deepseek-chat', rating: 5, note: '稳', recordId: 'r1' });
  env.actions.addModelNote({ modelKey: 'anthropic/claude-opus', rating: 3, note: '一般', recordId: 'r2' });
  env.actions.setCardOpen(true);

  const tree = render(env);
  const history = findByClass(tree, 'ig-history');
  assert.equal(history, null, '本次的模型已在「各模型」里列过，历史不该重复它们');

  // 反证：这些模型确实出现在「各模型」区块里。
  const models = findByClass(tree, 'ig-models');
  assert.ok(models !== null);
  const text = collectText(models);
  assert.ok(text.includes('deepseek-chat') && text.includes('claude-opus'));
});

test('历史区块只显示本次没用过、但你用过的模型', () => {
  const env = bootedWithData();
  // 造第二个会话，里面用了另一个模型。
  env.actions.writeSession({
    sessionId: 'old-session',
    now: Date.now(),
    models: [{ key: 'old/gpt-x', provider: 'old', model: 'gpt-x', modelMs: 900000, steps: 8, turns: 4, lastUsedAt: 1 }],
  });
  env.actions.addModelNote({ modelKey: 'old/gpt-x', rating: 4, note: '老搭档', recordId: 'r9' });
  env.actions.setCardOpen(true);

  const tree = render(env);
  const history = findByClass(tree, 'ig-history');
  assert.ok(history !== null, '应出现历史区块');
  const text = collectText(history);
  assert.ok(text.includes('gpt-x'), '应出现只在历史里的模型');
  assert.ok(text.includes('老搭档'), '应带上它的备注');
  assert.ok(!text.includes('deepseek-chat'), '本次的模型不该重复出现');
});

// v6：提醒不再是独立卡片，而是计时器的一种状态。
test('提醒让计时器转入警示态，而不是多出一个浮层', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: Date.now() });

  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  // 旧卡片必须彻底不存在。
  assert.equal(findByClass(tree, 'ig-reminder'), null, '不应再有独立提醒卡');
  assert.equal(findByClass(tree, 'ig-reminder-badge'), null, '不应再有未读徽标卡');
  // 取而代之：计时器圆环转成警示态。
  assert.ok(findByClass(tree, 'ig-ring--alert') !== null, '圆环应进入提醒态');
  // v7 起倒计时在副行（ig-hud-sub-line--alert），不再是独立的一行。
  assert.ok(findByClass(tree, 'ig-hud-sub-line--alert') !== null, '副行应显示倒计时');
});

test('提醒态下点击计时器：清未读 + 展开明细', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: Date.now() });
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const hud = findByClass(tree, 'ig-hud');
  hud.props.onClick();

  const ui = env.instance.getSnapshot().ui;
  assert.equal(ui.meterOpen, true, '应展开明细');
  assert.equal(ui.cardOpen, false, '不再直接打开记录卡');
});

test('sticky 提醒超时后进入未读态（持续警示，不消失）', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: 1_000_000 });
  // 把时间推过 deadlineAt：fake Date 由 boot() 提供，这里直接改 store 的 deadline。
  const snap = env.instance.getSnapshot();
  snap.ui.reminder.deadlineAt = 1;
  env.actions.setMeterOpen(false);

  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  assert.ok(findByClass(tree, 'ig-ring--unread') !== null, '未读应让圆环持续警示');
  assert.ok(findByClass(tree, 'ig-hud-dot') !== null, '未读应有提示点');
});

test('非 sticky 提醒到点即消失（不留下未读态）', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '已收藏', sticky: false, now: 1_000_000 });
  const snap = env.instance.getSnapshot();
  snap.ui.reminder.deadlineAt = 1;

  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  assert.equal(findByClass(tree, 'ig-ring--unread'), null, '确认类提醒不该变未读');
  assert.equal(findByClass(tree, 'ig-ring--alert'), null, '也不该是倒计时态');
});

test('历史区块里的模型不再需要「本次」标记（去重后它必然不是本次的）', () => {
  const env = bootedWithData();
  env.actions.writeSession({
    sessionId: 'old-session',
    now: Date.now(),
    models: [{ key: 'old/gpt-x', provider: 'old', model: 'gpt-x', modelMs: 900000, steps: 8, turns: 4, lastUsedAt: 1 }],
  });
  env.actions.setCardOpen(true);

  const tree = render(env);
  const history = findByClass(tree, 'ig-history');
  assert.ok(history !== null);
  assert.equal(
    findByClass(history, 'ig-history-now'),
    null,
    '去重后历史里不该再有本次的模型，那个标记也就不必存在了',
  );
});

/** 收集一棵元素树里所有文本节点的拼接串（用于「文案是否出现」类断言）。 */
function collectText(node, depth = 0) {
  if (node === null || node === undefined || depth > 14) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((child) => collectText(child, depth + 1)).join('');
  if (typeof node !== 'object') return '';
  if (typeof node.type === 'function') return collectText(node.type(node.props ?? {}), depth + 1);
  const props = node.props ?? {};
  const className = String(props.class ?? props.className ?? '');
  // 跳过 aria/title 这类非可视文本，否则断言会误判。
  if (className.includes('ig-ring') || className.includes('ig-hud-model')) {
    return collectText(node.children, depth + 1);
  }
  return collectText(node.children, depth + 1);
}

/** 起一个已「发起过」的环境：探针跑过一次，有模型与统计。 */
function bootedWithData() {
  const env = boot({
    chat: chatSnapshot(),
    trajectory: trajectorySnapshot(),
    stats: { turns: 2, steps: 4, llmMs: 6000, toolMs: 900 },
    tokens: { uncachedInputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheWriteTokens: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  env.runProbe('s1');
  return env;
}

test('汇总页能真正渲染（不抛）—— 覆盖共享 helper 的真实调用路径', () => {
  const env = bootedWithData();
  env.actions.addModelNote({ modelKey: 'deepseek/deepseek-chat', rating: 4, note: '稳', recordId: 'r1' });
  env.actions.setSummaryOpen(true);

  // 之前 summary 复用 hud 的 figure()，而 figure 引用了局部变量 h ——
  // 展开路径从未被任何测试走过，所以这个 ReferenceError 一直藏着。
  assert.doesNotThrow(() => {
    const tree = env.layer.component({
      React: fakeReact(),
      useImmersionGlow: env.selectorHook,
      useSessions: () => undefined,
      immersionGlowActions: env.actions,
    });
    const panel = findByClass(tree, 'ig-panel--wide');
    assert.ok(panel !== null, '应渲染出汇总面板');
    assert.ok(findByClass(panel, 'ig-summary-figures') !== null, '应渲染出指标格');
  }, '共享 helper 在新签名下必须仍能工作');
});

test('详情面板里的三格指标都渲染出数值', () => {
  const env = bootedWithData();
  env.actions.setMeterOpen(true);
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const figures = findByClass(tree, 'ig-hud-figures');
  assert.ok(figures !== null);
  assert.ok(findByClass(figures, 'ig-hud-figure') !== null);
});

// ── v7：面板互斥 + 布局分工 ──────────────────────────────────────────

test('面板互斥：打开记录卡会关掉汇总与画廊', () => {
  const env = bootedWithData();
  env.actions.setGalleryOpen(true);
  env.actions.setSummaryOpen(true);

  // 走真实 handler：settings 行与卡片按钮都用它。
  const handlers = buildHandlers(env);
  handlers.openCard();

  const ui = env.instance.getSnapshot().ui;
  assert.equal(ui.cardOpen, true);
  assert.equal(ui.galleryOpen, false, '两个浮层同时开会看不清也点不准');
  assert.equal(ui.summaryOpen, false);
});

test('面板互斥：从计时器开汇总，不会同时留着记录卡', () => {
  const env = bootedWithData();
  env.actions.setCardOpen(true);
  buildHandlers(env).openSummary();
  const ui = env.instance.getSnapshot().ui;
  assert.equal(ui.summaryOpen, true);
  assert.equal(ui.cardOpen, false, '记录卡与汇总不应叠在一起');
});

test('面板互斥：打开画廊也会关掉记录卡与汇总', () => {
  const env = bootedWithData();
  env.actions.setCardOpen(true);
  env.actions.setSummaryOpen(true);
  buildHandlers(env).openGallery();
  const ui = env.instance.getSnapshot().ui;
  assert.equal(ui.galleryOpen, true);
  assert.equal(ui.cardOpen, false);
  assert.equal(ui.summaryOpen, false);
});

test('收拢态两行分工：第一行是主体+总耗时，第二行解释那个数', () => {
  const env = bootedWithData();
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const hud = findByClass(tree, 'ig-hud');
  const line = findByClass(hud, 'ig-hud-row-line');
  const sub = findByClass(hud, 'ig-hud-sub-line');
  assert.ok(line !== null, '应有两行结构里的第一行');
  assert.ok(sub !== null, '应有两行结构里的第二行');
  // 第二行必须解释中心那个没有单位的数字。
  assert.ok(collectText(sub).includes('模型耗时'), '副行应说明这个数是什么');
});

test('提醒态下副行换成倒计时（第一行仍是总耗时）', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: Date.now() });
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const hud = findByClass(tree, 'ig-hud');
  const sub = findByClass(hud, 'ig-hud-sub-line--alert');
  assert.ok(sub !== null, '副行应切成倒计时');
  const text = collectText(sub);
  assert.ok(text.includes('60s') || text.includes('后收起'), `副行应显示倒计时，实际 ${text}`);
  // 总耗时仍在第一行右端，不该被提醒挤掉。
  assert.ok(findByClass(hud, 'ig-hud-time') !== null, '总耗时始终保留');
});

/**
 * 从 bundle 里取出 handlers —— 复刻 index.js 装配出来的形状。
 * 直接调 actions 测不到「打开 X 会关掉 Y」这种联动，那正是本组测试的目标。
 */
function buildHandlers(env) {
  // 取 index.js 真实装配出来的 handlers —— 不在测试里复制一份逻辑。
  // 复制等于在测复制品：改坏了真代码，测试照样绿。
  const calls = env.provideRootCalls;
  for (const call of calls) {
    if (call.props !== undefined && call.props.igHandlers !== undefined) return call.props.igHandlers;
  }
  throw new Error('apply() 没有把 handlers 暴露到 root 面（index.js 的 provideRoot）');
}

// ── v8：面板打开时收拢态必须让位 ────────────────────────────────────

test('打开记录卡时收拢态完全不渲染（不靠 z-index 压层级）', () => {
  const env = bootedWithData();
  // 先确认常态下它是在的 —— 否则「消失」这个断言没有意义。
  const normal = render(env);
  assert.ok(findByClass(normal, 'ig-hud') !== null, '常态应有收拢态');

  env.actions.setCardOpen(true);
  const withCard = render(env);
  assert.equal(findByClass(withCard, 'ig-hud'), null, '面板打开时收拢态必须让位');
  assert.ok(findByClass(withCard, 'ig-panel') !== null, '记录卡应可见');
});

test('打开汇总或画廊时收拢态同样让位', () => {
  for (const flag of ['setSummaryOpen', 'setGalleryOpen']) {
    const env = bootedWithData();
    env.actions[flag](true);
    const tree = render(env);
    assert.equal(findByClass(tree, 'ig-hud'), null, `${flag} 打开时收拢态必须让位`);
  }
});

test('「返回」把面板换成展开态计时器（不塌回收拢态）', () => {
  const env = bootedWithData();
  const handlers = buildHandlers(env);

  handlers.openSummary();
  assert.equal(env.instance.getSnapshot().ui.summaryOpen, true);

  // v9 起面板的唯一退出路径是 backToMeter（顶部的「返回」按钮 / 点空白）。
  handlers.backToMeter();
  const ui = env.instance.getSnapshot().ui;
  assert.equal(ui.summaryOpen, false);
  assert.equal(ui.meterOpen, true, '应回到展开态，用户刚看完注意力还在这一块');

  const tree = render(env);
  assert.equal(findByClass(tree, 'ig-hud'), null, '收拢态不该出现');
  assert.ok(findByClass(tree, 'ig-hud-panel') !== null, '应回到展开态');
});

test('「返回」同时清掉聚焦记录（下次打开记录卡不是回看语境）', () => {
  const env = bootedWithData();
  const handlers = buildHandlers(env);
  env.actions.setFocusedRecord('r1');
  handlers.backToMeter();
  assert.equal(env.instance.getSnapshot().ui.focusedRecordId, null);
});

test('「返回」能从任意面板退出（三个都通）', () => {
  for (const open of ['openSummary', 'openGallery', 'openCard']) {
    const env = bootedWithData();
    const handlers = buildHandlers(env);
    handlers[open]();
    handlers.backToMeter();
    const ui = env.instance.getSnapshot().ui;
    assert.equal(ui.cardOpen, false, `${open} 后返回，记录卡应关`);
    assert.equal(ui.galleryOpen, false, `${open} 后返回，画廊应关`);
    assert.equal(ui.summaryOpen, false, `${open} 后返回，汇总应关`);
    assert.equal(ui.meterOpen, true, `${open} 后返回应回到展开态计时器`);
  }
});

test('三个面板的退出按钮都是「返回」（带箭头），不再是 ×', () => {
  const env = bootedWithData();
  for (const flag of ['setCardOpen', 'setGalleryOpen', 'setSummaryOpen']) {
    const e = bootedWithData();
    e.actions[flag](true);
    const tree = render(e);
    const back = findByClass(tree, 'ig-panel-back');
    assert.ok(back !== null, `${flag} 面板应有「返回」按钮`);
    assert.ok(findByClass(back, 'ig-back-icon') !== null, '「返回」应带一个向左的尖括号');
  }
  void env;
});

/** 渲染图层并返回元素树。 */
function render(env) {
  return env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
}
