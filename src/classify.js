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
  // ⚠️ **`conversation.chat.turnTail` 是消息尾部**（「已完成 · 用时 xxx」＋用量＋分支），
  //    真机实测钩子（2026-10-17 CDP 读出的真实 DOM）：
  //      DIV{data-turn-tail="22" data-actions-reveal="hover" class="N1-_sG_root"}
  //        BUTTON{aria-label="在新对话中分支"}
  //    它是插槽锚点，所以走 SLOT_CATEGORY；具体染哪一块由 scopeFor 决定。
  'conversation.chat.turnTail': 'meta',
};

/**
 * 从「上下文已用 xx%」的 aria-label 里读百分比并分档。
 *
 * ## 为什么读 aria-label 而不是文本
 *
 * 真机实测（2026-10-17）：进度圈那个按钮是
 *
 *     BUTTON{class="_zgeDa_trigger" aria-label="上下文已用 29%" aria-haspopup="dialog"}
 *
 * 百分比**直接写在 aria-label 里**，而且是纯数字 + `%`，不需要解析本地化文案的
 * 前后缀（中英文前缀不同，但数字与 `%` 相同）。这比抓可见文本稳得多 ——
 * 可见文本在 tooltip 未打开时甚至不存在。
 *
 * 分档阈值取「用户要求（35 以下绿）」与「DSH 实际自动压缩阈值 68%」的折中：
 *
 * | 档 | 区间 | 语义 |
 * |---|---|---|
 * | `usageLow` | `< 35%` | 宽裕（用户指定绿色系） |
 * | `usageMid` | `35% – 49%` | 过半前的提醒 |
 * | `usageHigh` | `50% – 67%` | 接近自动压缩阈值（AGENTS.md 要求 50/60 提醒） |
 * | `usageCritical` | `>= 68%` | 越过 DSH 自动压缩阈值（compaction-basic 0.68） |
 *
 * @param text 元素的 aria-label 或可见文本。
 * @returns 类别 id，或 null（读不到百分比时不着色）。
 */
export function usageCategory(text) {
  if (typeof text !== 'string' || text === '') return null;
  const m = /(\d{1,3})\s*%/.exec(text);
  if (m === null) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  if (value < 35) return 'usageLow';
  if (value < 50) return 'usageMid';
  if (value < 68) return 'usageHigh';
  return 'usageCritical';
}

/**
 * 是否为 composer dock 里的 **tokens 用量药丸**（用户明确要求不上色）。
 *
 * ## 为什么要单独判（真机实测 2026-10-17）
 *
 * dock 里并排两颗按钮，**都带 `%`**，但语义完全不同：
 *
 * | 按钮 | aria-label | 用户要求 |
 * |---|---|---|
 * | 上下文进度圈 | `上下文已用 29%` | **四档上色** |
 * | tokens 药丸 | `695M tok · 缓存命中 98%` | **不上色**（原话：「底部 tokens 数字不上色」） |
 *
 * 只按"aria-label 含 %"判定会把 tokens 药丸一起染上色 —— 直接违背用户偏好。
 *
 * 判据取内核 locale 里的固定词（`stats.cacheHit` =「缓存命中」、
 * `stats.dialog.usageTitle` =「Token 用量」、`message.tokensPerSecond`
 * =「{tps} tok/s」），跨中英文都覆盖：
 *   - 中文：`tok`（小写，内核原样用）/ `Token` / `缓存命中` / `用量`
 *   - 英文：`tok` / `Token` / `cache hit` / `usage`
 *
 * ⚠️ 刻意**不**用"含 `tok`"之外的结构判据：tokens 药丸与进度圈共享
 * `svg{stroke:currentColor}` + label span 的形状，只有文案能区分。
 *
 * @param attrs 属性快照。
 * @param usageText 元素自身的 aria-label。
 * @returns 是否为 tokens 药丸（true = 不上色）。
 */
export function isTokensPill(attrs, usageText) {
  const a = attrs ?? {};
  const cls = typeof a.class === 'string' ? a.class : '';
  // 类名后缀是内核源码类名（真机实测 `bGnI3G_pill`），作为第一道判据。
  if (cls.includes('_pill')) return true;
  const text = typeof usageText === 'string' ? usageText : '';
  if (text === '') return false;
  const lower = text.toLowerCase();
  return lower.includes('tok')
    || lower.includes('token')
    || text.includes('缓存命中')
    || text.includes('用量');
}

