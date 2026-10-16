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
import { classifyAttrs, hasTitleDetail, readAttrs } from './classify.js';
import { CAT_ATTR, MARK_ATTR, SCOPE_ATTR } from './css.js';

/**
 * 一次性匹配所有"可能可染色"的元素。
 *
 * 这是唯一的 DSH 属性清单，与 `classify.js` 的判定一一对应。
 * 用属性存在性选择器（不取值），所以宿主加新工具名也无需改这里。
 */
const CANDIDATE_SELECTOR = [
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
 * @param options.hasDetail 过程组标题里是否带分析正文（见 `hasTitleDetail`）。
 * @returns 作用域名。
 */
function scopeFor(attrs, options = {}) {
  if (attrs['data-slot'] !== undefined) return 'tint';
  // 过程组标题是一个 `<button>`，不是 DisclosureRow，没有折叠表头结构。
  // 用 `title` 作用域：染它自己的 svg 与标题文字。
  //
  // ⚠️ **带分析正文时降级为 `icon`** —— 用户反馈"分析正文被错误地上色、
  // 上色部分太多"。内核把「标签 + ' · ' + 正文」放在**同一个文本节点**里，
  // CSS 没法只染标签；所以带正文时只染图标，文字保持原生。
  if (attrs['data-process-activity'] !== undefined) {
    return options.hasDetail === true ? 'icon' : 'title';
  }
  if (attrs['data-tool'] !== undefined) return 'header';
  if (attrs['data-variant'] === 'think') return 'header';
  // bash 工具行（BashRow）：根元素只有 `data-sample` + `data-variant="bash"`。
  // 它**不是 DisclosureRow**（没有 `[data-disclosure-header]`），所以不能用
  // `header` 作用域（那些规则会一条都匹配不到，表现为"上色了但没效果"）。
  // 它的结构是「根元素 + leading svg + `_title` 标签」，正是 `self` 作用域的形状。
  if (attrs['data-sample'] !== undefined || attrs['data-variant'] !== undefined) return 'self';
  if (attrs['data-kind'] !== undefined) return 'self';
  return 'tint';
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
function dangerText(element) {
  try {
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
 * 让它能随文本变化在 `title` / `icon` 之间切换。
 *
 * @param element 候选元素。
 * @returns 打上的类别 id，或 null（未打标）。
 */
export function tagElement(element) {
  if (element === null || element === undefined) return null;
  if (typeof element.getAttribute !== 'function') return null;

  const attrs = readAttrs(element);
  const dynamic = attrs['data-process-activity'] !== undefined;
  // 幂等：普通元素只处理一次；过程组标题每次都重判（原因见上）。
  if (!dynamic && element.getAttribute(MARK_ATTR) !== null) return element.getAttribute(CAT_ATTR);

  const text = dangerText(element);
  const category = classifyAttrs(attrs, { text });
  if (category === null) return null;

  try {
    element.setAttribute(CAT_ATTR, category);
    element.setAttribute(SCOPE_ATTR, scopeFor(attrs, { hasDetail: hasTitleDetail(text) }));
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
