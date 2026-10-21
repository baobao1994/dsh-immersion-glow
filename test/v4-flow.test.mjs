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
import { collectText, fakeReact, fakeStoreModule, findAllByClass, findByClass, loadModule, makeFakeCtx } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(ROOT, 'tools', 'build-client.mjs')], { stdio: 'ignore' });

const BUNDLE = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));


function loadBundle(options = {}) {
  let spec = null;
  const storage = new Map();
  // window 上的监听器要真的记下来：多窗口同步走 storage 事件，不记录就没法
  // 触发，接线测试会退化成「监听器存在」这种静态断言。
  const listeners = new Map();
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
      addEventListener: (type, fn) => {
        const list = listeners.get(type) ?? [];
        list.push(fn);
        listeners.set(type, list);
      },
      removeEventListener: (type, fn) => {
        const list = listeners.get(type);
        if (list === undefined) return;
        const index = list.indexOf(fn);
        if (index >= 0) list.splice(index, 1);
      },
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
  return {
    spec,
    sandbox,
    storage,
    /** 触发某个 window 事件的全部监听器（目前只用于 storage）。 */
    emit: (type, event) => {
      for (const fn of listeners.get(type) ?? []) fn(event);
    },
  };
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
  // v20 起设置页注册成 settings.section（不再塞在通用页的一行里）。
  const settings = record.registered.find((i) => i.kind === 'register' && i.name === 'settings.section');

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

  return {
    instance,
    actions,
    selectorHook,
    probe,
    layer,
    settings,
    runProbe,
    contribution,
    provideRootCalls,
    /** 触发 window 事件（storage 多窗口同步用）。 */
    emit: bundle.emit,
  };
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

test('探针把「模型是否正在回答」泵回 store', () => {
  // 无 partial、无 runningCalls → 不在忙。
  const idle = boot({
    chat: chatSnapshot(), // legacy.partial 未定义、runningCalls 空
    stats: { turns: 1, steps: 2, llmMs: 6000, toolMs: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  idle.runProbe('s1');
  assert.equal(idle.instance.getSnapshot().sessions.s1.busy, false, '没有回答在跑应为 not busy');

  // 有 runningCalls → 正在回答。
  const busy = boot({
    chat: {
      legacy: {
        nodes: [{ kind: 'user', seq: 1 }],
        turnTimings: {},
        turnEnds: {},
        partial: null,
        runningCalls: [{ callId: 'c1', name: 'task' }],
      },
    },
    stats: { turns: 0, steps: 1, llmMs: 1000, toolMs: 0 },
    model: { next: { provider: 'deepseek', model: 'deepseek-chat' }, lastUsed: null },
  });
  busy.runProbe('s1');
  assert.equal(busy.instance.getSnapshot().sessions.s1.busy, true, '有工具调用在跑应为 busy');
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


test('未发起询问时右上角不出现读数', () => {
  const env = boot({ chat: null, model: null });
  // 只有分区、没有模型与统计 → isTaskStarted 为假
  env.actions.switchSession({ sessionId: 's1', now: 1000 });
  const tree = hudElement(env);
  assert.equal(findByClass(tree, 'ig-hud'), null, '发起前不该显示读数');
});

test('只配置了模型（还没发第一句）也不出现读数', () => {
  // 真实 DSH 新会话：modelSelection.next 已配置 → currentModel 非空，但没有任何
  // 请求/统计/模型痕迹。按「还没发起不计时」，右上角不该冒出个 1 秒的假读数。
  const env = boot({
    chat: { legacy: { nodes: [], turnTimings: {}, turnEnds: {}, partial: null, runningCalls: [] } },
    stats: { turns: 0, steps: 0, llmMs: 0, toolMs: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  env.actions.switchSession({ sessionId: 's1', now: 1000 });
  env.runProbe('s1');
  const bucket = env.instance.getSnapshot().sessions.s1;
  assert.ok(bucket.currentModel !== null, '前置：currentModel 确实被设为配置模型');
  assert.equal(findByClass(hudElement(env), 'ig-hud'), null, '只配置模型、未发起 → 不显示读数');
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

test('读数里的时长跟着会话已用时长(activeMs)走，而不是模型耗时', () => {
  // 用户反馈：读数之前显示 modelMs，只在模型调用时跳一下，「计时没在走」。
  // 现在改为显示 activeMs（会话已用时长），随 tick 每秒 +1。
  // v16 起读数只有一个数字（.ig-hud-time）—— 旧版环心与右侧是同一个值，
  // 收拢态实际显示「14 14 分钟」。
  const env = boot({
    chat: chatSnapshot(),
    trajectory: trajectorySnapshot(),
    stats: { turns: 1, steps: 2, llmMs: 6000, toolMs: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  env.runProbe('s1');
  const timeText = () => {
    const t = hudElement(env);
    const hud = findByClass(t, 'ig-hud');
    return collectText(findByClass(hud, 'ig-hud-time'));
  };

  // 初始 activeMs≈0 → 显示 0 秒（不是旧的 0 也被抬成 1 秒）。
  assert.equal(timeText(), '0 秒', '空态显示 0 秒');

  // 把 activeMs 推进到 5 秒，读数应跟着变 5 秒 —— 证明它由 activeMs 驱动。
  env.actions.writeSession({
    sessionId: 's1',
    now: Date.now(),
    segment: { startedAt: 900, lastActiveAt: Date.now(), activeMs: 5000, activeRuns: 1, firedCount: 0 },
  });
  assert.equal(timeText(), '5 秒', 'activeMs 增加后读数跟着走');
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

test('模型备注：当前轮（recordId 为空）修改只更新这一轮，不追加新条目', () => {
  const env = boot({});
  // 给「正在看的这一轮」的模型评 3 分。
  env.actions.addModelNote({ modelKey: 'p/m', rating: 3, note: '第一版', now: 1000 });
  // 改了主意 —— 没传 recordId（就是当前轮），此前这里会追出一条新记录。
  env.actions.addModelNote({ modelKey: 'p/m', rating: 5, note: '改成 5', now: 2000 });

  const notes = env.instance.getSnapshot().modelNotes['p/m'].notes;
  assert.equal(notes.length, 1, '当前轮修改应覆盖而不是堆积多轮');
  assert.equal(notes[0].rating, 5);
  assert.equal(notes[0].note, '改成 5');
});

test('模型备注：不同记录各自独立，不会被当前轮的覆盖误伤', () => {
  const env = boot({});
  env.actions.addModelNote({ modelKey: 'p/m', rating: 4, note: '历史那条', recordId: 'old-1' });
  env.actions.addModelNote({ modelKey: 'p/m', rating: 3, note: '当前这条', recordId: null });
  const notes = env.instance.getSnapshot().modelNotes['p/m'].notes;
  assert.equal(notes.length, 2, '历史记录与当前轮各自保留');
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

test('收拢态渲染出暖点、唯一读数与一句关于下一次休息的话', () => {
  const env = bootedWithData();
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const hud = findByClass(tree, 'ig-hud');
  assert.ok(hud !== null, '应显示收拢态读数');
  assert.ok(findByClass(hud, 'ig-ember') !== null, '应有会呼吸的暖点');
  assert.ok(findByClass(hud, 'ig-hud-time') !== null, '应有读数');
  assert.ok(findByClass(hud, 'ig-hud-next') !== null, '应有「多久之后提醒」');
  // 旧版环心与右侧是同一个 activeMs，等于把同一个数显示了两遍。
  assert.equal(findAllByClass(hud, 'ig-hud-time').length, 1, '时长只能出现一次');
  assert.equal(findByClass(hud, 'ig-ring'), null, '圆环已退役');
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

test('展开面板的 × 能收起（点击必须真的写回 store）', () => {
  // v19 的真 bug：重写 hud.js 时漏掉了 setOpen 的定义，× 的 onClick 引用它
  // 直接抛 ReferenceError —— 表现就是「按钮没反应」。没有任何测试点过它。
  const env = bootedWithData();
  env.actions.setMeterOpen(true);
  const panel = findByClass(render(env), 'ig-hud-panel');
  const close = findByClass(panel, 'ig-hud-collapse');
  assert.ok(close !== null, '应有收起按钮');
  assert.equal(typeof close.props.onClick, 'function', '收起按钮必须有点击处理');
  assert.doesNotThrow(() => close.props.onClick(), '× 的 onClick 不能抛');
  assert.equal(env.instance.getSnapshot().ui.meterOpen, false, '× 必须真的收起');
});

test('展开面板里每个可点元素点了都不抛', () => {
  const countAt = (env) => clickables(findByClass(render(env), 'ig-hud-panel')).length;
  const env0 = bootedWithData();
  env0.actions.setMeterOpen(true);
  const count = countAt(env0);
  assert.ok(count >= 3, `面板里应有多个可点元素，实际 ${count}`);

  for (let index = 0; index < count; index += 1) {
    const env = bootedWithData();
    env.actions.setMeterOpen(true);
    const buttons = clickables(findByClass(render(env), 'ig-hud-panel'));
    assert.doesNotThrow(
      () => buttons[index].props.onClick(),
      `第 ${index + 1} 个可点元素的 onClick 抛了（多半是引用了没定义的变量）`,
    );
  }
});

test('记录卡的「返回」回到读数，而不是把整个角落实空', () => {
  // 三个面板的退出口径：返回 = 回到上一层（读数），不是「关闭」。
  const env = bootedWithData();
  env.actions.setCardOpen(true);
  const panel = findAllByClass(render(env), 'ig-panel').find(
    (node) => node.props?.['aria-label'] === '沉浸记录',
  );
  const back = findByClass(panel, 'ig-panel-back');
  assert.ok(back !== null, '记录卡应有返回按钮');
  assert.doesNotThrow(() => back.props.onClick());
  const ui = env.instance.getSnapshot().ui;
  assert.equal(ui.cardOpen, false, '记录卡应关闭');
  assert.equal(ui.meterOpen, true, '读数应展开 —— 用户回到的是上一层，不是一个空角落');
});

test('记录卡与画廊里每个可点元素点了都不抛', () => {
  // 与上一条同样的理由：这类「画了按钮但 handler 引用了不存在的名字」的错误
  // 只有真点一下才会暴露。两个面板都覆盖，别只盯着读数。
  const panelByLabel = (tree, label) =>
    findAllByClass(tree, 'ig-panel').find((node) => node.props?.['aria-label'] === label) ?? null;

  const cases = [
    { label: '沉浸记录', open: (env) => env.actions.setCardOpen(true) },
    { label: '收藏画廊', open: (env) => env.actions.setGalleryOpen(true) },
  ];

  for (const item of cases) {
    const probe = bootedWithData();
    probe.actions.addModelNote({ modelKey: 'deepseek/deepseek-chat', rating: 4, note: '稳', recordId: 'r1' });
    probe.actions.saveRecord({ id: 'r1', createdAt: 1000, activeMs: 120000, taskName: '某个任务' });
    item.open(probe);
    const panel = panelByLabel(render(probe), item.label);
    assert.ok(panel !== null, `${item.label} 应渲染出来`);
    const count = clickables(panel).length;
    assert.ok(count > 0, `${item.label} 里应有可点元素`);

    for (let index = 0; index < count; index += 1) {
      const env = bootedWithData();
      env.actions.addModelNote({ modelKey: 'deepseek/deepseek-chat', rating: 4, note: '稳', recordId: 'r1' });
      env.actions.saveRecord({ id: 'r1', createdAt: 1000, activeMs: 120000, taskName: '某个任务' });
      item.open(env);
      const target = clickables(panelByLabel(render(env), item.label))[index];
      assert.doesNotThrow(
        () => target.props.onClick(),
        `${item.label} 第 ${index + 1} 个可点元素抛了`,
      );
    }
  }
});

test('只有一个模型时不画占比条（100% 的占比没有信息量）', () => {
  // 用户实测反馈：单模型时那条纯色长条「看起来像进度条」，还以为是设置错了。
  const env = bootedWithData();
  const bucket = env.instance.getSnapshot().sessions.s1;
  assert.ok(bucket.models.length > 1, '前置：夹具里本来有两个模型');
  bucket.models = [bucket.models[0]];
  env.actions.setMeterOpen(true);

  const panel = findByClass(render(env), 'ig-hud-panel');
  assert.equal(findByClass(panel, 'ig-hud-bar'), null, '单模型不画占比条');
  assert.equal(findByClass(panel, 'ig-hud-tone'), null, '也不需要色点');
  assert.ok(findByClass(panel, 'ig-hud-list') !== null, '模型行本身仍在（耗时照常显示）');
});

test('两个模型时画占比条，每个模型行带一个同色色点', () => {
  const env = bootedWithData();
  env.actions.setMeterOpen(true);
  const panel = findByClass(render(env), 'ig-hud-panel');
  assert.ok(findByClass(panel, 'ig-hud-bar') !== null, '多模型应画占比条');
  assert.equal(findAllByClass(panel, 'ig-hud-tone').length, 2, '一条色点对应一个模型');
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

// 记录卡不再渲染跨会话「历史累计」。（v-2026-10 用户反馈：历史累计列的是其它
// 会话用过的模型，和「看这次记录卡」无关 —— 只想看本次用了哪些模型并打分。）
test('记录卡不再渲染跨会话「历史累计」区块', () => {
  const env = bootedWithData();
  // 造一个只用过 old/gpt-x 的历史会话，外加它的评分备注。
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
  assert.equal(findByClass(panel, 'ig-history'), null, '跨会话历史区块应彻底移除');
  assert.ok(!collectText(panel).includes('累计'), '不应再出现跨会话「累计」文案');
});

test('记录卡：这次停下来过就写一行，没停过就不占位', () => {
  const env = bootedWithData();
  const recordPanel = () => findAllByClass(render(env), 'ig-panel').find(
    (node) => node.props?.['aria-label'] === '沉浸记录',
  );

  env.actions.setCardOpen(true);
  assert.ok(!collectText(recordPanel()).includes('停下来'), '没停过不该出现这行');

  const segment = env.instance.getSnapshot().sessions.s1.segment;
  segment.stopRuns = 2;
  segment.longestStopMs = 6 * 60000;
  const text = collectText(recordPanel());
  assert.ok(text.includes('停下来 2 次'), `应报次数，实际：${text.slice(0, 120)}`);
  assert.ok(text.includes('最长 6 分钟'), '应报最长一次');
});

test('记录卡主数字是沉浸时长（activeMs），不是模型耗时', () => {
  // 这张卡叫「沉浸记录」，第一眼该看到的是「我坐了多久」。
  // 旧版顶部三格等重，而且主位放的是 modelMs —— 那回答的是模型跑了多久。
  const env = bootedWithData();
  env.instance.getSnapshot().sessions.s1.segment.activeMs = 42 * 60000;
  env.actions.setCardOpen(true);

  const tree = render(env);
  assert.equal(collectText(findByClass(tree, 'ig-card-hero-value')), '42');
  assert.equal(collectText(findByClass(tree, 'ig-card-hero-unit')), '分钟');
});

test('当前会话的时段标签取自 segment，而不是分区顶层的不存在字段', () => {
  // 旧版读 source.startedAt / source.activeMs：这两个字段只存在于「收藏」上，
  // 实时分区把它们放在 segment 里。于是正在用的会话永远只带一个「碎片」标签。
  const env = bootedWithData();
  const bucket = env.instance.getSnapshot().sessions.s1;
  bucket.segment.activeMs = 90 * 60000;
  bucket.segment.startedAt = new Date(2026, 9, 20, 2, 0, 0).getTime();
  env.actions.setCardOpen(true);

  const tags = findByClass(render(env), 'ig-card-tags');
  assert.ok(tags !== null, '90 分钟 / 凌晨 → 应有两个标签');
  const text = collectText(tags);
  assert.ok(text.includes('深夜'), `凌晨开始应为深夜，实际：${text}`);
  assert.ok(text.includes('长跑'), `90 分钟应为长跑，实际：${text}`);
});

test('记录卡只列本次会话用过的模型（不含其它会话的模型）', () => {
  const env = bootedWithData();
  env.actions.addModelNote({ modelKey: 'deepseek/deepseek-chat', rating: 5, note: '稳', recordId: 'r1' });
  env.actions.addModelNote({ modelKey: 'anthropic/claude-opus', rating: 3, note: '一般', recordId: 'r2' });
  // 其它会话里用过的模型，绝不能出现在本次记录卡里。
  env.actions.writeSession({
    sessionId: 'old-session',
    now: Date.now(),
    models: [{ key: 'old/gpt-x', provider: 'old', model: 'gpt-x', modelMs: 900000, steps: 8, turns: 4, lastUsedAt: 1 }],
  });
  env.actions.setCardOpen(true);

  const tree = render(env);
  assert.equal(findByClass(tree, 'ig-history'), null, '不再有跨会话历史区块');

  // 本次的模型仍由「各模型」区块完整展示（可给它们打分）。
  const models = findByClass(tree, 'ig-models');
  assert.ok(models !== null, '本次会话的模型列表仍在');
  const text = collectText(models);
  assert.ok(text.includes('deepseek-chat') && text.includes('claude-opus'), '本次模型应列出');
  assert.ok(!text.includes('gpt-x'), '其它会话的模型不应出现');
});

// v6：提醒不再是独立卡片，而是计时器的一种状态。
test('提醒让读数长成一张小暖卡，而不是给同一个药丸换个颜色', () => {
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
  // 取而代之：暖点停止呼吸 + 同一位置长出一张卡。
  const card = findByClass(tree, 'ig-hud-card');
  assert.ok(card !== null, '到点应长出一张提醒卡');
  assert.ok(findByClass(card, 'ig-ember--alert') !== null, '暖点应进入提醒态（停止呼吸）');
  assert.ok(findByClass(card, 'ig-hud-count') !== null, '卡片应显示倒计时');
  const text = collectText(card);
  // 正文按时段轮换，所以断言「是 12 条里的一条」，而不是某一句固定的文案。
  const dict = loadModule('dict.js');
  const lines = ['night', 'morning', 'day', 'evening'].flatMap((bucket) =>
    [1, 2, 3].map((n) => dict.ZH[`hud.alert.line.${bucket}.${n}`]),
  );
  assert.ok(lines.some((line) => text.includes(line)), `卡片应给一个可执行的动作，实际：${text}`);
  assert.ok(text.includes('好，歇一下'), '主操作应该是「歇一下」，不是「看明细」');
});

// ⚠ 这条测试的**名字**一直写着「清未读」，但 v6~v11 的断言里只有 meterOpen。
// 于是「提醒永远消不掉」这个真 bug 溜了过去：状态确实清得掉（action 在），
// 只是**没有任何 UI 调用它** —— 而断言只看了面板状态，没看提醒状态。
// 现在把「清未读」真正断言上。
test('提醒卡上的两个动作都能清掉提醒（否则卡片永远占着角落）', () => {
  // 「提醒卡长出来」和「提醒卡消失」是两条独立的失败路径：按钮画出来了但没接
  // handler，卡片就会永远停在右上角。v6 的「未读消不掉」就是这一类。
  const dismiss = (index) => {
    const env = bootedWithData();
    env.actions.showReminder({ message: '该歇了', sticky: true, now: Date.now() });
    const card = findByClass(render(env), 'ig-hud-card');
    assert.ok(card !== null, '前置：应长成提醒卡');
    const buttons = findAllByClass(card, 'ig-btn');
    assert.ok(buttons.length >= 2, '应有「歇一下」与「先记着」两个动作');
    assert.notEqual(env.instance.getSnapshot().ui.reminder, null, '前置：提醒在');
    buttons[index].props.onClick();
    assert.equal(env.instance.getSnapshot().ui.reminder, null, `第 ${index + 1} 个动作必须清提醒`);
  };
  dismiss(0); // 好，歇一下
  dismiss(1); // 先记着
});

test('提醒态下点击计时器：清未读 + 展开明细', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: Date.now() });
  assert.ok(env.instance.getSnapshot().ui.reminder !== null, '前置：确实有未读');

  const tree = render(env);
  const hud = findByClass(tree, 'ig-hud');
  hud.props.onClick();

  const ui = env.instance.getSnapshot().ui;
  assert.equal(ui.reminder, null, '点开计时器 = 已看，未读必须清掉');
  assert.equal(ui.meterOpen, true, '应展开明细');
  assert.equal(ui.cardOpen, false, '不再直接打开记录卡');
});

test('点开后界面上不再有未读标记', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: Date.now() });
  findByClass(render(env), 'ig-hud').props.onClick();

  const after = render(env);
  assert.equal(findByClass(after, 'ig-ember--unread'), null, '未读态样式应消失');
  assert.equal(findByClass(after, 'ig-hud-next--alert'), null, '提醒语应恢复常态');
  assert.equal(findByClass(after, 'ig-hud-banner'), null, '提醒条应消失');
});

test('已超时的未读：点开同样能清掉（不只看倒计时那条路）', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: 1_000_000 });
  // 推过 deadline，进入未读态。
  env.instance.getSnapshot().ui.reminder.deadlineAt = 1;
  assert.ok(findByClass(render(env), 'ig-ember--unread') !== null, '前置：应为未读态');

  findByClass(render(env), 'ig-hud').props.onClick();
  assert.equal(env.instance.getSnapshot().ui.reminder, null, '未读态也必须能清');
});

test('展开态下收到提醒：点提醒条也能标为已看', () => {
  const env = bootedWithData();
  // 先展开计时器，再收到提醒 —— 此时收拢态的点击路径走不到。
  env.actions.setMeterOpen(true);
  env.actions.showReminder({ message: '该歇了', sticky: true, now: Date.now() });

  const tree = render(env);
  const banner = findByClass(tree, 'ig-hud-banner');
  assert.ok(banner !== null, '展开态应显示提醒条');
  assert.equal(banner.type, 'button', '提醒条必须是可点的按钮，否则未读消不掉');

  banner.props.onClick();
  assert.equal(env.instance.getSnapshot().ui.reminder, null, '点提醒条应清未读');
  // 只清提醒，不该把面板收起来。
  assert.equal(env.instance.getSnapshot().ui.meterOpen, true, '面板应保持展开');
});

test('「点开 = 已看」有 UI 调用点（防止 action 变成死代码）', () => {
  // 这条断言的是「接线」而不是「状态机」：openMeter / dismissReminder 两个
  // action 曾经都在，却没有任何组件调用它们 —— 状态机测试全绿而功能完全失效。
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: Date.now() });
  const collapsed = findByClass(render(env), 'ig-hud');
  assert.equal(typeof collapsed.props.onClick, 'function', '收拢态必须有点击处理');
  collapsed.props.onClick();
  assert.equal(env.instance.getSnapshot().ui.reminder, null, '收拢态点击必须真的清掉提醒');
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
  assert.ok(findByClass(tree, 'ig-ember--unread') !== null, '未读应让暖点持续亮着');
  const next = findByClass(tree, 'ig-hud-next');
  assert.ok(next !== null && collectText(next).includes('该歇了'), '未读时应直接说「该歇了」');
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
  assert.equal(findByClass(tree, 'ig-ember--unread'), null, '确认类提醒不该变未读');
  assert.equal(findByClass(tree, 'ig-hud-card'), null, '也不该长成提醒卡');
});

test('记录卡里不再有跨会话「历史」标记类残留（old/gpt-x 不侵入本次卡）', () => {
  const env = bootedWithData();
  env.actions.writeSession({
    sessionId: 'old-session',
    now: Date.now(),
    models: [{ key: 'old/gpt-x', provider: 'old', model: 'gpt-x', modelMs: 900000, steps: 8, turns: 4, lastUsedAt: 1 }],
  });
  env.actions.setCardOpen(true);

  const tree = render(env);
  const history = findByClass(tree, 'ig-history');
  assert.equal(history, null, '跨会话历史区块已移除');
  assert.equal(findByClass(tree, 'ig-history-now'), null, '「本次」标记类残留也不该存在');
  assert.ok(!collectText(tree).includes('gpt-x'), '其它会话的模型不应出现在本次记录卡');
});


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

test('汇总：长跑有没有用 —— 只统计评过的收藏，按时长分三档', () => {
  // 不碰正文的那半个「我常问什么」：时长 → 结果。数据全部来自已有的收藏与评价。
  const env = bootedWithData();
  env.actions.saveRecord({ id: 'a', createdAt: 1, activeMs: 20 * 60000, taskName: 'A' });
  env.actions.saveRecord({ id: 'b', createdAt: 2, activeMs: 45 * 60000, taskName: 'B' });
  env.actions.saveRecord({ id: 'c', createdAt: 3, activeMs: 90 * 60000, taskName: 'C' });
  // 没评的这条不能进分母（否则达成率会被压低）。
  env.actions.saveRecord({ id: 'd', createdAt: 4, activeMs: 10 * 60000, taskName: 'D' });
  env.actions.setVerdict({ recordId: 'a', verdict: 'yes' });
  env.actions.setVerdict({ recordId: 'b', verdict: 'no' });
  env.actions.setVerdict({ recordId: 'c', verdict: 'partial' });
  env.actions.setSummaryOpen(true);

  const panel = findByClass(render(env), 'ig-panel--wide');
  const rows = findAllByClass(panel, 'ig-rhythm-row');
  assert.equal(rows.length, 3, '三档都有样本');
  const texts = rows.map((row) => collectText(row));
  assert.ok(texts[0].includes('100%'), `30 分钟以内应为 100%，实际 ${texts[0]}`);
  assert.ok(texts[1].includes('0%'), `30–60 分钟应为 0%，实际 ${texts[1]}`);
  assert.ok(texts[2].includes('50%'), `1 小时以上应为 50%（基本达到记半分），实际 ${texts[2]}`);
  assert.ok(texts[0].includes('1 次'), '应显示样本数');
});

test('汇总：评过的记录不足 3 条时不显示长跑对照（样本太少会误导）', () => {
  const env = bootedWithData();
  env.actions.saveRecord({ id: 'a', createdAt: 1, activeMs: 20 * 60000 });
  env.actions.setVerdict({ recordId: 'a', verdict: 'yes' });
  env.actions.setSummaryOpen(true);
  const panel = findByClass(render(env), 'ig-panel--wide');
  assert.equal(findByClass(panel, 'ig-rhythm'), null);
});

test('汇总行显示 provider（同名模型来自不同线路时要能区分）', () => {
  const env = bootedWithData();
  env.actions.setSummaryOpen(true);

  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const panel = findByClass(tree, 'ig-panel--wide');
  assert.ok(panel !== null);

  const text = collectText(panel);
  assert.ok(text.includes('claude-opus'), '模型名照常显示');
  assert.ok(text.includes('anthropic'), 'provider 必须露出来，否则同名两行无法区分');
  assert.ok(findByClass(panel, 'ig-model-provider') !== null, 'provider 走独立的弱化样式');
});

test('详情面板：一个主数字 + 一行元信息（旧版的三格指标已合并）', () => {
  // v19 之前顶部是「模型耗时 / 工具耗时」两格，每个模型行里又有各自的耗时，
  // 同一个数出现两遍。现在状态区只有一个主数字，其余压成一行元信息。
  const env = bootedWithData();
  env.instance.getSnapshot().sessions.s1.segment.activeMs = 14 * 60000;
  env.actions.setMeterOpen(true);
  const tree = render(env);

  const panel = findByClass(tree, 'ig-hud-panel');
  assert.equal(collectText(findByClass(panel, 'ig-hud-hero-value')), '14', '主数字是已用时长');
  assert.equal(collectText(findByClass(panel, 'ig-hud-hero-unit')), '分钟');
  const meta = collectText(findByClass(panel, 'ig-hud-meta'));
  assert.ok(meta.includes('工具耗时'), `元信息应含工具耗时，实际 ${meta}`);
  assert.equal(findByClass(panel, 'ig-hud-figures'), null, '两格指标已合并，不应再渲染');
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

test('收拢态是一个数字配一句话：数字带单位，话说明下一次休息', () => {
  const env = bootedWithData();
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const hud = findByClass(tree, 'ig-hud');
  const time = findByClass(hud, 'ig-hud-time');
  const next = findByClass(hud, 'ig-hud-next');
  assert.ok(time !== null, '应有读数');
  assert.ok(next !== null, '应有第二段文字');
  // 数字现在自带单位（0 秒 / 14 分钟），不再需要一行字去解释它是什么。
  assert.ok(collectText(time).length > 0, '读数不该为空');
  assert.ok(collectText(next).includes('后提醒你'), '第二段说的是下一次休息的时间');
});

test('提醒卡的卡头保留总耗时，动作给出「歇一下」', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: Date.now() });
  const tree = env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
  const card = findByClass(tree, 'ig-hud-card');
  assert.ok(card !== null, '应长成提醒卡');
  assert.ok(findByClass(card, 'ig-hud-time') !== null, '卡头保留总耗时');
  const count = findByClass(card, 'ig-hud-count');
  assert.ok(count !== null, '应有倒计时');
  const text = collectText(count);
  assert.ok(text.includes('60s') || text.includes('59s') || text.includes('58s'), `倒计时应从 60s 起，实际 ${text}`);
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

test('点记录卡的遮罩（closeCard）能真正关掉记录卡', () => {
  const env = bootedWithData();
  const handlers = buildHandlers(env);
  assert.equal(typeof handlers.closeCard, 'function', 'closeCard 必须已接线（曾缺失）');

  handlers.openCard();
  assert.equal(env.instance.getSnapshot().ui.cardOpen, true, '前置：记录卡已打开');

  // 点遮罩只关记录卡，不把其它面板/展开态拖进来。
  handlers.closeCard();
  const ui = env.instance.getSnapshot().ui;
  assert.equal(ui.cardOpen, false, 'closeCard 应关掉记录卡（修复「收起又弹回来」）');
  assert.equal(ui.meterOpen, false, '只关卡片，不该顺手展开计时器');
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

/**
 * 直接调用 state.js 的 migrateState。
 *
 * bundle 不导出它（插件只导出 apply），所以这里按与 state.test.mjs 相同的方式
 * 在沙箱里求值源文件 —— 测的是真函数，不是复制品。
 */
function runMigrate(raw, now) {
  if (loadMigrate.migrate === undefined) {
    // 按依赖顺序拼接：migrateState 会调 modelEntriesFromArray（model-log.js），
    // 而 model-log 又用到 timing 的阈值函数。少一个就会在运行时 ReferenceError。
    const sources = ['timing.js', 'session-log.js', 'model-log.js', 'state.js']
      .map((name) => readFileSync(join(ROOT, 'src', 'client', name), 'utf8'))
      .join('\n');
    const sandbox = { console, Date, Math, Number, Object, Array, JSON, Set, Map, String, RegExp };
    const context = createContext(sandbox);
    runInContext(`${sources}\n;globalThis.__migrate = migrateState;`, context);
    loadMigrate.migrate = runInContext('globalThis.__migrate', context);
  }
  return loadMigrate.migrate(raw, now);
}
const loadMigrate = {};


/**
 * 收集一棵元素树里所有带 onClick 的节点（按渲染顺序）。
 *
 * 用途：一次性点遍面板里所有可点元素，把「按钮画了但 handler 引用了不存在的
 * 变量」这类接线错误暴露出来。v19 的「× 点了没反应」就是这种：setOpen 在重写
 * 时被删掉，onClick 里却还在引用它 —— 静态检查查不出，只有真点一下才炸。
 */
function clickables(node, out = [], depth = 0) {
  if (node === null || node === undefined || depth > 40) return out;
  if (Array.isArray(node)) {
    for (const child of node) clickables(child, out, depth + 1);
    return out;
  }
  if (typeof node !== 'object') return out;
  if (typeof node.type === 'function') return clickables(node.type(node.props ?? {}), out, depth + 1);
  if (node.props !== undefined && typeof node.props.onClick === 'function') out.push(node);
  clickables(node.children, out, depth + 1);
  return out;
}

/** 渲染图层并返回元素树。 */
function render(env) {
  return env.layer.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    useSessions: () => undefined,
    immersionGlowActions: env.actions,
  });
}

// ── P0-2：目的备注必须存得下去（v13 修的真 bug）──────────────────────
//
// 原先备注只在点档位按钮时提交，而文本域又是「选了档才出现」—— 自然顺序
// （先选档 → 再写备注）下备注必然丢失；点同一个档位反而清空整条评价。
//
// 文本域是**非受控**的（defaultValue + key），所以断言看 props.defaultValue
// 与事件回调，不看 value。

/** 找到目的备注的文本域。 */
function verdictTextarea(tree) {
  return findByClass(tree, 'ig-textarea');
}

test('先选档再填备注：失焦后备注能存下去', () => {
  const env = bootedWithData();
  env.actions.setCardOpen(true);
  const handlers = buildHandlers(env);

  handlers.setVerdict({ recordId: 'current', verdict: 'yes', note: '' });
  assert.equal(env.instance.getSnapshot().verdicts.current.note, '');

  const area = verdictTextarea(render(env));
  assert.ok(area !== null, '选完档应出现备注文本域');

  // 用户输入后失焦 —— 这是修复的核心路径。
  area.props.onBlur({ target: { value: '返工了两轮' } });
  assert.equal(
    env.instance.getSnapshot().verdicts.current.note,
    '返工了两轮',
    '失焦时必须把备注存下去，而不是留在组件本地',
  );
});

test('备注没改动时失焦不产生多余的 store 写入', () => {
  const env = bootedWithData();
  env.actions.setCardOpen(true);
  buildHandlers(env).setVerdict({ recordId: 'current', verdict: 'yes', note: '原备注' });

  const area = verdictTextarea(render(env));
  assert.equal(typeof area.props.onBlur, 'function', '文本域必须有失焦提交');
  const before = env.instance.getSnapshot().verdicts.current;
  area.props.onBlur({ target: { value: '原备注' } });
  assert.equal(env.instance.getSnapshot().verdicts.current, before, '值未变不应重写');
});

test('回看已有备注的收藏：不输入直接失焦，不能把原备注清空', () => {
  const env = bootedWithData();
  env.actions.saveRecord({
    id: 'r1', createdAt: 1000, activeMs: 120000, activeRuns: 1, turns: 2, toolCalls: 0, taskName: '旧任务',
  });
  env.actions.setVerdict({ recordId: 'r1', verdict: 'partial', note: '当时返工了两次' });
  env.actions.setFocusedRecord('r1');
  env.actions.setCardOpen(true);

  const area = verdictTextarea(render(env));
  assert.ok(area !== null, '回看时应显示目的确认区');
  assert.equal(typeof area.props.onBlur, 'function', '文本域必须有失焦提交');
  assert.equal(area.props.defaultValue, '当时返工了两次', '文本域必须回显已存备注');

  // 用户没改任何东西就离开了
  area.props.onBlur({ target: { value: '当时返工了两次' } });
  assert.equal(
    env.instance.getSnapshot().verdicts.r1.note,
    '当时返工了两次',
    '不能因为草稿没初始化就把原备注冲成空串',
  );
});

test('按 Esc 关闭时也提交备注（blur 不会触发那条路）', () => {
  const env = bootedWithData();
  env.actions.setCardOpen(true);
  buildHandlers(env).setVerdict({ recordId: 'current', verdict: 'yes', note: '' });

  const area = verdictTextarea(render(env));
  assert.equal(typeof area.props.onKeyDown, 'function', '文本域必须有按键处理');
  area.props.onKeyDown({ key: 'Escape', target: { value: 'Esc 之前打的字' } });
  assert.equal(env.instance.getSnapshot().verdicts.current.note, 'Esc 之前打的字');
});

test('非 Escape 按键不触发提交（不能每敲一个字就写盘）', () => {
  const env = bootedWithData();
  env.actions.setCardOpen(true);
  buildHandlers(env).setVerdict({ recordId: 'current', verdict: 'yes', note: '' });

  const area = verdictTextarea(render(env));
  assert.equal(typeof area.props.onKeyDown, 'function', '文本域必须有按键处理');
  const before = env.instance.getSnapshot().verdicts.current;
  area.props.onKeyDown({ key: 'a', target: { value: 'a' } });
  assert.equal(env.instance.getSnapshot().verdicts.current, before, '普通按键不该写 store');
});

test('还没选档时失焦不会凭空造出一条评价', () => {
  const env = bootedWithData();
  env.actions.setCardOpen(true);
  assert.equal(verdictTextarea(render(env)), null, '没选档就不该有文本域');
  assert.deepEqual(Object.keys(env.instance.getSnapshot().verdicts), []);
});

test('文本域回显：切换回看的记录时跟着换', () => {
  const env = bootedWithData();
  env.actions.saveRecord({ id: 'r1', createdAt: 1, activeMs: 60000, activeRuns: 1, turns: 1, toolCalls: 0 });
  env.actions.saveRecord({ id: 'r2', createdAt: 2, activeMs: 60000, activeRuns: 1, turns: 1, toolCalls: 0 });
  env.actions.setVerdict({ recordId: 'r1', verdict: 'yes', note: '第一条' });
  env.actions.setVerdict({ recordId: 'r2', verdict: 'no', note: '第二条' });
  env.actions.setCardOpen(true);

  env.actions.setFocusedRecord('r1');
  const first = verdictTextarea(render(env));
  assert.equal(first.props.defaultValue, '第一条');
  env.actions.setFocusedRecord('r2');
  const second = verdictTextarea(render(env));
  assert.equal(second.props.defaultValue, '第二条');
  // key 必须跟着记录变，否则 React 复用同一个 DOM 节点、defaultValue 不会生效。
  assert.notEqual(first.props.key, second.props.key, 'key 必须绑定记录 id 才能重挂载');
});

// ── P0-3：'current' 评价不能跨会话/跨刷新泄漏（v13 修的真 bug）────────
//
// 'current' 表示「正在看的这一次运行」，却被当成普通 recordId 持久化了。
// 结果：会话 A 评了「没达到」，重启后新会话的记录卡照样显示「没达到」，
// 用户以为自己没评过。

test('持久化恢复时丢弃 current 评价（不跨会话泄漏）', () => {
  const env = bootedWithData();
  env.actions.setVerdict({ recordId: 'current', verdict: 'no', note: '完全跑偏' });
  assert.ok(env.instance.getSnapshot().verdicts.current !== undefined, '前置：内存里确实有');

  // 模拟「重新打开 DSH」：把当前 state 落盘再走一遍迁移。
  const persisted = JSON.parse(JSON.stringify(env.instance.getSnapshot()));
  const migrated = runMigrate(persisted, Date.now());
  assert.equal(migrated.verdicts.current, undefined, '加载时必须丢掉 current');
});

test('真实收藏的评价不受影响（只丢 current，不误伤别的）', () => {
  const env = bootedWithData();
  env.actions.saveRecord({ id: 'r1', createdAt: 1, activeMs: 60000, activeRuns: 1, turns: 1, toolCalls: 0 });
  env.actions.setVerdict({ recordId: 'r1', verdict: 'yes', note: '这条要留住' });
  env.actions.setVerdict({ recordId: 'current', verdict: 'no', note: '这条要丢' });

  const migrated = runMigrate(JSON.parse(JSON.stringify(env.instance.getSnapshot())), Date.now());
  assert.equal(migrated.verdicts.r1.note, '这条要留住', '真实收藏的评价必须保留');
  assert.equal(migrated.verdicts.current, undefined, 'current 必须丢弃');
});

test('切到别的会话时清掉 current 评价', () => {
  const env = bootedWithData();
  env.actions.switchSession({ sessionId: 's1', now: 1000 });
  env.actions.setVerdict({ recordId: 'current', verdict: 'yes', note: '会话 s1 的评价' });
  assert.ok(env.instance.getSnapshot().verdicts.current !== undefined);

  env.actions.switchSession({ sessionId: 's2', now: 2000 });
  assert.equal(
    env.instance.getSnapshot().verdicts.current,
    undefined,
    '换会话后 current 不再属于当前语境，必须清掉',
  );
});

test('同一会话重复认领（探针每次渲染都调）不会清掉评价', () => {
  const env = bootedWithData();
  env.actions.switchSession({ sessionId: 's1', now: 1000 });
  env.actions.setVerdict({ recordId: 'current', verdict: 'yes', note: '别清我' });

  // 模拟探针连续多次幂等认领同一个会话。
  for (let i = 0; i < 5; i += 1) env.actions.switchSession({ sessionId: 's1', now: 1000 + i });
  assert.equal(
    env.instance.getSnapshot().verdicts.current.note,
    '别清我',
    '同 id 的认领不是「换会话」，不能误清',
  );
});

test('收藏后 current 迁到真实 id 并被删除', () => {
  const env = bootedWithData();
  // 走真实的 saveCurrentRecord：它内部要求活跃 ≥ 5 分钟才值得收藏（toRecord 的门槛）。
  env.instance.getSnapshot().sessions.s1.segment.activeMs = 10 * 60000;
  env.actions.setVerdict({ recordId: 'current', verdict: 'partial', note: '基本做完' });
  buildHandlers(env).saveCurrentRecord();

  const snap = env.instance.getSnapshot();
  const saved = snap.collections[0];
  assert.ok(saved !== undefined, '应产生一条收藏');
  assert.equal(snap.verdicts[saved.id].note, '基本做完', '评价应已迁到收藏 id');
  assert.equal(snap.verdicts.current, undefined, 'current 必须删掉，否则下次运行带着旧答案');
});

// ── P1-3：clearModelNotes 必须真的接上线 ─────────────────────────────
//
// 它是 modelNotes 唯一的收敛路径，却长期「有定义、有文档、没人调」—— 于是这张
// 按模型 key 无限增长的持久化表只进不出，持续吃 localStorage 配额。

test('每个有备注的模型都有「清除备注」入口', () => {
  const env = bootedWithData();
  env.actions.addModelNote({ modelKey: 'deepseek/deepseek-chat', rating: 4, note: '稳', recordId: 'r1' });
  env.actions.setSummaryOpen(true);

  const tree = render(env);
  const panel = findByClass(tree, 'ig-panel--wide');
  assert.ok(panel !== null, '应渲染出汇总面板');
  const clear = findByClass(panel, 'ig-summary-clear');
  assert.ok(clear !== null, '有备注的模型必须给一个清除入口，否则表只进不出');
  assert.equal(typeof clear.props.onClick, 'function', '入口必须可点');
});

test('点「清除备注」只清掉那个模型，别的模型不受影响', () => {
  const env = bootedWithData();
  env.actions.addModelNote({ modelKey: 'deepseek/deepseek-chat', rating: 4, note: '稳', recordId: 'r1' });
  env.actions.addModelNote({ modelKey: 'anthropic/claude-opus', rating: 3, note: '一般', recordId: 'r2' });
  env.actions.setSummaryOpen(true);

  const panel = findByClass(render(env), 'ig-panel--wide');
  // 按模型名定位它那一行的清除按钮 —— 排行是按耗时排序的，直接取第一个会
  // 依赖排序结果，脆且不表达意图。
  const clear = clearButtonFor(panel, 'deepseek-chat');
  assert.ok(clear !== null, '应能找到 deepseek-chat 那一行的清除入口');
  clear.props.onClick();

  const notes = env.instance.getSnapshot().modelNotes;
  assert.equal(notes['deepseek/deepseek-chat'], undefined, '被点那个模型的备注应清空');
  assert.ok(notes['anthropic/claude-opus'] !== undefined, '别的模型不受影响');
});

/** 在汇总面板里找到某个模型那一行的「清除备注」按钮。 */
function clearButtonFor(panel, modelName) {
  const rows = findAllByClass(panel, 'ig-summary-row');
  for (const row of rows) {
    if (collectText(row).includes(modelName)) return findByClass(row, 'ig-summary-clear');
  }
  return null;
}

test('没有备注的模型不显示清除入口（不给无意义的按钮）', () => {
  const env = bootedWithData();
  env.actions.setSummaryOpen(true);
  const panel = findByClass(render(env), 'ig-panel--wide');
  assert.ok(panel !== null);
  assert.equal(findByClass(panel, 'ig-summary-clear'), null, '没备注就没什么可清的');
});

// ── 休息回执：数「停」，不数「服从」──────────────────────────────────
//
// 「看到了没点」观测不到，所以回执里不出现「继续」也不出现完成率。
// 这里只验：次数与最长一次记得住、没停过时不渲染。

test('休息回执：countStop 累加次数并保留最长一次', () => {
  const env = boot({});
  env.actions.countStop({ gapMs: 90_000 });
  env.actions.countStop({ gapMs: 7 * 60_000 });
  env.actions.countStop({ gapMs: 60_000 });
  const telemetry = env.instance.getSnapshot().telemetry;
  assert.equal(telemetry.stops, 3);
  assert.equal(telemetry.longestStopMs, 7 * 60_000, '最长一次不该被后来的短停顿覆盖');
});

test('汇总：没停下来过就不出现「休息」这一段', () => {
  const env = bootedWithData();
  env.actions.setSummaryOpen(true);
  const panel = findByClass(render(env), 'ig-panel--wide');
  assert.ok(!collectText(panel).includes('停下来'), '没有可说的就不说，避免变成负罪感计');
});

test('汇总：停下来过就报次数与最长一次（不带「继续」）', () => {
  const env = bootedWithData();
  env.actions.countStop({ gapMs: 90_000 });
  env.actions.countStop({ gapMs: 6 * 60_000 });
  env.actions.setSummaryOpen(true);

  const panel = findByClass(render(env), 'ig-panel--wide');
  const text = collectText(panel);
  assert.ok(text.includes('停下来 2 次'), `应报次数，实际：${text.slice(0, 120)}`);
  assert.ok(text.includes('最长 6 分钟'), '应报最长一次');
  assert.ok(text.includes('不需要按任何按钮'), '应说明「停」与按钮无关');
  assert.ok(!text.includes('继续'), '「继续」是默认行为，不该出现在回执里');
});

test('迁移：旧数据没有 stops / longestStopMs 时补 0', () => {
  const env = boot({});
  const persisted = JSON.parse(JSON.stringify(env.instance.getSnapshot()));
  delete persisted.telemetry.stops;
  delete persisted.telemetry.longestStopMs;
  const migrated = runMigrate(persisted, Date.now());
  assert.equal(migrated.telemetry.stops, 0);
  assert.equal(migrated.telemetry.longestStopMs, 0);
});

// ── 设置页（v20：从通用页搬到设置导航）──────────────────────────────
//
// 宿主契约把两者分得很清楚：general.item 是「一行、单个偏好」，
// settings.section 才是「一整页」。这个插件有 6 项设置 + 3 个数据操作，
// 属于后者 —— 这组测试盯住「页面渲染出来了」和「关闭插件后数据入口还在」。

/** 渲染设置页元素树。 */
function settingsElement(env) {
  assert.ok(env.settings !== undefined, '应注册 settings.section');
  return env.settings.component({
    React: fakeReact(),
    useImmersionGlow: env.selectorHook,
    immersionGlowActions: env.actions,
  });
}

test('设置页：标题、说明与三组行都在', () => {
  const env = boot({});
  const tree = settingsElement(env);
  const text = collectText(tree);
  assert.ok(text.includes('沉浸觉察'), '应有页面标题');
  assert.ok(text.includes('记录与数据'), '应有记录分组');
  assert.ok(text.includes('清除本插件数据'), '应有危险操作');
  assert.equal(findAllByClass(tree, 'ig-settings-row').length, 6, '开启时六行');
});

test('设置页：关闭插件后提醒相关的行消失，记录与清除仍在', () => {
  // 旧版把「记录」也一起藏了 —— 关掉插件就再也进不去画廊。数据管理和
  // 「要不要提醒」是两件事，必须分开。
  const env = boot({});
  env.actions.updateSettings({ enabled: false });
  const tree = settingsElement(env);
  assert.equal(findAllByClass(tree, 'ig-settings-row').length, 3, '只剩启用 / 记录 / 清除');
  const text = collectText(tree);
  assert.ok(!text.includes('触发阈值'), '关闭后不该再显示阈值');
  assert.ok(text.includes('记录与数据'), '记录入口必须仍在');
  assert.ok(text.includes('清除本插件数据'), '清除入口必须仍在');
});

test('设置页：改阈值立即写回 store', () => {
  const env = boot({});
  const tree = settingsElement(env);
  const input = findAllByClass(tree, 'ig-input')[0];
  assert.ok(input !== undefined, '应有阈值输入框');
  input.props.onChange({ target: { value: '15, 30' } });
  // 跨 vm 边界的数组原型不同，deepEqual 会判不等 —— 用 JSON 比内容。
  assert.equal(JSON.stringify(env.instance.getSnapshot().settings.thresholdsMin), '[15,30]');
});

// ── P1-1：暖点的热度与那句话必须来自同一个数 ─────────────────────────
//
// 早先 progressLabel 自己又调了一次 ringProgress（相同输入）—— 同一语义算两遍，
// 分叉时就会出现「暖点快满了但文字说还有 12 分钟」。v11 的「卡在 1 秒」就是同一
// 模式（两处实现，一处漏改）。这组断言保证两者始终一致。

test('常态说的是「下次提醒还有多久」', () => {
  const env = bootedWithData();
  // 设一个能算出确定余量的活跃时长：10 分钟活跃，阈值 5/10/20 → 下一档 20 分，剩 10 分。
  env.instance.getSnapshot().sessions.s1.segment.activeMs = 10 * 60000;
  env.actions.updateSettings({ thresholdsMin: [5, 10, 20] });

  const tree = render(env);
  const hud = findByClass(tree, 'ig-hud');
  const next = findByClass(hud, 'ig-hud-next');
  assert.ok(next !== null, '常态应有第二段文字');
  const text = collectText(next);
  assert.ok(text.includes('后提醒你'), `应报下次提醒，实际：${text}`);
  assert.ok(text.includes('10 分钟'), `剩 10 分钟，实际：${text}`);
});

test('活跃时长增加时剩余时间跟着变小（不是写死的）', () => {
  const env = bootedWithData();
  env.actions.updateSettings({ thresholdsMin: [5, 10, 20] });
  const readAt = (minutes) => {
    env.instance.getSnapshot().sessions.s1.segment.activeMs = minutes * 60000;
    return collectText(findByClass(findByClass(render(env), 'ig-hud'), 'ig-hud-next'));
  };
  const at10 = readAt(10);
  const at15 = readAt(15);
  assert.ok(at10.includes('10 分钟'), `10 分活跃 → 剩 10 分，实际 ${at10}`);
  assert.ok(at15.includes('5 分钟'), `15 分活跃 → 剩 5 分，实际 ${at15}`);
});

// ── 多窗口：storage 事件必须真的把对方分区并进来 ─────────────────────
//
// 这条测的是**接线**：合并规则由 state 单测覆盖，但若 storage 监听没接上
// mergeSessions（或写成旧的「取最大 activeMs 盖到本会话」），单测照样全绿。

test('多窗口：storage 事件合并对方分区，且不串改本会话时长', () => {
  const env = bootedWithData();
  env.actions.writeSession({
    sessionId: 's1',
    segment: { startedAt: 1000, lastActiveAt: 2000, activeMs: 60_000, activeRuns: 1, firedCount: 0 },
    now: 5000,
  });

  const incoming = {
    activeSessionId: 's2',
    sessions: {
      // 对方那份 s1 是旧快照（updatedAt 更小），不该覆盖本地。
      s1: {
        segment: { startedAt: 1000, lastActiveAt: 1000, activeMs: 999_000, activeRuns: 1, firedCount: 0 },
        metrics: null, stats: null, models: [], taskName: null, currentModel: null, busy: false, updatedAt: 1,
      },
      // 本窗口从未见过的会话 s2：必须收下，否则关掉那个窗口就丢了。
      s2: {
        segment: { startedAt: 1000, lastActiveAt: 1000, activeMs: 300_000, activeRuns: 0, firedCount: 0 },
        metrics: null, stats: null, models: [], taskName: null, currentModel: null, busy: false, updatedAt: 9000,
      },
    },
  };

  env.emit('storage', { key: 'immersion-glow.v1', newValue: JSON.stringify(incoming) });

  const snapshot = env.instance.getSnapshot();
  assert.ok(snapshot.sessions.s2 !== undefined, '另一窗口的会话分区应合并进 store');
  assert.equal(snapshot.sessions.s2.segment.activeMs, 300_000);
  assert.equal(snapshot.sessions.s1.segment.activeMs, 60_000, '不能把 s2 的时长串到 s1 头上');
});