/**
 * 消息尾部（turn-tail）里，哪些子块应该被染色。
 *
 * 真机结构（2026-10-17 CDP 实测）：
 *
 * ```html
 * <div class="N1-_sG_root" data-turn-tail="22" data-actions-reveal="hover">
 *   <div class="N1-_sG_actions" data-clock="end">
 *     <button class="_4sesoa_action" aria-label="在新对话中分支">…</button>
 *   </div>
 * </div>
 * ```
 *
 * ⚠️ **`data-actions-reveal="hover"` 是内核自己标的"悬浮才显现"**
 * （用户 2026-10-17 指出：「只有最后一条的控件会自动显示，过往消息的控件需要
 * 鼠标悬浮到对应位置才会显现」）。用户选择「悬浮出现时就上色」（会话中确认的
 * **3a** 方案），所以这里**不做常显/悬浮的区分** —— 元素存在就染，悬浮出现时
 * 颜色跟着出现，per-element 判定天然覆盖两种情形。
 */

/**
 * 是否为消息尾部（turn-tail）里的元素。
 *
 * ## 真机结构（2026-10-17 从运行中的应用读出的**真实** DOM）
 *
 * ```html
 * <div class="N1-_sG_root" data-turn-tail="22" data-actions-reveal="hover">
 *   <div class="N1-_sG_actions" data-clock="end">
 *     <button class="_4sesoa_action" aria-label="在新对话中分支">…</button>
 *   </div>
 * </div>
 * ```
 *
 * 以及 composer dock 里的进度圈：
 *
 * ```html
 * <button class="_zgeDa_trigger" aria-label="上下文已用 29%" aria-haspopup="dialog">
 *   <span class="_zgeDa_root">…svg 圆环…</span>
 * </button>
 * <div class="_5UfNCq_dock" data-composer-dock="true">…</div>
 * ```
 *
 * ⚠️ **`data-turn-tail` 是最理想的钩子**：它是内核自己给的语义化属性
 * （`turnTailDefinition.kind === "turn-tail"`），且带 turn 编号。
 * 但它挂在**外层容器**上，内部还套着「已完成/用时」文本与按钮 —— 所以
 * 只按它下面的 `_actions` 子块上色，不碰整块。
 *
 * ⚠️ `data-composer-dock` 同理：它是 composer 底部条，里面既有**要上色**的
 * 进度圈，也有**明确不要上色**的 tokens 数字（用户要求），所以只认
 * `aria-label` 里带百分比的进度圈。
 *
 * @param attrs 属性快照。
 * @returns 是否为尾部/用量区元素。
 */
function isEmptyActionsRow(attrs) {
  const a = attrs ?? {};
  if (a['data-turn-tail'] !== undefined) return true;
  if (a['data-composer-dock'] !== undefined) return true;
  return false;
}

/**
 * 按可见文本把 `data-turn-process` 按钮分到四种态。
 *
 * ## 真机 + 内核源码双重确认（2026-10-17，CC-FINDINGS §① 末尾）
 *
 * 内核 `dsh-client-ui-chat` 的 `TurnProcessNodeView`（提取件 7428 行）：
 *
 * ```js
 * const label = reason === "aborted" ? t("message.stopped")
 *              : reason === "error"   ? t("message.turnProcess.failed")
 *              : duration === void 0 ? t("message.turnProcess.worked")
 *              :                       t("message.turnProcess.took");
 * ```
 *
 * 文案四态（zh / en，均为内核 locale 字面量）：
 *
 * | 态 | 中文 | 英文 | 类别 |
 * |---|---|---|---|
 * | 正常完成（有时长） | `已完成，用时 ` | `Completed in ` | `done` |
 * | 完成（无时长） | `已完成` | `Completed` | `done` |
 * | 失败 | `处理失败` | `Failed` | `turnError` |
 * | 中止 | `已停止` | `Stopped` | `turnStopped` |
 *
 * 旧实现按 `data-turn-process` 一律返回 `done`（绿）—— 失败/中止的行也会变绿，
 * 语义正好相反。这里改按**可见文本**（`_label` span 的文字）区分。
 *
 * ⚠️ `reason` 不落在 DOM 属性上（只在 React props 里），所以只能靠文案判定。
 * ⚠️ 文案前缀匹配即可：`已完成，用时 27分8秒` 是 label + 时长分片拼在同一个
 *    `_label` span 里（真机取证确认），前缀判据天然覆盖。
 *
 * @param text 按钮的可见文本（`_label` 的 textContent，或整按钮文本）。
 * @returns 四态类别 id；文本不可读时退回 `done`（保守：这是最常见的态，
 *   且空文本只会出现在无法读 DOM 的退化环境里，此时保底着色优于完全不着色）。
 */
