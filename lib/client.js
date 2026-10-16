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

			/** 注入样式标签的标识，卸载/HMR 时据此移除。 */
			const STYLE_TAG_ID = 'dsh-colorful-commands';

			/** 内置预设 id。 */
			const PRESET_NONE = 'none';
			const PRESET_CHINESE = 'chinese';
			const PRESET_JAPANESE = 'japanese';
			const PRESET_MACARON = 'macaron';

			/**
			 * 预设显示顺序。
			 *
			 * ⚠️ 删掉了旧的 `custom`：它和 `none` **行为完全相同**（都不铺预设），
			 * 界面上却多一个选项，用户分不清两者区别。自定义能力本来就在每个类别的
			 * 取色器里，不需要单独一个"预设"来代表它。
			 */
			const PRESETS = [PRESET_CHINESE, PRESET_JAPANESE, PRESET_MACARON, PRESET_NONE];

			/**
			 * 着色类别（内容行）。
			 *
			 * 每个类别对应一组稳定的 DOM 钩子（见 `classify.js`），互不重叠。
			 *
			 * ⚠️ **曾经有 `user` / `assistant` 两类，已删除。** 原因（实测）：
			 * `data-chat-flow-kind="user"` 挂在**整列宽**的 flowItem 包裹层上，而气泡本体
			 * 在内部靠右 —— 给它加左侧竖条会被画到窗口最左缘，与内容完全脱节，非常难看。
			 * 而且这两类也不在需求里（要的是思考/命令/文件这类**过程行**）。
			 */
			const CATEGORIES = [
			  'thinking',
			  'commandLow',
			  'commandMid',
			  'commandHigh',
			  'read',
			  'write',
			  'search',
			  'web',
			  'retry',
			  'compaction',
			  'other',
			];

			/**
			 * UI 控件类别。
			 *
			 * 与内容行分开列，是因为两者的选择器机制不同：
			 * - 内容行靠 `[data-tool]` / `[data-variant]` / `[data-kind]` 命中；
			 * - 控件靠 `[data-slot="<槽名>"]` 命中**插槽锚点**（`ui-renderer` 的
			 *   `renderSlot` 稳定契约）。
			 *
			 * ⚠️ **`ctl-toolbar` 已删除**：它命中 `conversation.input.left/right/dock/overlay`，
			 * 而这些槽里装的是**加号按钮、斜杠命令触发器等原生控件**。给它们上色会波及
			 * 弹出的斜杠命令菜单（实测截图里菜单项被涂成灰色，非常难看），且这些按钮本来
			 * 就有清晰的语义配色，不需要我们插手。控件类只保留**有明确语义**的那几个。
			 */
			const CONTROL_CATEGORIES = [
			  'ctl-permission',
			  'ctl-plan',
			];

			/**
			 * 权限等级 → 类别。
			 *
			 * ⚠️ 用户明确要求「不同权限等级的颜色应该不同」。DSH 的四个预设（实测
			 * `dsh-client-ui-permission-presets` 的 `PRESET_LABEL_KEYS`）：
			 *
			 * | 机器值 | 中文 | 语义 |
			 * |---|---|---|
			 * | `read-only` | 仅可查看 | 最安全 |
			 * | `workspace-write` | 工作区内修改 | 中等 |
			 * | `danger-full-access` | 完全权限 | 危险 |
			 * | `auto` | Auto review | 实验/最高风险 |
			 *
			 * 这四个值写在**按钮的 `aria-label`/文本**里（`PermissionSelect` 的 trigger
			 * 文本就是当前预设的中文 label），所以运行时按文本判定，不需要读 React 状态。
			 */
			const PERMISSION_LEVELS = {
			  '仅可查看': 'perm-readonly',
			  'Read Only': 'perm-readonly',
			  '工作区内修改': 'perm-workspace',
			  'Workspace Write': 'perm-workspace',
			  '完全权限': 'perm-full',
			  'Full access': 'perm-full',
			  'Auto review': 'perm-auto',
			};

			/** 全部可配置类别（内容 + 控件）。设置卡片按这个顺序渲染。 */
			/**
			 * 重试行的类别。
			 *
			 * ⚠️ 用户反馈「重试模型请求也没有上色」。根因：内核的 `ModelRetryItem` 渲染的是
			 * `<details class="<hash>_retryRow" data-active>` —— 它**只有一个 `data-active`**，
			 * 没有任何语义化的 `data-*` 钩子，所以第一版完全没覆盖它。
			 * 唯一稳定的线索是 CSS Module 的**类名后缀** `_retryRow`（前缀哈希每次构建会变，
			 * 后缀是源码类名，稳定）。因此单独给它一类。
			 */
			const CATEGORY_RETRY = 'retry';

			/**
			 * 上下文压缩行的类别。
			 *
			 * ⚠️ 用户反馈「上下文压缩没有上色」。根因：内核 `CompactionItem` 渲染的是
			 * `<div class="<hash>_compactionRow"><button class="<hash>_compactionButton">`，
			 * **没有任何语义化 `data-*` 钩子**（只有 `data-compaction-icon` 在图标上），
			 * 所以既有的属性选择器一个都匹配不到它。
			 */
			const CATEGORY_COMPACTION = 'compaction';

			/** 权限等级类别（用户要求"不同权限等级的颜色应该不同"）。 */
			const PERMISSION_CATEGORIES = [
			  'perm-readonly',
			  'perm-workspace',
			  'perm-full',
			  'perm-auto',
			];

			const ALL_CATEGORIES = [
			  ...CATEGORIES,
			  ...CONTROL_CATEGORIES,
			  ...PERMISSION_CATEGORIES,
			];

			/** 类别的中文名（内置兜底；界面文案走 locale 字典）。 */
			const CATEGORY_LABELS = {
			  thinking: '思考 / 推理',
			  commandLow: '命令 · 低风险',
			  commandMid: '命令 · 中风险',
			  commandHigh: '命令 · 高风险',
			  read: '读取文件',
			  write: '写入 / 编辑',
			  search: '搜索',
			  web: '网络请求',
			  retry: '重试模型请求',
			  compaction: '上下文压缩',
			  other: '其他工具',
			  'ctl-permission': '权限选择',
			  'ctl-plan': '计划模式',
			  'perm-readonly': '权限 · 仅可查看',
			  'perm-workspace': '权限 · 工作区内修改',
			  'perm-full': '权限 · 完全权限',
			  'perm-auto': '权限 · Auto review',
			};

			/**
			 * 命令风险等级的词表。
			 *
			 * 三级，**从高到低**匹配：先看 `HIGH`，再看 `MID`，都不命中就是 `LOW`。
			 *
			 * ⚠️ 这是本插件唯一"猜"的地方，判错**只影响颜色**：本插件不执行、不拦截、
			 * 不改变任何命令的行为。所以刻意保持简单可读的包含匹配，不引入 shell 解析器
			 * —— 我们不解析命令，只按"这段文本里有没有这些危险迹象"上色。
			 *
			 * `HIGH`：不可逆或影响整机 —— 删盘、抹设备、格式化、改分区、强推、掉库。
			 * `MID`：影响面可控但需留意 —— 提权、杀进程、改权限属主、网络下载执行、
			 *        版本控制破坏性操作、包发布。
			 */
			const DANGER_HIGH = [
			  'rm -rf /',
			  'rm -rf /*',
			  'rm -fr /',
			  'mkfs',
			  'wipefs',
			  'fdisk',
			  'parted ',
			  'dd if=',
			  'dd of=/dev/',
			  '> /dev/sd',
			  '> /dev/nvme',
			  'shutdown',
			  'reboot',
			  'poweroff',
			  'halt',
			  ':(){',
			  'chmod -R 777 /',
			  'DROP DATABASE',
			  'DROP TABLE',
			  'TRUNCATE TABLE',
			  'git push --force',
			  'git push -f',
			  'git filter-branch',
			  'GIT RESET --HARD',
			];

			const DANGER_MID = [
			  'sudo ',
			  'doas ',
			  'su -',
			  'kill -9',
			  'killall',
			  'pkill',
			  'chown -R',
			  'chmod 777',
			  'chmod -R',
			  'curl ',
			  'wget ',
			  'npm publish',
			  'pnpm publish',
			  'yarn publish',
			  'cargo publish',
			  'pip install',
			  'npm i -g',
			  'npm install -g',
			  'git reset --hard',
			  'git clean -fd',
			  'git checkout -- .',
			  'git branch -D',
			  'docker rm',
			  'docker rmi',
			  'systemctl ',
			  'service ',
			  'mount ',
			  'umount ',
			  'iptables',
			  'nft ',
			  'ufw ',
			  'userdel',
			  'groupdel',
			  'passwd ',
			  'crontab ',
			  'systemd',
			  '> /etc/',
			  '>> /etc/',
			  'truncate ',
			];

			/**
			 * 判定命令文本的风险等级。
			 *
			 * @param text 命令文本（表头摘要即可；可能为空/undefined）。
			 * @returns `'high'` | `'mid'` | `'low'`。
			 */
			function commandRisk(text) {
			  if (typeof text !== 'string' || text === '') return 'low';
			  const upper = text.toUpperCase();
			  for (const pattern of DANGER_HIGH) {
			    if (upper.includes(pattern.toUpperCase())) return 'high';
			  }
			  for (const pattern of DANGER_MID) {
			    if (upper.includes(pattern.toUpperCase())) return 'mid';
			  }
			  return 'low';
			}

			/**
			 * 过程组标题里「标签」与「详情」的分隔符。
			 *
			 * 内核 `ui-chat` 的 `ProcessGroupHeader`（实测）：
			 *
			 * ```js
			 * const title = detail === "" ? label : `${label}${t("message.turnProcess.separator")}${detail}`;
			 * ```
			 *
			 * `t("message.turnProcess.separator")` 的中英文取值都是 `" · "`。`detail` 就是
			 * **模型的实时分析正文**（`summary.runningDetail`，推理阶段即分析文本本身）。
			 *
			 * ⚠️ 用户反馈「发送 prompt 后的模型分析，除了 tag，分析正文也被错误地上色了」——
			 * 根因正是标签与正文处在**同一个文本节点**里，CSS 无法只染标签。所以运行时
			 * 用这个分隔符判断"该标题是否带正文"：带正文时**只染图标**，不染文字。
			 */
			const TITLE_SEPARATOR = ' · ';

			/** 合法十六进制颜色（#RGB / #RRGGBB）。 */
			const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

			Object.assign(__exports, { "PLUGIN_ID": PLUGIN_ID, "SETTINGS_NAMESPACE": SETTINGS_NAMESPACE, "LOCALE_NS": LOCALE_NS, "STYLE_TAG_ID": STYLE_TAG_ID, "PRESET_NONE": PRESET_NONE, "PRESET_CHINESE": PRESET_CHINESE, "PRESET_JAPANESE": PRESET_JAPANESE, "PRESET_MACARON": PRESET_MACARON, "PRESETS": PRESETS, "CATEGORIES": CATEGORIES, "CONTROL_CATEGORIES": CONTROL_CATEGORIES, "PERMISSION_LEVELS": PERMISSION_LEVELS, "CATEGORY_RETRY": CATEGORY_RETRY, "CATEGORY_COMPACTION": CATEGORY_COMPACTION, "PERMISSION_CATEGORIES": PERMISSION_CATEGORIES, "ALL_CATEGORIES": ALL_CATEGORIES, "CATEGORY_LABELS": CATEGORY_LABELS, "DANGER_HIGH": DANGER_HIGH, "DANGER_MID": DANGER_MID, "commandRisk": commandRisk, "TITLE_SEPARATOR": TITLE_SEPARATOR, "HEX_RE": HEX_RE });
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
			  categoryCommandLow: '命令 · 低风险',
			  categoryCommandMid: '命令 · 中风险',
			  categoryCommandHigh: '命令 · 高风险',
			  categoryRead: '读取文件',
			  categoryWrite: '写入 / 编辑',
			  categorySearch: '搜索',
			  categoryWeb: '网络请求',
			  categoryRetry: '重试模型请求',
			  categoryCompaction: '上下文压缩',
			  categoryOther: '其他工具',

			  permissionsTitle: '权限等级',
			  permissionsHint: '权限选择控件会按当前等级自动取这里的颜色 —— 四个等级各不相同。',
			  controlsTitle: '界面控件',
			  controlsHint: '输入框附近的控件。权限选择按当前等级自动变色，不用单独配。',
			  categoryCtlPermission: '权限选择（未识别等级）',
			  categoryCtlPlan: '计划模式',
			  categoryPermReadonly: '权限 · 仅可查看',
			  categoryPermWorkspace: '权限 · 工作区内修改',
			  categoryPermFull: '权限 · 完全权限',
			  categoryPermAuto: '权限 · Auto review',

			  presetNone: '不预设（命令与权限仍按等级上色）',
			  presetChinese: '中国传统色',
			  presetJapanese: '日本传统色',
			  presetMacaron: '马卡龙色系',
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
			  categoryCommandLow: 'Command · low risk',
			  categoryCommandMid: 'Command · medium risk',
			  categoryCommandHigh: 'Command · high risk',
			  categoryRead: 'File reads',
			  categoryWrite: 'Writes / edits',
			  categorySearch: 'Search',
			  categoryWeb: 'Web requests',
			  categoryRetry: 'Model request retry',
			  categoryCompaction: 'Context compaction',
			  categoryOther: 'Other tools',

			  permissionsTitle: 'Permission levels',
			  permissionsHint: 'The permission select recolors itself per level using these four colors.',
			  controlsTitle: 'Interface controls',
			  controlsHint: 'Controls near the composer. The permission select recolors itself per level; no separate setting needed.',
			  categoryCtlPermission: 'Permission select (unknown level)',
			  categoryCtlPlan: 'Plan mode',
			  categoryPermReadonly: 'Permission · Read only',
			  categoryPermWorkspace: 'Permission · Workspace write',
			  categoryPermFull: 'Permission · Full access',
			  categoryPermAuto: 'Permission · Auto review',

			  presetNone: 'None (commands & permissions stay graded)',
			  presetChinese: 'Chinese traditional',
			  presetJapanese: 'Japanese traditional',
			  presetMacaron: 'Macaron',
			};

			/** 每个类别 id → 文案键。 */
			const CATEGORY_KEYS = {
			  thinking: 'categoryThinking',
			  commandLow: 'categoryCommandLow',
			  commandMid: 'categoryCommandMid',
			  commandHigh: 'categoryCommandHigh',
			  read: 'categoryRead',
			  write: 'categoryWrite',
			  search: 'categorySearch',
			  web: 'categoryWeb',
			  retry: 'categoryRetry',
			  compaction: 'categoryCompaction',
			  other: 'categoryOther',
			  'ctl-permission': 'categoryCtlPermission',
			  'ctl-plan': 'categoryCtlPlan',
			  'perm-readonly': 'categoryPermReadonly',
			  'perm-workspace': 'categoryPermWorkspace',
			  'perm-full': 'categoryPermFull',
			  'perm-auto': 'categoryPermAuto',
			};

			/** 预设 id → 文案键。 */
			const PRESET_KEYS = {
			  none: 'presetNone',
			  chinese: 'presetChinese',
			  japanese: 'presetJapanese',
			  macaron: 'presetMacaron',
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

			/**
			 * 属性名：把过程组标题**切分**后，标记"这一段是标签"。
			 *
			 * 见 `dom.js` 的 `splitTitleLabel`：内核把「标签 + `' · '` + 详情」拼成同一个
			 * 文本节点，CSS 无法只染标签。运行时把标签切出来单独包一层带本属性的 `span`，
			 * 样式层就能只染标签、不染详情。
			 */
			const PART_ATTR = 'data-cc-part';

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
			 * | `title` | 过程组标题，**没有**详情（纯标签） | 该按钮的图标 + 整段标签文字 |
			 * | `title-part` | 过程组标题，**有**详情 | 该按钮的图标 + **只染切出来的标签段** |
			 * | `self` | bash 工具行、轨迹视图行 | 图标 + 短标签 |
			 * | `tint` | UI 控件（权限/计划） | 图标**与文字**上色 |
			 *
			 * ⚠️ 为什么"有详情"要单独一个作用域，而不是用 `:has()` 兜底：
			 * 用 `[class*="_label"]:not(:has([data-cc-part]))` 看似省事，但它会在
			 * **切分被 React 重渲染冲掉的那一帧**重新匹配上整段标题 —— 于是正文被整段染色，
			 * 下一帧再切回来，视觉上就是**闪烁**（用户实测反馈过"正文的上色是闪烁的"）。
			 * 拆成两个显式作用域后，有详情的元素永远只认 `[data-cc-part]`：
			 * 切分短暂失效时表现为"标签那一瞬间没颜色"，而不是"正文被染色"。
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
			  // 有详情的过程组标题：只染运行时切出来的标签段（见 dom.js 的 splitTitleLabel）。
			  const partScope = `${p}${sel}[${SCOPE_ATTR}="title-part"]`;
			  const self = `${p}${sel}[${SCOPE_ATTR}="self"]`;
			  const tint = `${p}${sel}[${SCOPE_ATTR}="tint"]`;
			  /**
			   * 纯文字行（重试模型请求 / 上下文压缩）。
			   *
			   * ⚠️ 这两行只有 CSS Module 类名可认（内核没给语义化属性），而且它们的**状态文字
			   * 是普通 `<span>`**：
			   *
			   * ```jsx
			   * <details class="…_retryRow">
			   *   <summary class="…_retrySummary">
			   *     <span class="…_retryText" role="status">已重试模型请求（1/5）</span>
			   *   </summary>
			   *   <div class="…_retryDetails">…</div>   ← 延迟/失败原因，属于详情
			   * </details>
			   * ```
			   *
			   * 落到 `tint`（只匹配 `:is(button,[role="button"],a)`）会**一条都命不中**，
			   * 表现就是用户看到的"打了标却没颜色"。这里直接命中状态文字那个 span，
			   * 并且**不碰 `_retryDetails`** —— 详情保持原生灰色，符合"标签有色、详情原样"。
			   */
			  const plain = `${p}${sel}[${SCOPE_ATTR}="plain"]`;

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
			    //    无详情（纯标签）时整段染；有详情时只染切出来的标签段。
			    `${titleScope} [class*="_label"]{color:${color}}`,
			    //    ⚠️ `title-part` **必须也有 svg 规则**。漏掉它的后果是：带详情的标题
			    //    文字有色、**图标还是灰的**（用户截图直接指出："文字是上色了 图标没有"）。
			    //    背景：`title` 分支有 svg 规则、`title-part` 分支最初只写了 label 规则，
			    //    而这两个作用域在 CSS 里是**互斥**的 —— 有详情的元素永远不匹配 `title`，
			    //    所以它的图标拿不到任何颜色。
			    `${partScope} svg{color:${color}}`,
			    `${partScope} [${PART_ATTR}="label"]{color:${color}}`,

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

			    // ⑤ 纯文字行（重试 / 压缩）：图标 + 状态文字。
			    //    只命中状态文字与按钮，**不命中 `_retryDetails`** —— 详情保持原生配色。
			    //
			    //    `_title` / `_summary` 是为**进行中的压缩行**加的：它走
			    //    `GenericCommandCard`（标准 DisclosureRow），标题是 `compact`、
			    //    状态文字 `正在压缩…` 在 `_summary` 里。只染 `_title` 的话，
			    //    "正在压缩…" 仍然是灰的 —— 用户看到的还是"压缩中没有上色"。
			    //    （已完成的压缩行两个 class 是 `_compactionTitle`/`_compactionSummary`，
			    //      由 `_compactionButton` 整片覆盖，不受这两条影响。）
			    `${plain} svg{color:${color}}`,
			    `${plain} :is([class*="_retryText"],[class*="_compactionButton"],[class*="_title"],[class*="_summary"],summary){color:${color}}`,
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

			Object.assign(__exports, { "CAT_ATTR": CAT_ATTR, "MARK_ATTR": MARK_ATTR, "SCOPE_ATTR": SCOPE_ATTR, "PART_ATTR": PART_ATTR, "sanitizeColor": sanitizeColor, "buildStylesheet": buildStylesheet, "resolveColors": resolveColors, "scopedPreviewCss": scopedPreviewCss });
		});
		__dshRegistry.set("data/chinese-colors.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— 中国传统色全量色库（742 色）。
			 *
			 * ## 数据来源（照实标注，不是我编的）
			 *
			 * 取自开源项目 **nevertoday/zhongguo-traditional-colors**（GPL-3.0）：
			 *   <https://github.com/nevertoday/zhongguo-traditional-colors>
			 *   文件：`assets/data/harmonies.js`（由该仓库 `scripts/build-color-harmonies.mjs` 生成）
			 * 该仓库也是 <https://colors.xiaoxiaodong.ai> 的数据源。
			 *
			 * 抓取时（2026-10-16）核实的上游状态：**1211 stars、最后提交 2026-09-16、
			 * 未归档**，符合"上游仍在维护"的硬性要求。
			 *
			 * ## 为什么把整库打进来而不是手写十几个色值
			 *
			 * 手写十几个色值有两个毛病：
			 *  1. **无法保证可读性** —— 同一个色值不可能在白底和深底都可读；
			 *  2. **加一个类别就要我手工挑色**，容易挑出"看着像但不是那个色系"的值。
			 *
			 * 所以这里只存数据，**挑色逻辑放在 `palettes.js`**：按语义色相 + 对真实宿主
			 * 背景的对比度自动选 light/dark 两值。宿主改主题色时只需改那一处阈值。
			 *
			 * 字段：n=色名，x=hex，h=hue(0-360)，s=饱和度(0-100)，l=亮度(0-100)。
			 *
			 * @module dsh-colorful-commands/data/chinese-colors
			 */

			/** 742 色全量色库。 */
			const CHINESE_COLORS = [{"n":"瓜瓤粉","x":"#F9CB8B","h":35,"s":90,"l":76},{"n":"蜜黄","x":"#FBB957","h":36,"s":95,"l":66},{"n":"金叶黄","x":"#FFA60F","h":38,"s":100,"l":53},{"n":"金莺黄","x":"#F4A83A","h":35,"s":89,"l":59},{"n":"鹿角棕","x":"#E3BD8D","h":33,"s":61,"l":72},{"n":"凋叶棕","x":"#E7A23F","h":35,"s":78,"l":58},{"n":"玳瑁黄","x":"#DAA45A","h":35,"s":63,"l":60},{"n":"软木黄","x":"#DE9E44","h":35,"s":70,"l":57},{"n":"风帆黄","x":"#DC9123","h":36,"s":73,"l":50},{"n":"桂皮淡棕","x":"#C09351","h":36,"s":47,"l":54},{"n":"猴毛灰","x":"#97846C","h":33,"s":17,"l":51},{"n":"山鸡褐","x":"#986524","h":34,"s":62,"l":37},{"n":"驼色","x":"#66462A","h":28,"s":42,"l":28},{"n":"茶褐","x":"#5D3D21","h":28,"s":48,"l":25},{"n":"古铜褐","x":"#5C3719","h":27,"s":57,"l":23},{"n":"荷花白","x":"#FBECDE","h":29,"s":78,"l":93},{"n":"玫瑰粉","x":"#F8B37F","h":26,"s":90,"l":74},{"n":"橘橙","x":"#F97D1C","h":26,"s":95,"l":54},{"n":"美人焦橙","x":"#FA7E23","h":25,"s":96,"l":56},{"n":"润红","x":"#F7CDBC","h":17,"s":79,"l":85},{"n":"淡桃红","x":"#F6CEC1","h":15,"s":75,"l":86},{"n":"海螺橙","x":"#F0945D","h":22,"s":83,"l":65},{"n":"桃红","x":"#F0ADA0","h":10,"s":73,"l":78},{"n":"颊红","x":"#EEAA9C","h":10,"s":71,"l":77},{"n":"淡罂粟红","x":"#EEA08C","h":12,"s":74,"l":74},{"n":"晨曦红","x":"#EA8958","h":20,"s":78,"l":63},{"n":"蟹壳红","x":"#F27635","h":21,"s":88,"l":58},{"n":"金莲花橙","x":"#F86B1D","h":21,"s":94,"l":54},{"n":"草莓红","x":"#EF6F48","h":14,"s":84,"l":61},{"n":"龙睛鱼红","x":"#EF632B","h":17,"s":86,"l":55},{"n":"蜻蜓红","x":"#F1441D","h":11,"s":88,"l":53},{"n":"大红","x":"#F04B22","h":12,"s":87,"l":54},{"n":"柿红","x":"#F2481B","h":13,"s":89,"l":53},{"n":"榴花红","x":"#F34718","h":13,"s":90,"l":52},{"n":"银朱","x":"#F43E06","h":14,"s":95,"l":49},{"n":"朱红","x":"#ED5126","h":13,"s":85,"l":54},{"n":"鲑鱼红","x":"#F09C5A","h":26,"s":83,"l":65},{"n":"金黄","x":"#F26B1F","h":22,"s":89,"l":54},{"n":"鹿皮褐","x":"#D99156","h":27,"s":63,"l":59},{"n":"醉瓜肉","x":"#DB8540","h":27,"s":68,"l":55},{"n":"麂棕","x":"#DE7622","h":27,"s":74,"l":50},{"n":"淡银灰","x":"#C1B2A3","h":30,"s":19,"l":70},{"n":"淡赭","x":"#BE7E4A","h":27,"s":47,"l":52},{"n":"槟榔综","x":"#C1651A","h":27,"s":76,"l":43},{"n":"银灰","x":"#918072","h":27,"s":12,"l":51},{"n":"海鸥灰","x":"#9A8878","h":28,"s":14,"l":54},{"n":"淡咖啡","x":"#945833","h":23,"s":49,"l":39},{"n":"岩石棕","x":"#964D22","h":22,"s":63,"l":36},{"n":"芒果棕","x":"#954416","h":22,"s":74,"l":34},{"n":"石板灰","x":"#624941","h":15,"s":20,"l":32},{"n":"珠母灰","x":"#64483D","h":17,"s":24,"l":32},{"n":"丁香棕","x":"#71361D","h":18,"s":59,"l":28},{"n":"咖啡","x":"#753117","h":17,"s":67,"l":27},{"n":"筍皮棕","x":"#732E12","h":17,"s":73,"l":26},{"n":"燕颔红","x":"#FC6315","h":20,"s":97,"l":54},{"n":"玉粉红","x":"#E8B49A","h":20,"s":63,"l":76},{"n":"金驼","x":"#E46828","h":20,"s":78,"l":53},{"n":"铁棕","x":"#D85916","h":21,"s":82,"l":47},{"n":"蛛网灰","x":"#B7A091","h":24,"s":21,"l":64},{"n":"淡可可棕","x":"#B7511D","h":20,"s":73,"l":42},{"n":"中红灰","x":"#8B614D","h":19,"s":29,"l":42},{"n":"淡土黄","x":"#8C4B31","h":17,"s":48,"l":37},{"n":"淡豆沙","x":"#873D24","h":15,"s":58,"l":34},{"n":"椰壳棕","x":"#883A1E","h":16,"s":64,"l":33},{"n":"淡铁灰","x":"#5B423A","h":15,"s":22,"l":29},{"n":"中灰驼","x":"#603D30","h":16,"s":33,"l":28},{"n":"淡栗棕","x":"#673424","h":14,"s":48,"l":27},{"n":"可可棕","x":"#652B1C","h":12,"s":57,"l":25},{"n":"柞叶棕","x":"#692A1B","h":12,"s":59,"l":26},{"n":"野蔷薇红","x":"#FB9968","h":20,"s":95,"l":70},{"n":"菠萝红","x":"#FC7930","h":21,"s":97,"l":59},{"n":"藕荷","x":"#EDC3AE","h":20,"s":64,"l":81},{"n":"陶瓷红","x":"#E16723","h":21,"s":76,"l":51},{"n":"晓灰","x":"#D4C4B7","h":27,"s":25,"l":77},{"n":"余烬红","x":"#CF7543","h":21,"s":59,"l":54},{"n":"火砖红","x":"#CD6227","h":21,"s":68,"l":48},{"n":"火泥棕","x":"#AA6A4C","h":19,"s":38,"l":48},{"n":"绀红","x":"#A6522C","h":19,"s":58,"l":41},{"n":"橡树棕","x":"#773D31","h":10,"s":42,"l":33},{"n":"海报灰","x":"#483332","h":3,"s":18,"l":24},{"n":"玫瑰灰","x":"#4B2E2B","h":6,"s":27,"l":23},{"n":"火山棕","x":"#482522","h":5,"s":36,"l":21},{"n":"豆沙","x":"#481E1C","h":3,"s":44,"l":20},{"n":"淡米粉","x":"#FBEEE2","h":29,"s":76,"l":94},{"n":"初桃粉红","x":"#F6DCCE","h":21,"s":69,"l":89},{"n":"介壳淡粉红","x":"#F7CFBA","h":21,"s":79,"l":85},{"n":"淡藏花红","x":"#F6AD8F","h":17,"s":85,"l":76},{"n":"瓜瓤红","x":"#F68C60","h":18,"s":89,"l":67},{"n":"芙蓉红","x":"#F9723D","h":17,"s":94,"l":61},{"n":"莓酱红","x":"#FA5D19","h":18,"s":96,"l":54},{"n":"法螺红","x":"#EE8055","h":17,"s":82,"l":63},{"n":"落霞红","x":"#CF4813","h":17,"s":83,"l":44},{"n":"淡玫瑰灰","x":"#B89485","h":18,"s":26,"l":62},{"n":"蟹蝥红","x":"#B14B28","h":15,"s":63,"l":43},{"n":"火岩棕","x":"#863020","h":9,"s":61,"l":33},{"n":"赭石","x":"#862617","h":8,"s":71,"l":31},{"n":"暗驼棕","x":"#592620","h":6,"s":47,"l":24},{"n":"酱棕","x":"#5A1F1B","h":4,"s":54,"l":23},{"n":"栗棕","x":"#5C1E19","h":4,"s":57,"l":23},{"n":"洋水仙红","x":"#F4C7BA","h":13,"s":73,"l":84},{"n":"谷鞘红","x":"#F17666","h":7,"s":83,"l":67},{"n":"苹果红","x":"#F15642","h":7,"s":86,"l":60},{"n":"铁水红","x":"#F5391C","h":8,"s":92,"l":54},{"n":"桂红","x":"#F25A47","h":7,"s":87,"l":61},{"n":"极光红","x":"#F33B1F","h":8,"s":90,"l":54},{"n":"粉红","x":"#F2B9B2","h":7,"s":71,"l":82},{"n":"舌红","x":"#F19790","h":4,"s":78,"l":75},{"n":"曲红","x":"#F05A46","h":7,"s":85,"l":61},{"n":"红汞红","x":"#F23E23","h":8,"s":89,"l":54},{"n":"淡绯","x":"#F2CAC9","h":1,"s":61,"l":87},{"n":"无花果红","x":"#EFAFAD","h":2,"s":67,"l":81},{"n":"榴子红","x":"#F1908C","h":2,"s":78,"l":75},{"n":"胭脂红","x":"#F03F24","h":8,"s":87,"l":54},{"n":"合欢红","x":"#F0A1A8","h":355,"s":72,"l":79},{"n":"春梅红","x":"#F1939C","h":354,"s":77,"l":76},{"n":"香叶红","x":"#F07C82","h":357,"s":79,"l":71},{"n":"珊瑚红","x":"#F04A3A","h":5,"s":86,"l":58},{"n":"萝卜红","x":"#F13C22","h":8,"s":88,"l":54},{"n":"淡茜红","x":"#E77C8E","h":350,"s":69,"l":70},{"n":"艳红","x":"#ED5A65","h":356,"s":80,"l":64},{"n":"淡菽红","x":"#ED4845","h":1,"s":82,"l":60},{"n":"鱼鳃红","x":"#ED3B2F","h":4,"s":84,"l":56},{"n":"樱桃红","x":"#ED3321","h":5,"s":85,"l":53},{"n":"淡蕊香红","x":"#EE4866","h":349,"s":83,"l":61},{"n":"石竹红","x":"#EE4863","h":350,"s":83,"l":61},{"n":"草茉莉红","x":"#EF475D","h":352,"s":84,"l":61},{"n":"茶花红","x":"#EE3F4D","h":355,"s":84,"l":59},{"n":"枸枢红","x":"#ED3333","h":0,"s":84,"l":56},{"n":"秋海棠红","x":"#EC2B24","h":2,"s":84,"l":53},{"n":"丽春红","x":"#EB261A","h":3,"s":84,"l":51},{"n":"夕阳红","x":"#DE2A18","h":5,"s":80,"l":48},{"n":"鹤顶红","x":"#D42517","h":4,"s":80,"l":46},{"n":"鹅血石红","x":"#AB372F","h":4,"s":57,"l":43},{"n":"覆盆子红","x":"#AC1F18","h":3,"s":76,"l":38},{"n":"貂紫","x":"#5D3131","h":0,"s":31,"l":28},{"n":"暗玉紫","x":"#5C2223","h":359,"s":46,"l":25},{"n":"栗紫","x":"#5A191B","h":358,"s":57,"l":23},{"n":"葡萄酱紫","x":"#5A1216","h":357,"s":67,"l":21},{"n":"牡丹粉红","x":"#EEA2A4","h":358,"s":69,"l":78},{"n":"山茶红","x":"#ED556A","h":352,"s":81,"l":63},{"n":"海棠红","x":"#F03752","h":351,"s":86,"l":58},{"n":"玉红","x":"#C04851","h":356,"s":49,"l":52},{"n":"高粱红","x":"#C02C38","h":355,"s":63,"l":46},{"n":"满江红","x":"#A7535A","h":355,"s":34,"l":49},{"n":"枣红","x":"#7C1823","h":353,"s":68,"l":29},{"n":"葡萄紫","x":"#4C1F24","h":353,"s":42,"l":21},{"n":"酱紫","x":"#4D1018","h":352,"s":66,"l":18},{"n":"淡曙红","x":"#EE2746","h":351,"s":85,"l":54},{"n":"唐菖蒲红","x":"#DE1C31","h":354,"s":78,"l":49},{"n":"鹅冠红","x":"#D11A2D","h":354,"s":78,"l":46},{"n":"莓红","x":"#C45A65","h":354,"s":47,"l":56},{"n":"枫叶红","x":"#C21F30","h":354,"s":72,"l":44},{"n":"苋菜红","x":"#A61B29","h":354,"s":72,"l":38},{"n":"烟红","x":"#894E54","h":354,"s":27,"l":42},{"n":"暗紫苑红","x":"#82202B","h":353,"s":60,"l":32},{"n":"殷红","x":"#82111F","h":353,"s":77,"l":29},{"n":"猪肝紫","x":"#541E24","h":353,"s":47,"l":22},{"n":"金鱼紫","x":"#500A16","h":350,"s":78,"l":18},{"n":"草珠红","x":"#F8EBE6","h":17,"s":56,"l":94},{"n":"淡绛红","x":"#EC7696","h":344,"s":76,"l":69},{"n":"品红","x":"#EF3473","h":340,"s":85,"l":57},{"n":"凤仙花红","x":"#EA7293","h":344,"s":74,"l":68},{"n":"粉团花红","x":"#EC9BAD","h":347,"s":68,"l":77},{"n":"夹竹桃红","x":"#EB507E","h":342,"s":79,"l":62},{"n":"榲桲红","x":"#ED2F6A","h":341,"s":84,"l":56},{"n":"姜红","x":"#EEB8C3","h":348,"s":61,"l":83},{"n":"莲瓣红","x":"#EA517F","h":342,"s":78,"l":62},{"n":"水红","x":"#F1C4CD","h":348,"s":62,"l":86},{"n":"报春红","x":"#EC8AA4","h":344,"s":72,"l":73},{"n":"月季红","x":"#CE5777","h":344,"s":55,"l":57},{"n":"豇豆红","x":"#ED9DB2","h":344,"s":69,"l":77},{"n":"霞光红","x":"#EF82A0","h":343,"s":77,"l":72},{"n":"松叶牡丹红","x":"#EB3C70","h":342,"s":81,"l":58},{"n":"喜蛋红","x":"#EC2C64","h":343,"s":83,"l":55},{"n":"鼠鼻红","x":"#E3B4B8","h":355,"s":46,"l":80},{"n":"尖晶玉红","x":"#CC163A","h":348,"s":81,"l":44},{"n":"山黎豆红","x":"#C27C88","h":350,"s":36,"l":62},{"n":"锦葵红","x":"#BF3553","h":347,"s":57,"l":48},{"n":"鼠背灰","x":"#73575C","h":349,"s":14,"l":40},{"n":"甘蔗紫","x":"#621624","h":349,"s":63,"l":24},{"n":"石竹紫","x":"#63071C","h":346,"s":87,"l":21},{"n":"苍蝇灰","x":"#36282B","h":347,"s":15,"l":18},{"n":"卵石紫","x":"#30161C","h":346,"s":37,"l":14},{"n":"李紫","x":"#2B1216","h":350,"s":41,"l":12},{"n":"茄皮紫","x":"#2D0C13","h":347,"s":58,"l":11},{"n":"吊钟花红","x":"#CE5E8A","h":336,"s":53,"l":59},{"n":"兔眼红","x":"#EC4E8A","h":337,"s":81,"l":62},{"n":"紫荆红","x":"#EE2C79","h":336,"s":85,"l":55},{"n":"菜头紫","x":"#951C48","h":338,"s":68,"l":35},{"n":"鹞冠紫","x":"#621D34","h":340,"s":54,"l":25},{"n":"葡萄酒红","x":"#62102E","h":338,"s":72,"l":22},{"n":"磨石紫","x":"#382129","h":339,"s":26,"l":17},{"n":"檀紫","x":"#381924","h":339,"s":38,"l":16},{"n":"火鹅紫","x":"#33141E","h":341,"s":44,"l":14},{"n":"墨紫","x":"#310F1B","h":339,"s":53,"l":13},{"n":"晶红","x":"#EEA6B7","h":346,"s":68,"l":79},{"n":"扁豆花红","x":"#EF498B","h":336,"s":84,"l":61},{"n":"白芨红","x":"#DE7897","h":342,"s":61,"l":67},{"n":"嫩菱红","x":"#DE3F7C","h":337,"s":71,"l":56},{"n":"菠根红","x":"#D13C74","h":337,"s":62,"l":53},{"n":"酢酱草红","x":"#C5708B","h":341,"s":42,"l":61},{"n":"洋葱紫","x":"#A8456B","h":337,"s":42,"l":46},{"n":"海象紫","x":"#4B1E2F","h":337,"s":43,"l":21},{"n":"绀紫","x":"#461629","h":336,"s":52,"l":18},{"n":"古铜紫","x":"#440E25","h":334,"s":66,"l":16},{"n":"石蕊红","x":"#F0C9CF","h":351,"s":57,"l":86},{"n":"芍药耕红","x":"#EBA0B3","h":345,"s":65,"l":77},{"n":"藏花红","x":"#EC2D7A","h":336,"s":83,"l":55},{"n":"初荷红","x":"#E16C96","h":338,"s":66,"l":65},{"n":"马鞭草紫","x":"#EDE3E7","h":336,"s":22,"l":91},{"n":"丁香淡紫","x":"#E9D7DF","h":333,"s":29,"l":88},{"n":"丹紫红","x":"#D2568C","h":334,"s":58,"l":58},{"n":"玫瑰红","x":"#D2357D","h":332,"s":64,"l":52},{"n":"淡牵牛紫","x":"#D1C2D3","h":293,"s":16,"l":79},{"n":"凤信紫","x":"#C8ADC4","h":309,"s":20,"l":73},{"n":"萝兰紫","x":"#C08EAF","h":320,"s":28,"l":65},{"n":"玫瑰紫","x":"#BA2F7B","h":327,"s":60,"l":46},{"n":"藤萝紫","x":"#8076A3","h":253,"s":20,"l":55},{"n":"槿紫","x":"#806D9E","h":263,"s":20,"l":52},{"n":"蕈紫","x":"#815C94","h":280,"s":23,"l":47},{"n":"桔梗紫","x":"#813C85","h":297,"s":38,"l":38},{"n":"魏紫","x":"#7E1671","h":308,"s":70,"l":29},{"n":"芝兰紫","x":"#E9CCD3","h":346,"s":40,"l":86},{"n":"菱锰红","x":"#D276A3","h":331,"s":51,"l":64},{"n":"龙须红","x":"#CC5595","h":328,"s":54,"l":57},{"n":"蓟粉红","x":"#E6D2D5","h":351,"s":29,"l":86},{"n":"电气石红","x":"#C35691","h":328,"s":48,"l":55},{"n":"樱草紫","x":"#C06F98","h":330,"s":39,"l":59},{"n":"芦穗灰","x":"#BDAEAD","h":4,"s":11,"l":71},{"n":"隐红灰","x":"#B598A1","h":341,"s":16,"l":65},{"n":"苋菜紫","x":"#9B1E64","h":326,"s":68,"l":36},{"n":"芦灰","x":"#856D72","h":348,"s":10,"l":47},{"n":"暮云灰","x":"#4F383E","h":344,"s":17,"l":26},{"n":"斑鸠灰","x":"#482936","h":335,"s":27,"l":22},{"n":"淡藤萝紫","x":"#F2E7E5","h":9,"s":33,"l":92},{"n":"淡青紫","x":"#E0C8D1","h":338,"s":28,"l":83},{"n":"青蛤壳紫","x":"#BC84A8","h":321,"s":29,"l":63},{"n":"豆蔻紫","x":"#AD6598","h":318,"s":31,"l":54},{"n":"扁豆紫","x":"#A35C8F","h":317,"s":28,"l":50},{"n":"芥花紫","x":"#983680","h":315,"s":48,"l":40},{"n":"青莲","x":"#8B2671","h":315,"s":57,"l":35},{"n":"芓紫","x":"#894276","h":316,"s":35,"l":40},{"n":"葛巾紫","x":"#7E2065","h":316,"s":59,"l":31},{"n":"牵牛紫","x":"#681752","h":316,"s":64,"l":25},{"n":"紫灰","x":"#5D3F51","h":324,"s":19,"l":31},{"n":"龙睛鱼紫","x":"#4E2A40","h":323,"s":30,"l":24},{"n":"荸荠紫","x":"#411C35","h":319,"s":40,"l":18},{"n":"古鼎灰","x":"#36292F","h":332,"s":14,"l":19},{"n":"乌梅紫","x":"#1E131D","h":305,"s":22,"l":10},{"n":"深牵牛紫","x":"#1C0D1A","h":308,"s":37,"l":8},{"n":"银白","x":"#F1F0ED","h":45,"s":12,"l":94},{"n":"芡食白","x":"#E2E1E4","h":260,"s":5,"l":89},{"n":"远山紫","x":"#CCCCD6","h":240,"s":11,"l":82},{"n":"淡蓝紫","x":"#A7A8BD","h":237,"s":14,"l":70},{"n":"山梗紫","x":"#61649F","h":237,"s":24,"l":50},{"n":"螺甸紫","x":"#74759B","h":238,"s":16,"l":53},{"n":"玛瑙灰","x":"#CFCCC9","h":30,"s":6,"l":80},{"n":"野菊紫","x":"#525288","h":240,"s":25,"l":43},{"n":"满天星紫","x":"#2E317C","h":238,"s":46,"l":33},{"n":"锌灰","x":"#7A7374","h":351,"s":3,"l":46},{"n":"野葡萄紫","x":"#302F4B","h":242,"s":23,"l":24},{"n":"剑锋紫","x":"#3E3841","h":280,"s":7,"l":24},{"n":"龙葵紫","x":"#322F3B","h":255,"s":11,"l":21},{"n":"暗龙胆紫","x":"#22202E","h":249,"s":18,"l":15},{"n":"晶石紫","x":"#1F2040","h":238,"s":35,"l":19},{"n":"暗蓝紫","x":"#131124","h":246,"s":36,"l":10},{"n":"景泰蓝","x":"#2775B6","h":207,"s":65,"l":43},{"n":"尼罗蓝","x":"#2474B5","h":207,"s":67,"l":43},{"n":"远天蓝","x":"#D0DFE6","h":199,"s":31,"l":86},{"n":"星蓝","x":"#93B5CF","h":206,"s":38,"l":69},{"n":"羽扇豆蓝","x":"#619AC3","h":205,"s":45,"l":57},{"n":"花青","x":"#2376B7","h":206,"s":68,"l":43},{"n":"睛蓝","x":"#5698C3","h":204,"s":48,"l":55},{"n":"虹蓝","x":"#2177B8","h":206,"s":70,"l":43},{"n":"湖水蓝","x":"#B0D5DF","h":193,"s":42,"l":78},{"n":"秋波蓝","x":"#8ABCD1","h":198,"s":44,"l":68},{"n":"涧石蓝","x":"#66A9C9","h":199,"s":48,"l":59},{"n":"潮蓝","x":"#2983BB","h":203,"s":64,"l":45},{"n":"群青","x":"#1772B4","h":205,"s":77,"l":40},{"n":"霁青","x":"#63BBD0","h":192,"s":54,"l":60},{"n":"碧青","x":"#5CB3CC","h":193,"s":52,"l":58},{"n":"宝石蓝","x":"#2486B9","h":201,"s":67,"l":43},{"n":"天蓝","x":"#1677B3","h":203,"s":78,"l":39},{"n":"柏林蓝","x":"#126BAE","h":206,"s":81,"l":38},{"n":"海青","x":"#22A2C3","h":192,"s":70,"l":45},{"n":"钴蓝","x":"#1A94BC","h":195,"s":76,"l":42},{"n":"鸢尾蓝","x":"#158BB8","h":197,"s":80,"l":40},{"n":"牵牛花蓝","x":"#1177B0","h":202,"s":82,"l":38},{"n":"飞燕草蓝","x":"#0F59A4","h":210,"s":83,"l":35},{"n":"品蓝","x":"#2B73AF","h":207,"s":61,"l":43},{"n":"银鱼白","x":"#CDD1D3","h":200,"s":6,"l":82},{"n":"安安蓝","x":"#3170A7","h":208,"s":55,"l":42},{"n":"鱼尾灰","x":"#5E616D","h":228,"s":7,"l":40},{"n":"鲸鱼灰","x":"#475164","h":219,"s":17,"l":34},{"n":"海参灰","x":"#FFFEFA","h":48,"s":100,"l":99},{"n":"沙鱼灰","x":"#35333C","h":253,"s":8,"l":22},{"n":"钢蓝","x":"#0F1423","h":225,"s":40,"l":10},{"n":"云水蓝","x":"#BACCD9","h":205,"s":29,"l":79},{"n":"晴山蓝","x":"#8FB2C9","h":204,"s":35,"l":67},{"n":"靛青","x":"#1661AB","h":210,"s":77,"l":38},{"n":"大理石灰","x":"#C4CBCF","h":202,"s":10,"l":79},{"n":"海涛蓝","x":"#15559A","h":211,"s":76,"l":34},{"n":"蝶翅蓝","x":"#4E7CA1","h":207,"s":35,"l":47},{"n":"海军蓝","x":"#346C9C","h":208,"s":50,"l":41},{"n":"水牛灰","x":"#2F2F35","h":240,"s":6,"l":20},{"n":"牛角灰","x":"#2D2E36","h":233,"s":9,"l":19},{"n":"燕颔蓝","x":"#131824","h":222,"s":31,"l":11},{"n":"云峰白","x":"#D8E3E7","h":196,"s":24,"l":88},{"n":"井天蓝","x":"#C3D7DF","h":197,"s":30,"l":82},{"n":"云山蓝","x":"#2F90B9","h":198,"s":59,"l":45},{"n":"釉蓝","x":"#1781B5","h":200,"s":77,"l":40},{"n":"鸥蓝","x":"#C7D2D4","h":189,"s":13,"l":81},{"n":"搪磁蓝","x":"#11659A","h":203,"s":80,"l":34},{"n":"月影白","x":"#C0C4C3","h":165,"s":3,"l":76},{"n":"星灰","x":"#B2BBBE","h":195,"s":8,"l":72},{"n":"淡蓝灰","x":"#5E7987","h":200,"s":18,"l":45},{"n":"鷃蓝","x":"#144A74","h":206,"s":71,"l":27},{"n":"嫩灰","x":"#74787A","h":200,"s":3,"l":47},{"n":"战舰灰","x":"#495C69","h":204,"s":18,"l":35},{"n":"瓦罐灰","x":"#47484C","h":228,"s":3,"l":29},{"n":"青灰","x":"#2B333E","h":215,"s":18,"l":21},{"n":"鸽蓝","x":"#1C2938","h":212,"s":33,"l":16},{"n":"钢青","x":"#142334","h":212,"s":44,"l":14},{"n":"暗蓝","x":"#101F30","h":212,"s":50,"l":13},{"n":"月白","x":"#EEF7F2","h":147,"s":36,"l":95},{"n":"海天蓝","x":"#C6E6E8","h":184,"s":42,"l":84},{"n":"清水蓝","x":"#93D5DC","h":186,"s":51,"l":72},{"n":"瀑布蓝","x":"#51C4D3","h":187,"s":60,"l":57},{"n":"蔚蓝","x":"#29B7CB","h":187,"s":66,"l":48},{"n":"孔雀蓝","x":"#0EB0C9","h":188,"s":87,"l":42},{"n":"甸子蓝","x":"#10AEC2","h":187,"s":85,"l":41},{"n":"石绿","x":"#57C3C2","h":179,"s":47,"l":55},{"n":"竹篁绿","x":"#B9DEC9","h":146,"s":36,"l":80},{"n":"粉绿","x":"#83CBAC","h":154,"s":41,"l":65},{"n":"美蝶绿","x":"#12AA9C","h":174,"s":81,"l":37},{"n":"毛绿","x":"#66C18C","h":145,"s":42,"l":58},{"n":"蔻梢绿","x":"#5DBE8A","h":148,"s":43,"l":55},{"n":"麦苗绿","x":"#55BB8A","h":151,"s":43,"l":53},{"n":"蛙绿","x":"#45B787","h":155,"s":45,"l":49},{"n":"铜绿","x":"#2BAE85","h":161,"s":60,"l":43},{"n":"竹绿","x":"#1BA784","h":165,"s":72,"l":38},{"n":"蓝绿","x":"#12A182","h":167,"s":80,"l":35},{"n":"穹灰","x":"#C4D7D6","h":177,"s":19,"l":81},{"n":"翠蓝","x":"#1E9EB3","h":188,"s":71,"l":41},{"n":"胆矾蓝","x":"#0F95B0","h":190,"s":84,"l":37},{"n":"樫鸟蓝","x":"#1491A8","h":189,"s":79,"l":37},{"n":"闪蓝","x":"#7CABB1","h":187,"s":25,"l":59},{"n":"冰山蓝","x":"#A4ACA7","h":142,"s":5,"l":66},{"n":"虾壳青","x":"#869D9D","h":180,"s":11,"l":57},{"n":"晚波蓝","x":"#648E93","h":186,"s":19,"l":48},{"n":"蜻蜓蓝","x":"#3B818C","h":188,"s":41,"l":39},{"n":"玉鈫蓝","x":"#126E82","h":191,"s":76,"l":29},{"n":"垩灰","x":"#737C7B","h":173,"s":4,"l":47},{"n":"夏云灰","x":"#617172","h":184,"s":8,"l":41},{"n":"苍蓝","x":"#134857","h":193,"s":64,"l":21},{"n":"黄昏灰","x":"#474B4C","h":192,"s":3,"l":29},{"n":"灰蓝","x":"#21373D","h":193,"s":30,"l":18},{"n":"深灰蓝","x":"#132C33","h":193,"s":46,"l":14},{"n":"玉簪绿","x":"#A4CAB6","h":148,"s":26,"l":72},{"n":"青矾绿","x":"#2C9678","h":163,"s":55,"l":38},{"n":"草原远绿","x":"#9ABEAF","h":155,"s":22,"l":67},{"n":"梧枝绿","x":"#69A794","h":162,"s":26,"l":53},{"n":"浪花绿","x":"#92B3A5","h":155,"s":18,"l":64},{"n":"海王绿","x":"#248067","h":164,"s":56,"l":32},{"n":"亚丁绿","x":"#428675","h":165,"s":34,"l":39},{"n":"镍灰","x":"#9FA39A","h":87,"s":5,"l":62},{"n":"明灰","x":"#8A988E","h":137,"s":6,"l":57},{"n":"淡绿灰","x":"#70887D","h":153,"s":10,"l":49},{"n":"飞泉绿","x":"#497568","h":162,"s":23,"l":37},{"n":"狼烟灰","x":"#5D655F","h":135,"s":4,"l":38},{"n":"绿灰","x":"#314A43","h":163,"s":20,"l":24},{"n":"苍绿","x":"#223E36","h":163,"s":29,"l":19},{"n":"深海绿","x":"#1A3B32","h":164,"s":39,"l":17},{"n":"长石灰","x":"#363433","h":20,"s":3,"l":21},{"n":"苷蓝绿","x":"#1F2623","h":154,"s":10,"l":14},{"n":"莽丛绿","x":"#141E1B","h":162,"s":20,"l":10},{"n":"淡翠绿","x":"#C6DFC8","h":125,"s":28,"l":83},{"n":"明绿","x":"#9ECCAB","h":137,"s":31,"l":71},{"n":"田园绿","x":"#68B88E","h":149,"s":36,"l":56},{"n":"翠绿","x":"#20A162","h":151,"s":67,"l":38},{"n":"淡绿","x":"#61AC85","h":149,"s":31,"l":53},{"n":"葱绿","x":"#40A070","h":150,"s":43,"l":44},{"n":"孔雀绿","x":"#229453","h":146,"s":63,"l":36},{"n":"艾绿","x":"#CAD3C3","h":94,"s":15,"l":80},{"n":"蟾绿","x":"#3C9566","h":148,"s":43,"l":41},{"n":"宫殿绿","x":"#20894D","h":146,"s":62,"l":33},{"n":"松霜绿","x":"#83A78D","h":137,"s":17,"l":58},{"n":"蛋白石绿","x":"#579572","h":146,"s":26,"l":46},{"n":"薄荷绿","x":"#207F4C","h":148,"s":60,"l":31},{"n":"瓦松绿","x":"#6E8B74","h":132,"s":12,"l":49},{"n":"荷叶绿","x":"#1A6840","h":149,"s":60,"l":25},{"n":"田螺绿","x":"#5E665B","h":104,"s":6,"l":38},{"n":"白屈菜绿","x":"#485B4D","h":136,"s":12,"l":32},{"n":"河豚灰","x":"#393733","h":40,"s":6,"l":21},{"n":"蒽油绿","x":"#373834","h":75,"s":4,"l":21},{"n":"槲寄生绿","x":"#2B312C","h":130,"s":7,"l":18},{"n":"云杉绿","x":"#15231B","h":146,"s":25,"l":11},{"n":"嫩菊绿","x":"#F0F5E5","h":79,"s":44,"l":93},{"n":"艾背绿","x":"#DFECD5","h":94,"s":38,"l":88},{"n":"嘉陵水绿","x":"#ADD5A2","h":107,"s":38,"l":74},{"n":"玉髓绿","x":"#41B349","h":124,"s":47,"l":48},{"n":"鲜绿","x":"#43B244","h":121,"s":45,"l":48},{"n":"宝石绿","x":"#41AE3C","h":117,"s":49,"l":46},{"n":"海沬绿","x":"#E2E7BF","h":68,"s":45,"l":83},{"n":"姚黄","x":"#D0DEAA","h":76,"s":44,"l":77},{"n":"橄榄石绿","x":"#B2CF87","h":84,"s":43,"l":67},{"n":"水绿","x":"#8CC269","h":96,"s":42,"l":59},{"n":"芦苇绿","x":"#B7D07A","h":77,"s":48,"l":65},{"n":"槐花黄绿","x":"#D2D97A","h":64,"s":56,"l":66},{"n":"苹果绿","x":"#BACF65","h":72,"s":52,"l":60},{"n":"芽绿","x":"#96C24E","h":83,"s":49,"l":53},{"n":"蝶黄","x":"#E2D849","h":56,"s":73,"l":59},{"n":"橄榄黄绿","x":"#BEC936","h":64,"s":58,"l":50},{"n":"鹦鹉绿","x":"#5BAE23","h":96,"s":67,"l":41},{"n":"油绿","x":"#253D24","h":118,"s":26,"l":19},{"n":"象牙白","x":"#FFFEF8","h":51,"s":100,"l":99},{"n":"汉白玉","x":"#F8F4ED","h":38,"s":44,"l":95},{"n":"雪白","x":"#FFFEF9","h":50,"s":100,"l":99},{"n":"鱼肚白","x":"#F7F4ED","h":42,"s":38,"l":95},{"n":"珍珠灰","x":"#E4DFD7","h":37,"s":19,"l":87},{"n":"浅灰","x":"#DAD4CB","h":36,"s":17,"l":83},{"n":"铅灰","x":"#BBB5AC","h":36,"s":10,"l":70},{"n":"中灰","x":"#A49C93","h":32,"s":9,"l":61},{"n":"瓦灰","x":"#867E76","h":30,"s":6,"l":49},{"n":"夜灰","x":"#847C74","h":30,"s":6,"l":49},{"n":"雁灰","x":"#80766E","h":27,"s":8,"l":47},{"n":"深灰","x":"#81776E","h":28,"s":8,"l":47},{"n":"蓝翠竹","x":"#4B8F8C","h":177,"s":31,"l":43},{"n":"云青灰","x":"#8A9A9C","h":187,"s":8,"l":58},{"n":"黑","x":"#000000","h":0,"s":0,"l":0},{"n":"普鲁士蓝","x":"#003152","h":204,"s":100,"l":16},{"n":"山岚","x":"#B2C9B2","h":120,"s":18,"l":74},{"n":"綟绶","x":"#6B8E23","h":80,"s":60,"l":35},{"n":"黛蓝","x":"#2A3C5C","h":218,"s":37,"l":26},{"n":"烟紫","x":"#704A70","h":300,"s":20,"l":36},{"n":"暮山紫","x":"#6E4D7E","h":280,"s":24,"l":40},{"n":"月白天青","x":"#C6D7DB","h":191,"s":23,"l":82},{"n":"翠微","x":"#3CB371","h":147,"s":50,"l":47},{"n":"紫云","x":"#A020F0","h":277,"s":87,"l":53},{"n":"青霜","x":"#4682B4","h":207,"s":44,"l":49},{"n":"梅子青","x":"#7BC092","h":140,"s":35,"l":62},{"n":"火焰红","x":"#F4512C","h":11,"s":90,"l":56},{"n":"琥珀","x":"#CA6924","h":25,"s":70,"l":47},{"n":"浅褐色","x":"#D2B48C","h":34,"s":44,"l":69},{"n":"烟青","x":"#708090","h":210,"s":13,"l":50},{"n":"苍碧","x":"#2A52BE","h":224,"s":64,"l":45},{"n":"月华","x":"#E0FFFF","h":180,"s":100,"l":94},{"n":"绫素白","x":"#F8F3E6","h":43,"s":56,"l":94},{"n":"墨韵黑","x":"#2E2E2E","h":0,"s":0,"l":18},{"n":"夜筵青","x":"#1D3F5A","h":207,"s":51,"l":23},{"n":"霜白","x":"#F2F3F4","h":210,"s":8,"l":95},{"n":"秋香","x":"#C3B787","h":48,"s":33,"l":65},{"n":"绯红","x":"#E3256B","h":338,"s":77,"l":52},{"n":"霞绯","x":"#FF6B6B","h":0,"s":100,"l":71},{"n":"鸦青","x":"#424B50","h":201,"s":10,"l":29},{"n":"玄黑","x":"#0E100F","h":150,"s":7,"l":6},{"n":"黛青","x":"#2A475F","h":207,"s":39,"l":27},{"n":"缃绮","x":"#F8C471","h":37,"s":91,"l":71},{"n":"烟褐","x":"#8B6D5C","h":22,"s":20,"l":45},{"n":"柳苍","x":"#3E6A3D","h":119,"s":27,"l":33},{"n":"蟹壳青","x":"#86A1A7","h":191,"s":16,"l":59},{"n":"雪青","x":"#B0D8E8","h":197,"s":55,"l":80},{"n":"云蓝","x":"#87CEEB","h":197,"s":71,"l":73},{"n":"梅红","x":"#B34B43","h":4,"s":46,"l":48},{"n":"柳绿","x":"#70C870","h":120,"s":44,"l":61},{"n":"绀碧","x":"#4B6C8C","h":210,"s":30,"l":42},{"n":"月蓝","x":"#6B8E99","h":194,"s":18,"l":51},{"n":"霜蓝","x":"#4A6FA6","h":216,"s":38,"l":47},{"n":"松墨","x":"#2E4B26","h":107,"s":33,"l":22},{"n":"竹青","x":"#00A86B","h":158,"s":100,"l":33},{"n":"湖蓝","x":"#66B7D0","h":194,"s":53,"l":61},{"n":"潆青","x":"#6B8E9A","h":195,"s":19,"l":51},{"n":"霜青","x":"#7CB9A8","h":163,"s":30,"l":61},{"n":"烟萦紫","x":"#8A4B9C","h":287,"s":35,"l":45},{"n":"缥缃","x":"#A4C2A8","h":128,"s":20,"l":70},{"n":"露碧","x":"#A0D8D8","h":180,"s":42,"l":74},{"n":"绀青","x":"#4F84FF","h":222,"s":100,"l":65},{"n":"柳黄","x":"#C9E079","h":73,"s":62,"l":68},{"n":"槐黄","x":"#D8C37C","h":46,"s":54,"l":67},{"n":"缥色","x":"#A8C9E4","h":207,"s":53,"l":78},{"n":"松花","x":"#B6D7A8","h":102,"s":37,"l":75},{"n":"缥碧","x":"#7AB9C1","h":187,"s":36,"l":62},{"n":"荷绿","x":"#4A7856","h":136,"s":24,"l":38},{"n":"檀褐","x":"#8E443D","h":5,"s":40,"l":40},{"n":"月魄","x":"#E0E7EF","h":212,"s":32,"l":91},{"n":"滢蓝","x":"#8EC4E9","h":204,"s":67,"l":74},{"n":"湖绿","x":"#70C8A4","h":155,"s":44,"l":61},{"n":"枫丹","x":"#C92B27","h":1,"s":68,"l":47},{"n":"雾绡","x":"#CDE8F9","h":203,"s":79,"l":89},{"n":"樱粉","x":"#F7B7C5","h":347,"s":80,"l":84},{"n":"霜紫","x":"#B8A5D2","h":265,"s":33,"l":74},{"n":"缥青","x":"#2B5F7C","h":201,"s":49,"l":33},{"n":"瑶碧","x":"#4B9CD3","h":204,"s":61,"l":56},{"n":"墨玉","x":"#2E4B3A","h":145,"s":24,"l":24},{"n":"莹翠","x":"#3EB489","h":158,"s":49,"l":47},{"n":"茜色","x":"#FF4D4D","h":0,"s":100,"l":65},{"n":"鹅黄","x":"#F2C867","h":42,"s":84,"l":68},{"n":"霜华","x":"#D0E7F9","h":206,"s":77,"l":90},{"n":"粉色","x":"#FADADD","h":354,"s":76,"l":92},{"n":"天青","x":"#6C9BCA","h":210,"s":47,"l":61},{"n":"天水碧","x":"#AED9D4","h":173,"s":36,"l":77},{"n":"檀色","x":"#A65F2E","h":25,"s":57,"l":42},{"n":"霜色","x":"#E8F4F8","h":195,"s":53,"l":94},{"n":"橙色","x":"#FF8C00","h":33,"s":100,"l":50},{"n":"奶橙色","x":"#FFD8B3","h":29,"s":100,"l":85},{"n":"黛绿","x":"#3B7A57","h":147,"s":35,"l":35},{"n":"勃艮第红","x":"#6D0B1E","h":348,"s":82,"l":24},{"n":"朱砂红","x":"#D92121","h":0,"s":74,"l":49},{"n":"朱墙","x":"#C41E3A","h":350,"s":73,"l":44},{"n":"东方既白","x":"#E6F2FF","h":211,"s":100,"l":95},{"n":"藕丝","x":"#D8B0C8","h":324,"s":34,"l":77},{"n":"奶黄色","x":"#F9E4A5","h":45,"s":87,"l":81},{"n":"浅栗棕","x":"#C8A58E","h":24,"s":35,"l":67},{"n":"浅绛","x":"#D9A594","h":15,"s":48,"l":72},{"n":"缁","x":"#2C2C2C","h":0,"s":0,"l":17},{"n":"緅","x":"#5C4A43","h":17,"s":16,"l":31},{"n":"缊","x":"#C79A6A","h":31,"s":45,"l":60},{"n":"青组缨","x":"#3B7C7F","h":183,"s":37,"l":36},{"n":"爵弁","x":"#6B3E3C","h":3,"s":28,"l":33},{"n":"玄色","x":"#1A1A1A","h":0,"s":0,"l":10},{"n":"黛紫","x":"#5D3A6F","h":280,"s":31,"l":33},{"n":"浅肤色","x":"#EBCDA8","h":33,"s":63,"l":79},{"n":"海棠","x":"#FF6F61","h":5,"s":100,"l":69},{"n":"黛青山","x":"#2E5A6F","h":199,"s":41,"l":31},{"n":"银红","x":"#C74A4D","h":359,"s":53,"l":54},{"n":"蓝色","x":"#4A8DDA","h":212,"s":66,"l":57},{"n":"绛紫","x":"#8E354A","h":346,"s":46,"l":38},{"n":"醋","x":"#8A3A3A","h":0,"s":41,"l":38},{"n":"玄青","x":"#2B3A4F","h":215,"s":30,"l":24},{"n":"霜叶红","x":"#C73B44","h":356,"s":56,"l":51},{"n":"竹月","x":"#BCE5D6","h":158,"s":44,"l":82},{"n":"银褐","x":"#A88A6F","h":28,"s":25,"l":55},{"n":"荞麦","x":"#D2B89A","h":32,"s":38,"l":71},{"n":"茶粉绿","x":"#B8C7A0","h":83,"s":26,"l":70},{"n":"长春花蓝","x":"#7EC0EE","h":205,"s":77,"l":71},{"n":"青骊","x":"#2E3439","h":207,"s":11,"l":20},{"n":"荞麦棕","x":"#8B6D47","h":34,"s":32,"l":41},{"n":"纯衣","x":"#F5F3E9","h":50,"s":38,"l":94},{"n":"緇","x":"#3B3131","h":0,"s":9,"l":21},{"n":"纁裳","x":"#D46A6A","h":0,"s":55,"l":62},{"n":"韎韐","x":"#A5441B","h":18,"s":72,"l":38},{"n":"纁屦","x":"#D47A5E","h":14,"s":58,"l":60},{"n":"皮弁","x":"#8B5D33","h":29,"s":46,"l":37},{"n":"素衣","x":"#F2F0E6","h":50,"s":32,"l":93},{"n":"素积","x":"#D2C8BC","h":33,"s":20,"l":78},{"n":"缁带","x":"#2E2A2D","h":315,"s":5,"l":17},{"n":"素鞸","x":"#D6C9B8","h":34,"s":27,"l":78},{"n":"白屦","x":"#F5F3E6","h":52,"s":43,"l":93},{"n":"缁絇繶纯","x":"#2E2014","h":28,"s":39,"l":13},{"n":"黄裳","x":"#F5D87E","h":45,"s":86,"l":73},{"n":"青絇繶纯","x":"#3B7A5D","h":152,"s":35,"l":35},{"n":"浅灰蓝","x":"#C2D1E0","h":210,"s":33,"l":82},{"n":"官绿","x":"#7AA35A","h":94,"s":29,"l":50},{"n":"明黄","x":"#FFD700","h":51,"s":100,"l":50},{"n":"玉青","x":"#4A9D9C","h":179,"s":36,"l":45},{"n":"暖灰","x":"#B7A8A5","h":10,"s":11,"l":68},{"n":"墨色","x":"#1D1B1C","h":330,"s":4,"l":11},{"n":"宝蓝","x":"#1A3E72","h":215,"s":63,"l":27},{"n":"帝王紫","x":"#7B3F61","h":326,"s":32,"l":36},{"n":"暗金","x":"#9C8B4D","h":47,"s":34,"l":46},{"n":"灰橙色","x":"#C48A69","h":22,"s":44,"l":59},{"n":"茜红","x":"#C70039","h":343,"s":100,"l":39},{"n":"烟蓝","x":"#7BA4B8","h":200,"s":30,"l":60},{"n":"落霞","x":"#FA7C5E","h":12,"s":94,"l":67},{"n":"纁色","x":"#D46D3A","h":20,"s":64,"l":53},{"n":"緅色","x":"#5C4033","h":19,"s":29,"l":28},{"n":"雾霾蓝","x":"#7BA0A5","h":187,"s":19,"l":56},{"n":"浅薄荷绿","x":"#B2F0D9","h":158,"s":67,"l":82},{"n":"丁香紫","x":"#C8A2C8","h":300,"s":26,"l":71},{"n":"烟粉","x":"#E4B5C4","h":341,"s":47,"l":80},{"n":"灰粉","x":"#D8B0B0","h":0,"s":34,"l":77},{"n":"棉花糖白","x":"#FFF8F0","h":32,"s":100,"l":97},{"n":"金棕","x":"#B8860B","h":43,"s":89,"l":38},{"n":"复方甘草","x":"#8B6E4F","h":31,"s":28,"l":43},{"n":"天际灰","x":"#C8D3D7","h":196,"s":16,"l":81},{"n":"藕粉","x":"#FEDBE1","h":350,"s":95,"l":93},{"n":"紫藤萝","x":"#9B8AE8","h":251,"s":67,"l":73},{"n":"浅紫藤萝","x":"#D1B3FF","h":264,"s":100,"l":85},{"n":"粉紫藤萝","x":"#D8B0D8","h":300,"s":34,"l":77},{"n":"白雪藤","x":"#E8F4F0","h":160,"s":35,"l":93},{"n":"凝脂莲青","x":"#C6E3E1","h":176,"s":34,"l":83},{"n":"焦绿","x":"#3B5F3A","h":118,"s":24,"l":30},{"n":"奶油白","x":"#FFF8E7","h":42,"s":100,"l":95},{"n":"浅豆绿","x":"#B2C8A0","h":93,"s":27,"l":71},{"n":"茉莉白","x":"#F8F4E9","h":44,"s":52,"l":94},{"n":"芝麻黑","x":"#2E292B","h":336,"s":6,"l":17},{"n":"流黄","x":"#D4A017","h":43,"s":80,"l":46},{"n":"柠檬绿","x":"#CCFF00","h":72,"s":100,"l":50},{"n":"青绿","x":"#2E8B57","h":146,"s":50,"l":36},{"n":"木色","x":"#8B4513","h":25,"s":76,"l":31},{"n":"高级灰","x":"#9C9CA4","h":240,"s":4,"l":63},{"n":"云峰灰","x":"#C1C8D6","h":220,"s":20,"l":80},{"n":"檀香紫","x":"#8A6E8B","h":298,"s":12,"l":49},{"n":"松烟墨","x":"#3B3A3E","h":255,"s":3,"l":24},{"n":"杏子","x":"#FDDA9F","h":38,"s":96,"l":81},{"n":"霁蓝","x":"#1E5A8F","h":208,"s":65,"l":34},{"n":"靛蓝","x":"#4B0082","h":275,"s":100,"l":25},{"n":"玫红色","x":"#FF007F","h":330,"s":100,"l":50},{"n":"新绿","x":"#6CC788","h":138,"s":45,"l":60},{"n":"杏子灰","x":"#D9CBB8","h":35,"s":30,"l":79},{"n":"玉色","x":"#F0F8FF","h":208,"s":100,"l":97},{"n":"霜地","x":"#E2F0CB","h":83,"s":55,"l":87},{"n":"黛绿色","x":"#3AB08C","h":162,"s":50,"l":46},{"n":"茜裙","x":"#C75A6B","h":351,"s":49,"l":57},{"n":"黛色","x":"#3B4F5C","h":204,"s":22,"l":30},{"n":"松花绿","x":"#A0D6B4","h":142,"s":40,"l":73},{"n":"灰色","x":"#8A8A8A","h":0,"s":0,"l":54},{"n":"白色","x":"#F8F8F8","h":0,"s":0,"l":97},{"n":"马尔斯绿","x":"#3A5F4B","h":148,"s":24,"l":30},{"n":"藕丝秋半","x":"#D9C6B0","h":32,"s":35,"l":77},{"n":"浅蓝","x":"#B0D4E3","h":198,"s":48,"l":79},{"n":"湘蓝","x":"#4A76A8","h":212,"s":39,"l":47},{"n":"荔色","x":"#F57C00","h":30,"s":100,"l":48},{"n":"鸦青色","x":"#2F4F4F","h":180,"s":25,"l":25},{"n":"杏粉","x":"#F0D9D0","h":17,"s":52,"l":88},{"n":"浅杏粉","x":"#F5E6E0","h":17,"s":51,"l":92},{"n":"米白","x":"#F5F0E6","h":40,"s":43,"l":93},{"n":"梨花白","x":"#F8F5F0","h":38,"s":36,"l":96},{"n":"荠麦绿","x":"#8DB67A","h":101,"s":29,"l":60},{"n":"蓼蓝青","x":"#2E5A88","h":211,"s":49,"l":36},{"n":"胭脂泪","x":"#9D4E5C","h":349,"s":34,"l":46},{"n":"藕荷色","x":"#B5A0C2","h":277,"s":22,"l":69},{"n":"杏子阴","x":"#B8A996","h":34,"s":19,"l":65},{"n":"浅苋菜紫","x":"#D8BFD8","h":300,"s":24,"l":80},{"n":"社红配","x":"#C83737","h":0,"s":57,"l":50},{"n":"猩红","x":"#BC1E46","h":345,"s":72,"l":43},{"n":"莺儿","x":"#A8D865","h":85,"s":60,"l":62},{"n":"青蓝","x":"#2A5C82","h":206,"s":51,"l":34},{"n":"苍筤","x":"#2E5D4A","h":156,"s":34,"l":27},{"n":"汉绣绿","x":"#2E7D32","h":123,"s":46,"l":34},{"n":"汉绣红","x":"#9E2F2F","h":0,"s":54,"l":40},{"n":"藕丝秋","x":"#D9C6B3","h":30,"s":33,"l":78},{"n":"墨绿","x":"#1A3B2E","h":156,"s":39,"l":17},{"n":"荼蘼白","x":"#F8F4F0","h":30,"s":36,"l":96},{"n":"石青","x":"#2E5D8C","h":210,"s":51,"l":36},{"n":"鎏金","x":"#D4AF37","h":46,"s":65,"l":52},{"n":"墨黑","x":"#0F1A20","h":201,"s":36,"l":9},{"n":"藕丝秋色","x":"#DCC6B5","h":26,"s":36,"l":79},{"n":"胭脂晕","x":"#C94A5E","h":351,"s":54,"l":54},{"n":"鸦黄","x":"#E6C24D","h":46,"s":75,"l":60},{"n":"翠青","x":"#2AAE6F","h":151,"s":61,"l":42},{"n":"青黛","x":"#1A3A5F","h":212,"s":57,"l":24},{"n":"深绿","x":"#0D5E3A","h":153,"s":76,"l":21},{"n":"乳白","x":"#F9F4DC","h":50,"s":71,"l":92},{"n":"杏仁黄","x":"#F7E8AA","h":48,"s":83,"l":82},{"n":"茉莉黄","x":"#F8DF72","h":49,"s":91,"l":71},{"n":"麦秆黄","x":"#F8DF70","h":49,"s":91,"l":71},{"n":"油菜花黄","x":"#FBDA41","h":49,"s":96,"l":62},{"n":"佛手黄","x":"#FED71A","h":50,"s":99,"l":55},{"n":"篾黄","x":"#F7DE98","h":44,"s":86,"l":78},{"n":"葵扇黄","x":"#F8D86A","h":46,"s":91,"l":69},{"n":"柠檬黄","x":"#FCD337","h":48,"s":97,"l":60},{"n":"金瓜黄","x":"#FCD217","h":49,"s":97,"l":54},{"n":"藤黄","x":"#FFD111","h":48,"s":100,"l":53},{"n":"酪黄","x":"#F6DEAD","h":40,"s":80,"l":82},{"n":"香水玫瑰黄","x":"#F7DA94","h":42,"s":86,"l":77},{"n":"淡密黄","x":"#F9D367","h":44,"s":92,"l":69},{"n":"大豆黄","x":"#FBCD31","h":46,"s":96,"l":59},{"n":"素馨黄","x":"#FCCB16","h":47,"s":97,"l":54},{"n":"向日葵黄","x":"#FECC11","h":47,"s":99,"l":53},{"n":"雅梨黄","x":"#FBC82F","h":45,"s":96,"l":58},{"n":"黄连黄","x":"#FCC515","h":46,"s":97,"l":54},{"n":"金盏黄","x":"#FCC307","h":46,"s":98,"l":51},{"n":"蛋壳黄","x":"#F8C387","h":32,"s":89,"l":75},{"n":"肉色","x":"#F7C173","h":35,"s":89,"l":71},{"n":"鹅掌黄","x":"#FBB929","h":41,"s":96,"l":57},{"n":"鸡蛋黄","x":"#FBB612","h":42,"s":97,"l":53},{"n":"鼬黄","x":"#FCB70A","h":43,"s":98,"l":51},{"n":"榴萼黄","x":"#F9A633","h":35,"s":94,"l":59},{"n":"淡橘橙","x":"#FBA414","h":37,"s":97,"l":53},{"n":"枇杷黄","x":"#FCA106","h":38,"s":98,"l":51},{"n":"橙皮黄","x":"#FCA104","h":38,"s":98,"l":50},{"n":"北瓜黄","x":"#FC8C23","h":29,"s":97,"l":56},{"n":"杏黄","x":"#F28E16","h":33,"s":89,"l":52},{"n":"雄黄","x":"#FF9900","h":36,"s":100,"l":50},{"n":"万寿菊黄","x":"#FB8B05","h":33,"s":97,"l":50},{"n":"菊蕾白","x":"#E9DDB6","h":46,"s":54,"l":81},{"n":"秋葵黄","x":"#EED045","h":49,"s":83,"l":60},{"n":"硫华黄","x":"#F2CE2B","h":49,"s":88,"l":56},{"n":"柚黄","x":"#F1CA17","h":49,"s":89,"l":52},{"n":"芒果黄","x":"#DDC871","h":48,"s":61,"l":65},{"n":"蒿黄","x":"#DFC243","h":49,"s":71,"l":57},{"n":"姜黄","x":"#E2C027","h":49,"s":76,"l":52},{"n":"香蕉黄","x":"#E4BF11","h":49,"s":86,"l":48},{"n":"草黄","x":"#D2B42C","h":49,"s":65,"l":50},{"n":"新禾绿","x":"#D2B116","h":49,"s":81,"l":45},{"n":"月灰","x":"#B7AE8F","h":47,"s":22,"l":64},{"n":"淡灰绿","x":"#AD9E5F","h":48,"s":32,"l":53},{"n":"草灰绿","x":"#8E804B","h":47,"s":31,"l":43},{"n":"苔绿","x":"#887322","h":48,"s":60,"l":33},{"n":"碧螺春绿","x":"#867018","h":48,"s":70,"l":31},{"n":"燕羽灰","x":"#685E48","h":41,"s":18,"l":35},{"n":"蟹壳灰","x":"#695E45","h":42,"s":21,"l":34},{"n":"潭水绿","x":"#645822","h":49,"s":49,"l":26},{"n":"橄榄绿","x":"#5E5314","h":51,"s":65,"l":22},{"n":"蚌肉白","x":"#F9F1DB","h":44,"s":71,"l":92},{"n":"豆汁黄","x":"#F8E8C1","h":43,"s":80,"l":86},{"n":"淡茧黄","x":"#F9D770","h":45,"s":92,"l":71},{"n":"乳鸭黄","x":"#FFC90C","h":47,"s":100,"l":52},{"n":"荔肉白","x":"#F2E6CE","h":40,"s":58,"l":88},{"n":"象牙黄","x":"#F0D695","h":43,"s":75,"l":76},{"n":"炒米黄","x":"#F4CE69","h":44,"s":86,"l":68},{"n":"鹦鹉冠黄","x":"#F6C430","h":45,"s":92,"l":58},{"n":"木瓜黄","x":"#F9C116","h":45,"s":95,"l":53},{"n":"浅烙黄","x":"#F9BD10","h":45,"s":95,"l":52},{"n":"莲子白","x":"#E5D3AA","h":42,"s":53,"l":78},{"n":"谷黄","x":"#E8B004","h":45,"s":97,"l":46},{"n":"栀子黄","x":"#EBB10D","h":44,"s":90,"l":49},{"n":"芥黄","x":"#D9A40E","h":44,"s":88,"l":45},{"n":"银鼠灰","x":"#B5AA90","h":42,"s":20,"l":64},{"n":"尘灰","x":"#B6A476","h":43,"s":30,"l":59},{"n":"枯绿","x":"#B78D12","h":45,"s":82,"l":39},{"n":"鲛青","x":"#87723E","h":43,"s":37,"l":39},{"n":"粽叶绿","x":"#876818","h":43,"s":70,"l":31},{"n":"灰绿","x":"#8A6913","h":43,"s":76,"l":31},{"n":"鹤灰","x":"#4A4035","h":31,"s":17,"l":25},{"n":"淡松烟","x":"#4D4030","h":33,"s":23,"l":25},{"n":"暗海水绿","x":"#584717","h":44,"s":59,"l":22},{"n":"棕榈绿","x":"#5B4913","h":45,"s":65,"l":22},{"n":"米色","x":"#F9E9CD","h":38,"s":79,"l":89},{"n":"淡肉色","x":"#F8E0B0","h":40,"s":84,"l":83},{"n":"麦芽糖黄","x":"#F9D27D","h":41,"s":91,"l":73},{"n":"琥珀黄","x":"#FEBA07","h":43,"s":99,"l":51},{"n":"甘草黄","x":"#F3BF4C","h":41,"s":87,"l":63},{"n":"初熟杏黄","x":"#F8BC31","h":42,"s":93,"l":58},{"n":"浅驼色","x":"#E2C17C","h":41,"s":64,"l":69},{"n":"沙石黄","x":"#E5B751","h":41,"s":74,"l":61},{"n":"虎皮黄","x":"#EAAD1A","h":42,"s":83,"l":51},{"n":"土黄","x":"#D6A01D","h":42,"s":76,"l":48},{"n":"百灵鸟灰","x":"#B4A992","h":41,"s":18,"l":64},{"n":"山鸡黄","x":"#B78B26","h":42,"s":66,"l":43},{"n":"龟背黄","x":"#826B48","h":36,"s":29,"l":40},{"n":"苍黄","x":"#806332","h":38,"s":44,"l":35},{"n":"莱阳梨黄","x":"#815F25","h":38,"s":55,"l":33},{"n":"蜴蜊绿","x":"#835E1D","h":38,"s":64,"l":31},{"n":"松鼠灰","x":"#4F4032","h":29,"s":22,"l":25},{"n":"橄榄灰","x":"#503E2A","h":32,"s":31,"l":24},{"n":"蟹壳绿","x":"#513C20","h":34,"s":43,"l":22},{"n":"古铜绿","x":"#533C1B","h":35,"s":51,"l":22},{"n":"焦茶绿","x":"#553B18","h":34,"s":56,"l":21},{"n":"粉白","x":"#FBF2E3","h":38,"s":75,"l":94},{"n":"落英淡粉","x":"#F9E8D0","h":35,"s":77,"l":90}];

			Object.assign(__exports, { "CHINESE_COLORS": CHINESE_COLORS });
		});
		__dshRegistry.set("data/command-reds.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-colorful-commands —— 红色系色库（用户指定）。
			 *
			 * 用户 2026-10-16 明确给出的一张**中国传统红色系**色表（约 190 色），
			 * 要求「运行命令」按危险性分等级、一律用红色系上色。
			 *
			 * 本文件是那张表的**机器可读副本**：名字与色号原样保留，
			 * `h`/`s`/`l` 由色号算出（H 0-360 度、S/L 0-100），供选色引擎按
			 * 色相与对比度筛选 —— 手写 HSL 容易抄错，一律由 `#RRGGBB` 计算。
			 *
			 * ⚠️ 生成方式：把用户给的「色名 #HEX」逐行解析、按色号去重（表中有少量重复色号）后
			 * 计算 HSL。**不要手工编辑数字**，要改就改色号并重新计算。
			 *
			 * @module dsh-colorful-commands/data/command-reds
			 */

			/** 红色系色表：`{ n: 色名, x: #RRGGBB, h, s, l }`。 */
			const COMMAND_REDS = [
			  { n: "桃红", x: "#F0ADA0", h: 10, s: 73, l: 78 },
			  { n: "颊红", x: "#EEAA9C", h: 10, s: 71, l: 77 },
			  { n: "淡罂粟红", x: "#EEA08C", h: 12, s: 74, l: 74 },
			  { n: "草莓红", x: "#EF6F48", h: 14, s: 84, l: 61 },
			  { n: "蜻蜓红", x: "#F1441D", h: 11, s: 88, l: 53 },
			  { n: "大红", x: "#F04B22", h: 12, s: 87, l: 54 },
			  { n: "柿红", x: "#F2481B", h: 13, s: 89, l: 53 },
			  { n: "榴花红", x: "#F34718", h: 13, s: 90, l: 52 },
			  { n: "银朱", x: "#F43E06", h: 14, s: 95, l: 49 },
			  { n: "朱红", x: "#ED5126", h: 13, s: 85, l: 54 },
			  { n: "淡栗棕", x: "#673424", h: 14, s: 48, l: 27 },
			  { n: "可可棕", x: "#652B1C", h: 12, s: 57, l: 25 },
			  { n: "柞叶棕", x: "#692A1B", h: 12, s: 59, l: 26 },
			  { n: "橡树棕", x: "#773D31", h: 10, s: 42, l: 33 },
			  { n: "海报灰", x: "#483332", h: 3, s: 18, l: 24 },
			  { n: "玫瑰灰", x: "#4B2E2B", h: 6, s: 27, l: 23 },
			  { n: "火山棕", x: "#482522", h: 5, s: 36, l: 21 },
			  { n: "豆沙", x: "#481E1C", h: 3, s: 44, l: 20 },
			  { n: "火岩棕", x: "#863020", h: 9, s: 61, l: 33 },
			  { n: "赭石", x: "#862617", h: 8, s: 71, l: 31 },
			  { n: "暗驼棕", x: "#592620", h: 6, s: 47, l: 24 },
			  { n: "酱棕", x: "#5A1F1B", h: 4, s: 54, l: 23 },
			  { n: "栗棕", x: "#5C1E19", h: 4, s: 57, l: 23 },
			  { n: "洋水仙红", x: "#F4C7BA", h: 13, s: 73, l: 84 },
			  { n: "谷鞘红", x: "#F17666", h: 7, s: 83, l: 67 },
			  { n: "苹果红", x: "#F15642", h: 7, s: 86, l: 60 },
			  { n: "铁水红", x: "#F5391C", h: 8, s: 92, l: 54 },
			  { n: "桂红", x: "#F25A47", h: 7, s: 87, l: 61 },
			  { n: "极光红", x: "#F33B1F", h: 8, s: 90, l: 54 },
			  { n: "粉红", x: "#F2B9B2", h: 7, s: 71, l: 82 },
			  { n: "舌红", x: "#F19790", h: 4, s: 78, l: 75 },
			  { n: "曲红", x: "#F05A46", h: 7, s: 85, l: 61 },
			  { n: "红汞红", x: "#F23E23", h: 8, s: 89, l: 54 },
			  { n: "淡绯", x: "#F2CAC9", h: 1, s: 61, l: 87 },
			  { n: "无花果红", x: "#EFAFAD", h: 2, s: 67, l: 81 },
			  { n: "榴子红", x: "#F1908C", h: 2, s: 78, l: 75 },
			  { n: "胭脂红", x: "#F03F24", h: 8, s: 87, l: 54 },
			  { n: "合欢红", x: "#F0A1A8", h: 355, s: 72, l: 79 },
			  { n: "春梅红", x: "#F1939C", h: 354, s: 77, l: 76 },
			  { n: "香叶红", x: "#F07C82", h: 357, s: 79, l: 71 },
			  { n: "珊瑚红", x: "#F04A3A", h: 5, s: 86, l: 58 },
			  { n: "萝卜红", x: "#F13C22", h: 8, s: 88, l: 54 },
			  { n: "淡茜红", x: "#E77C8E", h: 350, s: 69, l: 70 },
			  { n: "艳红", x: "#ED5A65", h: 356, s: 80, l: 64 },
			  { n: "淡菽红", x: "#ED4845", h: 1, s: 82, l: 60 },
			  { n: "鱼鳃红", x: "#ED3B2F", h: 4, s: 84, l: 56 },
			  { n: "樱桃红", x: "#ED3321", h: 5, s: 85, l: 53 },
			  { n: "淡蕊香红", x: "#EE4866", h: 349, s: 83, l: 61 },
			  { n: "石竹红", x: "#EE4863", h: 350, s: 83, l: 61 },
			  { n: "草茉莉红", x: "#EF475D", h: 352, s: 84, l: 61 },
			  { n: "茶花红", x: "#EE3F4D", h: 355, s: 84, l: 59 },
			  { n: "枸枢红", x: "#ED3333", h: 0, s: 84, l: 56 },
			  { n: "秋海棠红", x: "#EC2B24", h: 2, s: 84, l: 53 },
			  { n: "丽春红", x: "#EB261A", h: 3, s: 84, l: 51 },
			  { n: "夕阳红", x: "#DE2A18", h: 5, s: 80, l: 48 },
			  { n: "鹤顶红", x: "#D42517", h: 4, s: 80, l: 46 },
			  { n: "鹅血石红", x: "#AB372F", h: 4, s: 57, l: 43 },
			  { n: "覆盆子红", x: "#AC1F18", h: 3, s: 76, l: 38 },
			  { n: "貂紫", x: "#5D3131", h: 0, s: 31, l: 28 },
			  { n: "暗玉紫", x: "#5C2223", h: 359, s: 46, l: 25 },
			  { n: "栗紫", x: "#5A191B", h: 358, s: 57, l: 23 },
			  { n: "葡萄酱紫", x: "#5A1216", h: 357, s: 67, l: 21 },
			  { n: "牡丹粉红", x: "#EEA2A4", h: 358, s: 69, l: 78 },
			  { n: "山茶红", x: "#ED556A", h: 352, s: 81, l: 63 },
			  { n: "海棠红", x: "#F03752", h: 351, s: 86, l: 58 },
			  { n: "玉红", x: "#C04851", h: 356, s: 49, l: 52 },
			  { n: "高粱红", x: "#C02C38", h: 355, s: 63, l: 46 },
			  { n: "满江红", x: "#A7535A", h: 355, s: 34, l: 49 },
			  { n: "枣红", x: "#7C1823", h: 353, s: 68, l: 29 },
			  { n: "葡萄紫", x: "#4C1F24", h: 353, s: 42, l: 21 },
			  { n: "酱紫", x: "#4D1018", h: 352, s: 66, l: 18 },
			  { n: "淡曙红", x: "#EE2746", h: 351, s: 85, l: 54 },
			  { n: "唐菖蒲红", x: "#DE1C31", h: 354, s: 78, l: 49 },
			  { n: "鹅冠红", x: "#D11A2D", h: 354, s: 78, l: 46 },
			  { n: "莓红", x: "#C45A65", h: 354, s: 47, l: 56 },
			  { n: "枫叶红", x: "#C21F30", h: 354, s: 72, l: 44 },
			  { n: "苋菜红", x: "#A61B29", h: 354, s: 72, l: 38 },
			  { n: "烟红", x: "#894E54", h: 354, s: 27, l: 42 },
			  { n: "暗紫苑红", x: "#82202B", h: 353, s: 60, l: 32 },
			  { n: "殷红", x: "#82111F", h: 353, s: 77, l: 29 },
			  { n: "猪肝紫", x: "#541E24", h: 353, s: 47, l: 22 },
			  { n: "金鱼紫", x: "#500A16", h: 350, s: 78, l: 18 },
			  { n: "淡绛红", x: "#EC7696", h: 344, s: 76, l: 69 },
			  { n: "品红", x: "#EF3473", h: 340, s: 85, l: 57 },
			  { n: "凤仙花红", x: "#EA7293", h: 344, s: 74, l: 68 },
			  { n: "粉团花红", x: "#EC9BAD", h: 347, s: 68, l: 77 },
			  { n: "夹竹桃红", x: "#EB507E", h: 342, s: 79, l: 62 },
			  { n: "榲桲红", x: "#ED2F6A", h: 341, s: 84, l: 56 },
			  { n: "姜红", x: "#EEB8C3", h: 348, s: 61, l: 83 },
			  { n: "莲瓣红", x: "#EA517F", h: 342, s: 78, l: 62 },
			  { n: "水红", x: "#F1C4CD", h: 348, s: 62, l: 86 },
			  { n: "报春红", x: "#EC8AA4", h: 344, s: 72, l: 73 },
			  { n: "月季红", x: "#CE5777", h: 344, s: 55, l: 57 },
			  { n: "豇豆红", x: "#ED9DB2", h: 344, s: 69, l: 77 },
			  { n: "霞光红", x: "#EF82A0", h: 343, s: 77, l: 72 },
			  { n: "松叶牡丹红", x: "#EB3C70", h: 342, s: 81, l: 58 },
			  { n: "喜蛋红", x: "#EC2C64", h: 342, s: 83, l: 55 },
			  { n: "鼠鼻红", x: "#E3B4B8", h: 355, s: 46, l: 80 },
			  { n: "尖晶玉红", x: "#CC163A", h: 348, s: 81, l: 44 },
			  { n: "山黎豆红", x: "#C27C88", h: 350, s: 36, l: 62 },
			  { n: "锦葵红", x: "#BF3553", h: 347, s: 57, l: 48 },
			  { n: "鼠背灰", x: "#73575C", h: 349, s: 14, l: 40 },
			  { n: "甘蔗紫", x: "#621624", h: 349, s: 63, l: 24 },
			  { n: "石竹紫", x: "#63071C", h: 346, s: 87, l: 21 },
			  { n: "苍蝇灰", x: "#36282B", h: 347, s: 15, l: 18 },
			  { n: "卵石紫", x: "#30161C", h: 346, s: 37, l: 14 },
			  { n: "李紫", x: "#2B1216", h: 350, s: 41, l: 12 },
			  { n: "茄皮紫", x: "#2D0C13", h: 347, s: 58, l: 11 },
			  { n: "吊钟花红", x: "#CE5E8A", h: 336, s: 53, l: 59 },
			  { n: "兔眼红", x: "#EC4E8A", h: 337, s: 81, l: 62 },
			  { n: "紫荆红", x: "#EE2C79", h: 336, s: 85, l: 55 },
			  { n: "菜头紫", x: "#951C48", h: 338, s: 68, l: 35 },
			  { n: "鹞冠紫", x: "#621D34", h: 340, s: 54, l: 25 },
			  { n: "葡萄酒红", x: "#62102E", h: 338, s: 72, l: 22 },
			  { n: "磨石紫", x: "#382129", h: 339, s: 26, l: 17 },
			  { n: "檀紫", x: "#381924", h: 339, s: 38, l: 16 },
			  { n: "火鹅紫", x: "#33141E", h: 341, s: 44, l: 14 },
			  { n: "墨紫", x: "#310F1B", h: 339, s: 53, l: 13 },
			  { n: "晶红", x: "#EEA6B7", h: 346, s: 68, l: 79 },
			  { n: "扁豆花红", x: "#EF498B", h: 336, s: 84, l: 61 },
			  { n: "白芨红", x: "#DE7897", h: 342, s: 61, l: 67 },
			  { n: "嫩菱红", x: "#DE3F7C", h: 337, s: 71, l: 56 },
			  { n: "菠根红", x: "#D13C74", h: 337, s: 62, l: 53 },
			  { n: "酢酱草红", x: "#C5708B", h: 341, s: 42, l: 61 },
			  { n: "洋葱紫", x: "#A8456B", h: 337, s: 42, l: 46 },
			  { n: "海象紫", x: "#4B1E2F", h: 337, s: 43, l: 21 },
			  { n: "绀紫", x: "#461629", h: 336, s: 52, l: 18 },
			  { n: "古铜紫", x: "#440E25", h: 334, s: 66, l: 16 },
			  { n: "石蕊红", x: "#F0C9CF", h: 351, s: 57, l: 86 },
			  { n: "芍药耕红", x: "#EBA0B3", h: 345, s: 65, l: 77 },
			  { n: "藏花红", x: "#EC2D7A", h: 336, s: 83, l: 55 },
			  { n: "初荷红", x: "#E16C96", h: 338, s: 66, l: 65 },
			  { n: "马鞭草紫", x: "#EDE3E7", h: 336, s: 22, l: 91 },
			  { n: "丁香淡紫", x: "#E9D7DF", h: 333, s: 29, l: 88 },
			  { n: "丹紫红", x: "#D2568C", h: 334, s: 58, l: 58 },
			  { n: "玫瑰红", x: "#D2357D", h: 332, s: 64, l: 52 },
			  { n: "萝兰紫", x: "#C08EAF", h: 320, s: 28, l: 65 },
			  { n: "玫瑰紫", x: "#BA2F7B", h: 327, s: 60, l: 46 },
			  { n: "芝兰紫", x: "#E9CCD3", h: 346, s: 40, l: 86 },
			  { n: "菱锰红", x: "#D276A3", h: 331, s: 51, l: 64 },
			  { n: "龙须红", x: "#CC5595", h: 328, s: 54, l: 57 },
			  { n: "蓟粉红", x: "#E6D2D5", h: 351, s: 29, l: 86 },
			  { n: "电气石红", x: "#C35691", h: 328, s: 48, l: 55 },
			  { n: "樱草紫", x: "#C06F98", h: 330, s: 39, l: 59 },
			  { n: "隐红灰", x: "#B598A1", h: 341, s: 16, l: 65 },
			  { n: "苋菜紫", x: "#9B1E64", h: 326, s: 68, l: 36 },
			  { n: "暮云灰", x: "#4F383E", h: 344, s: 17, l: 26 },
			  { n: "斑鸠灰", x: "#482936", h: 335, s: 27, l: 22 },
			  { n: "淡藤萝紫", x: "#F2E7E5", h: 9, s: 33, l: 92 },
			  { n: "淡青紫", x: "#E0C8D1", h: 338, s: 28, l: 83 },
			  { n: "青蛤壳紫", x: "#BC84A8", h: 321, s: 29, l: 63 },
			  { n: "豆蔻紫", x: "#AD6598", h: 318, s: 31, l: 54 },
			  { n: "扁豆紫", x: "#A35C8F", h: 317, s: 28, l: 50 },
			  { n: "芥花紫", x: "#983680", h: 315, s: 48, l: 40 },
			  { n: "青莲", x: "#8B2671", h: 315, s: 57, l: 35 },
			  { n: "芓紫", x: "#894276", h: 316, s: 35, l: 40 },
			  { n: "葛巾紫", x: "#7E2065", h: 316, s: 59, l: 31 },
			  { n: "牵牛紫", x: "#681752", h: 316, s: 64, l: 25 },
			  { n: "紫灰", x: "#5D3F51", h: 324, s: 19, l: 31 },
			  { n: "龙睛鱼紫", x: "#4E2A40", h: 323, s: 30, l: 24 },
			  { n: "荸荠紫", x: "#411C35", h: 319, s: 40, l: 18 },
			  { n: "古鼎灰", x: "#36292F", h: 332, s: 14, l: 19 },
			  { n: "火焰红", x: "#F4512C", h: 11, s: 90, l: 56 },
			  { n: "绯红", x: "#E3256B", h: 338, s: 77, l: 52 },
			  { n: "霞绯", x: "#FF6B6B", h: 0, s: 100, l: 71 },
			  { n: "梅红", x: "#B34B43", h: 4, s: 46, l: 48 },
			  { n: "檀褐", x: "#8E443D", h: 5, s: 40, l: 40 },
			  { n: "枫丹", x: "#C92B27", h: 1, s: 68, l: 47 },
			  { n: "樱粉", x: "#F7B7C5", h: 347, s: 80, l: 84 },
			  { n: "茜色", x: "#FF4D4D", h: 0, s: 100, l: 65 },
			  { n: "粉色", x: "#FADADD", h: 354, s: 76, l: 92 },
			  { n: "勃艮第红", x: "#6D0B1E", h: 348, s: 82, l: 24 },
			  { n: "朱砂红", x: "#D92121", h: 0, s: 74, l: 49 },
			  { n: "朱墙", x: "#C41E3A", h: 350, s: 73, l: 44 },
			  { n: "藕丝", x: "#D8B0C8", h: 324, s: 34, l: 77 },
			  { n: "爵弁", x: "#6B3E3C", h: 3, s: 28, l: 33 },
			  { n: "海棠", x: "#FF6F61", h: 5, s: 100, l: 69 },
			  { n: "银红", x: "#C74A4D", h: 359, s: 53, l: 54 },
			  { n: "绛紫", x: "#8E354A", h: 346, s: 46, l: 38 },
			  { n: "醋", x: "#8A3A3A", h: 0, s: 41, l: 38 },
			  { n: "霜叶红", x: "#C73B44", h: 356, s: 56, l: 51 },
			  { n: "纁裳", x: "#D46A6A", h: 0, s: 55, l: 62 },
			  { n: "纁屦", x: "#D47A5E", h: 14, s: 58, l: 60 },
			  { n: "帝王紫", x: "#7B3F61", h: 326, s: 32, l: 36 },
			  { n: "茜红", x: "#C70039", h: 343, s: 100, l: 39 },
			  { n: "落霞", x: "#FA7C5E", h: 12, s: 94, l: 67 },
			  { n: "烟粉", x: "#E4B5C4", h: 341, s: 47, l: 80 },
			  { n: "灰粉", x: "#D8B0B0", h: 0, s: 34, l: 77 },
			  { n: "藕粉", x: "#FEDBE1", h: 350, s: 95, l: 93 },
			  { n: "玫红色", x: "#FF007F", h: 330, s: 100, l: 50 },
			  { n: "茜裙", x: "#C75A6B", h: 351, s: 49, l: 57 },
			  { n: "胭脂泪", x: "#9D4E5C", h: 349, s: 34, l: 46 },
			  { n: "社红配", x: "#C83737", h: 0, s: 57, l: 50 },
			  { n: "猩红", x: "#BC1E46", h: 345, s: 72, l: 43 },
			  { n: "汉绣红", x: "#9E2F2F", h: 0, s: 54, l: 40 },
			  { n: "胭脂晕", x: "#C94A5E", h: 351, s: 54, l: 54 },
			];

			Object.assign(__exports, { "COMMAND_REDS": COMMAND_REDS });
		});
		__dshRegistry.set("color-engine.js", (__exports) => {
			var module = { exports: __exports };
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
			const LIGHT_BG = '#FFFFFF';
			/** 深色主题底色（同上）。 */
			const DARK_BG = '#151517';

			/** 对比度下限：非文本图形元素（WCAG 1.4.11）。 */
			const MIN_CONTRAST = 3.2;

			/**
			 * 对比度下限：**文本**（WCAG 2.1 AA 正文）。
			 *
			 * 命令分级色会同时用在**标签文字**上（"运行命令"这类 13–14px 文本），所以
			 * 不能按图标那个 3.0/3.2 的非文本门槛来，否则大字勉强能看、小字发虚。
			 */
			const TEXT_MIN_CONTRAST = 4.5;
			/**
			 * 对比度上限：超过就说明接近黑/白 —— 色相辨识度会丢失。
			 *
			 * 实测（742 色库 + 白底）：不限上限时会挑到 `#4B0082`（对比度 13.0）那种近黑
			 * 的靛蓝，在白底上看起来像"深灰"而不是"紫"。
			 */
			const MAX_CONTRAST = 9.5;

			/**
			 * 统一色调目标。
			 *
			 * 浅色主题用**中等偏深**的色（白底需要足够暗才可读）；
			 * 深色主题用**中等偏亮**的色。饱和度取中高但不是最高 —— 最高饱和度是"刺眼"
			 * 的来源，中高饱和度才有"一套配色"的整体感。
			 */
			const TONE = {
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
			function luminance(hex) {
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
			function contrast(a, b) {
			  const la = luminance(a);
			  const lb = luminance(b);
			  const hi = Math.max(la, lb);
			  const lo = Math.min(la, lb);
			  return (hi + 0.05) / (lo + 0.05);
			}

			/** 两个色相之间的最短角距（0–180 度）。 */
			function hueDistance(a, b) {
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
			function pickColor(colors, options) {
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
			function buildPalette(colors, specs) {
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
			function buildRedTiers(colors, options = {}) {
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
			function hsvSaturation(hex) {
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
			function deltaE(a, b) {
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
			const SATURATION_BONUS = 0.012;

			/**
			 * 相邻风险档之间的最小可辨色差。
			 *
			 * 经验值：ΔE ≈ 2.3 是"刚好能分辨"的门槛，5 以上才"一眼不同"。
			 * 这里取 9 —— 三档是要让人**扫一眼就分出轻重**，不是勉强能分辨。
			 */
			const MIN_TIER_DELTA_E = 9;

			Object.assign(__exports, { "LIGHT_BG": LIGHT_BG, "DARK_BG": DARK_BG, "MIN_CONTRAST": MIN_CONTRAST, "TEXT_MIN_CONTRAST": TEXT_MIN_CONTRAST, "MAX_CONTRAST": MAX_CONTRAST, "TONE": TONE, "luminance": luminance, "contrast": contrast, "hueDistance": hueDistance, "pickColor": pickColor, "buildPalette": buildPalette, "buildRedTiers": buildRedTiers, "hsvSaturation": hsvSaturation, "deltaE": deltaE, "SATURATION_BONUS": SATURATION_BONUS, "MIN_TIER_DELTA_E": MIN_TIER_DELTA_E });
		});
		__dshRegistry.set("palettes.js", (__exports) => {
			var module = { exports: __exports };
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
			const { ALL_CATEGORIES, PRESET_CHINESE, PRESET_JAPANESE, PRESET_MACARON } = __dshRequire("./constants.js");
			const { CHINESE_COLORS } = __dshRequire("./data/chinese-colors.js");
			const { COMMAND_REDS } = __dshRequire("./data/command-reds.js");
			const { buildPalette, buildRedTiers } = __dshRequire("./color-engine.js");

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
			  web: { hue: 230 },
			  // 重试是"等待/重来"语义，用琥珀橙（与"其他工具"的哑褐拉开，也和命令的红色系区分）。
			  retry: { hue: 35, minSaturation: 30 },
			  // 压缩是"上下文被收拢"的中性事件，用青蓝（与 read 的天青、search 的石绿拉开）。
			  compaction: { hue: 195, minSaturation: 25 },
			  other: { hue: 25, minSaturation: 5, maxSaturation: 45 },
			  'ctl-plan': { hue: 285, minSaturation: 18 },
			};

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
			function presetColors(presetId) {
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
			  const merged = { ...palette, ...RED_TIERS, ...permissionColorsFor(presetId) };
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
			function presetColorFor(presetId, category) {
			  const pair = presetColors(presetId)[category];
			  if (pair === undefined) return undefined;
			  return { light: pair.light, dark: pair.dark };
			}

			/** 预设的中文显示名。 */
			const PRESET_LABELS = {
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
			function presetCoverage(presetId) {
			  const palette = presetColors(presetId);
			  return {
			    covered: ALL_CATEGORIES.filter((c) => Object.hasOwn(palette, c)),
			    missing: ALL_CATEGORIES.filter((c) => !Object.hasOwn(palette, c)),
			  };
			}

			Object.assign(__exports, { "presetColors": presetColors, "presetColorFor": presetColorFor, "PRESET_LABELS": PRESET_LABELS, "presetCoverage": presetCoverage });
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
			const { PERMISSION_LEVELS, TITLE_SEPARATOR, commandRisk } = __dshRequire("./constants.js");

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
			 *
			 * ⚠️ 命令类不在这里落具体等级：`bash` / `pwsh` 先归 `command`，
			 * 再由 `commandRisk()` 细分成 `commandLow` / `commandMid` / `commandHigh`。
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
			 * 未映射的 kind 会落到 `null`（不着色），这是刻意的 —— 轨迹行里 `user` /
			 * `assistant` / `message` 是**消息本体**，给它们上色只会让整屏变花。
			 */
			const KIND_CATEGORY = {
			  tool: 'command',
			  subtool: 'other',
			};

			/**
			 * 过程组标题：`data-process-activity` → 类别。
			 *
			 * ⚠️ **这是"执行了命令 / 已完成分析 / 已读取文件"没变色的根因。**
			 * 那些是**过程组标题**（`ChatGroupSeat` 的 `ProcessGroupHeader`），它们的 DOM
			 * 钩子是 `data-process-activity`，**不带 `data-tool`**，所以第一版完全没标记它们。
			 *
			 * 取值来自内核 `ui-chat` 的 `message.stepProcess.*` 文案键（实测枚举）：
			 * thinking / read / readImage / search / edit / write / code / commands /
			 * plan / questions / subagents / tools / webFetch / webSearch。
			 * 未列出的取值落 `other`，因此宿主以后新增活动类型也会被着色，不会漏。
			 *
			 * `tools` / `commands` 是**聚合**类（"已调用工具"/"执行了命令"），归 command
			 * 更符合直觉 —— 用户看到的就是一串命令。
			 */
			const ACTIVITY_CATEGORY = {
			  thinking: 'thinking',
			  plan: 'thinking',
			  read: 'read',
			  readImage: 'read',
			  search: 'search',
			  edit: 'write',
			  write: 'write',
			  code: 'write',
			  commands: 'command',
			  tools: 'command',
			  webFetch: 'web',
			  webSearch: 'web',
			  subagents: 'other',
			  questions: 'other',
			};

			/**
			 * DSH 插槽名 → 控件类别。`ui-renderer` 的 `renderSlot` 会给每个插槽条目
			 * 套一层 `[data-slot="<槽名>"]`，这是**官方稳定契约**（不是实现细节）。
			 *
			 * ⚠️ **只保留用户明确要的两个槽。**
			 *
			 * - `conversation.input.permission` —— 权限选择（还要按等级细分，见下）。
			 * - `conversation.input.plan` —— 计划模式。
			 *
			 * ⚠️ **`ctl-model` 与 `ctl-activity` 已删除**（用户 2026-10-16：「语音输入和
			 * 模型名称不需要颜色」）：
			 * - `conversation.input.model` 是**模型名称**（截图里 `deepseek-v4.1-flash Xhigh`
			 *   被涂蓝）；
			 * - `conversation.input.activity` 是**语音输入控件**（实测
			 *   `dsh-experimental-client-ui-voice-input` 注册的正是这个槽）。
			 *
			 * ⚠️ **`left` / `right` / `dock` / `overlay` / `attachments` 也不碰**：它们装的是
			 * 加号按钮、斜杠命令触发器等**原生控件**，上色会波及弹出的菜单
			 * （实测斜杠命令菜单项被涂灰，非常难看）。
			 */
			const SLOT_CATEGORY = {
			  'conversation.input.permission': 'ctl-permission',
			  'conversation.input.plan': 'ctl-plan',
			};

			/**
			 * 重试行（`<details class="<hash>_retryRow">`）的识别。
			 *
			 * ⚠️ 内核只给它一个 `data-active`，**没有语义化属性**，所以只能看 CSS Module 的
			 * 类名后缀。前缀哈希每次构建会变、后缀是源码类名稳定 —— 这正是 `css.js` 里
			 * `[class*="_title"]` 用的同一套思路。
			 *
			 * @param attrs 属性快照。
			 * @returns 是否为重试行。
			 */
			function isRetryRow(attrs) {
			  const cls = attrs?.class;
			  if (typeof cls !== 'string') return false;
			  return cls.includes('_retryRow') || cls.includes('_retrySummary') || cls.includes('_retryText');
			}

			/**
			 * 上下文压缩行（`<div class="<hash>_compactionRow">`）的识别。
			 *
			 * 与重试行同因：内核只给了 class，没有语义化属性。
			 *
			 * @param attrs 属性快照。
			 * @returns 是否为压缩行。
			 */
			function isCompactionRow(attrs) {
			  const cls = attrs?.class;
			  if (typeof cls !== 'string') return false;
			  return cls.includes('_compactionRow')
			    || cls.includes('_compactionButton')
			    || cls.includes('_compactionLeading');
			}

			/**
			 * 上下文压缩的通用命令行（`GenericCommandCard`）识别。
			 *
			 * ## 为什么压缩有**两个**不同的渲染路径
			 *
			 * `/compact` 这一行在内核里分两段渲染，用的是**不同组件**：
			 *
			 * | 阶段 | 组件 | 根元素 |
			 * |---|---|---|
			 * | 压缩**进行中**（`compaction === null`） | `GenericCommandCard` | `data-variant="others"` + 标题 `compact` |
			 * | 压缩**已完成** | `CompactionItem` | `class="…_compactionRow"` |
			 *
			 * 第一版只覆盖了后者（靠 `_compactionRow` 类名），于是用户看到
			 * "压缩的上色只在压缩完成后才上色 压缩中没有上色"。
			 *
			 * 进行中这一行走的是通用命令卡片，`data-variant="others"` 是**所有**斜杠命令
			 * 共用的（不能据此判定），所以改用**标题文字**识别：内核把
			 * `message.compaction.commandTitle` 硬编码为字面量 `"compact"`（实测），
			 * 而 `.title` 元素是独立的一个 span，文本恰好就是这个标题。
			 *
			 * @param element 候选元素。
			 * @param attrs 属性快照。
			 * @returns 是否为进行中的压缩命令行。
			 */
			function isRunningCompaction(element, attrs) {
			  // 只认"通用命令卡片"这一形状，避免误伤别的行。
			  if (attrs?.['data-variant'] !== 'others') return false;
			  try {
			    if (typeof element.querySelector !== 'function') return false;
			    const title = element.querySelector('[class*="_title"]');
			    if (title === null) return false;
			    return title.textContent === 'compact';
			  } catch {
			    return false;
			  }
			}

			/**
			 * 判断一段文本命中的权限等级。
			 *
			 * 用户明确要求「不同权限等级的颜色应该不同」。`PermissionSelect` 的触发按钮
			 * 文本就是当前预设的 label（内核 `dsh-client-ui-permission-presets` 实测：
			 * 「仅可查看」/「工作区内修改」/「完全权限」/「Auto review」），所以按文本判定
			 * 即可，不需要读 React 内部状态。
			 *
			 * @param text 控件可见文本。
			 * @returns 权限等级类别，或 null（未命中任何已知等级）。
			 */
			function permissionLevel(text) {
			  if (typeof text !== 'string' || text === '') return null;
			  for (const [label, category] of Object.entries(PERMISSION_LEVELS)) {
			    if (text.includes(label)) return category;
			  }
			  return null;
			}

			/**
			 * 把一个 DOM 元素的属性快照分类。
			 *
			 * 输入是**普通对象**而非元素，因此可以在 Node 里直接单测，不需要 DOM。
			 * 查找顺序即优先级：越具体的钩子越先看。
			 *
			 * @param attrs 属性快照，键为属性名（`data-tool` 这类），值为字符串或 undefined。
			 * @param options.text 元素的可见文本，用于命令风险与权限等级判定；不传则跳过。
			 * @returns 类别 id，或 null（不属于任何可染色类别）。
			 */
			function classifyAttrs(attrs, options = {}) {
			  const a = attrs ?? {};

			  // 0. 重试行 / 压缩行：它们没有可用的语义化 data-* 属性，只能靠类名后缀
			  //    或标题字面量识别。
			  if (isRetryRow(a)) return 'retry';
			  if (isCompactionRow(a)) return 'compaction';
			  //    ⚠️ 压缩**进行中**走的是另一个组件（GenericCommandCard），类名里没有
			  //    `compaction`，必须靠标题文字 `compact` 认（见 isRunningCompaction）。
			  if (isRunningCompaction(options.element, a)) return 'compaction';

			  // 1. 插槽锚点优先：控件类与内容类不重叠，先判更具体的。
			  const slot = a['data-slot'];
			  if (typeof slot === 'string' && Object.hasOwn(SLOT_CATEGORY, slot)) {
			    const base = SLOT_CATEGORY[slot];
			    // 权限选择按**当前等级**细分 —— 用户明确要求不同等级不同色。
			    if (base === 'ctl-permission') return permissionLevel(options.text) ?? base;
			    return base;
			  }

			  // 2. 过程组标题（"执行了命令"/"已完成分析"）—— 它们**不带 data-tool**，
			  //    只有 data-process-activity，所以必须单独判，否则整类漏掉不着色。
			  const activity = a['data-process-activity'];
			  if (typeof activity === 'string' && activity !== '') {
			    const abase = ACTIVITY_CATEGORY[activity] ?? 'other';
			    // ⚠️ `commands` / `tools` 是**聚合**活动（"执行了命令"），先归 `command`，
			    // 再按标题文本细分风险 —— 不细分会让整类拿不到颜色（调色板里没有 `command`）。
			    if (abase === 'command') return commandCategory(options.text);
			    return abase;
			  }

			  // 3. 工具行 / 命令行。
			  //
			  //    ⚠️ **`data-sample` 不再早退 —— 这是"运行命令"一直不上色的根因。**
			  //
			  //    内核实测（`dsh-client-ui-tool` 的 `BashRow`）：bash 工具行**不走**
			  //    `ToolRow`，而是注册到 `tool.call.toolview` 的 `key: "bash"`，其根元素是
			  //
			  //        <div data-sample="bash" data-variant="bash" data-state="…">
			  //
			  //    **它没有 `data-tool`。** 旧版这里第一条规则是
			  //    `if (a['data-sample'] !== undefined) return null;`（当时为了跳过 ToolRow
			  //    内部重复的 bash 卡片），于是整类被静默跳过 —— 截图里「运行命令」永远是
			  //    灰的，而 read/edit/write（走 ToolRow，带 `data-tool`）是彩色的。
			  //
			  //    修法：把 `data-sample` 当作与 `data-variant` 等价的钩子，并按**具体工具名
			  //    优先、其次变体**取值。命令类再由 `commandCategory()` 按风险细分。
			  const tool = a['data-tool'];
			  const variant = a['data-variant'];
			  const base = typeof tool === 'string' && tool !== ''
			    ? TOOL_CATEGORY[tool] ?? 'other'
			    : typeof variant === 'string' && Object.hasOwn(VARIANT_CATEGORY, variant)
			      ? VARIANT_CATEGORY[variant]
			      : null;

			  if (base !== null) {
			    if (base === 'command') return commandCategory(options.text);
			    return base;
			  }

			  // 4. 轨迹行。
			  const kind = a['data-kind'];
			  if (typeof kind === 'string' && Object.hasOwn(KIND_CATEGORY, kind)) {
			    const kbase = KIND_CATEGORY[kind];
			    if (kbase === 'command') return commandCategory(options.text);
			    return kbase;
			  }

			  // ⚠️ 刻意不处理 `data-chat-flow-kind`：它是**整列宽**的 flowItem 包裹层，
			  // 而消息气泡在内部靠右 —— 给它上色会把颜色画到窗口最左缘、与内容脱节。

			  return null;
			}

			/**
			 * 命令风险等级 → 类别 id。
			 *
			 * @param text 判定用文本。
			 * @returns 三个 `command*` 类别之一。
			 */
			function commandCategory(text) {
			  const risk = commandRisk(text);
			  if (risk === 'high') return 'commandHigh';
			  if (risk === 'mid') return 'commandMid';
			  return 'commandLow';
			}

			/**
			 * 判断一行表头文本里是否**既有标签又有细节**。
			 *
			 * 内核 `ProcessGroupHeader` 的标题是
			 * `detail === "" ? label : label + t("message.turnProcess.separator") + detail`
			 * （实测 separator = `" · "`）。`detail` 是**模型的实时分析正文**
			 * （`summary.runningDetail`，推理阶段就是分析文本本身）。
			 *
			 * 用户反馈「发送 prompt 后的模型分析，除了 tag，分析正文也被错误地上色，导致
			 * 上色部分太多」—— 根因就是标签与正文在**同一个文本节点**里，CSS 无法只染标签。
			 * 所以这里做一次判定：带细节时**只染图标**，不带细节（历史/已折叠的组标题就是
			 * 纯标签）时标签与图标一起染。
			 *
			 * @param text 元素可见文本。
			 * @returns 是否带详情。
			 */
			function hasTitleDetail(text) {
			  return typeof text === 'string' && text.includes(TITLE_SEPARATOR);
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
			    'class',
			    'data-slot',
			    'data-process-activity',
			    'data-tool',
			    'data-variant',
			    'data-sample',
			    'data-kind',
			  ];
			  const attrs = {};
			  for (const name of names) {
			    const value = element.getAttribute(name);
			    if (value !== null) attrs[name] = value;
			  }
			  return attrs;
			}

			/** 导出内部表，供测试断言覆盖完整性。 */
			const _tables = { TOOL_CATEGORY, VARIANT_CATEGORY, KIND_CATEGORY, ACTIVITY_CATEGORY, SLOT_CATEGORY };

			Object.assign(__exports, { "isRetryRow": isRetryRow, "isCompactionRow": isCompactionRow, "isRunningCompaction": isRunningCompaction, "permissionLevel": permissionLevel, "classifyAttrs": classifyAttrs, "commandCategory": commandCategory, "hasTitleDetail": hasTitleDetail, "readAttrs": readAttrs, "_tables": _tables });
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
			const { classifyAttrs, hasTitleDetail, isCompactionRow, isRetryRow, readAttrs } = __dshRequire("./classify.js");
			const { TITLE_SEPARATOR } = __dshRequire("./constants.js");
			const { CAT_ATTR, MARK_ATTR, PART_ATTR, SCOPE_ATTR } = __dshRequire("./css.js");

			/**
			 * 一次性匹配所有"可能可染色"的元素。
			 *
			 * 这是唯一的 DSH 属性清单，与 `classify.js` 的判定一一对应。
			 * 用属性存在性选择器（不取值），所以宿主加新工具名也无需改这里。
			 */
			const CANDIDATE_SELECTOR = [
			  // ⚠️ 重试行只能靠类名后缀认：内核只给它 `data-active`，没有语义化属性。
			  // 用户反馈"重试模型请求也没有上色"就是因为它不在任何属性选择器里。
			  '[class*="_retryRow"]',
			  '[class*="_retrySummary"]',
			  '[class*="_retryText"]',
			  // 压缩行同样只有类名可用：<div class="…_compactionRow"><button class="…_compactionButton">
			  '[class*="_compactionRow"]',
			  '[class*="_compactionButton"]',
			  // ⚠️ `[data-sample]` **必须在内**：bash 工具行（BashRow）的根元素只有
			  // `data-sample="bash"` + `data-variant="bash"`，**没有 `data-tool`**
			  // —— 这正是"运行命令"一直不上色的根因（详见 classify.js 的说明）。
			  '[data-sample]',
			  '[data-tool]',
			  '[data-variant="think"]',
			  // 过程组标题（"执行了命令"/"已完成分析"）：只有这个属性，没有 data-tool。
			  '[data-process-activity]',
			  '[data-kind]',
			  '[data-slot]',
			].join(',');

			/**
			 * 沿祖先链找到最近的"可染色"元素。
			 *
			 * ⚠️ 为什么需要它：`characterData` 记录里的 `record.target` 是**文本节点**，
			 * 它的 `parentNode` 是承载文字的那个 `<span>`（例如过程组标题的 `_label`），
			 * 而 `data-process-activity` 挂在**更外层的 `<button>`** 上。直接把 parentNode
			 * 丢给 `tagTree` 会一个都匹配不到 —— 看起来"观察了文本变化"，实际什么也没重判。
			 *
			 * 这里从文本节点的父元素往上找，直到命中候选属性；找不到就返回 null。
			 *
			 * @param node 起始节点（文本节点或其父元素）。
			 * @param maxDepth 最大上溯层数（防御异常深的 DOM）。
			 * @returns 最近的候选元素，或 null。
			 */
			function nearestCandidate(node, maxDepth = 24) {
			  let current = node;
			  // 文本节点先退到它的父元素。
			  if (current !== null && current !== undefined && current.nodeType === 3) current = current.parentNode;
			  let depth = 0;
			  while (current !== null && current !== undefined && current.nodeType === 1 && depth < maxDepth) {
			    try {
			      if (typeof current.matches === 'function' && current.matches(CANDIDATE_SELECTOR)) return current;
			    } catch {
			      // matches 不可用/选择器被拒：退化成属性探针。
			    }
			    try {
			      if (typeof current.getAttribute === 'function'
			        && current.getAttribute('data-process-activity') !== null) return current;
			    } catch {
			      return null;
			    }
			    current = current.parentNode;
			    depth += 1;
			  }
			  return null;
			}

			/**
			 * 决定染色作用域。
			 *
			 * 见 `css.js` 的作用域表。判断顺序与 `classifyAttrs` 的优先级保持一致。
			 *
			 * ⚠️ 没有 `stripe` 分支：那个作用域服务于用户/助手消息块，已整体删除
			 * （实测会把颜色画到整列左缘、与靠右的气泡脱节）。
			 *
			 * @param attrs 属性快照。
			 * @param options.hasDetail 过程组标题里是否带详情（见 `hasTitleDetail`）。
			 * @returns 作用域名。
			 */
			function scopeFor(attrs, options = {}) {
			  if (attrs['data-slot'] !== undefined) return 'tint';
			  // 过程组标题是一个 `<button>`，不是 DisclosureRow，没有折叠表头结构。
			  //
			  // ⚠️ 分成两个作用域，**不能**只用一个 + CSS 的 `:not(:has())` 兜底：
			  // 兜底规则会在"切分被 React 重渲染冲掉"的那一帧重新匹配上整段标题，
			  // 于是正文被整段染色、下一帧再切回来 —— 视觉上就是**闪烁**
			  // （用户实测反馈："正文的上色是闪烁的"）。
			  // 拆开后，"有详情"的元素只认 `[data-cc-part]`：切分短暂失效时表现为
			  // "标签那一瞬间没颜色"，绝不会把正文染色。
			  if (attrs['data-process-activity'] !== undefined) {
			    return options.hasDetail === true ? 'title-part' : 'title';
			  }
			  if (attrs['data-tool'] !== undefined) return 'header';
			  if (attrs['data-variant'] === 'think') return 'header';
			  // 通用命令卡片（`data-variant="others"`）：它内部就是标准 `DisclosureRow`
			  // （`[data-disclosure-header]` + `_title` + `_summary`）。压缩**进行中**走的
			  // 就是这条路径，所以必须用 `header`。
			  // ⚠️ 这一条**必须排在下面那条 `data-variant !== undefined -> self` 之前**：
			  // 那条是给 bash 行（`data-variant="bash"`）准备的兜底，会把 `others` 也吞掉，
			  // 于是进行中的压缩行落到 `self`、只匹配 `_title` 而**命不中 `_summary`**
			  // —— 表现就是"文字里只有 title 有色、'正在压缩…' 还是灰的"。
			  //    ⚠️ 但**通用命令卡片**里跑的不只有压缩：其他斜杠命令（`/clear` 等）也走
			  //    `data-variant="others"`，它们的 summary 是"结果详情"，应该保持灰色。
			  //    只有压缩这一行的 summary 是**状态文字**（"正在压缩…"），要和标题一起染。
			  if (attrs['data-variant'] === 'others') {
			    return options.category === 'compaction' ? 'plain' : 'header';
			  }
			  // bash 工具行（BashRow）：根元素只有 `data-sample` + `data-variant="bash"`。
			  // 它**不是 DisclosureRow**（没有 `[data-disclosure-header]`），所以不能用
			  // `header` 作用域（那些规则会一条都匹配不到，表现为"上色了但没效果"）。
			  // 它的结构是「根元素 + leading svg + `_title` 标签」，正是 `self` 作用域的形状。
			  if (attrs['data-sample'] !== undefined || attrs['data-variant'] !== undefined) return 'self';
			  if (attrs['data-kind'] !== undefined) return 'self';
			  // 重试行 / 压缩行：只有类名钩子，且状态文字是**普通 span**
			  // （`<summary><span class="…_retryText">`），不是 button/a ——
			  // 落到 `tint`（只匹配 button/a）会一条都命不中，表现是"打了标却没颜色"。
			  if (isRetryRow(attrs) || isCompactionRow(attrs)) return 'plain';
			  return 'tint';
			}

			/**
			 * 从 React 内部记录里读出这一行**真实的命令原文**。
			 *
			 * ## 为什么必须这么做（"命令三档没有差异"的根因）
			 *
			 * 内核折叠状态下的 bash 行**只渲染「描述」**，真实命令并不在 DOM 里：
			 *
			 * ```jsx
			 * // StartedBashRow → ToolRow
			 * normalSummary = terminalBody?.description ?? summary
			 * //                                    ^^^^^^^^^^^ 模型给的自然语言描述，
			 * //                                                例如"显示当前工作目录"
			 * // 真实命令（`pwd`）只在**展开后**的 TerminalBlock 里才进 DOM
			 * ```
			 *
			 * 实测（真机 probe）：行上的可见文字是"显示当前工作目录"「列出当前目录内容」
			 * 「创建测试目录并递归改权限」这类描述。拿这些描述过 `commandRisk`，
			 * **八条里八条都是 low** —— 因为危险词在命令原文里（`curl`、`chmod -R`、
			 * `dd if=`、`mkfs`），描述里一个都没有。于是所有行都染成同一档，
			 * 用户看到的就是"命令的三个颜色层级没有实现"。
			 *
			 * 真实命令可以从 React 挂在元素上的 fiber 节点里读到
			 * （`fiber.return.memoizedProps.block.call.argsRaw`，实测路径见探测记录）。
			 * 这是内核私有结构，所以**每一步都做存在性检查**，任何一步缺失就返回 null、
			 * 退回原来的文本判定 —— 宁可分级不准，也绝不能因为读不到而抛错。
			 *
			 * @param element 行根元素。
			 * @returns 命令原文（JSON 里的 `command` 字段），读不到时返回 null。
			 */
			function commandTextFromFiber(element) {
			  try {
			    const fiberKey = Object.keys(element).find((k) => k.startsWith('__reactFiber'));
			    if (fiberKey === undefined) return null;
			    let node = element[fiberKey];
			    for (let depth = 0; depth < 20 && node !== null && node !== undefined; depth += 1) {
			      const props = node.memoizedProps;
			      if (props !== null && typeof props === 'object' && props.block !== undefined && props.block !== null) {
			        const block = props.block;
			        const raw = block.call !== undefined && block.call !== null
			          ? block.call.argsRaw
			          : block.argsRaw;
			        if (typeof raw !== 'string' || raw === '') {
			          node = node.return;
			          continue;
			        }
			        const parsed = JSON.parse(raw);
			        const command = parsed?.command;
			        if (typeof command === 'string' && command !== '') return command;
			      }
			      node = node.return;
			    }
			    return null;
			  } catch {
			    // 内核结构变了/JSON 解析失败：退回可见文本判定，不影响上色。
			    return null;
			  }
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
			function dangerText(element, attrs) {
			  try {
			    // 只有 bash 行才去读 fiber：这是内核的私有结构，别的行（read/write…）的
			    // fiber 里也可能挂着 block，误读会把它劫持成命令行、类别全乱。
			    // 真机 bash 行的根元素是 `data-sample="bash"` + `data-variant="bash"`。
			    const isBash = attrs?.['data-sample'] === 'bash' || attrs?.['data-variant'] === 'bash';
			    if (isBash) {
			      const command = commandTextFromFiber(element);
			      if (command !== null) return command.slice(0, 300);
			    }
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
			 * 把过程组标题里的「标签」与「详情」切开，给标签套一层可由 CSS 命中的 `span`。
			 *
			 * ## 为什么必须动 DOM（这是"上色不完全"的根因）
			 *
			 * 内核 `ProcessGroupHeader`（实测）：
			 *
			 * ```js
			 * const title = detail === "" ? label : `${label}${t("message.turnProcess.separator")}${detail}`;
			 * jsx(TextShimmer, { className: css.label, children: title });
			 * ```
			 *
			 * **标签与详情是同一个字符串**，落在同一个文本节点里。CSS 没有任何办法只染
			 * 前半段。之前为了"别染到分析正文"，只能整段不染（`icon` 作用域）—— 于是
			 * 「准备运行命令 · cd ~/Projects」「正在分析请求 · Actu…」这类带详情的标题
			 * **完全不染色**，用户看到的就是"上色不完全"。
			 *
			 * 现在改成：把文本节点按分隔符切开，标签那半段包进
			 * `<span data-cc-part="label">`，详情留在外面。样式层只染
			 * `[data-cc-part="label"]` —— 标签有色、详情保持原生，两个诉求同时满足。
			 *
			 * ⚠️ 只切**第一个**分隔符：详情里再出现 ` · ` 也属于详情，不能跟着染色。
			 * ⚠️ 该元素每轮都重判（见 `tagElement`），所以内核重渲染后会自动重新切分；
			 *    这里先检查是否已切过，避免重复包裹。
			 * ⚠️ 要处理**多个文本节点**：内核的 `TextShimmer` 在 `active`（流式中）时会把
			 *    同一个 title **渲染两份** —— 一份正常、一份在 `aria-hidden` 的 shimmer
			 *    sweep 里做扫光动画。所以"只有一个文本节点"的假设不成立；只切第一份会让
			 *    动画副本仍然整段着色，也会让切分在流式期间静默失效。这里对**每个**含分隔符
			 *    的文本节点都切一次。
			 *
			 * @param element 过程组标题元素（`data-process-activity`）。
			 * @returns 是否完成切分（无可切内容时返回 false）。
			 */
			function splitTitleLabel(element) {
			  try {
			    if (typeof element.querySelectorAll !== 'function') return false;
			    // ⚠️ 遍历**所有** `_label`，不能只看第一个：流式期间 TextShimmer 会渲染两份
			    // 标题（正常一份 + aria-hidden 的扫光副本），只看第一个会让动画副本整段着色。
			    const labels = element.querySelectorAll('[class*="_label"]');
			    if (labels.length === 0) return false;
			    const doc = element.ownerDocument;
			    if (doc === null || doc === undefined || typeof doc.createTreeWalker !== 'function') return false;

			    let split = false;
			    for (const label of labels) {
			      const walker = doc.createTreeWalker(label, 4 /* NodeFilter.SHOW_TEXT */);
			      const nodes = [];
			      let node;
			      while ((node = walker.nextNode()) !== null) nodes.push(node);
			      for (const textNode of nodes) {
			        const text = textNode.nodeValue;
			        if (typeof text !== 'string' || text === '') continue;
			        const at = text.indexOf(TITLE_SEPARATOR);
			        // ⚠️ 必须 `> 0`，不能 `!== -1`：
			        //  - `at === 0` 说明分隔符在最前面（空标签），切出来是个空 span；
			        //  - 更重要的是**幂等**：切分后详情那半段以分隔符开头，如果这里允许
			        //    `at === 0`，每次扫描都会在它前面再插一个空 span，无限堆积。
			        if (at <= 0) continue;
			        const parent = textNode.parentNode;
			        if (parent === null || parent === undefined) continue;
			        // 用 span 包住标签，详情文字原样留在同一个父节点里。
			        const wrapper = doc.createElement('span');
			        wrapper.setAttribute(PART_ATTR, 'label');
			        wrapper.textContent = text.slice(0, at);
			        textNode.nodeValue = text.slice(at);
			        parent.insertBefore(wrapper, textNode);
			        split = true;
			      }
			    }
			    return split;
			  } catch {
			    // 只读/结构异常：放弃切分（退回整段不染），不影响其他元素。
			    return false;
			  }
			}

			/**
			 * 给单个元素打标。
			 *
			 * ## 幂等，但过程组标题例外（这是"分析正文被上色"的根因）
			 *
			 * 普通元素打一次就够，靠 `MARK_ATTR` 跳过重复扫描。
			 *
			 * ⚠️ **但过程组标题（`data-process-activity`）的文本会持续变化**：内核
			 * `ProcessGroupHeader` 在**流式生成时**把「标签 + `' · '` + 分析正文」拼在同一个
			 * 文本节点里（`summary.runningDetail`），而组关闭后又会退回纯标签。
			 * 如果沿用"打一次就跳过"，第一次打标时正文还没到，作用域被定成 `title`
			 * （染文字）；等正文真的追加上来时**已经不会再重新判定** —— 于是整段分析正文
			 * 被染上颜色，正是用户反馈的"上色部分太多"。
			 *
			 * 所以这类元素**每次扫描都重新判定**（数量很少：每轮最多几十个），
			 * 让它能随文本变化重新切分「标签 / 详情」。
			 *
			 * @param element 候选元素。
			 * @returns 打上的类别 id，或 null（未打标）。
			 */
			function tagElement(element) {
			  if (element === null || element === undefined) return null;
			  if (typeof element.getAttribute !== 'function') return null;

			  const attrs = readAttrs(element);
			  // 幂等：普通元素只处理一次；**判定依据会变的元素**每次都重判。
			  //
			  // 两类必须重判：
			  //  - 过程组标题（`data-process-activity`）：文本会在「标签 · 分析正文」之间来回变；
			  //  - 权限选择控件（`conversation.input.permission`）：**同一个元素**在切换权限等级时
			  //    只改文字，不换节点。用户反馈「4 个权限等级切换后颜色不会跟随切换」就是
			  //    因为这里把它当静态元素、被 `data-cc-mark` 永久冻结成了第一次的颜色。
			  const dynamic = attrs['data-process-activity'] !== undefined
			    || attrs['data-slot'] === 'conversation.input.permission';
			  if (!dynamic && element.getAttribute(MARK_ATTR) !== null) return element.getAttribute(CAT_ATTR);

			  const text = dangerText(element, attrs);
			  const category = classifyAttrs(attrs, { text, element });
			  if (category === null) return null;

			  try {
			    // 过程组标题：把「标签」切出来，才能只染标签、不染详情（见 splitTitleLabel）。
			    if (attrs['data-process-activity'] !== undefined) splitTitleLabel(element);
			    element.setAttribute(CAT_ATTR, category);
			    element.setAttribute(SCOPE_ATTR, scopeFor(attrs, {
			      hasDetail: hasTitleDetail(text),
			      category,
			    }));
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
			          if (record.type === 'childList') {
			            for (const node of record.addedNodes) pending.push(node);
			            // ⚠️ **必须也看 removedNodes**：React 重渲染标题时会重设文本内容，
			            // 把运行时插入的 `[data-cc-part="label"]` 一起移除。只处理 addedNodes
			            // 就永远等不到"重新切分"的触发，于是标签时有时无、正文时而被整段染色
			            // —— 用户看到的就是"上色闪烁"。
			            // 被移除的是自己的标签段时，把它的宿主元素重新入队（交给 nearestCandidate
			            // 上溯到带 `data-process-activity` 的按钮）。
			            for (const node of record.removedNodes) {
			              let mine = false;
			              try {
			                if (node.nodeType === 1) {
			                  // ⚠️ 不能只判断"被移除的**就是**我的标签段"。
			                  // React 重渲染时移除的往往是**包含**它的上层子树
			                  // （如 TextShimmer 的 `_content` / `_text` 包装层），
			                  // 此时 `removedNodes` 里直接给的是那个祖先，标签段只是后代。
			                  // 只比对 `node.matches()` 会漏掉这种最常见的情况，
			                  // 于是永远不重新切分 → 标签时有时无、正文时而被整段染色
			                  // （用户看到的"闪烁"）。
			                  // 因此改成"**包含**标签段也算"，对整个被移除子树做一次查询。
			                  const isPart = (el) => typeof el.matches === 'function'
			                    && el.matches(`[${PART_ATTR}]`);
			                  mine = isPart(node)
			                    || (typeof node.querySelector === 'function'
			                        && node.querySelector(`[${PART_ATTR}]`) !== null);
			                }
			              } catch {
			                mine = false;
			              }
			              if (!mine) continue;
			              const owner = nearestCandidate(record.target);
			              if (owner !== null) pending.push(owner);
			            }
			            continue;
			          }
			          // ⚠️ `characterData` 必须观察：过程组标题的「标签 · 分析正文」是**文本
			          // 变化**（React 改 textNode.nodeValue），不会产生 childList 记录。
			          // 不观察它就永远看不到正文追加上来的那一刻，作用域会一直停在最初判定。
			          if (record.type === 'characterData') {
			            // 文本节点的父元素不是候选元素（`data-process-activity` 在外层
			            // `<button>` 上），必须上溯到最近的候选，否则这次重判必然空转。
			            const owner = nearestCandidate(record.target);
			            if (owner !== null) pending.push(owner);
			          }
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
			    // childList（新增节点）+ characterData（文本变化）。
			    // 我们只写 `data-*` **属性**，属性变化不在观察范围内，所以不会自激循环。
			    observer.observe(target, { childList: true, subtree: true, characterData: true });
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
			const { ALL_CATEGORIES, CATEGORIES, CONTROL_CATEGORIES, PERMISSION_CATEGORIES, PRESETS } = __dshRequire("./constants.js");
			const { presetColorFor, presetColors } = __dshRequire("./palettes.js");
			const { CATEGORY_KEYS, PRESET_KEYS } = __dshRequire("./locale.js");
			const { sanitizeColor, scopedPreviewCss } = __dshRequire("./css.js");

			/** 预设选择顺序。 */
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
			  const palette = presetColors(presetId);
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
			    { cat: 'commandLow', label: t('categoryCommandLow') },
			    { cat: 'commandMid', label: t('categoryCommandMid') },
			    { cat: 'commandHigh', label: t('categoryCommandHigh') },
			    { cat: 'thinking', label: t('categoryThinking') },
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
			              // 顺序取自 constants.js 的 PRESETS（单一真源），不在这里另抄一份。
			              options: PRESETS.map((id) => ({ value: id, label: t(PRESET_KEYS[id]) })),
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

			        // ── 权限等级 ──────────────────────────────────────────────
			        jsxs('section', {
			          children: [
			            jsx('h3', { style: { margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: t('permissionsTitle') }),
			            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginBottom: '4px' }, children: t('permissionsHint') }),
			            ...PERMISSION_CATEGORIES.map((category) => jsx(CategoryRow, { t, category, draft, onEdit: edit }, category)),
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



			Object.assign(__exports, { "ColorfulCommandsCard": ColorfulCommandsCard, "ALL_CATEGORIES": ALL_CATEGORIES, "PERMISSION_CATEGORIES": PERMISSION_CATEGORIES, "presetColors": presetColors });
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
			 * ## 生命周期：先注册、后接 scope
			 *
			 * 卡片**无条件注册**，而 settings scope 可能晚到（甚至永远不到）。所以本对象
			 * 先以 `scope === undefined` 的降级状态构造，之后由 `attachScope(scope)` 接上。
			 *
			 * 为什么必须这样拆（实测事故）：第一版把"注册卡片"放在 `whileServed` 内部，
			 * 命名空间没就绪时卡片**从未注册**，设置页一片空白 —— 而且不报错，测试全绿。
			 *
			 * @param options.scope 初始 scope（可省略）。
			 * @param options.t 文案函数。
			 * @param options.onError 失败回调。
			 * @returns face 对象。
			 */
			function createSettingsFace(options = {}) {
			  const { t } = options;
			  const report = typeof options.onError === 'function' ? options.onError : () => {};

			  /** 当前 scope（可被 attachScope 替换）。 */
			  let scope = options.scope;
			  let unsubscribe;
			  /**
			   * 配置变化回调：由调用方（client.js）注入，用来把最新配置写成样式表。
			   *
			   * 之所以要这个回调而不是让 face 自己写样式：face 只该管"设置数据"，
			   * 样式注入是 client 的职责（它持有 styleElement）。分开也让 face 可单测。
			   */
			  const notifyConfigChange = typeof options.onConfigChange === 'function'
			    ? options.onConfigChange
			    : () => {};

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

			  /** scope 变化时：非脏则跟随，脏则保留用户草稿，并**通知外部重渲染样式**。 */
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
			      // ⚠️ 必须把最新草稿交回给调用方去**重渲染样式表**。
			      // 曾经的教训：拆开"注册卡片"与"绑定 scope"之后，这里只更新了 store，
			      // 没人再调 renderFromConfig —— 结果改配置界面不动，测试立刻抓到了。
			      notifyConfigChange(store.getSnapshot().config);
			    } catch (error) {
			      report('face:sync', error);
			    }
			  };

			  /** 订阅当前 scope（先退订旧的）。 */
			  const bindScopeSubscriptions = () => {
			    try {
			      unsubscribe?.();
			    } catch { /* 忽略 */ }
			    unsubscribe = undefined;
			    try {
			      if (typeof scope?.subscribe === 'function') unsubscribe = scope.subscribe(syncFromScope);
			    } catch (error) {
			      report('face:subscribe', error);
			    }
			    syncFromScope();
			  };

			  if (scope !== undefined) bindScopeSubscriptions();

			  const face = {
			    /**
			     * 接上（或替换）settings scope。晚到也能用：卡片早已注册。
			     *
			     * @param nextScope configForms 的命名空间 scope。
			     */
			    attachScope: (nextScope) => {
			      scope = nextScope;
			      try {
			        store.update((state) => {
			          state.available = nextScope !== undefined;
			          state.writable = nextScope?.getSnapshot?.().writable !== false;
			        });
			      } catch (error) {
			        report('face:attach', error);
			      }
			      bindScopeSubscriptions();
			    },
			    /** 断开 scope（命名空间下线）。 */
			    detachScope: () => {
			      try {
			        unsubscribe?.();
			      } catch { /* 忽略 */ }
			      unsubscribe = undefined;
			      scope = undefined;
			      try {
			        store.update((state) => {
			          state.available = false;
			          state.writable = false;
			        });
			      } catch (error) {
			        report('face:detach', error);
			      }
			    },
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
			      // scope 还没到 / 不可写：标记失败而不是抛错（卡片是无条件注册的，
			      // 命名空间可能永远不到，这条路径必须能安全走过）。
			      if (scope === undefined || typeof scope.set !== 'function' || before.writable === false) {
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
			const { LOCALE_NS, PLUGIN_ID, SETTINGS_NAMESPACE, STYLE_TAG_ID } = __dshRequire("./constants.js");
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

			  // ── 4. 设置卡片  // ── 4. 设置卡片  // ── 4. 设置卡片：**无条件注册** ─────────────────────────────────
			  //
			  // ⚠️⚠️ 这里曾经是本插件"设置页什么都不显示"的真正原因，务必别改回去。
			  //
			  // 第一版把 `registerCard(...)` 放在了 `forms.whileServed([命名空间], cb)`
			  // **内部**，于是：
			  //   命名空间未就绪 → whileServed 不触发 → 卡片**从未注册** → 设置页空白。
			  // 而且这**不报错**（whileServed 只是等待，不算失败），所以测试全绿、日志干净，
			  // 完全看不出问题。
			  //
			  // 规范原话（dsh-connect-workbuddy 的注释）：
			  //   「渲染条件由组件自己决定：**无条件注册**、组件里读投影判断是否返回 null。
			  //     注册是条件性的会导致『该出现时不出现』。」
			  //
			  // 所以：卡片**无条件注册**；settings scope 单独在下面绑定，晚到也没关系
			  // —— face 对 `scope === undefined` 有完整降级（显示默认色 + 只读提示）。
			  const face = createSettingsFace({
			    scope: undefined,
			    t,
			    // 配置变化 → 重渲染样式表。face 只管设置数据，样式注入是这里的职责。
			    onConfigChange: (config) => {
			      current = config;
			      renderFromConfig(config);
			    },
			    onError: (where, error) => {
			      failures.push({ where, message: String(error?.message ?? error), stack: '' });
			    },
			  });
			  guard(failures, 'settings:register-card', () => {
			    const offCard = registerCard(ctx, failures, t, face);
			    ctx.effect(() => offCard, `${PLUGIN_ID}: settings card`);
			  });

			  // ── 5. 设置：绑定命名空间并跟随变化（与卡片注册解耦） ────────────
			  guard(failures, 'settings:bind-namespace', () => {
			    // configForms 用 ctx.get 探测：命名空间可能晚于 apply 到达。
			    // ⚠️ `ctx.get` 本身也可能不在（极端降级上下文），所以要判类型再调。
			    const get = typeof ctx.get === 'function' ? ctx.get.bind(ctx) : undefined;
			    const forms = get === undefined ? undefined : get('configForms');
			    if (forms === undefined || typeof forms.whileServed !== 'function') {
			      // 没有 settings 服务：插件仍工作（用默认配色），只是不能配置。
			      // 注意这是**降级而非失败**：不 push failures，避免把正常部署误报成故障。
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

			      // 把 scope 接进已经注册好的卡片面（卡片本身早已注册，与这里无关）。
			      face.attachScope(scope);
			      return () => {
			        face.detachScope();
			      };
			    }), `${PLUGIN_ID}: settings namespace`);
			  });

			  // ── 6. 写启动报告（无论成败；ok:false 会列出失败步骤） ──────────
			  guard(failures, 'boot-report', () => {
			    writeBootReport(failures, { inject: inject.join(',') });
			  });
			}

			/**
			 * 注册设置卡片到「插件详情页」。
			 *
			 * ## 插槽名（这里曾经写错，导致设置页根本不出现）
			 *
			 * plugin-manager 内核源码里的三个配置插槽，各有明确归属：
			 *
			 * | 插槽 | kind | 归属 |
			 * |---|---|---|
			 * | `plugins.item` | list | **官方插件**，按 `id` 列在「内置插件配置」分组 |
			 * | `plugins.bundle.config` | keyed | **组合包自己的配置**，`key` = 组合包包名 |
			 * | `plugins.row.config` | keyed | 组合包里某一行，`key` = `<包名>#<行 id>` |
			 *
			 * 本插件是 profile 里的**第三方组合包**，所以必须用 `plugins.bundle.config`
			 * 且 `key` 写包名 —— 内核按 `ledger.bundles.has(pkg.name)` 决定是否渲染，
			 * 用 `plugins.item` 会**什么都不显示**（第一版就是这个错误）。
			 *
			 * ⚠️ keyed 槽用 `key:`，list 槽用 `id:`；写错属性名同样静默不显示。
			 * 参考实现（本机已验证可用）：`dsh-connect-workbuddy` 的 `registerCard`。
			 *
			 * ## 时机
			 *
			 * 用 `slots.inject(槽名, cb)` 而不是直接 `register`：`inject` 会**等该插槽被
			 * 声明**再执行回调，避免与 plugin-manager 声明插槽的时机竞争。
			 *
			 * @param ctx 客户端上下文。
			 * @param failures 失败收集器。
			 * @param t 文案函数。
			 * @param face 设置面。
			 * @returns disposer。
			 */
			function registerCard(ctx, failures, t, face) {
			  const SLOT = 'plugins.bundle.config';
			  try {
			    const register = () => ctx.slots.register({
			      name: SLOT,
			      // keyed 槽：key 必须是**组合包包名**（内核据此匹配 pkg.name）。
			      key: PLUGIN_ID,
			      priority: 30,
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

			    if (typeof ctx.slots.inject === 'function') {
			      return ctx.slots.inject(SLOT, register);
			    }
			    return register();
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
		globalThis.__CC_BUILD_STAMP__ = "2026-10-16T07:26:05.035Z";
