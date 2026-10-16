/**
 * 压缩进行中（③）与尾部按钮（④）的回归测试。
 *
 * 测试目标：
 *  - ③ 压缩**进行中**的命令行（`GenericCommandCard`：
 *     `data-variant="others"` + `data-state="running"` + `_summary` 文本
 *     「正在压缩…」/「Compacting context…」）必须分类为 `compaction`；
 *  - 反例：同形态但 summary 是别的命令（如 `/clear`）**不得**判成 compaction；
 *  - ④ 尾部三个按钮（复制 / 点赞 / 点踩）本身无钩子、由 `data-turn-tail` 容器级
 *     `meta`/`actions` 作用域统一染色 —— 经真机核验（turn=62，探针读回
 *     `color=rgb(143,163,181)` = meta.dark #8FA3B5）**本来就已生效**，
 *     因此本测试只做"现状守卫"：容器分类为 `meta`、作用域 `actions`，
 *     三个按钮自身不被误判为任何类别（返回 null），避免未来改动误伤。
 *
 * 为什么单独写一个 harness：现有 `test/dom.test.mjs` 的 `makeElement`
 * 只支持 `[attr]` / `[attr="value"]` 选择器，不支持 `[class*="..."]`。
 * 而 `isRunningCompaction` 依赖 `element.querySelector('[class*="_summary"]')`，
 * 所以这里自带一个支持 `[class*="x"]`、`[attr]`、`[attr="v"]` 的极简元素。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

import { classifyAttrs, isRunningCompaction } from '../src/classify.js';
import { tagElement } from '../src/dom.js';
import { CAT_ATTR, SCOPE_ATTR, MARK_ATTR } from '../src/css.js';

/**
 * 极简元素：支持 classify/dom 层需要的 getAttribute / querySelector /
 * getAttribute 链。selector 仅支持本测试用到的三种形态。
 */
function makeEl(attrs = {}, options = {}) {
  const el = {
    nodeType: 1,
    attrs: { ...attrs },
    children: options.children ?? [],
    text: options.text ?? '',
    getAttribute(name) {
      // class 经 className 暴露；其余走 attrs。
      if (name === 'class') return Object.hasOwn(this.attrs, 'class') ? this.attrs.class : null;
      return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null;
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    matches(sel) { return matchSimple(this, sel); },
    querySelector(sel) { return querySimple(this, sel); },
    get textContent() {
      return this.text + this.children.map((c) => c.textContent ?? '').join('');
    },
  };
  return el;
}

/** 仅支持 `[class*="x"]` / `[attr]` / `[attr="v"]`。 */
function matchSimple(el, selector) {
  return String(selector).split(',').map((s) => s.trim()).filter(Boolean).some((part) => {
    const star = /^\[class\*="([^"]+)"\]$/.exec(part);
    if (star !== null) {
      const cls = el.getAttribute('class');
      return typeof cls === 'string' && cls.includes(star[1]);
    }
    const eq = /^\[([\w-]+)="([^"]*)"\]$/.exec(part);
    if (eq !== null) return el.getAttribute(eq[1]) === eq[2];
    const bare = /^\[([\w-]+)\]$/.exec(part);
    if (bare !== null) return el.getAttribute(bare[1]) !== null;
    return false;
  });
}

/** 在自身或后代里找匹配 `[class*="x"]` 的元素（_summary / _title 钩子）。 */
function querySimple(el, selector) {
  const part = String(selector).trim();
  const star = /^\[class\*="([^"]+)"\]$/.exec(part);
  if (star === null) return null;
  const needle = star[1];
  // 自身
  const cls = el.getAttribute('class');
  if (typeof cls === 'string' && cls.includes(needle)) return el;
  // 后代（本测试场景只需一层）
  for (const child of el.children ?? []) {
    const ccls = child.getAttribute ? child.getAttribute('class') : null;
    if (typeof ccls === 'string' && ccls.includes(needle)) return child;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// ③ 压缩进行中：纯函数级判据
// ─────────────────────────────────────────────────────────────

test('③ 进行中压缩行（中文「正在压缩…」）→ isRunningCompaction 为真', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'running' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: '正在压缩…' })],
  });
  assert.equal(isRunningCompaction(root, { 'data-variant': 'others' }), true);
});

test('③ 进行中压缩行（英文 Compacting context…）→ 同样识别', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'running' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: 'Compacting context…' })],
  });
  assert.equal(isRunningCompaction(root, { 'data-variant': 'others' }), true);
});

test('③ 反例：data-state 不是 running → 不识别', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'ok' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: '正在压缩…' })],
  });
  assert.equal(isRunningCompaction(root, { 'data-variant': 'others' }), false);
});

test('③ 反例：summary 不是「正在压缩」→ 不识别（避免误染 /clear 等命令）', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'running' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: '已清空上下文' })],
  });
  assert.equal(isRunningCompaction(root, { 'data-variant': 'others' }), false);
});

test('③ 反例：没有 _summary → 不识别', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'running' });
  assert.equal(isRunningCompaction(root, { 'data-variant': 'others' }), false);
});

test('③ 反例：data-variant 不是 others → 不识别', () => {
  const root = makeEl({ 'data-variant': 'bash', 'data-state': 'running' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: '正在压缩…' })],
  });
  assert.equal(isRunningCompaction(root, { 'data-variant': 'bash' }), false);
});

// ─────────────────────────────────────────────────────────────
// ③ 经 classifyAttrs：分类为 compaction，且作用域 plain（整行染，含 _summary）
// ─────────────────────────────────────────────────────────────

