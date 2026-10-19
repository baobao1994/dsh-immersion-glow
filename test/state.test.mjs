/**
 * 状态层的单元测试。
 *
 * 用假的 defineStore / immer-lite 驱动 actions，验证：
 *   - 初始 state 是干净的新对象（init 是 lambda）；
 *   - 每条 action 只改它该改的字段；
 *   - 画廊 FIFO 截断、删除单条、清空；
 *   - resetAll 真的回到初始态；
 *   - 埋点计数单调递增。
 *
 * 运行： node --test test/state.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 在沙箱中求值 state.js，并把 defineStore 换成记录规格的替身。
 *
 * @returns { createInitialState, createActions, createStoreHandle, DEFAULT_SETTINGS, PERSIST_KEY, GALLERY_LIMIT, captured }
 */
function loadStateModule() {
  const source = readFileSync(join(ROOT, 'src', 'client', 'state.js'), 'utf8');

  /**
   * 捕获最近一次 defineStore 的 spec。
   *
   * 用沙箱里的全局对象承载，而不是闭包变量 —— 沙箱内代码读的是它自己的全局，
   * 闭包变量拿不到。
   */
  const sandbox = {
    console,
    Date,
    Math,
    Number,
    Object,
    Array,
    JSON,
    Set,
    Map,
    __captured: { spec: null },
    // 替身：只记录传入的 spec，便于断言 persist 键与 init 语义。
    defineStore: (spec) => {
      sandbox.__captured.spec = spec;
      return { spec };
    },
  };
  const context = createContext(sandbox);
  runInContext(`${source}\n;globalThis.__names = ${JSON.stringify(
    [...source.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]),
  )};`, context);

  const names = runInContext('globalThis.__names', context);
  const exported = { captured: sandbox.__captured };
  for (const key of names) {
    try {
      exported[key] = runInContext(key, context);
    } catch (_error) {
      // 注释里的名字跳过。
    }
  }
  return exported;
}

const STATE = loadStateModule();

/** 造一个可直接调用 actions 的 draft（真 immer 会代理，这里普通对象足够）。 */
function draftOf(now) {
  return STATE.createInitialState(now ?? 1_700_000_000_000);
}

/**
 * 把 actions 绑定到某个 draft：真 store 会烘焙掉 draft 参数，测试要复刻这一点。
 *
 * 早期版本的测试直接调用 `actions.xxx(draft, payload)`，于是新写的
 * `(draft, payload)` 风格 action 一旦漏传 draft 就会炸 —— 用一个 helper 统一处理。
 *
 * @param draft - 目标状态对象。
 * @returns 只接收业务参数的 action 集合。
 */
function bindActions(draft) {
  const raw = STATE.createActions();
  const bound = {};
  for (const [key, mutate] of Object.entries(raw)) {
    bound[key] = (...args) => mutate(draft, ...args);
  }
  return bound;
}

// ── 初始态 ─────────────────────────────────────────────────────────────
test('createInitialState：默认设置符合 PRD（3min 冻结 / 10min 重置 / 20-40-60）', () => {
  const state = draftOf();
  assert.deepEqual(
    JSON.parse(JSON.stringify(state.settings.thresholdsMin)),
    [20, 40, 60],
  );
  assert.equal(state.settings.idleTimeoutMs, 3 * 60 * 1000);
  assert.equal(state.settings.resetGapMs, 10 * 60 * 1000);
  assert.equal(state.settings.enabled, true);
  // v4：常驻读数默认开，但它同时受「设了阈值」与「发起过」两个条件约束，
  // 所以开箱状态下右上角仍然是干净的。
  assert.equal(state.settings.showCornerMeter, true, '右上角读数默认开');
  assert.equal('showInlineTimer' in state.settings, false, '输入框常驻计时已退役（v4）');
  assert.equal('intensity' in state.settings, false, '强度设置已随光带退役（ADR-123）');
});

test('createInitialState：每次返回互不共享的新对象', () => {
  const a = draftOf();
  const b = draftOf();
  a.collections.push({ id: 'x' });
  a.settings.thresholdsMin.push(999);
  assert.equal(b.collections.length, 0);
  assert.equal(b.settings.thresholdsMin.length, 3, 'thresholds 数组不能共享引用');
});

