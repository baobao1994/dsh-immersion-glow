/**
 * 顶部安全区的测量。
 *
 * ## 它到底在量什么
 *
 * 量的是**会话面板头部的下沿** —— 标题与右上角那排按钮所在的那一条。
 * 计时器要落在它下面、并且明显进入对话区内部。
 *
 * ## 为什么必须测量
 *
 * 那个头部的高度是**内容驱动**的：带标签页时 `.ST7X_W_header` 是
 * `min-height:76px`，不带标签页时 `min-height:0; padding-bottom:10px`，
 * 实际约 50px —— 差近 26px。而且宿主升级会改这些值。写死一个数迟早错位。
 *
 * ## 两个曾经搞错的事实（都是没查清布局就动手）
 *
 *   1. `[data-shell-overlay]` **不是**顶部边界。它的 CSS 是
 *      `position:absolute; inset:0`，是覆盖整个窗口的浮层容器，`top` 恒为 0。
 *      v9 拿它当「外壳让开的位置」，算出 0+32=32px，比头部还高。
 *   2. frame 里**没有导航栏**。它是 `grid-template-rows: minmax(0,1fr) auto`，
 *      只有「内容 + 底部条」两行。用户看到的标题与按钮属于会话面板内部。
 *
 * ## 判据
 *
 * 不依赖任何类名（宿主会改），纯几何：宽度 ≥ 视口 40%、顶边贴近顶端
 * （≤ 视口高 20%）、高度在 20px 与半屏之间、且有子节点。
 * 取满足者中**底边最大**的那个 —— 那正是最外层头部块的下沿。
 *
 * 取最大而非最小：v7 取最小会选中头部内部更靠上的行包装层（标题行底边才 30
 * 左右），于是 EDGE_GAP 调多大都被压回去，表现为「越调越上」。
 *
 * 结果 = 头部下沿 + EDGE_GAP，写进 CSS 变量 `--ig-safe-top`，HUD 只读这一个变量。
 *
 * @module src/client/safe-top
 */

/**
 * 从会话头部下沿再向下让出的距离（px）。
 *
 * ⚠⚠ **数值越大 = 视觉上越靠下**。这是 `top` 的语义：它是「距容器顶部的距离」。
 *
 * v9 之前我把 28 → 14 → 10 一路调小，本意是「让它下来一点」，实际效果是
 * **一路往上推** —— 用户连着三轮反馈「越来越高」，我才发现方向弄反了。
 * 留下这行注释就是为了不再犯：要下来就**加大**这个数。
 *
 * 12px：刚好离开头部下沿那条分隔线，又不至于让它看起来「悬在半空」。
 * 旧值是 20 —— 那时药丸里有一个 44px 的圆环，整体 54px 高，20px 的间隙占不到
 * 高度的四成；换成 31px 的细药丸之后，同样的 20px 显得整条往下掉了。
 * 视觉间距要跟着元素的「体量」走，而不是钉死一个数字。
 */
const EDGE_GAP = 12;

/**
 * 测量防抖时长（ms）。
 *
 * 头部高度是低频信息，200ms 的延迟完全够用；换来的是把最坏情况从
 * 「每帧测一次」降到「每秒最多 5 次」。见 installSafeTop 的 schedule。
 */
const MEASURE_DEBOUNCE_MS = 200;

/**
 * 在外壳里找到「观察哪个节点最省」。
 *
 * 优先 `[data-shell-overlay]` 的父节点 —— 那是 frame 本体，它的直接子节点变化
 * 才意味着外壳结构调整。找不到就返回 null 让调用方退回 body。
 *
 * @param root - 搜索起点。
 * @returns 元素或 null。
 */
function findShellRoot(root) {
  try {
    if (typeof root.querySelector !== 'function') return null;
    const overlay = root.querySelector('[data-shell-overlay]');
    const parent = overlay === null || overlay === undefined ? null : overlay.parentElement;
    return parent === undefined ? null : parent;
  } catch (_error) {
    return null;
  }
}

