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
 * 对比度下限：**文本**（WCAG 2.1 AA 正文）。
 *
 * 命令分级色会同时用在**标签文字**上（"运行命令"这类 13–14px 文本），所以
 * 不能按图标那个 3.0/3.2 的非文本门槛来，否则大字勉强能看、小字发虚。
 */
export const TEXT_MIN_CONTRAST = 4.5;
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
 * ## 两遍处理：先严格挑，再补漏
 *
 * 每个类别独立挑色（`pickColor` 排除其它色相已占用的颜色，避免"危险色和读取色
 * 撞成同一个"）。但**独立挑色会漏配**：`compaction`(195°) 与 `read`(212°)
 * 只差 17 度，macaron 预设里唯一合适的青蓝被先处理的 `read` 占走后，
 * `compaction` 就没候选了。
 *
 * ⚠️ 第一版遇到这种情况直接 `continue`，把**整个类别静默丢弃** ——
 * 表现是"设置里明明选了颜色、界面就是不上色"，极难定位。
 * 第二版改成"当场放宽重挑"，结果**又撞车**：放宽后 `compaction` 复用了 `read`
 * 已占用的色，两个类别看起来一模一样（被新增的去重测试当场抓住）。
 *
 * 现在分两遍，两个要求同时满足：
 *   第一遍：严格排除其它色相已占用的色 —— 保证不撞车；
 *   第二遍：只给第一遍**没挑到**的类别补漏，允许同色相复用，
 *          但**仍然排除任何类别已用的具体色值** —— 保证"有颜色"且不重复；
 *          连排除都不要还挑不到，才放最后兜底（有颜色优先于不撞色）。
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
  /** 所有已被任何类别占用的具体色值（补漏时仍然要避开）。 */
  const usedColors = new Set();
  /** 第一遍没挑到的类别，留到第二遍补漏。 */
  const pending = [];

  /**
   * 每个色值"归属"于哪个类别 —— 按**色相最近**判定。
   *
   * ⚠️ 这是修掉"类别互相抢色"的关键，光靠 `exclude` 挡不住。
   *
   * 反例（macaron 预设实测）：`read` 的语义色相是 212°，`compaction` 是 195°。
   * 色库里 `婴儿蓝·深` 的实际色相是 **200°** —— 它离 compaction 只差 5°、
   * 离 read 差 12°，**本该属于 compaction**。但引入顺序里 `read` 先挑，
   * 而打分函数以"色调偏差"为主（`|s-targetS| + |l-targetL|`），色相只占 0.6/度：
   * `婴儿蓝·深` 的色调更贴 read 的目标，于是 read 把它抢走，
   * 轮到 compaction 时已经无候选（同色相的近邻又都被占），
   * 只能降级复用 → **两个类别颜色一样**（被去重测试当场抓住）。
   *
   * 所以除了"排除已用的色"，还要限定**这个色本来就该归谁**：
   * 一个色值只允许被"色相离它最近"的类别挑中。同色相多类别（如
   * `thinking` 与 `ctl-plan` 都是 285°）并列归属，两者都可以用。
   */
  const entries = Object.entries(specs);
  const ownersOf = (color) => {
    let best = Infinity;
    const winners = [];
    for (const [key, spec] of entries) {
      const d = hueDistance(color.h, spec.hue);
      if (d < best - 1e-9) {
        best = d;
        winners.length = 0;
        winners.push(key);
      } else if (Math.abs(d - best) <= 1e-9) {
        winners.push(key);
      }
    }
    return winners;
  };
  /** 预先算好每个 hex 的归属，避免每个类别重复计算。 */
  const ownerCache = new Map();
  const ownedBy = (key) => (color) => {
    let owners = ownerCache.get(color.x);
    if (owners === undefined) {
      owners = ownersOf(color);
      ownerCache.set(color.x, owners);
    }
    return owners.includes(key);
  };

  /**
   * 尝试为一个类别挑色。
   *
   * @param key 类别键。
   * @param spec 语义规格。
   * @param allowCrossHueReuse 是否允许复用其它色相已占用的色（补漏阶段为 true）。
   * @returns 成功时返回该类别配色，失败返回 null。
   */
  const attempt = (key, spec, { allowCrossHueReuse, requireOwnership }) => {
    const used = new Set();
    // 只排除**其它色相**已占用的颜色。
    for (const [hue, hexes] of chosenByHue) {
      if (hue === spec.hue) continue;
      for (const hex of hexes) used.add(hex);
    }
    if (!allowCrossHueReuse) {
      for (const hex of usedColors) used.add(hex);
    }
    // 严格阶段只允许"本该属于本类别"的颜色，避免抢走邻近类别的天然匹配。
    const pool = requireOwnership ? colors.filter(ownedBy(key)) : colors;
    const pick = (theme) => pickColor(pool, {
      hue: spec.hue,
      minSaturation: spec.minSaturation,
      maxSaturation: spec.maxSaturation,
      minContrast: spec.minContrast,
      maxContrast: spec.maxContrast,
      exclude: used,
      background: theme === 'light' ? LIGHT_BG : DARK_BG,
      targetS: spec.targetS ?? TONE[theme].s,
      targetL: spec.targetL ?? TONE[theme].l,
    });
    const light = pick('light');
    const dark = pick('dark');
    if (light === null || dark === null) return null;
    const bucket = chosenByHue.get(spec.hue) ?? new Set();
    bucket.add(light.x);
    bucket.add(dark.x);
    chosenByHue.set(spec.hue, bucket);
    usedColors.add(light.x);
    usedColors.add(dark.x);
    out[key] = { light: light.x, dark: dark.x, lightName: light.n, darkName: dark.n };
    return out[key];
  };

  // 第一遍：严格（只用自己的归属色 + 跨类别不撞车）。
  for (const [key, spec] of entries) {
    if (attempt(key, spec, { allowCrossHueReuse: false, requireOwnership: true }) === null) {
      // 放宽"归属"限制再试一次（有些色库色相分布稀疏，严格归属可能无解）。
      if (attempt(key, spec, { allowCrossHueReuse: false, requireOwnership: false }) === null) {
        pending.push([key, spec]);
      }
    }
  }

  // 第二遍：补漏（允许同色相复用，但仍避开任何已用的具体色值）。
  for (const [key, spec] of pending) {
    if (attempt(key, spec, { allowCrossHueReuse: true, requireOwnership: false }) !== null) continue;
    // 最后兜底：连排除都不要了，务必给出一个色（"有颜色"优先于"不撞色"）。
    const dark = pickColor(colors, {
      hue: spec.hue,
      background: DARK_BG,
      targetS: spec.targetS ?? TONE.dark.s,
      targetL: spec.targetL ?? TONE.dark.l,
    });
    const light = pickColor(colors, {
      hue: spec.hue,
      background: LIGHT_BG,
      targetS: spec.targetS ?? TONE.light.s,
      targetL: spec.targetL ?? TONE.light.l,
    });
    const l = light ?? dark;
    const d = dark ?? light;
    if (l === null && d === null) continue;
    out[key] = { light: l.x, dark: d.x, lightName: l.n, darkName: d.n };
    usedColors.add(l.x);
    usedColors.add(d.x);
  }
  return out;
}

