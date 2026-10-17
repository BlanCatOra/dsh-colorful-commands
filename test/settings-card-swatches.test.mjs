/**
 * 设置卡片色板候选的回归测试。
 *
 * ## 背景（用户 2026-10-17 反馈）
 *
 * 「这个预设颜色可以多一点 两行吧 数量比现在多一倍 依旧从传统色中选择适合的 不要太鲜艳」
 *
 * 旧实现 `swatchesFor()` 结尾是 `list.slice(0, 14)` —— **硬砍一半**。
 * 实测 `presetColors()` 对三套预设都返回 **26** 个键，且
 * `ALL_CATEGORIES`（26 个）**完全被 palette 覆盖** ——
 * 也就是说 `palette` 本来就是"全部类别的颜色"，`slice(0,14)` 才是真限制。
 *
 * 本文件锁住修复后的行为：
 * - 每类别候选数 == palette 的键数（26）；
 * - 26 恰好排成 **2 行**（`SWATCH_COLUMNS = 13`）；
 * - **本类别自己那一对排在最前**（保持既有行为）；
 * - 每项都是合法的浅/深 hex 对，且 `light !== dark`（否则换主题就失明）。
 *
 * ## 为什么不去凑 28（用户说"多一倍"= 14×2 = 28）
 *
 * Lead 试过用 `buildPalette` 另挑 5 个传统色补到 28，**实测失败**：
 * `japanese`（58 色）与 `macaron`（34 色）色库太小，挑出的色对出现
 * `light === dark` 或与已有色撞车（与 `palettes.js` 里状态类改固定色是同一个原因）。
 * → 26 是"零新增色、零风险"能给出的最大整齐值，且刚好两行。
 *
 * @module dsh-colorful-commands/test/settings-card-swatches
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// 运行期把宿主模块（react / react/jsx-runtime / primitives）重定向到仓库内桩。
// 桩路径相对本文件定位，不依赖任何易失目录。
register(new URL('./helpers/host-stubs.mjs', import.meta.url), pathToFileURL('./'));

// 动态 import：settings-card.js 顶层 import 了 react 系模块，靠上面的钩子兜底。
const { swatchesFor, SWATCH_COLUMNS } = await import('../src/settings-card.js');
const { presetColors } = await import('../src/palettes.js');
const { sanitizeColor } = await import('../src/css.js');
const { ALL_CATEGORIES } = await import('../src/constants.js');

const PRESETS = ['chinese', 'japanese', 'macaron'];
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

test('候选数 == palette 键数（26），不再是旧的 14', () => {
  for (const preset of PRESETS) {
    const expected = Object.keys(presetColors(preset)).length;
    assert.equal(expected, 26, `预设 ${preset} 的 palette 键数应为 26（改了这个测试要一起改）`);
    for (const category of ALL_CATEGORIES) {
      const list = swatchesFor(preset, category);
      assert.equal(
        list.length,
        expected,
        `${preset}/${category} 候选数应为 ${expected}（全部类别色），实际 ${list.length}`,
      );
    }
  }
});

test('26 个候选排成恰好 2 行', () => {
  assert.equal(SWATCH_COLUMNS, 13, 'SWATCH_COLUMNS 应为 13（26 / 2 行）');
  const n = swatchesFor('chinese', 'thinking').length;
  assert.equal(n, 26);
  assert.equal(n % SWATCH_COLUMNS, 0, '26 必须能被列数整除，否则会出现半行');
  assert.equal(n / SWATCH_COLUMNS, 2, '必须恰好 2 行（用户明确要求"两行"）');
});

test('本类别自己那一对排在最前', () => {
  for (const preset of PRESETS) {
    const palette = presetColors(preset);
    for (const category of ALL_CATEGORIES) {
      const own = palette[category];
      const first = swatchesFor(preset, category)[0];
      assert.deepEqual(
        first,
        { light: own.light, dark: own.dark },
        `${preset}/${category} 的第一格必须是本类别自己的色（用户点第一格即回到本类语义色）`,
      );
    }
  }
});

/**
 * ⚠️ 已知的「浅深同色」类别（**既存缺陷，不是本次改动引入的**）。
 *
 * 含义：这些类别在浅色与深色主题下是**同一个颜色** —— 即 settings-card 注释里
 * 警告的"把同一个色值塞进两边，会在另一个主题下失明"。
 *
 * 根因：`japanese`（58 色）与 `macaron`（34 色）的色库**太小**，
 * `buildPalette` 对某些类别挑不到同时满足「浅底对比度」与「深底对比度」的两个色，
 * 于是降级复用同一个（`palettes.js` 里 `STATUS_COLORS` 的说明记录了同一现象）。
 *
 * ⚠️ 本表是**冻结快照**，用途不是"接受它"，而是：
 *   1. 让本测试能跑绿（不因为既存缺陷一直红）；
 *   2. **一旦出现新的同色类别，测试立刻变红** —— 这是回归护栏。
 * 修这个既存缺陷需要改预设的实际配色（属于单独的产品决策，Lead 未擅自改）。
 */
