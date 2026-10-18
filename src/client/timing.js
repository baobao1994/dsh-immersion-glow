/**
 * 计时状态机（纯逻辑，无 DOM、无 React、无副作用）。
 *
 * 依据 PRD v0.2 §2.1 / §2.4 / §4.8。所有规则集中在此，便于 node --test 覆盖，
 * 也避免 UI 里散落 if 判断。
 *
 * 时间单位统一用毫秒；对外暴露的函数都接受显式 `now`，不读 Date.now()，
 * 这样测试可以完全控制时间。
 *
 * 三条核心语义（PRD §2.4 补齐的歧义）：
 *   1. 空闲 ≤ idleTimeoutMs(默认 3min) 视为连续，继续累加；
 *   2. 空闲 gap > resetGapMs(默认 10min) 视为新时段，重置 activeMs 与 startedAt；
 *   3. 超过末档后按末档步长继续（20/40/60 → 80/100/…）。
 *
 * 另加两条 PRD 未写但绕不开的：
 *   4. 页面隐藏时冻结计时（浏览器会节流甚至冻结定时器，累计会失真）；
 *      PRD 把「tab 休眠校正」列为 V1.1，此处只做冻结与切回后的重置判定，
 *      不做反向补算 —— 这是保守方向，不会多算。
 *   5. 时钟回拨（now < 上次 tick）时不累加、不触发。
 *
 * @module src/client/timing
 */

/** 一个活跃段达到多久才值得存进画廊（PRD §2.2 F7 的候选门槛）。 */
const MIN_SAVE_MS = 5 * 60 * 1000;

/**
 * 依据阈值数组算出某一档之后的下一个触发点。
 *
 * 语义：thresholdsMin 是「分钟」升序数组，例如 [20, 40, 60]。
 *   - 未触发任何档 → 第一档；
 *   - 已触发到末档 → 按末档步长递增（60 → 80 → 100 …）；
 *   - 中间档 → 下一档。
 *
 * @param thresholdsMin - 升序的阈值分钟数组，非空。
 * @param firedCount - 本时段已触发的档位数。
 * @returns 下一个触发点（毫秒）。
 */
function nextThresholdMs(thresholdsMin, firedCount) {
  const list = thresholdsMin;
  const last = list[list.length - 1];
  if (firedCount < list.length) return list[firedCount] * 60000;
  // 超过末档：以「末档 - 倒数第二档」为步长；只有一档时退化为末档本身。
  const step = list.length >= 2 ? last - list[list.length - 2] : last;
  const extra = firedCount - list.length + 1;
  return (last + step * extra) * 60000;
}

/**
 * 本时段当前应触发的档位数（可能一次越过多档，例如页面隐藏很久后回来）。
 *
 * @param thresholdsMin - 升序阈值。
 * @param activeMs - 本时段累计活跃毫秒。
 * @returns 已满足条件的总档位数。
 */
function satisfiedCount(thresholdsMin, activeMs) {
  let count = 0;
  // 上限保护：极端配置（如全 1 分钟）下不至于无限增长。
  const limit = 500;
  while (count < limit && activeMs >= nextThresholdMs(thresholdsMin, count)) count += 1;
  return count;
}

/**
 * 造一个全新的时段。
 * @param now - 当前毫秒时间戳。
 * @returns 新 segment。
 */
function createSegment(now) {
  return {
    startedAt: now,
    lastActiveAt: now,
    activeMs: 0,
    activeRuns: 0,
    firedCount: 0,
  };
}

/**
 * 记录一次用户交互（pointerdown / keydown / wheel / 节流 mousemove）。
 *
 * 只更新 lastActiveAt，并从空闲恢复时累加 activeRuns（PRD §2.4「交互轮次 =
 * 活跃段数」）。是否新开时段由 tick 统一裁决，这里不动 activeMs —— 交互本身
 * 不产生时长，时长只由 tick 按间隔累加。
 *
 * @param segment - 当前时段。
 * @param now - 当前毫秒时间戳。
 * @param idleTimeoutMs - 空闲阈值。
 * @returns 新的 segment（不改原对象）。
 */
function noteActivity(segment, now, idleTimeoutMs) {
  const wasIdle = now - segment.lastActiveAt > idleTimeoutMs;
  return {
    ...segment,
    lastActiveAt: now,
    activeRuns: wasIdle ? segment.activeRuns + 1 : segment.activeRuns,
  };
}

