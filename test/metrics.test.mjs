/**
 * 指标推导与时段标签的单元测试。
 *
 * 重点是**防御性**：探针拿到的 ConversationSnapshot 可能字段缺失、被 JSON 化、
 * 甚至整个为 undefined。任何情况都不能抛错 —— 一抛就会顶掉插槽里的组件。
 *
 * 运行： node --test test/metrics.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { loadModule } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');


const METRICS = loadModule('metrics.js');
const TAGS = loadModule('tags.js');

/** 造一份贴近真实的 ConversationSnapshot 骨架（只含本插件读的字段）。 */
function snapshotOf(overrides) {
  const base = {
    sessionId: 'session-abc',
    turnEnds: new Map([
      [1, 10],
      [2, 20],
      [3, 30],
    ]),
    turnTimings: new Map(),
    nodes: [
      { kind: 'user', seq: 1 },
      {
        kind: 'assistant',
        seq: 2,
        blocks: [
          { kind: 'text', text: '...' },
          { kind: 'tool-call', callId: 'c1', name: 'grep', argsRaw: '{}' },
          { kind: 'tool-call', callId: 'c2', name: 'read', argsRaw: '{}' },
        ],
      },
      { kind: 'tool-result', seq: 3, callId: 'c1' },
      { kind: 'tool-result', seq: 4, callId: 'c2' },
    ],
    runningCalls: [],
    hasMore: false,
  };
  return { ...base, ...overrides };
}

// ── 基本推导 ───────────────────────────────────────────────────────────
test('deriveMetrics：轮次取 turnEnds 最大键', () => {
  const result = METRICS.deriveMetrics(snapshotOf());
  assert.equal(result.turns, 3);
  assert.equal(result.sessionId, 'session-abc');
  assert.equal(result.degraded, false);
});

test('deriveMetrics：工具调用合并三个来源并去重', () => {
  // assistant.blocks 给了 c1/c2；tool-result 又报了同样的 c1/c2 —— 不应翻倍。
  const result = METRICS.deriveMetrics(snapshotOf());
  assert.equal(result.toolCalls, 2);
});

test('deriveMetrics：runningCalls 的嵌套 subCalls 递归计入', () => {
  const snapshot = snapshotOf({
    nodes: [],
    turnEnds: new Map(),
    runningCalls: [
      {
        callId: 'p1',
        name: 'task',
        subCalls: [
          { callId: 'sub1', name: 'grep' },
          { callId: 'sub2', name: 'read', subCalls: [{ callId: 'sub3', name: 'glob' }] },
        ],
      },
    ],
  });

  const result = METRICS.deriveMetrics(snapshot);
  assert.equal(result.toolCalls, 4, 'p1 + sub1 + sub2 + sub3');
});

test('deriveMetrics：只有 tool-result 也计入（窗口内 call 头可能已被裁掉）', () => {
  const snapshot = snapshotOf({
    nodes: [
      { kind: 'tool-result', seq: 1, callId: 'orphan-a' },
      { kind: 'tool-result', seq: 2, callId: 'orphan-b' },
    ],
    turnEnds: new Map(),
    runningCalls: [],
  });
  assert.equal(METRICS.deriveMetrics(snapshot).toolCalls, 2);
});

test('deriveMetrics：hasMore 透出为 truncated', () => {
  assert.equal(METRICS.deriveMetrics(snapshotOf({ hasMore: true })).truncated, true);
  assert.equal(METRICS.deriveMetrics(snapshotOf({ hasMore: false })).truncated, false);
  // 已知 bug 的常见形态：hasMore 是 truthy 字符串
  assert.equal(METRICS.deriveMetrics(snapshotOf({ hasMore: 'yes' })).truncated, false);
});

test('deriveMetrics：turnEnds 是普通对象（被 JSON 化）时也能算', () => {
  const snapshot = snapshotOf({ turnEnds: { 1: 10, 2: 20, 5: 50 } });
  assert.equal(METRICS.deriveMetrics(snapshot).turns, 5);
});

