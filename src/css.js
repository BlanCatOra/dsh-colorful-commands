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

/**
 * 属性名：把过程组标题**切分**后，标记"这一段是标签"。
 *
 * 见 `dom.js` 的 `splitTitleLabel`：内核把「标签 + `' · '` + 详情」拼成同一个
 * 文本节点，CSS 无法只染标签。运行时把标签切出来单独包一层带本属性的 `span`，
 * 样式层就能只染标签、不染详情。
 */
export const PART_ATTR = 'data-cc-part';

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
 * 生成单个类别在一个主题下的规则。
 *
 * ## 为什么默认只染图标
 *
 * 第一版把整行文字都染了，实测**非常难看**：一段思考摘要整段变紫、层级全丢，
 * 满屏饱和色反而看不出重点。所以策略是「能只染图标就只染图标」：
 *
 * - **图标**：给类别色（它是这一行的"类别标记"，最该有色）；
 * - **短标签**：只有**确定是短标签**时才染（见下）；
 * - **正文/摘要**：一律不染 —— 可读性优先。
 *
 * ## 只用颜色，不画竖线（用户 2026-10-16 明确要求）
 *
 * 早期版本给每个表头画了一条左侧竖条。**已全部移除** —— 用户要求"只改颜色，
 * 不要彩色竖线"。
 *
 * ## 六种作用域
 *
 * | scope | 用于 | 效果 |
 * |---|---|---|
 * | `header` | 工具行、推理行（DisclosureRow） | 表头图标 + 短标签 |
 * | `title` | 过程组标题 | 该按钮的图标 + **标签文字**（详情不受影响） |
 * | `self` | bash 工具行、轨迹视图行 | 图标 + 短标签 |
 * | `tint` | UI 控件（权限/计划） | 图标**与文字**上色 |
 *
 * ⚠️ 过程组标题的「标签」与「详情」在内核里是**同一个文本节点**
 * （`ProcessGroupHeader` 的 `title`）。运行时会先把标签切出来包一层
 * `[data-cc-part="label"]`（见 `dom.js` 的 `splitTitleLabel`），样式只染那一段 ——
 * 于是「标签有色、详情保持原生」两个诉求同时成立。
 *
 * 历史：曾用 `icon` 作用域整段不染来回避"分析正文被上色"，但那样连标签都没颜色，
 * 用户反馈"上色不完全"。现在靠切分解决，`icon` 作用域已删除。
 *
 * ⚠️ `tint` 染文字：第一版**曾因染文字出事** —— 当时把 `left`/`right`/`overlay`
 * 这些槽也当成控件（它们装的是加号按钮、斜杠命令触发器等原生控件），结果弹出的
 * 斜杠菜单项被涂灰。现在控件类只剩 `permission` / `plan` 两个**语义明确**的槽，
 * 且用户明确要求"权限选择的那个控件可以把文字颜色也改了"。
 *
 * ⚠️ 已删除的 `stripe` 作用域：`data-chat-flow-kind` 挂在**整列宽**的 flowItem
 * 上，气泡在内部靠右，颜色会被画到窗口最左缘、与内容完全脱节。
 *
 * @param category 类别 id。
 * @param color 该主题下的颜色。
 * @param prefix 选择器前缀（深色主题传 `body[data-ds-dark-theme] `，浅色传空串）。
 *   必须**逐行**加上，不能给整段拼好的字符串加一次 —— 那样只有第一行带前缀，
 *   其余规则会变成无条件生效，深色配色就会在浅色主题下泄漏。
 * @returns CSS 文本。
 */
