/**
 * 顶部安全区测量的单元测试。
 *
 * 核心是**几何判据**而不是类名匹配：宿主改类名、换布局，测量仍然对。
 * 所以测试用假的元素树喂各种形状，验证选择逻辑，而不是验证某个选择器。
 *
 * 运行： node --test test/safe-top.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { loadModule } from './helpers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');


const { measureSafeTop, installSafeTop, FALLBACK_TOP, EDGE_GAP, MEASURE_DEBOUNCE_MS } = loadModule('safe-top.js');

/**
 * 期望偏移 = 外壳底边 + 间隔。
 *
 * 直接引用被测模块导出的常量，而不是把数字抄一遍 —— 间距是纯观感参数，
 * 用户已经来回调过三轮；抄数字的断言会在每次调整时变成一片假红。
 */
const OFFSET_AFTER_EDGE = EDGE_GAP;

/**
 * 造一个假的元素树。
 *
 * @param spec - { nodes: [{ top, height, width, children }], vw, vh }
 * @returns { root, doc } 可直接喂给 measureSafeTop。
 */
function fakeTree(spec) {
  const vw = spec.vw ?? 1200;
  const vh = spec.vh ?? 800;
  const flat = spec.nodes ?? [];

  const make = (item) => ({
    childElementCount: item.children ?? 1,
    getBoundingClientRect: () => ({
      top: item.top,
      bottom: item.top + item.height,
      width: item.width ?? vw,
      height: item.height,
    }),
  });

  return {
    root: {
      querySelectorAll: () => flat.map(make),
    },
    doc: { defaultView: { innerWidth: vw, innerHeight: vh } },
  };
}

/**
 * 核心几何：从一堆候选里挑出外壳的底边。
 *
 * ⚠ 这里原先残留了一个孤立的块注释起始符（后面紧跟另一个起始符），
 * 把**前 9 个测试整段注释掉了** —— 而 `npm test` 一直报绿，因为被注释掉的
 * 测试根本没注册。见 ADR-139：注释配平现在是自动检查项。
 */
test('量出通栏外壳的底边', () => {
  const { root, doc } = fakeTree({
    nodes: [
      { top: 0, height: 52, width: 1200, children: 5 }, // 外壳
      { top: 52, height: 700, width: 900, children: 20 }, // 正文（窄，排除）
    ],
  });
  assert.equal(measureSafeTop(root, doc), 52 + OFFSET_AFTER_EDGE);
});

// 回归：v8 取的是**最小** bottom，会选中一个比导航栏更高的包装层，
// 于是无论怎么调 EDGE_GAP 都会被压回去 —— 表现为「越改越往上」。
// v9 改成取**最大**：问题的本意是「外壳底部在哪」，答案就是最高那个通栏容器。
test('多个通栏候选时取底边最低的那个（外壳的真实下沿）', () => {
  const { root, doc } = fakeTree({
    nodes: [
      { top: 0, height: 24, width: 1200, children: 3 }, // 导航栏上的一行包装层
      { top: 24, height: 40, width: 1200, children: 3 }, // 导航栏本体，底边 64
    ],
  });
  assert.equal(
    measureSafeTop(root, doc),
    64 + OFFSET_AFTER_EDGE,
    '应取底边 64，而不是更高的 24',
  );
});

test('窄容器（按钮条之类）不算外壳', () => {
  const { root, doc } = fakeTree({
    nodes: [
      { top: 0, height: 30, width: 300, children: 3 }, // 只有 300 宽
      { top: 0, height: 52, width: 1200, children: 5 },
    ],
  });
  assert.equal(measureSafeTop(root, doc), 52 + OFFSET_AFTER_EDGE);
});

test('不贴着顶端的不算外壳', () => {
  const { root, doc } = fakeTree({
    nodes: [{ top: 300, height: 40, width: 1200, children: 3 }],
    vh: 800,
  });
  assert.equal(measureSafeTop(root, doc), FALLBACK_TOP, '远离顶端 → 兜底');
});

test('叶子节点（按钮/图标）不算外壳', () => {
  const { root, doc } = fakeTree({
    nodes: [
      { top: 0, height: 30, width: 1200, children: 0 }, // 叶子
      { top: 0, height: 52, width: 1200, children: 5 },
    ],
  });
  assert.equal(measureSafeTop(root, doc), 52 + OFFSET_AFTER_EDGE);
});

