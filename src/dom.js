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
import { classifyAttrs, readAttrs } from './classify.js';
import { CAT_ATTR, MARK_ATTR, SCOPE_ATTR } from './css.js';

/**
 * 一次性匹配所有"可能可染色"的元素。
 *
 * 这是唯一的 DSH 属性清单，与 `classify.js` 的判定一一对应。
 * 用属性存在性选择器（不取值），所以宿主加新工具名也无需改这里。
 */
const CANDIDATE_SELECTOR = [
  '[data-tool]',
  '[data-variant="think"]',
  // 过程组标题（"执行了命令"/"已完成分析"）：只有这个属性，没有 data-tool。
  '[data-process-activity]',
  '[data-kind]',
  '[data-slot]',
].join(',');

/**
 * 决定染色作用域。
 *
 * 见 `css.js` 的作用域表。判断顺序与 `classifyAttrs` 的优先级保持一致。
 *
 * ⚠️ 没有 `stripe` 分支了：那个作用域服务于用户/助手消息块，已整体删除
 * （实测会把竖条画到整列左缘、与靠右的气泡脱节）。
 *
 * @param attrs 属性快照。
 * @returns 作用域名。
 */
function scopeFor(attrs) {
  if (attrs['data-slot'] !== undefined) return 'tint';
  // 过程组标题是一个 `<button>`，不是 DisclosureRow，没有折叠表头结构。
  // 用 `title` 作用域：染它自己的 svg 与标题文字，且**不加竖条**
  // （用户明确要求：只改颜色，不要彩色竖线）。
  if (attrs['data-process-activity'] !== undefined) return 'title';
  if (attrs['data-tool'] !== undefined) return 'header';
  if (attrs['data-variant'] === 'think') return 'header';
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
 * 给单个元素打标。已经打过的直接跳过（幂等）。
 *
 * @param element 候选元素。
 * @returns 打上的类别 id，或 null（未打标）。
 */
export function tagElement(element) {
  if (element === null || element === undefined) return null;
  if (typeof element.getAttribute !== 'function') return null;
  // 幂等：同一个元素只处理一次。
  if (element.getAttribute(MARK_ATTR) !== null) return element.getAttribute(CAT_ATTR);

  const attrs = readAttrs(element);
  const category = classifyAttrs(attrs, { text: dangerText(element) });
  if (category === null) return null;

  try {
    element.setAttribute(CAT_ATTR, category);
    element.setAttribute(SCOPE_ATTR, scopeFor(attrs));
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
          if (record.type !== 'childList') continue;
          for (const node of record.addedNodes) pending.push(node);
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
    // 只观察 childList：我们写属性不会触发自己。
    observer.observe(target, { childList: true, subtree: true });
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
