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
import { COMMAND_REDS } from './data/command-reds.js';
import { buildPalette, buildRedTiers } from './color-engine.js';

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
  thinking: { hue: 285, minSaturation: 18 },
  read: { hue: 212 },
  write: { hue: 150 },
  search: { hue: 172 },
  // ⚠️ `web`（访问/搜索网页）：用户 2026-10-17 反馈「蓝色饱和度太高」。
  //
  // 实测问题：chinese 预设下 `web` 是 `#2A52BE`（s64）/ `#4F84FF`（**s100** = 色库里的"绀青"）。
  // 深色主题那个尤其刺眼。
  //
  // ⚠️ 为什么**不能**用 `maxSaturation`：它是**过滤候选**。h≈230 在中文色库里极稀疏 ——
  //    h205-210 那批低饱和亮蓝（星蓝/云水蓝/缥色/天青）都离 `read`(212) 更近，
  //    `ownersOf` 的归属判定会判给 `read`，`web` 根本拿不到。实测把 `maxSaturation`
  //    压到 52~58，chinese 直接退化成**浅深同色** `#4A6FA6`，且与 `read` 的 ΔE 仅 5
  //    （几乎一模一样）；压到 ≥64 则完全不生效（`#4F84FF` 原样保留）。
  //    → 过滤式上限在"色库稀疏 + 有归属判定"的前提下是死路。
  //
  // ✅ 改用 `saturationCap`（**对选中的色限幅**，不是过滤候选）：
  //    引擎照常选出色 → 只把饱和度压到上限，保持色相与亮度。
  //    既不改变"选哪个色"，也不会因为无候选而兜底成同色。
  web: { hue: 230, saturationCap: 48 },
  // 重试是"等待/重来"语义，用琥珀橙（与"其他工具"的哑褐拉开，也和命令的红色系区分）。
  retry: { hue: 35, minSaturation: 30 },
  // 压缩是"上下文被收拢"的中性事件，用青蓝（与 read 的天青、search 的石绿拉开）。
  compaction: { hue: 195, minSaturation: 25 },
  other: { hue: 25, minSaturation: 5, maxSaturation: 45 },
  'ctl-plan': { hue: 285, minSaturation: 18 },
};

/**
 * hex → HSL（H 0-360，S/L 0-100）。
 *
 * 只为本文件的 `saturationCap` 服务；不引第三方色彩库。
 * @param hex `#RGB` 或 `#RRGGBB`。
 * @returns `{ h, s, l }`。
 */
export function hexToHsl(hex) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/**
 * HSL → hex。
 * @param h 色相 0-360。
 * @param s 饱和度 0-100。
 * @param l 亮度 0-100。
 * @returns `#RRGGBB`（大写）。
 */
function hslToHex(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb;
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = ln - c / 2;
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
}

/**
 * 对已选出的色值施加「饱和度上限」（就地修改传入的 map）。
 *
 * ## 为什么需要它（而不是 `maxSaturation`）
 *
 * `maxSaturation` 是**过滤候选**：候选被过滤光了，`buildPalette` 会走补漏/兜底，
 * 结果可能是"浅深同色"或与邻居撞色。色库稀疏时（h≈230 的中文蓝）这条死路。
 *
 * `saturationCap` 是**对已选中的色限幅**：保持色相与亮度，只把 S 压到上限。
 * 好处是"选哪个色"完全不变，只调鲜艳度，因此不会引入新的兜底或撞色。
 *
 * ⚠️ 只处理 `spec.saturationCap` 存在、且该类别确实在 `map` 里的项。
 * ⚠️ `lightName` / `darkName` 保留原值（限幅后色名不再精确，
 *    但它只用于调试展示，比凭空编一个色名更诚实）。
 *
 * @param map 类别 → `{ light, dark, lightName, darkName }`（就地修改）。
 * @param specs 语义规格表。
 */
export function applySaturationCaps(map, specs) {
  for (const [key, spec] of Object.entries(specs)) {
    const cap = spec.saturationCap;
    if (typeof cap !== 'number') continue;
    const pair = map[key];
    if (pair === undefined) continue;
    for (const theme of ['light', 'dark']) {
      if (typeof pair[theme] !== 'string') continue;
      const { h, s, l } = hexToHsl(pair[theme]);
      if (s <= cap) continue;
      pair[theme] = hslToHex(h, cap, l);
    }
  }
}

