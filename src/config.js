/**
 * dsh-colorful-commands —— Host 侧配置 schema。
 *
 * ## 为什么 Host 侧也要校验颜色
 *
 * 设置文件（`$DSH_HOME/cordis.patch.yml` 或用户设置文档）是**可被手工编辑**的
 * 纯文本。渲染层（`css.js` 的 `sanitizeColor`）已经做了白名单校验，但那是
 * "最后一道闸"；在 Host 边界再校验一次，能让非法值**根本存不进去**，
 * 用户也能在保存时立刻得到反馈，而不是"存了但没效果"。
 *
 * ## volatile 活引用
 *
 * 内核实测：`asVolatile` 包装的字段在 `apply` 收到的 config 里**不是普通值**，
 * 而是 `{ get(), [write] }` 活引用；读它必须剥一层（见 `unwrapVolatile`）。
 * 本插件在 Host 侧不读配置（渲染完全在浏览器侧），但仍需正确导出 Config，
 * 让 settings 服务能发现并展示这个命名空间。
 *
 * @module dsh-colorful-commands/config
 */
import z from '@deepseek-ai/schemastery';

/** 合法色值：`#RGB` 或 `#RRGGBB`。 */
const HEX = z.string().pattern(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

/** 一个类别的双主题色值。两边都必填：单边会让另一个主题下失明。 */
const pairSchema = z.object({
  light: HEX.description('浅色主题下的颜色'),
  dark: HEX.description('深色主题下的颜色'),
});

/** 可用类别（与 constants.js 的 ALL_CATEGORIES 保持一致）。 */
const CATEGORY_NAMES = [
  'thinking', 'commandLow', 'commandMid', 'commandHigh', 'read', 'write', 'search', 'web', 'other',
  'ctl-permission', 'ctl-plan',
  'perm-readonly', 'perm-workspace', 'perm-full', 'perm-auto',
];

/** 类别 → 色值对 的字典。只允许已知类别键，避免设置文件被塞进任意键。 */
const colorsSchema = z.dict(pairSchema).description('类别到 { light, dark } 色值的映射');

/** 预设 id。 */
const presetSchema = z.union([
  z.const('none'),
  z.const('chinese'),
  z.const('japanese'),
  z.const('macaron'),
  z.const('custom'),
]).description('内置配色预设');

/**
 * 本插件的设置 schema。
 *
 * 字段：
 * - `enabled`：总开关（默认开）。
 * - `preset`：预设 id（默认中国传统色）。
 * - `colors`：用户逐个类别的覆盖值；只写用户改过的项。
 *
 * ⚠️ **不再有 `colorText` 开关。** 用户 2026-10-16 明确反馈"分析正文被错误地
 * 上色、上色部分太多"，所以"染正文"这条路整个去掉了 —— 只染图标与短标签。
 */
export const Config = z.object({
  enabled: z.boolean().default(true).description('是否启用着色'),
  preset: presetSchema.default('chinese'),
  colors: colorsSchema.default({}),
});

/**
 * 剥掉 volatile 活引用，拿到真实值。
 *
 * 内核实测：`asVolatile` 字段在插值结果里是 `{ get() }`，直接读会得到对象
 * 而不是值 —— 这是"静默失效"型缺陷（比较永远不成立、读出来是空对象）。
 *
 * @param value 可能是活引用的值。
 * @returns 真实值。
 */
export function unwrapVolatile(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    return value.get();
  }
  return value;
}

/** 已知类别名（供测试断言 schema 与 constants 同步）。 */
export { CATEGORY_NAMES };
