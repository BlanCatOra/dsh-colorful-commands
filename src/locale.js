/**
 * dsh-colorful-commands —— 文案字典。
 *
 * 全部界面文案走 `ctx.locale`，不硬编码中文（UI 规范 §1.1）。
 * 每个键都必须同时提供 zh 与 en，缺一边会在类型检查处暴露。
 *
 * @module dsh-colorful-commands/locale
 */
import { LOCALE_NS } from './constants.js';

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

  // ⚠️ previewTitle / previewHint 已随「预览」区块一起删除
  //    （用户 2026-10-17：「设置里的这个预览删掉 有bug 懒得修」）。
  //    不要再加回来，除非同时重新实现预览组件。

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
  // ⚠️ 聚合标题：同一过程组里同时含多种活动（内核把它们拼成一句话，
  //    `data-process-activity` 只留其中一个）。给它中性色，消除"同件事三色"的混乱。
  categorySummary: '混合活动',
  categoryDone: '已完成',
  // data-turn-process 按钮的另外两种态（失败/中止），与 done 同源：
  // 内核 `TurnProcessNodeView` 按 reason 换文案，这里按文案分色。
  categoryTurnError: '处理失败',
  categoryTurnStopped: '已停止',
  categoryMeta: '消息用量',
  categoryUsageLow: '上下文用量（宽裕）',
  categoryUsageMid: '上下文用量（中等）',
  categoryUsageHigh: '上下文用量（偏高）',
  categoryUsageCritical: '上下文用量（临界）',

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

  // ⚠️ previewTitle / previewHint removed together with the Preview block
  //    (user 2026-10-17: "delete this preview in settings, it has bugs").
  //    Do not re-add unless the preview component is reimplemented.

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
  categorySummary: 'Mixed activities',
  categoryDone: 'Completed',
  categoryTurnError: 'Failed',
  categoryTurnStopped: 'Stopped',
  categoryMeta: 'Message usage',
  categoryUsageLow: 'Context usage (low)',
  categoryUsageMid: 'Context usage (medium)',
  categoryUsageHigh: 'Context usage (high)',
  categoryUsageCritical: 'Context usage (critical)',

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
export const CATEGORY_KEYS = {
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
  summary: 'categorySummary',
  done: 'categoryDone',
  turnError: 'categoryTurnError',
  turnStopped: 'categoryTurnStopped',
  meta: 'categoryMeta',
  usageLow: 'categoryUsageLow',
  usageMid: 'categoryUsageMid',
  usageHigh: 'categoryUsageHigh',
  usageCritical: 'categoryUsageCritical',
  'ctl-permission': 'categoryCtlPermission',
  'ctl-plan': 'categoryCtlPlan',
  'perm-readonly': 'categoryPermReadonly',
  'perm-workspace': 'categoryPermWorkspace',
  'perm-full': 'categoryPermFull',
  'perm-auto': 'categoryPermAuto',
};

/** 预设 id → 文案键。 */
export const PRESET_KEYS = {
  none: 'presetNone',
  chinese: 'presetChinese',
  japanese: 'presetJapanese',
  macaron: 'presetMacaron',
};

/** 注册到 ctx.locale 的字典集合。 */
export const dictionaries = { zh, en };

export { LOCALE_NS };
