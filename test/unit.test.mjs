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
import {
  contrast,
  hueDistance,
  deltaE,
  hsvSaturation,
  MIN_TIER_DELTA_E,
  TEXT_MIN_CONTRAST,
  LIGHT_BG,
  DARK_BG,
} from '../src/color-engine.js';
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
    // `retry` / `compaction` 只由 CSS Module 类名后缀识别（内核没给语义化属性）。
    classifyAttrs({ class: 'Sixlwa_retryRow' }),
    classifyAttrs({ class: 'Sixlwa_compactionRow' }),
    // `summary`（**聚合**过程组标题）：同一组里含多种活动。用户 2026-10-17
    // 反馈"太混乱了" —— 同件事因活动排列顺序不同而被染成蓝/绿/玫红。
    classifyAttrs({ 'data-process-activity': 'read' },
      { text: '已读取文件，修改了文件，执行了命令' }),
    // `done` / `meta`：消息尾部（turn-tail）与 composer 底部条，
    // 真机钩子 `data-turn-tail` / `data-composer-dock`（2026-10-17 实测）。
    classifyAttrs({ 'data-turn-tail': '22' }),
    // 「已完成 · 用时 xxx」：**可见**宿主是 `<button data-turn-process>`
    // （内核源码 `TurnProcessNodeView` 确认）。
    // ⚠️ 2026-10-17 缺陷 ① 修完后，这里已从「class 含 visuallyHidden +
    //    role=status」（视觉隐藏副本，给它上色用户看不见）改成语义化属性。
    classifyAttrs({ 'data-turn-process': '22', class: 'Lu6X2a_root' }),
    classifyAttrs({ 'data-composer-dock': 'true' }),
    // 上下文进度圈四档：百分比**只写在 aria-label 里**（真机
    // `aria-label="上下文已用 29%"`）。四个区间各取一个真实值。
    // ⚠️ 2026-10-17 缺陷 ② 修完后，进度圈走**自身** aria-label 分支
    //    （不再依赖 dock 容器），所以这里直接给它自身的 aria-label。
    classifyAttrs({}, { usageText: '上下文已用 20%' }),
    classifyAttrs({}, { usageText: '上下文已用 40%' }),
    classifyAttrs({}, { usageText: '上下文已用 60%' }),
    classifyAttrs({}, { usageText: '上下文已用 70%' }),
  ]);
  for (const category of ALL_CATEGORIES) {
    assert.ok(mapped.has(category), `类别 ${category} 没有任何映射能产生它`);
  }
  // ⚠️ 反向守卫（缺陷 ①）：视觉隐藏副本**不得**再产生 done。
  // 旧实现正是靠它"命中"的，而那是屏幕阅读器专用的 1px 元素 ——
  // 用户反馈"已完成 · 用时 xxx 颜色未生效"的根因。
  assert.equal(
    classifyAttrs({ class: 'TrFNTq_visuallyHidden', role: 'status' }),
    null,
    'visuallyHidden 副本不得再被判为 done（它是看不见的）',
  );
  // ⚠️ 反向守卫（缺陷 ②）：tokens 药丸虽然含 %，但用户要求不上色。
  assert.equal(
    classifyAttrs({ class: 'bGnI3G_pill', 'aria-label': '695M tok · 缓存命中 98%' },
      { usageText: '695M tok · 缓存命中 98%' }),
    null,
    'tokens 药丸不得进 usage 分档',
  );
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
  // 无详情的标题：整段标签可染。
  assert.ok(
    /\[data-cc-scope="title"\] \[class\*="_label"\]\{color:/.test(css),
    '无详情的过程组标题文字必须被染色',
  );
  // 有详情的标题：只染切出来的标签段（见 dom.js 的 splitTitleLabel）。
  assert.ok(
    /\[data-cc-scope="title-part"\] \[data-cc-part="label"\]\{color:/.test(css),
    '有详情时只染标签段',
  );
});

