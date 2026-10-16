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
