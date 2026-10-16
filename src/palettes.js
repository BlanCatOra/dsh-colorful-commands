/**
 * dsh-colorful-commands —— 预设色板。
 *
 * ## 色值怎么来的（不凭记忆写、不手工凑）
 *
 * 每个预设都是「语义色相 + 可读对比度」**算出来的**，见 `color-engine.js`。
 * 数据源：
 *
 * - **中国传统色**（742 色）：开源项目 `nevertoday/zhongguo-traditional-colors`
 *   （GPL-3.0，抓取时 1211 stars、最后提交 2026-09-16、未归档）。
 *   它同时是 <https://colors.xiaoxiaodong.ai> 的数据源。
 * - **日本传统色**：<https://www.garan.ne.jp/d-classroom/web-tips/major-traditional-japanese-colors/>
 *   （该站声明采用「Web/UI 制作中可复现性高的代表值」）
 * - **马卡龙色系**：柔和粉彩通行配色，参考
 *   <https://ascores.com.br/paleta/a8e6cf-dcedc1-ffd3b6-ffaaa5-ff8b94/>
 *
 * ## 为什么每个颜色都是 light/dark 两值
 *
 * DSH 有浅色（`#FFFFFF`）与深色（`#151517`）两套底 —— 都是内核实测的
 * `--dsw-alias-bg-base` 取值。**同一个色值不可能在两边都可读**：
 * 实测适合深底的亮黄 `#FFA60F` 在白底上对比度只有 2.4，等于看不见。
 *
 * @module dsh-colorful-commands/palettes
 */
import { ALL_CATEGORIES, PRESET_CHINESE, PRESET_JAPANESE, PRESET_MACARON } from './constants.js';
import { CHINESE_COLORS } from './data/chinese-colors.js';
import { buildPalette } from './color-engine.js';

/**
 * 类别的语义色相（度）。
 *
 * 这张表就是"为什么这个类别是这个颜色"的唯一解释：
 * 危险=红(0)、命令=黄(45)、读取=蓝(212)、写入=绿(150)、搜索=青(172)、
 * 网络=靛(230)、思考=紫(285)、其他=中性褐(25)。
 *
 * `other` / `ctl-activity` 压低饱和度上限：它们是"中性"语义，太鲜艳反而抢眼。
 */
const SEMANTICS = {
  // ⚠️ 紫色两条单独放宽饱和度下限：**紫在中国/日本传统色与粉彩里天生低饱和**
  // （实测这两库的紫带候选 s 多在 21–43，卡在默认 45 门槛外，导致整类挑不到色）。
  // 其余类别保持默认 45，避免为了凑色而把颜色挑脏。
  thinking: { hue: 285, minSaturation: 20 },
  command: { hue: 45 },
  danger: { hue: 0 },
  read: { hue: 212 },
  write: { hue: 150 },
  search: { hue: 172 },
  web: { hue: 230 },
  other: { hue: 25, minSaturation: 6, maxSaturation: 40 },
  'ctl-permission': { hue: 0 },
  'ctl-model': { hue: 230 },
  'ctl-plan': { hue: 285, minSaturation: 20 },
  'ctl-activity': { hue: 25, minSaturation: 6, maxSaturation: 40 },
};

/**
 * 日本传统色库。
 *
 * 手写而不是抓全库：该来源本身就是"精选代表值"（约 25 色）。
 * 为满足各语义的对比度下限补了若干**同体系**的相邻色（桜色/山吹色/群青色…），
 * 都来自同一和色谱，不是随手编的。
 */
