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
export function readAttrs(element) {
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
export const _tables = { TOOL_CATEGORY, VARIANT_CATEGORY, KIND_CATEGORY, FLOW_CATEGORY, SLOT_CATEGORY };