test('createInitialState：telemetry 与 ui 都是零值', () => {
  const state = draftOf();
  assert.equal(state.telemetry.impressions, 0);
  assert.equal(state.telemetry.opens, 0);
  assert.equal('dismisses' in state.telemetry, false, 'dismiss 随光带退役（ADR-123）');
  assert.equal(state.ui.cardOpen, false);
  assert.equal(state.ui.galleryOpen, false);
  assert.equal(state.ui.reminder, null, '提醒初始为空');
});

// ── defineStore 声明 ───────────────────────────────────────────────────
test('createStoreHandle：persist 键固定、init 是函数、actions 是表', () => {
  // createStoreHandle 接受一个 defineStore 作为参数，所以直接从这里捕获 spec。
  let spec = null;
  STATE.createStoreHandle((received) => {
    spec = received;
    return { spec: received };
  });

  assert.ok(spec !== null, 'createStoreHandle 必须调用传入的 defineStore');
  assert.equal(spec.persist, 'immersion-glow.v1');
  assert.equal(typeof spec.init, 'function', 'init 必须是 lambda（每实例新对象）');
  assert.equal(typeof spec.actions, 'object');
  // init 两次必须不同引用
  assert.notEqual(spec.init(), spec.init());
});

// ── 埋点 ───────────────────────────────────────────────────────────────
test('埋点两个计数器各自递增', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.countImpression(draft);
  actions.countImpression(draft);
  actions.countOpen(draft);

  assert.equal(draft.telemetry.impressions, 2);
  assert.equal(draft.telemetry.opens, 1);
});

// ── 设置 ───────────────────────────────────────────────────────────────
test('updateSettings：部分更新，未提及字段保留', () => {
  const draft = draftOf();
  STATE.createActions().updateSettings(draft, { showInlineTimer: true });
  assert.equal(draft.settings.showInlineTimer, true);
  assert.equal(draft.settings.idleTimeoutMs, 3 * 60 * 1000, '其他字段不受影响');
});

test('updateSettings：阈值数组被整体替换而不是共享引用', () => {
  const draft = draftOf();
  const next = [30];
  STATE.createActions().updateSettings(draft, { thresholdsMin: next });
  assert.equal(draft.settings.thresholdsMin.length, 1);
  assert.equal(draft.settings.thresholdsMin[0], 30);
});

// ── UI 态 ──────────────────────────────────────────────────────────────
test('setCardOpen：只改 cardOpen', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.setCardOpen(draft, true);
  assert.equal(draft.ui.cardOpen, true);

  actions.setCardOpen(draft, false);
  assert.equal(draft.ui.cardOpen, false);
});

// ── 提醒卡（ADR-123）──────────────────────────────────────────────────
test('showReminder：60s 倒计时、seq 自增、缺省非粘性', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  const now = 1_700_000_000_000;

  actions.showReminder(draft, { message: '已收藏', now });
  assert.equal(draft.ui.reminder.message, '已收藏');
  assert.equal(draft.ui.reminder.sticky, false, '缺省是确认类提醒');
  assert.equal(draft.ui.reminder.deadlineAt, now + 60_000, '倒计时 60 秒');
  assert.equal(draft.ui.reminder.seq, 1);

  actions.showReminder(draft, { message: '已收藏', now: now + 1000 });
  assert.ok(draft.ui.reminder.seq > 1, 'seq 必须递增，否则同文案提醒不会重播动画');
});

test('showReminder：sticky 阈值提醒', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  const now = 1_700_000_000_000;

  actions.showReminder(draft, { message: '该看看统计了', sticky: true, now });
  assert.equal(draft.ui.reminder.sticky, true);
  assert.equal(draft.ui.reminder.deadlineAt, now + 60_000);
});

test('showReminder：非 sticky 不得顶掉未读的 sticky 提醒', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  const now = 1_700_000_000_000;

  actions.showReminder(draft, { message: '阈值到了', sticky: true, now });
  actions.showReminder(draft, { message: '已收藏', now: now + 5000 });
  assert.equal(draft.ui.reminder.message, '阈值到了', '确认类提醒不能覆盖阈值提醒');
  assert.equal(draft.ui.reminder.sticky, true);
});