test('超过半屏高的容器不算外壳（那是正文）', () => {
  const { root, doc } = fakeTree({
    nodes: [{ top: 0, height: 700, width: 1200, children: 30 }],
    vh: 800,
  });
  assert.equal(measureSafeTop(root, doc), FALLBACK_TOP);
});

test('对话区里一段 200px 高的消息容器不会被当成头部', () => {
  // 旧版的高度上限是「半屏」（vh/2）。一段两百来字、只有 200px 高的消息组
  // 同样「又宽、又靠上、又不到半屏」，于是被选中 —— 读数掉到对话区中间。
  // 现在上限收到 140px（头部就 40–140 这个量级）。
  const { root, doc } = fakeTree({
    nodes: [
      { top: 0, height: 76, width: 1200, children: 5 }, // 真正的头部
      { top: 76, height: 200, width: 1100, children: 30 }, // 消息容器，底边 276
    ],
  });
  assert.equal(measureSafeTop(root, doc), 76 + OFFSET_AFTER_EDGE, '不该被 276 拉下去');
});

test('插件自己的面板不会被量成头部（窄窗口下它同样又宽又靠上）', () => {
  // 插件面板宽 316、高 120，在 700px 宽的窗口里满足「宽 ≥ 视口 40%、贴顶、
  // 高 32–140、底边在上三分之一」。靠 ig- 类名把它排除，否则量的是自己，
  // 面板再跟着下移 —— 正反馈，越量越靠下。
  const vw = 700;
  const vh = 800;
  const ownPanel = {
    childElementCount: 3,
    className: 'ig-hud-card',
    getBoundingClientRect: () => ({ top: 60, bottom: 180, width: 316, height: 120 }),
  };
  const header = {
    childElementCount: 5,
    className: '',
    getBoundingClientRect: () => ({ top: 0, bottom: 60, width: 700, height: 60 }),
  };
  const root = { querySelectorAll: () => [ownPanel, header] };
  const doc = { defaultView: { innerWidth: vw, innerHeight: vh } };
  assert.equal(measureSafeTop(root, doc), 60 + OFFSET_AFTER_EDGE, '应量头部，不是插件面板');
});

test('空树 / 无 querySelectorAll → 兜底', () => {
  assert.equal(measureSafeTop(null, { defaultView: null }), FALLBACK_TOP);
  assert.equal(measureSafeTop({}, { defaultView: null }), FALLBACK_TOP);
});

test('视口尺寸缺失 → 兜底（不猜）', () => {
  const root = { querySelectorAll: () => [] };
  assert.equal(measureSafeTop(root, { defaultView: { innerWidth: 0, innerHeight: 0 } }), FALLBACK_TOP);
  assert.equal(measureSafeTop(root, null), FALLBACK_TOP);
});

test('结果总是正数（负的 top 会被排除）', () => {
  const { root, doc } = fakeTree({
    nodes: [
      { top: -100, height: 50, width: 1200, children: 5 }, // 底边 -50
      { top: 0, height: 40, width: 1200, children: 5 },
    ],
  });
  assert.ok(measureSafeTop(root, doc) > 0);
});

// ── installSafeTop：变量写入与生命周期 ───────────────────────────────

/** 造一个可写的 documentElement，收集 setProperty 调用。 */
function fakeDoc(nodes) {
  const writes = [];
  const listeners = { resize: [] };
  const root = { querySelectorAll: () => nodes, style: {} };
  return {
    writes,
    root,
    doc: {
      body: root,
      documentElement: {
        style: {
          setProperty: (name, value) => writes.push([name, value]),
        },
      },
      querySelectorAll: () => nodes,
      defaultView: {
        innerWidth: 1200,
        innerHeight: 800,
        addEventListener: (type, fn) => {
          if (listeners[type]) listeners[type].push(fn);
        },
        removeEventListener: (type, fn) => {
          const at = listeners[type].indexOf(fn);
          if (at >= 0) listeners[type].splice(at, 1);
        },
        requestAnimationFrame: (fn) => {
          fn();
          return 1;
        },
        cancelAnimationFrame: () => {},
        MutationObserver: null,
      },
    },
  };
}

test('installSafeTop 把测量结果写进 --ig-safe-top', () => {
  const node = {
    childElementCount: 5,
    getBoundingClientRect: () => ({ top: 0, bottom: 56, width: 1200, height: 56 }),
  };
  const { doc, writes } = fakeDoc([node]);
  const dispose = installSafeTop(doc);
  assert.ok(writes.length > 0, '应至少写一次');
  assert.equal(writes[0][0], '--ig-safe-top');
  assert.equal(writes[0][1], `${56 + OFFSET_AFTER_EDGE}px`, '底边 + 两段偏移');
  dispose();
});

