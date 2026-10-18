/**
 * 构建产物与清单的自检。`npm run check` 的最后一步。
 *
 * 每一项都对应一次真实踩过或极易踩的坑：
 *   - exports / files 齐全 → 否则 dsh plugin add 后静默不加载；
 *   - patch 的 name === 包名 → 复制粘贴别的插件时最容易漏；
 *   - lib/client.js 形状正确 → factory(require) 只有一个参数；
 *   - locale/*.json 可解析且有 meta → 插件管理卡才能显示中文名；
 *   - lib/ 里没有网络 API → 守住零网络约束；
 *   - 没有 require 平台以外的包 → 避免改动即崩；
 *   - 没有模块级 store 导出 → 守则明令禁止的伪装单例；
 *   - src/client 每个 .js 都被内联 → 防止新增模块忘了登记。
 *
 * @module tools/verify-bundle
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 收集到的失败项。 */
const failures = [];

/** 记录一条失败。 */
function fail(message) {
  failures.push(message);
}

/** 断言。 */
function expect(condition, message) {
  if (!condition) fail(message);
}

/** 读 JSON。 */
function readJson(relative) {
  return JSON.parse(readFileSync(join(ROOT, relative), 'utf8'));
}

// ── 1. package.json 清单 ───────────────────────────────────────────────
const pkg = readJson('package.json');

expect(typeof pkg.name === 'string' && pkg.name.length > 0, 'package.json 缺 name');
expect(typeof pkg.version === 'string', 'package.json 缺 version');
expect(pkg.type === 'module', 'package.json type 必须是 module');

const exportsField = pkg.exports ?? {};
for (const key of ['.', './client', './cordis.patch.yml', './package.json']) {
  expect(
    typeof exportsField[key] === 'string' || typeof exportsField[key] === 'object',
    `package.json exports 缺 ${key}`,
  );
}
expect(
  typeof exportsField['./locale/*.json'] === 'string',
  'package.json exports 缺 ./locale/*.json（插件管理卡的中文名读不到）',
);

const files = Array.isArray(pkg.files) ? pkg.files : [];
for (const entry of ['lib', 'locale', 'cordis.patch.yml', 'README.md', 'README.zh.md']) {
  expect(files.includes(entry), `package.json files 缺 ${entry}`);
}

