/**
 * dsh-colorful-commands —— 浏览器侧 bundle。
 *
 * 本文件由 src/build-client.mjs 从 src/ 生成，请勿手改。
 * 改 src/ 后重新运行：node src/build-client.mjs
 */

window.__ModuleLoader__.load({
	id: "dsh-colorful-commands",
	factory: (require) => {
		var __dshRegistry = new Map();
		var __dshCache = new Map();
		/** 宿主基座模块（react 等）由外壳的冻结模块表提供。 */
		function __dshExternal(name) { return require(name); }
		/** 按模块键懒加载；每个模块只执行一次。 */
		function __dshRequire(key) {
			key = key.replace(/^\.\//, "");
			if (__dshCache.has(key)) return __dshCache.get(key);
			var factory = __dshRegistry.get(key);
			if (factory === undefined) throw new Error("dsh-colorful-commands: unknown module " + key);
			var exports = {};
			__dshCache.set(key, exports);
			factory(exports);
			return exports;
		}
		__dshRegistry.set("constants.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— 共享常量。
			 *
			 * 这里的取值同时被 Host 侧（设置 schema）与浏览器侧（bundle）消费，
			 * 是两侧唯一的真源。改这里必须同时重建 bundle。
			 *
			 * @module dsh-colorful-commands/constants
			 */

			/** 包名。必须与 package.json 的 name 完全一致（bundle 注册键）。 */
			const PLUGIN_ID = 'dsh-colorful-commands';

			/**
			 * 设置命名空间。
			 *
			 * ⚠️ 实测契约：DSH 的 settings 服务按 **loader entry id** 建命名空间
			 * （`ns: entry.options.id`），而 entry id 来自 cordis.patch.yml 里那条
			 * `insert.id`。本插件的 patch 用的就是包名，所以这里等于包名。
			 * 改 cordis.patch.yml 的 id 就必须同步改这里，否则设置页永远读到默认值。
			 */
			const SETTINGS_NAMESPACE = 'dsh-colorful-commands';

			/** locale 命名空间（文案字典）。 */
			const LOCALE_NS = 'settings.colorful-commands';

			/** 设置卡片在「插件详情页」里的注册 id（必须自有，复用别人的会顶掉对方）。 */
			const CARD_ID = 'colorful-commands';

			/** 注入样式标签的标识，卸载/HMR 时据此移除。 */
			const STYLE_TAG_ID = 'dsh-colorful-commands';

			/** 内置预设 id。 */
			const PRESET_NONE = 'none';
			const PRESET_CHINESE = 'chinese';
			const PRESET_JAPANESE = 'japanese';
			const PRESET_MACARON = 'macaron';
			const PRESET_CUSTOM = 'custom';

			/** 预设显示顺序。 */
			const PRESETS = [PRESET_NONE, PRESET_CHINESE, PRESET_JAPANESE, PRESET_MACARON, PRESET_CUSTOM];

			/**
			 * 着色类别。
			 *
			 * 每个类别对应一组稳定的 DOM 选择器（见 targets.js），互不重叠，
			 * 因此用户给"思考"和"执行命令"选不同颜色时不会互相覆盖。
			 */
			const CATEGORIES = [
			  'thinking',
			  'command',
			  'danger',
			  'read',
			  'write',
			  'search',
			  'web',
			  'other',
			  'user',
			  'assistant',
			];

			/**
			 * UI 控件类别。
			 *
			 * 与消息类别分开列，是因为两者的选择器机制不同：
			 * - 消息类别靠 `[data-tool]` / `[data-variant]` / `[data-kind]` 命中**内容行**；
			 * - 控件类别靠 `[data-slot="<槽名>"]` 命中**插槽锚点**（`ui-renderer` 的
			 *   `renderSlot` 稳定契约），因此"权限选择、模型选择"这类控件也能各自上色。
			 *
			 * 用户在同一张设置卡片里配置这两组，只是分组展示。
			 */
			const CONTROL_CATEGORIES = [
			  'ctl-permission',
			  'ctl-model',
			  'ctl-plan',
			  'ctl-activity',
			  'ctl-toolbar',
			];

			/** 全部可配置类别（消息 + 控件）。设置卡片按这个顺序渲染。 */
			const ALL_CATEGORIES = [...CATEGORIES, ...CONTROL_CATEGORIES];

			/** 类别的中文名（内置兜底；界面文案走 locale 字典）。 */
			const CATEGORY_LABELS = {
			  thinking: '思考 / 推理',
			  command: '执行命令',
			  danger: '危险命令',
			  read: '读取文件',
			  write: '写入 / 编辑',
			  search: '搜索',
			  web: '网络请求',
			  other: '其他工具',
			  user: '用户消息',
			  assistant: '助手回复',
			  'ctl-permission': '权限选择',
			  'ctl-model': '模型选择',
			  'ctl-plan': '计划模式',
			  'ctl-activity': '活动栏',
			  'ctl-toolbar': '工具行控件',
			};

			/**
			 * 危险命令的判定词表。
			 *
			 * 只做**前缀/包含**匹配，且仅用于给 `command` 类里更危险的那部分换色 ——
			 * 判错只是颜色不对，不会有任何执行后果（本插件不执行、不拦截任何命令）。
			 */
			const DANGER_PATTERNS = [
			  'rm ',
			  'rm -',
			  'sudo ',
			  'mkfs',
			  'dd if=',
			  'dd of=',
			  'shutdown',
			  'reboot',
			  'kill -9',
			  'pkill',
			  'chmod 777',
			  'chown -R',
			  ':(){',
			  '> /dev/sd',
			  'truncate ',
			  'wipefs',
			  'fdisk',
			  'parted ',
			  'git push --force',
			  'git reset --hard',
			  'npm publish',
			  'DROP TABLE',
			  'DROP DATABASE',
			  'TRUNCATE TABLE',
			];

			/** 默认不透明度：只给左边框与文字着色，保持背景可读。 */
			const DEFAULT_OPACITY = 100;

			/** 合法十六进制颜色（#RGB / #RRGGBB）。 */
			const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

			Object.assign(__exports, { "PLUGIN_ID": PLUGIN_ID, "SETTINGS_NAMESPACE": SETTINGS_NAMESPACE, "LOCALE_NS": LOCALE_NS, "CARD_ID": CARD_ID, "STYLE_TAG_ID": STYLE_TAG_ID, "PRESET_NONE": PRESET_NONE, "PRESET_CHINESE": PRESET_CHINESE, "PRESET_JAPANESE": PRESET_JAPANESE, "PRESET_MACARON": PRESET_MACARON, "PRESET_CUSTOM": PRESET_CUSTOM, "PRESETS": PRESETS, "CATEGORIES": CATEGORIES, "CONTROL_CATEGORIES": CONTROL_CATEGORIES, "ALL_CATEGORIES": ALL_CATEGORIES, "CATEGORY_LABELS": CATEGORY_LABELS, "DANGER_PATTERNS": DANGER_PATTERNS, "DEFAULT_OPACITY": DEFAULT_OPACITY, "HEX_RE": HEX_RE });
		});
		__dshRegistry.set("locale.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— 文案字典。
			 *
			 * 全部界面文案走 `ctx.locale`，不硬编码中文（UI 规范 §1.1）。
			 * 每个键都必须同时提供 zh 与 en，缺一边会在类型检查处暴露。
			 *
			 * @module dsh-colorful-commands/locale
			 */
			const { LOCALE_NS } = __dshRequire("./constants.js");

			/** 简体中文（键集真源）。 */
			const zh = {
			  cardTitle: '多彩命令',
			  cardDescription: '按类别给思考、命令、文件读写等行着色，可自选预设或逐个自定义颜色。',

			  masterLabel: '启用着色',
			  masterHint: '关闭后立即恢复 DSH 原生配色，设置会保留。',

			  presetLabel: '配色预设',
			  presetHint: '预设提供一套完整配色；下面仍可逐个类别覆盖。',

			  categoriesTitle: '分类配色',
			  categoriesHint: '每个类别可分别设置浅色与深色两套底下的颜色。',

			  columnLight: '浅色主题',
			  columnDark: '深色主题',
			  columnCategory: '类别',

			  pickColor: '选择颜色',
			  hexLabel: '色号',
			  hexInvalid: '请输入 #RGB 或 #RRGGBB 形式的色号',
			  resetOne: '恢复预设值',
			  resetAll: '全部恢复预设值',

			  previewTitle: '预览',
			  previewHint: '下面用当前配色实际渲染一次，改色即时可见。',

			  save: '保存',
			  discard: '放弃修改',
			  saved: '已保存',
			  saveFailed: '保存失败，请重试',
			  unsaved: '有未保存的修改',

			  unavailable: '该设置命名空间尚未就绪。',
			  memoryNotice: '当前部署未持久化设置，改动仅在本次运行内有效。',
			  readOnlyNotice: '当前部署不允许写入设置。',

			  categoryThinking: '思考 / 推理',
			  categoryCommand: '执行命令',
			  categoryDanger: '危险命令',
			  categoryRead: '读取文件',
			  categoryWrite: '写入 / 编辑',
			  categorySearch: '搜索',
			  categoryWeb: '网络请求',
			  categoryOther: '其他工具',
			  categoryUser: '用户消息',
			  categoryAssistant: '助手回复',

			  controlsTitle: '界面控件',
			  controlsHint: '这些是输入框附近的控件（权限选择、模型选择等），可单独着色。',
			  categoryCtlPermission: '权限选择',
			  categoryCtlModel: '模型选择',
			  categoryCtlPlan: '计划模式',
			  categoryCtlActivity: '活动栏',
			  categoryCtlToolbar: '工具行控件',

			  presetNone: '不预设（仅自定义）',
			  presetChinese: '中国传统色',
			  presetJapanese: '日本传统色',
			  presetMacaron: '马卡龙色系',
			  presetCustom: '自定义',
			};

			/** English. */
			const en = {
			  cardTitle: 'Colorful Commands',
			  cardDescription: 'Color rows by category — thinking, commands, file reads and writes — with presets or per-category colors.',

			  masterLabel: 'Enable coloring',
			  masterHint: 'Turning this off restores the native DSH palette immediately; your settings are kept.',

			  presetLabel: 'Preset',
			  presetHint: 'A preset provides a full palette; you can still override individual categories below.',

			  categoriesTitle: 'Category colors',
			  categoriesHint: 'Each category has a separate color for light and dark backgrounds.',

			  columnLight: 'Light theme',
			  columnDark: 'Dark theme',
			  columnCategory: 'Category',

			  pickColor: 'Pick a color',
			  hexLabel: 'Hex',
			  hexInvalid: 'Enter a hex color as #RGB or #RRGGBB',
			  resetOne: 'Reset to preset',
			  resetAll: 'Reset all to preset',

			  previewTitle: 'Preview',
			  previewHint: 'Rendered with the current palette, so edits are visible immediately.',

			  save: 'Save',
			  discard: 'Discard',
			  saved: 'Saved',
			  saveFailed: 'Save failed, please retry',
			  unsaved: 'Unsaved changes',

			  unavailable: 'This settings namespace is not available yet.',
			  memoryNotice: 'This deployment does not persist settings; changes last for this run only.',
			  readOnlyNotice: 'This deployment does not allow writing settings.',

			  categoryThinking: 'Thinking / reasoning',
			  categoryCommand: 'Commands',
			  categoryDanger: 'Dangerous commands',
			  categoryRead: 'File reads',
			  categoryWrite: 'Writes / edits',
			  categorySearch: 'Search',
			  categoryWeb: 'Web requests',
			  categoryOther: 'Other tools',
			  categoryUser: 'User messages',
			  categoryAssistant: 'Assistant replies',

			  controlsTitle: 'Interface controls',
			  controlsHint: 'Controls near the composer (permission, model selection) can be colored separately.',
			  categoryCtlPermission: 'Permission select',
			  categoryCtlModel: 'Model select',
			  categoryCtlPlan: 'Plan mode',
			  categoryCtlActivity: 'Activity bar',
			  categoryCtlToolbar: 'Composer toolbar',

			  presetNone: 'None (custom only)',
			  presetChinese: 'Chinese traditional',
			  presetJapanese: 'Japanese traditional',
			  presetMacaron: 'Macaron',
			  presetCustom: 'Custom',
			};

			/** 每个类别 id → 文案键。 */
			const CATEGORY_KEYS = {
			  thinking: 'categoryThinking',
			  command: 'categoryCommand',
			  danger: 'categoryDanger',
			  read: 'categoryRead',
			  write: 'categoryWrite',
			  search: 'categorySearch',
			  web: 'categoryWeb',
			  other: 'categoryOther',
			  user: 'categoryUser',
			  assistant: 'categoryAssistant',
			  'ctl-permission': 'categoryCtlPermission',
			  'ctl-model': 'categoryCtlModel',
			  'ctl-plan': 'categoryCtlPlan',
			  'ctl-activity': 'categoryCtlActivity',
			  'ctl-toolbar': 'categoryCtlToolbar',
			};

			/** 预设 id → 文案键。 */
			const PRESET_KEYS = {
			  none: 'presetNone',
			  chinese: 'presetChinese',
			  japanese: 'presetJapanese',
			  macaron: 'presetMacaron',
			  custom: 'presetCustom',
			};

			/** 注册到 ctx.locale 的字典集合。 */
			const dictionaries = { zh, en };



			Object.assign(__exports, { "CATEGORY_KEYS": CATEGORY_KEYS, "PRESET_KEYS": PRESET_KEYS, "dictionaries": dictionaries, "LOCALE_NS": LOCALE_NS });
		});
		__dshRegistry.set("css.js", (__exports) => {
			var module = { exports: __exports };
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
			const CAT_ATTR = 'data-cc-cat';

			/** 属性名：标记"本元素已被本插件处理过"，避免重复扫描。 */
			const MARK_ATTR = 'data-cc-mark';

			/** 属性名：染色作用点 —— `header`（染折叠表头）或 `self`（染元素自身）。 */
			const SCOPE_ATTR = 'data-cc-scope';

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
			function sanitizeColor(value) {
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
			function withAlpha(hex, alpha) {
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
			 * 四种作用域，因为不同行的"颜色持有者"在不同层级，且有的行不该被改字色：
			 *
			 * | scope | 用于 | 效果 |
			 * |---|---|---|
			 * | `header` | 工具行、推理行 | 染折叠表头（正文在表头外，天然不受影响）+ 表头竖条 |
			 * | `self` | 轨迹视图行 | 单行，字色 + 竖条一起 |
			 * | `tint` | UI 控件（权限/模型选择等） | 只染字色与图标，**不加竖条**（胶囊按钮加竖条很怪） |
			 * | `stripe` | 用户/助手消息块 | **只加竖条，不改字色** —— 整段正文被染色会伤害可读性 |
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
			  const stripe = `inset 2px 0 0 ${withAlpha(color, 0.8)}`;
			  const p = prefix;

			  // 折叠表头：颜色写给真正的 color 持有者 [data-disclosure-row]。
			  const headerRow = `${p}${sel}[${SCOPE_ATTR}="header"] ${HEADER_SEL} ${ROW_SEL}`;
			  const headerBox = `${p}${sel}[${SCOPE_ATTR}="header"] ${HEADER_SEL}`;

			  return [
			    `${headerRow}{color:${color}}`,
			    // 覆盖宿主 .row:hover 的 color（同特异度，靠源码顺序在后取胜；显式写更稳）。
			    `${headerRow}:hover{color:${color}}`,
			    `${headerBox}{box-shadow:${stripe}}`,

			    // 单行元素：字色 + 竖条。
			    `${p}${sel}[${SCOPE_ATTR}="self"]{color:${color};box-shadow:${stripe}}`,

			    // 控件：只染字色与图标，不加竖条。
			    // ⚠️ 必须命中真正的 button，不能只写锚点自身：`[data-slot]` 包裹层是
			    // `display:contents`（renderer 的 ANCHOR_STYLE），且 Button 自己声明了
			    // `color: var(--dsw-alias-label-primary)` —— 只给包裹层写 color 不会生效。
			    // 特异度 (0,2,1) 高于 Button 的 (0,1,0)，所以能覆盖。
			    `${p}${sel}[${SCOPE_ATTR}="tint"] :is(button,[role="button"],a){color:${color}}`,

			    // 消息块：只加竖条，不动字色。
			    `${p}${sel}[${SCOPE_ATTR}="stripe"]{box-shadow:${stripe}}`,
			    // ⚠️ 必须用换行分隔：预览作用域（scopedPreviewCss）是**按行**给选择器加前缀的，
			    // 拼成一整行会让每行只有第一条规则被作用域化，其余规则泄漏到全局 —— 那会
			    // 让"预览"影响真实界面。这里保持一行一条规则。
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
			function buildStylesheet(colors, options = {}) {
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
			function resolveColors(config, options = {}) {
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
			function scopedPreviewCss(cssText) {
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

			Object.assign(__exports, { "CAT_ATTR": CAT_ATTR, "MARK_ATTR": MARK_ATTR, "SCOPE_ATTR": SCOPE_ATTR, "sanitizeColor": sanitizeColor, "withAlpha": withAlpha, "buildStylesheet": buildStylesheet, "resolveColors": resolveColors, "scopedPreviewCss": scopedPreviewCss });
		});
		__dshRegistry.set("palettes.js", (__exports) => {
			var module = { exports: __exports };
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
			const { CATEGORIES, CONTROL_CATEGORIES, PRESET_CHINESE, PRESET_JAPANESE, PRESET_MACARON } = __dshRequire("./constants.js");

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
			const BUILTIN_PRESETS = {
			  [PRESET_CHINESE]: CHINESE,
			  [PRESET_JAPANESE]: JAPANESE,
			  [PRESET_MACARON]: MACARON,
			};

			/** 预设的中文显示名。 */
			const PRESET_LABELS = {
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
			function presetColors(presetId) {
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
			function presetColorFor(presetId, category) {
			  const preset = BUILTIN_PRESETS[presetId];
			  if (preset === undefined) return undefined;
			  const value = preset[category];
			  return value === undefined ? undefined : { ...value };
			}

			/** 供测试断言：每个内置预设覆盖了哪些类别。 */
			function presetCoverage(presetId) {
			  const preset = BUILTIN_PRESETS[presetId] ?? {};
			  const all = [...CATEGORIES, ...CONTROL_CATEGORIES];
			  return {
			    covered: all.filter((c) => Object.hasOwn(preset, c)),
			    missing: all.filter((c) => !Object.hasOwn(preset, c)),
			  };
			}

			Object.assign(__exports, { "BUILTIN_PRESETS": BUILTIN_PRESETS, "PRESET_LABELS": PRESET_LABELS, "presetColors": presetColors, "presetColorFor": presetColorFor, "presetCoverage": presetCoverage });
		});
		__dshRegistry.set("boot-diagnostics.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— 启动自检与失败留痕。
			 *
			 * ## 为什么需要这一层
			 *
			 * DSH 的 web boot 把**每个客户端插件**的 cordis fiber 都当成必须 ACTIVE 的
			 * 条目；`apply` 里冒出来的任何异常都会把该 fiber 置为 FAILED，于是整页启动
			 * 直接抛 `web boot: N entry did not activate` 而**白屏**。
			 * 用户能看到的只有 `dsh-colorful-commands: failed` 这一行 —— 没有堆栈、
			 * 没有出错位置（cordis 把它交给了渲染进程 logger，而它不落盘）。
			 *
			 * 所以本模块做两件事：
			 *  1. 提供一个「绝不抛错」的步骤包装，让单个表面的接线失败不拖垮整页；
			 *  2. 把失败步骤、消息、堆栈写进 `localStorage` —— 渲染进程里**唯一**事后
			 *     能从磁盘读回来的地方（`~/.config/@deepseek-ai/dsh-desktop` 下的
			 *     Local Storage leveldb 是可读的纯文本），并 `console.error` 一份。
			 *
			 * 读取：`~/.dsh/bin/dsh-boot-report --key cc`（本插件注册的别名）。
			 *
			 * @module dsh-colorful-commands/boot-diagnostics
			 */
			const { PLUGIN_ID } = __dshRequire("./constants.js");

			/** 留痕键。`dsh-boot-report` 的 `--list-keys` 会列出它。 */
			const BOOT_REPORT_KEY = 'dsh.colorful-commands.boot';

			/**
			 * 取一个可用的 Web Storage；取不到返回 undefined。
			 *
			 * 把存储当**不可信输入**：无痕模式、被策略禁用、Node 里没有该全局、
			 * 访问 `length` 就抛 SecurityError —— 全部按「没有存储」处理。
			 *
			 * @param kind 全局名。
			 * @returns 可用的 storage，或 undefined。
			 */
			function safeStorage(kind) {
			  try {
			    const store = globalThis[kind];
			    if (store === undefined || store === null) return undefined;
			    // 读一次属性：被禁用时异常就抛在这里，而不是抛在后面的 setItem 里。
			    void store.length;
			    return store;
			  } catch {
			    return undefined;
			  }
			}

			/** 把附加上下文收敛成短字符串：优先 JSON，退化到 String，最后截断。 */
			function stringifyExtra(extra) {
			  if (extra === undefined) return undefined;
			  if (typeof extra === 'string') return extra.slice(0, 500);
			  try {
			    const json = JSON.stringify(extra);
			    if (typeof json === 'string') return json.slice(0, 500);
			  } catch {
			    // 循环引用之类：退到 String。
			  }
			  return String(extra).slice(0, 500);
			}

			/** 把一次失败收敛成可 JSON 化的记录（消息与堆栈都可能缺失或非字符串）。 */
			function describe(where, error, extra) {
			  const message = error instanceof Error ? error.message : String(error);
			  const stack = error instanceof Error && typeof error.stack === 'string' ? error.stack : '';
			  const detail = stringifyExtra(extra);
			  return {
			    where: String(where),
			    message,
			    // 截断：localStorage 有配额，且要的只是前几帧。
			    stack: stack.slice(0, 4000),
			    ...(detail === undefined ? {} : { extra: detail }),
			  };
			}

			/**
			 * 写一份启动报告。**任何一步失败都只吞掉，绝不外抛。**
			 *
			 * @param failures 本次启动累积的失败记录（空数组表示全部步骤成功）。
			 * @param context 额外环境信息（版本号之类），可选。
			 * @returns 写进去的报告对象（便于测试断言）。
			 */
			function writeBootReport(failures, context) {
			  const report = {
			    at: new Date().toISOString(),
			    plugin: PLUGIN_ID,
			    ok: failures.length === 0,
			    ...(context === undefined ? {} : { context: stringifyExtra(context) }),
			    failures: failures.map((item) => ({ ...item })),
			  };
			  try {
			    const store = safeStorage('localStorage');
			    if (store !== undefined) store.setItem(BOOT_REPORT_KEY, JSON.stringify(report));
			  } catch {
			    // 存储不可用/超配额：报告写不进去也不该影响插件运行。
			  }
			  return report;
			}

			/**
			 * 创建一个失败收集器。
			 *
			 * 用法：`const failures = createFailures(); guard(failures, 'where', fn)`。
			 * 调用方在 `apply` 末尾调 `writeBootReport(failures, ...)`。
			 *
			 * @returns 失败记录数组。
			 */
			function createFailures() {
			  return [];
			}

			/**
			 * 执行一个步骤，失败只记录、绝不外抛。
			 *
			 * @param failures `createFailures()` 的返回值。
			 * @param where 步骤标识（写进报告，便于定位）。
			 * @param run 实际动作。
			 * @param onError 可选的降级回调；它自己抛错也会被吞掉并记录。
			 * @returns `run` 的返回值；失败时为 undefined。
			 */
			function guard(failures, where, run, onError) {
			  try {
			    return run();
			  } catch (error) {
			    const record = describe(where, error);
			    failures.push(record);
			    try {
			      console.error(`[${PLUGIN_ID}] ${where} failed:`, error);
			    } catch {
			      // console 被劫持也不该让插件挂掉。
			    }
			    if (onError === undefined) return undefined;
			    try {
			      return onError(error);
			    } catch (nested) {
			      failures.push(describe(`${where}:fallback`, nested));
			      return undefined;
			    }
			  }
			}

			Object.assign(__exports, { "BOOT_REPORT_KEY": BOOT_REPORT_KEY, "writeBootReport": writeBootReport, "createFailures": createFailures, "guard": guard });
		});
		__dshRegistry.set("classify.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— 分类层（纯函数，无 DOM 依赖）。
			 *
			 * ## 为什么要有这一层
			 *
			 * 直觉做法是直接写 CSS 选择器去命中 DSH 内部结构，例如
			 * `.ToolRow_root[data-tool=bash] { color: … }`。**这是错的**，有两个原因：
			 *
			 * 1. **类名不稳定。** DSH 的 CSS Module 类名带每次构建的内容哈希
			 *    （实测 `Ph6Lgq_root`、`ZmL7Ga_root`），宿主一升级就全部失效 ——
			 *    而且是**静默失效**：样式还在，只是永远匹配不到。
			 * 2. **选择器散落。** 一旦 DSH 换了钩子，要改的地方遍布整个样式表。
			 *
			 * 因此本模块把「DSH 内部结构 → 本插件的类别」这一步收敛成**唯一**的映射，
			 * 且是纯函数：输入一个元素的属性快照，输出类别 id（或 null）。样式层只认
			 * 本插件自己的 `data-cc-cat` 属性，对 DSH 内部结构零依赖。
			 *
			 * 宿主升级时只需改这一个文件，且有单测兜底。
			 *
			 * @module dsh-colorful-commands/classify
			 */
			const { DANGER_PATTERNS } = __dshRequire("./constants.js");

			/**
			 * 工具名 → 类别。
			 *
			 * 大部分取自 DSH `ui-tool` 自己的 `TOOL_VARIANTS` 表（内核实测），与宿主分组口径
			 * 一致。**两处刻意偏离**宿主口径，因为本插件的分类目的与宿主不同（宿主按"结果
			 * 长什么样"分组，本插件按"用户想区分什么"着色）：
			 *
			 * - `web_fetch` / `web_search` → `web`：宿主把它们分别归到 read / search，
			 *   但两者都是**网络请求**，单列一类更有信息量（否则 `web` 类别永远不可达）。
			 * - 本地搜索（`grep` / `glob`）留在 `search`，与网络请求分开。
			 *
			 * 未列出的工具名**不是错误**，会落到 `other`；这张表只需覆盖常见项。
			 */
			const TOOL_CATEGORY = {
			  bash: 'command',
			  pwsh: 'command',
			  read: 'read',
			  read_image: 'read',
			  web_fetch: 'web',
			  web_search: 'web',
			  grep: 'search',
			  glob: 'search',
			  write: 'write',
			  edit: 'write',
			  run_code: 'write',
			};

			/**
			 * DSH `data-variant` → 类别。工具行与推理行共用这套属性。
			 *
			 * `think` 来自推理行（ReasoningRow），其余来自工具行。
			 */
			const VARIANT_CATEGORY = {
			  think: 'thinking',
			  bash: 'command',
			  read: 'read',
			  write: 'write',
			  edit: 'write',
			  search: 'search',
			  code: 'write',
			  others: 'other',
			};

			/**
			 * DSH `data-kind`（轨迹行）→ 类别。
			 *
			 * 轨迹视图（trajectory）与消息流（chat）用不同的钩子，所以两套都要覆盖。
			 */
			const KIND_CATEGORY = {
			  user: 'user',
			  message: 'assistant',
			  tool: 'command',
			  subtool: 'other',
			};

			/**
			 * DSH `data-chat-flow-kind`（消息流顶层项）→ 类别。
			 */
			const FLOW_CATEGORY = {
			  user: 'user',
			  steering: 'user',
			};

			/**
			 * DSH 插槽名 → 控件类别。`ui-renderer` 的 `renderSlot` 会给每个插槽条目
			 * 套一层 `[data-slot="<槽名>"]`，这是**官方稳定契约**（不是内部实现细节），
			 * 所以"其他控件也一样可染色"就靠它。
			 */
			const SLOT_CATEGORY = {
			  'conversation.input.permission': 'ctl-permission',
			  'conversation.input.model': 'ctl-model',
			  'conversation.input.plan': 'ctl-plan',
			  'conversation.input.activity': 'ctl-activity',
			  'conversation.input.left': 'ctl-toolbar',
			  'conversation.input.right': 'ctl-toolbar',
			  'conversation.input.dock': 'ctl-toolbar',
			  'conversation.input.overlay': 'ctl-toolbar',
			  'conversation.input.attachments': 'ctl-toolbar',
			};

			/**
			 * 判断一段命令文本是否命中危险词表。
			 *
			 * 只做包含匹配。**判错没有后果**：本插件不执行、不拦截、不改变任何命令的
			 * 行为，只影响颜色。因此这里刻意保持简单可读，不引入解析器。
			 *
			 * @param text 命令文本（可能为空/undefined）。
			 * @returns 命中返回 true。
			 */
			function isDangerousCommand(text) {
			  if (typeof text !== 'string' || text === '') return false;
			  const upper = text.toUpperCase();
			  for (const pattern of DANGER_PATTERNS) {
			    if (upper.includes(pattern.toUpperCase())) return true;
			  }
			  return false;
			}

			/**
			 * 把一个 DOM 元素的属性快照分类。
			 *
			 * 输入是**普通对象**而非元素，因此可以在 Node 里直接单测，不需要 DOM。
			 * 查找顺序即优先级：越具体的钩子越先看。
			 *
			 * @param attrs 属性快照，键为属性名（`data-tool` 这类），值为字符串或 undefined。
			 * @param options.text 元素的可见文本，仅用于危险命令判定；不传则跳过该判定。
			 * @returns 类别 id，或 null（不属于任何可染色类别）。
			 */
			function classifyAttrs(attrs, options = {}) {
			  const a = attrs ?? {};

			  // 0. 跳过已染色行的**内部**子部件。
			  //    实测：bash 工具行内部还有一个 `data-sample="bash"` 的卡片根，它也带
			  //    `data-variant="bash"`。若一并染色，同一条命令会出现两条竖条、两层着色。
			  //    外层（带 `data-tool`）已经覆盖了它，这里直接退出。
			  if (a['data-sample'] !== undefined) return null;

			  // 1. 插槽锚点优先：控件类与消息类不重叠，先判更具体的。
			  const slot = a['data-slot'];
			  if (typeof slot === 'string' && Object.hasOwn(SLOT_CATEGORY, slot)) return SLOT_CATEGORY[slot];

			  // 2. 工具行：data-tool 精确到具体工具名。
			  const tool = a['data-tool'];
			  if (typeof tool === 'string' && tool !== '') {
			    const base = TOOL_CATEGORY[tool] ?? 'other';
			    // 命令类再细分危险等级：这是用户明确要的"命令风险等级"。
			    if (base === 'command' && isDangerousCommand(options.text)) return 'danger';
			    return base;
			  }

			  // 3. 变体：推理行只有 data-variant="think"，工具行也有但已被上一条拦下。
			  const variant = a['data-variant'];
			  if (typeof variant === 'string' && Object.hasOwn(VARIANT_CATEGORY, variant)) {
			    const base = VARIANT_CATEGORY[variant];
			    if (base === 'command' && isDangerousCommand(options.text)) return 'danger';
			    return base;
			  }

			  // 4. 轨迹行。
			  const kind = a['data-kind'];
			  if (typeof kind === 'string' && Object.hasOwn(KIND_CATEGORY, kind)) return KIND_CATEGORY[kind];

			  // 5. 消息流顶层。
			  const flow = a['data-chat-flow-kind'];
			  if (typeof flow === 'string' && Object.hasOwn(FLOW_CATEGORY, flow)) return FLOW_CATEGORY[flow];

			  return null;
			}

			/**
			 * 从一个元素上读出分类所需的属性快照。
			 *
			 * 与 `classifyAttrs` 分开，是为了让分类逻辑保持无 DOM 依赖、可单测。
			 *
			 * @param element 具备 `getAttribute` 的元素（或 null）。
			 * @returns 属性快照。
			 */
			function readAttrs(element) {
			  if (element === null || element === undefined || typeof element.getAttribute !== 'function') return {};
			  const names = [
			    'data-slot',
			    'data-tool',
			    'data-variant',
			    'data-kind',
			    'data-chat-flow-kind',
			  ];
			  const attrs = {};
			  for (const name of names) {
			    const value = element.getAttribute(name);
			    if (value !== null) attrs[name] = value;
			  }
			  return attrs;
			}

			/** 导出内部表，供测试断言覆盖完整性。 */
			const _tables = { TOOL_CATEGORY, VARIANT_CATEGORY, KIND_CATEGORY, FLOW_CATEGORY, SLOT_CATEGORY };

			Object.assign(__exports, { "isDangerousCommand": isDangerousCommand, "classifyAttrs": classifyAttrs, "readAttrs": readAttrs, "_tables": _tables });
		});
		__dshRegistry.set("dom.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— DOM 打标层。
			 *
			 * ## 职责
			 *
			 * 扫描 DSH 的界面，把 `classify.js` 判定的类别写成**本插件自己的属性**
			 * `data-cc-cat` / `data-cc-scope`，样式层（`css.js`）只认这两个属性。
			 *
			 * ## 为什么用 MutationObserver 而不是纯 CSS
			 *
			 * 纯 CSS 需要写 DSH 的内部类名（`Ph6Lgq_root` 这种每次构建的哈希），
			 * 宿主升级即静默失效。而 DSH 的稳定契约是 `data-*` 属性，只有 JS 能读到
			 * 并把它们映射成"我们自己的"标记。
			 *
			 * ## 性能与安全
			 *
			 * - **批量**：把一批 added nodes 攒起来，一帧只处理一次。
			 * - **只扫新增子树**：用一次 `querySelectorAll` 而不是递归遍历。
			 * - **只观察 childList**：我们写属性不会触发自己（否则会自激循环）。
			 * - **绝不抛错**：观察回调里的异常会冒到全局，可能影响宿主；全部 try/catch。
			 * - **可卸载**：返回 disposer，插件卸载/热重载时断开观察并清标记。
			 *
			 * @module dsh-colorful-commands/dom
			 */
			const { classifyAttrs, readAttrs } = __dshRequire("./classify.js");
			const { CAT_ATTR, MARK_ATTR, SCOPE_ATTR } = __dshRequire("./css.js");

			/**
			 * 一次性匹配所有"可能可染色"的元素。
			 *
			 * 这是唯一的 DSH 属性清单，与 `classify.js` 的判定一一对应。
			 * 用属性存在性选择器（不取值），所以宿主加新工具名也无需改这里。
			 */
			const CANDIDATE_SELECTOR = [
			  '[data-tool]',
			  '[data-variant="think"]',
			  '[data-kind]',
			  '[data-chat-flow-kind]',
			  '[data-slot]',
			].join(',');

			/**
			 * 决定染色作用域。
			 *
			 * 见 `css.js` 的作用域表。判断顺序与 `classifyAttrs` 的优先级保持一致。
			 *
			 * @param attrs 属性快照。
			 * @returns 作用域名。
			 */
			function scopeFor(attrs) {
			  if (attrs['data-slot'] !== undefined) return 'tint';
			  if (attrs['data-tool'] !== undefined) return 'header';
			  if (attrs['data-variant'] === 'think') return 'header';
			  if (attrs['data-chat-flow-kind'] !== undefined) return 'stripe';
			  if (attrs['data-kind'] !== undefined) return 'self';
			  return 'tint';
			}

			/**
			 * 取用于危险命令判定的文本。
			 *
			 * ⚠️ 必须只取**表头**文本，不能取整个元素：展开后的命令输出里出现 `sudo`、
			 * `rm ` 这类字样会让安全命令被误判成危险色。表头（`[data-disclosure-row]`）
			 * 恰好只含工具名与摘要，正是要判定的对象。
			 *
			 * 没有表头的行（轨迹视图）退回到元素自身文本，并截断 —— 摘要总在正文之前，
			 * 前若干字符足够判定。
			 *
			 * @param element 元素。
			 * @returns 用于判定的文本。
			 */
			function dangerText(element) {
			  try {
			    const header = typeof element.querySelector === 'function'
			      ? element.querySelector('[data-disclosure-row]')
			      : null;
			    const source = header ?? element;
			    const text = source.textContent;
			    return typeof text === 'string' ? text.slice(0, 300) : '';
			  } catch {
			    return '';
			  }
			}

			/**
			 * 给单个元素打标。已经打过的直接跳过（幂等）。
			 *
			 * @param element 候选元素。
			 * @returns 打上的类别 id，或 null（未打标）。
			 */
			function tagElement(element) {
			  if (element === null || element === undefined) return null;
			  if (typeof element.getAttribute !== 'function') return null;
			  // 幂等：同一个元素只处理一次。
			  if (element.getAttribute(MARK_ATTR) !== null) return element.getAttribute(CAT_ATTR);

			  const attrs = readAttrs(element);
			  const category = classifyAttrs(attrs, { text: dangerText(element) });
			  if (category === null) return null;

			  try {
			    element.setAttribute(CAT_ATTR, category);
			    element.setAttribute(SCOPE_ATTR, scopeFor(attrs));
			    element.setAttribute(MARK_ATTR, '');
			    return category;
			  } catch {
			    // 只读/被冻结的 DOM：放弃这一个元素，不影响其他。
			    return null;
			  }
			}

			/**
			 * 扫描一棵子树并打标。
			 *
			 * @param root 根节点（元素或文档）。
			 * @returns 打标的元素数量。
			 */
			function tagTree(root) {
			  if (root === null || root === undefined) return 0;
			  let count = 0;
			  try {
			    // 根本身也可能是候选（批量处理时常见）。
			    if (typeof root.matches === 'function' && root.matches(CANDIDATE_SELECTOR)) {
			      if (tagElement(root) !== null) count += 1;
			    }
			    if (typeof root.querySelectorAll !== 'function') return count;
			    const found = root.querySelectorAll(CANDIDATE_SELECTOR);
			    for (const element of found) {
			      if (tagElement(element) !== null) count += 1;
			    }
			  } catch {
			    // 选择器或 DOM 异常：放弃这一批，不影响后续。
			  }
			  return count;
			}

			/**
			 * 移除所有本插件打上的标记。
			 *
			 * @param root 根节点。
			 */
			function clearTags(root) {
			  const target = root ?? globalThis.document;
			  if (target === null || target === undefined) return;
			  try {
			    const tagged = target.querySelectorAll(`[${MARK_ATTR}]`);
			    for (const element of tagged) {
			      element.removeAttribute(MARK_ATTR);
			      element.removeAttribute(CAT_ATTR);
			      element.removeAttribute(SCOPE_ATTR);
			    }
			  } catch {
			    // 忽略。
			  }
			}

			/**
			 * 启动观察器：先全量扫一遍，再持续跟随新增节点。
			 *
			 * @param options.document 文档对象（便于测试注入）。
			 * @param options.onError 失败回调（由调用方收集进启动报告）。
			 * @returns disposer；调用后停止观察并清标记。
			 */
			function startObserver(options = {}) {
			  const doc = options.document ?? globalThis.document;
			  const onError = typeof options.onError === 'function' ? options.onError : () => {};

			  if (doc === null || doc === undefined || typeof doc.querySelectorAll !== 'function') {
			    onError('dom:no-document', new Error('document is unavailable'));
			    return () => {};
			  }

			  // 首屏全量：此时界面可能还没挂载，空扫是正常的。
			  try {
			    tagTree(doc.body ?? doc.documentElement ?? doc);
			  } catch (error) {
			    onError('dom:initial-scan', error);
			  }

			  const MutationObserverImpl = globalThis.MutationObserver;
			  if (typeof MutationObserverImpl !== 'function') {
			    // 没有观察器就只能静态染一次：明确降级，但不报错（不算失败）。
			    return () => clearTags(doc);
			  }

			  /** 待处理的新增节点。 */
			  let pending = [];
			  let scheduled = false;
			  let stopped = false;

			  const flush = () => {
			    scheduled = false;
			    if (stopped) return;
			    const batch = pending;
			    pending = [];
			    try {
			      for (const node of batch) {
			        if (node === null || node === undefined) continue;
			        // 只处理元素节点；文本节点不可能带 data-* 属性。
			        if (node.nodeType !== 1) continue;
			        tagTree(node);
			      }
			    } catch (error) {
			      onError('dom:flush', error);
			    }
			  };

			  const schedule = () => {
			    if (scheduled || stopped) return;
			    scheduled = true;
			    try {
			      const raf = globalThis.requestAnimationFrame;
			      if (typeof raf === 'function') raf(flush);
			      else setTimeout(flush, 16);
			    } catch {
			      // rAF 不可用：直接同步处理，宁可慢一点也不要漏。
			      flush();
			    }
			  };

			  let observer;
			  try {
			    observer = new MutationObserverImpl((records) => {
			      try {
			        for (const record of records) {
			          if (record.type !== 'childList') continue;
			          for (const node of record.addedNodes) pending.push(node);
			        }
			        if (pending.length > 0) schedule();
			      } catch (error) {
			        onError('dom:observer-callback', error);
			      }
			    });
			    const target = doc.body ?? doc.documentElement;
			    if (target === null || target === undefined) {
			      onError('dom:no-target', new Error('document has no body or documentElement'));
			      return () => clearTags(doc);
			    }
			    // 只观察 childList：我们写属性不会触发自己。
			    observer.observe(target, { childList: true, subtree: true });
			  } catch (error) {
			    onError('dom:observe', error);
			    return () => clearTags(doc);
			  }

			  return () => {
			    stopped = true;
			    pending = [];
			    try {
			      observer.disconnect();
			    } catch {
			      // 忽略。
			    }
			    clearTags(doc);
			  };
			}

			Object.assign(__exports, { "tagElement": tagElement, "tagTree": tagTree, "clearTags": clearTags, "startObserver": startObserver });
		});
		__dshRegistry.set("settings-card.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— 「插件详情页」里的设置卡片。
			 *
			 * ## 位置契约
			 *
			 * 注册到 **`plugins.item`**（插件详情页的配置卡片），不是 `settings.section`。
			 * 权威原句（`dsh-client-ui-plugin-manager/README.zh.md`）：
			 * 「注册了配置页的插件在这里、在它自己的页面上编辑；设置里只保留只读的插件列表。」
			 * 用户路径：侧栏「插件」→ 找到本插件 → 在里面配色。
			 *
			 * ## UI 组件来源
			 *
			 * 除**颜色选择器**外，全部控件来自 `@deepseek-ai/dsh-client-ui-primitives`
			 * （Switch / Button / SegmentedControl / Input / SettingsForm / Tooltip / Tag）。
			 *
			 * 颜色选择器是唯一的自写控件：primitives 没有颜色选择器，而"颜色预览 + 实际
			 * 渲染预览 + 色号"这个组合无法用现有导出拼出来。规范允许「需求确实特殊时在
			 * 自己的包里写自己的组件」，前提是**不复制已有控件** —— 这里没有复制任何东西：
			 * 色板格子是原生 button，取色用原生 `<input type="color">`，色号输入用 primitives
			 * 的 `Input`。
			 *
			 * ## 草稿语义
			 *
			 * 所有改动先落在本地 draft，点「保存」才写回 Host（与官方 SettingsForm 契约一致：
			 * 「只在按钮点击时保存，卸载即丢弃」）。这样用户调色过程中不会每动一下就写盘。
			 *
			 * @module dsh-colorful-commands/settings-card
			 */
			const { useCallback, useMemo, useState } = __dshExternal("react");
			const { jsx, jsxs } = __dshExternal("react/jsx-runtime");
			const { Button, Input, SegmentedControl, SettingsForm, Switch, Tag, Tooltip } = __dshExternal("@deepseek-ai/dsh-client-ui-primitives");
			const { ALL_CATEGORIES, CATEGORIES, CONTROL_CATEGORIES } = __dshRequire("./constants.js");
			const { presetColorFor, presetColors, BUILTIN_PRESETS } = __dshRequire("./palettes.js");
			const { CATEGORY_KEYS, PRESET_KEYS } = __dshRequire("./locale.js");
			const { sanitizeColor, scopedPreviewCss } = __dshRequire("./css.js");

			/** 预设选择顺序。 */
			const PRESET_IDS = ['chinese', 'japanese', 'macaron', 'none'];

			/**
			 * 每个类别在当前 draft 下的有效颜色。
			 *
			 * @param draft 草稿配置。
			 * @param category 类别 id。
			 * @returns `{ light, dark }`，可能含空串（表示未设置）。
			 */
			function effectiveColor(draft, category) {
			  const custom = draft.colors?.[category];
			  if (custom !== undefined) {
			    return { light: custom.light ?? '', dark: custom.dark ?? '' };
			  }
			  const fromPreset = draft.preset === 'none' ? undefined : presetColorFor(draft.preset, category);
			  return fromPreset ?? { light: '', dark: '' };
			}

			/**
			 * 取某个预设下该类别的色板候选。
			 *
			 * 返回的是「整对」而非单个色：色板里每个颜色都有配套的浅/深值，用户点一下
			 * 想要的是"这一套"，不是把同一个色值塞进两边（那会在另一个主题下失明）。
			 *
			 * @param presetId 预设 id。
			 * @param category 类别。
			 * @returns `[{ light, dark }]` 列表，本类别自己的一对排在最前。
			 */
			function swatchesFor(presetId, category) {
			  const palette = BUILTIN_PRESETS[presetId];
			  if (palette === undefined) return [];
			  const own = palette[category];
			  const seen = new Set();
			  const list = [];
			  const push = (pair) => {
			    if (pair === undefined) return;
			    const key = `${pair.light}|${pair.dark}`;
			    if (seen.has(key)) return;
			    seen.add(key);
			    list.push({ light: pair.light, dark: pair.dark });
			  };
			  push(own);
			  for (const pair of Object.values(palette)) push(pair);
			  return list.slice(0, 14);
			}

			/**
			 * 单个颜色格子。
			 *
			 * 原生 button + 内联背景色；不引入任何自写"下拉/弹窗"。
			 */
			function Swatch(props) {
			  const { color, active, label, onPick } = props;
			  return jsx(Tooltip, {
			    label: color,
			    children: jsxs('button', {
			      type: 'button',
			      'aria-label': `${label}: ${color}`,
			      'aria-pressed': active ? 'true' : 'false',
			      onClick: () => onPick(color),
			      style: {
			        width: '20px',
			        height: '20px',
			        padding: 0,
			        borderRadius: '6px',
			        cursor: 'pointer',
			        background: color,
			        border: active ? '2px solid var(--dsw-alias-label-primary)' : '1px solid var(--dsw-alias-border-l2)',
			        flex: 'none',
			      },
			    }),
			  });
			}

			/**
			 * 一个类别的一行：类别名 + 浅色 + 深色两组控件。
			 *
			 * 每组控件 = 当前色预览 + 原生取色器 + 色号输入 + 色板格子。
			 */
			function CategoryRow(props) {
			  const { t, category, draft, onEdit } = props;
			  const color = effectiveColor(draft, category);
			  const swatches = useMemo(
			    () => swatchesFor(draft.preset === 'none' ? 'chinese' : draft.preset, category),
			    [draft.preset, category],
			  );

			  const field = (mode) => {
			    const value = color[mode];
			    const valid = value === '' || sanitizeColor(value) !== null;
			    return jsxs('div', {
			      style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 },
			      children: [
			        // 当前色预览：始终显示"实际会被用上的颜色"。
			        jsx('span', {
			          'aria-hidden': 'true',
			          style: {
			            width: '18px',
			            height: '18px',
			            borderRadius: '5px',
			            flex: 'none',
			            background: sanitizeColor(value) ?? 'transparent',
			            border: '1px solid var(--dsw-alias-border-l2)',
			            backgroundImage: sanitizeColor(value) === null
			              ? 'linear-gradient(45deg, var(--dsw-alias-border-l1) 25%, transparent 25%, transparent 75%, var(--dsw-alias-border-l1) 75%)'
			              : 'none',
			            backgroundSize: '6px 6px',
			          },
			        }),
			        // 原生取色器：系统级体验，无需自写色轮。
			        jsx('input', {
			          type: 'color',
			          'aria-label': `${t(CATEGORY_KEYS[category])} ${mode === 'light' ? t('columnLight') : t('columnDark')}`,
			          value: sanitizeColor(value) ?? '#000000',
			          onChange: (event) => onEdit(category, mode, event.target.value),
			          style: {
			            width: '28px',
			            height: '22px',
			            padding: 0,
			            border: '1px solid var(--dsw-alias-border-l2)',
			            borderRadius: '6px',
			            background: 'transparent',
			            cursor: 'pointer',
			            flex: 'none',
			          },
			        }),
			        jsx(Input, {
			          value,
			          spellCheck: false,
			          'aria-invalid': valid ? undefined : 'true',
			          'aria-label': `${t(CATEGORY_KEYS[category])} ${t('hexLabel')}`,
			          onChange: (event) => onEdit(category, mode, event.target.value),
			          style: { width: '104px' },
			        }),
			      ],
			    });
			  };

			  return jsxs('div', {
			    style: {
			      display: 'grid',
			      gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 2fr)',
			      gap: '8px 12px',
			      alignItems: 'center',
			      padding: '8px 0',
			      borderTop: '1px solid var(--dsw-alias-border-l1)',
			    },
			    children: [
			      jsxs('div', {
			        style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 },
			        children: [
			          jsx('span', {
			            style: {
			              fontSize: '13px',
			              color: 'var(--dsw-alias-label-primary)',
			              overflow: 'hidden',
			              textOverflow: 'ellipsis',
			              whiteSpace: 'nowrap',
			            },
			            children: t(CATEGORY_KEYS[category]),
			          }),
			          color.light === '' && color.dark === ''
			            ? jsx(Tag, { children: '—' })
			            : null,
			        ],
			      }),
			      jsxs('div', {
			        style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px' },
			        children: [
			          jsxs('div', {
			            style: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
			            children: [
			              jsx('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('columnLight') }),
			              field('light'),
			            ],
			          }),
			          jsxs('div', {
			            style: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
			            children: [
			              jsx('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('columnDark') }),
			              field('dark'),
			            ],
			          }),
			        ],
			      }),
			      jsx('div', {
			        style: {
			          gridColumn: '1 / -1',
			          display: 'flex',
			          flexWrap: 'wrap',
			          gap: '4px',
			          alignItems: 'center',
			        },
			        children: [
			          ...swatches.map((pair) => jsx(Swatch, {
			            key: `${pair.light}|${pair.dark}`,
			            color: pair.dark,
			            label: t(CATEGORY_KEYS[category]),
			            active: sanitizeColor(color.light) === sanitizeColor(pair.light)
			              && sanitizeColor(color.dark) === sanitizeColor(pair.dark),
			            onPick: () => onEdit(category, 'pair', pair),
			          }, `${pair.light}|${pair.dark}`)),
			          jsx(Button, {
			            variant: 'ghost',
			            size: 'sm',
			            onClick: () => onEdit(category, 'reset', ''),
			            children: t('resetOne'),
			          }),
			        ],
			      }),
			    ],
			  });
			}

			/**
			 * 实时预览：用当前 draft 生成同一套 CSS，并渲染几个样例行。
			 *
			 * 这样"实际渲染预览"是真的走生产样式生成器（`css.js`），不是另画一份 ——
			 * 预览与真实效果不可能不一致。
			 *
			 * @param props.draft 当前草稿。
			 * @param props.cssText 由 draft 生成的样式文本。
			 * @param props.t 文案函数。
			 */
			function Preview(props) {
			  const { cssText, t } = props;
			  const rows = [
			    { cat: 'thinking', label: t('categoryThinking') },
			    { cat: 'command', label: t('categoryCommand') },
			    { cat: 'danger', label: t('categoryDanger') },
			    { cat: 'read', label: t('categoryRead') },
			  ];
			  return jsxs('div', {
			    children: [
			      // 预览区自带一份样式，且作用域限定在 .cc-preview 内，避免影响页面其他部分。
			      jsx('style', { children: scopedPreviewCss(cssText) }),
			      jsxs('div', {
			        className: 'cc-preview',
			        style: {
			          display: 'flex',
			          flexDirection: 'column',
			          gap: '2px',
			          padding: '8px 10px',
			          borderRadius: '8px',
			          background: 'var(--dsw-alias-bg-base)',
			          border: '1px solid var(--dsw-alias-border-l1)',
			        },
			        children: rows.map((row) => jsxs('div', {
			          // 模拟宿主结构：根元素带类别标记，表头带 [data-disclosure-header]。
			          'data-cc-cat': row.cat,
			          'data-cc-scope': 'header',
			          style: { display: 'flex', flexDirection: 'column' },
			          children: [
			            jsxs('div', {
			              'data-disclosure-header': true,
			              style: { display: 'flex', alignItems: 'center', gap: '6px', height: '24px' },
			              children: [
			                jsx('span', {
			                  'data-disclosure-row': true,
			                  style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
			                  children: [
			                    jsx('span', {
			                      'aria-hidden': 'true',
			                      style: {
			                        width: '14px',
			                        height: '14px',
			                        borderRadius: '50%',
			                        border: '1.5px solid currentColor',
			                        display: 'inline-block',
			                      },
			                    }),
			                    jsx('span', { children: row.label }),
			                  ],
			                }),
			              ],
			            }),
			          ],
			        }, row.cat)),
			      }),
			    ],
			  });
			}


			/**
			 * 设置卡片本体。
			 *
			 * props 由插槽的 `inject` 面提供（见 `settings-card-face`）。
			 */
			function ColorfulCommandsCard(props) {
			  const { t, onSave, onDiscard, setDraft, buildCss, formState } = props;
			  // 订阅完整快照：草稿与表单状态在同一个 store 里，所以一次订阅拿全。
			  const snapshot = props.useDraft((value) => value);
			  const draft = snapshot.config;
			  const state = formState(snapshot);

			  const cssText = useMemo(() => buildCss(draft), [draft, buildCss]);

			  const edit = useCallback((category, mode, value) => {
			    setDraft((current) => {
			      const next = { ...current, colors: { ...current.colors } };
			      if (mode === 'reset') {
			        // 恢复预设值 = 删掉覆盖项，让预设重新生效。
			        delete next.colors[category];
			        return next;
			      }
			      if (mode === 'pair') {
			        // 色板点选：写入配套的浅/深一对。
			        next.colors[category] = { light: value.light, dark: value.dark };
			        return next;
			      }
			      // 单边编辑（取色器或色号输入）：只改一边，另一边保留当前有效值。
			      const existing = next.colors[category] ?? effectiveColor(current, category);
			      next.colors[category] = { ...existing, [mode]: value };
			      return next;
			    });
			  }, [setDraft]);

			  const resetAll = useCallback(() => {
			    setDraft((current) => ({ ...current, colors: {} }));
			  }, [setDraft]);

			  if (props.view === 'summary') return t('cardDescription');

			  return jsx(SettingsForm, {
			    labels: {
			      save: t('save'),
			      saving: t('save'),
			      saveFailed: t('saveFailed'),
			      unavailable: t('unavailable'),
			      readOnly: t('readOnlyNotice'),
			    },
			    state,
			    onSave,
			    onDiscard,
			    children: jsxs('div', {
			      style: { display: 'flex', flexDirection: 'column', gap: '16px' },
			      children: [
			        jsxs('p', {
			          style: { margin: 0, fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' },
			          children: t('cardDescription'),
			        }),

			        // ── 总开关 ────────────────────────────────────────────────
			        jsxs('div', {
			          style: { display: 'flex', alignItems: 'center', gap: '10px' },
			          children: [
			            jsx(Switch, {
			              checked: draft.enabled,
			              label: t('masterLabel'),
			              onChange: (checked) => setDraft((current) => ({ ...current, enabled: checked })),
			            }),
			            jsxs('div', {
			              children: [
			                jsx('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-primary)' }, children: t('masterLabel') }),
			                jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('masterHint') }),
			              ],
			            }),
			          ],
			        }),

			        // ── 预设 ──────────────────────────────────────────────────
			        jsxs('div', {
			          style: { display: 'flex', flexDirection: 'column', gap: '6px' },
			          children: [
			            jsx('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-primary)' }, children: t('presetLabel') }),
			            jsx(SegmentedControl, {
			              id: 'cc-preset',
			              label: t('presetLabel'),
			              value: draft.preset,
			              options: PRESET_IDS.map((id) => ({ value: id, label: t(PRESET_KEYS[id]) })),
			              onChange: (value) => setDraft((current) => ({ ...current, preset: value, colors: {} })),
			            }),
			            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('presetHint') }),
			          ],
			        }),

			        // ── 分类配色 ──────────────────────────────────────────────
			        jsxs('section', {
			          children: [
			            jsx('h3', { style: { margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: t('categoriesTitle') }),
			            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginBottom: '4px' }, children: t('categoriesHint') }),
			            ...CATEGORIES.map((category) => jsx(CategoryRow, { t, category, draft, onEdit: edit }, category)),
			          ],
			        }),

			        // ── 界面控件 ──────────────────────────────────────────────
			        jsxs('section', {
			          children: [
			            jsx('h3', { style: { margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: t('controlsTitle') }),
			            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginBottom: '4px' }, children: t('controlsHint') }),
			            ...CONTROL_CATEGORIES.map((category) => jsx(CategoryRow, { t, category, draft, onEdit: edit }, category)),
			          ],
			        }),

			        // ── 预览 ──────────────────────────────────────────────────
			        jsxs('section', {
			          children: [
			            jsx('h3', { style: { margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: t('previewTitle') }),
			            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginBottom: '6px' }, children: t('previewHint') }),
			            jsx(Preview, { draft, cssText, t }),
			          ],
			        }),

			        jsxs('div', {
			          style: { display: 'flex', gap: '8px', alignItems: 'center' },
			          children: [
			            jsx(Button, { variant: 'outline', size: 'sm', onClick: resetAll, children: t('resetAll') }),
			            jsx('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('categoriesHint') }),
			          ],
			        }),
			      ],
			    }),
			  });
			}



			Object.assign(__exports, { "ColorfulCommandsCard": ColorfulCommandsCard, "ALL_CATEGORIES": ALL_CATEGORIES, "presetColors": presetColors });
		});
		__dshRegistry.set("settings-face.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— 设置卡片的「接线面」。
			 *
			 * ## 这一层在解决什么
			 *
			 * 设置卡片需要三样东西，而它们都来自宿主、且都可能"晚到"或"不在"：
			 * 1. **settings 命名空间的 scope**（`ctx.configForms.get(ns)`）—— 异步填充；
			 * 2. **locale 绑定**（`ctx.locale.bind(ns)`）；
			 * 3. **一个稳定的 store**，组件通过它读草稿与表单状态。
			 *
			 * 把这三样收敛到一个 face 对象里，插槽的 `inject: () => face` 把它交给组件。
			 * 组件因此完全不碰宿主服务，只读 props —— 这也让组件可以在测试里直接渲染。
			 *
			 * ## 为什么草稿与表单状态放在同一个 store
			 *
			 * `SettingsForm` 的 `state`（dirty / saving / failed）与草稿必须**一起**变化：
			 * 如果 state 是"渲染时现算"的普通函数，React 不会因它变化而重渲染，
			 * 于是"点保存后按钮一直转圈"或"改完按钮不亮"这类静默失效就会出现。
			 * 放进同一个快照，订阅一次就全都有了。
			 *
			 * @module dsh-colorful-commands/settings-face
			 */
			const { useSyncExternalStore } = __dshExternal("react");
			const { createSnapshotStore } = __dshExternal("@deepseek-ai/dsh-client-store");
			const { buildStylesheet, resolveColors } = __dshRequire("./css.js");
			const { presetColors } = __dshRequire("./palettes.js");
			const { ALL_CATEGORIES } = __dshRequire("./constants.js");

			/**
			 * 从 scope 快照里读出配置值。
			 *
			 * ⚠️ 快照形状（内核实测）：`{ status, value, base, user, revision, writable, mode }`。
			 * 读 `value`（**已合并**的当前值）而不是 `user`，因为要显示"实际生效的值"。
			 *
			 * @param snapshot scope 快照。
			 * @returns 规范化后的配置。
			 */
			function readConfig(snapshot) {
			  const value = snapshot?.value ?? {};
			  const colors = value.colors;
			  return {
			    enabled: value.enabled !== false,
			    preset: typeof value.preset === 'string' ? value.preset : 'chinese',
			    colors: colors !== null && typeof colors === 'object' ? { ...colors } : {},
			  };
			}

			/** 深比较两个配置（值都是 JSON 形状，字符串化足够）。 */
			function sameConfig(a, b) {
			  return JSON.stringify(a) === JSON.stringify(b);
			}

			/**
			 * 由草稿生成样式文本（预览与生产走同一条路径）。
			 *
			 * @param draft 草稿配置。
			 * @returns CSS 文本。
			 */
			function draftCss(draft) {
			  const { colors, enabled } = resolveColors(draft, { presetColors: presetColors(draft?.preset) });
			  return buildStylesheet(colors, { enabled });
			}

			/**
			 * 创建一个设置卡片面。
			 *
			 * @param options.scope configForms scope（可能 undefined：命名空间尚未就绪）。
			 * @param options.t 文案函数。
			 * @param options.onError 失败回调（收集进启动报告）。
			 * @returns face 对象，作为插槽 `inject` 的返回值。
			 */
			function createSettingsFace(options = {}) {
			  const { scope, t } = options;
			  const report = typeof options.onError === 'function' ? options.onError : () => {};

			  const initial = readConfig(scope?.getSnapshot?.());

			  /** 单一 store：草稿 + 表单状态 + 命名空间可用性。 */
			  const store = createSnapshotStore({
			    config: { ...initial },
			    /** 上次从 scope 同步进来的值，用于判断草稿是否被用户改过。 */
			    baseline: { ...initial },
			    saving: false,
			    failed: false,
			    available: scope !== undefined,
			    writable: scope?.getSnapshot?.().writable !== false,
			  });

			  /** scope 变化时：非脏则跟随，脏则保留用户草稿。 */
			  const syncFromScope = () => {
			    try {
			      const snapshot = scope?.getSnapshot?.();
			      const next = readConfig(snapshot);
			      const state = store.getSnapshot();
			      const dirty = !sameConfig(state.config, state.baseline);
			      store.update((draft) => {
			        draft.baseline = { ...next };
			        draft.available = snapshot !== undefined && snapshot.status !== 'unavailable';
			        draft.writable = snapshot?.writable !== false;
			        // 用户正在改的时候不要覆盖他的草稿。
			        if (!dirty) draft.config = { ...next };
			      });
			    } catch (error) {
			      report('face:sync', error);
			    }
			  };

			  let unsubscribe;
			  try {
			    if (typeof scope?.subscribe === 'function') unsubscribe = scope.subscribe(syncFromScope);
			  } catch (error) {
			    report('face:subscribe', error);
			  }

			  const face = {
			    /**
			     * 组件订阅完整快照。
			     *
			     * ⚠️ 这是 hook：只能在组件顶层无条件调用（Rules of Hooks）。
			     */
			    useDraft: (selector) => {
			      const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
			      return selector(snapshot);
			    },
			    t,
			    buildCss: draftCss,
			    /** 组件写入草稿。 */
			    setDraft: (updater) => {
			      try {
			        store.update((state) => {
			          const next = typeof updater === 'function' ? updater(state.config) : updater;
			          state.config = { ...next };
			          state.failed = false;
			        });
			      } catch (error) {
			        report('face:set-draft', error);
			      }
			    },
			    /** 保存：把草稿写回命名空间。 */
			    save: async () => {
			      const before = store.getSnapshot();
			      if (before.saving) return;
			      if (sameConfig(before.config, before.baseline)) return;
			      if (before.writable === false) {
			        store.update((state) => {
			          state.failed = true;
			        });
			        return;
			      }

			      store.update((state) => {
			        state.saving = true;
			        state.failed = false;
			      });

			      try {
			        // 逐字段写入：settings 的写入契约是单字段的。
			        const draft = store.getSnapshot().config;
			        const results = await Promise.all([
			          scope.set('enabled', draft.enabled),
			          scope.set('preset', draft.preset),
			          scope.set('colors', draft.colors),
			        ]);
			        store.update((state) => {
			          if (results.some((ok) => ok === false)) {
			            state.failed = true;
			          } else {
			            // 保存成功：把当前草稿当作新的基线。
			            state.baseline = { ...state.config };
			          }
			        });
			      } catch (error) {
			        report('face:save', error);
			        store.update((state) => {
			          state.failed = true;
			        });
			      } finally {
			        store.update((state) => {
			          state.saving = false;
			        });
			      }
			    },
			    /** 放弃：回到基线值。 */
			    discard: () => {
			      store.update((state) => {
			        state.config = { ...state.baseline };
			        state.failed = false;
			      });
			    },
			    /** SettingsForm 需要的状态（由 store 快照派生）。 */
			    formState: (snapshot) => ({
			      available: snapshot.available,
			      writable: snapshot.writable,
			      dirty: !sameConfig(snapshot.config, snapshot.baseline),
			      invalid: false,
			      saving: snapshot.saving,
			      failed: snapshot.failed,
			    }),
			    dispose: () => {
			      try {
			        unsubscribe?.();
			      } catch {
			        // 忽略。
			      }
			    },
			  };

			  return face;
			}



			Object.assign(__exports, { "readConfig": readConfig, "draftCss": draftCss, "createSettingsFace": createSettingsFace, "ALL_CATEGORIES": ALL_CATEGORIES });
		});
		__dshRegistry.set("client.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— 浏览器侧入口。
			 *
			 * ## 职责
			 *
			 * 1. 读取设置（settings 命名空间）；
			 * 2. 生成并注入样式表；
			 * 3. 启动 DOM 观察器给界面元素打类别标记；
			 * 4. 在「插件详情页」注册设置卡片。
			 *
			 * ## 两条硬规则的落实
			 *
			 * **规则一：`ctx.<service>` 必须出现在本文件导出的 `inject` 里。**
			 * cordis 的 `ctx.<service>` 是代理，服务名没写进 `inject` 会**同步抛**
			 * `cannot get property "X" without inject` → `apply` 抛错 → fiber FAILED →
			 * web boot `throw new Error("web boot: N entry did not activate")` → **整站白屏**，
			 * 且 crash log 只有一行 `<包名>: failed`、没有堆栈。
			 *
			 * 本文件用到的服务与 `inject` 一一对应：
			 * - `ctx.slots` → `"slots"`
			 * - `ctx.locale` → `"locale"`
			 * - `ctx.effect` / `ctx.inject` / `ctx.get` / `ctx.fiber` 是 Context 自带成员，不用声明。
			 *
			 * ⚠️ `configForms` **刻意不写进 `inject`**：命名空间可能晚于 `apply` 到达，
			 * 写进去就变成硬依赖（别人挂了本插件也起不来）。改用 `ctx.get('configForms')`
			 * 安全探测 —— Context 自带方法不受白名单限制，服务没到返回 undefined。
			 *
			 * **规则二：`apply` 绝不允许把异常抛出去。** 每个表面各自 guard，失败只降级、
			 * 只记录（`console.error` + `localStorage`）。详见 `boot-diagnostics.js`。
			 *
			 * @module dsh-colorful-commands/client
			 */
			const { CARD_ID, LOCALE_NS, PLUGIN_ID, SETTINGS_NAMESPACE, STYLE_TAG_ID } = __dshRequire("./constants.js");
			const { dictionaries } = __dshRequire("./locale.js");
			const { buildStylesheet, resolveColors } = __dshRequire("./css.js");
			const { presetColors } = __dshRequire("./palettes.js");
			const { createFailures, guard, writeBootReport } = __dshRequire("./boot-diagnostics.js");
			const { startObserver } = __dshRequire("./dom.js");
			const { ColorfulCommandsCard } = __dshRequire("./settings-card.js");
			const { createSettingsFace, readConfig } = __dshRequire("./settings-face.js");

			/**
			 * 必需服务白名单（cordis fiber inject）。
			 *
			 * 只列本文件真正用到的服务名。多列一项 = 多一个"别人挂了我也起不来"的硬依赖；
			 * 少列一项 = 整站白屏。两侧都要靠静态守卫测试兜住。
			 */
			const inject = ['slots', 'locale'];

			/** 样式标签：注入到 head，卸载时移除。 */
			let styleElement = null;

			/**
			 * 把 CSS 写进 head。
			 *
			 * `document` 当**不可信输入**：head 可能被冻结、可能没有 head。全部包 try/catch，
			 * 失败返回 false 表示降级（而不是抛错 —— 抛错会让插槽条目被永久撤销）。
			 *
			 * @param cssText 样式文本。
			 * @returns 是否成功。
			 */
			function applyStylesheet(cssText) {
			  try {
			    const doc = globalThis.document;
			    if (doc === null || doc === undefined) return false;

			    if (cssText === '') {
			      // 空样式 = 关闭着色：移除已有标签。
			      if (styleElement !== null) {
			        styleElement.remove();
			        styleElement = null;
			      }
			      return true;
			    }

			    if (styleElement === null) {
			      styleElement = doc.createElement('style');
			      styleElement.dataset.plugin = PLUGIN_ID;
			      styleElement.id = STYLE_TAG_ID;
			      const head = doc.head ?? doc.documentElement;
			      if (head === null || head === undefined) return false;
			      head.appendChild(styleElement);
			    } else if (styleElement.isConnected === false) {
			      // 标签还在引用里、但已被移出文档（head 被重建 / HMR 清理）。继续写它的
			      // textContent 是**静默失效**：样式永远不生效。重新挂回去。
			      const head = doc.head ?? doc.documentElement;
			      if (head === null || head === undefined) return false;
			      head.appendChild(styleElement);
			    }
			    styleElement.textContent = cssText;
			    return true;
			  } catch {
			    // head 冻结 / DOM 被改写：降级为"没有着色"，不影响宿主。
			    return false;
			  }
			}

			/**
			 * 由配置生成样式并应用。
			 *
			 * @param config 配置值。
			 * @returns 生成的 CSS 文本。
			 */
			function renderFromConfig(config) {
			  const { colors, enabled } = resolveColors(config, { presetColors: presetColors(config?.preset) });
			  const css = buildStylesheet(colors, { enabled });
			  applyStylesheet(css);
			  return css;
			}

			/**
			 * 浏览器侧插件体。
			 *
			 * @param ctx 客户端 cordis 上下文。
			 */
			function apply(ctx) {
			  const failures = createFailures();

			  /** 当前配置（scope 未就绪时用默认值，保证首帧也有配色）。 */
			  let current = { enabled: true, preset: 'chinese', colors: {} };

			  // ── 1. locale 字典 ──────────────────────────────────────────────
			  guard(failures, 'locale', () => {
			    ctx.effect(() => ctx.locale.register(LOCALE_NS, dictionaries), `${PLUGIN_ID}: dictionaries`);
			  });
			  const t = guard(failures, 'locale-bind', () => ctx.locale.bind(LOCALE_NS))
			    ?? ((key) => key);

			  // ── 2. 首帧着色（不等设置到达，避免闪一下原生配色） ──────────────
			  guard(failures, 'first-paint', () => {
			    renderFromConfig(current);
			  });

			  // ── 3. DOM 观察器 ───────────────────────────────────────────────
			  guard(failures, 'dom-observer', () => {
			    const stop = startObserver({
			      onError: (where, error) => {
			        failures.push({ where, message: String(error?.message ?? error), stack: '' });
			      },
			    });
			    ctx.effect(() => stop, `${PLUGIN_ID}: dom observer`);
			  });

			  // ── 4. 设置：绑定命名空间并跟随变化 ─────────────────────────────
			  guard(failures, 'settings', () => {
			    // configForms 用 ctx.get 探测：命名空间可能晚于 apply 到达。
			    // ⚠️ `ctx.get` 本身也可能不在（极端降级上下文），所以要判类型再调 ——
			    // 直接 `ctx.get(...)` 会抛 TypeError，虽然被 guard 兜住，但那会白白丢掉
			    // "用默认配色继续工作"的机会。
			    const get = typeof ctx.get === 'function' ? ctx.get.bind(ctx) : undefined;
			    const forms = get === undefined ? undefined : get('configForms');
			    if (forms === undefined || typeof forms.whileServed !== 'function') {
			      // 没有 settings 服务：插件仍工作（用默认配色），只是不能配置。
			      failures.push({
			        where: 'settings:no-config-forms',
			        message: 'configForms service is unavailable; settings card not registered',
			        stack: '',
			      });
			      return;
			    }

			    ctx.effect(() => forms.whileServed([SETTINGS_NAMESPACE], () => {
			      let scope;
			      try {
			        scope = forms.get(SETTINGS_NAMESPACE);
			      } catch (error) {
			        failures.push({ where: 'settings:get', message: String(error?.message ?? error), stack: '' });
			        return () => {};
			      }

			      // 配置变化 → 重新渲染样式。
			      const sync = () => {
			        try {
			          current = readConfig(scope.getSnapshot());
			          renderFromConfig(current);
			        } catch (error) {
			          failures.push({ where: 'settings:sync', message: String(error?.message ?? error), stack: '' });
			        }
			      };
			      let unsubscribe;
			      try {
			        unsubscribe = scope.subscribe(sync);
			      } catch (error) {
			        failures.push({ where: 'settings:subscribe', message: String(error?.message ?? error), stack: '' });
			      }
			      sync();

			      // 设置卡片（插件详情页）。
			      const face = createSettingsFace({
			        scope,
			        t,
			        onError: (where, error) => {
			          failures.push({ where, message: String(error?.message ?? error), stack: '' });
			        },
			      });
			      const offCard = registerCard(ctx, failures, t, face, scope);

			      return () => {
			        try {
			          unsubscribe?.();
			        } catch {
			          // 忽略。
			        }
			        face.dispose();
			        offCard?.();
			      };
			    }), `${PLUGIN_ID}: settings namespace`);
			  });

			  // ── 5. 写启动报告（无论成败；ok:false 会列出失败步骤） ──────────
			  guard(failures, 'boot-report', () => {
			    writeBootReport(failures, { inject: inject.join(',') });
			  });
			}

			/**
			 * 注册设置卡片到「插件详情页」。
			 *
			 * ⚠️ 插槽名是 `plugins.item`（插件配置卡片），**不是** `settings.section`。
			 * 用户路径：侧栏「插件」→ 找到本插件 → 在里面配色。
			 * 也**不是** `settings.plugin.item`（内核全库 0 命中，那个名字不存在）。
			 *
			 * `id` 必须自有：list 槽的去重键是 id，复用别人的会顶掉对方。
			 *
			 * @param ctx 客户端上下文。
			 * @param failures 失败收集器。
			 * @param t 文案函数。
			 * @param face 设置面。
			 * @param scope settings scope（用于提供 SettingsForm 的 state）。
			 * @returns disposer。
			 */
			function registerCard(ctx, failures, t, face, scope) {
			  try {
			    return ctx.slots.register({
			      name: 'plugins.item',
			      id: CARD_ID,
			      order: 60,
			      label: () => t('cardTitle'),
			      locale: LOCALE_NS,
			      inject: () => ({
			        t,
			        buildCss: face.buildCss,
			        setDraft: face.setDraft,
			        useDraft: face.useDraft,
			        formState: face.formState,
			        onSave: () => { void face.save(); },
			        onDiscard: () => face.discard(),
			      }),
			    }, ColorfulCommandsCard);
			  } catch (error) {
			    failures.push({
			      where: 'settings:register-card',
			      message: String(error?.message ?? error),
			      stack: error instanceof Error ? String(error.stack ?? '').slice(0, 2000) : '',
			    });
			    return undefined;
			  }
			}

			Object.assign(__exports, { "inject": inject, "applyStylesheet": applyStylesheet, "renderFromConfig": renderFromConfig, "apply": apply });
		});
		var __entry = __dshRequire("client.js");
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		exports.apply = __entry.apply;
		exports.inject = __entry.inject ?? [];
		return module.exports;
	},
});
