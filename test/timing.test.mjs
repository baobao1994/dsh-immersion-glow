/**
 * 计时状态机的单元测试。
 *
 * 覆盖 PRD v0.2 §2.4 补齐的歧义，以及我额外加的两条（页面隐藏冻结、时钟回拨）。
 * 每个用例都显式给 now，因此不依赖真实时钟、不 flaky。
 *
 * 重要前提：**没有活动信号，计时会在 idleTimeout 后冻结** —— 所以任何要走到
 * 20 分钟的用例都必须模拟用户持续操作。本文件用 `advanceActive()` 统一处理，
 * 避免每个用例重复写「每一秒喂一次活动」。
 *
 * 运行： node --test test/timing.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { loadModule } from './helpers.mjs';

/** 包根。 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');


const TIMING = loadModule('timing.js');

/** 默认参数：与 state.js 的默认设置一致。 */
const DEFAULTS = {
  idleTimeoutMs: 3 * 60 * 1000,
  resetGapMs: 10 * 60 * 1000,
  thresholdsMin: [20, 40, 60],
};

/** 造一个起始于 t0 的空时段。 */
function seg(t0) {
  return TIMING.createSegment(t0);
}

/**
 * 模拟「用户一直在操作」，把时段从 fromMs 推进到 toMs。
 *
 * 每 10 秒喂一次活动（远小于 3 分钟空闲阈值），每秒 tick 一次 —— 与真实运行
 * 里 setInterval(1000) + 事件监听的组合等价。
 *
 * @param params - { segment, startAt, fromMs, toMs, visible }
 * @returns { segment, fireCount }
 */
function advanceActive(params) {
  const { segment, startAt, fromMs, toMs, visible } = params;
  let current = segment;
  let lastTick = startAt + fromMs;
  let fireCount = 0;

  for (let elapsed = fromMs + 1000; elapsed <= toMs; elapsed += 1000) {
    const now = startAt + elapsed;

    // 每 10 秒一次活动信号，等价于真实用户持续操作。
    if (elapsed % 10_000 === 0) {
      current = TIMING.noteActivity(current, now, DEFAULTS.idleTimeoutMs);
    }

    const result = TIMING.tick({
      segment: current,
      now,
      lastTickAt: lastTick,
      visible: visible !== false,
      ...DEFAULTS,
    });
    current = result.segment;
    lastTick = now;
    if (result.effects.fire !== null) fireCount += 1;
  }

  return { segment: current, fireCount };
}

// ── 档位计算 ───────────────────────────────────────────────────────────
test('nextThresholdMs：三档之内按数组取，超出按末档步长递增', () => {
  assert.equal(TIMING.nextThresholdMs([20, 40, 60], 0), 20 * 60000);
  assert.equal(TIMING.nextThresholdMs([20, 40, 60], 1), 40 * 60000);
  assert.equal(TIMING.nextThresholdMs([20, 40, 60], 2), 60 * 60000);
  // 越过末档：60 → 80 → 100（步长 = 60 - 40 = 20）
  assert.equal(TIMING.nextThresholdMs([20, 40, 60], 3), 80 * 60000);
  assert.equal(TIMING.nextThresholdMs([20, 40, 60], 4), 100 * 60000);
});

test('nextThresholdMs：只有一档时以该档本身为步长', () => {
  assert.equal(TIMING.nextThresholdMs([25], 1), 50 * 60000);
  assert.equal(TIMING.nextThresholdMs([25], 2), 75 * 60000);
});

test('satisfiedCount：一次可跨多档', () => {
  assert.equal(TIMING.satisfiedCount([20, 40, 60], 0), 0);
  assert.equal(TIMING.satisfiedCount([20, 40, 60], 19 * 60000), 0);
  assert.equal(TIMING.satisfiedCount([20, 40, 60], 20 * 60000), 1);
  assert.equal(TIMING.satisfiedCount([20, 40, 60], 45 * 60000), 2);
  // 200 分钟：20/40/60/80/100/120/140/160/180/200 共 10 档
  assert.equal(TIMING.satisfiedCount([20, 40, 60], 200 * 60000), 10);
});

