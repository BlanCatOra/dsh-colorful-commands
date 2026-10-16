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
import { buildStylesheet, resolveColors, sanitizeColor, scopedPreviewCss, CAT_ATTR, SCOPE_ATTR } from '../src/css.js';
import { presetColors, presetColorFor, presetCoverage } from '../src/palettes.js';
import { CHINESE_COLORS } from '../src/data/chinese-colors.js';
import { contrast, hueDistance, LIGHT_BG, DARK_BG } from '../src/color-engine.js';
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

test('轨迹行的工具类着色，消息本体不着色', () => {
  assert.equal(classifyAttrs({ 'data-kind': 'tool' }), 'command');
  assert.equal(classifyAttrs({ 'data-kind': 'subtool' }), 'other');
  // 消息本体（用户/助手）刻意不着色：它们不是过程行，而且 flowItem 是整列宽，
  // 给它加竖条会跑到窗口最左缘、与靠右的气泡脱节（实测）。
  assert.equal(classifyAttrs({ 'data-kind': 'user' }), null);
  assert.equal(classifyAttrs({ 'data-kind': 'message' }), null);
  assert.equal(classifyAttrs({ 'data-chat-flow-kind': 'user' }), null);
  assert.equal(classifyAttrs({ 'data-chat-flow-kind': 'steering' }), null);
  assert.equal(classifyAttrs({ 'data-chat-flow-kind': 'turn-process' }), null);
});

test('插槽锚点分类（界面控件）', () => {
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.permission' }), 'ctl-permission');
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.model' }), 'ctl-model');
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.plan' }), 'ctl-plan');
  // 工具行槽（left/right/dock/overlay）刻意不着色：里面是加号按钮、斜杠命令
  // 触发器等原生控件，染色会波及弹出的菜单（实测菜单项被涂灰）。
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.left' }), null);
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.overlay' }), null);
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.right' }), null);
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

test('生成的样式不得再出现任何竖条（用户 2026-10-16 明确要求去掉）', () => {
  const css = buildStylesheet({ command: { light: '#B8860B', dark: '#FFA60F' } });
  assert.ok(!css.includes('box-shadow'), '不得再画彩色竖线');
  assert.ok(!css.includes('border-left'), '也不得用左边框替代');
});

test('过程组标题（执行了命令/已完成分析）必须有独立作用域', () => {
  // 这是用户反馈"运行命令、执行命令、完成分析等条目颜色没有改变"的根因：
  // 它们是过程组标题，带 data-process-activity 而**不带 data-tool**。
  const css = buildStylesheet({ command: { light: '#B8860B', dark: '#FFA60F' } });
  assert.ok(
    css.includes(`[${SCOPE_ATTR}="title"]`),
    '必须为过程组标题生成 scope=title 的规则',
  );
  assert.ok(
    /\[data-cc-scope="title"\]\{color:/.test(css),
    '过程组标题的文字必须被染色（而不只是图标）',
  );
});

test('UI 控件必须连文字一起染色（用户要求：权限选择那个控件文字也改）', () => {
  const css = buildStylesheet({ 'ctl-permission': { light: '#C70039', dark: '#FF6F61' } });
  assert.ok(
    /\[data-cc-scope="tint"\] :is\(button,\[role="button"\],a\)\{color:/.test(css),
    '控件内的按钮文字必须被染色',
  );
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
    const { covered, missing } = presetCoverage(id);
    assert.deepEqual(missing, [], `预设 ${id} 缺少类别：${missing.join(', ')}`);
    assert.equal(covered.length, ALL_CATEGORIES.length);
  }
});

test('每套预设的两套主题都必须达到对比度下限（这是选色引擎的核心承诺）', () => {
  for (const id of ['chinese', 'japanese', 'macaron']) {
    const palette = presetColors(id);
    for (const [category, pair] of Object.entries(palette)) {
      const cl = contrast(pair.light, LIGHT_BG);
      const cd = contrast(pair.dark, DARK_BG);
      assert.ok(cl >= 3.0, `${id}/${category} 浅色值 ${pair.light} 白底对比度仅 ${cl.toFixed(2)}`);
      assert.ok(cd >= 3.0, `${id}/${category} 深色值 ${pair.dark} 深底对比度仅 ${cd.toFixed(2)}`);
      // 上限：超过说明接近黑/白，色相辨识度丢失。
      assert.ok(cl <= 10.5, `${id}/${category} 浅色值 ${pair.light} 对比度过高（近黑）`);
      assert.ok(cd <= 10.5, `${id}/${category} 深色值 ${pair.dark} 对比度过高（近白）`);
    }
  }
});

test('预设里每个色值都是合法十六进制', () => {
  for (const id of ['chinese', 'japanese', 'macaron']) {
    for (const [category, pair] of Object.entries(presetColors(id))) {
      assert.ok(/^#[0-9A-F]{6}$/.test(pair.light), `${id}/${category}.light 非法：${pair.light}`);
      assert.ok(/^#[0-9A-F]{6}$/.test(pair.dark), `${id}/${category}.dark 非法：${pair.dark}`);
    }
  }
});

test('不同语义不得撞成同一个颜色（去重生效）', () => {
  // 实测不加去重时 read 与 web 会挑到同一个 #4F84FF，两类看起来一样。
  const palette = presetColors('chinese');
  const byHueGroups = [
    ['command', 'danger'], ['read', 'write'], ['search', 'web'],
  ];
  for (const [a, b] of byHueGroups) {
    if (!palette[a] || !palette[b]) continue;
    assert.notEqual(palette[a].light, palette[b].light, `${a} 与 ${b} 的浅色值不得相同`);
    assert.notEqual(palette[a].dark, palette[b].dark, `${a} 与 ${b} 的深色值不得相同`);
  }
});

test('中国传统色库：742 色、字段完整、hex 合法', () => {
  assert.ok(CHINESE_COLORS.length >= 700, `色库应有 700+ 色，实际 ${CHINESE_COLORS.length}`);
  for (const c of CHINESE_COLORS) {
    assert.ok(/^#[0-9A-F]{6}$/.test(c.x), `色值非法：${c.x}`);
    assert.ok(typeof c.n === 'string' && c.n !== '', '色名不能为空');
    assert.ok(c.h >= 0 && c.h <= 360, `色相越界：${c.h}`);
    assert.ok(c.s >= 0 && c.s <= 100, `饱和度越界：${c.s}`);
    assert.ok(c.l >= 0 && c.l <= 100, `亮度越界：${c.l}`);
  }
});

test('色相距离取最短角距（360 与 0 相邻）', () => {
  assert.equal(hueDistance(0, 359), 1);
  assert.equal(hueDistance(10, 350), 20);
  assert.equal(hueDistance(0, 180), 180);
  assert.equal(hueDistance(90, 90), 0);
});

test('对比度函数符合 WCAG（黑白为 21:1）', () => {
  assert.equal(Math.round(contrast('#000000', '#FFFFFF')), 21);
  assert.equal(contrast('#123456', '#123456').toFixed(1), '1.0');
});

test('预设色板是浅拷贝，调用方改它不污染缓存', () => {
  const copy = presetColors('chinese');
  const original = copy.thinking.light;
  copy.thinking = { light: '#000000', dark: '#FFFFFF' };
  assert.equal(presetColors('chinese').thinking.light, original);
});

test('presetColorFor 未知预设返回 undefined', () => {
  assert.equal(presetColorFor('nope', 'thinking'), undefined);
  assert.ok(presetColorFor('chinese', 'thinking'));
});
