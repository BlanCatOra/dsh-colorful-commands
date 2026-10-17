/**
 * 聚合过程组标题的识别测试。
 *
 * ## 这条测试在锁什么
 *
 * 用户 2026-10-17 反馈：「这个调用工具与读写文件等合并在一起的颜色错误问题
 * 只解决了一半，没有全部解决」。
 *
 * 根因是**两层**叠加，本文件两层都锁：
 *
 * ### 第一层：标签表覆盖不足（更根本）
 *
 * 内核 `dsh-client-ui-chat` 的真实文案只有 14 条 `message.stepProcess.done.*`，
 * 而旧版 `ACTIVITY_LABELS` 里一半是**凭印象写的措辞**（「创建了文件」
 * 「写入了文件」「运行命令」「派遣子代理」…），真正的文案**只覆盖 6/14**。
 * 于是很多聚合标题里只认得出 1 个活动 → `found.size > 1` 不成立 → 不判聚合。
 *
 * ### 第二层：连接形式只认两种
 *
 * 内核拼接标题有**三条**分支（`chat-client.js` 4636-4645 行）：
 * - 恰好 2 个活动 → `joinTwo` = `{first}并{second}` / `{first} and {second}`
 * - 3+ 个        → `comma`   = `，` / `, `
 * - >3 个        → `more`    = `{title}等` / `{title}, etc.`
 *
 * 旧实现只看 `、` / `，`，漏掉 **「并」（最常见！2 个活动）** 与 **「等」**。
 *
 * ## 为什么反例比正例更重要
 *
 * 「并」「等」是极常见的单字，若只按连接词判定会把普通文本（模型写的命令描述、
 * 分析正文）误判成聚合 → 那些行会被染成中性灰。所以本文件用 **5 条反例**
 * 钉住「最终判据必须是 ≥2 个不同活动名」，而不是"含连接词即聚合"。
 *
 * @module dsh-colorful-commands/test/aggregate-titles
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isAggregateTitle, classifyAttrs, ACTIVITY_LABELS } from '../src/classify.js';

/** 内核 `message.stepProcess.done.*` 的真实文案（zh/en），来源见上方注释。 */
const KERNEL_DONE_ZH = [
  '已完成分析', '已读取文件', '已读取图片', '已写入文件', '已搜索代码',
  '修改了文件', '执行了命令', '运行了代码', '已搜索网页', '已访问网页',
  '已协调子智能体', '更新了计划', '向用户提出了问题', '已调用工具',
];

/** 每个内核活动文案都必须能被识别（否则聚合计数会少算）。 */
test('第一层：内核 14 条 done.* 文案必须全部可识别', () => {
  for (const label of KERNEL_DONE_ZH) {
    // 造一个"两个不同活动"的标题：这条 + 另一条已知文案，用 kernel 的 comma 连接。
    const other = label === '执行了命令' ? '已读取文件' : '执行了命令';
    const title = `${label}，${other}`;
    assert.equal(
      isAggregateTitle(title),
      true,
      `「${label}」未被识别为活动 → 聚合判据漏算。请核对 ACTIVITY_LABELS 是否与内核文案逐字一致。`,
    );
  }
});

test('第二层：joinTwo（恰好 2 个活动，中文「并」）必须判为聚合', () => {
  // 内核 joinTwo = "{first}并{second}"，这是**最常见**的形态，旧实现完全漏判。
  for (const title of [
    '已读取文件并执行了命令',
    '已调用工具并已读取文件',
    '已调用工具并执行了命令',
    '修改了文件并执行了命令',
    '已搜索代码并已读取文件',
  ]) {
    assert.equal(isAggregateTitle(title), true, `joinTwo 形态漏判：${title}`);
  }
});

test('第二层：joinTwo 英文形态（" and "）必须判为聚合', () => {
  for (const title of [
    'Read files and Ran commands',
    'Called tools and Read files',
    'Edited files and Ran commands',
  ]) {
    assert.equal(isAggregateTitle(title), true, `英文 joinTwo 漏判：${title}`);
  }
});

