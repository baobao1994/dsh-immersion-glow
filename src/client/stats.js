/**
 * 埋点与收藏的导出载荷（PRD §4.9）。
 *
 * 抽成独立纯函数是为了可单测：复制出去的 JSON 是**用户唯一会看的数据**，
 * 它的 schema 版本与字段口径不该埋在 apply() 里。
 *
 * @module src/client/stats
 */

function buildStatsPayload(state, now) {
  const { impressions, opens } = state.telemetry;
  const telemetry = state.telemetry ?? {};
  const settings = state.settings ?? {};
  return {
    schema: 'immersion-glow/stats',
    version: 2,
    exportedAt: new Date(now).toISOString(),
    telemetry: {
      impressions,
      opens,
      /** 点击率；零曝光时给 null 而不是 NaN。 */
      openRate: impressions > 0 ? Number((opens / impressions).toFixed(3)) : null,
    },
    collections: {
      count: state.collections.length,
      totalActiveMs: state.collections.reduce(
        (sum, item) => sum + (Number.isFinite(item.activeMs) ? item.activeMs : 0),
        0,
      ),
    },
    settings: {
      thresholdsMin: settings.thresholdsMin,
      idleTimeoutMs: settings.idleTimeoutMs,
    },
  };
}
