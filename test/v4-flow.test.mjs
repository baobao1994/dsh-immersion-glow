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
import { collectText, fakeReact, fakeStoreModule, findAllByClass, findByClass, makeFakeCtx } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(ROOT, 'tools', 'build-client.mjs')], { stdio: 'ignore' });

const BUNDLE = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));


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

test('圆环中心跟着会话已用时长(activeMs)走，而不是模型耗时', () => {
  // 用户反馈：中心数字之前显示 modelMs，只在模型调用时跳一下，「计时没在走」。
  // 现在改为显示 activeMs（会话已用时长），随 tick 每秒 +1。
  const env = boot({
    chat: chatSnapshot(),
    trajectory: trajectorySnapshot(),
    stats: { turns: 1, steps: 2, llmMs: 6000, toolMs: 0 },
    model: { next: { provider: 'anthropic', model: 'claude-opus' }, lastUsed: null },
  });
  env.runProbe('s1');
  const ringText = () => {
    const t = hudElement(env);
    const ring = findByClass(findByClass(t, 'ig-hud'), 'ig-ring-text');
    return collectText(ring);
  };

  // 初始 activeMs≈0 → 中心显示 0s（不是旧的 0 也被抬成 1 秒）。
  assert.equal(ringText(), '0s', '空态中心显示 0s');

  // 把 activeMs 推进到 5 秒，中心应跟着变 5s —— 证明读数由 activeMs 驱动。
  env.actions.writeSession({
    sessionId: 's1',
    now: Date.now(),
    segment: { startedAt: 900, lastActiveAt: Date.now(), activeMs: 5000, activeRuns: 1, firedCount: 0 },
  });
  assert.equal(ringText(), '5s', 'activeMs 增加后中心读数跟着走');
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

// ⚠ 这条测试的**名字**一直写着「清未读」，但 v6~v11 的断言里只有 meterOpen。
// 于是「提醒永远消不掉」这个真 bug 溜了过去：状态确实清得掉（action 在），
// 只是**没有任何 UI 调用它** —— 而断言只看了面板状态，没看提醒状态。
// 现在把「清未读」真正断言上。
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
  assert.equal(findByClass(after, 'ig-ring--unread'), null, '未读环样式应消失');
  assert.equal(findByClass(after, 'ig-hud-dot'), null, '未读点应消失');
  assert.equal(findByClass(after, 'ig-hud-banner'), null, '提醒条应消失');
});

test('已超时的未读：点开同样能清掉（不只看倒计时那条路）', () => {
  const env = bootedWithData();
  env.actions.showReminder({ message: '该歇了', sticky: true, now: 1_000_000 });
  // 推过 deadline，进入未读态。
  env.instance.getSnapshot().ui.reminder.deadlineAt = 1;
  assert.ok(findByClass(render(env), 'ig-ring--unread') !== null, '前置：应为未读态');

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
  assert.ok(collectText(sub).includes('已用时长'), '副行应说明这个数是会话已用时长');
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

// ── P1-1：环与副行必须来自同一个数 ───────────────────────────────────
//
// 早先 progressLabel 自己又调了一次 ringProgress（相同输入）—— 同一语义算两遍，
// 分叉时就会出现「环快满了但副行说还有 12 分钟」。v11 的「卡在 1 秒」就是同一
// 模式（两处实现，一处漏改）。这组断言保证两者始终一致。

test('常态副行说的是「下次提醒还有多久」，且与环同步', () => {
  const env = bootedWithData();
  // 设一个能算出确定余量的活跃时长：10 分钟活跃，阈值 5/10/20 → 下一档 20 分，剩 10 分。
  env.instance.getSnapshot().sessions.s1.segment.activeMs = 10 * 60000;
  env.actions.updateSettings({ thresholdsMin: [5, 10, 20] });

  const tree = render(env);
  const hud = findByClass(tree, 'ig-hud');
  const sub = findByClass(hud, 'ig-hud-sub-line');
  assert.ok(sub !== null, '常态应有副行');
  const text = collectText(sub);
  assert.ok(text.includes('下次提醒还有'), `副行应报下次提醒，实际：${text}`);
  assert.ok(text.includes('10 分钟'), `剩 10 分钟，实际：${text}`);
});

test('活跃时长翻倍时副行数字跟着变小（不是写死的）', () => {
  const env = bootedWithData();
  env.actions.updateSettings({ thresholdsMin: [5, 10, 20] });
  const readAt = (minutes) => {
    env.instance.getSnapshot().sessions.s1.segment.activeMs = minutes * 60000;
    return collectText(findByClass(findByClass(render(env), 'ig-hud'), 'ig-hud-sub-line'));
  };
  const at10 = readAt(10);
  const at15 = readAt(15);
  assert.ok(at10.includes('10 分钟'), `10 分活跃 → 剩 10 分，实际 ${at10}`);
  assert.ok(at15.includes('5 分钟'), `15 分活跃 → 剩 5 分，实际 ${at15}`);
});