test('③ classifyAttrs：进行中压缩行 → compaction（中文）', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'running' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: '正在压缩…' })],
  });
  assert.equal(classifyAttrs({ 'data-variant': 'others' }, { element: root }), 'compaction');
});

test('③ classifyAttrs：进行中压缩行 → compaction（英文）', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'running' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: 'Compacting context…' })],
  });
  assert.equal(classifyAttrs({ 'data-variant': 'others' }, { element: root }), 'compaction');
});

test('③ 反例 classifyAttrs：/clear 进行中（summary 为其它文字）→ null，不误染', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'running' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: '正在清空会话' })],
  });
  assert.equal(classifyAttrs({ 'data-variant': 'others' }, { element: root }), null);
});

test('③ 反例 classifyAttrs：/clear 已完成（state=ok，summary 为结果）→ null', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'ok' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: '已清空会话' })],
  });
  assert.equal(classifyAttrs({ 'data-variant': 'others' }, { element: root }), null);
});

// ─────────────────────────────────────────────────────────────
// ③ 经 tagElement：打出 CAT=compaction / SCOPE=plain
// ─────────────────────────────────────────────────────────────

test('③ tagElement：进行中压缩行打标为 compaction + plain 作用域（含 _summary）', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'running' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: '正在压缩…' })],
  });
  assert.equal(tagElement(root), 'compaction');
  assert.equal(root.getAttribute(CAT_ATTR), 'compaction');
  // 必须用 plain：header 只染 _title（"compact"），而状态文字在 _summary。
  assert.equal(root.getAttribute(SCOPE_ATTR), 'plain');
  assert.equal(root.getAttribute(MARK_ATTR), '');
});

test('③ tagElement 反例：普通命令进行中（summary 非压缩）→ null（不着色，保持原状）', () => {
  const root = makeEl({ 'data-variant': 'others', 'data-state': 'running' }, {
    children: [makeEl({ class: '_abc_summary' }, { text: '正在清空会话' })],
  });
  assert.equal(tagElement(root), null, '其它斜杠命令（/clear 等）不得被染，避免污染整屏');
});

// ─────────────────────────────────────────────────────────────
// ④ 尾部按钮：现状守卫（真机核验 turn=62 已确认本就被染，无需改代码）
// ─────────────────────────────────────────────────────────────

test('④ 现状守卫：turn-tail 容器分类为 meta、作用域 actions', () => {
  const tail = makeEl({ 'data-turn-tail': '62' });
  assert.equal(classifyAttrs({ 'data-turn-tail': '62' }), 'meta');
  assert.equal(tagElement(tail), 'meta');
  assert.equal(tail.getAttribute(CAT_ATTR), 'meta');
  assert.equal(tail.getAttribute(SCOPE_ATTR), 'actions');
});

test('④ 现状守卫：三个目标按钮本身无钩子 → 返回 null（由容器级 actions 规则染色）', () => {
  // 真机结构：按钮只有 class 与 aria-label、无任何 data-*，
  // 自身不会被候选选择器命中；颜色来自祖先 turn-tail 的 meta/actions 作用域。
  for (const label of ['复制', '好的回答', '有问题的回答']) {
    const btn = makeEl({ class: '_4sesoa_action', 'aria-label': label });
    assert.equal(classifyAttrs({ class: '_4sesoa_action', 'aria-label': label }), null,
      `按钮「${label}」自身不应被分类（靠容器染）`);
  }
});

// ─────────────────────────────────────────────────────────────
// ③-守卫层：候选选择器必须能把「进行中的压缩行」捞进来
// ─────────────────────────────────────────────────────────────

test('③ 守卫：CANDIDATE_SELECTOR 必须包含进行中压缩行的根元素钩子', async () => {
  // ⚠️⚠️ 这条守卫来自一次**实测到的假绿**（2026-10-17）。
  //
  // 上游子代理在 `src/dom.js` 的 `CANDIDATE_SELECTOR` 里补了
  // `'[data-variant="others"]'`，并在注释里称它是"第二层根因"——
  // 但**没有任何测试锁住它**：实测把它删掉后，本文件其余 14 个用例**仍然全绿**。
  //
  // 原因：其余用例要么直接调 `isRunningCompaction()`（绕过候选集），
  // 要么用假元素调 `tagElement()`（不经过 `nearestCandidate` 的 `matches` 判定）。
  // 于是"压缩行根本进不了候选集"这个**真实故障模式**在测试里不可见 ——
  // 与用户反馈的"压缩中没有上色"正是同一个形状。
  //
  // 这条守卫从**源码层**断言那条选择器存在：它比行为测试弱，但对
  // "选择器被误删/被重构掉"这种改动是准的（行为测试在这条路径上是空的）。
  const src = await readFile(new URL('../src/dom.js', import.meta.url), 'utf8');
  const block = /const CANDIDATE_SELECTOR = \[([\s\S]*?)\]\.join\(','\)/.exec(src);
  assert.notEqual(block, null, '未能定位 CANDIDATE_SELECTOR（若结构变了请同步更新本守卫）');

  const selectors = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(
    selectors.some((s) => s.includes('data-variant') && s.includes('others')),
    'CANDIDATE_SELECTOR 缺少 [data-variant="others"]：进行中的压缩行（GenericCommandCard）'
      + '只有 data-variant/data-state 与 _summary，没有 _compaction* 类名，'
      + `不补这条就永远扫不到 → 用户看到"压缩中没有上色"。实际选择器：${selectors.join(', ')}`,
  );
});
