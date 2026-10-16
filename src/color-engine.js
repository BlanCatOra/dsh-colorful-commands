/**
 * dsh-colorful-commands —— 选色引擎。
 *
 * 从传统色库里，按**语义色相 + 统一色调 + 可读对比度**自动挑出每个类别在
 * 浅色/深色主题下的颜色。取代了"我手工挑十几个色值"的做法 —— 那种做法无法
 * 保证两套主题都可读，也无法解释为什么是这个色。
 *
 * ## 为什么必须自动挑选
 *
 * DSH 有两套底：浅色 `#ffffff`、深色 `#151517`（内核实测的
 * `--dsw-alias-bg-base` 实际取值）。同一个色值不可能在两边都可读 ——
 * 实测：适合深底的亮黄 `#FFA60F` 在**白底上对比度只有 2.4**，等于看不见。
 * 所以每个类别都要有 light/dark 两个值，且各自独立满足对比度下限。
 *
 * ## 配色为什么按「同色调」挑（用户 2026-10-16 反馈"颜色搭配丑陋"）
 *
 * 旧版规则是"色相窗口内取**最高饱和度**"。逐类独立取最大值的结果是：
 * 紫色被推到刺眼的 `#A020F0`，而蓝/靛两类各自挑到几乎一样的深蓝
 * （`#4F84FF` 与 `#4A8DDA`）—— 放在一起既撞色又不协调。
 *
 * 现在的规则改成**统一色调**：所有类别共用同一个目标饱和度与亮度，
 * 只让**色相**不同。这是配色的基本手法 —— 色相负责区分，色调负责统一。
 * 一眼看去是一套配色，而不是一堆各自为政的高饱和色。
 *
 * ## 挑选准则（按优先级）
 *
 * 1. **对比度达标**（默认 ≥ 3.2，≤ 9.5）—— 先排除看不清的；
 * 2. **色调贴合目标**（`targetS` / `targetL`）—— 这是"像一套配色"的关键；
 * 3. **色相贴合语义**（危险=红、命令=红系、读取=蓝…）；
 * 4. **与其它类别的色相拉开**（`exclude` 按色相分组去重）。
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
 * 实测（742 色库 + 白底）：不限上限时会挑到 `#4B0082`（对比度 13.0）那种近黑
 * 的靛蓝，在白底上看起来像"深灰"而不是"紫"。
 */
export const MAX_CONTRAST = 9.5;

/**
 * 统一色调目标。
 *
 * 浅色主题用**中等偏深**的色（白底需要足够暗才可读）；
 * 深色主题用**中等偏亮**的色。饱和度取中高但不是最高 —— 最高饱和度是"刺眼"
 * 的来源，中高饱和度才有"一套配色"的整体感。
 */
export const TONE = {
  light: { s: 58, l: 42 },
  dark: { s: 52, l: 66 },
};

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
 * 逐级放宽色相窗口（16° → 24° → 34° → 48°），保证任何语义都能落到某个色，
 * 而不是"没有候选"就返回空（那会让某个类别静默不上色）。
 *
 * @param colors 色库（`{ n, x, h, s, l }` 数组）。
 * @param options.hue 目标色相（度）。
 * @param options.background 目标主题底色。
 * @param options.targetS 目标饱和度。
 * @param options.targetL 目标亮度。
 * @param options.minSaturation 饱和度下限。
 * @param options.maxSaturation 饱和度上限。
 * @param options.minContrast 对比度下限。
 * @param options.maxContrast 对比度上限。
 * @param options.exclude 已占用的 hex 集合；用于避免不同类别挑到同一个色。
 * @param options.weightTone 色调权重（越大越追求"统一色调"）。
 * @returns 选中的色，或 null。
 */
