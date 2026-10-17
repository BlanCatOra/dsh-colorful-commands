/**
 * DOM 打标层测试：用**贴近真实 DSH 结构**的假元素验证打标行为。
 *
 * 为什么这一层也要测：`classify.js` 的纯函数测试只能证明"给定属性会得出正确类别"，
 * 证明不了"真的会在正确的元素上打标、且不会误伤"。特别是：
 * - 内层 `data-sample` 卡片不能被重复打标（否则同一条命令出现两条竖条）；
 * - 危险命令判定只读表头文本，不能读到展开后的正文（否则普通命令会被误判）；
 * - 已经打过的元素要幂等。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tagElement, tagTree, clearTags, startObserver } from '../src/dom.js';
import { classifyAttrs } from '../src/classify.js';
import { CAT_ATTR, MARK_ATTR, SCOPE_ATTR } from '../src/css.js';

/**
 * 造一个极简的假元素。
 *
 * @param attrs 初始属性。
 * @param options.text 自身文本（textContent 的默认来源）。
 * @param options.children 子元素。
 */
function makeElement(attrs = {}, options = {}) {
  const element = {
    nodeType: 1,
    attrs: { ...attrs },
    children: options.children ?? [],
    text: options.text ?? '',
    getAttribute(name) {
      return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    matches(selector) {
      return matchesSimple(this, selector);
    },
    querySelectorAll(selector) {
      return collect(this, selector);
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    get textContent() {
      // 模拟真实 DOM：自身文本 + 所有后代文本。
      return this.text + this.children.map((child) => child.textContent).join('');
    },
  };
  return element;
}


/**
 * 造一个够 `splitTitleLabel` 用的极简文档。
 *
 * `splitTitleLabel` 会真的动 DOM（createTreeWalker 找文本节点、createElement +
 * insertBefore 插入标签段），所以这一组测试不能只靠属性快照，必须有一个能承载
 * 文本节点、父子关系与插入操作的小实现。
 *
 * ⚠️ 刻意实现**真实的文本节点语义**（nodeValue / parentNode / 兄弟顺序），
 * 因为被测逻辑正是围绕"标签与详情在同一个文本节点里"展开的 —— 用属性桩替掉
 * 文本节点就等于把 bug 遮住。
 */
function makeFakeDoc() {
  const NODE = { ELEMENT: 1, TEXT: 3 };
  const leafText = (el) => {
    let out = '';
    for (const child of el.childNodes) {
      out += child.nodeType === NODE.TEXT ? child.nodeValue : leafText(child);
    }
    return out;
  };
  const matchesSel = (el, selector) => {
    const part = selector.trim();
    const attrEq = /^\[([\w-]+)="([^"]*)"\]$/.exec(part);
    if (attrEq !== null) return el.getAttribute(attrEq[1]) === attrEq[2];
    const attrAny = /^\[([\w-]+)\]$/.exec(part);
    if (attrAny !== null) return el.getAttribute(attrAny[1]) !== null;
    if (part.startsWith('[class*="_')) {
      const needle = part.slice(9, -2);
      return typeof el.className === 'string' && el.className.includes(needle);
    }
    return false;
  };
  const queryAll = (el, selector) => {
    const out = [];
    // 真实 DOM 的选择器列表用逗号分隔，必须逐个匹配（`CANDIDATE_SELECTOR` 就是
    // 这样拼出来的）。不拆逗号会让 `[data-sample],[data-tool],…` 一条都匹配不上。
    const parts = String(selector).split(',').map((x) => x.trim()).filter((x) => x !== '');
    const hit = (node) => parts.some((sel) => matchesSel(node, sel));
    for (const child of el.childNodes) {
      if (child.nodeType !== NODE.ELEMENT) continue;
      if (hit(child)) out.push(child);
      out.push(...queryAll(child, selector));
    }
    return out;
  };
  const mkElement = (tag, className = '') => {
    const el = {
      nodeType: NODE.ELEMENT,
      tagName: tag,
      className,
      childNodes: [],
      attrs: {},
      parentNode: null,
      ownerDocument: null,
      get textContent() { return leafText(el); },
      set textContent(v) {
        el.childNodes = [];
        if (v !== '') el.insertBefore(mkText(v), null);
      },
      getAttribute(n) { return Object.hasOwn(el.attrs, n) ? el.attrs[n] : null; },
      setAttribute(n, v) { el.attrs[n] = v; },
      removeAttribute(n) { delete el.attrs[n]; },
      appendChild(c) { el.childNodes.push(c); c.parentNode = el; return c; },
      insertBefore(node, ref) {
        const at = ref === null ? el.childNodes.length : el.childNodes.indexOf(ref);
        el.childNodes.splice(at < 0 ? el.childNodes.length : at, 0, node);
        node.parentNode = el;
        return node;
      },
      removeChild(node) {
        const i = el.childNodes.indexOf(node);
        if (i >= 0) el.childNodes.splice(i, 1);
        return node;
      },
      // 真实 DOM 的 `matches()` 接受逗号分隔的选择器列表，
      // 而 `nearestCandidate` 正是拿 `CANDIDATE_SELECTOR`（逗号拼接）调它。
      // 只匹配第一段会让"文本变化后上溯到标题"这条路径静默失效。
      matches(sel) {
        return String(sel).split(',').map((x) => x.trim()).filter((x) => x !== '')
          .some((one) => matchesSel(el, one));
      },
      querySelector(sel) { return queryAll(el, sel)[0] ?? null; },
      querySelectorAll(sel) { return queryAll(el, sel); },
    };
    return el;
  };
  const mkText = (value) => ({
    nodeType: NODE.TEXT,
    nodeValue: value,
    parentNode: null,
  });
  const doc = mkElement('#document');
  // 把文档 API 挂在文档元素本身上：真实 DOM 里 `element.ownerDocument` 拿到的是
  // 一个**同时具备** createElement / createTreeWalker 的对象，测试必须如实模拟，
  // 否则被测代码里的 `ownerDocument.createElement` 会拿到 undefined（第一版就是
  // 因为把 API 放在一个中间对象、ownerDocument 指到了别处而假失败）。
  doc.createElement = (tag) => {
    const el = mkElement(tag);
    el.ownerDocument = doc;
    return el;
  };
  doc.createTextNode = mkText;
  doc.createTreeWalker = (root, _what) => {
    const flat = [];
    const walk = (el) => {
      for (const child of el.childNodes) {
        if (child.nodeType === NODE.TEXT) flat.push(child);
        else walk(child);
      }
    };
    walk(root);
    let i = -1;
    return { nextNode: () => (++i < flat.length ? flat[i] : null) };
  };
  doc.mkElement = mkElement;
  doc.mkText = mkText;
  doc.NODE = NODE;
  return doc;
}

/** 极简选择器匹配：只支持 `[attr]` 与 `[attr="value"]`，够本测试用。 */
function matchesSimple(element, selector) {
  return selector.split(',').some((part) => {
    const trimmed = part.trim();
    const eq = /^\[([\w-]+)="([^"]*)"\]$/.exec(trimmed);
    if (eq !== null) return element.getAttribute(eq[1]) === eq[2];
    const bare = /^\[([\w-]+)\]$/.exec(trimmed);
    if (bare !== null) return element.getAttribute(bare[1]) !== null;
    return false;
  });
}

