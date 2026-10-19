/**
 * 顶部安全区的测量。
 *
 * ## 为什么必须测量而不能写死一个 top 值
 *
 * 计时器原本固定在 `top: 16px`，正好压在窗口右上角那排按钮（模型选择、
 * 更多⋯）上面 —— 用户反馈明确指出了这一点。把 top 调大到「看起来躲开」是
 * 猜测：宿主没有为这个场景暴露任何高度 token 或 data 属性（已核实
 * 0.2.0-rc.2 的 shell/layout/chat 产物：只有 `--dsh-frame-leading-clearance`
 * 这类横向变量，标题行是 `min-height:30px` 但那只是内容高，不是外壳高）。
 *
 * 写死一个数会在三种情况下失效：窗口变窄导致标题换行、宿主升级改了外壳
 * 高度、用户在自定义标题栏字体。**测量则永远对**。
 *
 * ## 测量对象与降级
 *
 * 目标是「右上角那排按钮的底边」。按可信度依次尝试：
 *   1. 元素上带 title/aria-label 且文字暗示切换/设置一类按钮 —— 太脆，放弃；
 *   2. **首选**：宿主标题栏容器（`.dsh` 前缀的任意元素里位置在最上方、宽度覆盖
 *      大部分视口的那一个）—— 用几何判定而不是类名匹配，宿主改类名也不失效；
 *   3. 兜底常量 52px：标题行 30px + 内边距的常见值，宁可稍微压一点也不要
 *      让插件整体消失。
 *
 * 结果写进 CSS 变量 `--ig-safe-top`，HUD 只读这一个变量。
 *
 * @module src/client/safe-top
 */

/** 找不到可测量目标时的兜底偏移（px）。 */
const FALLBACK_TOP = 52;

/**
 * 在一个元素的几何范围内寻找「最上方的横向外壳」。
 *
 * 判据（不依赖任何类名）：
 *   - 宽度 ≥ 视口的 55%（标题栏是通栏的，按钮条不是）；
 *   - 顶边贴近视口顶端（≤ 视口高度的 12%）。
 * 取满足条件者中 top 最小的一个，它的高度就是安全区。
 *
 * @param root - 搜索起点，通常是 document.body。
 * @param doc - 文档对象。
 * @returns {number} 偏移像素。
 */
function measureSafeTop(root, doc) {
  // doc 本身可能为 undefined/null（无 DOM 环境、测试替身缺省）——
  // 上一版直接读 doc.defaultView 会抛，而兜底本来就是这里该做的事。
  const view = doc === null || doc === undefined ? null : (doc.defaultView ?? null);
  const vw = view !== null && Number.isFinite(view.innerWidth) ? view.innerWidth : 0;
  const vh = view !== null && Number.isFinite(view.innerHeight) ? view.innerHeight : 0;
  if (root === null || root === undefined || typeof root.querySelectorAll !== 'function') {
    return FALLBACK_TOP;
  }
  if (vw <= 0 || vh <= 0) return FALLBACK_TOP;

  // ⚠ 初值必须是 0（= 还没找到），不能是 FALLBACK_TOP。用兜底值当初值的话，
  // 「一个候选都没找到」会返回 FALLBACK_TOP + 12，偏移凭空多出一截。
  let best = 0;
  // 只看前若干个元素：外壳类容器极少，通读整个 DOM 反而可能命中聊天区的某个
  // 恰好又宽又靠上的东西。上限同时是性能保险。
  const nodes = root.querySelectorAll('div, header, nav');
  const limit = Math.min(nodes.length, 400);
  for (let index = 0; index < limit; index += 1) {
    const node = nodes[index];
    if (node === null || typeof node.getBoundingClientRect !== 'function') continue;
    // 只看有子节点的容器：叶子节点多半是按钮或图标。
    if (typeof node.childElementCount === 'number' && node.childElementCount === 0) continue;

    const rect = node.getBoundingClientRect();
    if (rect.width < vw * 0.55) continue;
    if (rect.top > vh * 0.12) continue;
    if (rect.height <= 0 || rect.height >= vh * 0.5) continue;

    const bottom = rect.bottom;
    // 只认「离顶端最近的那个」：多个候选里取最小的 bottom，避免把正文容器算进来。
    if (bottom > 0 && (best === 0 || bottom < best)) best = bottom;
  }
  // 一个候选都没有 → 兜底；有候选 → 底边 + 间距。
  return best === 0 ? FALLBACK_TOP : Math.ceil(best) + 12;
}

/**
 * 开始跟踪顶部安全区，把结果写进 `--ig-safe-top`。
 *
 * 重新测量的时机：首次、窗口尺寸变化、DOM 结构变化（宿主异步渲染外壳，
 * 首次测量很可能早于它出现）。
 *
 * @param doc - 文档对象；缺失时返回空 disposer。
 * @returns 清理函数。
 */
function installSafeTop(doc) {
  if (doc === undefined || doc === null || typeof doc.querySelectorAll !== 'function') {
    return () => {};
  }
  const view = doc.defaultView;
  const root = doc.body ?? doc.documentElement;
  if (root === null || root === undefined) return () => {};

  let frame = 0;
  let last = -1;

  /** 测量并在变化时写入变量。 */
  const apply = () => {
    const value = measureSafeTop(root, doc);
    if (value === last) return;
    last = value;
    // 写到 :root 上，HUD 读 var(--ig-safe-top)。用 CSS 变量而不是直接改元素
    // 的 style，是因为 HUD 可能还没挂载（发起询问之前不显示）。
    const target = doc.documentElement;
    if (target !== null && target !== undefined && typeof target.style?.setProperty === 'function') {
      target.style.setProperty('--ig-safe-top', `${value}px`);
    }
  };

  /** 合并到下一帧执行，避免连续事件把测量打爆。 */
  const schedule = () => {
    if (frame !== 0) return;
    const raf = view !== null && typeof view.requestAnimationFrame === 'function'
      ? view.requestAnimationFrame.bind(view)
      : (fn) => setTimeout(fn, 16);
    frame = raf(() => {
      frame = 0;
      apply();
    });
  };

  apply();
  if (view !== null) view.addEventListener('resize', schedule);

  // 宿主是异步渲染外壳的，DOM 结构变化后重测。
  const observer =
    view !== null && typeof view.MutationObserver === 'function'
      ? new view.MutationObserver(schedule)
      : null;
  if (observer !== null && typeof root === 'object') {
    observer.observe(root, { childList: true, subtree: true });
  }

  return () => {
    if (frame !== 0 && view !== null && typeof view.cancelAnimationFrame === 'function') {
      view.cancelAnimationFrame(frame);
    }
    frame = 0;
    if (view !== null) view.removeEventListener('resize', schedule);
    if (observer !== null) observer.disconnect();
  };
}