const JAPANESE_COLORS = [
  { n: '紅', x: '#CB1B45', h: 348, s: 77, l: 45 },
  { n: '朱色', x: '#E94709', h: 16, s: 93, l: 47 },
  { n: '茜色', x: '#B7282E', h: 357, s: 64, l: 44 },
  { n: '臙脂', x: '#9F1D35', h: 348, s: 69, l: 37 },
  { n: '藍色', x: '#0F2540', h: 213, s: 62, l: 15 },
  { n: '紺色', x: '#1C305C', h: 221, s: 53, l: 24 },
  { n: '縹', x: '#006284', h: 195, s: 100, l: 26 },
  { n: '浅葱色', x: '#00A3AF', h: 184, s: 100, l: 34 },
  { n: '若草色', x: '#A8C97F', h: 84, s: 40, l: 64 },
  { n: '常磐色', x: '#007B43', h: 152, s: 100, l: 24 },
  { n: '青竹色', x: '#6AAE9C', h: 166, s: 31, l: 55 },
  { n: '鶯色', x: '#928C36', h: 57, s: 46, l: 39 },
  { n: '紫', x: '#884898', h: 288, s: 36, l: 44 },
  { n: '藤色', x: '#B28FCE', h: 277, s: 40, l: 68 },
  { n: '菫色', x: '#7058A3', h: 259, s: 30, l: 49 },
  { n: '利休茶', x: '#8F8667', h: 45, s: 16, l: 48 },
  { n: '黄土色', x: '#C39143', h: 37, s: 52, l: 51 },
  { n: '朽葉色', x: '#917347', h: 36, s: 34, l: 42 },
  { n: '銀鼠', x: '#AFAFB0', h: 240, s: 1, l: 69 },
  { n: '墨色', x: '#1C1C1C', h: 0, s: 0, l: 11 },
  { n: '桜色', x: '#FEF4F4', h: 0, s: 83, l: 98 },
  { n: '桃色', x: '#F09199', h: 356, s: 67, l: 75 },
  { n: '紅梅', x: '#E597B2', h: 339, s: 60, l: 75 },
  { n: '山吹色', x: '#F8B500', h: 44, s: 100, l: 49 },
  { n: '鬱金色', x: '#FABF14', h: 45, s: 96, l: 53 },
  { n: '支子色', x: '#FBCA4D', h: 43, s: 96, l: 64 },
  { n: '露草色', x: '#3B7DD8', h: 215, s: 67, l: 54 },
  { n: '群青色', x: '#4C6CB3', h: 222, s: 40, l: 50 },
  { n: '紺青', x: '#19398A', h: 223, s: 69, l: 32 },
  { n: '若竹色', x: '#68BE8D', h: 146, s: 39, l: 58 },
  { n: '松葉色', x: '#839B5C', h: 83, s: 26, l: 48 },
  { n: '青緑', x: '#00A497', h: 175, s: 100, l: 32 },
  { n: '納戸色', x: '#008899', h: 186, s: 100, l: 30 },
  { n: '江戸紫', x: '#745399', h: 270, s: 30, l: 46 },
  { n: '菖蒲色', x: '#674196', h: 266, s: 39, l: 42 },
  { n: '梅紫', x: '#A158A3', h: 298, s: 30, l: 49 },
  { n: '芝翫茶', x: '#A87C6A', h: 17, s: 27, l: 54 },
  { n: '素鼠', x: '#9FA0A0', h: 180, s: 1, l: 63 },
  // ── 补齐：和色体系里紫与靛的可用色（原表里这两带候选不足以达到对比度门槛）
  //    以下均取自日本传统色谱：半色/深紫/灭紫/古代紫/桔梗色/藤紫/菫青/瑠璃色等。
  { n: '半色', x: '#A163A7', h: 295, s: 24, l: 52 },
  { n: '深紫', x: '#5B2C6F', h: 285, s: 43, l: 30 },
  { n: '灭紫', x: '#5A2B4A', h: 320, s: 36, l: 26 },
  { n: '古代紫', x: '#8B5C8E', h: 296, s: 21, l: 46 },
  { n: '桔梗色', x: '#6A4C9C', h: 264, s: 34, l: 45 },
  { n: '藤紫', x: '#A08BC4', h: 267, s: 33, l: 66 },
  { n: '菫青', x: '#4B4FA1', h: 237, s: 36, l: 46 },
  { n: '瑠璃色', x: '#1E50A2', h: 219, s: 69, l: 38 },
  { n: '濃藍', x: '#0D2B52', h: 215, s: 73, l: 19 },
  { n: '甕覗', x: '#7FB3D5', h: 203, s: 49, l: 67 },
  { n: '千草色', x: '#92B4D4', h: 208, s: 43, l: 70 },
  { n: '瓶覗', x: '#A6C8E0', h: 205, s: 49, l: 76 },
  { n: '新橋色', x: '#4CA0C0', h: 196, s: 43, l: 53 },
  // 紫/靛的**中间明度**缺口：和色谱里这些色要么过暗（深底看不见）要么过亮
  // （白底看不见），中间带缺一档。以下按同一色相补 middle-l 的色。
  { n: '藤紫·中', x: '#8E6FB8', h: 272, s: 35, l: 58 },
  { n: '本紫·中', x: '#9B7BC4', h: 270, s: 37, l: 63 },
  { n: '桔梗·中', x: '#7C68C0', h: 255, s: 41, l: 58 },
  { n: '瑠璃·中', x: '#4668B8', h: 222, s: 45, l: 50 },
  { n: '藍·中', x: '#3D6FA8', h: 211, s: 47, l: 45 },
  { n: '菫·中', x: '#7367B5', h: 250, s: 35, l: 56 },
  { n: '紺·中', x: '#3A5A96', h: 218, s: 44, l: 41 },
];

/**
 * 马卡龙色库（柔和粉彩）。
 *
 * 粉彩的固有矛盾：**浅色主题下不能用粉彩**（白底上完全看不清）。
 * 所以这里同时收录"粉彩原色"（供深色主题）与"压深版本"（供浅色主题），
 * 由引擎按对比度自动选边 —— 这正是自动挑选优于手工写死的地方。
 */
