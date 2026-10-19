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

// ── 10. 每个 store action 都必须有 UI 调用点 ─────────────────────────
//
// 这条检查来自三次真实事故（v12 的「未读永远消不掉」最典型）：
//
//   v6 把提醒从独立卡片改成计时器状态时删掉了 ReminderCard 组件，
//   而 `openMeter` / `dismissReminder` 的**唯一调用点**就在那个组件里。
//   两个 action 定义完整、单测全绿，却没有任何 UI 调用它们 —— 提醒变成
//   永远消不掉的红点，状态机测试完全测不出来。
//
// 「状态层有实现」不等于「功能可用」。所以这里做静态接线检查：state.js 里
// 定义的每个 action，都必须在本文件之外被 `actions.X` 或 `handlers.X` 调到。
//
// 白名单只放真正需要例外的：由外部（测试 / 宿主）驱动的，或者刻意保留的。
const ACTION_ALLOWLIST = new Set([
  // 测试直接驱动状态机，不需要 UI 入口。
  'resetAll',        // 设置行的「清除数据」用 handlers 包装，但 action 名不同
  'resetTransient',  // apply() 启动时调用（在 index.js 里，算调用点）
  'rollDay',         // tick 内部调用
  'switchSession',   // 探针认领 / sessions 订阅调用
  'writeSession',    // 探针泵数据调用
  'setSessionModel', // 探针调用
  'countImpression', // tick 触发阈值时调用
]);

{
  const stateSource = readFileSync(join(ROOT, 'src', 'client', 'state.js'), 'utf8');

  // 宽匹配：所有「4 空格缩进的 name(」——actions 对象里的方法简写。
  const broad = [...stateSource.matchAll(/^    ([a-zA-Z][a-zA-Z0-9]*)\(/gm)].map((m) => m[1]);
  // 窄匹配：进一步要求首参叫 draft（下面的接线检查要用它来定位 action）。
  const declared = [...stateSource.matchAll(/^    ([a-zA-Z][a-zA-Z0-9]*)\(draft/gm)].map((m) => m[1]);

  expect(declared.length > 10, `没能从 state.js 解析出 action 列表（只找到 ${declared.length} 个），检查正则是否与写法脱节`);

  // ⚠ 自洽校验：窄匹配必须覆盖全部宽匹配。
  //
  // 只断言「> 10 个」是不够的 —— 它只能发现「解析全崩」，发现不了「24 个里少了 1 个」。
  // 若某个 action 的首参不叫 draft（改名、或写成 foo(state, …)），它就会**悄悄**
  // 退出接线检查，而检查照样报绿。一条静默漏检的检查比没有检查更危险：
  // 它给人「已经守住了」的错觉。
  const uncovered = broad.filter((name) => !declared.includes(name));
  expect(
    broad.length === declared.length,
    `action 解析可能漏项：宽匹配 ${broad.length} 个、窄匹配 ${declared.length} 个；未被检查的：${uncovered.join(', ')}。` +
      '若确实改了首参名，请同步更新本检查的正则',
  );

  // 除 state.js 外的所有客户端源码 + 全部测试：任何一个调过就算接上了。
  const consumers = [
    ...sourceFiles.filter((name) => name !== 'state.js').map((name) => readFileSync(join(clientDir, name), 'utf8')),
    ...(existsSync(join(ROOT, 'test'))
      ? readdirSync(join(ROOT, 'test')).filter((n) => n.endsWith('.mjs')).map((n) => readFileSync(join(ROOT, 'test', n), 'utf8'))
      : []),
  ].join('\n');

  for (const action of declared) {
    if (ACTION_ALLOWLIST.has(action)) continue;
    const pattern = new RegExp(`(?:actions|handlers)[.$]${action}\\b`);
    expect(
      pattern.test(consumers),
      `state.js 的 action "${action}" 没有任何调用点 —— 状态层有实现但功能不可用（参见 v12 未读提醒事故）。要么接上 UI，要么删掉它，要么加进 ACTION_ALLOWLIST 并说明理由`,
    );
  }
}

// ── 11. 测试文件里不能有「被注释掉」的测试 ──────────────────────────
//
// 这条来自一次真实的假绿：safe-top.test.mjs 里残留了一个孤立的块注释起始符
// （`/**` 后面又紧跟一个 `/**`），把**前 9 个测试整段注释掉了** —— 包括全部
// 核心几何单测。而 `npm test` 一直报「全绿」，因为被注释掉的测试根本没注册，
// 报出来的数字里压根没有它们。测试少几个是不会有人注意的。
//
// 做法：把注释**遮蔽成空白**（保留换行），再数「以 test( 开头的行」。
// 遮蔽后比遮蔽前少，就说明有测试躺在注释里。
{
  const testDir = join(ROOT, 'test');
  const testFiles = existsSync(testDir)
    ? readdirSync(testDir).filter((name) => name.endsWith('.test.mjs'))
    : [];

  /**
   * 把注释替换成等长空白（换行保留），其余原样。
   *
   * @param src - 源码。
   * @returns { text, unclosed } —— unclosed 为真表示块注释没闭合。
   */
  const maskComments = (src) => {
    const out = src.split('');
    let inBlock = false;
    let inLine = false;
    for (let i = 0; i < src.length; i += 1) {
      const c = src[i];
      const next = src[i + 1];
      if (c === '\n') {
        inLine = false;
        continue;
      }
      if (inLine) {
        out[i] = ' ';
        continue;
      }
      if (inBlock) {
        if (c === '*' && next === '/') {
          out[i] = ' ';
          out[i + 1] = ' ';
          i += 1;
          inBlock = false;
          continue;
        }
        out[i] = ' ';
        continue;
      }
      if (c === '/' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 1;
        inLine = true;
        continue;
      }
      if (c === '/' && next === '*') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 1;
        inBlock = true;
        continue;
      }
    }
    return { text: out.join(''), unclosed: inBlock };
  };

  /** 以 test( 开头的行号（1 基）。 */
  const testLines = (text) =>
    text
      .split('\n')
      .map((line, index) => (line.trimStart().startsWith('test(') ? index + 1 : 0))
      .filter((n) => n !== 0);

  for (const name of testFiles) {
    const src = readFileSync(join(testDir, name), 'utf8');
    const masked = maskComments(src);

    expect(!masked.unclosed, `${name}: 块注释没有闭合 —— 它会把文件剩下的内容全部注释掉`);

    const before = testLines(src);
    const after = testLines(masked.text);
    const lost = before.filter((n) => !after.includes(n));

    expect(
      lost.length === 0,
      `${name}: 第 ${lost.join(', ')} 行的 test( 落在注释里，不会被注册。` +
        '这类问题不会让 npm test 变红，只会让测试无声消失（曾真实发生：9 个核心几何单测被一个孤立块注释吃掉）',
    );
    expect(before.length > 0, `${name}: 一个 test( 都没解析到，检查文件是否写坏`);
  }
}

// ── 汇总 ───────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ 产物自检失败（${failures.length} 项）：`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(
  `✓ 产物自检通过（清单 / patch / locale / 零网络 / require 白名单 / action 接线 / 测试健康 / 沙箱注册 ${sourceFiles.length} 个模块）`,
);