test('showReminder：sticky 可覆盖 sticky；任意可覆盖非 sticky', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  const now = 1_700_000_000_000;

  actions.showReminder(draft, { message: '已收藏', now });
  actions.showReminder(draft, { message: '阈值到了', sticky: true, now: now + 1000 });
  assert.equal(draft.ui.reminder.message, '阈值到了');

  actions.showReminder(draft, { message: '第二轮', sticky: true, now: now + 2000 });
  assert.equal(draft.ui.reminder.message, '第二轮', '新一轮阈值提醒取代旧一轮');
});

test('showReminder：空/非字符串 message 忽略', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.showReminder(draft, { message: '' });
  actions.showReminder(draft, {});
  actions.showReminder(draft, null);
  assert.equal(draft.ui.reminder, null);
});

test('openMeter：清提醒并展开计时器（点开 = 已看）', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.showReminder(draft, { message: 'x', sticky: true });
  actions.openMeter(draft);
  assert.equal(draft.ui.reminder, null, '未读随之清除');
  assert.equal(draft.ui.meterOpen, true, '展开计时器');
  // 它同时保证不会有两个浮层叠着。
  assert.equal(draft.ui.cardOpen, false);
  assert.equal(draft.ui.summaryOpen, false);
});

test('dismissReminder：只清提醒，不开卡', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.showReminder(draft, { message: 'x' });
  actions.dismissReminder(draft);
  assert.equal(draft.ui.reminder, null);
  assert.equal(draft.ui.cardOpen, false);
});

// ── 画廊 ───────────────────────────────────────────────────────────────
test('saveRecord：新的在最前', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.saveRecord(draft, { id: 'a', createdAt: 1, activeMs: 600000 });
  actions.saveRecord(draft, { id: 'b', createdAt: 2, activeMs: 700000 });

  assert.equal(draft.collections.length, 2);
  assert.equal(draft.collections[0].id, 'b', '最新一条在前');
});

test('saveRecord：缺 id 时自动补，避免画廊 key 冲突', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.saveRecord(draft, { createdAt: 123, activeMs: 600000 });
  assert.equal(typeof draft.collections[0].id, 'string');
  assert.ok(draft.collections[0].id.length > 0);
});

test(`saveRecord：超过 ${50} 条丢最旧（FIFO）`, () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  for (let index = 0; index < 55; index += 1) {
    actions.saveRecord(draft, { id: `r${index}`, createdAt: index, activeMs: 600000 });
  }
  assert.equal(draft.collections.length, 50);
  assert.equal(draft.collections[0].id, 'r54', '最新在前');
  assert.equal(draft.collections[49].id, 'r5', '最旧 5 条被丢弃');
});

test('removeRecord：只删指定 id', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.saveRecord(draft, { id: 'a', createdAt: 1, activeMs: 600000 });
  actions.saveRecord(draft, { id: 'b', createdAt: 2, activeMs: 600000 });
  actions.removeRecord(draft, 'a');

  assert.equal(draft.collections.length, 1);
  assert.equal(draft.collections[0].id, 'b');
});

test('removeRecord：删不存在的 id 不报错也不改数据', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.saveRecord(draft, { id: 'a', createdAt: 1, activeMs: 600000 });
  actions.removeRecord(draft, 'nope');
  assert.equal(draft.collections.length, 1);
});

test('clearGallery：清空', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.saveRecord(draft, { id: 'a', createdAt: 1, activeMs: 600000 });
  actions.clearGallery(draft);
  assert.equal(draft.collections.length, 0);
});

// ── 跨日与重置 ─────────────────────────────────────────────────────────
test('rollDay：只重置 today，各会话分区保留', () => {
  const draft = draftOf();
  const actions = STATE.createActions();
  actions.switchSession(draft, { sessionId: 'sess-A', now: 1000 });
  actions.writeSession(draft, {
    sessionId: 'sess-A',
    segment: { startedAt: 1000, lastActiveAt: 2000, activeMs: 12345, activeRuns: 1, firedCount: 0 },
    now: 2000,
  });

  actions.rollDay(draft, 999);

  assert.equal(draft.today.date, 999);
  assert.equal(draft.sessions['sess-A'].segment.activeMs, 12345, '跨零点不应清零任何分区');
});

