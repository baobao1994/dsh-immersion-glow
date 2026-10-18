/**
 * 右上角提醒卡（ADR-123）。
 *
 * 取代退役的底部光带 + toast：阈值触发时弹出、60 秒倒计时；到点还没点，
 * 阈值提醒（sticky）缩成一条**未读徽标**一直留着，直到用户点击 —— 点击打开
 * 记录卡并清除未读。「已收藏 / 已复制」这类确认走同一张卡但**非粘性**：
 * 到点即消失，也永远不会顶掉一条未读的阈值提醒（守卫在 state.showReminder）。
 *
 * 倒计时是组件本地的 `useState` + `window.setInterval`，**不进 store** ——
 * 每秒 setState 一次会打爆 persist。判断一律用绝对时间戳（deadlineAt），
 * 页面被挂起、断点续跑都不会算错。
 *
 * 测试环境的 fake React 的 useEffect 是 noop，interval 不会真的启动；
 * useState 返回初值本身（不执行惰性初始化函数），所以这里**刻意用急切求值**
 * `useState(Date.now())`，绝不能写 `useState(() => Date.now())`。
 *
 * @module src/client/reminder
 */

/**
 * 渲染提醒（卡片 / 徽标 / 无）。
 *
 * 三种形态：
 *   1. 倒计时内        → 右上角卡片：标题 + 正文 + 倒计时 + 关闭按钮；
 *   2. sticky 已超时   → 未读徽标，常驻直到被点；
 *   3. 非 sticky 已超时 → null（卸载，无痕消失）。
 *
 * @param props - { React, t, reminder, actions }
 *   reminder：store 里的 ui.reminder（null 或 { message, sticky, deadlineAt, seq }）。
 *   actions：store 的 actions 表（用 countOpen / openFromReminder / dismissReminder）。
 * @returns 虚拟 DOM 节点，无提醒或已过期时为 null。
 */
function ReminderCard(props) {
  const { React, t, reminder, actions } = props;
  const useState = React.useState;
  const useEffect = React.useEffect;

  // 急切求值（见文件头说明）。remind 变化时由调用方的 key=seq 强制重挂，
  // 状态自然复位，不需要在这里追同步。
  const [nowMs, setNowMs] = useState(Date.now());

  const hasReminder = reminder !== null && reminder !== undefined && typeof reminder === 'object';
  const deadlineAt = hasReminder && Number.isFinite(reminder.deadlineAt) ? reminder.deadlineAt : 0;
  const sticky = hasReminder === true && reminder.sticky === true;
  const expired = nowMs >= deadlineAt;

  useEffect(() => {
    if (hasReminder !== true || expired === true) return undefined;
    const timer = window.setInterval(() => {
      // 只负责让页面「走秒」；过期判定每帧用绝对时间戳算，不靠它累积。
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasReminder, expired, reminder === null || reminder === undefined ? 0 : reminder.seq]);

  // ── 形态判定 ─────────────────────────────────────────────────────────
  if (hasReminder !== true) return null;
  if (expired === true) {
    if (sticky !== true) return null;
    // 未读徽标：点击 = 打开记录卡并清除未读。
    return React.createElement(
      'button',
      {
        class: 'ig-reminder ig-reminder-badge',
        type: 'button',
        title: t('reminder.unread'),
        'aria-label': t('reminder.unread'),
        onClick: () => {
          actions.countOpen();
          actions.openFromReminder();
        },
      },
      React.createElement('span', { class: 'ig-reminder-badge-dot', 'aria-hidden': 'true' }),
      t('reminder.unread'),
    );
  }

  // 剩余秒数：向上取整，让「60」完整出现一秒，而不是开局就显示 59。
  const secondsLeft = Math.max(0, Math.ceil((deadlineAt - nowMs) / 1000));

  // ── 倒计时内的卡片 ──────────────────────────────────────────────────
  return React.createElement(
    'div',
    {
      class: 'ig-reminder',
      role: 'status',
      'aria-label': t('reminder.aria'),
    },
    React.createElement(
      'button',
      {
        class: 'ig-reminder-body',
        type: 'button',
        onClick: () => {
          actions.countOpen();
          actions.openFromReminder();
        },
      },
      React.createElement('span', { class: 'ig-reminder-title' }, t('reminder.title')),
      React.createElement('span', { class: 'ig-reminder-message' }, reminder.message),
      React.createElement(
        'span',
        { class: 'ig-reminder-countdown' },
        t('reminder.countdown', { n: secondsLeft }),
      ),
    ),
    React.createElement(
      'button',
      {
        class: 'ig-reminder-close',
        type: 'button',
        title: t('reminder.unread'),
        'aria-label': t('reminder.unread'),
        onClick: () => actions.dismissReminder(),
      },
      '×',
    ),
  );
}
