/**
 * 「当前会话 id」的解析。
 *
 * ## 为什么需要单独一个模块
 * 这是本插件最容易随宿主升级而静默失效的地方 —— 而且**不会报错**，
 * 只是永远解析不出 id，于是计时器每秒都在第一道守卫处提前返回，
 * 光带永远不触发。实测踩过一次：
 *
 *   插件原写法是 `sessions.list.getSnapshot().current`。
 *   但 DSH 0.2.0-rc.2 的 SessionListState 实际只有
 *   { ids, byId, phase, projectionsBySession } —— **没有 current 字段**。
 *   运行时 `this.list.set({ ids, byId, phase, projectionsBySession })` 也只写这四个。
 *   结果 current 恒为 undefined，activeSessionId 恒为 null，计时器整个空转。
 *
 * 所以这里把「多种可能的形状」集中成一处显式声明，按可信度依次尝试，
 * 任何一种可用即生效；全都拿不到时返回 null，由调用方按「无会话」处理。
 *
 * ## 候选来源（按可信度排序）
 *   1. 快照上的 `current` —— 老版本 ui-session 的会话列表曾直接暴露它。
 *      新版本没有，但读它无害（有就比别处更准）。
 *   2. `retainedBy.mainView > 0` 的行 —— 这正是 ui-session 自己 publishMain()
 *      判定「当前主视图是哪个会话」的依据：
 *
 *          currentId && retainInfo(currentId).retainedBy.mainView > 0 ? currentId
 *            : Object.values(byId).find(c => c.retainedBy.mainView > 0)?.id
 *
 *      我们照抄这个判据，就能和宿主选中同一个会话。
 *   3. `ids` 的**末位**兜底：列表按宿主顺序给出，配合 session-scope 探针
 *      （见 session-id.js 的 `resolveFromProps`）通常不必走到这一步。
 *
 * @module src/client/session-id
 */

/**
 * 判断一个值是不是可用的会话 id。
 *
 * @param value - 待判值。
 * @returns {boolean} 是非空字符串即真。
 */
function isSessionId(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * 从一行的 retainedBy 里读 mainView 计数（缺失按 0）。
 *
 * @param row - SessionSummary 候选。
 * @returns {number} 主视图持有数。
 */
function mainViewCount(row) {
  const retainedBy = row === null || row === undefined ? undefined : row.retainedBy;
  const count = retainedBy === null || retainedBy === undefined ? undefined : retainedBy.mainView;
  return typeof count === 'number' && count > 0 ? count : 0;
}

/**
 * 从 SessionListState 快照解析当前会话 id。
 *
 * 对任意形状都不抛错：非对象、缺字段、byId 不是对象，一律返回 null。
 *
 * @param list - `sessions.list.getSnapshot()` 的返回值。
 * @returns {string|null} 当前会话 id，或 null。
 */
function resolveCurrentSessionId(list) {
  if (list === null || typeof list !== 'object') return null;

  // ① 老版本直接暴露的 current。
  if (isSessionId(list.current)) return list.current;

  const byId = list.byId;
  const ids = Array.isArray(list.ids) ? list.ids : null;

  // ② 与 ui-session publishMain() 同一个判据：主视图正在持有哪个会话。
  if (byId !== null && typeof byId === 'object') {
    if (ids !== null) {
      // 有 ids 时按宿主列表顺序找，保证「唯一主视图」时结果稳定。
      for (const id of ids) {
        if (mainViewCount(byId[id]) > 0) return id;
      }
    } else {
      for (const id of Object.keys(byId)) {
        if (mainViewCount(byId[id]) > 0) return id;
      }
    }
  }

  // ③ 末位兜底：列表按宿主顺序（通常最新在后）。
  if (ids !== null && ids.length > 0) {
    const last = ids[ids.length - 1];
    if (isSessionId(last)) return last;
  }

  return null;
}

/**
 * 在 session 作用域里把「当前渲染的会话」泵回 root。
 *
 * session-scope 插槽（`conversation.input.left`）的 standard props 里有
 * `sessionId: SessionId`，那是宿主直接给的、比在 root 侧反推更权威的答案。
 * 探针每次渲染都调它，root 侧据此把分区指针切过去。
 *
 * @param actions - store actions。
 * @param props - 插槽组件收到的 props。
 * @param now - 时间戳。
 * @returns {void}
 */
function claimSessionFromProps(actions, props, now) {
  const id = props === null || props === undefined ? undefined : props.sessionId;
  if (!isSessionId(id)) return;
  actions.switchSession({ sessionId: id, now });
}
