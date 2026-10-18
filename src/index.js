/**
 * 沉浸觉察 —— 宿主半（运行在 DSH 主进程里）。
 *
 * 这个文件**故意是空的**。
 *
 * 它存在的唯一目的：让本包在 profile 层栈里有一条 loader 行。有了这条行，
 * DSH 的 client-modules 才会扫描到 package.json 的 `dsh.client` 声明，从而把
 * lib/client.js 作为浏览器插件提供给页面。全部行为都在浏览器半。
 *
 * 先例：`dsh-approval-watch` 的 README 原文
 *   "The host half (lib/index.js) is intentionally empty — all behavior lives
 *    in the browser half (lib/client.js), which registers a shell overlay entry."
 *
 * 不要在 `inject` 里声明任何服务：宿主侧的 pending 状态会让整条 fiber 卡住，
 * 而本插件在宿主侧不需要任何东西。也**不要**在这里注册静态路由 —— 本机是
 * desktop profile，Electron 走 file://，没有承载 webServer 的静态服务
 * （见 docs/ADR.md ADR-004）。
 *
 * @module dsh-immersion-glow
 */

/** Cordis 插件名。 */
export const name = 'immersion-glow';

/** 不声明任何宿主侧注入：空壳插件拿不到也不该拿服务。 */
export const inject = [];

/**
 * 宿主半的空实现。
 *
 * 无需注册资源，因此也没有 disposer 要返回。
 */
export function apply() {
  // 故意为空。见文件头注释。
}
