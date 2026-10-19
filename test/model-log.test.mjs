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

// ⚠ 此断言在 v4 修「换模型背旧账」时**有意改严**：exact 现在要求每条都有精确
// 归属，混入任何一条近似就为 false。理由：声称精确而实际含猜测，比明说近似更糟。
test('精确与近似共存时 exact 为 false（v4 起从严）', () => {
  const nodes = [
    assistantNode({ seq: 10, messageId: 'm1', start: 0, end: 1000 }),
    assistantNode({ seq: 20, messageId: 'm2', start: 1000, end: 2000 }),
  ];
  const trajectory = {
    requests: [{ resultSeq: 10, providerMetadata: { provider: 'a', model: 'x' } }],
  };
  const currentModel = { provider: 'b', model: 'y', key: 'b/y' };
  const result = deriveModelEntries({ nodes, trajectory, currentModel });

  assert.equal(result.exact, false, '有一条是近似的，整份就不能自称精确');
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
// ── 归属记忆：换模型后旧账不会被重新归给新模型（v4 修的真实 bug）──
//
// 现象：先用 deepseek-chat 跑了 3 分钟，中途切到 claude-opus。之后每次全量重算时
// 早先那 3 分钟因无轨迹可查，会被当前模型（claude-opus）重新认领 —— 用户看到
// 「一换模型新模型就背上旧账」，且随重算次数越来越离谱。

test('无记忆时：所有节点都归给当前模型', () => {
  const nodes = [
    assistantNode({ seq: 10, messageId: 'm1', turn: 1, start: 0, end: 1000 }),
    assistantNode({ seq: 20, messageId: 'm2', turn: 2, start: 1000, end: 2000 }),
  ];
  const first = deriveModelEntries({
    nodes,
    trajectory: null,
    currentModel: { provider: 'deepseek', model: 'chat', key: 'deepseek/chat' },
    remembered: null,
  });
  assert.equal(first.entries.length, 1);
  assert.equal(first.entries[0].modelMs, 2000);
  assert.equal(Object.keys(first.memory).length, 2, '两个节点都应被记住');
});

test('换模型后重算：旧节点仍归旧模型，不被新模型认领', () => {
  const nodes = [
    assistantNode({ seq: 10, messageId: 'm1', turn: 1, start: 0, end: 3000 }),
    assistantNode({ seq: 20, messageId: 'm2', turn: 2, start: 3000, end: 4000 }),
  ];

  // 第一次渲染：只有 deepseek/chat 在用，两条都归它。
  const first = deriveModelEntries({
    nodes,
    trajectory: null,
    currentModel: { provider: 'deepseek', model: 'chat', key: 'deepseek/chat' },
    remembered: null,
  });
  assert.equal(first.entries[0].key, 'deepseek/chat');
  assert.equal(first.entries[0].modelMs, 4000);

  // 用户切到 claude-opus，新增一条调用。现在 currentModel 变了。
  const nodesAfter = [
    ...nodes,
    assistantNode({ seq: 30, messageId: 'm3', turn: 3, start: 4000, end: 6000 }),
  ];
  const second = deriveModelEntries({
    nodes: nodesAfter,
    trajectory: null,
    currentModel: { provider: 'anthropic', model: 'opus', key: 'anthropic/opus' },
    remembered: first.memory,
  });

  const byKey = Object.fromEntries(second.entries.map((e) => [e.key, e]));
  assert.equal(byKey['deepseek/chat'].modelMs, 4000, '旧的 4 秒必须留在 deepseek 名下');
  assert.equal(byKey['anthropic/opus'].modelMs, 2000, '新模型只拿它自己那 2 秒');
  assert.ok(second.entries.length === 2, '应有两个模型各一行');
});

test('记忆优先于 trajectory：已判定的事实不被后来的数据改写', () => {
  const nodes = [assistantNode({ seq: 10, messageId: 'm1', turn: 1, start: 0, end: 1000 })];
  const first = deriveModelEntries({
    nodes,
    trajectory: null,
    currentModel: { provider: 'p', model: 'a', key: 'p/a' },
    remembered: null,
  });
  // 之后 trajectory 突然给出了不同的路由 —— 记忆仍应生效（它记录的是当时的事实）。
  const second = deriveModelEntries({
    nodes,
    trajectory: { requests: [{ resultSeq: 10, providerMetadata: { provider: 'p', model: 'b' } }] },
    currentModel: { provider: 'p', model: 'b', key: 'p/b' },
    remembered: first.memory,
  });
  assert.equal(second.entries[0].key, 'p/a', '记忆冻结归属');
  assert.equal(second.entries[0].modelMs, 1000);
});

test('新出现的节点仍用当次 currentModel，记忆不阻塞增量', () => {
  const nodes = [assistantNode({ seq: 10, messageId: 'm1', turn: 1, start: 0, end: 1000 })];
  const first = deriveModelEntries({
    nodes,
    trajectory: null,
    currentModel: { provider: 'p', model: 'a', key: 'p/a' },
    remembered: null,
  });
  const second = deriveModelEntries({
    nodes: [...nodes, assistantNode({ seq: 20, messageId: 'm2', turn: 2, start: 1000, end: 2000 })],
    trajectory: null,
    currentModel: { provider: 'p', model: 'b', key: 'p/b' },
    remembered: first.memory,
  });
  const byKey = Object.fromEntries(second.entries.map((e) => [e.key, e]));
  assert.equal(byKey['p/a'].modelMs, 1000);
  assert.equal(byKey['p/b'].modelMs, 1000, '新节点用新的当前模型');
});

test('exact 只在每条都有精确归属时为真（混进近似就是近似）', () => {
  const nodes = [
    assistantNode({ seq: 10, messageId: 'm1', turn: 1, start: 0, end: 1000 }),
    assistantNode({ seq: 20, messageId: 'm2', turn: 2, start: 1000, end: 2000 }),
  ];
  // 只有 m1 有轨迹，m2 只能近似 —— 此时整份不能自称精确。
  const mixed = deriveModelEntries({
    nodes,
    trajectory: { requests: [{ resultSeq: 10, providerMetadata: { provider: 'p', model: 'a' } }] },
    currentModel: { provider: 'q', model: 'z', key: 'q/z' },
    remembered: null,
  });
  assert.equal(mixed.exact, false, '混入近似就不能说精确');
  // 全都有轨迹时才是精确。
  const all = deriveModelEntries({
    nodes,
    trajectory: {
      requests: [
        { resultSeq: 10, providerMetadata: { provider: 'p', model: 'a' } },
        { resultSeq: 20, providerMetadata: { provider: 'p', model: 'a' } },
      ],
    },
    currentModel: null,
    remembered: null,
  });
  assert.equal(all.exact, true);
});

test('无 messageId 无 seq 的节点无法记忆，只能当次近似', () => {
  const node = { kind: 'assistant', turn: 1, time: 100, timing: { stepStartTime: 0, completedTime: 500 } };
  const first = deriveModelEntries({
    nodes: [node],
    trajectory: null,
    currentModel: { provider: 'p', model: 'a', key: 'p/a' },
    remembered: null,
  });
  assert.deepEqual(Object.keys(first.memory), [], '无稳定标识就不记忆');
  assert.equal(first.entries[0].modelMs, 500);
});

// ── 圆环进度（v5）───────────────────────────────────────────────────

test('ringProgress：未达第一档时从 0 起算', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  const p = ringProgress({ elapsedMs: 5 * 60000, thresholdsMin: [20, 40, 60], modelMs: 0 });
  assert.equal(p.ratio, 0.25, '5 分钟 / 20 分钟 = 0.25');
  assert.equal(p.nextAtMs, 20 * 60000);
});

test('ringProgress：越过一档后重新蓄到下一档', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  const p = ringProgress({ elapsedMs: 25 * 60000, thresholdsMin: [20, 40, 60], modelMs: 0 });
  // 25 分钟：越过 20 那档，在 20→40 这一段里走了 5/20。
  assert.equal(p.ratio, 0.25, '25 分钟落在 20→40 的四分之一处');
  assert.equal(p.nextAtMs, 40 * 60000);
});

