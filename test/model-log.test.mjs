/**
 * 逐模型耗时推导与任务名提炼的单元测试。
 *
 * 重点是**归属正确性**与**防御性**：
 *   - 有精确路由（trajectory providerMetadata）时，耗时必须归到对的模型上；
 *   - 没有精确路由时退回当前模型，且 `exact` 为 false（UI 据此说明是近似）；
 *   - 既没有精确路由也没有当前模型时，那次调用不计入任何模型；
 *   - 任何畸形输入都不能抛错 —— 抛错会顶掉输入框插槽。
 *
 * 运行： node --test test/model-log.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 在沙箱中求值若干客户端源码文件（按给定顺序内联，共享一个闭包）。
 *
 * src/client/*.js 是「为内联构建而写的普通 JS」，没有 export —— 与真实的
 * tools/build-client.mjs 完全同构，所以这里能真实测出「跨模块引用」的问题。
 *
 * @param names - src/client 下的文件名，按依赖顺序。
 * @returns 全部顶层声明的合并表。
 */
function loadModules(names) {
  const sources = names
    .map((name) => readFileSync(join(ROOT, 'src', 'client', name), 'utf8'))
    .join('\n');
  const declared = [
    ...sources.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm),
  ].map((m) => m[1]);

  const sandbox = { console, Date, Math, Number, Object, Array, JSON, Set, Map, String, RegExp };
  const context = createContext(sandbox);
  runInContext(`${sources}\n;globalThis.__names = ${JSON.stringify(declared)};`, context);
  const namesOut = runInContext('globalThis.__names', context);

  const exported = {};
  for (const key of namesOut) {
    try {
      exported[key] = runInContext(key, context);
    } catch (_error) {
      // 注释里出现的名字取不到，跳过。
    }
  }
  return exported;
}

// model-log.js 依赖 tags.js 之外没有别的模块；session-log.js 同理。
const { deriveModelEntries, modelEntriesFromArray, modelEntriesToArray, mergeModelEntries, isTaskStarted } =
  loadModules(['session-log.js', 'model-log.js']);
const { firstTaskName, normalizeSessionStats, normalizeModelSelection, normalizeTokenUsage, modelLabel } =
  loadModules(['session-log.js']);

/** 造一个带 timing 的 assistant 节点。 */
function assistantNode({ seq, turn = 1, messageId, start, end, time }) {
  return {
    kind: 'assistant',
    seq,
    turn,
    messageId,
    time: time ?? end,
    timing: { stepStartTime: start, firstTokenTime: null, completedTime: end },
  };
}

// ── 精确归属 ─────────────────────────────────────────────────────────

test('有 trajectory 路由时，耗时归到正确的模型', () => {
  const nodes = [
    assistantNode({ seq: 10, messageId: 'm1', turn: 1, start: 1000, end: 3000 }),
    assistantNode({ seq: 20, messageId: 'm2', turn: 1, start: 5000, end: 9000 }),
  ];
  const trajectory = {
    requests: [
      { resultSeq: 10, providerMetadata: { provider: 'deepseek', model: 'deepseek-chat' } },
      { resultSeq: 20, providerMetadata: { provider: 'anthropic', model: 'claude-opus' } },
    ],
  };

  const result = deriveModelEntries({ nodes, trajectory, currentModel: null });

  assert.equal(result.exact, true, '有 trajectory 时应标记为精确归属');
  assert.equal(result.entries.length, 2);

  const byKey = Object.fromEntries(result.entries.map((e) => [e.key, e]));
  assert.equal(byKey['deepseek/deepseek-chat'].modelMs, 2000, '第一次调用 3000-1000');
  assert.equal(byKey['anthropic/claude-opus'].modelMs, 4000, '第二次调用 9000-5000');
});

test('按 modelId 匹配 trajectory 也能归属', () => {
  const nodes = [assistantNode({ seq: 10, messageId: 'm1', start: 0, end: 2500 })];
  const trajectory = {
    eventNodes: [{ messageId: 'm1', providerMetadata: { provider: 'openai', model: 'gpt-x' } }],
  };
  const result = deriveModelEntries({ nodes, trajectory, currentModel: null });
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].key, 'openai/gpt-x');
  assert.equal(result.entries[0].modelMs, 2500);
});