/**
 * 收集**后代**里匹配选择器的元素。
 *
 * ⚠️ 刻意不含根自身 —— 真实 `Element.querySelectorAll` 也不含。若把根算进去，
 * `tagTree` 会把它处理两次，测试就会出现假失败（第一版就踩了这个）。
 */
function collect(root, selector) {
  const out = [];
  const visit = (node) => {
    for (const child of node.children ?? []) {
      if (matchesSimple(child, selector)) out.push(child);
      visit(child);
    }
  };
  visit(root);
  return out;
}

test('工具行按 data-tool 打标，作用域是 header', () => {
  // 无文本时命令按最低风险档上色（不猜危险）。
  const row = makeElement({ 'data-tool': 'bash' });
  assert.equal(tagElement(row), 'commandLow');
  assert.equal(row.getAttribute(CAT_ATTR), 'commandLow');
  assert.equal(row.getAttribute(SCOPE_ATTR), 'header');
  assert.equal(row.getAttribute(MARK_ATTR), '');
});

test('推理行按 data-variant=think 打标', () => {
  const row = makeElement({ 'data-variant': 'think' });
  assert.equal(tagElement(row), 'thinking');
  assert.equal(row.getAttribute(SCOPE_ATTR), 'header');
});

test('消息流包裹层不打标（整列宽，加竖条会脱节）', () => {
  const row = makeElement({ 'data-chat-flow-kind': 'user' });
  assert.equal(tagElement(row), null, 'flowItem 是整列宽包裹层，不得打标');
  assert.equal(row.getAttribute(CAT_ATTR), null);
});

test('轨迹行用 self 作用域', () => {
  const row = makeElement({ 'data-kind': 'tool' }, { text: 'ls' });
  assert.equal(tagElement(row), 'commandLow');
  assert.equal(row.getAttribute(SCOPE_ATTR), 'self');
});

test('bash 工具行（data-sample，无 data-tool）被打标且用 self 作用域 —— "运行命令"回归守卫', () => {
  // ⚠️ 内核实测：bash 工具行走 BashRow，根元素只有 data-sample + data-variant，
  // **没有 data-tool**，也**不是 DisclosureRow**（没有 data-disclosure-header）。
  // 旧实现用 `header` 作用域或干脆跳过，两种情况都表现为"运行命令没有颜色"。
  const row = makeElement({ 'data-sample': 'bash', 'data-variant': 'bash' }, { text: '运行命令 · 校验语法' });
  assert.equal(tagElement(row), 'commandLow', 'bash 行必须被着色');
  assert.equal(row.getAttribute(SCOPE_ATTR), 'self', '没有折叠表头，不能用 header 作用域');
});

test('过程组标题是"动态"元素：文本变化后必须重新判定作用域（回归守卫）', () => {
  // ⚠️ 这是"分析正文被错误地上色"的**真正根因**：过程组标题打标时正文还没流式
  // 到达，作用域被定成 title（染文字）；等到内核把「标签 · 分析正文」拼进来时，
  // 元素已带 MARK_ATTR，旧实现直接跳过 —— 于是正文被染色且永不纠正。
  const doc = makeFakeDoc();
  const el = doc.createElement('button');
  el.setAttribute('data-process-activity', 'thinking');
  const label = doc.createElement('span');
  label.className = 'x_label';
  label.textContent = '正在分析请求';
  el.appendChild(label);

  tagElement(el);
  assert.equal(el.getAttribute(SCOPE_ATTR), 'title', '初始只有标签：可整段染');
  assert.equal(el.querySelector('[data-cc-part="label"]'), null, '无详情时不需要切分');

  // 正文到达（内核改 textNode.nodeValue，不产生 childList 记录）。
  label.textContent = '正在分析请求 · 我先看看这个 DOM 结构再决定';
  tagElement(el);
  const part = el.querySelector('[data-cc-part="label"]');
  assert.ok(part !== null, '正文到达后必须切出标签段');
  assert.equal(part.textContent, '正在分析请求');
});

test('普通元素仍然只处理一次（动态重判不得变成全量重扫）', () => {
  const el = makeElement({ 'data-tool': 'bash' }, { text: 'ls' });
  tagElement(el);
  assert.equal(el.getAttribute(MARK_ATTR), '', '普通元素仍需打 MARK 以跳过重复扫描');
  // 文本改成危险命令也不应重判（它不是动态元素）。
  el.text = 'rm -rf /';
  assert.equal(tagElement(el), 'commandLow', '普通元素保持幂等，不重判');
});

test('聚合过程组标题（执行了命令）必须拿到颜色', () => {
  // ⚠️ 调色板里没有裸 `command` 类别；若把 commands/tools 直接映射成 `command`，
  // 整类会静默不着色（实测真机 69 个元素无一有颜色）。
  const el = makeElement({ 'data-process-activity': 'commands' }, { text: '执行了命令' });
  assert.equal(tagElement(el), 'commandLow');
  const running = makeElement({ 'data-process-activity': 'commands' }, { text: '正在运行命令 · sudo systemctl restart nginx' });
  assert.equal(tagElement(running), 'commandMid', '聚合标题里的危险命令也要按风险分级');
});