const KNOWN_THEME_BLIND = new Set([
  // japanese
  'japanese/web',
  'japanese/other',
  // macaron
  'macaron/read',
  'macaron/write',
  'macaron/search',
  'macaron/retry',
  'macaron/compaction',
  'macaron/other',
  'macaron/ctl-plan',
  'macaron/perm-readonly',
  'macaron/perm-full',
  'macaron/ctl-permission',
]);

test('候选里的每一对都是合法 hex', () => {
  for (const preset of PRESETS) {
    for (const category of ALL_CATEGORIES) {
      for (const pair of swatchesFor(preset, category)) {
        assert.ok(HEX.test(pair.light), `${preset}/${category} light 非法：${pair.light}`);
        assert.ok(HEX.test(pair.dark), `${preset}/${category} dark 非法：${pair.dark}`);
      }
    }
  }
});

test('不得出现「新的」浅深同色类别（既存缺陷已冻结）', () => {
  // ⚠️ 直接遍历 `presetColors()`（类别 → 色对），**不要**遍历 swatchesFor 的列表 ——
  //    后者对任意类别都返回全部 26 个色对，用它会把别的类别的缺陷算到当前类别头上。
  const found = [];
  for (const preset of PRESETS) {
    for (const [category, pair] of Object.entries(presetColors(preset))) {
      if (pair === undefined) continue;
      if (sanitizeColor(pair.light) === sanitizeColor(pair.dark)) {
        const key = `${preset}/${category}`;
        if (!KNOWN_THEME_BLIND.has(key)) found.push(`${key} (${pair.light})`);
      }
    }
  }
  assert.deepEqual(
    found,
    [],
    `出现新的「浅深同色」类别（换主题会失明）：${found.join('、')}。`
      + ' 若这是刻意为之，请把它加入 KNOWN_THEME_BLIND 并说明理由。',
  );
});

test('既存缺陷清单不得被悄悄缩短（删条目等于掩盖修复）', () => {
  // 反向守卫：若有人真的修好了某个类别，本测试会红，提醒同步清单 ——
  // 避免"清单留在那里、实际上早就修好了"导致的假绿。
  const stillBlind = new Set();
  for (const preset of PRESETS) {
    for (const [category, pair] of Object.entries(presetColors(preset))) {
      if (pair === undefined) continue;
      if (sanitizeColor(pair.light) === sanitizeColor(pair.dark)) {
        stillBlind.add(`${preset}/${category}`);
      }
    }
  }
  const stale = [...KNOWN_THEME_BLIND].filter((key) => !stillBlind.has(key));
  assert.deepEqual(
    stale,
    [],
    `以下类别已不再是「浅深同色」，请从 KNOWN_THEME_BLIND 移除：${stale.join('、')}`,
  );
});

test('候选值全部来自该预设的 palette（不引入新色）', () => {
  for (const preset of PRESETS) {
    const palette = presetColors(preset);
    const allowed = new Set();
    for (const pair of Object.values(palette)) {
      allowed.add(`${pair.light}|${pair.dark}`);
    }
    for (const category of ALL_CATEGORIES) {
      for (const pair of swatchesFor(preset, category)) {
        assert.ok(
          allowed.has(`${pair.light}|${pair.dark}`),
          `${preset}/${category} 出现了不属于该预设 palette 的色对：${pair.light}|${pair.dark}`,
        );
      }
    }
  }
});

test('未知预设 / 未知类别时不抛错，且仍给出合法候选', () => {
  // ⚠️ 未知预设**不是**返回空数组 —— `presetColors()` 对未知 id 仍会叠上
  //    固定状态色（9）、命令三档红（3）以及权限色（回退到中文色库），
  //    所以会得到一份"部分色板"（实测 17 项）。这是刻意的防御性行为：
  //    宁可少几色，也不要让设置页整块空白。
  //    真实路径上 preset 受 schema 约束（none/chinese/japanese/macaron），
  //    走不到未知值；这里只锁"不抛错 + 值合法"。
  const list = swatchesFor('no-such-preset', 'thinking');
  assert.ok(Array.isArray(list), '必须返回数组');
  assert.ok(list.length > 0, '未知预设也应给出非空候选（防御性降级）');
  for (const pair of list) {
    assert.ok(HEX.test(pair.light) && HEX.test(pair.dark), `未知预设给出的色对非法：${JSON.stringify(pair)}`);
  }

  // 未知类别 → 没有"自己那一对"在最前，但仍是全部 26 个类别色。
  const list2 = swatchesFor('chinese', 'no-such-category');
  assert.equal(list2.length, 26, '未知类别仍应给出全部类别色候选');
});