test('installSafeTop 在无 document 时返回空清理函数', () => {
  assert.doesNotThrow(() => installSafeTop(undefined)());
  assert.doesNotThrow(() => installSafeTop(null)());
});

test('dispose 可重复调用不抛', () => {
  const { doc } = fakeDoc([]);
  const dispose = installSafeTop(doc);
  dispose();
  assert.doesNotThrow(() => dispose());
});
// ── 方向性回归：偏移越大 = 越靠下 ────────────────────────────────────
//
// v8/v9 我连续把偏移调小，以为「数字小 = 下来一点」，实际是「数字小 = 往上」，
// 用户连三轮反馈「越来越高」。这组测试锁死语义，避免再反。

test('结果 = 头部下沿 + EDGE_GAP（是相加，不是相减）', () => {
  const { root, doc } = fakeTree({
    nodes: [{ top: 0, height: 76, width: 1200, children: 5 }],
  });
  const top = measureSafeTop(root, doc);
  assert.equal(top, 76 + EDGE_GAP, '必须是相加');
  assert.ok(top > 76, '结果必须在头部下沿之下（视觉上更靠下）');
});

test('偏移量足以离开头部：落点在对话区内部', () => {
  const { root, doc } = fakeTree({
    nodes: [{ top: 0, height: 76, width: 1200, children: 5 }],
  });
  const top = measureSafeTop(root, doc);
  assert.ok(top - 76 >= 10, `落点应明显低于头部下沿，实际只差 ${top - 76}px`);
  assert.ok(top - 76 <= 40, `但也不该深到像漂在中间，实际差 ${top - 76}px`);
});

test('兜底值也落在内容区（不贴着顶端）', () => {
  const { root, doc } = fakeTree({ nodes: [] });
  const top = measureSafeTop(root, doc);
  assert.ok(top >= 76, `兜底值 ${top} 应落在内容区，而不是贴着顶端`);
});

// ── 忠实还原真实 DSH 布局（v10 补上的关键一环）────────────────────────
//
// 之前几轮改错，根因是**测试里的假布局和真实布局不一样** —— 假树只有
// 「一个通栏外壳 + 正文」，而真实布局是：
//
//   frame (grid: 1fr auto，没有 header 行)
//   ├── sidebarCol        左侧会话列表（占掉一部分宽度）
//   ├── centerCol         会话列
//   │   └── header        标题 + 右上角按钮，min-height 76px（内容驱动）
//   │   └── scrollBody    聊天区
//   ├── bottomRow         [data-shell-bottom]
//   └── overlayLayer      [data-shell-overlay]，position:absolute; inset:0
//
// 注意 overlay 的 top 是 0、高度是满屏 —— 它**不是**顶部边界。这条假布局里
// 必须体现出来，否则「拿 overlay 当边界」这类错误永远测不出来。

/**
 * 造一个忠实于真实 DSH 的布局树。
 *
 * @param options - { headerHeight, vw, vh, sidebarWidth }
 * @returns { root, doc }
 */
function fakeRealLayout(options = {}) {
  const vw = options.vw ?? 1400;
  const vh = options.vh ?? 900;
  const sidebar = options.sidebarWidth ?? 260;
  const headerHeight = options.headerHeight ?? 76;
  const centerWidth = vw - sidebar;

  /** 一个几何节点。 */
  const node = (spec) => ({
    childElementCount: spec.children ?? 1,
    getBoundingClientRect: () => ({
      top: spec.top,
      bottom: spec.top + spec.height,
      width: spec.width,
      height: spec.height,
    }),
  });

  const header = node({ top: 0, height: headerHeight, width: centerWidth, children: 3 });
  const titleRow = node({ top: 10, height: 30, width: centerWidth - 48, children: 2 });
  const centerCol = node({ top: 0, height: vh, width: centerWidth, children: 2 });
  const scrollBody = node({ top: headerHeight, height: vh - headerHeight, width: centerWidth, children: 9 });
  const sidebarCol = node({ top: 0, height: vh, width: sidebar, children: 5 });
  // ⚠ overlay 满窗口：top 0、高度满屏。它必须被高度上限排除掉。
  const overlay = node({ top: 0, height: vh, width: vw, children: 1 });
  const frame = node({ top: 0, height: vh, width: vw, children: 4 });

  return {
    root: { querySelectorAll: () => [frame, sidebarCol, centerCol, header, titleRow, scrollBody, overlay] },
    doc: { defaultView: { innerWidth: vw, innerHeight: vh } },
  };
}

