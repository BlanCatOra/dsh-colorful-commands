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
import { DANGER_PATTERNS } from './constants.js';

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
 *
 * ⚠️ `user` / `message` 不再映射 —— 它们是**消息本体**，不是过程行；给消息
 * 本体上色没有意义（而且消息行的 DOM 层级与过程行不同，见 constants.js 的说明）。
 * 未映射的 kind 会落到 `null`（不着色），这是刻意的。
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
 * 取值来自内核 `ui-chat` 的 `PROCESS_ICONS` 与 `message.stepProcess.*` 文案键
 * （实测枚举）：thinking / read / readImage / search / edit / write / commands /
 * code / plan / questions / subagents / tools / webFetch / webSearch。
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
 * 套一层 `[data-slot="<槽名>"]`，这是**官方稳定契约**（不是内部实现细节），
 * 所以"其他控件也一样可染色"就靠它。
 *
 * ⚠️ **只列有明确语义的控件槽。** `left` / `right` / `dock` / `overlay` /
 * `attachments` 装的是加号按钮、斜杠命令触发器等**原生控件**：给它们上色会
 * 波及弹出的菜单（实测斜杠命令菜单项被涂灰，非常难看），而且这些按钮本来
 * 就有清晰的语义配色。刻意不碰。
 */
const SLOT_CATEGORY = {
  'conversation.input.permission': 'ctl-permission',
  'conversation.input.model': 'ctl-model',
  'conversation.input.plan': 'ctl-plan',
  'conversation.input.activity': 'ctl-activity',
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
export function isDangerousCommand(text) {
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
export function classifyAttrs(attrs, options = {}) {
  const a = attrs ?? {};

  // 0. 跳过已染色行的**内部**子部件。
  //    实测：bash 工具行内部还有一个 `data-sample="bash"` 的卡片根，它也带
  //    `data-variant="bash"`。若一并染色，同一条命令会出现两条竖条、两层着色。
  //    外层（带 `data-tool`）已经覆盖了它，这里直接退出。
  if (a['data-sample'] !== undefined) return null;

  // 1. 插槽锚点优先：控件类与消息类不重叠，先判更具体的。
  const slot = a['data-slot'];
  if (typeof slot === 'string' && Object.hasOwn(SLOT_CATEGORY, slot)) return SLOT_CATEGORY[slot];

  // 1.5 过程组标题（"执行了命令"/"已完成分析"）—— 它们**不带 data-tool**，
  //     只有 data-process-activity，所以必须单独判，否则整类漏掉不着色。
  const activity = a['data-process-activity'];
  if (typeof activity === 'string' && activity !== '') {
    return ACTIVITY_CATEGORY[activity] ?? 'other';
  }

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

  // ⚠️ 刻意不处理 `data-chat-flow-kind`：它是**整列宽**的 flowItem 包裹层，
  // 而消息气泡在内部靠右 —— 给它上色会把竖条画到窗口最左缘，与内容脱节
  // （实测截图里那条红竖线就是这个）。见 constants.js 的说明。

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
export function readAttrs(element) {
  if (element === null || element === undefined || typeof element.getAttribute !== 'function') return {};
  const names = [
    'data-slot',
    'data-process-activity',
    'data-tool',
    'data-variant',
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
