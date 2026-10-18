/**
 * 三处插槽的注册。
 *
 * 单独成文件的原因：每个组件都要把「标准 props + store 选择器 + handlers」
 * 组装成子组件的入参，这部分样板占了 apply() 的一半以上。抽出来后
 * index.js 只剩「装配与副作用生命周期」，读起来能一眼看完。
 *
 * 三处挂载点（已核实 kind/scope）：
 *   ① shell.overlay            list / root     记录卡 + 画廊 + 右上角提醒卡
 *   ② settings.general.item    list / root     设置行
 *   ③ conversation.input.left  list / session  探针（默认 null）
 *
 * ## stale 判定的权威来源（ADR-123，两次实测事故的结论）
 *
 * `shell.overlay` 挂在 **root** 作用域：root 束只有 ui-session 的
 * `{ hooks: { sessions, sessionStatus }, keyedHooks: { sessionRetainInfo } }`
 * 与 layout 的 `{ hooks: { panelInfo } }`。**没有 `sessionId` props** —— 它只
 * 在 session 作用域注入（BUILTIN_SOURCE）。第一版在这里读 `props.sessionId`，
 * 恒为 undefined，stale 恒真。
 *
 * 所以 root 侧的「当前会话」只能自己解析：读 `useSessions`（SessionListState
 * 的快照）取 `retainedBy.mainView > 0` 的行 —— 这与 ui-session 自己
 * `publishMain()` 选主视图会话的判据逐字相同（0.2.0-rc.2 ext-big.js:74471）。
 * 解析不出（首页/无会话）时才允许 stale 生效；此时再对照
 * activeSessionId 与 metrics.sessionId 是否一致，双保险。
 *
 * @module src/client/slots
 */

/**
 * 从 SessionListState 快照解析「主视图正在持有的会话 id」。
 *
 * 与 session-id.js 的 resolveCurrentSessionId 判据一致（mainView > 0 → ids
 * 末位兜底），但独立成小函数，因为它只服务 stale 派生，不参与计时认领。
 *
 * @param list - `useSessions((s) => s)` 的返回值，形状任意。
 * @returns {string|null} 当前会话 id 或 null。
 */
function resolveMainViewSessionId(list) {
  if (list === null || typeof list !== 'object') return null;

  // ui-session 的 SessionListState：{ ids, byId, phase, projectionsBySession }。
  const byId = list.byId;
  const ids = Array.isArray(list.ids) ? list.ids : null;
  const mainViewOf = (row) => {
    const retainedBy = row === null || row === undefined ? undefined : row.retainedBy;
    const count = retainedBy === null || retainedBy === undefined ? undefined : retainedBy.mainView;
    return typeof count === 'number' && count > 0;
  };

  if (byId !== null && typeof byId === 'object') {
    if (ids !== null) {
      for (const id of ids) {
        if (mainViewOf(byId[id])) return id;
      }
    } else {
      for (const id of Object.keys(byId)) {
        if (mainViewOf(byId[id])) return id;
      }
    }
  }

  // 老版本可能直接暴露 current；读它无害。
  if (typeof list.current === 'string' && list.current.length > 0) return list.current;

  // 末位兜底（宿主按「最新在后」排序列表）。
  if (ids !== null && ids.length > 0) {
    const last = ids[ids.length - 1];
    if (typeof last === 'string' && last.length > 0) return last;
  }
  return null;
}

/**
 * 注册全部插槽。
 *
 * @param params - { ctx, React, actions, translator, handlers, webState }
 * @returns 无。
 */