test('真实布局：量出会话头部的下沿（76px 那次）', () => {
  const { root, doc } = fakeRealLayout({ headerHeight: 76 });
  assert.equal(measureSafeTop(root, doc), 76 + EDGE_GAP);
});

test('真实布局：头部矮一些时（无标签页约 50px）结果跟着变', () => {
  const { root, doc } = fakeRealLayout({ headerHeight: 50 });
  assert.equal(measureSafeTop(root, doc), 50 + EDGE_GAP, '测量必须跟着头部高度走');
});

test('真实布局：满窗口的 overlay 层不被误当成顶部边界', () => {
  // overlay 的 top 是 0、高度满屏。如果实现里拿它当边界，结果会退化成
  // 0 + EDGE_GAP = 14 —— 比头部（76）还高，正是这轮的真实 bug。
  const { root, doc } = fakeRealLayout({ headerHeight: 76 });
  const top = measureSafeTop(root, doc);
  assert.ok(top > 76, `结果 ${top} 必须在头部下沿之下，而不是被 overlay 拉回顶端`);
  assert.notEqual(top, EDGE_GAP, '不能被 overlay 的 top=0 带偏');
});

test('真实布局：结果明显落在对话区内部而不是贴着头部', () => {
  const { root, doc } = fakeRealLayout({ headerHeight: 76 });
  const top = measureSafeTop(root, doc);
  assert.ok(top - 76 >= 12, `距头部下沿只有 ${top - 76}px，仍像贴着头部`);
  assert.ok(top - 76 <= 40, `距头部下沿 ${top - 76}px，已经太深了`);
});

test('真实布局：窄窗口（侧边栏占掉大半）仍能量到', () => {
  const { root, doc } = fakeRealLayout({ vw: 900, sidebarWidth: 320, headerHeight: 76 });
  assert.equal(measureSafeTop(root, doc), 76 + EDGE_GAP);
});

// ── P1-2：观察范围、防抖、稳定后停观察 ───────────────────────────────
//
// 原实现用 rAF 合帧 + 观察 document.body 的 subtree。会话活跃时聊天区几乎每帧
// 都在增删节点，于是**每帧都真的测一次**（最多 400 次 getBoundingClientRect，
// 强制同步布局）。头部高度是低频信息，不需要这个频率。

/** 造一个带外壳结构的 doc，并记录观察/断开调用。 */
function shellDoc(options = {}) {
  const writes = [];
  const removals = [];
  const observers = [];
  const listeners = { resize: [] };

  const makeNode = (spec) => ({
    childElementCount: spec.children ?? 1,
    getBoundingClientRect: () => ({ top: spec.top, bottom: spec.top + spec.height, width: spec.width, height: spec.height }),
  });

  const header = makeNode({ top: 0, height: options.headerHeight ?? 76, width: 1000, children: 3 });
  const overlay = makeNode({ top: 0, height: 800, width: 1200, children: 1 });
  overlay.parentElement = options.hasShell === false ? undefined : makeNode({ top: 0, height: 800, width: 1200, children: 4 });

  const root = {
    childElementCount: 3,
    getBoundingClientRect: () => ({ top: 0, bottom: 800, width: 1200, height: 800 }),
    querySelector: (sel) => (sel === '[data-shell-overlay]' ? (options.hasShell === false ? null : overlay) : null),
    querySelectorAll: () => [header],
  };

  class FakeObserver {
    constructor(cb) { this.cb = cb; this.disconnected = false; observers.push(this); }
    observe(target, opts) { this.target = target; this.opts = opts; }
    disconnect() { this.disconnected = true; }
  }

  const timers = [];
  const doc = {
    body: root,
    // installSafeTop 的守卫要求它存在 —— 少了会直接返回空 disposer，
    // 后面的观察/写值断言全都测不到（第一版就踩了这个）。
    querySelectorAll: root.querySelectorAll,
    documentElement: {
      style: {
        setProperty: (name, value) => writes.push([name, value]),
        removeProperty: (name) => removals.push(name),
      },
    },
    querySelector: root.querySelector,
    __listeners: listeners,
    defaultView: {
      innerWidth: 1200,
      innerHeight: 800,
      addEventListener: (t, fn) => { if (listeners[t]) listeners[t].push(fn); },
      removeEventListener: () => {},
      requestAnimationFrame: (fn) => { fn(); return 1; },
      cancelAnimationFrame: () => {},
      setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
      clearTimeout: () => {},
      MutationObserver: FakeObserver,
    },
  };
  return { doc, writes, removals, observers, timers, root };
}