test('同一轮多步只计一次轮次，但每步都计耗时', () => {
  const nodes = [
    assistantNode({ seq: 10, messageId: 'm1', turn: 1, start: 0, end: 1000 }),
    assistantNode({ seq: 20, messageId: 'm2', turn: 1, start: 1000, end: 2500 }),
    assistantNode({ seq: 30, messageId: 'm3', turn: 2, start: 2500, end: 3000 }),
  ];
  const trajectory = {
    requests: [
      { resultSeq: 10, providerMetadata: { provider: 'p', model: 'a' } },
      { resultSeq: 20, providerMetadata: { provider: 'p', model: 'a' } },
      { resultSeq: 30, providerMetadata: { provider: 'p', model: 'a' } },
    ],
  };
  const result = deriveModelEntries({ nodes, trajectory, currentModel: null });
  assert.equal(result.entries[0].steps, 3, '三次调用都算 step');
  assert.equal(result.entries[0].turns, 2, '两轮只计两次');
  assert.equal(result.entries[0].modelMs, 3000);
});

// ── 退回近似 ─────────────────────────────────────────────────────────

test('无 trajectory 时退回当前模型，且 exact 为 false', () => {
  const nodes = [assistantNode({ seq: 10, messageId: 'm1', start: 0, end: 4000 })];
  const currentModel = { provider: 'deepseek', model: 'deepseek-chat', key: 'deepseek/deepseek-chat' };

  const result = deriveModelEntries({ nodes, trajectory: null, currentModel });

  assert.equal(result.exact, false, '没有精确路由时必须标记为近似');
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].modelMs, 4000);
});

test('既无路由也无当前模型时，这次调用不计入任何模型', () => {
  const nodes = [assistantNode({ seq: 10, messageId: 'm1', start: 0, end: 4000 })];
  const result = deriveModelEntries({ nodes, trajectory: null, currentModel: null });
  assert.equal(result.entries.length, 0, '凭空归到「未知」桶会污染排行');
});

test('精确与近似可以共存，exact 仍为 true', () => {
  const nodes = [
    assistantNode({ seq: 10, messageId: 'm1', start: 0, end: 1000 }),
    assistantNode({ seq: 20, messageId: 'm2', start: 1000, end: 2000 }),
  ];
  const trajectory = {
    requests: [{ resultSeq: 10, providerMetadata: { provider: 'a', model: 'x' } }],
  };
  const currentModel = { provider: 'b', model: 'y', key: 'b/y' };
  const result = deriveModelEntries({ nodes, trajectory, currentModel });

  assert.equal(result.exact, true);
  const byKey = Object.fromEntries(result.entries.map((e) => [e.key, e]));
  assert.equal(byKey['a/x'].modelMs, 1000, '有路由的精确归属');
  assert.equal(byKey['b/y'].modelMs, 1000, '没路由的退回当前模型');
});

// ── 排序与持久化往返 ─────────────────────────────────────────────────

test('条目按耗时降序', () => {
  const nodes = [
    assistantNode({ seq: 10, messageId: 'm1', start: 0, end: 1000 }),
    assistantNode({ seq: 20, messageId: 'm2', start: 0, end: 5000 }),
  ];
  const trajectory = {
    requests: [
      { resultSeq: 10, providerMetadata: { provider: 'p', model: 'slow' } },
      { resultSeq: 20, providerMetadata: { provider: 'p', model: 'fast' } },
    ],
  };
  const result = deriveModelEntries({ nodes, trajectory, currentModel: null });
  assert.equal(result.entries[0].key, 'p/fast');
  assert.equal(result.entries[1].key, 'p/slow');
});

test('持久化往返：形状不变', () => {
  const original = [
    { key: 'a/b', provider: 'a', model: 'b', modelMs: 100, steps: 2, turns: 1, lastUsedAt: 5 },
  ];
  const round = modelEntriesFromArray(modelEntriesToArray(original));
  // 逐字段比：沙箱里的对象原型是另一个 realm，deepEqual 会因原型不同而误报。
  assert.equal(round.length, 1);
  for (const key of ['key', 'provider', 'model', 'modelMs', 'steps', 'turns', 'lastUsedAt']) {
    assert.equal(round[0][key], original[0][key], `字段 ${key} 往返后必须一致`);
  }
});