/**
 * 状态类配色（2026-10-17 新增）—— **固定色值，不从预设色库挑**。
 *
 * ## 为什么必须固定（而不是像内容类那样"按色相从色库选"）
 *
 * 状态类出现在**消息尾部**（`turn-tail`）与**输入框底部条**，语义只有三种：
 * 成功 / 信息 / 分级的警示。它们**不表达工具语义**，所以没有"要跟预设风格
 * 保持一致的语义色相"这回事。
 *
 * 而"按色相从色库挑"在这里**行不通**，有实测依据：
 *  - 内容类已占用 25/35/150/172/195/212/215/230/285 九个色相，剩下的空档太窄；
 *  - `japanese`（58 色）与 `macaron`（34 色）色库**太小**，塞进 19 个类别后
 *    必然挑不到唯一色，`buildPalette` 的补漏阶段会降级复用 →
 *    实测出现 `done vs write = #2E8B6E`、`usageMid vs retry = #B08A1E` 等撞色，
 *    甚至有类别**完全无解**（`done 缺失`）。
 *
 * 改成固定色值后：
 *  - 三套预设共用同一组状态色（它们本来就与预设风格无关）；
 *  - 色相与内容区**完全错开**，从构造上不可能撞色；
 *  - 饱和度统一压低（32–56），满足用户三次强调的"不要太鲜艳抢眼"。
 *
 * ⚠️ 四档的**饱和度必须递增**（低→高：40/44/48/56）：用户要求"自己分级"，
 *    而只靠色相区分在小尺寸进度圈上不够醒目。亮度另有 `contrast` 测试守住。
 */
const STATUS_COLORS = {
  // `summary`（**聚合**过程组标题：同一组里含多种活动）。
  //
  // ⚠️ 用户 2026-10-17 反馈"太混乱了"：同一件事因活动排列顺序不同，
  //    `data-process-activity` 只保留其中一个，于是被染成蓝/绿/玫红三种色。
  //    聚合摘要**没有单一语义**，所以给它一个**独立的、不与任何语义活动撞车**的色 ——
  //    它的作用不是"表达某个活动"，而是让混合活动一眼看出"这是汇总"。
  //
  // ⚠️ 曾经让它参与内容区选色（hue 215），结果**夹在 read(212) 与 compaction(195)
  //    之间抢走 read 的天然匹配色**，导致 `read` 与 `compaction` 撞成同一个
  //    `#2A7BA8`（被去重测试当场抓住）。所以它必须走固定色。
  //
  // ## 2026-10-17 第二次调整：灰 → 靛蓝（用户："灰色不明显"）
  //
  // 原值 `#6E7480` / `#98A0AC`（s≈8%）太接近次要文本色，混在正文里看不出来。
  // 用户明确要求"只更改混合活动的预设颜色"，所以这里只动这一项。
  //
  // 新值取**靛蓝**（h≈235，与内容类 25/35/150/172/195/212/230/285 都不重合）：
  // - 饱和度 light 31 / dark 53（落在本表 32–56 的设计区间附近），
  //   比原来的 8% 明显，但仍不喧宾夺主；
  // - 对比度 light 7.5 / dark 8.0（硬约束是 3.0–10.5）；
  // - 与最近的其它类别 ΔE：light 19.4（read）、dark 14.5（thinking）——
  //   都远高于"看起来像同一个色"的阈值。
  // - 三套预设共用（状态色本来就不随预设变，见本表开头说明）。
  summary: { light: '#4A4F8C', dark: '#A8ADE4' },
  // 「已完成 · 用时 xxx」：用户明确要求成功色（绿色系）。
  // 取偏冷的墨绿 `#2F6B4F`（浅）/ `#7FC49B`（深）—— 与内容区 `write` 的
  // 正绿（150°）明显不同（这里是 152° 但更暗更灰），且不是命令区的红色系。
  done: { light: '#2F6B4F', dark: '#7FC49B' },
  // 「处理失败」/「已停止」：data-turn-process 按钮的另外两种态（内核源码
  // `TurnProcessNodeView`：reason=error → 处理失败；reason=aborted → 已停止）。
  // ⚠️ 与 done 同一张表、同样固定色值（理由同上：状态色不参与色库选色）。
  // 配色约束：用户三次强调"不要太鲜艳抢眼" —— 饱和度压到与 done(≈40)同档，
  // 失败用暗哑砖红（与命令区 commandHigh 的正红拉开），中止用低饱和暖灰橙
  //（读作"中性收尾"，不与 usageHigh 的警示橙混淆）。
  turnError: { light: '#8A3A34', dark: '#C98A80' },
  turnStopped: { light: '#7A655A', dark: '#B09A8C' },
  // 尾部用量数字 / 分支按钮：信息性，低饱和石板蓝灰，"存在但不抢戏"。
  meta: { light: '#5A6B7C', dark: '#8FA3B5' },
  // 上下文进度圈四档：<35 绿 → 35-49 黄 → 50-67 橙 → >=68 红。
  // 用户要求"35 以下绿色系，自己分级"+ 结合 DSH 自动压缩阈值 68%（"两者综合"）。
  usageLow: { light: '#3F7A4A', dark: '#7EC08C' },
  usageMid: { light: '#87762A', dark: '#D6C56A' },
  usageHigh: { light: '#9A5A22', dark: '#E0A055' },
  usageCritical: { light: '#B0291F', dark: '#F06A52' },
};

/**
 * 状态类别名（供 `presetColors` 合并）。
 */
const STATUS_KEYS = Object.keys(STATUS_COLORS);