// ── 空闲冻结与续算 ─────────────────────────────────────────────────────
test('空闲超过 idleTimeout（3min）但不超 resetGap：冻结累加，段落不变', () => {
  const t0 = 1_000_000;
  const segment = seg(t0);

  // 先正常走 10 秒
  let result = TIMING.tick({
    segment,
    now: t0 + 10_000,
    lastTickAt: t0,
    visible: true,
    ...DEFAULTS,
  });
  assert.equal(result.segment.activeMs, 10_000);
  assert.equal(result.effects.reset, false);

  // 静置 4 分钟（> 3 分钟空闲阈值，< 10 分钟重置阈值）
  result = TIMING.tick({
    segment: result.segment,
    now: t0 + 4 * 60_000,
    lastTickAt: t0 + 10_000,
    visible: true,
    ...DEFAULTS,
  });
  assert.equal(result.segment.activeMs, 10_000, '空闲期间不累加');
  assert.equal(result.effects.reset, false, '尚未到重置阈值');
});

test('空闲后 noteActivity 恢复：累加 activeRuns（交互轮次 = 活跃段数）', () => {
  const t0 = 1_000_000;
  const segment = seg(t0);
  assert.equal(segment.activeRuns, 0);

  // 同一时刻的活动不算「从空闲恢复」
  let next = TIMING.noteActivity(segment, t0, DEFAULTS.idleTimeoutMs);
  assert.equal(next.activeRuns, 0);

  // 空闲 5 分钟后活动 → 记一个活跃段
  next = TIMING.noteActivity(next, t0 + 5 * 60_000, DEFAULTS.idleTimeoutMs);
  assert.equal(next.activeRuns, 1);

  // 紧接着再活动 → 不重复计数
  next = TIMING.noteActivity(next, t0 + 5 * 60_000 + 1000, DEFAULTS.idleTimeoutMs);
  assert.equal(next.activeRuns, 1);
});

test('空闲未超阈值时，活动信号不增加 activeRuns', () => {
  const t0 = 1_000_000;
  const next = TIMING.noteActivity(seg(t0), t0 + 60_000, DEFAULTS.idleTimeoutMs);
  assert.equal(next.activeRuns, 0);
});

// ── 模型回答期间（busy）计时继续 ──────────────────────────────────────
test('模型回答期间：即使没有用户操作也不冻结，继续累加', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 60_000 };

  // 模型从 t0+60s 答到 t0+5min（远超市面上的空闲阈值，但 busy 期间不该冻结）。
  let result = { segment, effects: { reset: false, saved: null, fire: null } };
  let lastTick = t0 + 60_000;
  let elapsed = 0;
  for (let sec = 61; sec <= 5 * 60; sec += 1) {
    const now = t0 + sec * 1000;
    result = TIMING.tick({
      segment: result.segment,
      now,
      lastTickAt: lastTick,
      visible: true,
      busy: true,
      ...DEFAULTS,
    });
    lastTick = now;
    elapsed += 1;
  }
  assert.equal(result.effects.reset, false, '回答期间不应触发新时段重置');
  assert.equal(result.segment.activeMs, 60_000 + elapsed * 1000, '回答期间的每秒钟都应累加');
});

test('模型回答期间把 lastActiveAt 推到最新，结束时不会立刻被判空闲', () => {
  const t0 = 1_000_000;
  let segment = { ...seg(t0), activeMs: 10_000, lastActiveAt: t0 + 10_000 };

  // 模型答到 t0 + 5 分钟，全程 busy。
  const busyEnd = t0 + 5 * 60_000;
  let lastTick = t0 + 10_000;
  for (let sec = 11; sec <= 5 * 60; sec += 1) {
    const now = t0 + sec * 1000;
    const result = TIMING.tick({
      segment,
      now,
      lastTickAt: lastTick,
      visible: true,
      busy: true,
      ...DEFAULTS,
    });
    segment = result.segment;
    lastTick = now;
  }
  assert.equal(segment.lastActiveAt, busyEnd, 'busy 期间 lastActiveAt 应推进到最新');

  // 回答结束后立刻又 tick 一次：gap 很小，应继续累加而非冻结/重置。
  const after = TIMING.tick({
    segment,
    now: busyEnd + 1000,
    lastTickAt: busyEnd,
    visible: true,
    busy: false,
    ...DEFAULTS,
  });
  assert.equal(after.effects.reset, false, '回答刚结束不该瞬间重置');
  assert.equal(after.segment.activeMs, segment.activeMs + 1000, '回答结束后仍按活跃续算');
});

