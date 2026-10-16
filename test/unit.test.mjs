/**
 * 纯函数单测：分类、样式生成、色板。
 *
 * 这些模块不依赖 DOM 与宿主，因此可以直接 import。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  classifyAttrs,
  commandCategory,
  hasTitleDetail,
  permissionLevel,
  readAttrs,
  _tables,
} from '../src/classify.js';
import { buildStylesheet, resolveColors, sanitizeColor, scopedPreviewCss, CAT_ATTR, SCOPE_ATTR } from '../src/css.js';
import { presetColors, presetColorFor, presetCoverage } from '../src/palettes.js';
import { CHINESE_COLORS } from '../src/data/chinese-colors.js';
import { contrast, hueDistance, LIGHT_BG, DARK_BG } from '../src/color-engine.js';
import { commandRisk } from '../src/constants.js';
import {
  ALL_CATEGORIES,
  CATEGORIES,
  CONTROL_CATEGORIES,
  PERMISSION_CATEGORIES,
  CATEGORY_LABELS,
  PRESETS,
} from '../src/constants.js';
import { CATEGORY_KEYS, PRESET_KEYS } from '../src/locale.js';

// ── 分类 ─────────────────────────────────────────────────────────────

test('工具名按宿主自己的分组口径分类', () => {
  // 命令类不再是一个固定类别：按风险细分成三档，安全命令落低风险。
  assert.equal(classifyAttrs({ 'data-tool': 'bash' }, { text: 'ls -la' }), 'commandLow');
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
  assert.equal(classifyAttrs({ 'data-tool': 'bash', 'data-variant': 'bash' }, { text: 'ls' }), 'commandLow');
});

test('bash 工具行（data-sample，无 data-tool）也着色 —— 这是"运行命令"不上色的回归守卫', () => {
  // ⚠️ 内核实测：bash 工具行走 BashRow，根元素是
  //     <div data-sample="bash" data-variant="bash">，**没有 data-tool**。
  // 旧版把 data-sample 当作"内层重复卡片"直接跳过，导致整类静默不着色。
  assert.equal(classifyAttrs({ 'data-sample': 'bash', 'data-variant': 'bash' }), 'commandLow');
  // 带危险文本时同样按风险分级。
  assert.equal(
    classifyAttrs({ 'data-sample': 'bash', 'data-variant': 'bash' }, { text: '运行命令 · 校验语法' }),
    'commandLow',
  );
  assert.equal(
    classifyAttrs({ 'data-sample': 'bash', 'data-variant': 'bash' }, { text: 'rm -rf /' }),
    'commandHigh',
  );
});

test('命令按危险性分三档（用户要求"根据命令的危险性等分等级"）', () => {
  assert.equal(commandRisk('ls -la'), 'low');
  assert.equal(commandRisk('rm -rf /'), 'high');
  assert.equal(commandRisk('sudo systemctl restart nginx'), 'mid');
  // 高优先于中：两者都命中时取 high。
  assert.equal(commandCategory('sudo rm -rf /'), 'commandHigh');
  assert.equal(commandCategory('curl https://x'), 'commandMid');
  assert.equal(commandCategory(''), 'commandLow');
  // 空值/非字符串不得抛错。
  assert.equal(commandRisk(undefined), 'low');
  assert.equal(commandRisk(null), 'low');
  assert.equal(commandRisk(42), 'low');
  // 大小写不敏感。
  assert.equal(commandRisk('DROP TABLE users'), 'high');
  assert.equal(commandRisk('drop table users'), 'high');
});

test('命令风险只作用于命令类，read/write 不受影响', () => {
  assert.equal(classifyAttrs({ 'data-tool': 'read' }, { text: 'sudo rm -rf /' }), 'read');
  assert.equal(classifyAttrs({ 'data-tool': 'edit' }, { text: 'sudo rm -rf /' }), 'write');
});

test('过程组标题带分析正文时可按标签判定（避免正文被上色）', () => {
  // 内核把「标签 + ' · ' + 分析正文」放进同一个文本节点，CSS 无法只染标签，
  // 所以运行时据此把作用域降级为"只染图标"。
  assert.equal(hasTitleDetail('执行了命令'), false);
  assert.equal(hasTitleDetail('正在分析请求 · 我看看这个 DOM'), true);
  assert.equal(hasTitleDetail(''), false);
  assert.equal(hasTitleDetail(undefined), false);
});

test('过程组标题（执行了命令）也必须拿到颜色', () => {
  // 内核 processActivity 把 commands/tools 当作聚合活动；调色板里没有裸 `command`
  // 类别，所以必须在这里细分风险，否则整类静默不着色（真机实测 69 个元素无颜色）。
  assert.equal(classifyAttrs({ 'data-process-activity': 'commands' }, { text: '执行了命令' }), 'commandLow');
  assert.equal(classifyAttrs({ 'data-process-activity': 'tools' }, { text: '已调用工具' }), 'commandLow');
  assert.equal(
    classifyAttrs({ 'data-process-activity': 'commands' }, { text: '正在运行命令 · sudo systemctl restart x' }),
    'commandMid',
  );
  // 非命令类的活动不受影响。
  assert.equal(classifyAttrs({ 'data-process-activity': 'thinking' }, { text: '正在分析请求' }), 'thinking');
  assert.equal(classifyAttrs({ 'data-process-activity': 'read' }, { text: '已读取文件' }), 'read');
});

test('轨迹行的工具类着色，消息本体不着色', () => {
  assert.equal(classifyAttrs({ 'data-kind': 'tool' }, { text: 'ls' }), 'commandLow');
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
  // 未识别等级时权限选择落兜底色。
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.permission' }), 'ctl-permission');
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.plan' }), 'ctl-plan');
  // ⚠️ 用户明确要求「语音输入和模型名称不需要颜色」：
  // conversation.input.model 是模型名称，conversation.input.activity 是语音输入。
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.model' }), null);
  assert.equal(classifyAttrs({ 'data-slot': 'conversation.input.activity' }), null);
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

test('权限等级按当前预设文本区分（用户要求"不同权限等级的颜色应该不同"）', () => {
  // 文本取自内核 dsh-client-ui-permission-presets 的 label（实测）。
  assert.equal(permissionLevel('仅可查看'), 'perm-readonly');
  assert.equal(permissionLevel('工作区内修改'), 'perm-workspace');
  assert.equal(permissionLevel('完全权限'), 'perm-full');
  assert.equal(permissionLevel('Auto review EXP'), 'perm-auto');
  // 英文界面同样命中。
  assert.equal(permissionLevel('Read Only'), 'perm-readonly');
  assert.equal(permissionLevel('Workspace Write'), 'perm-workspace');
  assert.equal(permissionLevel('Full access'), 'perm-full');
  // 未知文本返回 null（落到兜底色，而不是猜）。
  assert.equal(permissionLevel(''), null);
  assert.equal(permissionLevel('some other mode'), null);

  // 四种等级必须真的分类到四个**不同**的类别。
  const levels = [
    classifyAttrs({ 'data-slot': 'conversation.input.permission' }, { text: '仅可查看' }),
    classifyAttrs({ 'data-slot': 'conversation.input.permission' }, { text: '工作区内修改' }),
    classifyAttrs({ 'data-slot': 'conversation.input.permission' }, { text: '完全权限' }),
    classifyAttrs({ 'data-slot': 'conversation.input.permission' }, { text: 'Auto review' }),
  ];
  assert.equal(new Set(levels).size, 4, '四个权限等级必须映射到四个不同的类别');
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
    // 命令三档与权限四档不来自任何表：它们是 command / ctl-permission 的
    // **细化**，因此用真实输入逐条证明可达（而不是把它们塞进表里假装覆盖）。
    classifyAttrs({ 'data-tool': 'bash' }, { text: 'ls' }),
    classifyAttrs({ 'data-tool': 'bash' }, { text: 'sudo x' }),
    classifyAttrs({ 'data-tool': 'bash' }, { text: 'rm -rf /' }),
    classifyAttrs({ 'data-slot': 'conversation.input.permission' }, { text: '仅可查看' }),
    classifyAttrs({ 'data-slot': 'conversation.input.permission' }, { text: '工作区内修改' }),
    classifyAttrs({ 'data-slot': 'conversation.input.permission' }, { text: '完全权限' }),
    classifyAttrs({ 'data-slot': 'conversation.input.permission' }, { text: 'Auto review' }),
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
  const css = buildStylesheet({ commandLow: { light: '#B8860B', dark: '#FFA60F' } });
  assert.ok(!css.includes('box-shadow'), '不得再画彩色竖线');
  assert.ok(!css.includes('border-left'), '也不得用左边框替代');
});

test('过程组标题（执行了命令/已完成分析）必须有独立作用域', () => {
  // 这是用户反馈"运行命令、执行命令、完成分析等条目颜色没有改变"的根因：
  // 它们是过程组标题，带 data-process-activity 而**不带 data-tool**。
  const css = buildStylesheet({ commandLow: { light: '#B8860B', dark: '#FFA60F' } });
  assert.ok(
    css.includes(`[${SCOPE_ATTR}="title"]`),
    '必须为过程组标题生成 scope=title 的规则',
  );
  // 标题文字靠 `_label` 类命中（内核 ProcessGroupHeader 的 className 是
  // ChatGroupSeat 的 `_label`，不是 `_title`）。
  assert.ok(
    /\[data-cc-scope="title"\] \[class\*="_label"\]\{color:/.test(css),
    '过程组标题的文字必须被染色（而不只是图标）',
  );
});

test('带分析正文的过程组标题只染图标（用户反馈"分析正文被错误地上色"）', () => {
  const css = buildStylesheet({ thinking: { light: '#8A4B9C', dark: '#B5A0C2' } });
  assert.ok(
    /\[data-cc-scope="icon"\] svg\{color:/.test(css),
    'scope=icon 必须给 svg 上色',
  );
  // ⚠️ 关键：icon 作用域**绝不能**染文字 —— 内核把「标签 + ' · ' + 分析正文」
  // 拼在同一个文本节点里，染文字必然连正文一起染。
  const iconRules = css.split('\n').filter((line) => line.includes('[data-cc-scope="icon"]'));
  assert.ok(iconRules.length > 0, '必须有 icon 作用域规则');
  for (const rule of iconRules) {
    assert.ok(
      rule.includes(' svg{'),
      `icon 作用域只能有 svg 规则，不得染文字：${rule}`,
    );
  }
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


// ── 预设与文案的一致性 ────────────────────────────────────────────────

test('每个预设 id 都有文案键，且每个文案键都对应真实预设（无死项）', () => {
  for (const id of PRESETS) {
    assert.ok(Object.hasOwn(PRESET_KEYS, id), `预设 ${id} 缺少文案键`);
  }
  for (const id of Object.keys(PRESET_KEYS)) {
    assert.ok(PRESETS.includes(id), `文案键 ${id} 对应的预设已不存在（死项）`);
  }
});

test('不再有与"不预设"重复的 custom 预设（界面上分不清两者）', () => {
  assert.ok(!PRESETS.includes('custom'), 'custom 与 none 行为相同，不该作为独立预设出现');
  assert.ok(!Object.hasOwn(PRESET_KEYS, 'custom'), 'custom 的文案键应一并删除');
});

test('每个类别 id 都有文案键（加类别忘配文案会让界面显示裸 key）', () => {
  for (const category of ALL_CATEGORIES) {
    assert.ok(Object.hasOwn(CATEGORY_KEYS, category), `类别 ${category} 缺少文案键`);
  }
});

test('三套预设都必须铺满"内容+控件"类别（不预设时这些才不上色）', () => {
  for (const presetId of PRESETS) {
    if (presetId === 'none') continue;
    const { missing } = presetCoverage(presetId);
    const shouldCover = [...CATEGORIES, ...CONTROL_CATEGORIES];
    const gaps = shouldCover.filter((c) => missing.includes(c));
    assert.equal(gaps.length, 0, `预设 ${presetId} 缺少类别：${gaps.join(',')}`);
  }
});

test('「不预设」只需保证命令与权限仍按等级上色（这是刻意的）', () => {
  const none = presetColors('none');
  // 命令三档固定叠加，与预设无关（用户指定的红色系分级）。
  for (const cat of ['commandLow', 'commandMid', 'commandHigh']) {
    assert.ok(none[cat], `「不预设」下 ${cat} 仍必须上色（命令分级是固定的）`);
  }
  // 权限四档同理。
  for (const cat of PERMISSION_CATEGORIES) {
    assert.ok(none[cat], `「不预设」下 ${cat} 仍必须上色（权限分级是固定的）`);
  }
  // 内容类别不铺预设 —— 用户选"仅自定义"时要的正是这个。
  for (const cat of ['thinking', 'read', 'write', 'search', 'web', 'other']) {
    assert.ok(!none[cat], `「不预设」下 ${cat} 不该有预设色`);
  }
});