test('ringProgress：ratio 恒小于 1（环满即提醒，不越界）', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  for (const elapsed of [0, 20, 39, 61, 600, 100000]) {
    const p = ringProgress({ elapsedMs: elapsed * 60000, thresholdsMin: [20, 40, 60], modelMs: 0 });
    assert.ok(p.ratio >= 0 && p.ratio < 1, `${elapsed} 分钟的 ratio 应在 [0,1)，实际 ${p.ratio}`);
  }
});

test('ringProgress：单档阈值也能工作', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  const p = ringProgress({ elapsedMs: 5 * 60000, thresholdsMin: [10], modelMs: 0 });
  assert.ok(p.ratio > 0 && p.ratio < 1);
});

test('ringProgress：无阈值时返回零值而不崩', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  assert.equal(ringProgress({ elapsedMs: 60000, thresholdsMin: [], modelMs: 0 }).ratio, 0);
  assert.equal(ringProgress({ elapsedMs: 60000, thresholdsMin: null, modelMs: 0 }).ratio, 0);
  assert.equal(ringProgress(null).ratio, 0);
  assert.equal(ringProgress({}).ratio, 0);
});

test('ringProgress：畸形 elapsedMs 按 0 处理', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  for (const bad of [NaN, -1, null, undefined, 'x']) {
    const p = ringProgress({ elapsedMs: bad, thresholdsMin: [20], modelMs: 0 });
    assert.equal(p.ratio, 0, `${String(bad)} 应被当成 0`);
  }
});

