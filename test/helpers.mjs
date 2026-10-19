/**
 * 测试共用替身。
 *
 * ## 为什么要有这个文件
 *
 * 这些替身原先**散在 6 个测试文件里各写一遍**：
 *
 *   - `fakeReact` / `fakeStoreModule` / `makeFakeCtx`：client-load 与 v4-flow
 *     逐字复制（只在注释和换行上不同，但已经出现真实行为分歧 ——
 *     一份的 store 替身多一个 `clearPersisted`，另一份没有）；
 *   - `loadModule`：timing / metrics / model-log / safe-top 四份，
 *     **沙箱全局还不一样**（safe-top 多给 `Symbol`/`Promise`，其余没有）。
 *
 * 后果不是"多写了几行"，而是：
 *
 * 1. `fakeReact` 的 `useEffect` 语义是**关键契约**（"立即执行"这个选择本身
 *    就是为了让探针的写回可测）。两份副本一旦分叉，同一个 bug 会在一个文件里
 *    红、另一个文件里绿。
 * 2. 沙箱全局不同 ⇒ **同一个模块在不同测试文件里的可加载性不同**。
 *    实际踩过：`model-log.js` 依赖 `timing.js` 的 `satisfiedCount`，
 *    而某个 `loadModules` 调用没带上 timing，于是报 ReferenceError。
 *
 * 现在只保留一份，全局取并集。
 */

import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 沙箱里可用的全局。
 *
 * 刻意**取并集并放宽**：多给一个全局不会有副作用，少给一个会变成难查的
 * ReferenceError（而且只在某个测试文件里出现）。
 */
const SANDBOX_GLOBALS = {
  console,
  Date,
  Math,
  Number,
  Object,
  Array,
  JSON,
  Set,
  Map,
  WeakMap,
  WeakSet,
  String,
  RegExp,
  Symbol,
  Promise,
  Boolean,
  Error,
  TypeError,
  isNaN,
  parseInt,
  parseFloat,
};

/**
 * 在沙箱里求值若干客户端模块，按名字暴露它们的顶层声明。
 *
 * 模块之间没有 import/export（它们共享构建时的一个闭包），所以要一次把依赖
 * 全传进来：`loadModules(['timing.js', 'model-log.js'])`。
 *
 * @param names - 单个文件名或文件名数组，相对于 `src/client/`。
 * @returns 顶层声明的字典。
 */
export function loadModules(names) {
  const list = Array.isArray(names) ? names : [names];
  const sources = list
    .map((name) => readFileSync(join(ROOT, 'src', 'client', name), 'utf8'))
    .join('\n');
  const declared = [...sources.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(
    (m) => m[1],
  );

  const context = createContext({ ...SANDBOX_GLOBALS });
  runInContext(`${sources}\n;globalThis.__names = ${JSON.stringify(declared)};`, context);

  const exported = {};
  for (const key of runInContext('globalThis.__names', context)) {
    try {
      exported[key] = runInContext(key, context);
    } catch (_error) {
      // 注释里出现过的名字取不到，跳过。
    }
  }
  return exported;
}

/** 单个模块的简写（等价于 `loadModules([name])`）。 */
export function loadModule(name) {
  return loadModules(name);
}

/**
 * 极简 React 替身。
 *
 * `useEffect` **立即执行**（真实 React 是提交后执行）——这样探针的
 * `writeSession` 才会真的跑，「写没写 store」的断言才有意义。
 */
export function fakeReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() }),
    Fragment: { __fragment: true },
    useState: (value) => [value, () => {}],
    useEffect: (fn) => {
      fn();
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
  };
}

/**
 * store 替身。
 *
 * ⚠ `persist` 是**整体替换**而不是合并（复刻真实实现），所以恢复出来的 state
 * 必须经过 `migrateState`。这里如实复刻这一点，否则测试会掩盖迁移缺陷。
 *
 * `clearPersisted` 是 client-load 那份副本独有的：取并集，两边都能用。
 */