/**
 * 无候选时的兜底偏移（px）。
 *
 * 按「顶部块约 76px + 一点留白」估。同样遵循「越大越靠下」。
 */
const FALLBACK_TOP = 90;

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

  // ── 量的是「会话面板头部」的下沿 ───────────────────────────────────
  //
  // ⚠ 纠正两轮错误认知（都来自没查清真实布局就动手）：
  //
  //   1. **`[data-shell-overlay]` 不是顶部边界**。它的 CSS 是
  //      `position:absolute; inset:0` —— 覆盖整个窗口的浮层容器，`top` 恒为 0。
  //      v9 把它当「外壳让开的位置」，于是算出 0+32=32px，比头部还高，
  //      表现为「并不在对话框内」。那条路径已删除。
  //
  //   2. **frame 里没有导航栏**。它只有 `grid-template-rows: minmax(0,1fr) auto`
  //      两行（内容 + 底部条），没有 header 行。用户看到的标题与右上角按钮属于
  //      **会话面板内部的头部**（`.ST7X_W_header`，`min-height:76px`；没有标签页时
  //      `min-height:0; padding-bottom:10px`，实际约 50px）。
  //
  // 结论：要量的就是那个头部块的下沿。它的高度是**内容驱动**的（有没有标签页差
  // 近 26px），所以只能测量、不能写死。
  //
  // 几何判据：宽度占视口大半、贴着顶端、高度不到半屏、且有子节点的容器；
  // 取其中**底边最大**的那个 —— 那正是最外层头部块的下沿。
  //
  // 取最大而不是最小：v7 取最小，结果选中头部内部一个更高的行包装层
  // （比如标题行本身，底边只有 30 左右），于是无论把 EDGE_GAP 调多大都被它
  // 压回去，表现为「越调越上」。
  let best = 0;
  // 只看前若干个元素：外壳类容器极少，通读整个 DOM 反而可能命中内容区的某个
  // 恰好又宽又靠上的东西。上限同时是性能保险。
  const nodes = root.querySelectorAll('div, header, nav');
  const limit = Math.min(nodes.length, 400);
  for (let index = 0; index < limit; index += 1) {
    const node = nodes[index];
    if (node === null || typeof node.getBoundingClientRect !== 'function') continue;
    // 只看有子节点的容器：叶子节点多半是按钮或图标。
    if (typeof node.childElementCount === 'number' && node.childElementCount === 0) continue;

    // ⚠ 跳过本插件自己的节点。
    //
    // 测量扫的是 body 下所有 div：插件的面板宽 340、高几百，在窄窗口里
    // （视口 40% < 340）完全符合「又宽又靠上」的判据，于是会把**自己的面板**
    // 当成头部，量出「面板下沿 + 间距」写回变量 —— 面板再跟着往下移，形成
    // 正反馈。表现就是「位置莫名越来越靠下」。插件的类名统一带 ig- 前缀，
    // 这一条判据比任何几何阈值都可靠。
    const className = typeof node.className === 'string' ? node.className : '';
    if (/(^|\s)ig-/.test(className)) continue;

    let rect;
    try {
      rect = node.getBoundingClientRect();
    } catch (_error) {
      continue;
    }
    // 宽度门槛：头部占会话列（视口减去侧边栏）的大半，40% 留出浮动窗口的余量。
    if (!Number.isFinite(rect.width) || rect.width < vw * 0.4) continue;
    // 必须贴着顶端：离顶端太远的不是头部。
    if (!Number.isFinite(rect.top) || rect.top > vh * 0.2) continue;
    // 高度窗口：头部是 40–140px 的一条。
    // 下限 32 排掉标题行/按钮行这类内部小包装层；上限 140 排掉消息容器 ——
    // 旧版上限是半屏（vh/2），一段只有几百字的消息组也能混进来，
    // 一旦它被选中，读数就会掉到对话区中间。
    if (!Number.isFinite(rect.height) || rect.height < 32 || rect.height > 140) continue;
    // 头部一定在上三分之一里。
    if (!Number.isFinite(rect.bottom) || rect.bottom > vh * 0.35) continue;

    const bottom = rect.bottom;
    if (Number.isFinite(bottom) && bottom > best) best = bottom;
  }
  return best === 0 ? FALLBACK_TOP : Math.ceil(best) + EDGE_GAP;
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
  let timer = 0;
  let last = -1;
  /** 连续测到同一个值的次数，用于「稳定后停止观察」。 */
  let stableCount = 0;
  /** 已停止观察（外壳高度稳定了，再测只是白烧 CPU）。 */
  let stopped = false;

  /** 测量并在变化时写入变量。 */
  const apply = () => {
    const value = measureSafeTop(root, doc);
    if (value === last) {
      stableCount += 1;
      // 连续 3 次同值就认为外壳高度已定：断开观察，避免长会话里每帧都被
      // 聊天区的 DOM 变动唤醒。resize 监听仍然保留 —— 窗口尺寸变了要重测。
      if (stableCount >= 3 && stopped === false) {
        stopped = true;
        if (observer !== null) observer.disconnect();
      }
      return;
    }
    last = value;
    stableCount = 0;
    // 写到 :root 上，HUD 读 var(--ig-safe-top)。用 CSS 变量而不是直接改元素
    // 的 style，是因为 HUD 可能还没挂载（发起询问之前不显示）。
    const target = doc.documentElement;
    if (target !== null && target !== undefined && typeof target.style?.setProperty === 'function') {
      target.style.setProperty('--ig-safe-top', `${value}px`);
    }
  };

  /**
   * 延迟测量：**防抖**而不是合帧。
   *
   * 为什么从 rAF 改成防抖：测量要对最多 400 个元素调 getBoundingClientRect，
   * 是强制同步布局。原先用 rAF 合帧，意思是「每帧最多测一次」—— 但会话活跃时
   * 聊天区几乎每帧都在增删节点，于是**每帧都会真的测一次**，持续触发重排。
   *
   * 头部高度是低频信息（只在宿主外壳挂载、切换标签页时变），200ms 的延迟完全
   * 够用，而把最坏情况从 60 次/秒降到 5 次/秒。
   */
  const schedule = () => {
    if (stopped === true) return;
    if (timer !== 0) return;
    const setT = view !== null && typeof view.setTimeout === 'function' ? view.setTimeout.bind(view) : setTimeout;
    timer = setT(() => {
      timer = 0;
      apply();
    }, MEASURE_DEBOUNCE_MS);
  };

  apply();
  if (view !== null) view.addEventListener('resize', schedule);

  // 宿主是异步渲染外壳的，DOM 结构变化后重测。
  //
  // ⚠ 观察范围：优先挂在**外壳容器**上，而不是 document.body。body 上的
  // subtree 观察会把聊天区每一次消息渲染都算进来（即使有防抖，唤醒频率也白高）。
  // 找不到外壳容器时才退回 body。
  const observer =
    view !== null && typeof view.MutationObserver === 'function'
      ? new view.MutationObserver(schedule)
      : null;
  const observed = findShellRoot(root) ?? root;
  if (observer !== null && typeof observed === 'object' && observed !== null) {
    // 不用 subtree：只关心外壳容器的**直接子节点**增删（外壳挂载/替换）。
    // 外壳内部再怎么渲染都不影响外层高度。
    observer.observe(observed, { childList: true, subtree: false });
  }

  return () => {
    if (frame !== 0 && view !== null && typeof view.cancelAnimationFrame === 'function') {
      view.cancelAnimationFrame(frame);
    }
    if (timer !== 0 && view !== null && typeof view.clearTimeout === 'function') {
      view.clearTimeout(timer);
    }
    frame = 0;
    timer = 0;
    if (view !== null) view.removeEventListener('resize', schedule);
    if (observer !== null) observer.disconnect();
    // 顺手摘掉自己写的变量：插件卸载后不该在 :root 上留残留。
    const target = doc.documentElement;
    if (target !== null && target !== undefined && typeof target.style?.removeProperty === 'function') {
      target.style.removeProperty('--ig-safe-top');
    }
  };
}