// ── formatElapsed：秒级精度（v5）─────────────────────────────────────
// 「不到 1 分钟」对模型耗时没有信息量 —— 57 秒和 3 秒显示同一句话。
// 不足一分钟时直接给秒。

test('formatElapsed：不足一分钟给秒', () => {
  const { formatElapsed } = loadModules(['dict.js']);
  const t = (key, params) => `${key}(${JSON.stringify(params ?? {})})`;
  assert.equal(formatElapsed(0, t), 'unit.secondShort({"n":1})', '0 也给 1 秒，不显示 0');
  assert.equal(formatElapsed(1, t), 'unit.secondShort({"n":1})');
  assert.equal(formatElapsed(57000, t), 'unit.secondShort({"n":57})');
  assert.equal(formatElapsed(59999, t), 'unit.secondShort({"n":60})', '向上取整到 60');
});

test('formatElapsed：一分钟以上沿用分钟口径', () => {
  // 用真实字典（formatElapsed 内部会调 formatDuration 并填参数），所以断言的是
  // 最终文案而不是 key。
  const { formatElapsed } = loadModules(['dict.js']);
  const t = (key, params) =>
    key === 'unit.secondShort'
      ? `${params.n} 秒`
      : key === 'unit.minute'
        ? `${params.n} 分钟`
        : key === 'unit.hour'
          ? `${params.n} 小时`
          : key === 'unit.hourMinute'
            ? `${params.h} 小时 ${params.m} 分钟`
            : key === 'unit.lessThanMinute'
              ? '不到 1 分钟'
              : key;
  assert.equal(formatElapsed(60000, t), '1 分钟');
  assert.equal(formatElapsed(185000, t), '3 分钟');
  assert.equal(formatElapsed(3 * 3600000, t), '3 小时');
});

test('formatElapsed：畸形输入不抛', () => {
  const { formatElapsed } = loadModules(['dict.js']);
  const t = (key) => key;
  for (const bad of [NaN, -5, null, undefined, 'x']) {
    assert.doesNotThrow(() => formatElapsed(bad, t), `${String(bad)} 不该抛`);
  }
});