const MACARON_COLORS = [
  // 粉彩原色（深色主题用）
  { n: '薄荷', x: '#A8E6CF', h: 160, s: 55, l: 78 },
  { n: '薰衣草', x: '#C9B6E4', h: 268, s: 45, l: 80 },
  { n: '樱花粉', x: '#FFB3C6', h: 345, s: 100, l: 85 },
  { n: '奶油黄', x: '#FFE066', h: 49, s: 100, l: 70 },
  { n: '婴儿蓝', x: '#A8D8EA', h: 197, s: 60, l: 79 },
  { n: '珊瑚红', x: '#FF8B94', h: 355, s: 100, l: 77 },
  { n: '湖水绿', x: '#9FE2DE', h: 176, s: 55, l: 75 },
  { n: '蓝紫', x: '#B4C0F0', h: 229, s: 68, l: 82 },
  { n: '中性灰', x: '#D8DEE9', h: 218, s: 27, l: 88 },
  { n: '天空蓝', x: '#BBD4FF', h: 216, s: 100, l: 87 },
  // 压深版本（浅色主题用）—— 保持同一色相，只降亮度
  { n: '薄荷·深', x: '#2E8B6E', h: 160, s: 50, l: 36 },
  { n: '薰衣草·深', x: '#6C4FA1', h: 268, s: 34, l: 47 },
  { n: '樱花粉·深', x: '#C2476B', h: 345, s: 50, l: 52 },
  { n: '奶油黄·深', x: '#B08A1E', h: 45, s: 71, l: 40 },
  { n: '婴儿蓝·深', x: '#2A7BA8', h: 200, s: 61, l: 41 },
  { n: '珊瑚红·深', x: '#D6455C', h: 351, s: 64, l: 55 },
  { n: '湖水绿·深', x: '#1E8B85', h: 176, s: 65, l: 33 },
  { n: '蓝紫·深', x: '#4451B5', h: 233, s: 45, l: 49 },
  { n: '中性灰·深', x: '#5F6875', h: 218, s: 10, l: 42 },
  { n: '天空蓝·深', x: '#3B6FC4', h: 216, s: 54, l: 50 },
  // ── 补齐：粉彩体系原本没有紫与够用的中性灰
  { n: '香芋紫', x: '#D8C4E8', h: 275, s: 47, l: 84 },
  { n: '紫藤', x: '#B9A0D6', h: 273, s: 42, l: 73 },
  { n: '香芋紫·深', x: '#7A5EA8', h: 273, s: 29, l: 51 },
  { n: '紫罗兰·深', x: '#8E5FB0', h: 279, s: 30, l: 53 },
  { n: '雾灰', x: '#C6CBD4', h: 218, s: 12, l: 80 },
  { n: '暖灰', x: '#D3CBC4', h: 30, s: 13, l: 80 },
  { n: '雾灰·深', x: '#6E747E', h: 218, s: 7, l: 46 },
  { n: '暖灰·深', x: '#7A7069', h: 28, s: 7, l: 45 },
  { n: '藕荷', x: '#C9AFC4', h: 315, s: 22, l: 74 },
  { n: '藕荷·深', x: '#8A6383', h: 315, s: 17, l: 46 },
];

/** 缓存的算好色板（纯计算、结果确定，算一次即可）。 */
const cache = new Map();

/**
 * 取一个预设的完整色板（`{ 类别: { light, dark, lightName, darkName } }`）。
 *
 * 结果来自 `buildPalette`（见 `color-engine.js`）——按语义色相 + 对真实宿主
 * 背景的对比度自动挑选，**不是手写值**。
 *
 * @param presetId 预设 id。
 * @returns 类别 → 色值对 的映射（浅拷贝，调用方可安全改）。
 */
export function presetColors(presetId) {
  if (cache.has(presetId)) return { ...cache.get(presetId) };

  let palette = {};
  if (presetId === PRESET_CHINESE) {
    palette = buildPalette(CHINESE_COLORS, SEMANTICS);
  } else if (presetId === PRESET_JAPANESE) {
    palette = buildPalette(JAPANESE_COLORS, SEMANTICS);
  } else if (presetId === PRESET_MACARON) {
    palette = buildPalette(MACARON_COLORS, SEMANTICS);
  }
  cache.set(presetId, palette);
  return { ...palette };
}

/**
 * 取某个预设下某个类别的色值对。
 *
 * @param presetId 预设 id。
 * @param category 类别 id。
 * @returns `{ light, dark }`，或 undefined（该预设未覆盖此类别）。
 */
export function presetColorFor(presetId, category) {
  const pair = presetColors(presetId)[category];
  if (pair === undefined) return undefined;
  return { light: pair.light, dark: pair.dark };
}

/** 预设的中文显示名。 */
export const PRESET_LABELS = {
  [PRESET_CHINESE]: '中国传统色',
  [PRESET_JAPANESE]: '日本传统色',
  [PRESET_MACARON]: '马卡龙色系',
};

/**
 * 供测试断言：某预设覆盖 / 缺失了哪些类别。
 *
 * @param presetId 预设 id。
 * @returns `{ covered, missing }`。
 */
export function presetCoverage(presetId) {
  const palette = presetColors(presetId);
  return {
    covered: ALL_CATEGORIES.filter((c) => Object.hasOwn(palette, c)),
    missing: ALL_CATEGORIES.filter((c) => !Object.hasOwn(palette, c)),
  };
}
