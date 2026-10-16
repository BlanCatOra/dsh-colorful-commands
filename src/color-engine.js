/**
 * dsh-colorful-commands —— 选色引擎。
 *
 * 从 742 色中国传统色库里，按**语义色相 + 可读对比度**自动挑出每个类别在
 * 浅色/深色主题下的颜色。取代了第一版"我手工挑十几个色值"的做法 ——
 * 那种做法无法保证两套主题都可读，也无法解释为什么是这个色。
 *
 * ## 为什么必须自动挑选
 *
 * DSH 有两套底：浅色 `#ffffff`、深色 `#151517`（内核实测的
 * `--dsw-alias-bg-base` 实际取值）。同一个色值不可能在两边都可读 ——
 * 实测：适合深底的亮黄 `#FFA60F` 在**白底上对比度只有 2.4**，等于看不见。
 * 所以每个类别都要有 light/dark 两个值，且各自独立满足对比度下限。
 *
 * ## 挑选准则（按优先级）
 *
 * 1. **色相必须贴合语义**（危险=红、命令=黄、读取=蓝…）—— 这是"一眼分类"的前提；
 * 2. **对比度达标**（默认 ≥ 3.2；纯函数可调）。阈值取 3.2 而不是 WCAG 正文的
 *    4.5，是因为这些颜色用在 **3px 竖条与图标**上（大色块/图形元素），
 *    WCAG 对非文本图形的门槛就是 3.0；
 * 3. **色相区间内取最高饱和度** —— 同样达标时，越饱和越一眼可辨；
 * 4. **对比度上限**（默认 13）—— 防止挑到近黑/近白，那种颜色虽然"对比度高"
 *    但完全丢失色相辨识度（实测：不限上限时会挑出 `#000000`、`#FFFEFA`）。
 *
 * @module dsh-colorful-commands/color-engine
 */

/** 浅色主题底色（DSH `--dsw-alias-bg-base` 实际值）。 */
export const LIGHT_BG = '#FFFFFF';
/** 深色主题底色（同上）。 */
export const DARK_BG = '#151517';

/** 对比度下限：非文本图形元素（WCAG 1.4.11）。 */
export const MIN_CONTRAST = 3.2;
/**
 * 对比度上限：超过就说明接近黑/白 —— 色相辨识度会丢失。
 *
 * 实测（742 色库 + 白底）：上限 13 时 thinking 会挑到 `#4B0082`（对比度 13.0），
 * 那是近黑的靛蓝，在白底上看起来像"深灰"而不是"紫"。收到 9.5 后挑到的是
 * 真正的紫。所以这个上限不是洁癖，是**保住色相辨识度**的必要约束。
 */
export const MAX_CONTRAST = 9.5;