test('模型长时间回答（超 resetGap）不把时段切断', () => {
  const t0 = 1_000_000;
  let segment = { ...seg(t0), activeMs: 30_000 };
  let lastTick = t0;
  for (let sec = 1; sec <= 12 * 60; sec += 1) {
    // 12 分钟 > 10 分钟 resetGap，但 busy 全程不回退。
    const now = t0 + sec * 1000;
    const result = TIMING.tick({
      segment,
      now,
      lastTickAt: lastTick,
      visible: true,
      busy: true,
      ...DEFAULTS,
    });
    assert.equal(result.effects.reset, false, `busy 中第 ${sec}s 不应重置`);
    segment = result.segment;
    lastTick = now;
  }
  assert.equal(segment.activeMs, 12 * 60_000 + 30_000, '整段回答时间都应计入');
});

test('busy 期间跨过阈值同样触发提醒', () => {
  const t0 = 1_000_000;
  // 从 19 分 59 秒开始，模型一路答到 20 分钟。
  let segment = { ...seg(t0), activeMs: 19 * 60_000 + 59_000, lastActiveAt: t0 };
  const result = TIMING.tick({
    segment,
    now: t0 + 20 * 60_000,
    lastTickAt: t0,
    visible: true,
    busy: true,
    ...DEFAULTS,
  });
  assert.ok(result.effects.fire !== null, '等待模型回答凑满 20 分钟也应触发提醒');
  assert.equal(result.effects.fire.count, 1);
});

// ── 重置 ───────────────────────────────────────────────────────────────
test('空闲超过 resetGap：开新时段，并把够长的旧段交出来', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 12 * 60_000 };

  const result = TIMING.tick({
    segment,
    now: t0 + 11 * 60_000, // 距 lastActiveAt 11 分钟 > 10 分钟
    lastTickAt: t0 + 60_000,
    visible: true,
    ...DEFAULTS,
  });

  assert.equal(result.effects.reset, true);
  assert.equal(result.segment.activeMs, 0);
  assert.equal(result.segment.startedAt, t0 + 11 * 60_000);
  assert.ok(result.effects.saved !== null, '12 分钟旧段应作为候选交出来');
  assert.equal(result.effects.saved.activeMs, 12 * 60000);
});

test('重置时旧段不足 5 分钟：不交出保存候选', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 2 * 60_000 };

  const result = TIMING.tick({
    segment,
    now: t0 + 11 * 60_000,
    lastTickAt: t0 + 60_000,
    visible: true,
    ...DEFAULTS,
  });

  assert.equal(result.effects.reset, true);
  assert.equal(result.effects.saved, null);
});

// ── 触发 ───────────────────────────────────────────────────────────────
test('持续活跃到 20 分钟：只触发一次，firedCount 推进到 1', () => {
  const t0 = 1_000_000;
  const { segment, fireCount } = advanceActive({
    segment: seg(t0),
    startAt: t0,
    fromMs: 0,
    toMs: 20 * 60_000,
  });

  assert.equal(fireCount, 1, '20 分钟总共只应触发一次');
  assert.equal(segment.firedCount, 1);
  assert.ok(segment.activeMs >= 20 * 60_000, `累计应达 20 分钟，实际 ${segment.activeMs}`);
});

test('触发防重复：同一档位不会二次触发', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 20 * 60000, firedCount: 1, lastActiveAt: t0 + 20 * 60000 };

  const result = TIMING.tick({
    segment,
    now: t0 + 20 * 60000 + 1000,
    lastTickAt: t0 + 20 * 60000,
    visible: true,
    ...DEFAULTS,
  });

  assert.equal(result.effects.fire, null);
  assert.equal(result.segment.firedCount, 1);
});

test('持续活跃到 60 分钟：共触发 3 次（20/40/60）', () => {
  const t0 = 1_000_000;
  const { segment, fireCount } = advanceActive({
    segment: seg(t0),
    startAt: t0,
    fromMs: 0,
    toMs: 60 * 60_000,
  });

  assert.equal(fireCount, 3);
  assert.equal(segment.firedCount, 3);
});

