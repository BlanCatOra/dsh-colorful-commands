/**
 * dsh-colorful-commands —— 样式生成（纯函数，返回 CSS 文本）。
 *
 * ## 关键设计一：JS 打标 + 自有属性选择器
 *
 * DSH 的 CSS Module 类名带**每次构建的内容哈希**（实测 `Ph6Lgq_root`、
 * `ZmL7Ga_root`），写 `.ToolRow_root` 这类选择器在宿主升级后必然静默失效。
 *
 * 因此运行时（`dom.js`）用 `classify.js` 给元素打上**本插件自己的属性**
 * `data-cc-cat="<类别>"`，本模块只针对这个属性生成样式。DSH 内部结构只
 * 出现在 `classify.js` 一处，且该文件是纯函数、有单测。
 *
 * ## 关键设计二：染色作用点必须落在「真正持有 color 的元素」上
 *
 * 实测 `DisclosureRow.module.css`（内核源码）：
 *
 * ```css
 * .row { color: var(--dsw-alias-label-tertiary); }
 * .row:hover { color: var(--dsw-alias-label-secondary); }
 * .title { color: inherit; }
 * ```
 *
 * 也就是说：**颜色被 `.row` 自己声明了**，而 `.row` 是 `[data-tool]` 根元素的
 * **孙节点**（root > header > row）。只给根元素写 `color` 完全没用 —— 会被
 * `.row` 自己的声明覆盖。而且 `.row:hover` 还会再覆盖一次。
 *
 * 所以样式必须命中 `.row` 那个层级。它的类名是哈希的，但它带**稳定属性**
 * `[data-disclosure-row]`（primitives 源码里的 `"data-disclosure-row": true`）。
 * 本插件依赖的 primitives 契约只有两条：`[data-disclosure-header]` 与
 * `[data-disclosure-row]`，都是显式写在 JSX 上的语义标记，不是样式细节。
 *
 * ## 关键设计三：只染表头，不染正文
 *
 * 实测：`data-tool` 挂在工具行的**根元素**上，而展开后的命令输出正文也在
 * 根元素内部。如果让颜色沿继承链落到正文，展开的终端输出、diff、文件内容
 * 会一起变色 —— 严重伤害可读性。
 *
 * 做法：颜色只写给表头内的 `.row`（正文在表头之外），所以正文天然不受影响。
 * 没有折叠表头的行（轨迹视图）本身就是单行，直接染它自己。
 *
 * ## 关键设计四：左侧竖条用 box-shadow inset，不用 border / ::before
 *
 * - `border-left` 会改变盒子宽度 → 紧凑工具行里文字抖动；
 * - `::before` 需要 `position: relative`，而根元素是 flex 容器，
 *   改定位上下文可能影响宿主自己的绝对定位子元素；
 * - `box-shadow: inset` 不占布局、画在背景之上、且这几个元素在宿主 CSS 里
 *   都没有声明 box-shadow（已核对 DisclosureRow.module.css 与 ToolRow 样式）。
 *
 * @module dsh-colorful-commands/css
 */

/** 属性名：运行时打在元素上的类别标记。 */
export const CAT_ATTR = 'data-cc-cat';

/** 属性名：标记"本元素已被本插件处理过"，避免重复扫描。 */
export const MARK_ATTR = 'data-cc-mark';

/** 属性名：染色作用点 —— `header`（染折叠表头）或 `self`（染元素自身）。 */
export const SCOPE_ATTR = 'data-cc-scope';

/** 深浅色分支选择器：与 ui-theme 实际写入 body 的属性一致（内核实测）。 */
const DARK = 'body[data-ds-dark-theme]';

/** primitives 契约：折叠行的表头与行本体。 */
const HEADER_SEL = '[data-disclosure-header]';
const ROW_SEL = '[data-disclosure-row]';

/**
 * 把候选值收敛成合法十六进制颜色。
 *
 * 这是**安全边界**：颜色值来自设置存储，可能被手工编辑成
 * `red; } body { display:none` 这类注入串。用白名单正则而不是转义，
 * 因为颜色只有这一种合法形状。
 *
 * @param value 候选颜色值。
 * @returns 6 位大写十六进制颜色，或 null。
 */
export function sanitizeColor(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return null;
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase();
  }
  return trimmed.toUpperCase();
}

/**
 * 把 6 位十六进制颜色转成 `rgba(...)`。
 *
 * @param hex 合法色值。
 * @param alpha 0–1。
 * @returns `rgba(r, g, b, a)`；色值非法时返回 `transparent`。
 */
