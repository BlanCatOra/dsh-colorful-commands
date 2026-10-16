/**
 * dsh-colorful-commands —— 设置命名空间可用性回归测试。
 *
 * 背景（见任务说明，已由 Lead 用内核源码 + 真机 schema 双重证实）：
 *   内核 `dsh-settings/lib/index.js` 的 `SettingsForms.describe()` 里有
 *     const form = volatileForm(schema);
 *     if (form === void 0) return [];   // 条目被整个跳过 → 命名空间永不 serve
 *   而 `volatileForm()` 只认带 `.volatile()` 标记的字段（没有任何 volatile 字段的
 *   object schema → 返回 undefined）。这导致本插件详情页设置项不出现，只显示
 *   「该设置命名空间尚未就绪」。
 *
 * 本测试不依赖宿主（不 import react / dsh-client-store）：
 *   - 通过 register() 注册 test/helpers/host-stubs.mjs（ESM resolve 钩子），把这两个
 *     宿主模块重定向到本仓库内的桩（test/helpers/stub-react.mjs、
 *     test/helpers/stub-store.mjs），使 `src/settings-face.js` 能被 import；
 *     readConfig 运行时只用 unwrapVolatile，不触及 react / dsh-client-store 逻辑。
 *     桩路径全部用 new URL(..., import.meta.url) 相对定位，随仓库走、不依赖任何易失目录。
 *   - 用例 (a) 直接 import 真实的 `src/config.js`（依赖本仓库 node_modules 下的
 *     @deepseek-ai/schemastery 符号链接）。
 *
 * 运行：
 *   node --test test/settings-namespace.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

// 运行期把宿主模块重定向到仓库内桩（与 --loader 等价，但保证通过 node --test 时也生效）。
// 桩路径相对本文件定位，不依赖任何易失目录。
register(new URL('./helpers/host-stubs.mjs', import.meta.url), pathToFileURL('./'));

import z from '@deepseek-ai/schemastery';
import { Config } from '../src/config.js';
// 动态 import，避免顶层静态 import 受 react 解析影响（loader 已兜底，但保持稳妥）。
// ⚠️ 断言「浏览器侧模块内联的 unwrapVolatile 行为」：从 settings-face.js 取用，而非 Host 侧 config.js。
// 这同时验证：剥活引用能力已内联进浏览器 bundle，不再从 Host 侧 config.js 引入。
const { readConfig, unwrapVolatile } = await import('../src/settings-face.js');

/**
 * 内核 dsh-settings/lib/index.js SettingsForms.volatileForm 的等价实现。
 * 照抄 Lead 从内核提取的 dsh-settings.js:118-131（内核源码）：
 *
 *   function volatileForm(schema) {
 *     if (schema.meta.volatile) return plainSchema(schema);
 *     if (schema.type === "object") {
 *       const dict = Object.fromEntries(Object.entries(schema.dict ?? {}).flatMap(([key, child]) => {
 *         const field = volatileForm(child);
 *         return field === void 0 ? [] : [[key, field]];
 *       }));
 *       return Object.keys(dict).length === 0 ? void 0 : z.object(dict);
 *     }
 *   }
 *
 * 注：本插件没有顶层 volatile，所以用 `z.object(dict)` 构造等价 form（plainSchema
 * 仅做 redact 处理，对本测试无关）。等价判定只看「返回是否 undefined + 字段名」。
 */
function volatileForm(schema) {
  if (schema.meta?.volatile) return schema;
  if (schema.type === 'object') {
    const dict = Object.fromEntries(
      Object.entries(schema.dict ?? {}).flatMap(([key, child]) => {
        const field = volatileForm(child);
        return field === void 0 ? [] : [[key, field]];
      }),
    );
    return Object.keys(dict).length === 0 ? void 0 : z.object(dict);
  }
  return void 0;
}

test('(a) 回归锁：真实 Config 经 volatileForm 必须是非 undefined 且含三字段', () => {
  const form = volatileForm(Config);
  assert.notEqual(form, void 0, '不加 .volatile() 时 volatileForm 返回 undefined → 命名空间被跳过');
  const keys = Object.keys(form.dict);
  for (const name of ['enabled', 'preset', 'colors']) {
    assert.ok(keys.includes(name), `volatileForm 结果缺少字段 ${name}，实际: ${keys.join(', ')}`);
  }
  // 额外确认这三个字段在 Config 自身上确实带 volatile 标记（真因修复点）。
  assert.equal(Config.dict.enabled.meta?.volatile, true, 'enabled 未带 .volatile()');
  assert.equal(Config.dict.preset.meta?.volatile, true, 'preset 未带 .volatile()');
  assert.equal(Config.dict.colors.meta?.volatile, true, 'colors 未带 .volatile()');
});

test('(b) 活引用形状：readConfig 剥掉 { get() } 读出正确值', () => {
  const liveColors = { get: () => ({ thinking: { light: '#fff', dark: '#000' } }) };
  const snapshot = {
    value: {
      enabled: { get: () => true },
      preset: { get: () => 'chinese' },
      colors: liveColors,
    },
  };
  const out = readConfig(snapshot);
  assert.equal(out.enabled, true);
  assert.equal(out.preset, 'chinese');
  assert.deepEqual(out.colors, { thinking: { light: '#fff', dark: '#000' } });
  // colors 仍返回普通对象副本（不是活引用本身）。
  assert.equal(typeof out.colors.get, 'undefined');
  assert.notEqual(out.colors, liveColors.get());
});