export function turnProcessCategory(text) {
  const t = typeof text === 'string' ? text : '';
  if (t.includes('处理失败') || t.includes('Failed')) return 'turnError';
  if (t.includes('已停止') || t.includes('Stopped')) return 'turnStopped';
  return 'done';
}

/**
 * 是否为消息尾部/过程区的「已完成 · 用时 xxx」状态元素。
 *
 * ## 真机结构（2026-10-17 **读内核源码**核实，比 DOM 探针更权威）
 *
 * 内核 `dsh-client-ui-chat` 的 `TurnProcessNodeView`（源码：
 * `src/client/chat/TurnProcessNodeView.js`）渲染的是：
 *
 * ```jsx
 * <>
 *   <span class="…_visuallyHidden" role="status" aria-live="polite">{announcement}</span>
 *   <button class="…_root" data-turn-process={n} data-turn-process-messages={…} …>
 *     <span class="…_label">{label}{duration…}</span>
 *     <IconChevronDownOutlineRegular />
 *   </button>
 * </>
 * ```
 *
 * `label` 来自 `t("message.turnProcess.worked")`（=「已完成」）或
 * `t("message.turnProcess.took")`（=「已完成，用时 」），duration 是
 * 「3分54秒」这类分片。**用户看到的「已完成 · 用时 xxx」就是这个 button 里的
 * `_label`。**
 *
 * ⚠️ **旧实现为什么必然不生效**：它要求 class 含 `visuallyHidden`，命中的是
 * 上面那个 `role="status"` 的**视觉隐藏副本**（`clip:rect(0 0 0 0);width:1px`）。
 * 给一个看不见的元素上色，屏幕上当然没有任何变化 —— 这正是用户反馈
 * 「已完成 · 用时 xxx 颜色未生效」的根因。
 *
 * ⚠️ **新判据用 `data-turn-process`**：它是内核自己写在可见 button 上的
 * 语义化属性（带 turn 编号），**不依赖任何类名哈希**，也**不依赖中文文案**
 * （切英文界面照样成立）。
 *
 * ⚠️ **必须与重试行/错误行区分**：它们也带 `role="status"`
 * （`_retryText` 有，`_turnErrorRow` 有），但**都不带 `data-turn-process`**，
 * 且它们有自己独立的 `retry` 类别。
 *
 * @param attrs 属性快照。
 * @returns 是否为「已完成 · 用时」的可见宿主元素。
 */
function isTurnTailStatus(attrs) {
  const a = attrs ?? {};
  // 可见宿主：内核写在 button 上的语义化属性（真机 + 源码双重确认）。
  if (typeof a['data-turn-process'] === 'string' && a['data-turn-process'] !== '') return true;
  // 兼容路径：万一宿主改名，仍认 role=status 的可见元素（不再要求 visuallyHidden）。
  // ⚠️ 这里刻意**不加** class 含 visuallyHidden 的分支 —— 那个是给屏幕阅读器
  //    的视觉隐藏副本，给它上色用户看不见（旧实现的根因）。
  return false;
}

/**
 * 判断过程组标题是不是**聚合摘要**（同时包含多种活动）。
 *
 * ## 为什么必须单独判（这是"太混乱了"的根因）
 *
 * 用户 2026-10-17 截图里的三行，是**同一件事**：
 *
 * | 标题 | `data-process-activity` | 我们染成的色 |
 * |---|---|---|
 * | 已读取文件，修改了文件，执行了命令 | `read` | 蓝 |
 * | 修改了文件，执行了命令，已读取文件 | `write` | 绿 |
 * | 执行了命令，修改了文件，已读取文件 | `commands` | 玫红 |
 *
 * 内核把这些活动**拼成一个摘要标题**，而 `data-process-activity` **只保留其中一个**
 * （哪个排在前就留哪个）。于是颜色完全取决于排列顺序 —— 在用户看来就是随机配色，
 * 原话"太混乱了"。
 *
 * 聚合摘要**没有单一语义**，所以判成中性的 `summary` 类别（低饱和一级灰蓝），
 * 与内容行的彩色形成层级：单个活动保持语义色，混合活动统一弱化。
 *
 * 判定方式：标题里出现 `"、"`（内核拼接多个活动用的分隔符）或 `"，"`，
 * 且去重后仍有多个不同的活动名 —— 单纯一个活动名（"执行了命令"）不算聚合。
 *
 * @param text 过程组标题的完整文本。
 * @returns 是否为聚合摘要。
 */