test('60 分钟之后继续按末档步长触发（80 / 100）', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 60 * 60000, firedCount: 3, lastActiveAt: t0 + 60 * 60000 };

  // 推进到 80 分钟（中间喂活动，避免被空闲阈值冻结）
  let current = segment;
  let lastTick = t0 + 60 * 60000;
  let fired = 0;
  for (let elapsed = 60 * 60000 + 1000; elapsed <= 100 * 60000; elapsed += 1000) {
    const now = t0 + elapsed;
    if (elapsed % 10_000 === 0) current = TIMING.noteActivity(current, now, DEFAULTS.idleTimeoutMs);
    const result = TIMING.tick({
      segment: current,
      now,
      lastTickAt: lastTick,
      visible: true,
      ...DEFAULTS,
    });
    current = result.segment;
    lastTick = now;
    if (result.effects.fire !== null) fired += 1;
  }

  assert.equal(fired, 2, '80 与 100 分钟各触发一次');
  assert.equal(current.firedCount, 5);
});

// ── 页面隐藏 ───────────────────────────────────────────────────────────
test('页面隐藏：冻结，不累加', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 5 * 60000 };

  const result = TIMING.tick({
    segment,
    now: t0 + 60_000,
    lastTickAt: t0 + 1000,
    visible: false,
    ...DEFAULTS,
  });

  assert.equal(result.segment.activeMs, 5 * 60000);
  assert.equal(result.effects.fire, null);
  assert.equal(result.effects.reset, false);
});

test('隐藏很久后切回：按 gap 判重置（不反向补算）', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 8 * 60000, lastActiveAt: t0 };

  // 隐藏 15 分钟后可见；gap 15 分钟 > 10 分钟重置阈值
  const result = TIMING.tick({
    segment,
    now: t0 + 15 * 60_000,
    lastTickAt: t0 + 1000,
    visible: true,
    ...DEFAULTS,
  });

  assert.equal(result.effects.reset, true);
  assert.equal(result.segment.activeMs, 0, '不把隐藏期间当作活跃时长');
});

// 实测 bug（用户反馈）：发起询问后把 DSH 切到后台 / 别的窗口，计时就停住。
// 根因是这里先判 !visible 直接冻结，busy 根本没机会生效 —— 而 busy 当初加进来
// 就是为了「模型回答期间不停表」。隐藏期间模型在干活，用户只是在等。
test('页面隐藏但模型在回答：继续累加（切后台等回答是正常用法）', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 5 * 60000, lastActiveAt: t0 };

  const result = TIMING.tick({
    segment,
    now: t0 + 60_000,
    lastTickAt: t0,
    visible: false,
    busy: true,
    ...DEFAULTS,
  });

  assert.equal(result.segment.activeMs, 5 * 60000 + 60_000, '后台回答期间照样计时');
  assert.equal(result.segment.lastActiveAt, t0 + 60_000, '作者期间刷新活跃点，回来不立刻判空闲');
  assert.equal(result.effects.reset, false);
});

test('后台回答超过重置阈值：不判新时段，越过档位照样触发', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 19 * 60000, lastActiveAt: t0 };

  // 隐藏 12 分钟（> 10 分钟重置阈值），模型一直在跑。
  const result = TIMING.tick({
    segment,
    now: t0 + 12 * 60_000,
    lastTickAt: t0 + 1000,
    visible: false,
    busy: true,
    ...DEFAULTS,
  });

  assert.equal(result.effects.reset, false, '回答中不打断连续时段');
  // 单步封顶 2 分钟：这 12 分钟里只有 2 分钟被认（见 MAX_TICK_STEP_MS）。
  assert.equal(result.segment.activeMs, 21 * 60000);
  assert.equal(result.effects.fire.count, 1, '跨过 20 分钟档应触发提醒');
});

test('单步封顶：睡眠挂起的几小时不会整段算成沉浸', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 60_000, lastActiveAt: t0 };

  const result = TIMING.tick({
    segment,
    now: t0 + 3 * 60 * 60_000,
    lastTickAt: t0,
    visible: false,
    busy: true,
    ...DEFAULTS,
  });

  assert.equal(
    result.segment.activeMs,
    60_000 + TIMING.MAX_TICK_STEP_MS,
    '只认封顶的那一段，其余丢弃（宁可少算）',
  );
});