/**
 * 从**同一个红色系色库**里挑出「低/中/高」三个风险等级的颜色。
 *
 * ## 分级轴是**饱和度**，不是对比度（这一点前后错过两次）
 *
 * 直觉上"越危险越醒目"应该等于"对比度越高"。实测**在深色主题下这不成立**：
 * 深底上高对比度必然来自**亮**色，而传统红里偏亮的都是粉调（低饱和）——
 * 于是三档会变成 橙红(s85) → 粉(s69) → 浅粉(s68)：对比度确实递增，
 * 但**"最危险"看起来最淡**，与要表达的语义正好相反。
 *
 * 所以等级轴改用**饱和度**：低风险最淡（偏粉/砖红）、高风险最浓（正红/朱红）。
 * 对比度只作为**合法性下限**（标签是 13–14px 文本，取正文门槛 4.5）与上限
 * （防止近黑丢色相），不再参与排序。
 *
 * ## 三个约束，缺一不可
 *
 * 1. **对比度 ∈ [4.5, 9.5]** —— 文本可读，且不会挑到近黑；
 * 2. **饱和度严格递增** —— 这是"等级感"的来源；
 * 3. **相邻 ΔE ≥ 9** —— 三档必须能一眼分辨（用户上一轮的原话是
 *    "你说你做了 实际没有差异"）。
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

  /** 文本可读门槛（WCAG 正文 4.5）与色相辨识上限。 */
  const CR_MIN = TEXT_MIN_CONTRAST;
  const CR_MAX = MAX_CONTRAST;

  /**
   * 每档的目标饱和度与亮度。
   *
   * 饱和度沿 38 → 62 → 86 递增（"越危险越浓"）；亮度只用来在同饱和度里
   * 微调，让颜色不至于发闷。
   */
  const TIERS = [
    { key: 'commandLow', targetS: 38, targetL: 60 },
    { key: 'commandMid', targetS: 62, targetL: 56 },
    { key: 'commandHigh', targetS: 86, targetL: 53 },
  ];

  const out = {};
  for (const theme of ['light', 'dark']) {
    const background = theme === 'light' ? LIGHT_BG : DARK_BG;
    const pool = source
      .map((c) => ({ color: c, cr: contrast(c.x, background) }))
      .filter((e) => e.cr >= CR_MIN && e.cr <= CR_MAX);
    if (pool.length < 3) continue;

    const used = new Set();
    const chosen = [];
    for (const tier of TIERS) {
      let best = null;
      for (const entry of pool) {
        if (used.has(entry.color.x)) continue;
        // 必须与已选档位一眼可辨，否则"分级"形同虚设。
        if (chosen.some((c) => deltaE(c.color.x, entry.color.x) < MIN_TIER_DELTA_E)) continue;
        const cost = Math.abs(entry.color.s - tier.targetS)
          + (Math.abs(entry.color.l - tier.targetL) * 0.6);
        if (best === null || cost < best.cost) best = { ...entry, cost };
      }
      // 严格门槛下挑不到就放宽 ΔE（保证三档都有色，而不是留空）。
      if (best === null) {
        for (const entry of pool) {
          if (used.has(entry.color.x)) continue;
          const cost = Math.abs(entry.color.s - tier.targetS)
            + (Math.abs(entry.color.l - tier.targetL) * 0.6);
          if (best === null || cost < best.cost) best = { ...entry, cost };
        }
      }
      if (best === null) break;
      used.add(best.color.x);
      chosen.push({ tier, ...best });
    }
    if (chosen.length !== TIERS.length) continue;

    // 单调性兜底：万一某档的饱和度没能递增（色库分布异常），按饱和度重排档位，
    // 保证"越危险越浓"这条语义恒成立。
    const ordered = [...chosen].sort((a, b) => a.color.s - b.color.s);
    for (let i = 0; i < TIERS.length; i += 1) {
      const tier = TIERS[i];
      const item = ordered[i];
      const prev = out[tier.key];
      out[tier.key] = {
        light: theme === 'light' ? item.color.x : prev?.light,
        dark: theme === 'dark' ? item.color.x : prev?.dark,
        lightName: theme === 'light' ? item.color.n : prev?.lightName,
        darkName: theme === 'dark' ? item.color.n : prev?.darkName,
      };
    }
  }
  return out;
}

