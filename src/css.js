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
   * 消息尾部（turn-tail）的用量/分支按钮作用域。
   *
   * 真机结构（2026-10-17 实测）：
   *   `DIV[data-turn-tail]` → `DIV._actions` → `BUTTON[aria-label="在新对话中分支"]`
   *
   * ⚠️ 与 `tint` 的区别：`tint` 也匹配 button/a，但它同时会被 `data-slot`
   * 包裹层命中（`display: contents`），语义是"**控件文字**整体染"。
   * turn-tail 里只有按钮该染、正文不该染，所以单列一个作用域。
   */
  const actions = `${p}${sel}[${SCOPE_ATTR}="actions"]`;

  /**
   * 「复制 / 点赞 / 点踩」的排除选择器（用户 2026-10-17 要求这三个**不要**上色）。
   *
   * 真机结构：这三者全部位于
   * `[data-slot="conversation.chat.assistant-actions"]` 插槽容器**内部**，
   * 而「分支」与「用量」在该容器**外面**（见下方 ⑥ 的完整 DOM 与推理）。
   *
   * → 用 `:not(容器 *)` 排除其全部后代。
   *
   * ⚠️ `:not()` 内是**复杂选择器**（后代组合子），需 CSS Selectors Level 4
   *    （Chromium 88+；本机 Electron 44 满足）。
   * ⚠️ 该 slot 名是内核的稳定插槽契约
   *    （`renderSlot("conversation.chat.assistant-actions", …)`），
   *    比 aria-label 文案（本地化）稳定得多。
   */
  const NOT_ASSISTANT_ACTIONS = ':not([data-slot="conversation.chat.assistant-actions"] *)';

  /**
   * 「复制」按钮的排除选择器（用户 2026-10-17 要求复制**不要**上色）。
   *
   * ## 为什么必须用 aria-label，而不是结构
   *
   * 真机探针实测（`ccv` 探针，turn=32）：
   *
   * ```
   * 复制       cls=_4sesoa_action  parent=DIV._4sesoa_actions N1-_sG_actions  sibIdx=0  slot=conversation.chat.node
   * 在新对话中分支 cls=_4sesoa_action  parent=DIV._4sesoa_actions N1-_sG_actions  sibIdx=2  slot=conversation.chat.node
   * 好的回答    cls=DKqaCW_action   parent=DIV.(空 class)  sibIdx=0  slot=conversation.chat.assistant-actions
   * ```
   *
   * → **复制与分支同类名、同父容器，且最近的 `data-slot` 祖先都是外层的
   *   `conversation.chat.node`**（不是 assistant-actions），
   *   所以 `class` / `data-slot` / `:nth-child` **都无法把二者分开**。
   *   唯一可用判据是 `aria-label` 文案。
   *
   * ⚠️ 这也**推翻了上一轮取证报告**里"复制在 assistant-actions 插槽内"的说法 ——
   *    探针实测它在插槽**外**（与分支并列，都在 `_4sesoa_actions` 直接子级）。
   *
   * ## 文案是闭集（已实测核对）
   *
   * 内核 `locale-client.js` 里 `copy` / `copied` 只有两套语言：
   * `复制` / `复制成功`（zh-CN）与 `Copy` / `Copied`（en）——
   * 所以枚举这 4 个值是**完备**的（`copied` 是点击后约 1 秒的瞬时文案，
   * 挂在**同一个按钮**上，必须一并排除，否则点一下复制就会闪成类别色）。
   *
   * ⚠️ 与本仓库既有做法一致：`classify.js` 的 `turnProcessCategory()` 同样
   *    按内核 zh/en 文案匹配。
   * ⚠️ 若内核将来新增语言，这里要同步补值 —— 未覆盖时表现为
   *    "复制按钮在某些语言下仍被染色"，不会崩。
   */
  const NOT_COPY = ':not([aria-label="复制"]):not([aria-label="复制成功"])'
    + ':not([aria-label="Copy"]):not([aria-label="Copied"])';

  /**
   * `actions` 作用域真正的染色目标：**按钮自身**，且排除上面两类。
   *
   * ⚠️ svg 规则也挂在这个目标之下（`… svg{color}`），而不是直接写
   *    `${actions} svg` —— 否则**排除只作用于按钮、图标仍会被染**
   *    （图标是 `stroke="currentColor"`，但内核给 svg 自己声明了 color，
   *     必须由我们显式覆盖；这正是历史缺陷"文字上色了、图标没有"的来源）。
   */
  const actionsTargets = `:is(button,[role="button"],a)${NOT_ASSISTANT_ACTIONS}${NOT_COPY}`;

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

  /**
   * 进度圈的 stroke 规则（2026-10-17 缺陷 ② 的 CSS 侧修法）。
   *
   * 内核 `ContextMeter`（`dsh-client-ui-conversation`）的圆环结构（真机取证）：
   *
   * ```html
   * <svg viewBox="0 0 14 14" width="14" height="14">
   *   <circle class="…_track" cx="7" cy="7" r="5.5"></circle>
   *   <circle class="…_fill" cx="7" cy="7" r="5.5" stroke-dasharray="…"></circle>
   * </svg>
   * ```
   *
   * 源码实测：`._zgeDa_fill{fill:none;stroke:var(--dsw-alias-label-tertiary)}`
   * —— 进度弧是 **stroke 画的**，且 stroke 是**显式 var() 声明、不是 currentColor**。
   * 所以只写 `svg{color}` 对它完全无效（旧实现的根因），必须显式写 stroke。
   *
   * ⚠️ 只染 `_fill`（进度弧），**不染 `_track`**（底环是"剩余量"的示意，
   * 染成类别色会把圆环变成一整个实心同色环，看不出比例）。
   * ⚠️ **绝不写 `fill`**：两个 circle 都是 `fill:none`（空心圆环），
   * 写 fill 会把整个圆盘涂实。
   */
  const ringStroke = `${self} svg [class*="_fill"]{stroke:${color}}`;

  return [
    // ① 工具行/推理行表头：图标 + 短标签。摘要与正文保持原生。
    `${header} svg{color:${color}}`,
    `${titleSel}{color:${color}}`,

    // ①b 过程组**内层行**：暂不染文字。
    //
    // 2026-10-17 两轮实测结论（别再重复踩）：
    //  - 内层行**没有任何语义钩子**（探针 dump 全部属性：只有 data-disclosure-row /
    //    data-expandable / role / aria-expanded）；
    //  - 行文字在 `SPAN._root_1rdzk_1 > SPAN._content_1rdzk_11` 里，**没有 `_title` 类**；
    //  - 行文本里**没有字面分隔符 ` · `** —— 截图里那个 `·` 是 CSS 伪元素画的，
    //    所以"按分隔符切出标签"这条路走不通（切不到 → 只能整段染或整段不染）；
    //  - 打标元素（`ZmL7Ga_root` 那种）**不带 `data-process-activity`**，
    //    原先按该属性触发的切分逻辑根本不会跑。
    //
    // 曾试过整行染色：用户截图当场指出「思考的正文错误染色」——
    // 把 `·` 后面的模型推理正文一起染了，违背"只染标签"原则，已回退。
    // → 当前只染内层行的**图标**（由上面的 svg 规则覆盖），文字保持原生色。
    //    要做"只染标签"需要内核给出标签/正文的独立钩子，见 AGENTS.md §5。

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
    //    ⚠️ `_label` 也在这条规则里（2026-10-17 缺陷 ①）：内核
    //    `TurnProcessNodeView` 的「已完成，用时 3分54秒」在
    //    `<button data-turn-process><span class="…_label">` 里，用的类名后缀
    //    是 `_label`（**不是** `_title`）。旧实现照抄 bash 行的 `_title` 判据，
    //    连可见宿主都没找对（它找的是 `visuallyHidden` 的屏幕阅读器副本）。
    //    ⚠️ `circle` 也在这里：上下文进度圈（`ContextMeter`）的圆环是
    //    **stroke 画的**（内核源码实测：`._zgeDa_fill{fill:none;stroke:var(--dsw-alias-label-tertiary)}`，
    //    `._zgeDa_track{fill:none;stroke:var(--dsw-alias-border-l3)}`）——
    //    ⚠️⚠️ 这两个 stroke 都是**显式 var() 声明**，不是 currentColor：
    //    `svg{color}` 对它们完全无效（这正是 2026-10-17 真机取证缺陷 ② 的根因
    //    —— 只写 color，圆环在所有主题下都纹丝不动）。必须写 **stroke** 规则。
    //    具体写法（见下方 usage 分支的 ringStroke）：给 `_fill`（进度弧）写
    //    `stroke:<类别色>`；`_track`（底环）保持内核原样不动 —— 它是"剩余量"，
    //    染成类别色会让整个圆盘变成实心同色环。
    //    ⚠️ 这里**不能**写成 `] *{`：会连圆环外的百分比文字 span 一起染，
    //    而用户要求的是"进度圈上色"，文字保持原生更稳。
    `${self} svg{color:${color}}`,
    `${self} [class*="_title"]{color:${color}}`,
    `${self} [class*="_label"]{color:${color}}`,
    // ⚠️⚠️ 进度圈的 stroke 规则（缺陷 ②）：圆环用 stroke 画、且内核显式声明了
    //    `stroke:var(--dsw-alias-label-tertiary)`（非 currentColor），只写 color
    //    圆环完全不变色 —— 必须显式写 stroke 命中 `_fill` 那个 circle。
    //    `svg{color}` 规则**仍然保留**：按钮里的「9%」文字与 hover 图标靠它。
    ringStroke,

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

    // ⑥ 消息尾部（turn-tail）的**用量**与**分支**按钮。
    //
    //    真机结构（2026-10-17 从运行中的应用读出的真实 DOM，turn=62）：
    //      DIV[data-turn-tail="62"][data-actions-reveal="hover"]
    //        DIV._4sesoa_actions
    //          DIV[data-slot="conversation.chat.assistant-actions"]   ← 复制/点赞/点踩在这层里
    //            BUTTON{_4sesoa_action aria-label="复制"}
    //            BUTTON{DKqaCW_action aria-label="好的回答" aria-pressed="false"}
    //            BUTTON{DKqaCW_action aria-label="有问题的回答" aria-pressed="false"}
    //          BUTTON{_4sesoa_action aria-label="在新对话中分支"}      ← 分支在 data-slot **外面**
    //        BUTTON{_7hGK5G_trigger} 文本「用量 29.9M tok」            ← 用量也在外面
    //
    //    ## ⚠️⚠️ 用户 2026-10-17 明确要求（这一条推翻了上一轮的"现状"）
    //
    //      原话：「我要的是 消息尾部只有**分支**和**用量**上色，
    //             复制 点踩和点赞**不要上色**」
    //
    //    旧实现用**后代选择器** `:is(button,…)`，把容器内**所有** button 都染了 ——
    //    于是复制/点赞/点踩一起被染成 meta 色（真机实测：
    //    四个按钮 computed color 全是 rgb(143,163,181)）。
    //
    //    ## 判据为什么是 `:not([data-slot="conversation.chat.assistant-actions"] *)`
    //
    //    内核里复制与分支**同类名**（都是 CSS Module 的 `css.action` = `_4sesoa_action`）、
    //    **同父容器**，且轮换位置（`extraActions` 是插槽注入的，数量 0/1/2 可变，
    //    `clock === "start"` 时前面还会多一个时间 span）→
    //    **class 与 `:nth-child` 都不可靠**。
    //
    //    唯一稳定的结构差异：**复制/点赞/点踩三者全部在
    //    `[data-slot="conversation.chat.assistant-actions"]` 这个插槽容器内部，
    //    而分支与用量在它外面。**
    //    → 用 `:not(容器 *)` 把该插槽的后代排除掉。
    //
    //    ⚠️ 用 aria-label 文案（"复制"/"Copy"）作判据是**不可取**的：
    //       它是本地化字符串，换语言/换版本即失效；而这个 slot 名是内核的
    //       **稳定插槽契约**（`renderSlot("conversation.chat.assistant-actions", …)`，
    //       见 chat-client.js 的 TurnTailNodeView）。
    //    ⚠️ `:not()` 里是**复杂选择器**（带后代组合子），需要 CSS Selectors Level 4
    //       支持（Chromium 88+；本机 Electron 44 满足）。
    //
    //    ⚠️ 只染 button/a **自身**，不染后代文本 —— 否则容器里的
    //    「已完成 · 用时」正文会被一起吞进来。
    //    ⚠️ svg 规则挂在 actionsTargets 之下（不是裸 `${actions} svg`），
    //       这样排除才会同时作用于"按钮的文字"与"按钮里的图标"。
    `${actions} ${actionsTargets}{color:${color}}`,
    `${actions} ${actionsTargets} svg{color:${color}}`,
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
