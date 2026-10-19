/**
 * 阈值提醒（v6 重做：不再是独立卡片，而是计时器的一种状态）。
 *
 * ## 为什么降级
 *
 * v5 之前提醒是右上角独立弹的一张卡，与常驻计时器**同时存在**。用户反馈指出
 * 那是两个东西争同一个位置：提醒一弹就把计时器挤到旁边（甚至叠上去），
 * 视觉上像出了两个互不相干的浮层。
 *
 * 现在提醒是计时器的一种状态：
 *
 *   常态    圆环 + 模型名 + 耗时
 *   提醒态  圆环转警示色 + 冒出一行提示 + 倒计时；点它 = 展开明细
 *   未读态  圆环持续警示色 + 一个待读点，直到用户点过
 *
 * 一个位置、一个组件、一套材质语言。提醒变成「计时器注意到了你」，
 * 而不是「又来了一张卡」。UI 画在 hud.js —— 只有那里知道圆环长什么样；
 * 本模块只负责把 store 里的提醒翻译成状态。
 *
 * @module src/client/reminder
 */

/**
 * 把 store 里的提醒翻译成计时器需要的提醒态。
 *
 * @param reminder - store 的 ui.reminder（null 或对象）。
 * @param nowMs - 当前时间戳。
 * @returns {null | { mode: 'countdown'|'unread', secondsLeft: number }}
 *   null = 当前没有提醒，计时器按常态渲染。
 */
function reminderStateOf(reminder, nowMs) {
  if (reminder === null || reminder === undefined || typeof reminder !== 'object') return null;

  const deadlineAt = Number.isFinite(reminder.deadlineAt) ? reminder.deadlineAt : 0;
  const sticky = reminder.sticky === true;
  const now = Number.isFinite(nowMs) ? nowMs : 0;
  const expired = now >= deadlineAt;

  if (expired === true) {
    // 只有 sticky 提醒（阈值提醒）留在未读态；「已收藏」这类确认到点即消失。
    return sticky === true ? { mode: 'unread', secondsLeft: 0 } : null;
  }
  // 向上取整，让「60」完整出现一秒，而不是开局就显示 59。
  return { mode: 'countdown', secondsLeft: Math.max(1, Math.ceil((deadlineAt - now) / 1000)) };
}

/**
 * 倒计时读数。
 *
 * 纯函数便于测试；不读 Date.now()，时间由调用方注入。
 *
 * @param reminder - store 的 ui.reminder。
 * @param nowMs - 当前时间戳。
 * @returns 剩余秒数；无提醒时为 0。
 */
function secondsLeftOf(reminder, nowMs) {
  const state = reminderStateOf(reminder, nowMs);
  return state === null ? 0 : state.secondsLeft;
}