test('持久化校验丢弃形状不对的行，而不是原样放行', () => {
  const dirty = [
    { key: 'a/b', provider: 'a', model: 'b', modelMs: 100, steps: 1, turns: 1, lastUsedAt: 0 },
    { key: 'x', provider: 'x' },              // 缺 model
    null,
    'garbage',
    { provider: 'q', model: 'r' },           // 缺 key
  ];
  const clean = modelEntriesFromArray(dirty);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].key, 'a/b');
});

test('合并两份条目：同模型相加，按耗时降序', () => {
  const merged = mergeModelEntries([
    [{ key: 'p/a', provider: 'p', model: 'a', modelMs: 100, steps: 1, turns: 1, lastUsedAt: 1 }],
    [
      { key: 'p/b', provider: 'p', model: 'b', modelMs: 900, steps: 3, turns: 2, lastUsedAt: 9 },
      { key: 'p/a', provider: 'p', model: 'a', modelMs: 50, steps: 1, turns: 1, lastUsedAt: 2 },
    ],
  ]);
  assert.equal(merged[0].key, 'p/b');
  assert.equal(merged[1].key, 'p/a');
  assert.equal(merged[1].modelMs, 150, '同模型跨会话相加');
  assert.equal(merged[1].steps, 2);
});

// ── 「发起过才计时」判据 ────────────────────────────────────────────

test('isTaskStarted：没有任何痕迹时为假', () => {
  assert.equal(isTaskStarted(null), false);
  assert.equal(isTaskStarted({}), false);
  assert.equal(isTaskStarted({ models: [], stats: null, currentModel: null }), false);
  assert.equal(isTaskStarted({ models: [], stats: { turns: 0, steps: 0, llmMs: 0 }, currentModel: null }), false);
});

test('isTaskStarted：任一痕迹为真', () => {
  assert.equal(isTaskStarted({ currentModel: { provider: 'a', model: 'b' } }), true);
  assert.equal(isTaskStarted({ models: [{ key: 'a/b' }] }), true);
  assert.equal(isTaskStarted({ stats: { steps: 1 } }), true);
  assert.equal(isTaskStarted({ stats: { turns: 1 } }), true);
  assert.equal(isTaskStarted({ stats: { llmMs: 10 } }), true);
});

// ── 时长口径 ─────────────────────────────────────────────────────────

test('被中断的步骤（无 completedTime）不计耗时', () => {
  const nodes = [
    { kind: 'assistant', seq: 10, turn: 1, messageId: 'm1', time: 1000, timing: { stepStartTime: 500 } },
  ];
  const trajectory = { requests: [{ resultSeq: 10, providerMetadata: { provider: 'p', model: 'm' } }] };
  const result = deriveModelEntries({ nodes, trajectory, currentModel: null });
  assert.equal(result.entries[0].modelMs, 0, '缺 completedTime 时宁可不算');
  assert.equal(result.entries[0].steps, 1, '但仍记为一次调用');
});

test('completedTime 早于 stepStartTime 时取 0 而非负数', () => {
  const nodes = [assistantNode({ seq: 10, messageId: 'm1', start: 5000, end: 1000 })];
  const trajectory = { requests: [{ resultSeq: 10, providerMetadata: { provider: 'p', model: 'm' } }] };
  const result = deriveModelEntries({ nodes, trajectory, currentModel: null });
  assert.equal(result.entries[0].modelMs, 0);
});

// ── 防御性：畸形输入一律不抛 ─────────────────────────────────────────

test('畸形输入不抛错', () => {
  const inputs = [
    null,
    undefined,
    {},
    { nodes: null, trajectory: null, currentModel: null },
    { nodes: 'garbage', trajectory: 42, currentModel: 'nope' },
    { nodes: [null, 'x', 3, {}], trajectory: { requests: 'no' }, currentModel: { provider: '', model: '' } },
    { nodes: [assistantNode({ seq: 1, messageId: 'm', start: 0, end: 1 })], trajectory: { requests: [null, 5, {}] } },
  ];
  for (const input of inputs) {
    assert.doesNotThrow(() => deriveModelEntries(input), `抛错会顶掉插槽：${JSON.stringify(input)}`);
  }
});