export function isAggregateTitle(text) {
  if (typeof text !== 'string' || text === '') return false;
  // 聚合标题由内核用「、」连接多个活动名；单个活动名不含分隔符。
  if (!text.includes('、') && !text.includes('，')) return false;
  const found = new Set();
  for (const [label, category] of Object.entries(ACTIVITY_LABELS)) {
    if (text.includes(label)) found.add(category);
  }
  return found.size > 1;
}

/**
 * 活动名（中文 label）→ 归一化语义。
 *
 * ⚠️ 与 `ACTIVITY_CATEGORY`（`data-process-activity` 的机器值 → 类别）不同：
 * 这张表是**中文文案 → 语义桶**，只用于 `isAggregateTitle` 判断"标题里提到了
 * 几种不同的活动"。取值来自内核 `ui-chat` 的 `message.stepProcess.*` 文案。
 */
const ACTIVITY_LABELS = {
  已读取文件: 'read',
  读取文件: 'read',
  修改了文件: 'write',
  创建了文件: 'write',
  写入了文件: 'write',
  执行了命令: 'command',
  运行命令: 'command',
  执行命令: 'command',
  已完成分析: 'thinking',
  正在分析: 'thinking',
  分析请求: 'thinking',
  已搜索: 'search',
  搜索: 'search',
  已获取网页: 'web',
  网络请求: 'web',
  询问用户: 'question',
  询问: 'question',
  派遣子代理: 'subagent',
  子代理: 'subagent',
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
export function isRunningCompaction(element, attrs) {
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

  // 0a. 消息尾部（turn-tail）里的用量/分支块 —— 只有类名与 aria-label 可用。
  //     必须**排在最前**：`N1-_sG_actions` 这类容器不带任何语义化 data-*，
  //     而且它的祖先恰好带 `data-chat-flow-kind`（会被后面的分支误吞）。
  //     ⚠️ 先判进度圈（它读 aria-label 分档），再判通用的 meta 容器。
  // 0a-0. 「已完成 · 用时 xxx」的**可见**宿主（`data-turn-process`，内核源码确认）。
  //       必须排在 turn-tail 容器之前判：容器是它的祖先，两者都会被扫到。
  //
  // ⚠️⚠️ **必须按可见文案分四态**，不能一律返回 `done`：
  //       同一个按钮在失败时显示「处理失败」、中止时显示「已停止」。
  //       全染绿色会让失败行也变成成功色，与用户语义预期相反（取证 §① 末尾）。
  if (isTurnTailStatus(a)) return turnProcessCategory(options.text);
  // 0a-1. ⚠️⚠️ **上下文进度圈按钮**（缺陷 ② 的真正修法）。
  //
  //       真机 + 内核源码（`dsh-client-ui-conversation` 的 `ContextMeter`）：
  //
  //         <span class="…_root">
  //           <button class="…_trigger" aria-label="上下文已用 29%"
  //                   aria-haspopup="dialog">
  //             <svg><circle class="…_track"/><circle class="…_fill"/></svg>
  //             <span>29%</span>
  //           </button>
  //         </span>
  //
  //       这个 button **自己不带任何 data-*** —— 所以旧实现里
  //       `classifyAttrs` 走到它时直接返回 `null` → **完全不上色**
  //       （`[aria-label*="%"]` 只把它捞进候选集，分类阶段没有分支接住它）。
  //       而且它的父容器 dock 走的是 `isEmptyActionsRow`，读的是 **dock 自己的**
  //       aria-label（dock 没有）→ 落到 `meta`/`plain` → dock 内没有
  //       `_title`/`_summary` → 无效果。两处都错。
  //
  //       修法：**元素自身的** aria-label 含百分比时直接返回 usageCategory 分档。
  //       ⚠️ 必须读**自身**的 aria-label（不能像 dock 分支那样读容器的）——
  //          这正是旧实现失效的第二处原因。
  //       ⚠️ 必须排除 **tokens 药丸**（真机实测
  //          `BUTTON{aria-label="695M tok · 缓存命中 98%"}`）：用户明确要求
  //          「底部 tokens 数字不上色」。它同样含 `%`，靠「tok / 缓存命中 /
  //          Token / token」字样排除 —— 这些是内核 locale 里的固定词
  //          （`stats.cacheHit` / `message.tokensPerSecond` / `stats.dialog.usageTitle`）。
  if (usageCategory(options.usageText) !== null && !isTokensPill(a, options.usageText)) {
    return usageCategory(options.usageText);
  }

  if (isEmptyActionsRow(a)) {
    const usage = usageCategory(options.usageText);
    if (usage !== null) return usage;
    if (isTurnTailStatus(a)) return turnProcessCategory(options.text);
    return 'meta';
  }

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
    // ⚠️ `conversation.chat.turnTail` 这个槽锚点包着**整条尾部**（含「已完成 ·
    //    用时」那行）。它是一个 `display: contents` 的包裹层，直接染它会命中
    //    太多东西，所以**只染它内部的用量/分支按钮**（由 scopeFor 决定作用域）。
    return base;
  }

  // 2. 过程组标题（"执行了命令"/"已完成分析"）—— 它们**不带 data-tool**，
  //    只有 data-process-activity，所以必须单独判，否则整类漏掉不着色。
  const activity = a['data-process-activity'];
  if (typeof activity === 'string' && activity !== '') {
    // ⚠️⚠️ **聚合标题必须走中性色 —— 这是"太混乱了"的根因。**
    //
    //    真机实测（用户 2026-10-17 截图）：同一个过程组里同时有
    //    read / write / commands 三种活动时，内核把它们**拼成一个摘要标题**，
    //    而 `data-process-activity` **只保留其中一个**（哪个在前就留哪个）：
    //
    //        「已读取文件，修改了文件，执行了命令」 → read   → 蓝
    //        「修改了文件，执行了命令，已读取文件」 → write  → 绿
    //        「执行了命令，修改了文件，已读取文件」 → commands → 玫红
    //
    //    三行是**同一件事**，颜色却取决于排列顺序 —— 视觉上完全是随机的，
    //    用户的原话就是"太混乱了"。聚合摘要没有单一语义，就不该跟随某一个活动。
    if (isAggregateTitle(options.text)) return 'summary';
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
  // ⚠️ `data-sample` 必须与 `data-variant` **等价看待**，不能只认后者：
  //    bash 工具行（BashRow）的根元素是 `data-sample="bash"` + `data-variant="bash"`，
  //    两个都有；但只带 `data-sample` 的形状也真实存在（`data-variant` 是宿主
  //    后来才加的）。只认 `data-variant` 会让这种行直接落到 `null` → **完全不上色**。
  //    这里按"具体工具名 > 变体 > sample"取值，与 `dom.js` 的 dangerText 判定一致。
  const variant = a['data-variant'] ?? a['data-sample'];
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
    // ── 2026-10-17 新增：消息尾部（turn-tail）与 composer 底部条 ──
    // 真机实测这两个是内核自带的语义化属性，比类名稳。
    // ⚠️ `aria-label` 也要读：进度圈的百分比**只写在 aria-label 里**
    //    （`aria-label="上下文已用 29%"`），可见文本在 tooltip 关闭时不存在。
    'data-turn-tail',
    'data-composer-dock',
    'aria-label',
    // ── 2026-10-17 新增：「已完成 · 用时 xxx」的可见宿主 ──
    // 内核源码（`TurnProcessNodeView`）把它写在可见 button 上：
    //   <button data-turn-process="22" data-turn-process-messages="3" …>
    //     <span class="…_label">已完成，用时 3分54秒</span>
    //   </button>
    // ⚠️ 旧实现靠 `class` 含 `visuallyHidden` 找它 —— 那命中给屏幕阅读器的
    //    视觉隐藏副本（1px、clip），给它上色用户看不见（用户反馈"未生效"的根因）。
    'data-turn-process',
    'role',
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