test('resetAll：回到初始态，且不留旧字段', () => {
  const draft = draftOf();
  const actions = STATE.createActions();

  // 弄脏所有字段
  actions.updateSettings(draft, { thresholdsMin: [1] });
  actions.saveRecord(draft, { id: 'a', createdAt: 1, activeMs: 600000 });
  actions.countImpression(draft);
  actions.countOpen(draft);
  actions.showReminder(draft, { message: 'x', sticky: true });
  actions.switchSession(draft, { sessionId: 'sess-A', now: 500 });
  actions.writeSession(draft, {
    sessionId: 'sess-A',
    segment: { startedAt: 500, lastActiveAt: 500, activeMs: 99, activeRuns: 1, firedCount: 0 },
    now: 500,
  });

  actions.resetAll(draft, 555);

  assert.equal(draft.collections.length, 0);
  assert.equal(draft.telemetry.impressions, 0);
  assert.equal(draft.telemetry.opens, 0);
  assert.equal('intensity' in draft.settings, false, '强度设置已退役');
  assert.deepEqual(JSON.parse(JSON.stringify(draft.settings.thresholdsMin)), [20, 40, 60]);
  assert.equal(draft.ui.reminder, null);
  assert.equal(draft.version, STATE.STATE_VERSION, '重置后应是当前 schema 版本');
  assert.deepEqual(JSON.parse(JSON.stringify(draft.collections)), [], '收藏清空');
  assert.deepEqual(JSON.parse(JSON.stringify(draft.sessions)), {}, '分区表清空（计时数据一并重置）');
  assert.equal(draft.activeSessionId, null, '当前会话指针清空');
});

// ── 回归：ui 里的页面级状态曾随 persist 整体恢复，刷新后凭空出现 ──
test('resetTransient：清掉 reminder / cardOpen 这些页面级状态', () => {
  const draft = draftOf();
  const actions = STATE.createActions();

  // 模拟一次「上一页面生命周期」遗留的状态
  actions.showReminder(draft, { message: 'stale', sticky: true });
  actions.setCardOpen(draft, true);
  actions.setGalleryOpen(draft, true);

  actions.resetTransient(draft);

  assert.equal(draft.ui.reminder, null, '提醒不该跨页面生命周期存活（ADR-123 取舍）');
  assert.equal(draft.ui.cardOpen, false, '刷新后不该凭空弹出记录卡');
  assert.equal(draft.ui.galleryOpen, false);
});

test('resetTransient：不动设置、时段、埋点与画廊', () => {
  const draft = draftOf();
  const actions = STATE.createActions();

  actions.updateSettings(draft, { showInlineTimer: true });
  actions.saveRecord(draft, { id: 'keep-me', createdAt: 1, activeMs: 600000 });
  actions.countImpression(draft);
  actions.switchSession(draft, { sessionId: 'sess-A', now: 1000 });
  actions.writeSession(draft, {
    sessionId: 'sess-A',
    segment: { startedAt: 1000, lastActiveAt: 1000, activeMs: 123456, activeRuns: 1, firedCount: 0 },
    now: 1000,
  });

  actions.resetTransient(draft);

  assert.equal(draft.settings.showInlineTimer, true, '设置应保留');
  assert.equal(draft.collections.length, 1, '画廊应保留');
  assert.equal(draft.collections[0].id, 'keep-me');
  assert.equal(draft.telemetry.impressions, 1, '埋点是真实累计，不该清');
  assert.equal(draft.sessions['sess-A'].segment.activeMs, 123456, '各会话分区应保留');
});

// ── 回归：计时必须按会话分区，开新窗口不能继承上一轮 ──
test('switchSession：新会话拿到零值分区，不继承别的会话时长', () => {
  const draft = draftOf();
  const actions = bindActions(draft);

  actions.switchSession({ sessionId: 'sess-A', now: 1000 });
  actions.writeSession({
    sessionId: 'sess-A',
    segment: { startedAt: 1000, lastActiveAt: 2000, activeMs: 900000, activeRuns: 2, firedCount: 1 },
    now: 2000,
  });

  // 切到另一个会话
  actions.switchSession({ sessionId: 'sess-B', now: 3000 });

  assert.equal(draft.activeSessionId, 'sess-B');
  assert.equal(draft.sessions['sess-B'].segment.activeMs, 0, '新会话必须从 0 开始');
  assert.equal(draft.sessions['sess-A'].segment.activeMs, 900000, '旧会话数据仍保留');
});