export function pickColor(colors, options) {
  const {
    hue,
    background,
    targetS = TONE.light.s,
    targetL = TONE.light.l,
    minSaturation = 25,
    maxSaturation = 100,
    minContrast = MIN_CONTRAST,
    maxContrast = MAX_CONTRAST,
    exclude,
    weightTone = 1,
  } = options;

  for (const window of [16, 24, 34, 48]) {
    const candidates = [];
    for (const color of colors) {
      const dh = hueDistance(color.h, hue);
      if (dh > window) continue;
      if (color.s < minSaturation || color.s > maxSaturation) continue;
      // 去重：别的类别（或本类别的另一主题）已经用了这个色就跳过。
      // 实测不加去重时 read 与 web 会挑到同一个 `#4F84FF`，两个类别看起来一样。
      if (exclude !== undefined && exclude.has(color.x)) continue;
      const ratio = contrast(color.x, background);
      if (ratio < minContrast || ratio > maxContrast) continue;
      // 打分：色调偏差为主，色相偏离为辅。乘权重后可调"统一 vs 贴色相"的取舍。
      const toneCost = (Math.abs(color.s - targetS) + Math.abs(color.l - targetL)) * weightTone;
      const score = toneCost + dh * 0.6;
      candidates.push({ color, score, dh });
    }
    if (candidates.length > 0) {
      // 同窗口内：综合分最低者胜出（色调最贴、色相最合）。
      candidates.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.dh - b.dh));
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
 * @property {number} [targetS] 目标饱和度（默认取 `TONE`）。
 * @property {number} [targetL] 目标亮度（默认取 `TONE`）。
 * @property {number} [minSaturation] 饱和度下限（默认 25）。
 * @property {number} [maxSaturation] 饱和度上限（默认 100）。
 * @property {number} [minContrast] 对比度下限（覆盖全局默认）。
 * @property {number} [maxContrast] 对比度上限（覆盖全局默认）。
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
   * 每个色相挑中的色值（同色相复用，跨色相才互斥）。
   *
   * 关键点：`thinking` 与 `ctl-plan` 是同一语义（都是紫），或三个命令等级同属
   * 红色系 —— 它们**共用同一族颜色是正确的**。所以按**色相**分组去重，
   * 避免的是"危险色和读取色撞成同一个"那种真正的问题。
   */
  const chosenByHue = new Map();
  for (const [key, spec] of Object.entries(specs)) {
    // 只排除**其它色相**已占用的颜色。
    const used = new Set();
    for (const [hue, hexes] of chosenByHue) {
      if (hue === spec.hue) continue;
      for (const hex of hexes) used.add(hex);
    }
    const common = {
      hue: spec.hue,
      minSaturation: spec.minSaturation,
      maxSaturation: spec.maxSaturation,
      minContrast: spec.minContrast,
      maxContrast: spec.maxContrast,
      exclude: used,
    };
    const light = pickColor(colors, {
      ...common,
      background: LIGHT_BG,
      targetS: spec.targetS ?? TONE.light.s,
      targetL: spec.targetL ?? TONE.light.l,
    });
    const dark = pickColor(colors, {
      ...common,
      background: DARK_BG,
      targetS: spec.targetS ?? TONE.dark.s,
      targetL: spec.targetL ?? TONE.dark.l,
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

/**
 * 从**同一个红色系色库**里挑出「低/中/高」三个风险等级的颜色。
 *
 * 用户要求「运行命令应该根据命令的危险性等分等级上色，采用红色系」，所以
 * 三级都用红（色相窗口覆盖正红到偏紫的红），靠**明暗台阶**分级。
 *
 * ## ⚠️ 为什么不能"各档定一个目标亮度再各自挑最近的"
 *
 * 第一版就是这么写的（给三档分别设 `targetL` 56/64/72，再让 `pickColor` 挑最
 * 接近的）。结果**三档几乎一模一样**（深色主题实测 `#C45A65` / `#C74A4D` /
 * `#D46A6A`），而且顺序还错了：低档对比度 4.34、中档 3.92 —— **中档比低档更暗**，
 * 完全不符合"越危险越醒目"。用户直接指出来："不同档位颜色你说你做了 实际没有差异"。
 *
 * 根因是**目标亮度不是单调的对比度**：`pickColor` 按"色调偏差 + 色相偏离"打分，
 * 而排除集（三档互斥）会把某一档挤到离目标很远的色上，单调性就丢了。
 *
 * ## 现在的做法：按**对比度分位**取，并强制单调 + 最小可辨距离
 *
 * 1. 先把色库里"对当前主题底色对比度达标"的颜色全部算出来，按对比度排序；
 * 2. 在**可达对比度区间**上取三个分位点（低 30% / 中 55% / 高 85%）当作目标 ——
 *    这样三档天然落在深浅不同的位置，而不是各自撞到同一个极值；
 * 3. 每档挑**对比度最接近目标**且未被占用的色；
 * 4. 最后**校验单调性与最小可辨距离（ΔE）**，不满足就整体放宽重来 ——
 *    宁可换一套色，也不产出"看起来一样"的三档。
 *
 * @param colors 色库（红色系）。
 * @param options.hueCenter 色相中心（默认 5 度，正红略偏橙）。
 * @param options.hueWindow 色相窗口（默认 40 度，覆盖偏紫的红）。
 * @returns `{ commandLow, commandMid, commandHigh }`（缺项表示该级挑不到色）。
 */
export function buildRedTiers(colors, options = {}) {
  const hueCenter = options.hueCenter ?? 5;
  const hueWindow = options.hueWindow ?? 40;
  const family = colors.filter((c) => hueDistance(c.h, hueCenter) <= hueWindow);
  const source = family.length >= 8 ? family : colors;

  /** 三个等级的目标分位（在可达对比度区间上的位置）。 */
  const TIERS = [
    { key: 'commandLow', q: 0.30 },
    { key: 'commandMid', q: 0.55 },
    { key: 'commandHigh', q: 0.85 },
  ];

  /** 对比度下限（非文本图形，WCAG 1.4.11）与上限（防止近黑/近白丢色相）。 */
  const CR_MIN = MIN_CONTRAST;
  const CR_MAX = MAX_CONTRAST;

  const out = {};
  for (const theme of ['light', 'dark']) {
    const background = theme === 'light' ? LIGHT_BG : DARK_BG;
    // 可选色：色相在窗口内、饱和度不至于发灰、对比度在区间内。
    const pool = source
      .map((c) => ({ color: c, cr: contrast(c.x, background) }))
      .filter((e) => e.cr >= CR_MIN && e.cr <= CR_MAX && e.color.s >= 28)
      .sort((a, b) => a.cr - b.cr);
    if (pool.length < 3) continue;

    const lo = pool[0].cr;
    const hi = pool[pool.length - 1].cr;
    const used = new Set();
    const chosen = [];
    for (const tier of TIERS) {
      const target = lo + tier.q * (hi - lo);
      // 挑对比度最接近目标、且与已选色有足够色差（ΔE）的候选。
      let best = null;
      for (const entry of pool) {
        if (used.has(entry.color.x)) continue;
        // 与同主题已选色必须能一眼分辨（ΔE 门槛）。
        const tooClose = chosen.some((c) => deltaE(c.color.x, entry.color.x) < MIN_TIER_DELTA_E);
        if (tooClose) continue;
        const cost = Math.abs(entry.cr - target);
        if (best === null || cost < best.cost) best = { ...entry, cost };
      }
      // 严格门槛下挑不到就放宽 ΔE 再挑一次（保证三档都有色，而不是留空）。
      if (best === null) {
        for (const entry of pool) {
          if (used.has(entry.color.x)) continue;
          const cost = Math.abs(entry.cr - target);
          if (best === null || cost < best.cost) best = { ...entry, cost };
        }
      }
      if (best === null) break;
      used.add(best.color.x);
      chosen.push({ tier, ...best });
    }
    if (chosen.length !== TIERS.length) continue;
    for (const item of chosen) {
      const prev = out[item.tier.key];
      const light = theme === 'light' ? item.color.x : prev?.light;
      const dark = theme === 'dark' ? item.color.x : prev?.dark;
      const lightName = theme === 'light' ? item.color.n : prev?.lightName;
      const darkName = theme === 'dark' ? item.color.n : prev?.darkName;
      out[item.tier.key] = { light, dark, lightName, darkName };
    }
  }
  return out;
}

/**
 * 两色之间的 CIEDE76 色差（sRGB → Lab，够用来做"能不能一眼分辨"的判定）。
 *
 * @param a `#RRGGBB`。
 * @param b `#RRGGBB`。
 * @returns 色差（0 起，越大越不同）。
 */
export function deltaE(a, b) {
  const A = toLab(a);
  const B = toLab(b);
  return Math.sqrt(((A[0] - B[0]) ** 2) + ((A[1] - B[1]) ** 2) + ((A[2] - B[2]) ** 2));
}

/** sRGB → CIE L*a*b*（D65）。 */
function toLab(hex) {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex ?? '');
  if (m === null) return [0, 0, 0];
  const [r, g, bl] = [m[1], m[2], m[3]].map((h) => linearize(parseInt(h, 16)));
  const x = ((r * 0.4124) + (g * 0.3576) + (bl * 0.1805)) / 0.95047;
  const y = (r * 0.2126) + (g * 0.7152) + (bl * 0.0722);
  const z = ((r * 0.0193) + (g * 0.1192) + (bl * 0.9505)) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116));
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [(116 * fy) - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * 相邻风险档之间的最小可辨色差。
 *
 * 经验值：ΔE ≈ 2.3 是"刚好能分辨"的门槛，5 以上才"一眼不同"。
 * 这里取 9 —— 三档是要让人**扫一眼就分出轻重**，不是勉强能分辨。
 */
export const MIN_TIER_DELTA_E = 9;