/**
 * HSV 饱和度（0–100）。
 *
 * 命令分级用**饱和度**做等级轴，测试要按同一口径断言，所以导出这个纯函数 ——
 * 避免测试自己再算一套（口径不一致会给出假绿）。
 *
 * @param hex `#RRGGBB`。
 * @returns 0–100 的饱和度；输入非法时返回 0。
 */
export function hsvSaturation(hex) {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex ?? '');
  if (m === null) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return ((max - min) / max) * 100;
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
 * 饱和度奖励系数（每 1 点饱和度抵扣多少对比度偏差）。
 *
 * 取 0.012：红色系的对比度区间宽度约 4（3.2–9.5），饱和度跨度约 60，
 * 于是"满饱和"最多能抵扣 0.72 的对比度偏差 —— 足够让同档位内偏向浓色，
 * 又不足以把三档的对比度台阶压平（台阶本身有 ~1.6 的差距）。
 */
export const SATURATION_BONUS = 0.012;

/**
 * 相邻风险档之间的最小可辨色差。
 *
 * 经验值：ΔE ≈ 2.3 是"刚好能分辨"的门槛，5 以上才"一眼不同"。
 * 这里取 9 —— 三档是要让人**扫一眼就分出轻重**，不是勉强能分辨。
 */
export const MIN_TIER_DELTA_E = 9;