function categoryBranch(category, color, prefix = '') {
  const sel = `[${CAT_ATTR}="${category}"]`;
  const p = prefix;

  // 折叠表头：图标是 svg（宿主用 stroke:currentColor），给它 color 即上色。
  const header = `${p}${sel}[${SCOPE_ATTR}="header"] ${HEADER_SEL}`;
  // 过程组标题（"执行了命令"）是一个独立 button，没有折叠表头结构。
  const titleScope = `${p}${sel}[${SCOPE_ATTR}="title"]`;
  const self = `${p}${sel}[${SCOPE_ATTR}="self"]`;
  const tint = `${p}${sel}[${SCOPE_ATTR}="tint"]`;

  /**
   * 标题选择器。
   *
   * DSH 用 CSS Module，类名形如 `<构建哈希>_<原类名>`（实测 `Ph6Lgq_title`、
   * `ZmL7Ga_title`）。**后缀是稳定的源码类名，只有前缀哈希每次构建会变**，
   * 所以 `[class*="_title"]` 能跨版本命中，比写四层结构选择器可靠得多。
   *
   * ⚠️ 只匹配 `_title`，**绝不匹配 `_summary`** —— 摘要里是模型输出的正文，
   * 染它会满屏变色（用户反馈过"上色部分太多"）。
   */
  const titleSel = `${header} [class*="_title"]`;

  return [
    // ① 工具行/推理行表头：图标 + 短标签。摘要与正文保持原生。
    `${header} svg{color:${color}}`,
    `${titleSel}{color:${color}}`,

    // ② 过程组标题（"执行了命令 / 已完成分析 / 已读取文件"）。
    //    这是用户反馈"运行命令、执行命令、完成分析等条目颜色没有改变"的那批
    //    —— 它们带 `data-process-activity` 而**不带 `data-tool`**，第一版没覆盖。
    `${titleScope} svg{color:${color}}`,
    //    文字：只染运行时切出来的**标签**那一段（见 dom.js 的 splitTitleLabel）。
    //    内核把「标签 · 详情」放在同一个文本节点里，直接染 `_label` 会连分析正文
    //    一起染（用户反馈过"上色部分太多"）；只染 `[data-cc-part="label"]` 则
    //    标签有色、详情保持原生。
    `${titleScope} [${PART_ATTR}="label"]{color:${color}}`,
    //    兜底：标题**没有**详情时（历史/已折叠的组标题就是纯标签）整段都可以染。
    `${titleScope} [class*="_label"]:not(:has([${PART_ATTR}])){color:${color}}`,

    // ③ bash 工具行 / 轨迹行：图标 + 短标签。
    //    bash 行的根元素只有 `data-sample` + `data-variant="bash"`，
    //    没有 `[data-disclosure-header]`，所以走这条。
    `${self} svg{color:${color}}`,
    `${self} [class*="_title"]{color:${color}}`,

    // ④ UI 控件：图标**与文字**一起染。
    //    ⚠️ 必须命中真正的 button：[data-slot] 包裹层是 `display:contents`
    //    （renderer 的 ANCHOR_STYLE），且 Button 自己声明了
    //    `color: var(--dsw-alias-label-primary)` —— 只给包裹层写 color 不生效。
    //    特异度 (0,3,0) 高于 Button 的 (0,1,0)，所以能覆盖。
    `${tint} svg{color:${color}}`,
    `${tint} :is(button,[role="button"],a){color:${color}}`,
  ].join('\n');
}

/**
 * 生成一个类别的完整规则（浅色 + 深色）。
 *
 * @param category 类别 id。
 * @param light 浅色主题色值。
 * @param dark 深色主题色值。
 * @returns CSS 文本（两个色值都非法时为空串）。
 */
function categoryRules(category, light, dark) {
  const l = sanitizeColor(light);
  const d = sanitizeColor(dark);
  if (l === null && d === null) return '';

  const parts = [];
  if (l !== null) parts.push(categoryBranch(category, l, ''));
  // 深色前缀逐行加在 categoryBranch 内部（见其 prefix 参数说明）。
  if (d !== null) parts.push(categoryBranch(category, d, `${DARK} `));
  return parts.join('\n');
}

/**
 * 由「类别 → { light, dark }」映射生成完整样式表。
 *
 * @param colors 颜色映射；缺类别即不上色。
 * @param options.enabled 总开关；为 false 时返回空串。
 * @returns CSS 文本。
 */
export function buildStylesheet(colors, options = {}) {
  if (options.enabled === false) return '';
  const map = colors ?? {};
  const chunks = [];
  for (const [category, value] of Object.entries(map)) {
    if (value === null || typeof value !== 'object') continue;
    const rule = categoryRules(category, value.light, value.dark);
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
