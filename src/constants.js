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

/** 设置卡片在「插件详情页」里的注册 id（必须自有，复用别人的会顶掉对方）。 */
export const CARD_ID = 'colorful-commands';

/** 注入样式标签的标识，卸载/HMR 时据此移除。 */
export const STYLE_TAG_ID = 'dsh-colorful-commands';

/** 内置预设 id。 */
export const PRESET_NONE = 'none';
export const PRESET_CHINESE = 'chinese';
export const PRESET_JAPANESE = 'japanese';
export const PRESET_MACARON = 'macaron';
export const PRESET_CUSTOM = 'custom';

/** 预设显示顺序。 */
export const PRESETS = [PRESET_NONE, PRESET_CHINESE, PRESET_JAPANESE, PRESET_MACARON, PRESET_CUSTOM];

/**
 * 着色类别。
 *
 * 每个类别对应一组稳定的 DOM 选择器（见 targets.js），互不重叠，
 * 因此用户给"思考"和"执行命令"选不同颜色时不会互相覆盖。
 */
export const CATEGORIES = [
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
export const CONTROL_CATEGORIES = [
  'ctl-permission',
  'ctl-model',
  'ctl-plan',
  'ctl-activity',
  'ctl-toolbar',
];

/** 全部可配置类别（消息 + 控件）。设置卡片按这个顺序渲染。 */
export const ALL_CATEGORIES = [...CATEGORIES, ...CONTROL_CATEGORIES];

/** 类别的中文名（内置兜底；界面文案走 locale 字典）。 */
export const CATEGORY_LABELS = {
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
export const DANGER_PATTERNS = [
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
export const DEFAULT_OPACITY = 100;

/** 合法十六进制颜色（#RGB / #RRGGBB）。 */
export const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