/**
 * 推进一个 tick。这是整个计时逻辑的唯一入口。
 *
 * 返回的 `effects` 让调用方决定如何落地（写 store、播动画），本函数保持纯净。
 *
 * @param params - 见下。
 * @param params.segment - 当前时段。
 * @param params.now - 本次 tick 的毫秒时间戳。
 * @param params.lastTickAt - 上一次 tick 的毫秒时间戳（null 表示首次）。
 * @param params.visible - 页面是否可见。
 * @param params.idleTimeoutMs - 空闲阈值。
 * @param params.resetGapMs - 新时段阈值。
 * @param params.thresholdsMin - 阈值分钟数组。
 * @returns {{ segment, effects }} effects 含 reset / saved / fire（null 表示无）。
 */
function tick(params) {
  const { segment, now, lastTickAt, visible, idleTimeoutMs, resetGapMs, thresholdsMin } = params;

  /** 默认无副作用。 */
  const noEffects = { reset: false, saved: null, fire: null };

  // 时钟回拨或首次 tick：不累加、不触发。
  if (lastTickAt === null || now < lastTickAt) {
    return { segment: { ...segment, lastActiveAt: segment.lastActiveAt }, effects: noEffects };
  }

  // 页面不可见：冻结。也不改 lastActiveAt —— 切回时由 gap 判定续算还是重置。
  if (!visible) {
    return { segment, effects: noEffects };
  }

  const gapSinceActive = now - segment.lastActiveAt;

  // 间隔过长 → 新时段。先把旧段结算成「可保存候选」，再重置。
  if (gapSinceActive > resetGapMs) {
    const saved = segment.activeMs >= MIN_SAVE_MS ? { ...segment } : null;
    return {
      segment: createSegment(now),
      effects: { reset: true, saved, fire: null },
    };
  }

  // 空闲但未到重置阈值：冻结累加（不补算空档）。
  if (gapSinceActive > idleTimeoutMs) {
    return { segment, effects: noEffects };
  }

  // 正常累加：本次 tick 覆盖的步长是「距上次 tick」的间隔。
  const step = Math.max(0, now - lastTickAt);
  const activeMs = segment.activeMs + step;
  const satisfied = satisfiedCount(thresholdsMin, activeMs);

  let next = { ...segment, activeMs };
  let fire = null;

  // 只有当越过新档位时才触发；一次 tick 可能跨多档，只播一次动画但记账全部。
  if (satisfied > segment.firedCount) {
    fire = { atMs: nextThresholdMs(thresholdsMin, satisfied - 1), count: satisfied };
    next.firedCount = satisfied;
  }

  return { segment: next, effects: { reset: false, saved: null, fire } };
}

/**
 * 把活跃段打包成一条可入库的收藏候选。
 * @param segment - 时段。
 * @param metrics - 该时段结束时的会话指标（可为 null）。
 * @param now - 入库时间。
 * @returns 收藏条目；不足 MIN_SAVE_MS 时返回 null。
 */
function toRecord(segment, metrics, now) {
  if (segment.activeMs < MIN_SAVE_MS) return null;
  return {
    createdAt: now,
    activeMs: segment.activeMs,
    activeRuns: segment.activeRuns,
    turns: metrics === null || metrics === undefined ? 0 : metrics.turns,
    toolCalls: metrics === null || metrics === undefined ? 0 : metrics.toolCalls,
    truncated: metrics !== null && metrics !== undefined ? metrics.truncated === true : false,
    sessionId: metrics === null || metrics === undefined ? null : metrics.sessionId,
  };
}

/**
 * 解析用户输入的阈值文本。
 *
 * 接受中英文逗号、空格分隔。要求 1–6 个正整数且严格递增（PRD §2.1 F4 的最小形态）。
 *
 * @param text - 用户输入。
 * @returns {{ ok: true, value: number[] } | { ok: false }}
 */
function parseThresholds(text) {
  if (typeof text !== 'string') return { ok: false };
  const parts = text
    .split(/[,，\s]+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
  if (parts.length < 1 || parts.length > 6) return { ok: false };
  const numbers = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return { ok: false };
    const value = Number(part);
    if (!Number.isSafeInteger(value) || value < 1 || value > 600) return { ok: false };
    numbers.push(value);
  }
  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] <= numbers[index - 1]) return { ok: false };
  }
  return { ok: true, value: numbers };
}

/**
 * 判断两个时间戳是否落在不同的本地日期（用于跨零点重置「今日」统计）。
 * @param a - 毫秒时间戳。
 * @param b - 毫秒时间戳。
 * @returns 是否跨日。
 */
function isDifferentLocalDay(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() !== right.getFullYear() ||
    left.getMonth() !== right.getMonth() ||
    left.getDate() !== right.getDate()
  );
}