expect(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch 必须指向 ./cordis.patch.yml');
expect(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform 必须是 web');

// dsh.client.inject 只影响加载排序、不提供服务。留空是有意的，写死校验防止
// 后人误以为它能提供依赖而往里堆包名。
expect(
  pkg.dsh?.client?.inject === undefined || pkg.dsh.client.inject.length === 0,
  'dsh.client.inject 应为空：它不提供依赖，只影响加载顺序',
);

// peerDependencies 必须是本机实际版本区间，且 optional —— 否则 pnpm 会因
// 预发布版本不满足范围而报冲突。
const peers = pkg.peerDependencies ?? {};
expect(typeof peers.react === 'string', 'peerDependencies 缺 react');
expect(typeof peers['@deepseek-ai/cordis'] === 'string', 'peerDependencies 缺 @deepseek-ai/cordis');
const peerMeta = pkg.peerDependenciesMeta ?? {};
expect(peerMeta.react?.optional === true, 'peerDependenciesMeta.react 必须 optional');
expect(
  peerMeta['@deepseek-ai/cordis']?.optional === true,
  'peerDependenciesMeta["@deepseek-ai/cordis"] 必须 optional',
);
for (const key of Object.keys(peers)) {
  expect(
    !key.startsWith('@deepseek-ai/dsh-'),
    `peerDependencies 不应声明 ${key}：client 包由平台静态模块表提供，不经 node_modules`,
  );
}

// ── 2. cordis.patch.yml ────────────────────────────────────────────────
const patchPath = join(ROOT, 'cordis.patch.yml');
expect(existsSync(patchPath), '缺 cordis.patch.yml');
if (existsSync(patchPath)) {
  const patch = readFileSync(patchPath, 'utf8');
  expect(patch.includes('insert:'), 'cordis.patch.yml 缺 insert');
  expect(
    patch.includes(`name: ${pkg.name}`),
    `cordis.patch.yml 的 name 必须是 ${pkg.name}（复制粘贴别的插件时最易漏）`,
  );
}

// ── 3. 产物存在性 ──────────────────────────────────────────────────────
for (const file of ['lib/index.js', 'lib/client.js']) {
  expect(existsSync(join(ROOT, file)), `缺产物 ${file}（先跑 npm run build）`);
}

// ── 4. locale 文件 ─────────────────────────────────────────────────────
for (const lang of ['zh', 'en']) {
  const relative = `locale/${lang}.json`;
  const path = join(ROOT, relative);
  expect(existsSync(path), `缺 ${relative}`);
  if (!existsSync(path)) continue;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    expect(
      typeof parsed.meta?.title === 'string' && parsed.meta.title.length > 0,
      `${relative} 缺 meta.title`,
    );
    expect(
      typeof parsed.meta?.description === 'string' && parsed.meta.description.length > 0,
      `${relative} 缺 meta.description`,
    );
  } catch (error) {
    fail(`${relative} 不是合法 JSON：${String(error)}`);
  }
}

// ── 5. 源码模块全部被内联 ──────────────────────────────────────────────
const clientDir = join(ROOT, 'src', 'client');
const sourceFiles = existsSync(clientDir)
  ? readdirSync(clientDir).filter((name) => name.endsWith('.js')).sort()
  : [];
const clientBundleText = existsSync(join(ROOT, 'lib', 'client.js'))
  ? readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8')
  : '';
for (const file of sourceFiles) {
  expect(
    clientBundleText.includes(`src/client/${file}`),
    `src/client/${file} 没有被内联进 lib/client.js（在 tools/build-client.mjs 的 MODULES 里登记它）`,
  );
}

// ── 6. 零网络约束 ──────────────────────────────────────────────────────
/**
 * 去掉注释后的代码文本。
 *
 * 静态检查必须只看真实代码：源文件里大量注释在解释「为什么不用 fetch」「为什么
 * 不 require ui-primitives」，如果连注释一起扫，检查会被自己的说明文字打成误报。
 *
 * 朴素但够用：块注释整体删除；行注释只在行首（允许前导空白）或前面是空白时
 * 视为注释，避免把 `https://` 这类字符串误当注释切掉。
 *
 * @param source - 原始源码。
 * @returns 去掉注释的文本。
 */
function stripComments(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return withoutBlocks
    .split('\n')
    .map((line) => {
      const marker = line.search(/(^|[\s;{}()])\/\//);
      if (marker === -1) return line;
      const index = line.indexOf('//', marker);
      return index === -1 ? line : line.slice(0, index);
    })
    .join('\n');
}

const clientCode = stripComments(clientBundleText);
const hostCode = stripComments(readFileSync(join(ROOT, 'lib', 'index.js'), 'utf8'));

const NETWORK_PATTERNS = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /sendBeacon/,
  /\bEventSource\b/,
  /navigator\.connection/,
];
for (const pattern of NETWORK_PATTERNS) {
  expect(!pattern.test(clientCode), `lib/client.js 出现网络 API（${pattern}），违反零网络约束`);
  expect(!pattern.test(hostCode), `lib/index.js 出现网络 API（${pattern}），违反零网络约束`);
}

// ── 7. 只 require 平台基线 ─────────────────────────────────────────────
const ALLOWED_REQUIRE = new Set(['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-store']);
const requireMatches = [...clientCode.matchAll(/require\(\s*'([^']+)'\s*\)/g)];
for (const match of requireMatches) {
  expect(
    ALLOWED_REQUIRE.has(match[1]),
    `lib/client.js require 了平台基线以外的 "${match[1]}"；守则禁止 require 其他 Harness Client 包`,
  );
}

// ── 8. 无模块级 store 导出 ─────────────────────────────────────────────
// 守则原文："Never export a handle at module level — module-cache identity is
// a disguised singleton across plugin reloads."
expect(
  !/^(?:export\s+)?(?:const|let|var)\s+\w*[Ss]tore\w*\s*=\s*defineStore/m.test(clientBundleText),
  'src 里出现模块级 defineStore（伪装单例）；必须在 apply() 内构造',
);

// ── 9. 产物可在沙箱中加载并注册三处 ────────────────────────────────────
if (clientBundleText.length > 0) {
  let spec = null;
  /** 最小 React 替身：足够让模块体求值与组件签名存在。 */
  const fakeReact = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    Fragment: Symbol('Fragment'),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
    useRef: (value) => ({ current: value }),
    useMemo: (fn) => fn(),
  };

  /** 记录注册调用的假 ctx。 */
  const registered = [];
  const fakeCtx = {
    effect: (fn, label) => {
      const disposer = typeof fn === 'function' ? fn() : undefined;
      return typeof disposer === 'function' ? disposer : () => {};
    },
    get: (name) => (name === 'locale' ? undefined : undefined),
    slots: {
      provideRoot: () => () => {},
      inject: (key, callback) => {
        registered.push({ key, callback });
        return () => {};
      },
      register: (options, component) => {
        registered.push({ options, component });
        return () => {};
      },
    },
  };

  const sandbox = {
    window: {
      __ModuleLoader__: { load: (value) => { spec = value; } },
      addEventListener: () => {},
      removeEventListener: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
      setTimeout: () => 0,
      clearTimeout: () => {},
    },
    document: {
      visibilityState: 'visible',
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({
        style: {},
        dataset: {},
        setAttribute() {},
        select() {},
        appendChild() {},
        removeChild() {},
        parentNode: null,
      }),
      querySelector: () => null,
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
    },
    require: (name) => {
      if (name === 'react') return fakeReact;
      if (name === '@deepseek-ai/dsh-client-store') {
        return {
          defineStore: (spec_) => ({
            spec: spec_,
            create: () => ({
              actions: Object.fromEntries(Object.keys(spec_.actions).map((key) => [key, () => {}])),
              getSnapshot: () => spec_.init(),
              subscribe: () => () => {},
              clearPersisted: () => {},
            }),
          }),
        };
      }
      throw new Error(`unexpected require(${JSON.stringify(name)})`);
    },
    console,
    Date,
    Math,
    JSON,
    Number,
    Object,
    Array,
    Set,
    Map,
    RegExp,
    Symbol,
    Promise,
    Error,
  };

  try {
    runInContext(clientBundleText, createContext(sandbox));
    expect(spec !== null, 'lib/client.js 没有调用 window.__ModuleLoader__.load');
    if (spec !== null) {
      expect(spec.id === pkg.name, `__ModuleLoader__ 的 id 必须是包名（实际 ${String(spec.id)}）`);
      expect(typeof spec.factory === 'function', 'factory 必须是函数');
      const exported = spec.factory(sandbox.require);
      expect(Array.isArray(exported.inject), 'client 必须导出 inject 数组');
      expect(exported.inject.includes('slots'), 'client inject 必须含 slots');
      // 只允许 slots：可选服务写进 inject 会让 fiber pending 拖垮整个前端。
      expect(
        exported.inject.length === 1,
        `client inject 应只有 slots（实际 ${JSON.stringify(exported.inject)}）`,
      );
      expect(typeof exported.apply === 'function', 'client 必须导出 apply');
      exported.apply(fakeCtx);
      const keys = registered.filter((item) => item.key !== undefined).map((item) => item.key);
      for (const slot of ['shell.overlay', 'settings.general.item', 'conversation.input.left']) {
        expect(keys.includes(slot), `apply() 没有注册到 ${slot}`);
      }
    }
  } catch (error) {
    fail(`lib/client.js 在沙箱中加载失败：${String(error)}`);
  }
}

// ── 汇总 ───────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ 产物自检失败（${failures.length} 项）：`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`✓ 产物自检通过（清单 / patch / locale / 零网络 / require 白名单 / 沙箱注册 ${sourceFiles.length} 个模块）`);
