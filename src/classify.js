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
import { PERMISSION_LEVELS, TITLE_SEPARATOR, commandRisk } from './constants.js';

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
export function isRetryRow(attrs) {
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
export function isCompactionRow(attrs) {
  const cls = attrs?.class;
  if (typeof cls !== 'string') return false;
  return cls.includes('_compactionRow')
    || cls.includes('_compactionButton')
    || cls.includes('_compactionLeading');
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
export function permissionLevel(text) {
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
export function classifyAttrs(attrs, options = {}) {
  const a = attrs ?? {};

  // 0. 重试行 / 压缩行：它们没有任何语义化 data-* 属性，只能靠类名后缀识别。
  if (isRetryRow(a)) return 'retry';
  if (isCompactionRow(a)) return 'compaction';

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
export function commandCategory(text) {
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
export function hasTitleDetail(text) {
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
export function readAttrs(element) {
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
export const _tables = { TOOL_CATEGORY, VARIANT_CATEGORY, KIND_CATEGORY, ACTIVITY_CATEGORY, SLOT_CATEGORY };