test('(b2) 活引用形状：enabled/preset 非典型值也能正确剥出', () => {
  const snapshot = {
    value: {
      enabled: { get: () => false },
      preset: { get: () => 'japanese' },
      colors: { get: () => ({ read: { light: '#abc', dark: '#def' } }) },
    },
  };
  const out = readConfig(snapshot);
  assert.equal(out.enabled, false, '活引用 false 应被识别为关闭');
  assert.equal(out.preset, 'japanese');
  assert.deepEqual(out.colors, { read: { light: '#abc', dark: '#def' } });
});

test('(c) 普通值形状：幂等、不回归', () => {
  const snapshot = {
    value: {
      enabled: true,
      preset: 'macaron',
      colors: { search: { light: '#111', dark: '#222' } },
    },
  };
  const out = readConfig(snapshot);
  assert.equal(out.enabled, true);
  assert.equal(out.preset, 'macaron');
  assert.deepEqual(out.colors, { search: { light: '#111', dark: '#222' } });
  // 普通值路径下 unwrapVolatile 应原样返回（幂等）。
  assert.equal(unwrapVolatile(true), true);
  assert.deepEqual(unwrapVolatile({ a: 1 }), { a: 1 });
});

test('(c2) 普通值形状：缺失/非字符串 preset 回退 chinese，colors 非对象回退 {}', () => {
  // enabled 缺失（undefined）时按「默认开启」处理：undefined !== false → true。
  const out = readConfig({ value: { enabled: undefined, preset: undefined, colors: undefined } });
  assert.equal(out.enabled, true, 'enabled 缺失视为开启 (undefined !== false)');
  assert.equal(out.preset, 'chinese');
  assert.deepEqual(out.colors, {});

  const out2 = readConfig({ value: { enabled: false, preset: 123, colors: 'nope' } });
  assert.equal(out2.enabled, false, 'enabled=false 应识别为关闭');
  assert.equal(out2.preset, 'chinese', 'preset 非字符串应回退 chinese');
  assert.deepEqual(out2.colors, {}, 'colors 非对象应回退 {}');
});

test('(d) 防回归：浏览器侧 settings-face.js 不得引入 Host 侧 config.js / schemastery', async () => {
  // 理由：settings-face.js 会打进浏览器 bundle，而 bundle 只允许 require seed 表那 9 个
  // 基座模块。config.js 是 Host 侧模块（import '@deepseek-ai/schemastery'），一旦被引入，
  // 会触发 src/build-client.mjs 的 assertBundleShape() 构建失败 → 真机整站白屏 + import failed。
  // 本用例从源码层面断言这条红线，防止再次被「复用 Host 侧工具函数」悄悄越过。
  const src = await readFile(new URL('../src/settings-face.js', import.meta.url), 'utf8');

  // ⚠️⚠️ 判据必须是**真实的模块请求**，不能是"文件里有没有这个词"。
  //
  // 曾经写成 `assert(!/@deepseek-ai\/schemastery/.test(src))` —— 它**必然误报**：
  // 本文件上方的注释正是在解释「为什么不引入它」，注释里当然会出现这个名字。
  // 那条断言把「说明文字」当成了「依赖」，一旦代码里写下解释就变红，
  // 逼着后来者删掉最有价值的注释（已实测踩到：`true !== false` 失败）。
  // 正确做法：只抽取 import / export-from / 动态 import 的 **specifier** 再判。
  const moduleRequests = [
    ...src.matchAll(/(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g),
    ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((match) => match[1]);

  // ① 不得请求 Host 侧模块（它们会被拖进浏览器 bundle）。
  const hostRequests = moduleRequests.filter(
    (spec) => spec === '@deepseek-ai/schemastery' || /(^|\/)config\.js$/.test(spec),
  );
  assert.deepEqual(
    hostRequests,
    [],
    `settings-face.js 不得请求 Host 侧模块（浏览器 bundle 只允许 seed 表那 9 个），实际请求了：${hostRequests.join(', ')}`,
  );

  // ② 正向锁：所有请求都必须落在 seed 表 9 个之内（与 build-client.mjs 的
  //    SEED_MODULES 同源）。这条比①更强 —— 将来引入任一表外模块都会在此变红，
  //    而不是等到 `node src/build-client.mjs` 才暴露（真机表现是白屏 + import failed）。
  const SEED = new Set([
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-dockkit',
  ]);
  const outsideSeed = moduleRequests.filter((spec) => spec.startsWith('@') && !SEED.has(spec));
  assert.deepEqual(
    outsideSeed,
    [],
    `settings-face.js 请求了 seed 表之外的模块：${outsideSeed.join(', ')}（真机会白屏 + import failed）`,
  );
  // 同时确认剥活引用的能力确实内联在本文件（可导出、可用）。
  assert.equal(typeof unwrapVolatile, 'function', '内联的 unwrapVolatile 应被导出');
  assert.equal(unwrapVolatile({ get: () => 42 }), 42, '内联 unwrapVolatile 应剥出活引用真实值');
  assert.equal(unwrapVolatile('plain'), 'plain', '内联 unwrapVolatile 对普通值应原样返回');
});