test('deriveMetrics：没有已完成轮次时 turns 为 0', () => {
  const snapshot = snapshotOf({ turnEnds: new Map(), nodes: [], runningCalls: [] });
  const result = METRICS.deriveMetrics(snapshot);
  assert.equal(result.turns, 0);
  assert.equal(result.degraded, false, '空会话不是降级');
});

// ── 防御性：任何异常输入都不抛 ─────────────────────────────────────────
test('deriveMetrics：undefined / null 输入返回降级值而非抛错', () => {
  for (const input of [undefined, null, 42, 'x', true]) {
    const result = METRICS.deriveMetrics(input);
    assert.equal(result.degraded, true);
    assert.equal(result.turns, 0);
    assert.equal(result.toolCalls, 0);
    assert.equal(result.sessionId, null);
  }
});

test('deriveMetrics：字段类型全错也不抛', () => {
  const snapshot = {
    sessionId: 12345,
    turnEnds: 'not-a-map',
    nodes: 'not-an-array',
    runningCalls: { length: 1 },
    hasMore: {},
  };
  const result = METRICS.deriveMetrics(snapshot);
  assert.equal(result.degraded, false, '结构畸形但没有抛错，按空值处理');
  assert.equal(result.turns, 0);
  assert.equal(result.toolCalls, 0);
  assert.equal(result.sessionId, null, '非字符串 sessionId 归一为 null');
});

test('deriveMetrics：nodes 里有 null 与奇怪元素不抛', () => {
  const snapshot = snapshotOf({
    nodes: [null, undefined, 42, { kind: 'tool-result' }, { kind: 'assistant', blocks: 'x' }],
  });
  assert.doesNotThrow(() => METRICS.deriveMetrics(snapshot));
});

test('deriveMetrics：subCalls 深到离谱时不死循环（深度上限）', () => {
  let deep = { callId: 'bottom' };
  for (let index = 0; index < 40; index += 1) {
    deep = { callId: `n${index}`, subCalls: [deep] };
  }
  const snapshot = snapshotOf({ nodes: [], turnEnds: new Map(), runningCalls: [deep] });
  const result = METRICS.deriveMetrics(snapshot);
  // 上限 12 层，所以不会把 41 个全数出来，但也不会爆栈。
  assert.ok(result.toolCalls > 0 && result.toolCalls <= 14, `实际 ${result.toolCalls}`);
});

// ── 相等判断 ───────────────────────────────────────────────────────────
test('metricsEqual：逐字段比较，忽略对象身份', () => {
  const a = { sessionId: 's', turns: 1, toolCalls: 2, truncated: false, degraded: false };
  const b = { sessionId: 's', turns: 1, toolCalls: 2, truncated: false, degraded: false };
  assert.equal(METRICS.metricsEqual(a, b), true);

  assert.equal(METRICS.metricsEqual(a, { ...b, turns: 2 }), false);
  assert.equal(METRICS.metricsEqual(a, { ...b, truncated: true }), false);
  assert.equal(METRICS.metricsEqual(a, null), false);
  assert.equal(METRICS.metricsEqual(null, null), true);
});

// ── 时段标签 ───────────────────────────────────────────────────────────
test('timeTagOf：晨间 [5,10)、深夜 [22,24)∪[0,5)', () => {
  const at = (hour) => new Date(2026, 9, 17, hour, 30, 0).getTime();

  assert.equal(TAGS.timeTagOf(at(5)), 'morning');
  assert.equal(TAGS.timeTagOf(at(9)), 'morning');
  assert.equal(TAGS.timeTagOf(at(10)), null, '10 点起不再算晨间');
  assert.equal(TAGS.timeTagOf(at(15)), null, '白天不打时间标签');
  assert.equal(TAGS.timeTagOf(at(21)), null);
  assert.equal(TAGS.timeTagOf(at(22)), 'lateNight');
  assert.equal(TAGS.timeTagOf(at(23)), 'lateNight');
  assert.equal(TAGS.timeTagOf(at(0)), 'lateNight');
  assert.equal(TAGS.timeTagOf(at(4)), 'lateNight');
});