test('第二层：more（>3 个活动，后缀「等」）必须判为聚合', () => {
  // 内核 more = "{title}等"；等号出现在结尾。
  assert.equal(isAggregateTitle('已读取文件并执行了命令等'), true);
  assert.equal(isAggregateTitle('已读取文件，修改了文件，执行了命令等'), true);
  assert.equal(isAggregateTitle('Read files, Edited files, Ran commands, etc.'), true);
});

test('第二层：3+ 个活动（comma / 顿号）仍必须判为聚合（不回归）', () => {
  assert.equal(isAggregateTitle('已读取文件，修改了文件，执行了命令'), true);
  assert.equal(isAggregateTitle('已读取文件、修改了文件、执行了命令'), true);
  assert.equal(isAggregateTitle('Read files, Edited files, Ran commands'), true);
});

test('用户截图里的真实标题必须判为聚合（两层根因的合并回归）', () => {
  // 用户截图原文：注意是「已调用**了**工具」——内核文案是「已调用工具」，
  // 两者靠子串关系命中（『已调用了工具』包含『已调用工具』？**不包含**）。
  // ⚠️ 这正是第一层根因的典型：多一个字就漏。实测该标题同时含
  // 「已读取文件」「执行了命令」两个可识别活动，所以仍然判为聚合。
  assert.equal(isAggregateTitle('已调用了工具，已读取文件，执行了命令'), true);
});

// ─────────────────────────────────────────────────────────────
// 第三层根因：内核按 done.<key> 区分活动，同一语义桶下可有多个 key
// ─────────────────────────────────────────────────────────────

test('第三层：同一语义桶下的不同 key 必须算作两个活动', () => {
  // 内核按 `message.stepProcess.done.<key>` 的 key 区分活动；
  // 这些 key 两两不同，但映射到我们的同一个语义桶。
  // 旧实现用 Set 按「桶」去重 → 把它们算成一个活动 → 漏判聚合。
  for (const [title, why] of [
    ['运行了代码，执行了命令', 'code + commands 同属 command 桶'],
    ['已读取文件，已读取图片', 'read + readImage 同属 read 桶'],
    ['已写入文件，修改了文件', 'write + edit 同属 write 桶'],
    ['已搜索网页，已访问网页', 'webSearch + webFetch 同属 web 桶'],
    ['Ran code, Ran commands', '英文 code + commands'],
    ['Read files, Read images', '英文 read + readImage'],
  ]) {
    assert.equal(isAggregateTitle(title), true, `同桶不同 key 漏判（${why}）：${title}`);
  }
});

test('不变式：没有任何一条活动文案是另一条的子串', () => {
  // ⚠️ 这条不变式是 isAggregateTitle「数命中的标签个数」得以成立的前提 ——
  // 若 A 是 B 的子串，那么标题里只出现 B 时会把 A 也数上 → 一个活动被算成两个
  // → 单活动标题被误判为聚合（整行变中性灰）。
  // 改 ACTIVITY_LABELS 时若本用例变红，说明新加的文案与既有文案重叠，必须换措辞。
  const labels = Object.keys(ACTIVITY_LABELS);
  const overlaps = [];
  for (const a of labels) {
    for (const b of labels) {
      if (a !== b && b.includes(a)) overlaps.push([a, b]);
    }
  }
  assert.deepEqual(
    overlaps,
    [],
    `存在子串重叠，会让"数标签"判据多算活动：${overlaps.map(([a, b]) => `「${a}」⊂「${b}」`).join('、')}`,
  );
});

