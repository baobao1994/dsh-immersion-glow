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
      // 默认没有宿主锚点，走几何兜底路径。
      querySelector: () => null,
    },
    doc: { defaultView: { innerWidth: vw, innerHeight: vh } },
  };
}

/**
 * 造一个带宿主锚点的树：`[data-shell-overlay]` 的顶边就是外壳让开的位置。
 * 这是首选举据 —— 宿主自己声明的契约，不依赖类名或几何猜测。
 */
function fakeTreeWithAnchor(anchorTop, vw = 1200, vh = 800) {
  const anchor = {
    childElementCount: 1,
    getBoundingClientRect: () => ({ top: anchorTop, bottom: vh, width: vw, height: vh - anchorTop }),
  };
  return {
    root: {
      querySelector: (selector) => (selector === '[data-shell-overlay]' ? anchor : null),
      querySelectorAll: () => [],
    },
    doc: { defaultView: { innerWidth: vw, innerHeight: vh } },
  };
}

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
// ── 首选举据：宿主标记的 data-shell-overlay ──────────────────────────

test('首选 data-shell-overlay 的顶边（宿主自己声明的边界）', () => {
  const { root, doc } = fakeTreeWithAnchor(56);
  assert.equal(measureSafeTop(root, doc), 56 + OFFSET_AFTER_EDGE);
});

test('锚点优先于几何：即使几何给出更小的值也以锚点为准', () => {
  const { root, doc } = fakeTreeWithAnchor(56);
  // 塞一个顶边更小的几何候选，锚点仍应胜出。
  root.querySelectorAll = () => [
    { childElementCount: 3, getBoundingClientRect: () => ({ top: 0, bottom: 20, width: 1200, height: 20 }) },
  ];
  assert.equal(measureSafeTop(root, doc), 56 + OFFSET_AFTER_EDGE, '锚点是宿主契约，优先');
});

test('锚点被推到异常位置时退回几何（不盲信）', () => {
  // 锚点在视口很下方（比如全屏模式被布局挪走）—— 这时的值是错的，
  // 宁可走几何兜底也不要照抄。
  const { root, doc } = fakeTreeWithAnchor(600);
  root.querySelectorAll = () => [
    { childElementCount: 3, getBoundingClientRect: () => ({ top: 0, bottom: 50, width: 1200, height: 50 }) },
  ];
  assert.equal(
    measureSafeTop(root, doc),
    50 + OFFSET_AFTER_EDGE,
    '锚点位置异常时走几何',
  );
});

test('锚点负坐标（滚出视口）时退回几何', () => {
  const { root, doc } = fakeTreeWithAnchor(-10);
  root.querySelectorAll = () => [
    { childElementCount: 3, getBoundingClientRect: () => ({ top: 0, bottom: 48, width: 1200, height: 48 }) },
  ];
  assert.equal(measureSafeTop(root, doc), 48 + OFFSET_AFTER_EDGE);
});

test('根上没有 querySelector 时安全退回几何路径', () => {
  const { root, doc } = fakeTree({
    nodes: [{ top: 0, height: 52, width: 1200, children: 5 }],
  });
  delete root.querySelector;
  assert.equal(measureSafeTop(root, doc), 52 + OFFSET_AFTER_EDGE);
});

test('querySelector 抛错时不崩（退回几何）', () => {
  const { root, doc } = fakeTree({
    nodes: [{ top: 0, height: 52, width: 1200, children: 5 }],
  });
  root.querySelector = () => {
    throw new Error('boom');
  };
  // 真实宿主里这不会发生，但测量失败不该把插件打崩 —— 它只是个布局微调。
  assert.doesNotThrow(() => measureSafeTop(root, doc), '测量失败不该抛');
});

// ── 方向性回归：偏移越大 = 越靠下 ────────────────────────────────────
//
// v8/v9 我连续把偏移调小，以为「数字小 = 下来一点」，实际是「数字小 = 往上」，
// 用户连三轮反馈「越来越高」。这组测试锁死语义，避免再反。

test('EDGE_GAP 是向下让出的距离：结果 = 外壳底边 + EDGE_GAP', () => {
  const { root, doc } = fakeTreeWithAnchor(56);
  const top = measureSafeTop(root, doc);
  assert.equal(top, 56 + EDGE_GAP, '必须是相加，不是相减');
  assert.ok(top > 56, '结果必须在外壳底边之下（视觉上更靠下）');
});

test('偏移量足以离开导航栏：落点在内容区内部', () => {
  const { root, doc } = fakeTreeWithAnchor(56);
  const top = measureSafeTop(root, doc);
  // 至少要让出 20px 才算「在对话框内部」，否则仍像贴着导航栏。
  assert.ok(top - 56 >= 20, `落点应明显低于导航栏下沿，实际只差 ${top - 56}px`);
});

test('兜底值也落在内容区（不小于外壳 + 一档偏移）', () => {
  const { root, doc } = fakeTree({ nodes: [] });
  const top = measureSafeTop(root, doc);
  assert.ok(top >= 56 + 10, `兜底值 ${top} 应落在内容区，而不是贴着顶端`);
});
