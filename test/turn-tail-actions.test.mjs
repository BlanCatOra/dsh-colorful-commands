/**
 * 消息尾部按钮上色范围的回归测试。
 *
 * ## 用户要求（2026-10-17）
 *
 * 「我要的是 消息尾部只有**分支**和**用量**上色，
 *   复制 点踩和点赞**不要上色**」
 *
 * ## 为什么这条用"源码级断言"而不是渲染断言
 *
 * 判据是 **CSS 选择器的排除语义**（`:not([data-slot="…"] *)`），
 * 而仓库的测试 DOM 是极简假元素（见 `dom.test.mjs` 的 `makeElement`），
 * **没有 CSS 引擎** —— 无法真的算 computed style。
 * 所以这里断言"生成的 CSS 里确实带了那条排除"，并配一条变异测试证明
 * 断言不是空转。这与 `actions-compaction.test.mjs` 里对
 * `CANDIDATE_SELECTOR` 的守卫是同一种取舍。
 *
 * ## 真机结构依据（2026-10-17 探针读回，turn=62）
 *
 * ```
 * DIV[data-turn-tail="62"]
 *   DIV._4sesoa_actions
 *     DIV[data-slot="conversation.chat.assistant-actions"]   ← 复制/点赞/点踩 在这层里面
 *       BUTTON{aria-label="复制"}
 *       BUTTON{aria-label="好的回答" aria-pressed="false"}
 *       BUTTON{aria-label="有问题的回答" aria-pressed="false"}
 *     BUTTON{aria-label="在新对话中分支"}                     ← 分支在外
 *   BUTTON{_7hGK5G_trigger} 文本「用量 29.9M tok」             ← 用量也在外
 * ```
 *
 * 复制与分支**同类名同父容器**（都是 `_4sesoa_action`），所以只能用结构区分：
 * 三个"不该染"的按钮全部在那个 slot 容器内部。
 *
 * ⚠️ 不能用 aria-label 文案（"复制" / "Copy"）作判据 —— 那是本地化字符串。
 *
 * @module dsh-colorful-commands/test/turn-tail-actions
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildStylesheet, resolveColors } from '../src/css.js';
import { presetColors } from '../src/palettes.js';

/** 生产环境下真实生成的整份样式表。 */
const CSS = buildStylesheet(
  resolveColors({ preset: 'chinese', colors: {} }, { presetColors: presetColors('chinese') }).colors,
  { enabled: true },
);

/** 取所有 `actions` 作用域的规则行。 */
const actionRules = CSS.split('\n').filter((line) => line.includes('data-cc-scope="actions"'));

const EXCLUSION = ':not([data-slot="conversation.chat.assistant-actions"] *)';

test('actions 作用域规则存在（前置条件）', () => {
  assert.ok(actionRules.length > 0, '必须生成 actions 作用域规则，否则尾部完全不上色');
});

test('每一条 actions 规则都必须排除 assistant-actions 插槽内的按钮', () => {
  // 用户要求：复制/点赞/点踩 **不上色**。
  // 这三者全部位于 [data-slot="conversation.chat.assistant-actions"] 内部，
  // 所以每条 actions 规则都必须带这个排除。
  const bad = actionRules.filter((line) => !line.includes(EXCLUSION));
  assert.deepEqual(
    bad,
    [],
    '以下 actions 规则没有排除 assistant-actions 插槽，会把复制/点赞/点踩一起染上：\n'
      + bad.join('\n'),
  );
});

test('排除规则同时覆盖「按钮颜色」与「图标颜色」两条', () => {
  // 缺哪一条都会漏：
  //  - 缺 button 规则 → 图标（stroke=currentColor）跟随按钮色，可能仍被染或半染；
  //  - 缺 svg 规则    → 图标颜色不跟随（用户曾反馈"文字上色了、图标没有"）。
  const hasButtonRule = actionRules.some((line) => line.includes(':is(button,'));
  const hasSvgRule = actionRules.some((line) => /\bsvg/.test(line));
  assert.ok(hasButtonRule, 'actions 必须有按钮规则');
  assert.ok(hasSvgRule, 'actions 必须有 svg 规则');
});

test('排除集必须恰好是「评分插槽 + 复制文案」两类，不能多排', () => {
  // 「分支」与「用量」都要留着上色，所以排除**只能**覆盖：
  //   ① assistant-actions 插槽内部（点赞/点踩）
  //   ② 复制按钮的 aria-label（zh/en 闭集，含点击后的瞬时文案）
  // 多排任何一条都可能把分支或用量也排掉（用户要的是"只有这两个上色"，
  // 但**不能**连这两个都不上色）。
  const EXPECTED_NOT = [
    ':not([data-slot="conversation.chat.assistant-actions"] *)',
    ':not([aria-label="复制"])',
    ':not([aria-label="复制成功"])',
    ':not([aria-label="Copy"])',
    ':not([aria-label="Copied"])',
  ];

  for (const line of actionRules) {
    const nots = line.match(/:not\([^)]*(?:\)[^)]*)?\)/g) ?? [];
    // 用更稳的方式：按 `:not(` 切分后逐个闭合括号提取
    const found = [];
    let rest = line;
    let idx;
    while ((idx = rest.indexOf(':not(')) !== -1) {
      rest = rest.slice(idx + 5);
      let depth = 1;
      let j = 0;
      for (; j < rest.length && depth > 0; j++) {
        if (rest[j] === '(') depth += 1;
        else if (rest[j] === ')') depth -= 1;
      }
      // `j` 指向闭合 `)` 之后一位（for-update 会自增），所以内容到 j-1 为止。
      found.push(`:not(${rest.slice(0, j - 1)})`);
      rest = rest.slice(j);
    }
    assert.deepEqual(
      found,
      EXPECTED_NOT,
      `actions 规则的排除集与预期不符（多排或少排都会误伤）：\n实际 ${found.join('')}\n预期 ${EXPECTED_NOT.join('')}`,
    );
    void nots;
  }
});