test('有详情的标题绝不整段染（否则正文会被上色 / 闪烁）', () => {
  // ⚠️ 用户先后反馈"分析正文被错误地上色（闪烁）"与"上色不完全"，根因同一个：
  // 内核把「标签 + ' · ' + 详情」拼成**同一个文本节点**。
  // 只染整段 → 正文被染；整段不染 → 标签也没色。
  const css = buildStylesheet({ thinking: { light: '#8A4B9C', dark: '#B5A0C2' } });
  const partScopeRules = css.split('\n').filter((l) => l.includes('[data-cc-scope="title-part"]'));
  assert.ok(partScopeRules.length > 0, '必须有 title-part 作用域规则');
  for (const rule of partScopeRules) {
    assert.ok(
      !/ \[class\*="_label"\]\{/.test(rule),
      `title-part 绝不能整段染 _label（正文会被上色）：${rule}`,
    );
  }
  // 不允许用 `:not(:has(...))` 兜底 —— 那一帧会把正文整段染色（闪烁根因）。
  assert.ok(
    !/:not\(:has\(\[data-cc-part\]\)\)/.test(css),
    '不得用 :has() 兜底整段染色（切分短暂失效时会闪一下正文色）',
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


// ── 命令三档必须真的"分得出轻重" ─────────────────────────────────────
//
// ⚠️ 这一组是用户"你说你做了 实际没有差异"的回归守卫。第一版给三档各设一个
// 目标亮度、再让 pickColor 挑最近的，结果三档撞到几乎同一个色（深色主题实测
// #C45A65 / #C74A4D / #D46A6A），而且**中档比低档更暗**，与"越危险越醒目"相反。

test('命令三档的**饱和度**必须严格递增（越危险越浓）', () => {
  // ⚠️ 分级轴是饱和度，不是对比度 —— 这一点前后错过两次。
  // 深色主题下"高对比度"必然来自**亮**色，而传统红里偏亮的都是粉调（低饱和），
  // 于是按对比度分级会得到 橙红(s85) → 粉(s69) → 浅粉(s68)：对比度递增，
  // 但"最危险"看起来最淡，语义正好反了。
  for (const presetId of ['chinese', 'japanese', 'macaron']) {
    const pal = presetColors(presetId);
    for (const mode of ['light', 'dark']) {
      const sat = ['commandLow', 'commandMid', 'commandHigh']
        .map((c) => hsvSaturation(pal[c][mode]));
      assert.ok(
        sat[0] < sat[1] && sat[1] < sat[2],
        `${presetId}/${mode} 三档饱和度必须递增，实际 ${sat.join(' → ')}`,
      );
    }
  }
});

test('命令三档每一档都必须达到正文对比度门槛（标签是文本，不是图标）', () => {
  for (const presetId of ['chinese', 'japanese', 'macaron']) {
    const pal = presetColors(presetId);
    for (const [bg, mode] of [[LIGHT_BG, 'light'], [DARK_BG, 'dark']]) {
      for (const cat of ['commandLow', 'commandMid', 'commandHigh']) {
        const cr = contrast(pal[cat][mode], bg);
        assert.ok(
          cr >= TEXT_MIN_CONTRAST,
          `${presetId}/${mode}/${cat} 对比度 ${cr.toFixed(2)} 低于文本门槛 ${TEXT_MIN_CONTRAST}`,
        );
      }
    }
  }
});

test('命令三档相邻色差必须一眼可辨（ΔE 达门槛）', () => {
  for (const presetId of ['chinese', 'japanese', 'macaron']) {
    const pal = presetColors(presetId);
    for (const mode of ['light', 'dark']) {
      const low = pal.commandLow[mode];
      const mid = pal.commandMid[mode];
      const high = pal.commandHigh[mode];
      assert.ok(
        deltaE(low, mid) >= MIN_TIER_DELTA_E,
        `${presetId}/${mode} 低-中 色差不足：ΔE=${deltaE(low, mid).toFixed(1)}`,
      );
      assert.ok(
        deltaE(mid, high) >= MIN_TIER_DELTA_E,
        `${presetId}/${mode} 中-高 色差不足：ΔE=${deltaE(mid, high).toFixed(1)}`,
      );
    }
  }
});

test('三档颜色两两不同（不能出现同一个 hex）', () => {
  for (const presetId of ['chinese', 'japanese', 'macaron']) {
    const pal = presetColors(presetId);
    for (const mode of ['light', 'dark']) {
      const set = new Set(['commandLow', 'commandMid', 'commandHigh'].map((c) => pal[c][mode]));
      assert.equal(set.size, 3, `${presetId}/${mode} 三档出现了重复色值`);
    }
  }
});

test('deltaE 与对比度的基本性质', () => {
  assert.equal(deltaE('#000000', '#000000'), 0);
  assert.ok(deltaE('#000000', '#FFFFFF') > 90, '黑白 ΔE 应该很大');
  assert.ok(deltaE('#FF0000', '#FF0001') < 1, '几乎相同的色 ΔE 应接近 0');
});


test('每个预设都必须为全部内容类别产出颜色（不得静默丢弃类别）', () => {
  // ⚠️ 血亏教训：`buildPalette` 原本在"挑不到色"时直接 `continue`，把整个类别丢掉。
  // `compaction` 与 `read` 色相只差 17 度（195 vs 212），macaron 预设下唯一合适的
  // 青蓝被 `read` 先占走，`compaction` 就**静默消失** —— 表现是"设置里明明选了
  // 颜色、界面就是不上色"。这种"配置了却没效果"的缺陷最难定位。
  // 现在挑不到会逐级放宽重挑，本测试锁死"任何预设都不得缺类别"。
  const required = ['thinking', 'commandLow', 'commandMid', 'commandHigh',
    'read', 'write', 'search', 'web', 'retry', 'compaction', 'other'];
  for (const presetId of ['chinese', 'japanese', 'macaron']) {
    const pal = presetColors(presetId);
    const missing = required.filter((k) => pal[k] === undefined);
    assert.deepEqual(missing, [], `${presetId} 缺少类别：${missing.join(', ')}`);
    for (const key of required) {
      assert.ok(pal[key].light && pal[key].dark, `${presetId}/${key} 缺主题色值`);
    }
  }
});

test('同预设内不同内容类别不得挑到完全相同的色（去重仍然生效）', () => {
  // 放宽去重是为了"别丢掉类别"，但**不能退化成所有类别一个颜色**。
  for (const presetId of ['chinese', 'japanese', 'macaron']) {
    const pal = presetColors(presetId);
    for (const mode of ['light', 'dark']) {
      const keys = ['thinking', 'read', 'write', 'search', 'web', 'retry', 'compaction'];
      const seen = new Map();
      for (const k of keys) {
        const hex = pal[k][mode];
        if (seen.has(hex)) {
          // 允许同色相的语义复用（thinking/ctl-plan 这类），但这里选的几个类别色相都不同。
          assert.fail(`${presetId}/${mode}: ${seen.get(hex)} 与 ${k} 撞成同一个色 ${hex}`);
        }
        seen.set(hex, k);
      }
    }
  }
});


test('重试/压缩行必须有 plain 作用域，且规则能命中普通 span（不是 button/a）', () => {
  // ⚠️ 血亏教训：用户截图显示"模型重试的上色没成功" —— 行**打了标**但没颜色。
  // 根因：内核把重试状态文字渲染成普通 `<span class="…_retryText" role="status">`，
  // 而它落到默认的 `tint` 作用域，`tint` 只匹配 `:is(button,[role="button"],a)`
  // —— **一条都命不中**，于是完全不上色。（`role="status"` 不是 `role="button"`。）
  const css = buildStylesheet({ retry: { light: '#A65F2E', dark: '#D2B48C' } });
  assert.ok(
    /\[data-cc-scope="plain"\] :is\(\[class\*="_retryText"\]/.test(css),
    'plain 作用域必须能命中 _retryText 这个普通 span',
  );
  assert.ok(
    /\[data-cc-scope="plain"\] svg\{color:/.test(css),
    'plain 作用域必须给图标上色',
  );
  // 详情（重试延迟 / 失败原因）必须保持原生，不能被染色。
  const plainRules = css.split('\n').filter((l) => l.includes('[data-cc-scope="plain"]'));
  for (const rule of plainRules) {
    assert.ok(
      !/retryDetails|_retryDetailLabel/.test(rule),
      `plain 作用域不得染重试详情：${rule}`,
    );
  }
});


test('每个作用域都必须给 svg 上色（漏掉就会出现"文字有色、图标灰"）', () => {
  // ⚠️ 这个缺陷犯过两次：
  //  ① `title-part` 分支最初只写了 label 规则、漏了 svg —— 用户截图指出
  //    "这两个的文字是上色了 图标没有"；
  //  ② 根因是 `title` 与 `title-part` 在 CSS 里**互斥**，有详情的元素永远不匹配
  //    前者，所以它拿不到任何图标颜色。
  // 这里对**每一个**出现的作用域都断言"有 svg 规则"，避免再漏。
  const css = buildStylesheet({ thinking: { light: '#8A4B9C', dark: '#B5A0C2' } });
  const scopes = new Set();
  for (const m of css.matchAll(/\[data-cc-scope="([^"]+)"\]/g)) scopes.add(m[1]);
  assert.ok(scopes.size >= 4, `作用域数量异常：${[...scopes].join(', ')}`);
  for (const scope of scopes) {
    const hasSvg = new RegExp(`\\[data-cc-scope="${scope}"\\][^{]*svg\\{color:`).test(css);
    assert.ok(hasSvg, `作用域 ${scope} 缺少 svg 规则 → 该作用域下图标不会上色`);
  }
});


test('others 通用命令卡片：只有标题是 compact 时才算压缩', () => {
  const mk = (title) => ({ querySelector: (sel) => (sel.includes('_title') ? { textContent: title } : null) });
  assert.equal(classifyAttrs({ 'data-variant': 'others' }, { text: '正在压缩…', element: mk('compact') }), 'compaction');
  assert.equal(classifyAttrs({ 'data-variant': 'others' }, { text: '正在清空…', element: mk('clear') }), 'other');
  // 没有 element / querySelector 时必须安全退回，不能抛错。
  assert.equal(classifyAttrs({ 'data-variant': 'others' }, { text: 'x' }), 'other');
  assert.equal(classifyAttrs({ 'data-variant': 'others' }, { text: 'x', element: {} }), 'other');
});

test('聚合过程组标题必须走中性 summary，不得跟随单一活动变色', () => {
  // 回归守卫：用户 2026-10-17 反馈"太混乱了"。
  //
  // 内核把同一过程组里的多种活动**拼成一个摘要标题**，而 data-process-activity
  // **只保留其中一个**（哪个排在前就留哪个）。于是同一件事会因为排列顺序不同
  // 被染成三种颜色 —— 实测截图：
  //   已读取文件，修改了文件，执行了命令  → read     → 蓝
  //   修改了文件，执行了命令，已读取文件  → write    → 绿
  //   执行了命令，修改了文件，已读取文件  → commands → 玫红
  //
  // 聚合摘要没有单一语义，必须落到中性的 summary。
  const variants = [
    ['已读取文件，修改了文件，执行了命令', 'read'],
    ['修改了文件，执行了命令，已读取文件', 'write'],
    ['执行了命令，修改了文件，已读取文件', 'commands'],
  ];
  for (const [text, activity] of variants) {
    assert.equal(
      classifyAttrs({ 'data-process-activity': activity }, { text }),
      'summary',
      `聚合标题「${text}」必须走 summary，而不是跟随 ${activity} 变色`,
    );
  }
});

test('单一活动的过程组标题仍走各自的语义色（不能被 summary 吞掉）', () => {
  // 防止"修聚合"修过头：单个活动必须保留语义色，否则 read/write 全变灰。
  assert.equal(classifyAttrs({ 'data-process-activity': 'read' }, { text: '已读取文件' }), 'read');
  assert.equal(classifyAttrs({ 'data-process-activity': 'write' }, { text: '修改了文件' }), 'write');
  assert.equal(classifyAttrs({ 'data-process-activity': 'thinking' }, { text: '已完成分析' }), 'thinking');
});

test('上下文进度圈四档：饱和度必须严格递增（越危险越浓）', () => {
  // 用户要求"35 以下绿色系，自己分级"，且反复强调"不要太鲜艳抢眼"。
  // 第一版只给了 maxSaturation 上限、没有显式 targetS，结果**深色主题下**
  // critical 挑到 `#D9A594`（饱和 32），比 mid 的 `#C3B787` 还淡 ——
  // 危险档视觉上反而最弱，语义整个反了。这条测试守住单调性。
  const tiers = ['usageLow', 'usageMid', 'usageHigh', 'usageCritical'];
  for (const preset of ['chinese', 'japanese', 'macaron']) {
    const colors = presetColors(preset);
    let prevLight = -1;
    let prevDark = -1;
    for (const key of tiers) {
      const pair = colors[key];
      assert.ok(pair !== undefined, `${preset}: 缺少 ${key}`);
      const sl = hsvSaturation(pair.light);
      const sd = hsvSaturation(pair.dark);
      assert.ok(sl > prevLight, `${preset}/${key}: 浅色饱和度必须大于上一档（${sl} <= ${prevLight}）`);
      assert.ok(sd > prevDark, `${preset}/${key}: 深色饱和度必须大于上一档（${sd} <= ${prevDark}）`);
      prevLight = sl;
      prevDark = sd;
    }
  }
});

test('状态类颜色在三套预设下都必须与内容类互不撞色', () => {
  // 状态类（尾部/输入框）与内容类（消息体内）**分开选色**，但这不代表可以撞。
  // 实测踩过：把状态类并进内容区色库选色，在 japanese/macaron（色库仅 58/34 色）
  // 下必然挑不到唯一色，出现 `done vs write`、`usageMid vs retry` 撞色，
  // 甚至有类别完全无解（`done 缺失`）。改固定色值后才真正解决。
  const contentKeys = ['thinking', 'read', 'write', 'search', 'web', 'retry',
    'compaction', 'other', 'commandLow', 'commandMid', 'commandHigh'];
  const statusKeys = ['summary', 'done', 'meta', 'usageLow', 'usageMid', 'usageHigh', 'usageCritical'];
  for (const preset of ['chinese', 'japanese', 'macaron']) {
    const colors = presetColors(preset);
    const seen = new Map();
    for (const key of [...contentKeys, ...statusKeys]) {
      const pair = colors[key];
      assert.ok(pair !== undefined, `${preset}: 缺少类别 ${key}`);
      for (const theme of ['light', 'dark']) {
        const hex = pair[theme];
        const owner = seen.get(`${theme}:${hex}`);
        assert.ok(
          owner === undefined || owner === key,
          `${preset}/${theme}: ${key} 与 ${owner} 撞成同一个色 ${hex}`,
        );
        seen.set(`${theme}:${hex}`, key);
      }
    }
  }
});

// ── 2026-10-17 缺陷 ① / ② 的 CSS 侧守卫 ───────────────────────────────

test('缺陷①：「已完成」必须靠 _label 上色（旧实现只写 _title → 一条都命不中）', () => {
  // 内核 `TurnProcessNodeView` 的可见宿主是
  //   <button data-turn-process><span class="…_label">已完成，用时 …</span></button>
  // 类名后缀是 `_label` 而**不是** `_title`。旧 CSS 只写 `${self} [class*="_title"]`，
  // 于是即使分类判对了也上不到色。
  const css = buildStylesheet({ done: { light: '#2F6B4F', dark: '#7FC49B' } });
  assert.ok(
    /\[data-cc-scope="self"\] \[class\*="_label"\]\{color:/.test(css),
    'self 作用域必须命中 _label，否则「已完成 · 用时」仍然没有颜色',
  );
  assert.ok(
    /\[data-cc-scope="self"\] svg\{color:/.test(css),
    'self 作用域必须给图标上色（漏掉就是"文字有色、图标灰"）',
  );
});

test('缺陷②：进度圈按分档生成四组 CSS，且都作用在 self 上', () => {
  // 进度圈按钮不带任何 data-*，它自己就是被染元素 → self 作用域。
  const tiers = ['usageLow', 'usageMid', 'usageHigh', 'usageCritical'];
  for (const tier of tiers) {
    const css = buildStylesheet({ [tier]: { light: '#3F7A4A', dark: '#7EC08C' } });
    assert.ok(
      css.includes(`[${CAT_ATTR}="${tier}"]`),
      `${tier} 必须生成自己的规则`,
    );
    assert.ok(
      /\[data-cc-scope="self"\] svg\{color:/.test(css),
      `${tier} 必须通过 self 作用域给 svg 上色（进度圈是 svg stroke）`,
    );
  }
});
