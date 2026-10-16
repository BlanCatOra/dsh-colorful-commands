/**
 * dsh-colorful-commands —— 共享常量。
 *
 * 这里的取值同时被 Host 侧（设置 schema）与浏览器侧（bundle）消费，
 * 是两侧唯一的真源。改这里必须同时重建 bundle。
 *
 * @module dsh-colorful-commands/constants
 */

/** 包名。必须与 package.json 的 name 完全一致（bundle 注册键）。 */
export const PLUGIN_ID = 'dsh-colorful-commands';

/**
 * 设置命名空间。
 *
 * ⚠️ 实测契约：DSH 的 settings 服务按 **loader entry id** 建命名空间
 * （`ns: entry.options.id`），而 entry id 来自 cordis.patch.yml 里那条
 * `insert.id`。本插件的 patch 用的就是包名，所以这里等于包名。
 * 改 cordis.patch.yml 的 id 就必须同步改这里，否则设置页永远读到默认值。
 */
export const SETTINGS_NAMESPACE = 'dsh-colorful-commands';

/** locale 命名空间（文案字典）。 */
export const LOCALE_NS = 'settings.colorful-commands';

/** 注入样式标签的标识，卸载/HMR 时据此移除。 */
export const STYLE_TAG_ID = 'dsh-colorful-commands';

/** 内置预设 id。 */
export const PRESET_NONE = 'none';
export const PRESET_CHINESE = 'chinese';
export const PRESET_JAPANESE = 'japanese';
export const PRESET_MACARON = 'macaron';

/**
 * 预设显示顺序。
 *
 * ⚠️ 删掉了旧的 `custom`：它和 `none` **行为完全相同**（都不铺预设），
 * 界面上却多一个选项，用户分不清两者区别。自定义能力本来就在每个类别的
 * 取色器里，不需要单独一个"预设"来代表它。
 */
export const PRESETS = [PRESET_CHINESE, PRESET_JAPANESE, PRESET_MACARON, PRESET_NONE];

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
export const CATEGORIES = [
  'thinking',
  'commandLow',
  'commandMid',
  'commandHigh',
  'read',
  'write',
  'search',
  'web',
  'retry',
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
export const CONTROL_CATEGORIES = [
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
export const PERMISSION_LEVELS = {
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
export const CATEGORY_RETRY = 'retry';

/** 权限等级类别（用户要求"不同权限等级的颜色应该不同"）。 */
export const PERMISSION_CATEGORIES = [
  'perm-readonly',
  'perm-workspace',
  'perm-full',
  'perm-auto',
];

export const ALL_CATEGORIES = [
  ...CATEGORIES,
  ...CONTROL_CATEGORIES,
  ...PERMISSION_CATEGORIES,
];

/** 类别的中文名（内置兜底；界面文案走 locale 字典）。 */
export const CATEGORY_LABELS = {
  thinking: '思考 / 推理',
  commandLow: '命令 · 低风险',
  commandMid: '命令 · 中风险',
  commandHigh: '命令 · 高风险',
  read: '读取文件',
  write: '写入 / 编辑',
  search: '搜索',
  web: '网络请求',
  retry: '重试模型请求',
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
export const DANGER_HIGH = [
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

export const DANGER_MID = [
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
export function commandRisk(text) {
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
export const TITLE_SEPARATOR = ' · ';

/** 合法十六进制颜色（#RGB / #RRGGBB）。 */
export const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