// ── 回归：「下次提醒还有 1 秒」卡死（v11 修的真实 bug）────────────────
//
// 现象：用户长会话中界面卡在「下次提醒还有 1 秒」不动。
//
// 根因：ringProgress 里算已满足档数时把 index **封顶在 list.length**：
//     while (index < list.length && elapsed >= list[index] * 60000) index += 1;
// 阈值 [20,40,60] 只有三档，于是 index 最大是 3，nextAtMs 恒等于
// nextThresholdMs(list, 3) = 80 分钟。活跃时长一旦超过 80 分钟，剩余就永远是
// max(0, 80 - elapsed) = 0，界面卡死；环也被钉在满格。
//
// 修法：改用 timing.satisfiedCount —— 它按 nextThresholdMs 迭代，不封顶，
// 因此末档之后的虚拟档位（80、100、120…）会继续往后延伸。

test('回归：活跃时长超过末档后，剩余时长仍然在增长（不再卡在 1 秒）', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  const list = [20, 40, 60];
  let previousRemaining = Infinity;
  let sawIncrease = false;

  for (const minutes of [81, 85, 90, 95, 99]) {
    const p = ringProgress({ elapsedMs: minutes * 60000, thresholdsMin: list, modelMs: 0 });
    const remaining = p.nextAtMs - minutes * 60000;
    assert.ok(remaining > 0, `${minutes} 分钟的剩余必须是正数，实际 ${remaining}`);
    assert.ok(
      remaining <= 20 * 60000,
      `${minutes} 分钟的剩余不该超过一个档位步长，实际 ${remaining / 60000} 分`,
    );
    if (remaining < previousRemaining) sawIncrease = true;
    previousRemaining = remaining;
  }
  assert.ok(sawIncrease, '剩余应当随时间递减（即 nextAt 在往后走），而不是恒定不变');
});

test('回归：跨过 80 分钟时从新档重新蓄满环', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  const list = [20, 40, 60];
  // 79 分钟：还在 60→80 档里，接近满。
  const before = ringProgress({ elapsedMs: 79 * 60000, thresholdsMin: list, modelMs: 0 });
  assert.ok(before.ratio > 0.9, `79 分钟应接近满环，实际 ${before.ratio}`);
  // 80 分钟：刚好进入 80→100 档，环应归零重新蓄。
  const at = ringProgress({ elapsedMs: 80 * 60000, thresholdsMin: list, modelMs: 0 });
  assert.equal(at.ratio, 0, '跨档瞬间环应归零');
  assert.equal(at.nextAtMs, 100 * 60000, '下一档应是 100 分钟');
  // 90 分钟：新档走了一半。
  const mid = ringProgress({ elapsedMs: 90 * 60000, thresholdsMin: list, modelMs: 0 });
  assert.ok(Math.abs(mid.ratio - 0.5) < 0.01, `90 分钟应是半环，实际 ${mid.ratio}`);
});

test('回归：极长活跃时长（数小时）也不会卡住', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  const list = [20, 40, 60];
  for (const minutes of [120, 180, 400, 1440]) {
    const p = ringProgress({ elapsedMs: minutes * 60000, thresholdsMin: list, modelMs: 0 });
    const remaining = p.nextAtMs - minutes * 60000;
    assert.ok(remaining > 0, `${minutes} 分钟（约 ${Math.round(minutes / 60)} 小时）剩余必须为正`);
    assert.ok(remaining <= 20 * 60000, `${minutes} 分钟剩余应在档位内`);
    assert.ok(p.ratio >= 0 && p.ratio < 1, `${minutes} 分钟环比例应在 [0,1)`);
  }
});

test('档位不封顶：nextAtMs 随活跃时长单调递增', () => {
  const { ringProgress } = loadModules(['timing.js', 'model-log.js']);
  const list = [20, 40, 60];
  let previous = 0;
  for (const minutes of [1, 20, 40, 60, 80, 100, 200, 500]) {
    const p = ringProgress({ elapsedMs: minutes * 60000, thresholdsMin: list, modelMs: 0 });
    assert.ok(
      p.nextAtMs > previous,
      `${minutes} 分钟的 nextAtMs (${p.nextAtMs / 60000}) 应大于前一档 (${previous / 60000})`,
    );
    previous = p.nextAtMs;
  }
});
