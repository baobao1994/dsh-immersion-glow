/**
 * 剪贴板写入（PRD §4.9 的「复制统计」）。
 *
 * 为什么不 require('@deepseek-ai/dsh-client-ui-primitives') 的 writeClipboard：
 * 它确实在平台静态表里、今天可用，但官方插件守则明确写着
 *   "Do not `require('@deepseek-ai/dsh-client-ui-primitives')` or load any other
 *    Harness Client package as a module ... They change without notice, a
 *    plain-JS plugin has no type check."
 * 为一个复制功能引入这份风险不划算。自己写 20 行，行为一致，零依赖。
 *
 * 三级降级：navigator.clipboard → execCommand('copy') → 返回 false 让 UI 提示
 * 用户手动选择文本。
 *
 * @module src/client/clipboard
 */

/**
 * 把文本写进系统剪贴板。
 *
 * @param text - 要复制的文本。
 * @param nav - navigator 对象（测试可注入）。
 * @param doc - document 对象（测试可注入）。
 * @returns Promise<boolean> 是否成功。
 */
async function copyText(text, nav, doc) {
  if (typeof text !== 'string' || text.length === 0) return false;

  // 一级：异步剪贴板 API（需要安全上下文，DSH 的本地页面满足）。
  try {
    const clipboard = nav === undefined || nav === null ? undefined : nav.clipboard;
    if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
      await clipboard.writeText(text);
      return true;
    }
  } catch (_error) {
    // 落到下一级；不向上抛，复制失败不该打断 UI。
  }

  // 二级：隐藏 textarea + execCommand。老 WebView / 权限被拒时兜底。
  try {
    if (doc === undefined || doc === null || typeof doc.createElement !== 'function') return false;
    const holder = doc.createElement('textarea');
    holder.value = text;
    holder.setAttribute('readonly', '');
    holder.style.position = 'fixed';
    holder.style.top = '-1000px';
    holder.style.opacity = '0';
    (doc.body ?? doc.documentElement).appendChild(holder);
    if (typeof holder.select === 'function') holder.select();
    const ok =
      typeof doc.execCommand === 'function' ? doc.execCommand('copy') === true : false;
    if (holder.parentNode !== null) holder.parentNode.removeChild(holder);
    return ok;
  } catch (_error) {
    return false;
  }
}