test('trajectory 里 provider/model 为空的记录被忽略', () => {
  const nodes = [assistantNode({ seq: 10, messageId: 'm1', start: 0, end: 100 })];
  const trajectory = {
    requests: [
      { resultSeq: 10, providerMetadata: { provider: '', model: 'x' } },
      { resultSeq: 10, providerMetadata: { provider: 'p', model: '' } },
      { resultSeq: 10, providerMetadata: null },
    ],
  };
  const result = deriveModelEntries({ nodes, trajectory, currentModel: null });
  assert.equal(result.exact, false, '全是空 provider/model 不算精确');
  assert.equal(result.entries.length, 0);
});

// ── 任务名提炼 ───────────────────────────────────────────────────────

test('firstTaskName 取最早的一条 user 节点', () => {
  const nodes = [
    { kind: 'user', time: 5000, content: [{ type: 'text', text: '第二条' }] },
    { kind: 'user', time: 1000, content: [{ type: 'text', text: '第一条任务' }] },
  ];
  assert.equal(firstTaskName(nodes), '第一条任务');
});

test('firstTaskName 折叠空白并截断到 60 字', () => {
  const long = 'x'.repeat(200);
  const name = firstTaskName([{ kind: 'user', time: 0, content: [{ type: 'text', text: `  ${long}\n\t换行  ` }] }]);
  assert.equal(name.length, 60);
  assert.ok(name.endsWith('…'), '超长应加省略号');
});

test('firstTaskName：没有 user 节点时退回其他输入类节点', () => {
  const nodes = [{ kind: 'steering', time: 0, content: [{ type: 'text', text: '插一句' }] }];
  assert.equal(firstTaskName(nodes), '插一句');
});

test('firstTaskName：只取 text part，忽略图片等其它 part', () => {
  const nodes = [
    {
      kind: 'user',
      time: 0,
      content: [
        { type: 'image', mediaType: 'image/png', data: 'xx' },
        { type: 'text', text: '看这张图' },
      ],
    },
  ];
  assert.equal(firstTaskName(nodes), '看这张图');
});

test('firstTaskName：取不到返回 null（调用方走兜底，不编）', () => {
  assert.equal(firstTaskName([]), null);
  assert.equal(firstTaskName(null), null);
  assert.equal(firstTaskName([{ kind: 'assistant', time: 0, content: [{ type: 'text', text: '模型输出' }] }]), null);
  assert.equal(firstTaskName([{ kind: 'user', time: 0, content: [{ type: 'text', text: '   ' }] }]), null);
});

// ── 投影归一化 ───────────────────────────────────────────────────────

test('normalizeSessionStats：字符串数字也接受，缺失按 0', () => {
  const stats = normalizeSessionStats({ turns: '3', steps: 2, llmMs: 'abc', toolMs: 100 });
  assert.equal(stats.turns, 3);
  assert.equal(stats.llmMs, 0);
  assert.equal(stats.available, true);
});

test('normalizeSessionStats：全零 / 空对象标记为不可用', () => {
  assert.equal(normalizeSessionStats(null).available, false);
  assert.equal(normalizeSessionStats({}).available, false);
  assert.equal(normalizeSessionStats({ turns: 0, steps: 0, llmMs: 0, toolMs: 0 }).available, false);
});

test('normalizeModelSelection：优先 next，退回 lastUsed', () => {
  assert.equal(normalizeModelSelection({ next: { provider: 'a', model: 'n' }, lastUsed: { provider: 'b', model: 'l' } }).key, 'a/n');
  assert.equal(normalizeModelSelection({ lastUsed: { provider: 'b', model: 'l' } }).key, 'b/l');
  assert.equal(normalizeModelSelection({ next: null, lastUsed: null }), null);
  assert.equal(normalizeModelSelection({ next: { provider: '', model: 'x' } }), null);
});

test('normalizeTokenUsage：total 是四项之和', () => {
  const usage = normalizeTokenUsage({ uncachedInputTokens: 10, outputTokens: 20, cacheReadTokens: 5, cacheWriteTokens: 1 });
  assert.equal(usage.total, 36);
});

test('modelLabel：provider 与 model 同名时不重复显示', () => {
  assert.equal(modelLabel({ provider: 'deepseek', model: 'deepseek' }), 'deepseek');
  assert.equal(modelLabel({ provider: 'deepseek', model: 'deepseek/deepseek-chat' }), 'deepseek-chat');
  assert.equal(modelLabel({ provider: 'anthropic', model: 'claude-opus' }), 'claude-opus');
  assert.equal(modelLabel(null), '');
});