test('lengthTagOf：≥60 分钟长跑，<20 分钟碎片，中间无标签', () => {
  assert.equal(TAGS.lengthTagOf(60 * 60000), 'longRun');
  assert.equal(TAGS.lengthTagOf(120 * 60000), 'longRun');
  assert.equal(TAGS.lengthTagOf(30 * 60000), null);
  assert.equal(TAGS.lengthTagOf(19 * 60000), 'fragment');
  assert.equal(TAGS.lengthTagOf(0), 'fragment');
});

test('tagsOf：最多两枚，时间类在前', () => {
  const morning = new Date(2026, 9, 17, 7, 0, 0).getTime();
  const afternoon = new Date(2026, 9, 17, 15, 0, 0).getTime();

  // 跨 realm 的数组原型不同，用 JSON 比较避免 deepEqual 报原型不一致。
  const tags = (startedAt, activeMs) => JSON.stringify(TAGS.tagsOf(startedAt, activeMs));

  assert.equal(tags(morning, 90 * 60000), JSON.stringify(['morning', 'longRun']));
  assert.equal(tags(morning, 10 * 60000), JSON.stringify(['morning', 'fragment']));
  assert.equal(tags(afternoon, 90 * 60000), JSON.stringify(['longRun']));
  assert.equal(tags(afternoon, 30 * 60000), JSON.stringify([]));
});

// ── 回归：真数据在 chat.legacy，顶层 nodes/turnEnds 是空镜像 ──
test('deriveMetrics：从 chat.legacy 读节点与 turnEnds（0.2.0-rc.2 的真实结构）', () => {
  const snapshot = {
    sessionId: 'session-real',
    // 顶层镜像在真实运行时是空的
    nodes: [],
    turnEnds: new Map(),
    hasMore: false,
    chat: {
      legacy: {
        nodes: [
          {
            kind: 'assistant',
            turn: 3,
            blocks: [
              { kind: 'tool-call', callId: 'call-a', name: 'grep' },
              { kind: 'tool-call', callId: 'call-b', name: 'read' },
            ],
          },
          { kind: 'tool-result', callId: 'call-a' },
        ],
        turnEnds: new Map([[1, 10], [2, 20], [3, 30]]),
        runningCalls: [],
      },
    },
  };

  const result = METRICS.deriveMetrics(snapshot);
  assert.equal(result.turns, 3, '应从 chat.legacy.turnEnds 数出 3 轮');
  assert.equal(result.toolCalls, 2, 'call-a 去重后应是 2 个');
  assert.equal(result.sessionId, 'session-real');
  assert.equal(result.degraded, false);
});

test('deriveMetrics：顶层节点有数据时也能用（兼容旧结构）', () => {
  const snapshot = {
    sessionId: 's',
    nodes: [{ kind: 'tool-result', callId: 'x' }, { kind: 'tool-result', callId: 'y' }],
    turnEnds: new Map([[1, 1], [2, 2]]),
    hasMore: false,
  };
  const result = METRICS.deriveMetrics(snapshot);
  assert.equal(result.turns, 2);
  assert.equal(result.toolCalls, 2);
});

test('deriveMetrics：turnEnds 缺失时用 assistant 节点的 turn 号兜底', () => {
  const snapshot = {
    sessionId: 's',
    nodes: [],
    turnEnds: new Map(),
    chat: {
      legacy: {
        nodes: [
          { kind: 'assistant', turn: 5, blocks: [] },
          { kind: 'assistant', turn: 7, blocks: [] },
        ],
        turnEnds: new Map(),
      },
    },
  };
  assert.equal(METRICS.deriveMetrics(snapshot).turns, 7, '取最大 turn 号');
});

test('deriveMetrics：chat.legacy 里的 runningCalls 也计入', () => {
  const snapshot = {
    sessionId: 's',
    nodes: [],
    turnEnds: new Map(),
    chat: {
      legacy: {
        nodes: [],
        turnEnds: new Map(),
        runningCalls: [{ callId: 'live-1', subCalls: [{ callId: 'live-2' }] }],
      },
    },
    runningCalls: [],
  };
  assert.equal(METRICS.deriveMetrics(snapshot).toolCalls, 2);
});