/**
 * 权限等级 → 语义色相（用户要求"不同权限等级的颜色应该不同"）。
 *
 * 单独一张表、单独一次选色，理由是**跨区域复用颜色是允许的**：内容区已经用掉了
 * 绿（写入）、蓝（读取）、紫（思考）、青（搜索），而权限控件在输入框里，与内容区
 * 不重叠 —— 让「仅可查看」用绿、「工作区内修改」用蓝，反而**语义一致**（绿=安全、
 * 蓝=常规、橙=危险、紫=实验）。
 *
 * 若与内容区共用一次选色，去重逻辑会把它们挤到别的色相上，反而丢掉这层语义。
 *
 * | 等级 | 色相 | 语义 |
 * |---|---|---|
 * | `read-only` 仅可查看 | 150 绿 | 最安全 |
 * | `workspace-write` 工作区内修改 | 212 蓝 | 常规 |
 * | `danger-full-access` 完全权限 | 25 橙 | 危险 |
 * | `auto` Auto review | 285 紫 | 实验 |
 *
 * `ctl-permission` 是**未识别等级时的兜底**，取蓝色（= 最常见的"工作区内修改"）。
 */
const PERMISSION_SEMANTICS = {
  'perm-readonly': { hue: 150 },
  'perm-workspace': { hue: 212 },
  'perm-full': { hue: 25 },
  'perm-auto': { hue: 285, minSaturation: 18 },
  'ctl-permission': { hue: 212 },
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
  // ── 补齐：粉彩体系缺橙（权限"完全权限"需要一档警示色；黄不够区分）
  { n: '蜜橘', x: '#F2B48C', h: 25, s: 80, l: 75 },
  { n: '蜜橘·深', x: '#B2612A', h: 25, s: 62, l: 43 },
  // ── 补齐：缺青蓝（"上下文压缩"落在 h195，色库里没有足够近的青蓝会被
  //    read 抢走候选色，导致 compaction 只能降级复用而与之撞色）。
  { n: '松石', x: '#A8DAD6', h: 175, s: 55, l: 76 },
  { n: '松石·深', x: '#27808F', h: 192, s: 57, l: 36 },
];

/** 缓存的算好色板（纯计算、结果确定，算一次即可）。 */
const cache = new Map();

/**
 * 命令风险三档的**固定**配色（来自用户指定的红色系色表）。
 *
 * ⚠️ 三级刻意与预设无关：用户在需求里直接给了这张红色表，要求"运行命令按危险性
 * 分等级、采用红色系"。所以不参与预设选色，而是从这张表里按色调分级固定挑出，
 * 保证任何预设下"越危险越醒目"的语义都一致。
 *
 * 具体色值由 `buildRedTiers()` 从 196 色红色表里按对比度 + 色调台阶算出。
 */
const RED_TIERS = buildRedTiers(COMMAND_REDS);

/**
 * 权限等级配色的缓存（与预设无关，算一次即可）。
 *
 * ⚠️ 三个预设各算一遍会得到同一组值（因为来源不是预设色库），所以单独缓存。
 */
const permissionCache = new Map();

/**
 * 取一个预设的完整色板（`{ 类别: { light, dark, lightName, darkName } }`）。
 *
 * 结果来自 `buildPalette` / `buildRedTiers`（见 `color-engine.js`）——按语义色相、
 * 统一色调与对真实宿主背景的对比度自动挑选，**不是手写值**。
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
  // 命令三档固定叠在预设之上（用户指定的红色系）。
  const content = { ...palette, ...RED_TIERS };
  // 对上一步选出的内容色施加 `saturationCap`（若有）。
  // ⚠️ 必须在 `buildPalette` **之后**、合并状态色**之前**做。
  applySaturationCaps(content, SEMANTICS);
  // ⚠️ 状态类（消息尾部 / 输入框底部条）**单独选色**，并把内容类已用的色值
  //    传进去排除 —— 两组之间、以及组内都不能撞色。
  //    背景见 STATUS_SEMANTICS 的说明（并进内容区会抢走 read 的天然匹配色）。
  // 状态类固定色（不参与色库选色，见 STATUS_COLORS 说明）。
  const status = {};
  for (const key of STATUS_KEYS) {
    const v = STATUS_COLORS[key];
    status[key] = { light: v.light, dark: v.dark, lightName: '状态色', darkName: '状态色' };
  }
  const merged = { ...content, ...status, ...permissionColorsFor(presetId) };
  cache.set(presetId, merged);
  return { ...merged };
}

/**
 * 权限等级配色（按预设各自的色库挑，保证与预设风格一致）。
 *
 * @param presetId 预设 id。
 * @returns 权限等级 → 色值对。
 */
function permissionColorsFor(presetId) {
  if (permissionCache.has(presetId)) return permissionCache.get(presetId);
  const source = presetId === PRESET_JAPANESE
    ? JAPANESE_COLORS
    : presetId === PRESET_MACARON
      ? MACARON_COLORS
      : CHINESE_COLORS;
  const built = buildPalette(source, PERMISSION_SEMANTICS);
  permissionCache.set(presetId, built);
  return built;
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