export function fakeStoreModule(storage) {
  return {
    defineStore: (spec) => ({
      spec,
      create() {
        let state = spec.init();
        const raw = storage === undefined ? null : storage.getItem('immersion-glow.v1');
        if (raw !== null && raw !== undefined) {
          state = JSON.parse(raw); // 整体替换，复刻「非合并」语义。
        }
        const actions = {};
        for (const [key, mutate] of Object.entries(spec.actions)) {
          actions[key] = (...args) => mutate(state, ...args);
        }
        return {
          actions,
          getSnapshot: () => state,
          subscribe: () => () => {},
          clearPersisted: () => {},
        };
      },
    }),
  };
}

/**
 * ctx 替身：记录所有注册与副作用，供断言。
 *
 * ⚠ `services` 参数不能省：`ctx.get(name)` 要能返回注入的服务，
 * client-load 的用例靠它替换真实的 store / react。
 */
export function makeFakeCtx(services = {}) {
  const record = {
    effects: [],
    registered: [],
    provideRootCalls: [],
    domListeners: [],
    intervals: [],
  };

  let disposers = [];

  const ctx = {
    effect: (execute, label) => {
      record.effects.push(label ?? 'anonymous');
      const disposer = typeof execute === 'function' ? execute() : undefined;
      const normalized = typeof disposer === 'function' ? disposer : () => {};
      disposers.push(normalized);
      return normalized;
    },
    get: (name) => (Object.prototype.hasOwnProperty.call(services, name) ? services[name] : undefined),
    slots: {
      provideRoot: (contribution) => {
        record.provideRootCalls.push(contribution);
        return () => {};
      },
      inject: (key, callback) => {
        record.registered.push({ kind: 'inject', key });
        // 立即执行回调，等价于插槽已声明就绪的分支。
        const inner = callback();
        return typeof inner === 'function' ? inner : () => {};
      },
      register: (options, component) => {
        record.registered.push({ kind: 'register', name: options.name, id: options.id, component });
        return () => {};
      },
    },
  };

  /** 依次调用所有 effect 的 disposer，模拟插件卸载。 */
  const disposeAll = () => {
    for (const disposer of disposers) disposer();
    disposers = [];
  };

  return { ctx, record, disposeAll };
}

/** 把 class 属性读成字符串数组（兼容 class / className 两种写法）。 */
function classesOf(node) {
  const props = node.props ?? {};
  return String(props.class ?? props.className ?? '')
    .split(/\s+/)
    .filter((part) => part.length > 0);
}

/**
 * 递归渲染函数式组件，收集所有带指定 class 的节点。
 *
 * ⚠ 深度上限只是防御组件互相渲染导致的死循环，**不该成为查找边界**。
 * 早先设成 12，而画廊的树（layer → Gallery → 面板 → ul → li → div → span…）
 * 比这更深，于是静默返回"未找到"，把断言变成假阴性 —— 排查了很久。
 */
const MAX_DEPTH = 40;

export function findAllByClass(node, className, out = [], depth = 0) {
  if (node === null || node === undefined || depth > MAX_DEPTH) return out;
  if (Array.isArray(node)) {
    for (const child of node) findAllByClass(child, className, out, depth + 1);
    return out;
  }
  if (typeof node !== 'object') return out;
  if (typeof node.type === 'function') {
    return findAllByClass(node.type(node.props ?? {}), className, out, depth + 1);
  }
  if (classesOf(node).includes(className)) out.push(node);
  findAllByClass(node.children, className, out, depth + 1);
  return out;
}

/** 找第一个带指定 class 的节点。 */
export function findByClass(node, className) {
  const found = findAllByClass(node, className);
  return found.length > 0 ? found[0] : null;
}

/** 拼接一棵元素树里的可视文本（用于「文案是否出现」类断言）。 */
export function collectText(node, depth = 0) {
  if (node === null || node === undefined || depth > MAX_DEPTH) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((child) => collectText(child, depth + 1)).join('');
  if (typeof node !== 'object') return '';
  if (typeof node.type === 'function') return collectText(node.type(node.props ?? {}), depth + 1);
  return collectText(node.children, depth + 1);
}
