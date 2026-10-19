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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadModule() {
  const source = readFileSync(join(ROOT, 'src', 'client', 'safe-top.js'), 'utf8');
  const declared = [...source.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  const sandbox = {
    console, Date, Math, Number, Object, Array, JSON, Set, Map, String, RegExp, Symbol, Promise,
  };
  const context = createContext(sandbox);
  runInContext(`${source}\n;globalThis.__names = ${JSON.stringify(declared)};`, context);
  const names = runInContext('globalThis.names', context) ?? runInContext('globalThis.__names', context);
  const exported = {};
  for (const key of names) {
    try {
      exported[key] = runInContext(key, context);
    } catch (_error) {
      // 注释里出现的名字取不到，跳过。
    }
  }
  return exported;
}

const { measureSafeTop, installSafeTop, FALLBACK_TOP, EDGE_GAP } = loadModule();

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

/**
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