test('过程组标题按"有无详情"分成两个作用域（这是消除闪烁的关键）', () => {
  // ⚠️ 不能只用 `title` + CSS `:not(:has())` 兜底：兜底规则会在"切分被 React
  // 重渲染冲掉"的那一帧重新匹配上整段标题，正文被整段染色、下一帧再切回来，
  // 视觉上就是闪烁（用户实测反馈"正文的上色是闪烁的"）。
  const withDetail = makeElement({ 'data-process-activity': 'reading' }, { text: '正在分析请求 · 我看看这个 DOM 结构' });
  tagElement(withDetail);
  assert.equal(withDetail.getAttribute(SCOPE_ATTR), 'title-part', '有详情 → 只染切出来的标签段');

  const pureLabel = makeElement({ 'data-process-activity': 'commands' }, { text: '执行了命令' });
  tagElement(pureLabel);
  assert.equal(pureLabel.getAttribute(SCOPE_ATTR), 'title', '无详情 → 整段标签可染');
});

test('过程组标题：切分被 React 冲掉后，作用域必须回到 title-part（不得整段染色）', () => {
  // 模拟"切分短暂失效"：元素被标成 title-part 后，标签段消失、文本变成整段标题。
  const doc = makeFakeDoc();
  const title = doc.createElement('button');
  title.setAttribute('data-process-activity', 'commands');
  const label = doc.createElement('span');
  label.className = '_7s-ua_label';
  label.textContent = '正在分析请求 · 正文很长的一段分析';
  title.appendChild(label);
  tagElement(title);
  assert.equal(title.getAttribute(SCOPE_ATTR), 'title-part');

  // React 重渲染：标签段没了，文本仍是"标签 · 详情"。
  label.textContent = '正在分析请求 · 正文很长的一段分析';
  tagElement(title);
  assert.equal(
    title.getAttribute(SCOPE_ATTR),
    'title-part',
    '即使切分失效也必须留在 title-part，绝不能退回 title（那会把正文染色）',
  );
});

test('插槽锚点用 tint 作用域（控件不加竖条）', () => {
  const anchor = makeElement({ 'data-slot': 'conversation.input.permission' });
  assert.equal(tagElement(anchor), 'ctl-permission');
  assert.equal(anchor.getAttribute(SCOPE_ATTR), 'tint');
});

test('打标幂等：同一元素重复处理不会改变结果', () => {
  const row = makeElement({ 'data-tool': 'bash' });
  tagElement(row);
  const first = { ...row.attrs };
  tagElement(row);
  assert.deepEqual(row.attrs, first);
});

test('无关元素不打标', () => {
  const el = makeElement({ class: 'foo' });
  assert.equal(tagElement(el), null);
  assert.equal(el.getAttribute(CAT_ATTR), null);
});

test('危险命令判定只读表头文本，不读展开后的正文', () => {
  // 表头写的是普通命令；展开正文里含 sudo 字样（例如输出里打印了 sudo）。
  const headerRow = makeElement({ 'data-disclosure-row': '' }, { text: 'ls -la' });
  const header = makeElement({ 'data-disclosure-header': '' }, { children: [headerRow] });
  const body = makeElement({}, { text: '输出：请用 sudo 安装依赖' });
  const root = makeElement({ 'data-tool': 'bash' }, { children: [header, body] });

  assert.equal(tagElement(root), 'commandLow', '正文里的 sudo 不得让它升级成中/高风险');
  assert.equal(root.getAttribute(CAT_ATTR), 'commandLow');
});

test('表头本身是危险命令时正确归入高风险', () => {
  const headerRow = makeElement({ 'data-disclosure-row': '' }, { text: 'rm -rf /tmp/x' });
  const header = makeElement({ 'data-disclosure-header': '' }, { children: [headerRow] });
  const root = makeElement({ 'data-tool': 'bash' }, { children: [header] });

  assert.equal(tagElement(root), 'commandHigh');
});

test('中风险命令按中间档上色', () => {
  const headerRow = makeElement({ 'data-disclosure-row': '' }, { text: 'sudo systemctl restart nginx' });
  const header = makeElement({ 'data-disclosure-header': '' }, { children: [headerRow] });
  const root = makeElement({ 'data-tool': 'bash' }, { children: [header] });

  assert.equal(tagElement(root), 'commandMid');
});

test('tagTree 会处理根自身与所有后代', () => {
  const a = makeElement({ 'data-tool': 'read' });
  const b = makeElement({ 'data-tool': 'edit' });
  const c = makeElement({ 'data-variant': 'think' });
  const root = makeElement({}, { children: [a, makeElement({}, { children: [b, c] })] });

  assert.equal(tagTree(root), 3);
  assert.equal(a.getAttribute(CAT_ATTR), 'read');
  assert.equal(b.getAttribute(CAT_ATTR), 'write');
  assert.equal(c.getAttribute(CAT_ATTR), 'thinking');
});

test('clearTags 移除全部标记', () => {
  const a = makeElement({ 'data-tool': 'read' });
  const b = makeElement({ 'data-tool': 'edit' });
  const root = makeElement({}, { children: [a, b] });
  tagTree(root);
  assert.ok(a.getAttribute(CAT_ATTR));

  clearTags(root);
  assert.equal(a.getAttribute(CAT_ATTR), null);
  assert.equal(b.getAttribute(CAT_ATTR), null);
  assert.equal(a.getAttribute(MARK_ATTR), null);
});

test('只读/冻结的 DOM 不会让打标抛错', () => {
  const frozen = {
    nodeType: 1,
    getAttribute: () => null,
    setAttribute: () => { throw new Error('read-only'); },
    matches: () => true,
    querySelectorAll: () => [],
  };
  assert.doesNotThrow(() => tagElement(frozen));
  assert.equal(tagElement(frozen), null);
});

test('没有 getAttribute 的输入安全返回 null', () => {
  assert.equal(tagElement(null), null);
  assert.equal(tagElement(undefined), null);
  assert.equal(tagElement({}), null);
});


