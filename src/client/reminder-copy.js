/**
 * 提醒卡的正文：按时段分档 + 轮换。
 *
 * 为什么不是一句固定文案：同样一句「起来走两步」，早上九点是提神，凌晨两点
 * 是敷衍 —— 深夜需要的不是「歇一下」，是「收工」。所以正文按时段换一组动作，
 * 但**卡头（40 分钟 · 该歇了）保持不变**：那是这个产品的识别符号，变了会让
 * 截图、文档和用户的记忆一直追不上。
 *
 * 为什么不用 Math.random：随机会让人觉得「莫名其妙」，也没法测。这里按
 * `telemetry.impressions`（提醒过几次）轮换，同一会话连着两次不会是同一条，
 * 一天下来是 1→2→3→1 的循环，可预期、可断言。
 *
 * @module src/client/reminder-copy
 */

/**
 * 时段分档。
 *
 * from/to 是小时（0–23），左闭右开；跨午夜的档位 from > to
 * （如 22 → 5 表示 22:00–04:59）。
 */
const REMINDER_BUCKETS = [
  { id: 'night', from: 22, to: 5 },
  { id: 'morning', from: 5, to: 9 },
  { id: 'day', from: 9, to: 17 },
  { id: 'evening', from: 17, to: 22 },
];

/** 每档的文案条数，必须与 dict 里的 hud.alert.line.<bucket>.<n> 对齐。 */
const REMINDER_VARIANTS = 3;

/**
 * 把小时映射到时段。
 *
 * @param hour - 本地时间的小时（0–23）。非法值按白天处理，宁可普通也不要崩。
 * @returns 时段 id。
 */
function reminderBucketFor(hour) {
  const h = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 12;
  for (const bucket of REMINDER_BUCKETS) {
    const inside =
      bucket.from < bucket.to
        ? h >= bucket.from && h < bucket.to
        : h >= bucket.from || h < bucket.to;
    if (inside) return bucket.id;
  }
  return 'day';
}

/**
 * 选一条文案。
 *
 * @param hour - 本地时间的小时。
 * @param seq - 第几次提醒（从 0 开始；负数与小数会被规整）。
 * @returns `{ bucket, index, key }`，key 可直接交给 t()。
 */
function reminderLine(hour, seq) {
  const bucket = reminderBucketFor(hour);
  const raw = Number.isFinite(seq) ? Math.floor(seq) : 0;
  const index = ((raw % REMINDER_VARIANTS) + REMINDER_VARIANTS) % REMINDER_VARIANTS;
  return { bucket, index, key: `hud.alert.line.${bucket}.${index + 1}` };
}
