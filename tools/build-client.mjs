/**
 * 把 src/client/*.js 按固定顺序内联成一个 DSH 可加载的浏览器 bundle。
 *
 * 为什么不引打包器：DSH 的浏览器插件协议只有一条要求 —— 产物加载时调用
 *
 *     window.__ModuleLoader__.load({ id, factory })
 *
 * `factory(require)` 只有一个参数（不是 CommonJS 的 (require, module, exports)），
 * 返回 { name?, inject, apply }。`require` 只能命中平台静态表（react、
 * react/jsx-runtime、@deepseek-ai/cordis、@deepseek-ai/dsh-client-store、
 * @deepseek-ai/dsh-client-ui-slots 等）或编译器产物。
 *
 * 本机 `dsh-trae-checkin` 已证明这种手写产物在生产可用，因此这里付出 ~80 行
 * 换掉一整套 tsdown 工具链：零依赖、产物可读、可 diff、可 node --test 直接
 * import 源文件。
 *
 * 约定（构建脚本据此拼接，模块之间不要用 import/export）：
 *   - 每个模块文件是一段「包在函数里的普通 JS」，用 const/function 声明；
 *   - 模块之间靠闭包共享，顺序由 MODULES 决定；
 *   - 只有 entry 模块（client/index.js）可以调用 require。
 *
 * @module tools/build-client
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 包名：同时是 __ModuleLoader__ 的 id。 */
const PKG_NAME = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name;

/**
 * 内联顺序（依赖在前）。
 *
 * 每个条目是 src/client 下的文件名。加入新模块时**必须**在这里登记，
 * tools/verify-bundle.mjs 会检查目录里的每个 .js 是否都被内联了。
 */
const MODULES = [
  'dict.js',
  'timing.js',
  'tags.js',
  'session-log.js',
  'model-log.js',
  'metrics.js',
  'state.js',
  'session-id.js',
  'stats.js',
  'clipboard.js',
  'panel-css.js',
  'styles.js',
  'reminder.js',
  'safe-top.js',
  'hud.js',
  // summary.js 必须早于 record-card.js —— 后者复用前者的 rankModels 算
  // 「历史累计」。模块共享一个闭包，用到谁就必须排在谁后面。
  'summary.js',
  'record-card.js',
  'gallery.js',
  'settings-row.js',
  'probe.js',
  'slots.js',
  'index.js',
];

/** 读取一个模块源码，去掉顶层的 @module 注释块以缩小产物。 */
function readModule(file) {
  const raw = readFileSync(join(ROOT, 'src', 'client', file), 'utf8');
  return raw.trimEnd();
}

/** 生成完整产物文本。 */
function build() {
  const bodies = MODULES.map((file) => {
    const code = readModule(file);
    // 用注释分隔，便于产物里定位问题来源。
    return `  /* ===== src/client/${file} ===== */\n${code}`;
  }).join('\n\n');

  return `/**
 * dsh-immersion-glow —— 浏览器半（构建产物，请勿手改）
 *
 * 源码在 src/client/，由 tools/build-client.mjs 生成。
 * 生成命令： npm run build
 */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(PKG_NAME)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

${bodies}

    return module.exports;
  },
});
`;
}

const output = build();
mkdirSync(join(ROOT, 'lib'), { recursive: true });
writeFileSync(join(ROOT, 'lib', 'client.js'), output, 'utf8');

// host 半是纯 ESM 源文件，直接复制（保持可 node --check）。
const host = readFileSync(join(ROOT, 'src', 'index.js'), 'utf8');
writeFileSync(join(ROOT, 'lib', 'index.js'), host, 'utf8');

const bytes = Buffer.byteLength(output, 'utf8');
const lines = output.split('\n').length;
console.log(`✓ lib/client.js  ${lines} 行 / ${(bytes / 1024).toFixed(1)} KB（内联 ${MODULES.length} 个模块）`);
console.log(`✓ lib/index.js   宿主空壳`);
