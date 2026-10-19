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

const { measureSafeTop, installSafeTop, FALLBACK_TOP } = loadModule();

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

test('量出最上方的通栏外壳', () => {
  const { root, doc } = fakeTree({
    nodes: [
      { top: 0, height: 52, width: 1200, children: 5 }, // 外壳
      { top: 52, height: 700, width: 900, children: 20 }, // 正文
    ],
  });
  assert.equal(measureSafeTop(root, doc), 52 + 12, '外壳底边 + 12px');
});

test('多个通栏候选时取最靠上的那个', () => {
  const { root, doc } = fakeTree({
    nodes: [
      { top: 0, height: 30, width: 1200, children: 3 },
      { top: 30, height: 40, width: 1100, children: 3 },
    ],
  });
  assert.equal(measureSafeTop(root, doc), 30 + 12, '取最小的底边');
});

test('窄容器（按钮条之类）不算外壳', () => {
  const { root, doc } = fakeTree({
    nodes: [
      { top: 0, height: 30, width: 300, children: 3 }, // 只有 300 宽
      { top: 0, height: 52, width: 1200, children: 5 },
    ],
  });
  assert.equal(measureSafeTop(root, doc), 52 + 12);
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
  assert.equal(measureSafeTop(root, doc), 52 + 12);
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
  assert.equal(writes[0][1], '68px', '56 + 12');
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