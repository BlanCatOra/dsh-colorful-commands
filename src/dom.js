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
import {
  classifyAttrs,
  hasTitleDetail,
  isCompactionRow,
  isRetryRow,
  readAttrs,
} from './classify.js';
import { TITLE_SEPARATOR } from './constants.js';
import { CAT_ATTR, MARK_ATTR, PART_ATTR, SCOPE_ATTR } from './css.js';

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
export function tagElement(element) {
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
export function tagTree(root) {
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
export function clearTags(root) {
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
export function startObserver(options = {}) {
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