export function withAlpha(hex, alpha) {
  const clean = sanitizeColor(hex);
  if (clean === null) return 'transparent';
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  const a = Math.min(1, Math.max(0, Number(alpha)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * 生成单个类别在一个主题下的规则。
 *
 * ## 为什么默认只染图标
 *
 * 第一版把整行文字都染了，实测**非常难看**：一段思考摘要整段变紫、层级全丢，
 * 满屏饱和色反而看不出重点。所以默认策略改为：
 *
 * - **图标**：给类别色（它是这一行的"类别标记"，最该有色）；
 * - **竖条**：2px 细条，作为扫读时的锚点；
 * - **文字**：保持宿主原生配色 —— 可读性优先。
 *
 * 想要更强的效果可以在设置里开 `colorText`（把文字也染色）。
 *
 * ## 四种作用域
 *
 * | scope | 用于 | 效果 |
 * |---|---|---|
 * | `header` | 工具行、推理行 | 表头图标上色 + 表头细竖条（正文在表头外，天然不受影响） |
 * | `self` | 轨迹视图行 | 图标上色 + 细竖条 |
 * | `tint` | UI 控件（权限/模型选择等） | **只给图标上色**，不动文字、不加竖条 |
 *
 * ⚠️ 曾经的 `stripe` 作用域（用户/助手消息块）已**删除**：实测
 * `data-chat-flow-kind="user"` 挂在**整列宽**的 flowItem 上，而气泡在内部靠右，
 * 于是竖条被画到窗口最左缘、与内容完全脱节 —— 非常难看。这两个类别本身也不在
 * 需求里（需求是思考/工具/命令/文件这类），已整体移除。
 *
 * @param category 类别 id。
 * @param color 该主题下的颜色。
 * @param prefix 选择器前缀（深色主题传 `body[data-ds-dark-theme] `，浅色传空串）。
 *   必须**逐行**加上，不能给整段拼好的字符串加一次 —— 那样只有第一行带前缀，
 *   其余规则会变成无条件生效，深色配色就会在浅色主题下泄漏。
 * @param options.colorText 是否连文字一起染色（默认否）。
 * @returns CSS 文本。
 */
function categoryBranch(category, color, prefix = '', options = {}) {
  const sel = `[${CAT_ATTR}="${category}"]`;
  const p = prefix;
  const wantText = options.colorText === true;

  // 折叠表头：图标是 svg（宿主用 stroke:currentColor），给它 color 即上色。
  const header = `${p}${sel}[${SCOPE_ATTR}="header"] ${HEADER_SEL}`;
  const self = `${p}${sel}[${SCOPE_ATTR}="self"]`;
  const tint = `${p}${sel}[${SCOPE_ATTR}="tint"]`;

  // 竖条：3px、高不透明度。早先版本用 2px/55%，实测在真机上几乎看不见
  // （等于没做），所以这里加强到「一眼能看到、又不抢内容」的程度。
  const stripe = `inset 3px 0 0 ${withAlpha(color, 0.9)}`;

  /**
   * 标题选择器。
   *
   * DSH 用 CSS Module，类名形如 `<构建哈希>_<原类名>`（实测 `Ph6Lgq_title`、
   * `ZmL7Ga_title`）。**后缀是稳定的源码类名，只有前缀哈希每次构建会变**，
   * 所以 `[class*="_title"]` 能跨版本命中，比写四层结构选择器可靠得多。
   *
   * 限定在 `[data-disclosure-header]` 内，避免误伤详情面板里的 `_titleLabel`
   * 之类的同名后缀元素。
   */
  const titleSel = `${header} [class*="_title"]`;

  const rules = [
    // ① 图标上色 —— 最稳、最该有色的部分。
    `${header} svg{color:${color}}`,
    // ② 短标签上色（"思考" / "执行了命令" / "已读取文件"）。
    //    只染标题，**不染摘要与正文** —— 第一版把整段摘要一起染了，满屏紫、
    //    层级全丢，实测非常难看。
    `${titleSel}{color:${color}}`,
    // ③ 可见的竖条，画在表头容器上（正文在表头之外，不会跟着变）。
    `${header}{box-shadow:${stripe}}`,

    // 轨迹行：图标 + 标题 + 竖条。
    `${self} svg{color:${color}}`,
    `${self} [class*="_title"]{color:${color}}`,
    `${self}{box-shadow:${stripe}}`,

    // 控件：只染图标。**不染文字** —— 第一版染了文字，结果斜杠命令菜单的
    // 菜单项被涂成灰色（菜单挂在 body 上，但触发按钮在插槽里），非常难看。
    `${tint} svg{color:${color}}`,
  ];

  // 可选：连正文/摘要一起染色（默认关，供"我要更花"的场景开启）。
  if (wantText) {
    const headerRow = `${header} ${ROW_SEL}`;
    rules.push(
      `${headerRow}{color:${color}}`,
      // 覆盖宿主 .row:hover 的 color（同特异度，靠源码顺序在后取胜）。
      `${headerRow}:hover{color:${color}}`,
      `${self}{color:${color}}`,
      `${tint} :is(button,[role="button"],a){color:${color}}`,
    );
  }

  return rules.join('\n');
}

/**
 * 生成一个类别的完整规则（浅色 + 深色）。
 *
 * @param category 类别 id。
 * @param light 浅色主题色值。
 * @param dark 深色主题色值。
 * @param options.colorText 是否连文字一起染色。
 * @returns CSS 文本（两个色值都非法时为空串）。
 */
function categoryRules(category, light, dark, options = {}) {
  const l = sanitizeColor(light);
  const d = sanitizeColor(dark);
  if (l === null && d === null) return '';

  const parts = [];
  if (l !== null) parts.push(categoryBranch(category, l, '', options));
  // 深色前缀逐行加在 categoryBranch 内部（见其 prefix 参数说明）。
  if (d !== null) parts.push(categoryBranch(category, d, `${DARK} `, options));
  return parts.join('\n');
}

/**
 * 由「类别 → { light, dark }」映射生成完整样式表。
 *
 * @param colors 颜色映射；缺类别即不上色。
 * @param options.enabled 总开关；为 false 时返回空串。
 * @param options.colorText 是否连文字一起染色（默认否，只染图标与竖条）。
 * @returns CSS 文本。
 */
export function buildStylesheet(colors, options = {}) {
  if (options.enabled === false) return '';
  const map = colors ?? {};
  const chunks = [];
  for (const [category, value] of Object.entries(map)) {
    if (value === null || typeof value !== 'object') continue;
    const rule = categoryRules(category, value.light, value.dark, { colorText: options.colorText });
    if (rule !== '') chunks.push(rule);
  }
  if (chunks.length === 0) return '';
  return `/* dsh-colorful-commands */\n${chunks.join('\n')}\n`;
}

/**
 * 把设置里的原始值收敛成可渲染的颜色映射。
 *
 * 设置存储是**不可信输入**：可能被手工编辑、可能是旧版本写的、可能含非法
 * 色值。这里逐项校验，非法项直接丢弃（该类别不上色），绝不产出坏 CSS。
 *
 * @param config 设置快照，形如 `{ enabled, colors: { cat: {light, dark} } }`。
 * @param options.presetColors 预设色板（作为底）。
 * @returns `{ enabled: boolean, colors: Record<string, {light,dark}> }`。
 */
export function resolveColors(config, options = {}) {
  const cfg = config ?? {};
  if (cfg.enabled === false) return { enabled: false, colors: {} };

  const preset = options.presetColors ?? {};
  const custom = cfg.colors;

  /** @type {Record<string, {light: string, dark: string}>} */
  const colors = {};

  // 先铺预设（作为底），再用用户自定义项逐类别覆盖。
  for (const source of [preset, custom]) {
    if (source === null || typeof source !== 'object') continue;
    for (const [category, value] of Object.entries(source)) {
      const light = sanitizeColor(value?.light);
      const dark = sanitizeColor(value?.dark);
      if (light === null && dark === null) continue;
      // 单边缺失时用另一边补齐：保证两条主题分支都成立，不会有一边失明。
      colors[category] = {
        light: light ?? dark,
        dark: dark ?? light,
      };
    }
  }

  return { enabled: true, colors };
}
/**
 * 把生产样式限制在预览容器内。
 *
 * 生产 CSS 的选择器有两种形状：
 * 1. `[data-cc-cat=…]…` —— 直接加 `.cc-preview ` 前缀；
 * 2. `body[data-ds-dark-theme] [data-cc-cat=…]…` —— 深色分支。
 *
 * ⚠️ 第 2 种不能无脑加前缀：`body` 是 `.cc-preview` 的**祖先**，写成
 * `.cc-preview body[data-ds-dark-theme]` 永远匹配不到（"body 在 .cc-preview 里"
 * 不成立），结果是**深色主题下预览永远显示浅色值** —— 静默失效。
 * 正确做法是把 `.cc-preview` 插到主题条件**之后**。
 *
 * @param cssText 生产样式文本。
 * @returns 作用域化后的 CSS。
 */
export function scopedPreviewCss(cssText) {
  if (typeof cssText !== 'string' || cssText === '') return '';
  const DARK_PREFIX = 'body[data-ds-dark-theme]';
  return cssText
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('/*')) return '';
      const open = trimmed.indexOf('{');
      if (open === -1) return '';
      const selector = trimmed.slice(0, open).trim();
      const rest = trimmed.slice(open);
      const scoped = selector
        .split(',')
        .map((part) => {
          const piece = part.trim();
          if (piece === '') return '';
          if (piece.startsWith(DARK_PREFIX)) {
            // 主题条件保持在最外层，容器插在它后面。
            return `${DARK_PREFIX} .cc-preview${piece.slice(DARK_PREFIX.length)}`;
          }
          return `.cc-preview ${piece}`;
        })
        .filter((piece) => piece !== '')
        .join(',');
      if (scoped === '') return '';
      return `${scoped}${rest}`;
    })
    .filter((line) => line !== '')
    .join('\n');
}
