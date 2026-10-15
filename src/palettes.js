/**
 * dsh-colorful-commands —— 内置预设色板。
 *
 * ## 色值来源（不凭记忆写）
 *
 * - **中国传统色**：<https://colorfyi.com/collections/chinese-traditional/>
 *   （30 色，取自颜料/矿物/植物/自然意象）
 * - **日本传统色**：<https://www.garan.ne.jp/d-classroom/web-tips/major-traditional-japanese-colors/>
 *   （该站声明采用「Web/UI 制作中可复现性高的代表值」，正合本用途）
 * - **马卡龙色系**：柔和粉彩（pastel）通行配色，参考
 *   <https://ascores.com.br/paleta/a8e6cf-dcedc1-ffd3b6-ffaaa5-ff8b94/>
 *
 * ## 为什么每个颜色都要 light / dark 两值
 *
 * DSH 有浅色与深色两套底。同一个色值不可能在两边都可读：深色底要亮色，
 * 浅色底要暗色。DSH 自己的 `ctx.theme.overrideTokens()` 契约也强制
 * `{ light, dark }` 成对（内核实测：传裸字符串会抛
 * "a bare string — pass { light, dark }"）。
 *
 * 因此本插件**不**用 `overrideTokens`（那会全局覆盖 token、影响所有组件），
 * 而是把两值都写进自己的 CSS，用 `body[data-ds-dark-theme]` 分支选择。
 *
 * ## 选色原则
 *
 * - 深色值统一取「亮而不过曝」：保证在 `#1A1A1A` 级底色上对比度足够。
 * - 浅色值统一取「暗而不发黑」：保证在白底上仍能读出文字。
 * - 刻意避开过暗的传统色（如 藍色 `#0F2540`、墨色 `#1C1C1C`）作为**深色值**，
 *   它们在深底上等于看不见；这些颜色若要用，只放在浅色值一侧。
 *
 * @module dsh-colorful-commands/palettes
 */
import { CATEGORIES, CONTROL_CATEGORIES, PRESET_CHINESE, PRESET_JAPANESE, PRESET_MACARON } from './constants.js';

/**
 * 中国传统色预设。
 *
 * 色名保留原称，便于用户对照色卡。注释里给出色名与出处色值。
 */
const CHINESE = {
  // 丁香色 #CCA4E3 / 绛紫 #8C4356
  thinking: { light: '#8C4356', dark: '#CCA4E3' },
  // 缃色 #F0C239
  command: { light: '#A87400', dark: '#F0C239' },
  // 朱砂 #FF461F
  danger: { light: '#C81E1E', dark: '#FF6B5A' },
  // 靛青 #177CB0 / 碧色 #44CEF6
  read: { light: '#177CB0', dark: '#5BC0EB' },
  // 松柏绿 #21A675
  write: { light: '#1F7A50', dark: '#7BD389' },
  // 碧色 #44CEF6
  search: { light: '#0E7C86', dark: '#44CEF6' },
  // 藏青 #2E4E7E
  web: { light: '#2E4E7E', dark: '#7BA7D7' },
  // 墨 #50616D
  other: { light: '#50616D', dark: '#A3B1BC' },
  // 海棠红 #DB5A6B
  user: { light: '#B23A48', dark: '#DB5A6B' },
  // 石青 #7BCFA6 / 群青 #4C8DAE
  assistant: { light: '#4C8DAE', dark: '#7BCFA6' },
  // 控件类沿用同一套语义
  'ctl-permission': { light: '#B23A48', dark: '#DB5A6B' },
  'ctl-model': { light: '#4C8DAE', dark: '#7BCFA6' },
  'ctl-plan': { light: '#8C4356', dark: '#CCA4E3' },
  'ctl-activity': { light: '#50616D', dark: '#A3B1BC' },
  'ctl-toolbar': { light: '#177CB0', dark: '#5BC0EB' },
};

