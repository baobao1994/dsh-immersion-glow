/**
 * 时段标签（PRD v0.2 §2.2 F14）。
 *
 * 设计意图（ADR-011）：成长信号要从「收藏数」换成「即时可感知的时段标签」，
 * 因为收藏数是「沉浸 20 分钟才出一次机会、攒 20 张要数周」的长回路，撑不到
 * 习惯形成。标签在时段结束时立刻可见，反馈发生在行为当下。
 *
 * 两类标签可叠加，卡片最多显示两枚：
 *   - 时间类：晨间 / 深夜
 *   - 长度类：长跑 / 碎片
 *
 * 隐私边界：只用时长与时间戳，绝不触碰消息正文。
 *
 * @module src/client/tags
 */

/** 逻辑标签 id，UI 层用 t('tag.<id>') 取文案。 */
const TAG_MORNING = 'morning';
const TAG_LATE_NIGHT = 'lateNight';
const TAG_LONG_RUN = 'longRun';
const TAG_FRAGMENT = 'fragment';

/** 长跑门槛：单时段净活跃 ≥ 60 分钟。 */
const LONG_RUN_MS = 60 * 60 * 1000;

/** 碎片门槛：单时段净活跃 < 20 分钟。 */
const FRAGMENT_MS = 20 * 60 * 1000;

/**
 * 按开始时刻归类「晨间 / 深夜」。
 *
 * 区间取左闭右开：晨间 [5, 10)，深夜 [22, 24) ∪ [0, 5)。
 * 白天（10–22）不产出时间标签 —— 大多数会话发生在白天，给每个人都发「白天」
 * 标签等于没有信息量。
 *
 * @param startedAt - 时段开始毫秒时间戳。
 * @returns 标签 id 或 null。
 */
function timeTagOf(startedAt) {
  const hour = new Date(startedAt).getHours();
  if (hour >= 5 && hour < 10) return TAG_MORNING;
  if (hour >= 22 || hour < 5) return TAG_LATE_NIGHT;
  return null;
}

/**
 * 按时长归类「长跑 / 碎片」。
 * @param activeMs - 时段净活跃毫秒。
 * @returns 标签 id 或 null。
 */
function lengthTagOf(activeMs) {
  if (activeMs >= LONG_RUN_MS) return TAG_LONG_RUN;
  if (activeMs < FRAGMENT_MS) return TAG_FRAGMENT;
  return null;
}

/**
 * 计算一条记录的全部标签。
 *
 * 顺序固定为 [时间类, 长度类]，便于 UI 稳定渲染；最多两枚。
 *
 * @param startedAt - 时段开始时间戳。
 * @param activeMs - 时段净活跃毫秒。
 * @returns 标签 id 数组（0–2 项）。
 */
function tagsOf(startedAt, activeMs) {
  const result = [];
  const time = timeTagOf(startedAt);
  if (time !== null) result.push(time);
  const length = lengthTagOf(activeMs);
  if (length !== null) result.push(length);
  return result;
}