test('只看标签部分：详情里提到别的活动名不得判成聚合', () => {
  // `ProcessGroupHeader` 标题可能是 `label + TITLE_SEPARATOR + detail`，
  // 而 detail 是**模型的分析正文**，里面顺带提到别的活动名很常见。
  // 内核拼接出来的活动全在 label 部分，所以切掉 detail 后只剩 1 个活动 → 非聚合。
  assert.equal(
    isAggregateTitle('执行了命令 · 现在我将读取文件'),
    false,
    '单活动 + 详情提到"读取文件" → 不得判成聚合',
  );
  assert.equal(isAggregateTitle('已读取文件 · 接下来执行了命令'), false);
  // 反例的对照：标签部分本身是聚合时，仍必须判为聚合（切 detail 不能把真聚合切掉）。
  assert.equal(isAggregateTitle('已读取文件并执行了命令 · 分析结果如下'), true);
});

// ─────────────────────────────────────────────────────────────
// 反例：防止把「含连接词」当成「是聚合」（误伤普通文本）
// ─────────────────────────────────────────────────────────────

test('反例：单个活动名（无连接词）不得判为聚合', () => {
  assert.equal(isAggregateTitle('执行了命令'), false);
  assert.equal(isAggregateTitle('已读取文件'), false);
  assert.equal(isAggregateTitle('Ran commands'), false);
  assert.equal(isAggregateTitle('Read files'), false);
});

test('反例：单个活动名 + 后缀「等」仍不得判为聚合', () => {
  // 内核 more 是"{title}等"，而 title 本身可能是**单个**活动的标题
  // （例如 counts 里只有一个标签）。此时没有"混合语义"，不该走中性色。
  assert.equal(isAggregateTitle('已读取文件等'), false, '单活动 + 等 → 不是聚合');
  assert.equal(isAggregateTitle('Ran commands, etc.'), false, '英文单活动 + etc. → 不是聚合');
});

test('反例：普通描述里含「并」但只有一个活动名，不得判为聚合', () => {
  // 这是最关键的防误伤：模型写的命令描述、分析正文里「并」极其常见。
  for (const text of [
    '显示当前工作目录并列出文件',
    '正在分析请求并等待结果',
    '读取配置并合并默认值',
    '执行了命令并打印输出',   // 只命中"执行了命令"一个活动
  ]) {
    assert.equal(isAggregateTitle(text), false, `含「并」但非聚合，被误判：${text}`);
  }
});

test('反例：空串 / 非字符串 / 无连接词的长文本', () => {
  assert.equal(isAggregateTitle(''), false);
  assert.equal(isAggregateTitle(undefined), false);
  assert.equal(isAggregateTitle(null), false);
  assert.equal(isAggregateTitle(123), false);
  assert.equal(isAggregateTitle('已完成'), false);
});

// ─────────────────────────────────────────────────────────────
// 接线层：聚合标题必须落到中性 summary 类别
// ─────────────────────────────────────────────────────────────

test('classifyAttrs：聚合标题走中性 summary（不跟随单一活动变色）', () => {
  // 同一件事的三种排列，必须得到同一种颜色 —— 这是用户"太混乱了"的原话诉求。
  for (const [text, activity] of [
    ['已读取文件，修改了文件，执行了命令', 'read'],
    ['修改了文件，执行了命令，已读取文件', 'write'],
    ['执行了命令，修改了文件，已读取文件', 'commands'],
    // ⚠️ joinTwo 形态（本轮新增覆盖）：2 个活动合并也必须走 summary。
    ['已读取文件并执行了命令', 'read'],
    ['已调用工具并已读取文件', 'tools'],
  ]) {
    assert.equal(
      classifyAttrs({ 'data-process-activity': activity }, { text }),
      'summary',
      `聚合标题「${text}」必须走 summary，而不是跟随 ${activity} 变色`,
    );
  }
});

test('classifyAttrs：单一活动标题仍走各自语义色（不得被 summary 吞掉）', () => {
  for (const [text, activity, expected] of [
    ['已读取文件', 'read', 'read'],
    ['执行了命令', 'commands', 'commandLow'],
    ['修改了文件', 'edit', 'write'],
  ]) {
    const got = classifyAttrs({ 'data-process-activity': activity }, { text });
    assert.equal(got, expected, `单一活动「${text}」应走 ${expected}，实际 ${got}`);
  }
});