/** 日本传统色预设。色名与读音见文件头出处。 */
const JAPANESE = {
  // 菫色 #7058A3 / 藤色 #B28FCE
  thinking: { light: '#7058A3', dark: '#B28FCE' },
  // 黄土色 #C39143
  command: { light: '#8F6A1E', dark: '#C39143' },
  // 茜色 #B7282E / 朱色 #E94709
  danger: { light: '#B7282E', dark: '#E94709' },
  // 縹 #006284 / 浅葱色 #00A3AF
  read: { light: '#006284', dark: '#00A3AF' },
  // 常磐色 #007B43 / 若草色 #A8C97F
  write: { light: '#007B43', dark: '#A8C97F' },
  // 青竹色 #6AAE9C
  search: { light: '#3E8E7E', dark: '#6AAE9C' },
  // 紺色 #1C305C
  web: { light: '#1C305C', dark: '#7BA7D7' },
  // 利休茶 #8F8667 / 銀鼠 #AFAFB0
  other: { light: '#8F8667', dark: '#AFAFB0' },
  // 紅 #CB1B45
  user: { light: '#CB1B45', dark: '#E87A9B' },
  // 紫 #884898 / 藤色 #B28FCE
  assistant: { light: '#884898', dark: '#B28FCE' },
  'ctl-permission': { light: '#B7282E', dark: '#E94709' },
  'ctl-model': { light: '#884898', dark: '#B28FCE' },
  'ctl-plan': { light: '#7058A3', dark: '#B28FCE' },
  'ctl-activity': { light: '#8F8667', dark: '#AFAFB0' },
  'ctl-toolbar': { light: '#006284', dark: '#00A3AF' },
};

/**
 * 马卡龙色系预设。
 *
 * ⚠️ 马卡龙原色是**浅底用色**，直接放浅色主题会糊掉，所以浅色值统一压深，
 * 深色值才保留粉彩本来的柔和感（这也是这套配色在深色界面上好看的原因）。
 */
const MACARON = {
  thinking: { light: '#8E7CC3', dark: '#C9B6E4' }, // 薰衣草紫
  command: { light: '#B8912B', dark: '#FFE066' }, // 奶油黄
  danger: { light: '#D9534F', dark: '#FF8B94' }, // 珊瑚红
  read: { light: '#4A90D9', dark: '#A8D8EA' }, // 婴儿蓝
  write: { light: '#3FA372', dark: '#A8E6CF' }, // 薄荷绿
  search: { light: '#2FA8A0', dark: '#9FE2DE' }, // 湖水绿
  web: { light: '#5C6BC0', dark: '#B4C0F0' }, // 蓝紫
  other: { light: '#8A8F98', dark: '#D8DEE9' }, // 中性灰
  user: { light: '#D96C8A', dark: '#FFB3C6' }, // 樱花粉
  assistant: { light: '#5B8DEF', dark: '#BBD4FF' }, // 天空蓝
  'ctl-permission': { light: '#D9534F', dark: '#FF8B94' },
  'ctl-model': { light: '#5B8DEF', dark: '#BBD4FF' },
  'ctl-plan': { light: '#8E7CC3', dark: '#C9B6E4' },
  'ctl-activity': { light: '#8A8F98', dark: '#D8DEE9' },
  'ctl-toolbar': { light: '#4A90D9', dark: '#A8D8EA' },
};

/**
 * 全部内置预设。键为预设 id。
 *
 * 每个预设都是完整的 `{ 类别 → { light, dark } }` 映射；缺类别时渲染层会
 * 跳过该类别（不上色），所以允许预设只覆盖一部分类别。
 */
export const BUILTIN_PRESETS = {
  [PRESET_CHINESE]: CHINESE,
  [PRESET_JAPANESE]: JAPANESE,
  [PRESET_MACARON]: MACARON,
};

/** 预设的中文显示名。 */
export const PRESET_LABELS = {
  [PRESET_CHINESE]: '中国传统色',
  [PRESET_JAPANESE]: '日本传统色',
  [PRESET_MACARON]: '马卡龙色系',
};

/**
 * 取一个预设的完整色板；未知预设返回空对象（等于全部不上色）。
 *
 * @param presetId 预设 id。
 * @returns 类别到 `{ light, dark }` 的映射（浅拷贝，调用方可安全改）。
 */
export function presetColors(presetId) {
  const preset = BUILTIN_PRESETS[presetId];
  if (preset === undefined) return {};
  return { ...preset };
}

/**
 * 取「某个类别」在「某个预设」下的默认色。
 *
 * 用于设置卡片里"重置为预设值"以及自定义模式的初始值。
 *
 * @param presetId 预设 id。
 * @param category 类别 id。
 * @returns `{ light, dark }`，或 undefined（该预设未定义此类别）。
 */
export function presetColorFor(presetId, category) {
  const preset = BUILTIN_PRESETS[presetId];
  if (preset === undefined) return undefined;
  const value = preset[category];
  return value === undefined ? undefined : { ...value };
}

/** 供测试断言：每个内置预设覆盖了哪些类别。 */
export function presetCoverage(presetId) {
  const preset = BUILTIN_PRESETS[presetId] ?? {};
  const all = [...CATEGORIES, ...CONTROL_CATEGORIES];
  return {
    covered: all.filter((c) => Object.hasOwn(preset, c)),
    missing: all.filter((c) => !Object.hasOwn(preset, c)),
  };
}
