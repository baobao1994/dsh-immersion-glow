/**
 * 样式注入器。
 *
 * CSS 本体在 panel-css.js（模块间共享闭包，构建时按序内联）。
 * 光带样式（band-css.js）已随 ADR-123 退役。
 *
 * 三条纪律（PRD §3.1 / §3.2 / 官方插件守则）：
 *   1. 所有类名带 `ig-` 前缀，不污染宿主；
 *   2. 动画只动 `opacity` / `transform`，不触发 layout / paint；
 *   3. 颜色只走 `--ig-*` 语义层（定义在 panel-css.js 顶部，全部从宿主的
 *      `--dsw-alias-*` 派生）。不要在组件或 CSS 里写裸色值：宿主没有
 *      `--dsw-alias-text-brand` 这类名字，写错不会报错，只会静默退化成
 *      深色主题的值 —— 浅色下就是一片低对比度。
 *
 * @module src/client/styles
 */

/** 注入标记，用于幂等与卸载清理。 */
const STYLE_TAG_ID = 'dsh-immersion-glow';

/**
 * 注入样式表。重复调用是幂等的；返回 disposer。
 *
 * @param doc - 文档对象（无 DOM 环境传入 undefined，直接跳过）。
 * @returns 清理函数。
 */
function installStyles(doc) {
  if (doc === undefined || doc === null || typeof doc.createElement !== 'function') {
    return () => {};
  }
  const selector = `style[data-plugin=${JSON.stringify(STYLE_TAG_ID)}]`;
  const existing = typeof doc.querySelector === 'function' ? doc.querySelector(selector) : null;
  if (existing !== null) return () => {};

  const tag = doc.createElement('style');
  tag.dataset.plugin = STYLE_TAG_ID;
  tag.textContent = PANEL_CSS;
  (doc.head ?? doc.body).appendChild(tag);
  return () => {
    if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
  };
}