/** sRGB 分量线性化。 */
function linearize(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * 相对亮度（WCAG 定义）。
 *
 * @param hex `#RRGGBB`。
 * @returns 0–1 的相对亮度；输入非法时返回 1（当作白色，对比度偏保守）。
 */
export function luminance(hex) {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex ?? '');
  if (m === null) return 1;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * 两色的对比度（WCAG 定义，1–21）。
 *
 * @param a `#RRGGBB`。
 * @param b `#RRGGBB`。
 * @returns 对比度。
 */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** 两个色相之间的最短角距（0–180 度）。 */
export function hueDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

/**
 * 为一个语义目标挑一个颜色。
 *
 * 逐级放宽色相窗口（18° → 26° → 34° → 46°），保证任何语义都能落到某个色，
 * 而不是"没有候选"就返回空（那会让某个类别静默不上色）。
 *
 * @param colors 色库（`{ n, x, h, s, l }` 数组）。
 * @param options.hue 目标色相（度）。
 * @param options.background 目标主题底色。
 * @param options.minSaturation 最低饱和度。
 * @param options.maxSaturation 最高饱和度。
 * @param options.minContrast 对比度下限。
 * @param options.maxContrast 对比度上限。
 * @param options.exclude 已占用的 hex 集合；用于避免不同类别挑到同一个色。
 * @returns 选中的色，或 null。
 */
export function pickColor(colors, options) {
  const {
    hue,
    background,
    minSaturation = 45,
    maxSaturation = 100,
    minContrast = MIN_CONTRAST,
    maxContrast = MAX_CONTRAST,
    exclude,
  } = options;

  for (const window of [18, 26, 34, 46]) {
    const candidates = [];
    for (const color of colors) {
      if (hueDistance(color.h, hue) > window) continue;
      if (color.s < minSaturation || color.s > maxSaturation) continue;
      // 去重：别的类别（或本类别的另一主题）已经用了这个色就跳过。
      // 实测不加去重时 read 与 web 会挑到同一个 `#4F84FF`，两个类别看起来一样。
      if (exclude !== undefined && exclude.has(color.x)) continue;
      const ratio = contrast(color.x, background);
      if (ratio < minContrast || ratio > maxContrast) continue;
      candidates.push({ color, ratio });
    }
    if (candidates.length > 0) {
      // 同窗口内：饱和度高的优先（更一眼可辨）；并列时取色相更贴合的。
      candidates.sort((a, b) => {
        if (b.color.s !== a.color.s) return b.color.s - a.color.s;
        return hueDistance(a.color.h, hue) - hueDistance(b.color.h, hue);
      });
      return candidates[0].color;
    }
  }
  return null;
}

/**
 * 一个语义的完整定义。
 *
 * @typedef {object} SemanticSpec
 * @property {number} hue 目标色相（度）。
 * @property {number} [minSaturation] 饱和度下限（默认 45）。
 * @property {number} [maxSaturation] 饱和度上限（默认 100）。
 */

/**
 * 按语义规格，为每个键挑出 light/dark 两值。
 *
 * @param colors 色库。
 * @param specs 语义 → 规格。
 * @returns `{ [key]: { light, dark, lightName, darkName } }`。
 */
export function buildPalette(colors, specs) {
  const out = {};
  /**
   * 已占用的色值，按**色相**分组去重。
   *
   * 关键点：`thinking` 与 `ctl-plan` 是同一语义（都是紫，hue 285），
   * 它们**共用同一个颜色是正确的** —— 用户看到"紫=思考/计划"才有一致性。
   * 所以去重只在**不同色相**之间做，避免的是"危险色和读取色撞成同一个"
   * 那种真正的问题。
   */
  /** 每个色相挑中的色值（同色相复用，跨色相才互斥）。 */
  const chosenByHue = new Map();
  for (const [key, spec] of Object.entries(specs)) {
    // 只排除**其它色相**已占用的颜色；同色相（如 thinking 与 ctl-plan 都是紫）
    // 就该挑到同一个色 —— 那正是"同语义同色"的一致性。
    const used = new Set();
    for (const [hue, hexes] of chosenByHue) {
      if (hue === spec.hue) continue;
      for (const hex of hexes) used.add(hex);
    }
    const light = pickColor(colors, {
      hue: spec.hue,
      background: LIGHT_BG,
      minSaturation: spec.minSaturation,
      maxSaturation: spec.maxSaturation,
      exclude: used,
    });
    const dark = pickColor(colors, {
      hue: spec.hue,
      background: DARK_BG,
      minSaturation: spec.minSaturation,
      maxSaturation: spec.maxSaturation,
      exclude: used,
    });
    // 任一侧挑不到就整个类别跳过（不上色，而不是产出坏值）。
    if (light === null || dark === null) continue;
    const bucket = chosenByHue.get(spec.hue) ?? new Set();
    bucket.add(light.x);
    bucket.add(dark.x);
    chosenByHue.set(spec.hue, bucket);
    out[key] = {
      light: light.x,
      dark: dark.x,
      lightName: light.n,
      darkName: dark.n,
    };
  }
  return out;
}