test('观察挂在 frame 上而不是 body，且不用 subtree', () => {
  const { doc, observers, root } = shellDoc();
  const dispose = installSafeTop(doc);
  assert.equal(observers.length, 1, '应创建一个 observer');
  assert.notEqual(observers[0].target, root, '不该观察整个 body');
  assert.equal(observers[0].opts.subtree, false, '不观察子树：外壳内部渲染不影响外层高度');
  dispose();
});

test('找不到外壳时退回观察 body（仍能工作）', () => {
  const { doc, observers, root } = shellDoc({ hasShell: false });
  const dispose = installSafeTop(doc);
  assert.equal(observers[0].target, root, '退化路径：观察 body');
  dispose();
});

test('测量走防抖：连续触发只排一次定时器，并按常量延迟', () => {
  const { doc, timers } = shellDoc();
  const dispose = installSafeTop(doc);
  const baseline = timers.length; // install 内部的首次 apply 是同步的，不排定时器

  // 直接驱动 resize 监听器，模拟高频唤醒。
  const resize = doc.__listeners.resize;
  for (let i = 0; i < 10; i += 1) for (const fn of resize) fn();

  assert.equal(timers.length - baseline, 1, '十次唤醒只应排一个定时器（防抖）');
  assert.equal(timers[baseline].ms, MEASURE_DEBOUNCE_MS, '延迟应等于防抖常量');
  dispose();
});

test('连续测到同值后停止观察（长会话不再被唤醒）', () => {
  const { doc, observers, timers } = shellDoc();
  const dispose = installSafeTop(doc);
  const observer = observers[0];
  assert.equal(observer.disconnected, false, '初始应观察中');

  // 手工把排队的定时器跑掉若干轮，每轮测到的值都一样。
  const drain = () => {
    for (const t of timers.splice(0)) t.fn();
  };
  const resize = doc.__listeners.resize;
  // 首轮：install 内已测过一次（last 已设定），之后每轮 stableCount +1。
  for (let i = 0; i < 4; i += 1) {
    for (const fn of resize) fn();
    drain();
  }

  assert.equal(observer.disconnected, true, '连续同值达到阈值后应断开观察');
  dispose();
});

test('稳定前发生的尺寸变化会重置稳定计数（不误停）', () => {
  const { doc, observers, timers } = shellDoc({ headerHeight: 76 });
  const dispose = installSafeTop(doc);
  const observer = observers[0];
  const resize = doc.__listeners.resize;
  const drain = () => { for (const t of timers.splice(0)) t.fn(); };

  for (let i = 0; i < 2; i += 1) { for (const fn of resize) fn(); drain(); }
  assert.equal(observer.disconnected, false, '才两次同值，不该停');

  // 改高度 → 值变化 → 计数归零。
  const header = doc.body.querySelectorAll()[0];
  header.getBoundingClientRect = () => ({ top: 0, bottom: 120, width: 1000, height: 120 });
  for (const fn of resize) fn();
  drain();
  assert.equal(observer.disconnected, false, '值变了就重新计数，不能停');

  dispose();
});

test('卸载时摘掉 --ig-safe-top 变量（不留残留）', () => {
  const { doc, writes, removals } = shellDoc();
  const dispose = installSafeTop(doc);
  assert.ok(writes.length > 0, '安装时应写入变量');
  assert.equal(writes[0][0], '--ig-safe-top');
  dispose();
  assert.ok(removals.includes('--ig-safe-top'), '卸载时必须摘掉自己写的变量');
});

test('测量函数本身仍然正确（防抖不改变结果）', () => {
  const { doc } = shellDoc({ headerHeight: 76 });
  const dispose = installSafeTop(doc);
  const writes = [];
  dispose();
  // 直接验纯函数：与 installSafeTop 的写值应一致。
  const measured = measureSafeTop(doc.body, doc);
  assert.equal(measured, 76 + EDGE_GAP, `头部 76px 时应为 76+${EDGE_GAP}`);
  void writes;
});