test('switchSession：切回原会话能恢复原时长', () => {
  const draft = draftOf();
  const actions = bindActions(draft);
  actions.switchSession({ sessionId: 'A', now: 1 });
  actions.writeSession({
    sessionId: 'A',
    segment: { startedAt: 1, lastActiveAt: 2, activeMs: 123456, activeRuns: 1, firedCount: 0 },
    now: 2,
  });
  actions.switchSession({ sessionId: 'B', now: 3 });
  actions.switchSession({ sessionId: 'A', now: 4 });

  assert.equal(draft.activeSessionId, 'A');
  assert.equal(draft.sessions['A'].segment.activeMs, 123456, '切回来应恢复');
});

test('writeSession：分区不存在时自建，绝不借用别的会话', () => {
  const draft = draftOf();
  const actions = bindActions(draft);
  actions.switchSession({ sessionId: 'A', now: 1 });
  actions.writeSession({
    sessionId: 'A',
    segment: { startedAt: 1, lastActiveAt: 1, activeMs: 500000, activeRuns: 0, firedCount: 0 },
    now: 1,
  });

  // 直接给一个还没见过的会话写指标（探针可能先于 sync 到达）
  actions.writeSession({
    sessionId: 'C',
    metrics: { sessionId: 'C', turns: 4, toolCalls: 8, truncated: false, degraded: false },
    now: 2,
  });

  assert.equal(draft.sessions['C'].segment.activeMs, 0, '新建分区从 0 开始');
  assert.equal(draft.sessions['C'].metrics.turns, 4);
  assert.equal(draft.sessions['A'].segment.activeMs, 500000, '另一个会话不受影响');
});

test('switchSession：分区数量有上限，当前会话永不被淘汰', () => {
  const draft = draftOf();
  const actions = bindActions(draft);
  for (let i = 0; i < 30; i += 1) {
    actions.switchSession({ sessionId: `s${i}`, now: 1000 + i });
  }
  const ids = Object.keys(draft.sessions);
  assert.ok(ids.length <= 20, `分区数应 ≤ 20，实际 ${ids.length}`);
  assert.ok(ids.includes('s29'), '当前会话必须保留');
  assert.ok(!ids.includes('s0'), '最久未更新的应被淘汰');
});

test('switchSession：null 只清指针，不建分区', () => {
  const draft = draftOf();
  const actions = bindActions(draft);
  actions.switchSession({ sessionId: null, now: 1 });
  assert.equal(draft.activeSessionId, null);
  assert.equal(Object.keys(draft.sessions).length, 0);
});

test('switchSession：切到不同会话会清掉上一个会话的提醒', () => {
  const draft = draftOf();
  const actions = bindActions(draft);
  actions.switchSession({ sessionId: 'sess-A', now: 1000 });
  actions.showReminder({ message: '该歇了', sticky: true, now: 2000 });
  assert.ok(draft.ui.reminder !== null, '前置：会话 A 有一条提醒');

  // 切到新会话：旧提醒不该跟着走进新会话语境（否则变成关不掉的旧倒计时）。
  actions.switchSession({ sessionId: 'sess-B', now: 3000 });
  assert.equal(draft.ui.reminder, null, '切会话应清掉旧会话的提醒');
});

test('switchSession：同一会话幂等认领不清提醒', () => {
  const draft = draftOf();
  const actions = bindActions(draft);
  actions.switchSession({ sessionId: 'sess-A', now: 1000 });
  actions.showReminder({ message: '该歇了', sticky: true, now: 2000 });

  actions.switchSession({ sessionId: 'sess-A', now: 2005 });
  assert.ok(draft.ui.reminder !== null, '同 id 认领（探针每帧都做）不该把提醒清掉');
});

test('emptyBucket 默认 busy=false，writeSession 可写入 busy', () => {
  const draft = draftOf();
  const actions = bindActions(draft);
  actions.switchSession({ sessionId: 's', now: 1 });
  assert.equal(draft.sessions.s.busy, false, '新分区默认为不在忙');

  actions.writeSession({ sessionId: 's', busy: true, now: 2 });
  assert.equal(draft.sessions.s.busy, true, 'busy 可写为 true');
  actions.writeSession({ sessionId: 's', busy: false, now: 3 });
  assert.equal(draft.sessions.s.busy, false, 'busy 可写回 false');
});
