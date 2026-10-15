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

import { tagElement, tagTree, clearTags } from '../src/dom.js';
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
  const row = makeElement({ 'data-tool': 'bash' });
  assert.equal(tagElement(row), 'command');
  assert.equal(row.getAttribute(CAT_ATTR), 'command');
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
  const row = makeElement({ 'data-kind': 'tool' });
  assert.equal(tagElement(row), 'command');
  assert.equal(row.getAttribute(SCOPE_ATTR), 'self');
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

test('内层 data-sample 卡片不被重复打标（避免双竖条）', () => {
  // 真实结构：外层工具行带 data-tool，内层 bash 卡片带 data-sample + data-variant。
  const inner = makeElement({ 'data-sample': 'bash', 'data-variant': 'bash' });
  const outer = makeElement({ 'data-tool': 'bash' }, { children: [inner] });

  const count = tagTree(outer);
  assert.equal(count, 1, '只应打标外层一个元素');
  assert.equal(outer.getAttribute(CAT_ATTR), 'command');
  assert.equal(inner.getAttribute(CAT_ATTR), null, '内层卡片不得打标');
});

test('危险命令判定只读表头文本，不读展开后的正文', () => {
  // 表头写的是普通命令；展开正文里含 sudo 字样（例如输出里打印了 sudo）。
  const headerRow = makeElement({ 'data-disclosure-row': '' }, { text: 'ls -la' });
  const header = makeElement({ 'data-disclosure-header': '' }, { children: [headerRow] });
  const body = makeElement({}, { text: '输出：请用 sudo 安装依赖' });
  const root = makeElement({ 'data-tool': 'bash' }, { children: [header, body] });

  assert.equal(tagElement(root), 'command', '正文里的 sudo 不得让它变成 danger');
  assert.equal(root.getAttribute(CAT_ATTR), 'command');
});

test('表头本身是危险命令时正确归入 danger', () => {
  const headerRow = makeElement({ 'data-disclosure-row': '' }, { text: 'rm -rf /tmp/x' });
  const header = makeElement({ 'data-disclosure-header': '' }, { children: [headerRow] });
  const root = makeElement({ 'data-tool': 'bash' }, { children: [header] });

  assert.equal(tagElement(root), 'danger');
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