// ── 时钟异常 ───────────────────────────────────────────────────────────
test('时钟回拨：不累加、不触发', () => {
  const t0 = 1_000_000;
  const segment = { ...seg(t0), activeMs: 5 * 60000 };

  const result = TIMING.tick({
    segment,
    now: t0 - 60_000, // 比 lastTickAt 还小
    lastTickAt: t0,
    visible: true,
    ...DEFAULTS,
  });

  assert.equal(result.segment.activeMs, 5 * 60000);
  assert.equal(result.effects.fire, null);
});

test('首次 tick（lastTickAt 为 null）：不累加', () => {
  const t0 = 1_000_000;
  const result = TIMING.tick({
    segment: seg(t0),
    now: t0 + 5000,
    lastTickAt: null,
    visible: true,
    ...DEFAULTS,
  });
  assert.equal(result.segment.activeMs, 0);
});

// ── 收藏入库门槛 ───────────────────────────────────────────────────────
test('toRecord：不足 5 分钟不入库，够长则带上指标', () => {
  const t0 = 1_000_000;
  assert.equal(TIMING.toRecord({ ...seg(t0), activeMs: 60_000 }, null, t0), null);

  const record = TIMING.toRecord(
    { ...seg(t0), activeMs: 30 * 60000, activeRuns: 3 },
    { sessionId: 's1', turns: 7, toolCalls: 12, truncated: true },
    t0,
  );
  assert.equal(record.activeMs, 30 * 60000);
  assert.equal(record.activeRuns, 3);
  assert.equal(record.turns, 7);
  assert.equal(record.toolCalls, 12);
  assert.equal(record.truncated, true);
  assert.equal(record.sessionId, 's1');
});

test('toRecord：metrics 为 null 时给零值而不是崩溃', () => {
  const record = TIMING.toRecord({ ...seg(0), activeMs: 10 * 60000 }, null, 0);
  assert.equal(record.turns, 0);
  assert.equal(record.toolCalls, 0);
  assert.equal(record.truncated, false);
  assert.equal(record.sessionId, null);
});

// ── 阈值解析 ───────────────────────────────────────────────────────────
test('parseThresholds：接受中英文逗号与空格', () => {
  // 跨 realm 的对象用 JSON 比较，避开原型不一致导致的 deepEqual 失败。
  const parse = (text) => JSON.stringify(TIMING.parseThresholds(text));
  assert.equal(parse('20, 40, 60'), JSON.stringify({ ok: true, value: [20, 40, 60] }));
  assert.equal(parse('20，40，60'), JSON.stringify({ ok: true, value: [20, 40, 60] }));
  assert.equal(parse(' 20  40 60 '), JSON.stringify({ ok: true, value: [20, 40, 60] }));
  assert.equal(parse('25'), JSON.stringify({ ok: true, value: [25] }));
});

test('parseThresholds：拒绝非法输入', () => {
  assert.equal(TIMING.parseThresholds('').ok, false);
  assert.equal(TIMING.parseThresholds('   ').ok, false);
  assert.equal(TIMING.parseThresholds('40, 20').ok, false, '必须严格递增');
  assert.equal(TIMING.parseThresholds('20, 20').ok, false, '不允许相等');
  assert.equal(TIMING.parseThresholds('0, 20').ok, false, '不允许 0');
  assert.equal(TIMING.parseThresholds('-5').ok, false);
  assert.equal(TIMING.parseThresholds('abc').ok, false);
  assert.equal(TIMING.parseThresholds('20, 40, 60, 80, 100, 120, 140').ok, false, '超过 6 个');
});

// ── 跨日 ───────────────────────────────────────────────────────────────
test('isDifferentLocalDay：同日为假，跨日为真', () => {
  const morning = new Date(2026, 9, 17, 9, 0, 0).getTime();
  const evening = new Date(2026, 9, 17, 23, 0, 0).getTime();
  const nextDay = new Date(2026, 9, 18, 0, 30, 0).getTime();

  assert.equal(TIMING.isDifferentLocalDay(morning, evening), false);
  assert.equal(TIMING.isDifferentLocalDay(evening, nextDay), true);
});
