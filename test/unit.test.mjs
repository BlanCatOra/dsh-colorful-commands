/**
 * 纯函数单测：分类、样式生成、色板。
 *
 * 这些模块不依赖 DOM 与宿主，因此可以直接 import。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  classifyAttrs,
  isDangerousCommand,
  readAttrs,
  _tables,
} from '../src/classify.js';
import { buildStylesheet, resolveColors, sanitizeColor, scopedPreviewCss, withAlpha, CAT_ATTR, SCOPE_ATTR } from '../src/css.js';
import { presetColors, presetColorFor, presetCoverage, BUILTIN_PRESETS } from '../src/palettes.js';
import { ALL_CATEGORIES, CATEGORIES, CONTROL_CATEGORIES, CATEGORY_LABELS } from '../src/constants.js';

// ── 分类 ─────────────────────────────────────────────────────────────

test('工具名按宿主自己的分组口径分类', () => {
  assert.equal(classifyAttrs({ 'data-tool': 'bash' }), 'command');
  assert.equal(classifyAttrs({ 'data-tool': 'read' }), 'read');
  assert.equal(classifyAttrs({ 'data-tool': 'edit' }), 'write');
  assert.equal(classifyAttrs({ 'data-tool': 'grep' }), 'search');
  // 刻意偏离宿主口径：两者都是网络请求，单列 web 类。
  assert.equal(classifyAttrs({ 'data-tool': 'web_search' }), 'web');
  assert.equal(classifyAttrs({ 'data-tool': 'web_fetch' }), 'web');
  // 本地搜索仍归 search，与网络请求分开。
  assert.equal(classifyAttrs({ 'data-tool': 'glob' }), 'search');
  // 未知工具落 other，不是 null —— 它仍应被着色（归入"其他工具"）。
  assert.equal(classifyAttrs({ 'data-tool': 'some_new_tool' }), 'other');
});

test('推理行的 data-variant=think 归入思考类', () => {
  assert.equal(classifyAttrs({ 'data-variant': 'think' }), 'thinking');
  // 工具行也有 data-variant，但 data-tool 优先。
  assert.equal(classifyAttrs({ 'data-tool': 'bash', 'data-variant': 'bash' }), 'command');
});

test('危险命令识别：命中词表即归入 danger', () => {
  assert.equal(classifyAttrs({ 'data-tool': 'bash' }, { text: 'rm -rf /tmp/x' }), 'danger');
  assert.equal(classifyAttrs({ 'data-tool': 'bash' }, { text: 'sudo systemctl restart x' }), 'danger');
  assert.equal(classifyAttrs({ 'data-tool': 'bash' }, { text: 'ls -la' }), 'command');
  // 只对 command 类细分危险等级，read/write 不受影响。
  assert.equal(classifyAttrs({ 'data-tool': 'read' }, { text: 'sudo' }), 'read');
});

test('isDangerousCommand 对空值与非字符串安全', () => {
  assert.equal(isDangerousCommand(''), false);
  assert.equal(isDangerousCommand(undefined), false);
  assert.equal(isDangerousCommand(null), false);
  assert.equal(isDangerousCommand(123), false);
  assert.equal(isDangerousCommand('rm -rf /'), true);
  // 大小写不敏感。
  assert.equal(isDangerousCommand('DROP TABLE users'), true);
  assert.equal(isDangerousCommand('drop table users'), true);
});

test('轨迹行与消息流顶层分类', () => {
  assert.equal(classifyAttrs({ 'data-kind': 'user' }), 'user');
  assert.equal(classifyAttrs({ 'data-kind': 'message' }), 'assistant');
  assert.equal(classifyAttrs({ 'data-kind': 'tool' }), 'command');
  assert.equal(classifyAttrs({ 'data-chat-flow-kind': 'user' }), 'user');
  assert.equal(classifyAttrs({ 'data-chat-flow-kind': 'steering' }), 'user');
  // turn-process 不是可着色类别。
  assert.equal(classifyAttrs({ 'data-chat-flow-kind': 'turn-process' }), null);
});

test('插槽锚点分类（界面控件）', () => {
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.permission' }), 'ctl-permission');
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.model' }), 'ctl-model');
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.left' }), 'ctl-toolbar');
  // 未知插槽不猜。
  assert.equal(classifyAttrs({ 'data-slot': 'some.other.slot' }), null);
});

test('插槽锚点优先于工具属性（避免同元素双重归类）', () => {
  assert.equal(
    classifyAttrs({ 'data-slot': 'conversation.input.permission', 'data-tool': 'bash' }),
    'ctl-permission',
  );
});

test('内层 bash 卡片（data-sample）不再重复打标', () => {
  // 实测：bash 工具行内部还有 data-sample="bash" + data-variant="bash" 的卡片根。
  // 若它也打标，同一条命令会出现两条竖条、两层着色。
  assert.equal(classifyAttrs({ 'data-sample': 'bash', 'data-variant': 'bash' }), null);
});

test('无可识别属性时返回 null', () => {
  assert.equal(classifyAttrs({}), null);
  assert.equal(classifyAttrs(null), null);
  assert.equal(classifyAttrs(undefined), null);
});

test('readAttrs 只读白名单属性，且对缺 getAttribute 的元素安全', () => {
  const el = { getAttribute: (name) => (name === 'data-tool' ? 'bash' : null) };
  assert.deepEqual(readAttrs(el), { 'data-tool': 'bash' });
  assert.deepEqual(readAttrs(null), {});
  assert.deepEqual(readAttrs({}), {});
});

test('分类表覆盖全部可配置类别（防止加了类别却忘了映射）', () => {
  const mapped = new Set([
    ...Object.values(_tables.TOOL_CATEGORY),
    ...Object.values(_tables.VARIANT_CATEGORY),
    ...Object.values(_tables.KIND_CATEGORY),
    ...Object.values(_tables.FLOW_CATEGORY),
    ...Object.values(_tables.SLOT_CATEGORY),
    // `danger` 不来自任何表：它是 command 类在命中危险词表时的**细化**，
    // 因此用一条真实输入来证明它可达（而不是把它塞进表里假装覆盖）。
    classifyAttrs({ 'data-tool': 'bash' }, { text: 'rm -rf /' }),
  ]);
  for (const category of ALL_CATEGORIES) {
    assert.ok(mapped.has(category), `类别 ${category} 没有任何映射能产生它`);
  }
});

// ── 颜色安全 ─────────────────────────────────────────────────────────

test('sanitizeColor 只放行合法十六进制，其余一律拒绝', () => {
  assert.equal(sanitizeColor('#fff'), '#FFFFFF');
  assert.equal(sanitizeColor('#9d2933'), '#9D2933');
  assert.equal(sanitizeColor('  #ABC  '), '#AABBCC');
  // 注入尝试必须被拒。
  assert.equal(sanitizeColor('red; } body { display:none'), null);
  assert.equal(sanitizeColor('rgb(1,2,3)'), null);
  assert.equal(sanitizeColor(''), null);
  assert.equal(sanitizeColor(undefined), null);
  assert.equal(sanitizeColor(null), null);
  assert.equal(sanitizeColor(123), null);
  assert.equal(sanitizeColor('#12345'), null);
});

test('withAlpha 产出 rgba，非法色值退化为 transparent', () => {
  assert.equal(withAlpha('#FF0000', 0.5), 'rgba(255, 0, 0, 0.5)');
  assert.equal(withAlpha('bogus', 0.5), 'transparent');
  // alpha 被夹到 0..1。
  assert.equal(withAlpha('#000000', 5), 'rgba(0, 0, 0, 1)');
  assert.equal(withAlpha('#000000', -1), 'rgba(0, 0, 0, 0)');
});

// ── 样式生成 ─────────────────────────────────────────────────────────

test('生成的样式只针对本插件自己的属性，不出现 DSH 内部类名', () => {
  const css = buildStylesheet({ thinking: { light: '#123456', dark: '#654321' } });
  assert.ok(css.includes(`[${CAT_ATTR}="thinking"]`), '必须用自有属性选择器');
  assert.ok(css.includes(`[${SCOPE_ATTR}="header"]`), '必须限定作用域');
  // DSH 的类名带每次构建的哈希，绝不能出现在生成的 CSS 里。
  assert.ok(!/[A-Za-z0-9]{6}_(root|row|title|header)\b/.test(css), '不得依赖 DSH 哈希类名');
});

test('深浅两套主题各生成一条分支', () => {
  const css = buildStylesheet({ thinking: { light: '#123456', dark: '#654321' } });
  assert.ok(css.includes('#123456'), '浅色值要在');
  assert.ok(css.includes('#654321'), '深色值要在');
  assert.ok(css.includes('body[data-ds-dark-theme]'), '深色分支必须挂在这个属性上');
});

test('单边缺失时用另一边补齐（不让某个主题失明）', () => {
  const { colors } = resolveColors({ colors: { thinking: { light: '#112233' } } });
  assert.equal(colors.thinking.light, '#112233');
  assert.equal(colors.thinking.dark, '#112233');
});

test('非法色值被丢弃，不产出坏 CSS', () => {
  const { colors } = resolveColors({
    colors: {
      thinking: { light: 'red; } body { display:none', dark: 'not-a-color' },
      read: { light: '#112233', dark: '#445566' },
    },
  });
  assert.equal(colors.thinking, undefined, '非法项必须整条丢弃');
  assert.ok(colors.read, '合法项要保留');
  const css = buildStylesheet(colors);
  assert.ok(!css.includes('display:none'), '注入串绝不能进样式表');
});

test('关闭开关时产出空样式表', () => {
  assert.equal(buildStylesheet({ thinking: { light: '#123456', dark: '#123456' } }, { enabled: false }), '');
  const { enabled, colors } = resolveColors({ enabled: false, colors: { thinking: { light: '#123456' } } });
  assert.equal(enabled, false);
  assert.deepEqual(colors, {});
});

test('预设作为底、自定义项覆盖（而不是替换）', () => {
  const preset = { thinking: { light: '#AAAAAA', dark: '#BBBBBB' }, read: { light: '#CCCCCC', dark: '#DDDDDD' } };
  const { colors } = resolveColors({ colors: { thinking: { light: '#111111', dark: '#222222' } } }, { presetColors: preset });
  assert.equal(colors.thinking.light, '#111111', '自定义覆盖预设');
  assert.equal(colors.read.light, '#CCCCCC', '预设的其他项保留');
});

// ── 色板 ─────────────────────────────────────────────────────────────

test('三套内置预设都存在，且覆盖全部类别', () => {
  for (const id of ['chinese', 'japanese', 'macaron']) {
    assert.ok(BUILTIN_PRESETS[id], `预设 ${id} 必须存在`);
    const { missing } = presetCoverage(id);
    assert.deepEqual(missing, [], `预设 ${id} 缺少类别：${missing.join(', ')}`);
  }
});

test('预设里每个色值都是合法十六进制（防止手抖写错）', () => {
  for (const [id, palette] of Object.entries(BUILTIN_PRESETS)) {
    for (const [category, pair] of Object.entries(palette)) {
      for (const mode of ['light', 'dark']) {
        assert.equal(
          sanitizeColor(pair[mode]),
          pair[mode].toUpperCase(),
          `预设 ${id} 的 ${category}.${mode} 不是合法色值：${pair[mode]}`,
        );
      }
    }
  }
});

test('预设色板是浅拷贝，调用方改它不污染内置数据', () => {
  const copy = presetColors('chinese');
  copy.thinking = { light: '#000000', dark: '#FFFFFF' };
  assert.notEqual(BUILTIN_PRESETS.chinese.thinking.light, '#000000');
});

test('presetColorFor 返回副本，未知预设返回 undefined', () => {
  const pair = presetColorFor('chinese', 'thinking');
  assert.ok(pair);
  pair.light = '#000000';
  assert.notEqual(BUILTIN_PRESETS.chinese.thinking.light, '#000000');
  assert.equal(presetColorFor('nope', 'thinking'), undefined);
});

// ── 常量一致性 ───────────────────────────────────────────────────────

test('类别常量自洽：消息类与控件类不重叠，且都有中文名', () => {
  const overlap = CATEGORIES.filter((c) => CONTROL_CATEGORIES.includes(c));
  assert.deepEqual(overlap, [], '消息类与控件类不得重叠');
  assert.equal(ALL_CATEGORIES.length, CATEGORIES.length + CONTROL_CATEGORIES.length);
  for (const category of ALL_CATEGORIES) {
    assert.ok(CATEGORY_LABELS[category], `类别 ${category} 缺中文名`);
  }
});

// ── 预览作用域（曾被静默失效 bug 咬过） ──────────────────────────────

test('预览作用域：深色分支的 body 前缀必须留在最外层', () => {
  // 直接调**真实实现**（不再在测试里复刻一份规则 —— 复刻的那版自己就有 bug，
  // 属于"测试替实现补契约"的同款形状）。
  const css = buildStylesheet({ thinking: { light: '#111111', dark: '#222222' } });
  const DARK = 'body[data-ds-dark-theme]';
  assert.ok(css.includes(DARK), '生产 CSS 必须含深色分支，否则下面的断言是空转');

  const scoped = scopedPreviewCss(css);

  // 回归点：写成 `.cc-preview body[...]` 会永远匹配不到 → 深色下预览恒为浅色。
  assert.ok(!scoped.includes('.cc-preview body['), '深色分支不得写成 .cc-preview body[...]');
  assert.ok(scoped.includes(`${DARK} .cc-preview`), '深色分支必须把容器插在主题条件之后');
  // 浅色分支正常加前缀。
  assert.ok(scoped.includes('.cc-preview [data-cc-cat="thinking"]'), '浅色分支要加容器前缀');
  // 两个色值都要在，证明两条分支都被保留。
  assert.ok(scoped.includes('#111111') && scoped.includes('#222222'));
});

test('预览作用域对空输入与注释行安全', () => {
  assert.equal(scopedPreviewCss(''), '');
  assert.equal(scopedPreviewCss('/* only a comment */'), '');
  assert.equal(scopedPreviewCss(undefined), '');
});