function registerSlots(params) {
  const { ctx, React, actions, translator, handlers } = params;
  const h = React.createElement;

  // ① shell.overlay：记录卡 + 画廊 + 右上角提醒卡 ────────────────────
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: 'immersion-glow.layer', order: 100 },
      function ImmersionLayer(props) {
        const useImmersionGlow = props.useImmersionGlow;
        const t = translator();

        // 分区随 activeSessionId / sessions 变化，selector 两个都要选到。
        const activeSessionId = useImmersionGlow((value) => value.activeSessionId);
        const sessionsMap = useImmersionGlow((value) => value.sessions);
        const durationText = React.useMemo(() => {
          const seg = (sessionsMap?.[activeSessionId] || {}).segment;
          return formatDuration(seg === undefined ? 0 : seg.activeMs, t);
        }, [sessionsMap, activeSessionId, t]);

        const reminder = useImmersionGlow((value) => value.ui.reminder);
        // 记录卡的时段标签从分区起止时间推导（tagsOf），必须把分区本体传下去。
        const segment = React.useMemo(() => {
          const seg = (sessionsMap?.[activeSessionId] || {}).segment;
          return seg ?? { startedAt: 0, lastActiveAt: 0, activeMs: 0, activeRuns: 0, firedCount: 0 };
        }, [sessionsMap, activeSessionId]);
        const metrics = React.useMemo(() => {
          const bucket = sessionsMap?.[activeSessionId];
          return bucket === undefined ? null : bucket.metrics;
        }, [sessionsMap, activeSessionId]);

        // ── stale 判定（ADR-123）────────────────────────────────────
        // root 作用域没有 props.sessionId；「当前会话」由 useSessions 的
        // mainView 判据解析（与宿主 publishMain 同源）。解析不出来时退回
        // activeSessionId（探针认领的指针），两个都没有才当「无会话」。
        // useSessions 是宿主束的标准 hook，但测试环境可能不传 —— 守卫成
        // null，绝不能裸引用（未传时是 ReferenceError，会顶掉整个图层）。
        const useSessions = typeof props.useSessions === 'function' ? props.useSessions : null;
        const sessionList = useSessions === null ? null : useSessions((value) => value);
        const mainViewId = React.useMemo(() => resolveMainViewSessionId(sessionList), [sessionList]);
        const currentId = mainViewId ?? activeSessionId;
        const stale =
          metrics === null
            ? false
            : metrics.sessionId === null ||
              currentId === null ||
              metrics.sessionId !== currentId;

        const shared = {
          React,
          t,
          useImmersionGlow,
          actions: props.immersionGlowActions ?? actions,
          durationText,
          stale,
          handlers,
          segment,
          metrics,
        };

        // 提醒卡（ADR-123）：倒计时 / 未读徽标都封装在 ReminderCard 里，
        // 这层只负责「有提醒就挂上」。key=seq 让新提醒强制重挂，组件里的
        // 本地计时状态随之复位。
        return h(
          React.Fragment,
          null,
          h(RecordCard, shared),
          h(Gallery, shared),
          reminder !== null && reminder !== undefined
            ? h(ReminderCard, {
                key: reminder.seq,
                React,
                t,
                reminder,
                actions: props.immersionGlowActions ?? actions,
              })
            : null,
        );
      },
    ),
  );

  // ── ② settings.general.item：设置行 ───────────────────────────────
  ctx.slots.inject('settings.general.item', () =>
    ctx.slots.register(
      { name: 'settings.general.item', id: 'immersion-glow.settings', order: 100 },
      function ImmersionSettings(props) {
        return h(SettingsRow, {
          React,
          t: translator(),
          useImmersionGlow: props.useImmersionGlow,
          actions: props.immersionGlowActions ?? actions,
          onCopyStats: handlers.copyStats,
          // 关闭记录卡后仍能进画廊的唯一入口（画廊面板挂在 shell.overlay）。
          onOpenGallery: () => {
            actions.setCardOpen(false);
            actions.setGalleryOpen(true);
          },
        });
      },
    ),
  );

  // ── ③ conversation.input.left：探针（默认 null） ───────────────────
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      { name: 'conversation.input.left', id: 'immersion-glow.probe', order: 100 },
      function ImmersionProbe(props) {
        const t = translator();

        // session 作用域的 standard props 里有 `sessionId: SessionId` —— 宿主
        // 直接给的、比在 root 侧反推更权威。探针每次渲染都把它认领回 root，
        // 于是即便 sessions.list 的解析在某个版本失效，分区指针仍然能切对。
        // （认领是幂等的：同一个 id 再 switchSession 只是刷新 updatedAt。）
        claimSessionFromProps(props.immersionGlowActions ?? actions, props, Date.now());

        const durationText = props.useImmersionGlow((value) => {
          // 常驻计时读**当前会话的分区**，不是顶层 segment。
          const seg = (value.sessions?.[value.activeSessionId] || {}).segment;
          return formatDuration(seg === undefined ? 0 : seg.activeMs, t);
        });
        const showInlineTimer = props.useImmersionGlow((value) => value.settings.showInlineTimer);
        return h(SessionProbe, {
          React,
          t,
          // 计数的真实数据源：ui-chat 注入的 chat 快照（useSession 的
          // ConversationSnapshot 只有控制字段，数节点恒为 0 —— ADR-123）。
          useChat: props.useChat,
          useSession: props.useSession,
          useImmersionGlow: props.useImmersionGlow,
          actions: props.immersionGlowActions ?? actions,
          showInlineTimer,
          durationText,
          sessionId: props.sessionId,
        });
      },
    ),
  );
}
