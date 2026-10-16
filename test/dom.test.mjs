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
  const el = makeElement({ 'data-process-activity': 'thinking' }, { text: '正在分析请求' });
  tagElement(el);
  assert.equal(el.getAttribute(SCOPE_ATTR), 'title', '初始只有标签：染文字');
  // 正文到达（内核改 textNode.nodeValue，不产生 childList 记录）。
  el.text = '正在分析请求 · 我先看看这个 DOM 结构再决定';
  tagElement(el);
  assert.equal(el.getAttribute(SCOPE_ATTR), 'icon', '正文到达后必须改成只染图标');
  // 组关闭后正文消失，应能回到 title。
  el.text = '正在分析请求';
  tagElement(el);
  assert.equal(el.getAttribute(SCOPE_ATTR), 'title', '正文消失后应回到染文字');
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

test('过程组标题带分析正文时降级为只染图标', () => {
  // 内核把「标签 + ' · ' + 分析正文」放在同一个文本节点里。
  const withDetail = makeElement({ 'data-process-activity': 'reading' }, { text: '正在分析请求 · 我看看这个 DOM 结构' });
  assert.equal(withDetail.getAttribute(SCOPE_ATTR), null, '尚未打标');
  tagElement(withDetail);
  assert.equal(withDetail.getAttribute(SCOPE_ATTR), 'icon', '带正文时只染图标，避免正文被上色');

  const pureLabel = makeElement({ 'data-process-activity': 'commands' }, { text: '执行了命令' });
  tagElement(pureLabel);
  assert.equal(pureLabel.getAttribute(SCOPE_ATTR), 'title', '纯标签时标签与图标一起染');
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
    const label = makeElement({}, { text: '正在分析请求' });
    const title = makeElement({ 'data-process-activity': 'thinking' }, { children: [label] });
    label.parentNode = title;
    const doc = {
      body: makeElement({}, { children: [title] }),
      querySelectorAll: () => [],
      documentElement: null,
    };

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
    label.text = '正在分析请求 · 我先看看这个 DOM 结构再决定';
    const textNode = { nodeType: 3, parentNode: label };
    instances[0].callback([{ type: 'characterData', target: textNode }]);

    assert.equal(
      title.getAttribute(SCOPE_ATTR),
      'icon',
      'characterData 记录必须上溯到 title 并重判为"只染图标"',
    );
    stop();
  } finally {
    globalThis.MutationObserver = prevMO;
    if (prevRAF === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = prevRAF;
  }
});