// ── 观察器：characterData 路径 ────────────────────────────────────────
//
// ⚠️ 这一层必须用**真的假 MutationObserver** 测，不能只测 tagElement：
// "正文被上色"的根因是**观察器没在文本变化时重判**，而 tagElement 单测
// 证明不了观察器有没有收到那次变化。

/** 最小 fake MutationObserver：记录配置，并允许手动派发记录。 */
function makeFakeObserver() {
  const instances = [];
  class FakeObserver {
    constructor(callback) {
      this.callback = callback;
      this.config = null;
      this.disconnected = false;
      instances.push(this);
    }
    observe(_target, config) { this.config = config; }
    disconnect() { this.disconnected = true; }
  }
  return { FakeObserver, instances };
}

test('观察器必须订阅 characterData（否则正文流式到达时不会重判）', () => {
  const { FakeObserver, instances } = makeFakeObserver();
  const prevMO = globalThis.MutationObserver;
  const prevRAF = globalThis.requestAnimationFrame;
  globalThis.MutationObserver = FakeObserver;
  globalThis.requestAnimationFrame = (fn) => fn();
  try {
    // 真实结构：<button data-process-activity><span class="_label">文本</span></button>
    // 文本节点挂在 label 上，data-process-activity 在外层 button 上。
    // 用 makeFakeDoc 建真实节点树：切分逻辑要真的 createTreeWalker + insertBefore。
    const fd = makeFakeDoc();
    const title = fd.createElement('button');
    title.setAttribute('data-process-activity', 'thinking');
    const label = fd.createElement('span');
    label.className = '_7s-ua_label';
    label.textContent = '正在分析请求';
    title.appendChild(label);
    const body = fd.createElement('div');
    body.appendChild(title);
    const doc = fd;
    doc.body = body;
    doc.documentElement = null;

    const stop = startObserver({ document: doc });
    assert.equal(instances.length, 1, '必须建立一个观察器');
    assert.equal(instances[0].config.childList, true);
    assert.equal(instances[0].config.subtree, true);
    assert.equal(
      instances[0].config.characterData,
      true,
      '不订阅 characterData 就永远看不到「标签 · 正文」的文本变化',
    );

    // 初始只有标签 → title 作用域（染文字）。
    assert.equal(title.getAttribute(SCOPE_ATTR), 'title');

    // 模拟内核把正文拼进文本节点：派发一条 characterData 记录，
    // target 是**文本节点**（与真实 DOM 一致），其父元素是 label。
    const textNode = label.childNodes[0];
    textNode.nodeValue = '正在分析请求 · 我先看看这个 DOM 结构再决定';
    instances[0].callback([{ type: 'characterData', target: textNode }]);

    // 正文到达后必须**重新切分**：标签进 [data-cc-part="label"]，详情留在外面。
    const part = title.querySelector('[data-cc-part="label"]');
    assert.ok(part !== null, 'characterData 记录必须上溯到 title 并重新切分标签');
    assert.equal(part.textContent, '正在分析请求', '切出来的必须是标签部分');
    assert.equal(
      title.querySelector('[class*="_label"]').textContent,
      '正在分析请求 · 我先看看这个 DOM 结构再决定',
      '详情必须仍留在标题里（只是不进标签段）',
    );
    stop();
  } finally {
    globalThis.MutationObserver = prevMO;
    if (prevRAF === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = prevRAF;
  }
});


test('过程组标题：标签被切出来单独成段，详情不在其中（"上色不完全"的回归守卫）', () => {
  // ⚠️ 内核把「标签 + ' · ' + 详情」拼成**同一个文本节点**，CSS 无法只染标签。
  // 之前用"整段不染"回避，结果带详情的标题（"准备运行命令 · cd ~/P"）完全没颜色，
  // 用户反馈"上色不完全"。现在必须在运行时把标签切出来。
  const doc = makeFakeDoc();
  const title = doc.createElement('button');
  title.setAttribute('data-process-activity', 'commands');
  const label = doc.createElement('span');
  label.className = 'x_label';
  label.textContent = '准备运行命令 · cd ~/Projects/foo';
  title.appendChild(label);

  tagElement(title);

  const part = title.querySelector('[data-cc-part="label"]');
  assert.ok(part !== null, '必须切出带 data-cc-part="label" 的标签段');
  assert.equal(part.textContent, '准备运行命令', '标签段只含标签，不含详情');
  assert.ok(
    title.textContent.includes('cd ~/Projects/foo'),
    '详情必须仍然留在标题里（只是不被染色）',
  );
});




test('过程组标题：没有详情时不切分（纯标签整段可染）', () => {
  const doc = makeFakeDoc();
  const title = doc.createElement('button');
  title.setAttribute('data-process-activity', 'commands');
  const label = doc.createElement('span');
  label.className = 'x_label';
  label.textContent = '执行了命令';
  title.appendChild(label);

  tagElement(title);
  assert.equal(title.querySelector('[data-cc-part="label"]'), null, '无详情不该切分');
});

test('过程组标题：详情里再出现分隔符也只切第一个', () => {
  const doc = makeFakeDoc();
  const title = doc.createElement('button');
  title.setAttribute('data-process-activity', 'thinking');
  const label = doc.createElement('span');
  label.className = 'x_label';
  label.textContent = '正在分析请求 · a · b';
  title.appendChild(label);

  tagElement(title);
  const part = title.querySelector('[data-cc-part="label"]');
  assert.equal(part.textContent, '正在分析请求', '只切第一个分隔符');
  assert.ok(title.textContent.includes('a · b'), '其余内容属于详情，原样保留');
});


// ── 重试行 ────────────────────────────────────────────────────────────

test('重试行（只有 class 后缀可认）必须被打标', () => {
  // ⚠️ 内核 ModelRetryItem 渲染 <details class="<hash>_retryRow" data-active>，
  // **没有任何语义化 data-* 属性**，所以只能靠 CSS Module 的类名后缀识别。
  // 用户反馈「重试模型请求也没有上色」的根因就是第一版完全没覆盖它。
  const row = makeElement({ class: 'Sixlwa_retryRow' });
  assert.equal(tagElement(row), 'retry');
  assert.equal(row.getAttribute(CAT_ATTR), 'retry');
});

test('重试行的子部件（retrySummary / retryText）同样可上色', () => {
  for (const cls of ['Sixlwa_retrySummary', 'Sixlwa_retryText']) {
    assert.equal(tagElement(makeElement({ class: cls })), 'retry', `${cls} 必须可识别`);
  }
});

test('class 里只是恰好含 retry 字样（非 retryRow）不误判', () => {
  assert.equal(tagElement(makeElement({ class: 'my-retry-button' })), null);
  assert.equal(tagElement(makeElement({ class: 'retrying' })), null);
});

test('权限选择控件是动态元素：等级切换后必须重新判定（回归守卫）', () => {
  // 用户反馈「4 个权限等级切换后颜色不会跟随切换」：同一个元素只改文字、不换节点，
  // 旧实现把它当静态元素，被 data-cc-mark 永久冻结成第一次的颜色。
  const el = makeElement({ 'data-slot': 'conversation.input.permission' }, { text: '完全权限' });
  assert.equal(tagElement(el), 'perm-full');
  // 切成"仅可查看"：同一个元素，只换文本。
  el.text = '仅可查看';
  assert.equal(tagElement(el), 'perm-readonly', '切换等级后必须重新判定');
  el.text = 'Auto review';
  assert.equal(tagElement(el), 'perm-auto');
});


test('过程组标题：流式期间 TextShimmer 会渲染两份文本，两份都要切（否则动画副本整段着色）', () => {
  // ⚠️ 内核 TextShimmer 在 active（流式中）时把同一个 title **渲染两份**：
  // 一份正常，一份在 aria-hidden 的 shimmer sweep 里做扫光。假设"只有一个文本节点"
  // 会让切分在流式期间静默失效（真机 probe 实测 hasPart 恒为 false）。
  const doc = makeFakeDoc();
  const title = doc.createElement('button');
  title.setAttribute('data-process-activity', 'commands');
  const label = doc.createElement('span');
  label.className = '_7s-ua_label';
  label.textContent = '准备运行命令 · cd ~/Projects';
  title.appendChild(label);
  // 第二份：模拟 shimmer sweep 的副本（同样带 _label 类）。
  const sweep = doc.createElement('span');
  sweep.className = '_7s-ua_label _shimmerHighlight';
  sweep.textContent = '准备运行命令 · cd ~/Projects';
  label.appendChild(sweep);

  tagElement(title);

  const parts = title.querySelectorAll('[data-cc-part="label"]');
  assert.equal(parts.length, 2, '两份文本都要切出标签段');
  for (const part of parts) {
    assert.equal(part.textContent, '准备运行命令', '每份的标签段只含标签');
  }
  // 详情必须都保留（只是不进标签段）。
  for (const l of title.querySelectorAll('[class*="_label"]')) {
    assert.ok(String(l.textContent).includes('cd ~/Projects'), '详情必须保留');
  }
});

test('过程组标题：已切过的不重复包裹（幂等，避免无限嵌套）', () => {
  const doc = makeFakeDoc();
  const title = doc.createElement('button');
  title.setAttribute('data-process-activity', 'commands');
  const label = doc.createElement('span');
  label.className = '_7s-ua_label';
  label.textContent = '执行了命令 · x';
  title.appendChild(label);

  tagElement(title);
  const first = title.querySelectorAll('[data-cc-part="label"]').length;
  tagElement(title);
  tagElement(title);
  assert.equal(
    title.querySelectorAll('[data-cc-part="label"]').length,
    first,
    '重复打标不得嵌套出更多标签段',
  );
});


test('重试行必须是 plain 作用域（落到 tint 会一条 CSS 都命不中 → 打了标却没颜色）', () => {
  // ⚠️ 用户截图"模型重试的上色没成功"：行有 data-cc-cat="retry" 但颜色没变。
  // 根因是作用域落到了 tint，而 tint 只匹配 button/a，重试状态文字是普通 span。
  const row = makeElement({ class: 'Sixlwa_retryRow' });
  assert.equal(tagElement(row), 'retry');
  assert.equal(
    row.getAttribute(SCOPE_ATTR),
    'plain',
    '重试行必须用 plain 作用域（tint 只匹配 button/a，命不中状态文字）',
  );
});

test('压缩行必须是 plain 作用域', () => {
  const row = makeElement({ class: 'Sixlwa_compactionRow' });
  assert.equal(tagElement(row), 'compaction');
  assert.equal(row.getAttribute(SCOPE_ATTR), 'plain');
});


test('标签段被"包含在"被移除的子树里时，也必须触发重新切分（闪烁根因）', () => {
  // ⚠️ 血亏：真机 probe 实测 `withDetail:1` 但 `hasPart:false` —— 切分没恢复。
  // 根因：React 重渲染移除的是**包裹标签段的祖先**（TextShimmer 的 `_text` 层），
  // 而 `removedNodes` 给的是那个祖先本身。只判断 `node.matches([data-cc-part])`
  // 就漏掉了"标签段在后代里"这种最常见情形，于是永远不重新切分。
  //
  // ⚠️⚠️ 这个测试第一版是**假绿**：它只断言"标签段存在"，而首屏那次切分已经让它
  // 存在了，所以即使把代码改坏也照样通过。现在**真的**把标签段从 DOM 里删掉，
  // 再断言"重新长出来"，这样改坏代码必然变红。
  const prevMO = globalThis.MutationObserver;
  const prevRAF = globalThis.requestAnimationFrame;
  const instances = [];
  class FakeObserver {
    constructor(cb) { this.cb = cb; instances.push(this); }
    observe() {}
    disconnect() {}
  }
  globalThis.MutationObserver = FakeObserver;
  globalThis.requestAnimationFrame = (fn) => fn();
  try {
    const fd = makeFakeDoc();
    const title = fd.createElement('button');
    title.setAttribute('data-process-activity', 'commands');
    const label = fd.createElement('span');
    label.className = '_7s-ua_label';
    label.textContent = '正在分析请求 · 正文';
    title.appendChild(label);
    const body = fd.createElement('div');
    body.appendChild(title);
    const doc = fd;
    doc.body = body;
    doc.documentElement = null;

    const stop = startObserver({ document: doc });
    const firstPart = title.querySelector('[data-cc-part="label"]');
    assert.ok(firstPart !== null, '首屏应已切分');

    // React 重渲染：把 **包含标签段的祖先子树** 整块换掉。
    // 这里必须真的动 DOM —— 先把旧内容摘出去（模拟 React 重建），
    // 否则断言只是在验证"首屏那次的残留"。
    const textWrap = fd.createElement('span');
    textWrap.className = '_text';
    // 把标签段放进这个即将被移除的包装层，并从旧父节点摘除。
    firstPart.parentNode.removeChild(firstPart);
    textWrap.appendChild(firstPart);
    // 重建 label 的文本内容（React 会重新塞一个文本节点）。
    label.textContent = '正在分析请求 · 正文';
    assert.equal(
      title.querySelector('[data-cc-part="label"]'),
      null,
      '前置条件：标签段此刻确实已不在 DOM 里（否则测试是假绿）',
    );

    // 报告"被移除的是 textWrap"（祖先），标签段只是它的后代。
    instances[0].cb([{ type: 'childList', target: label, addedNodes: [], removedNodes: [textWrap] }]);
    assert.ok(
      title.querySelector('[data-cc-part="label"]') !== null,
      '被移除子树里包含标签段时必须重新切分（否则标签时有时无 = 闪烁）',
    );
    stop();
  } finally {
    globalThis.MutationObserver = prevMO;
    if (prevRAF === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = prevRAF;
  }
});


// ── 命令三档：折叠行只有描述，必须从 React fiber 取真实命令 ──────────────
//
// ⚠️ 用户反馈"命令的三个颜色层级没有实现"。根因不是配色，是**判定文本取错了**：
// 内核折叠状态下 bash 行只渲染「描述」（"显示当前工作目录"），真实命令（`pwd`）
// 只在展开后才进 DOM。拿描述过危险词判定，八条里八条都是 low —— 危险词
// （`curl`/`chmod -R`/`dd if=`/`mkfs`）全在命令原文里，描述里一个都没有。

test('bash 行：能从 React fiber 读到真实命令原文', () => {
  const el = makeElement({ 'data-sample': 'bash', 'data-variant': 'bash' }, { text: '显示当前工作目录' });
  // 造一条与真机一致的 fiber 链：元素 → ... → 带 block 的组件节点。
  el.__reactFiber$test = {
    memoizedProps: { className: 'x_root' },
    return: {
      memoizedProps: { className: 'x_card' },
      return: {
        memoizedProps: {
          block: { call: { name: 'bash', argsRaw: JSON.stringify({ command: 'dd if=/dev/zero of=/tmp/x bs=1k count=4', description: '写测试镜像' }) } },
        },
        return: null,
      },
    },
  };
  assert.equal(tagElement(el), 'commandHigh', '必须按真实命令(dd if=)判为高危，而不是按描述判低危');
});

test('bash 行：fiber 读不到时退回可见文本（不得抛错、不得不上色）', () => {
  const el = makeElement({ 'data-sample': 'bash', 'data-variant': 'bash' }, { text: '列出当前目录内容' });
  // 没有 fiber：应退回描述文本 -> low，且**必须仍然上色**。
  assert.equal(tagElement(el), 'commandLow');
});

test('bash 行：fiber 结构异常/JSON 坏掉时安全降级', () => {
  const el = makeElement({ 'data-sample': 'bash', 'data-variant': 'bash' }, { text: '随便什么' });
  el.__reactFiber$test = { memoizedProps: { block: { call: { argsRaw: '{ 这不是合法 JSON' } } }, return: null };
  assert.equal(tagElement(el), 'commandLow', 'JSON 坏掉必须安全退回，不能抛错');

  const el2 = makeElement({ 'data-sample': 'bash', 'data-variant': 'bash' }, { text: '随便什么' });
  el2.__reactFiber$test = { memoizedProps: { block: null }, return: null };
  assert.equal(tagElement(el2), 'commandLow', 'block 为 null 必须安全退回');
});

test('非 bash 的"命令类"行不得去读 fiber（否则会被别人的 block 劫持）', () => {
  // ⚠️ 这条测试第一版是**假绿**：用 `data-tool="read"` 断言，但 `read` 分支
  // 返回 base 后直接 return、**根本不消费判定文本** —— 所以撤掉 `isBash` 限制
  // 它照样通过，等于什么都没测。
  // 真正有劫持风险的是"走 commandCategory(text) 的行"，共两条路径：
  //   ① `data-variant="bash"`（就是要读 fiber 的那个）
  //   ② `data-kind="tool"` / 过程组 `data-process-activity="commands"`（不读 fiber）
  // 这里用 ② 来验：它的 fiber 里若挂着 block，不能被误读成 commandHigh。
  const el = makeElement({ 'data-kind': 'tool' }, { text: '执行了命令' });
  el.__reactFiber$test = { memoizedProps: { block: { call: { argsRaw: JSON.stringify({ command: 'rm -rf /' }) } } }, return: null };
  assert.equal(
    tagElement(el),
    'commandLow',
    'kind=tool 行必须按自己的可见文本判定（low），不能被 fiber 里的 rm -rf / 劫持成 commandHigh',
  );

  // 过程组标题同理。
  const el2 = makeElement({ 'data-process-activity': 'commands' }, { text: '执行了命令' });
  el2.__reactFiber$test = { memoizedProps: { block: { call: { argsRaw: JSON.stringify({ command: 'mkfs.ext4 /dev/sda' }) } } }, return: null };
  assert.equal(tagElement(el2), 'commandLow', '过程组标题不得被 fiber 劫持');
});


// ── 压缩进行中（"压缩中没有上色"）────────────────────────────────────
//
// ⚠️ `/compact` 这一行在内核里分两段渲染、用的是**不同组件**：
//   进行中 → GenericCommandCard（`data-variant="others"` + `data-state="running"`，
//            状态文字「正在压缩…」在 `_summary` 里）
//   已完成 → CompactionItem（`class="…_compactionRow"`）
// 第一版只覆盖了后者，于是"压缩的上色只在压缩完成后才上色"。
// 进行中这一行的识别依据（内核源码已定）：`data-variant="others"` + `data-state="running"`
// + 内部 `[class*="_summary"]` 文本命中「正在压缩」/「Compacting context」。

test('压缩进行中：靠 _summary 文本「正在压缩…」识别（此时类名里没有 compaction）', () => {
  const doc = makeFakeDoc();
  const root = doc.createElement('div');
  root.setAttribute('data-variant', 'others');
  root.setAttribute('data-state', 'running');
  const title = doc.createElement('span');
  title.className = '_abc_title';
  title.textContent = 'compact';
  root.appendChild(title);
  const summary = doc.createElement('span');
  summary.className = '_abc_summary';
  summary.textContent = '正在压缩…';
  root.appendChild(summary);

  assert.equal(tagElement(root), 'compaction', '进行中的压缩行必须识别为 compaction');
  // 必须用 plain：header 作用域只染 `_title`（"compact"），而状态文字
  // "正在压缩…" 在 `_summary` 里 —— 用 header 的话那半句还是灰的，
  // 用户看到的仍是"压缩中没有上色"。
  assert.equal(root.getAttribute(SCOPE_ATTR), 'plain', '进行中的压缩行必须整行染（含 _summary）');
});

test('压缩进行中：别的斜杠命令不得被误判（标题不是 compact 也无 _summary 压缩文本）', () => {
  const doc = makeFakeDoc();
  const root = doc.createElement('div');
  root.setAttribute('data-variant', 'others');
  const title = doc.createElement('span');
  title.className = '_abc_title';
  title.textContent = 'clear';
  root.appendChild(title);

  // 内核里 /clear 等其它斜杠命令共用 `data-variant="others"`，但既无
  // `data-state="running"`、也无「正在压缩」的 _summary 文本 → 不得被染
  // （返回 null），否则会污染整屏。判据已由 isRunningCompaction 的
  // data-state + _summary 文本双重把关。
  assert.equal(tagElement(root), null, '其它斜杠命令不得被误判为 compaction，也不该被染');
});

test('bash 行：命令原文还没读到时**不得冻结**，读到后必须纠正档位', () => {
  // 这是「命令的三个颜色层级没有实现」的回归守卫。
  //
  // 真机证据（用户 F12 截图）：137 个元素分类全对，唯独**没有一条** commandMid /
  // commandHigh。根因不是分类逻辑，而是**命令行首次进 DOM 时还在运行中**：
  // 那一刻 React fiber 上的 `block.call.argsRaw` 尚未写入，读命令返回 null，
  // 于是退回可见文本（模型的自然语言描述，如 "List current slot registrations"），
  // 描述里没有危险词 → 判成 commandLow → 立刻被 data-cc-mark **永久冻结**。
  // 等命令真正落到 fiber 上时，早已走"幂等跳过"分支，再也不会重判。
  const doc = makeFakeDoc();

  // 假 bash 行：根元素带 data-sample/data-variant，可见文本是**描述**。
  const root = doc.createElement('div');
  root.setAttribute('data-sample', 'bash');
  root.setAttribute('data-variant', 'bash');
  const row = doc.createElement('div');
  row.setAttribute('data-disclosure-row', '');
  row.textContent = 'Check plugin profile bundle';
  root.appendChild(row);

  // 第一轮：fiber 里还没有命令（模拟流式进行中）→ 只能按描述判成 low。
  assert.equal(tagElement(root), 'commandLow', '进行中：只能按描述判，先给 low');

  // 关键断言：**不得打 mark**。打了就会被永久冻结，后面再也不会重判。
  assert.equal(
    root.getAttribute(MARK_ATTR),
    null,
    '命令原文未读到的 bash 行绝不能打 mark —— 打了就永远冻结在 commandLow',
  );

  // 第二轮：命令原文到位（模拟 React 把 argsRaw 写进 fiber）。
  const raw = JSON.stringify({ command: 'dd if=/dev/zero of=/tmp/x.img bs=1k count=4' });
  root.__reactFiber$test = { memoizedProps: { block: { call: { argsRaw: raw } } }, return: null };

  assert.equal(tagElement(root), 'commandHigh', '命令到位后必须重判为高危档');
  assert.equal(root.getAttribute(MARK_ATTR), '', '读到命令后照常打 mark（此后不再重判）');
});

test('bash 行：命令已读到的那一轮就应该直接打 mark（不做无谓的重扫）', () => {
  const doc = makeFakeDoc();
  const root = doc.createElement('div');
  root.setAttribute('data-sample', 'bash');
  const row = doc.createElement('div');
  row.textContent = 'Create image';
  root.appendChild(row);

  const raw = JSON.stringify({ command: 'dd if=/dev/zero of=/tmp/x.img bs=1k count=4' });
  root.__reactFiber$test = { memoizedProps: { block: { call: { argsRaw: raw } } }, return: null };

  assert.equal(tagElement(root), 'commandHigh');
  assert.equal(root.getAttribute(MARK_ATTR), '', '读到命令时必须打 mark，避免每帧重扫');
});

test('bash 行：低危命令读不到 fiber 时也必须保持 low（不能误升档）', () => {
  const doc = makeFakeDoc();
  const root = doc.createElement('div');
  root.setAttribute('data-sample', 'bash');
  const row = doc.createElement('div');
  row.textContent = 'List files';
  root.appendChild(row);

  assert.equal(tagElement(root), 'commandLow', '没有 fiber 时必须保守判 low');
  assert.equal(root.getAttribute(MARK_ATTR), null, '仍未读到命令 → 不打 mark');
});


// ── 2026-10-17 缺陷 ①：「已完成 · 用时 xxx」不上色 ─────────────────────
//
// 真机 + 内核源码双重确认（`dsh-client-ui-chat` 的 `TurnProcessNodeView`）：
//   <span class="…_visuallyHidden" role="status">已完成</span>   ← 屏幕阅读器副本（看不见）
//   <button data-turn-process="22" …>
//     <span class="…_label">已完成，用时 3分54秒</span>
//   </button>                                                    ← 用户真正看到的
//
// 旧实现要求 class 含 `visuallyHidden` → 命中的是上面那个视觉隐藏副本
// （`clip:rect(0 0 0 0);width:1px;height:1px`）→ 给它上色屏幕上看不见。
// 这就是用户反馈「已完成 · 用时 xxx 颜色未生效」的根因。
test('缺陷①：「已完成 · 用时」必须染在**可见**的 data-turn-process 宿主上', () => {
  const doc = makeFakeDoc();
  // 照内核源码还原：视觉隐藏副本 + 可见 button。
  const sr = doc.createElement('span');
  sr.className = 'TrFNTq_visuallyHidden';
  sr.setAttribute('role', 'status');
  sr.textContent = '已完成';
  const button = doc.createElement('button');
  button.setAttribute('data-turn-process', '22');
  button.setAttribute('data-turn-process-messages', '3');
  const label = doc.createElement('span');
  label.className = 'Lu6X2a_label';
  label.textContent = '已完成，用时 3分54秒';
  button.appendChild(label);
  const chevron = doc.createElement('svg');
  button.appendChild(chevron);
  const root = doc.createElement('div');
  root.appendChild(sr);
  root.appendChild(button);

  assert.equal(tagElement(button), 'done', '可见宿主必须被判为 done（成功色）');
  assert.equal(button.getAttribute(CAT_ATTR), 'done');
  assert.equal(
    button.getAttribute(SCOPE_ATTR),
    'self',
    '它不是 DisclosureRow，必须用 self 作用域（header 会一条 CSS 都命不中）',
  );
  // 视觉隐藏副本**不得**再被当成 done 宿主（旧实现的根因）。
  assert.equal(tagElement(sr), null, 'visuallyHidden 副本是看不见的，不得作为染色目标');
});

test('缺陷①：classifyAttrs 不再依赖 visuallyHidden（还原修复本测试必须失败）', () => {
  // 直接调纯函数：旧判据是「class 含 visuallyHidden + role=status」，
  // 新判据是「带 data-turn-process」。
  const withTurnProcess = { 'data-turn-process': '22', class: 'Lu6X2a_root' };
  assert.equal(classifyAttrs(withTurnProcess), 'done');
  // 视觉隐藏副本（旧实现唯一命中的形状）现在必须返回 null。
  const hiddenCopy = { class: 'TrFNTq_visuallyHidden', role: 'status' };
  assert.equal(classifyAttrs(hiddenCopy), null, '视觉隐藏副本不得再被判为 done');
});

// ── 2026-10-17 缺陷 ②：上下文进度圈不上色 ────────────────────────────
//
// 真机 + 内核源码（`dsh-client-ui-conversation` 的 `ContextMeter`）：
//   <button class="…_trigger" aria-label="上下文已用 29%" aria-haspopup="dialog">
//     <svg><circle class="…_track"/><circle class="…_fill"/></svg>
//     <span>29%</span>
//   </button>
//
// 两处都错：① classifyAttrs 走到这个 button 时返回 null（它不带任何 data-*）；
// ② isEmptyActionsRow 读的是 dock 容器自己的 aria-label（容器没有）→ meta/plain。
test('缺陷②：进度圈按钮必须按自身 aria-label 的百分比分档上色', () => {
  const cases = [
    ['上下文已用 20%', 'usageLow'],
    ['上下文已用 40%', 'usageMid'],
    ['上下文已用 60%', 'usageHigh'],
    ['上下文已用 70%', 'usageCritical'],
  ];
  for (const [label, expected] of cases) {
    const el = makeElement({ 'aria-label': label });
    assert.equal(tagElement(el), expected, `进度圈 ${label} 必须分到 ${expected}`);
    assert.equal(el.getAttribute(SCOPE_ATTR), 'self', '进度圈就是被染的那个元素本身');
  }
});

test('缺陷②：tokens 药丸（含 % 但用户要求不上色）绝不能被上色', () => {
  // 真机实测：dock 里并排两颗按钮都带 %，只有进度圈要染。
  const pill = makeElement({ class: 'bGnI3G_pill', 'aria-label': '695M tok · 缓存命中 98%' });
  assert.equal(tagElement(pill), null, 'tokens 药丸必须保持原生配色（用户明确要求）');
  assert.equal(pill.getAttribute(CAT_ATTR), null);
  // 英文界面同样不得误伤。
  const pillEn = makeElement({ class: 'x_pill', 'aria-label': '695M tok · cache hit 98%' });
  assert.equal(tagElement(pillEn), null, '英文 tokens 药丸同样不得上色');
});

test('缺陷②：进度圈百分比跨档时必须重判（不能被 data-cc-mark 冻结）', () => {
  // 内核 ContextMeter 复用同一个 button 节点，只改 aria-label。
  // 用户分档 <35 绿 / 35-49 黄 / 50-67 橙 / >=68 红：不重判就会
  // "永远是第一档颜色，快到压缩阈值也不变"。
  const el = makeElement({ 'aria-label': '上下文已用 20%' });
  assert.equal(tagElement(el), 'usageLow');
  el.attrs['aria-label'] = '上下文已用 80%';
  assert.equal(tagElement(el), 'usageCritical', '跨档后必须重判，不得被 mark 冻结');
  assert.equal(el.getAttribute(MARK_ATTR), null, '会变的元素不得打 mark');
});

test('缺陷②：classifyAttrs 对自身 aria-label 百分比必须有显式分支', () => {
  // 这条守的是"分支存在"本身：还原修复（删掉那个分支）→ 立即失败。
  assert.equal(classifyAttrs({}, { usageText: '上下文已用 29%' }), 'usageLow');
  assert.equal(classifyAttrs({ 'aria-label': '上下文已用 29%' }, { usageText: '上下文已用 29%' }), 'usageLow');
  // 但 dock 容器自己没有 aria-label 时不得凭空拿到 usage 类别。
  assert.equal(classifyAttrs({ 'data-composer-dock': 'true' }), 'meta');
  // tokens 药丸即使在 options.usageText 里带 % 也不得进 usage 档。
  assert.equal(
    classifyAttrs({ class: 'x_pill', 'aria-label': '695M tok · 缓存命中 98%' }, { usageText: '695M tok · 缓存命中 98%' }),
    null,
    'tokens 药丸不得进 usage 分档',
  );
});