test('deriveMetrics：chat 存在但 legacy 缺失时不抛错', () => {
  const snapshot = { sessionId: 's', chat: {}, nodes: [], turnEnds: new Map() };
  assert.doesNotThrow(() => METRICS.deriveMetrics(snapshot));
  assert.equal(METRICS.deriveMetrics(snapshot).turns, 0);
});

// ── overrides（第二参）：chat 快照没有 sessionId / hasMore，由探针补给 ──
test('deriveMetrics：overrides 补给 sessionId 与 hasMore（chat 快照路径）', () => {
  const chatSnapshot = {
    order: [],
    nodes: [],
    locations: {},
    navigation: {},
    timeline: {},
    legacy: {
      nodes: [
        { kind: 'user', seq: 1 },
        { kind: 'assistant', seq: 2, turn: 2, blocks: [{ kind: 'tool-call', callId: 'c9' }] },
        { kind: 'tool-result', seq: 3, callId: 'c9' },
      ],
      turnTimings: {},
      turnEnds: { 1: 100, 2: 200 },
      partial: null,
      runningCalls: [],
    },
  };
  const result = METRICS.deriveMetrics(chatSnapshot, { sessionId: 'session-live', hasMore: true });
  assert.equal(result.sessionId, 'session-live', 'sessionId 来自 overrides');
  assert.equal(result.truncated, true, 'hasMore 来自 overrides');
  assert.equal(result.turns, 2);
  assert.equal(result.toolCalls, 1);
  assert.equal(result.degraded, false);
});

test('deriveMetrics：overrides 优先于快照自带的同名字段', () => {
  const snapshot = snapshotOf({ sessionId: 'stale-id', hasMore: true });
  const result = METRICS.deriveMetrics(snapshot, { sessionId: 'fresh-id', hasMore: false });
  assert.equal(result.sessionId, 'fresh-id');
  assert.equal(result.truncated, false);
});

test('deriveMetrics：overrides 垃圾值不抛错，退回快照字段', () => {
  const snapshot = snapshotOf();
  const result = METRICS.deriveMetrics(snapshot, null);
  assert.equal(result.sessionId, 'session-abc');
  assert.equal(METRICS.deriveMetrics(snapshot, 42).sessionId, 'session-abc');
  assert.equal(METRICS.deriveMetrics(snapshot, 'x').turns, 3);
});

// ── isModelBusy：模型是否正在回答 ────────────────────────────────────
test('isModelBusy：runningCalls 非空即视为忙', () => {
  const snapshot = snapshotOf({
    nodes: [],
    turnEnds: new Map(),
    runningCalls: [{ callId: 'live', name: 'task' }],
  });
  assert.equal(METRICS.isModelBusy(snapshot), true);
});

test('isModelBusy：partial 有正在产出的节点即视为忙', () => {
  const snapshot = {
    legacy: { nodes: [], runningCalls: [], partial: { kind: 'assistant', seq: 99 } },
  };
  assert.equal(METRICS.isModelBusy(snapshot), true);
});

test('isModelBusy：双层嵌套的子调用也在忙', () => {
  const snapshot = {
    chat: {
      legacy: {
        runningCalls: [{ callId: 'outer', subCalls: [{ callId: 'inner' }] }],
      },
    },
  };
  assert.equal(METRICS.isModelBusy(snapshot), true);
});

test('isModelBusy：回答结束后不为忙', () => {
  const idle = snapshotOf({ nodes: [], turnEnds: new Map(), runningCalls: [] });
  assert.equal(METRICS.isModelBusy(idle), false, '无 partial、无 runningCalls');
  assert.equal(METRICS.isModelBusy({ legacy: { partial: null, runningCalls: [] } }), false);
});

test('isModelBusy：缺数据/垃圾输入不抛错，按「不在忙」处理', () => {
  assert.equal(METRICS.isModelBusy(null), false);
  assert.equal(METRICS.isModelBusy(undefined), false);
  assert.equal(METRICS.isModelBusy('x'), false);
  assert.equal(METRICS.isModelBusy({}), false);
  assert.doesNotThrow(() => METRICS.isModelBusy({ legacy: null, chat: { legacy: 'bad' } }));
});
