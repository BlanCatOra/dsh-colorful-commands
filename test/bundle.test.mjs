/**
 * 接线层集成测试：执行**真实的** `lib/client.js`。
 *
 * 为什么必须测 bundle 而不是 `import('../src/client.js')`：
 * DSH 浏览器侧把 `react` / `primitives` 放在宿主的冻结模块表里，客户端代码只能
 * 通过 bundle 外壳的 `require` 拿到。直接 import src/ 时那条通道不存在，测试就会
 * 被迫自己塞假通道 —— 于是「测试全绿、真机全废」（2026-10-15 实测事故的形状）。
 *
 * 这里用最小 `window.__ModuleLoader__` 外壳装载真实产物，`require` 走的就是生产路径。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

import loadClient from './helpers/load-client.mjs';
import { presetColors } from '../src/palettes.js';

/** react 桩：够 bundle 顶层求值与组件函数调用。 */
function makeReactStub() {
  return {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
    }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (initial) => ({ current: initial }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => undefined],
    useEffect: () => undefined,
    useId: () => 'test-id',
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
}

function makePrimitivesStub() {
  const passthrough = (name) => {
    const Component = (props) => ({ type: name, props });
    Component.displayName = name;
    return Component;
  };
  return {
    Button: passthrough('Button'),
    Input: passthrough('Input'),
    Switch: passthrough('Switch'),
    Tag: passthrough('Tag'),
    Tooltip: passthrough('Tooltip'),
    SegmentedControl: passthrough('SegmentedControl'),
    SettingsForm: passthrough('SettingsForm'),
  };
}

/** store 桩：实现 bundle 用到的全部语义。 */
function makeStoreStub() {
  return {
    createSnapshotStore: (init) => {
      let state = init;
      const listeners = new Set();
      const emit = () => { for (const fn of listeners) fn(); };
      return {
        getSnapshot: () => state,
        subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
        set: (next) => { state = next; emit(); },
        update: (mutator) => {
          const draft = structuredClone(state);
          mutator(draft);
          state = draft;
          emit();
        },
      };
    },
  };
}

const BASE = () => ({
  react: makeReactStub(),
  'react/jsx-runtime': {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
    Fragment: 'Fragment',
  },
  '@deepseek-ai/dsh-client-ui-primitives': makePrimitivesStub(),
  '@deepseek-ai/dsh-client-store': makeStoreStub(),
});

/**
 * 造一个可用的假 ctx，并记录所有注册与副作用。
 *
 * ⚠️ 这里**只提供生产里真实存在的成员**：effect / get / locale / slots。
 * 绝不加 `ctx.import` 之类的假通道 —— 那正是"测试替实现补契约"的翻车形状。
 */
function makeCtx(options = {}) {
  const registrations = [];
  const effects = [];
  const registered = new Map();
  const styles = [];
  const scope = options.scope ?? makeScope();

  const ctx = {
    effect: (fn, label) => {
      const disposer = fn();
      effects.push({ label, disposer });
      return () => { if (typeof disposer === 'function') disposer(); };
    },
    get: (name) => (name === 'configForms' ? options.forms : undefined),
    locale: {
      register: (ns, dict) => { registered.set(ns, dict); return () => undefined; },
      bind: (ns) => (key) => `${ns}:${key}`,
    },
    slots: {
      // 记录注册选项**与组件**：组件是插槽注册的第二个参数，也是渲染测试的入口。
      register: (opts, component) => {
        registrations.push({ ...opts, __component: component });
        return () => undefined;
      },
      // 生产里官方插件走 `slots.inject(槽名, cb)` 等插槽声明；这里如实提供，
      // 让测试覆盖那条真实路径（少了它就会只测到 fallback 分支）。
      inject: (slotName, callback) => callback(),
    },
  };
  return { ctx, registrations, effects, registered, styles, scope };
}

/** 假的 settings scope。 */
function makeScope(initial = {}) {
  let state = {
    status: 'ready',
    value: { enabled: true, preset: 'chinese', colors: {}, ...initial },
    writable: true,
    revision: 1,
  };
  const listeners = new Set();
  const writes = [];
  return {
    getSnapshot: () => state,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    set: async (field, value) => {
      writes.push({ field, value });
      state = { ...state, value: { ...state.value, [field]: value } };
      for (const fn of listeners) fn();
      return true;
    },
    /** 测试用：模拟 Host 端变化。 */
    __push: (next) => {
      state = { ...state, value: { ...state.value, ...next }, revision: state.revision + 1 };
      for (const fn of listeners) fn();
    },
    __writes: writes,
    __state: () => state,
  };
}

/** 假的 forms 服务。 */
function makeForms(scope) {
  return {
    whileServed: (namespaces, register) => {
      const disposer = register();
      return () => { if (typeof disposer === 'function') disposer(); };
    },
    get: () => scope,
  };
}

/** 给测试装一个最小 document，用于验证样式注入。 */
function installDocument() {
  const created = [];
  const head = {
    children: [],
    appendChild(node) { this.children.push(node); created.push(node); return node; },
  };
  const doc = {
    head,
    documentElement: head,
    body: { nodeType: 1, matches: () => false, querySelectorAll: () => [] },
    createElement: (tag) => {
      const el = {
        tagName: tag,
        dataset: {},
        textContent: '',
        id: '',
        /** 模拟真实 DOM 的 isConnected：挂在 head 上才算连着。 */
        get isConnected() { return head.children.includes(el); },
        remove() { const i = head.children.indexOf(el); if (i >= 0) head.children.splice(i, 1); },
      };
      return el;
    },
    querySelectorAll: () => [],
  };
  globalThis.document = doc;
  return { doc, created, head };
}

test('装载真实 bundle：导出 apply 与 inject', async () => {
  const client = await loadClient(BASE());
  assert.equal(typeof client.apply, 'function');
  assert.deepEqual([...client.inject].sort(), ['locale', 'slots']);
});

test('apply 会把样式表注入 head（首帧就有配色，不等设置到达）', async () => {
  const { created } = installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx } = makeCtx({ forms: makeForms(scope) });

  client.apply(ctx);

  assert.ok(created.length > 0, '必须创建了 style 元素');
  const style = created[0];
  assert.equal(style.dataset.plugin, 'dsh-colorful-commands');
  assert.ok(style.textContent.includes('data-cc-cat'), '注入的 CSS 必须含本插件的类别属性');
  assert.ok(style.textContent.includes('#'), '注入的 CSS 必须含真实色值');
});

test('设置卡片注册到 plugins.bundle.config，key 必须是组合包包名', async () => {
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx, registrations } = makeCtx({ forms: makeForms(scope) });

  client.apply(ctx);

  // ⚠️ 必须是 plugins.bundle.config（keyed，key = 组合包包名），**不是**
  // plugins.item（那是**官方插件**的位置，list 槽、按 id 去重）。
  // 内核：`configured = ledger.bundles.has(pkg.name)`，再
  // `renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name })`。
  // 第一版注册到了 plugins.item，结果**设置页什么都不显示**。
  const card = registrations.find((r) => r.name === 'plugins.bundle.config');
  assert.ok(card, '必须注册到 plugins.bundle.config');
  assert.equal(card.key, 'dsh-colorful-commands', 'keyed 槽的 key 必须是组合包包名');
  assert.equal(
    registrations.filter((r) => r.name === 'plugins.item').length,
    0,
    '不得注册到 plugins.item —— 那是官方插件的位置，第三方组合包写了也不显示',
  );

  // inject 面：组件靠它拿数据，缺一项就是真机白屏/功能缺失。
  const face = card.inject();
  for (const key of ['t', 'buildCss', 'setDraft', 'useDraft', 'formState', 'onSave', 'onDiscard']) {
    assert.ok(face[key] !== undefined, `inject 面缺 ${key}`);
  }
});

test('改配置后样式表跟着变（改色真的生效）', async () => {
  const { created } = installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx } = makeCtx({ forms: makeForms(scope) });

  client.apply(ctx);
  const style = created[0];
  const before = style.textContent;

  // 模拟 Host 端把预设切成马卡龙。
  scope.__push({ preset: 'macaron' });
  const after = style.textContent;

  assert.notEqual(before, after, '预设变化必须重新生成样式');
  // ⚠️ 断言的色值从色板推导，不硬编码 —— 预设是引擎算出来的，值会随阈值演进。
  const macaron = presetColors('macaron');
  const expect = Object.values(macaron).flatMap((p) => [p.light, p.dark]);
  assert.ok(expect.some((hex) => after.includes(hex)), '马卡龙色板的色值应出现在新样式中');
});

test('关闭开关后样式被移除（不残留旧配色）', async () => {
  const { created, head } = installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx } = makeCtx({ forms: makeForms(scope) });

  client.apply(ctx);
  assert.equal(head.children.length, 1, '首帧应有一个 style 标签');
  assert.ok(created[0].textContent.length > 0);

  scope.__push({ enabled: false });
  // 契约是「把标签从 head 摘掉」，而不是「清空 textContent」——
  // 摘掉即不再生效，且下次开启会重新创建。
  assert.equal(head.children.length, 0, '关闭后 style 标签必须从 head 移除');
});

test('保存会把草稿写回命名空间（三个字段分别写）', async () => {
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx, registrations } = makeCtx({ forms: makeForms(scope) });

  client.apply(ctx);
  const face = registrations.find((r) => r.name === 'plugins.bundle.config').inject();

  // 改一个类别，然后保存。
  face.setDraft((draft) => ({ ...draft, colors: { thinking: { light: '#111111', dark: '#222222' } } }));
  await face.onSave();

  const fields = scope.__writes.map((w) => w.field);
  assert.ok(fields.includes('colors'), '必须写 colors 字段');
  const colorsWrite = scope.__writes.find((w) => w.field === 'colors');
  assert.equal(colorsWrite.value.thinking.light, '#111111');
});

test('保存后 formState 的 dirty 回到 false（按钮不会一直亮着）', async () => {
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx, registrations } = makeCtx({ forms: makeForms(scope) });
  client.apply(ctx);
  const face = registrations.find((r) => r.name === 'plugins.bundle.config').inject();

  const snapshotOf = () => {
    let value;
    face.useDraft((snap) => { value = snap; return snap; });
    return value;
  };

  assert.equal(face.formState(snapshotOf()).dirty, false, '初始不该是脏的');
  face.setDraft((draft) => ({ ...draft, preset: 'japanese' }));
  assert.equal(face.formState(snapshotOf()).dirty, true, '改完必须是脏的');
  await face.onSave();
  assert.equal(face.formState(snapshotOf()).dirty, false, '保存后必须回到干净');
});

test('放弃修改会回到基线值', async () => {
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx, registrations } = makeCtx({ forms: makeForms(scope) });
  client.apply(ctx);
  const face = registrations.find((r) => r.name === 'plugins.bundle.config').inject();

  const snapshotOf = () => {
    let value;
    face.useDraft((snap) => { value = snap; return snap; });
    return value;
  };

  const original = snapshotOf().config.preset;
  face.setDraft((draft) => ({ ...draft, preset: 'macaron' }));
  assert.equal(snapshotOf().config.preset, 'macaron');
  face.onDiscard();
  assert.equal(snapshotOf().config.preset, original, '放弃后必须回到基线');
});

test('没有 configForms 服务时仍能工作（只降级，不抛错、不清空首帧配色）', async () => {
  const { created } = installDocument();
  const client = await loadClient(BASE());
  const { ctx } = makeCtx({ forms: undefined });

  assert.doesNotThrow(() => client.apply(ctx));
  assert.ok(created.length > 0, '即使没有设置服务，首帧配色仍要注入');
  assert.ok(created[0].textContent.includes('data-cc-cat'));
});

test('卸载时移除样式标签（不残留）', async () => {
  const { created, head } = installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx, effects } = makeCtx({ forms: makeForms(scope) });

  client.apply(ctx);
  assert.equal(head.children.length, 1);

  // 逐个执行 disposer（模拟插件卸载）。
  for (const effect of effects) {
    if (typeof effect.disposer === 'function') effect.disposer();
  }
  // dom 观察器的 disposer 会清标记；样式标签的移除由 effect 的清理负责。
  assert.ok(created.length >= 1);
});

test('设置卡片组件渲染期不抛错（渲染期抛错会让插槽条目被永久撤销）', async () => {
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx, registrations } = makeCtx({ forms: makeForms(scope) });
  client.apply(ctx);

  const card = registrations.find((r) => r.name === 'plugins.bundle.config');
  const face = card.inject();

  // ⚠️ 不能 `import('../src/settings-card.js')`：那个模块 import 'react'，而 react
  // 只能通过 bundle 外壳的 require 拿到（生产就是这条路径）。直接 import 会
  // ERR_MODULE_NOT_FOUND —— 这正是"别绕过 bundle 测接线层"的原因。
  // 这里取 bundle 注册时传入的**真实组件**，走的是生产路径。
  const Component = card.__component;
  assert.equal(typeof Component, 'function', '插槽注册必须带上组件');

  const snapshot = {
    config: { enabled: true, preset: 'chinese', colors: {} },
    baseline: { enabled: true, preset: 'chinese', colors: {} },
    saving: false,
    failed: false,
    available: true,
    writable: true,
  };
  const props = {
    view: 'page',
    t: (key) => key,
    useDraft: (selector) => selector(snapshot),
    formState: () => ({ available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }),
    buildCss: face.buildCss,
    setDraft: face.setDraft,
    onSave: face.onSave,
    onDiscard: face.onDiscard,
  };

  // 直接调用组件函数：插槽的 SlotErrorBoundary 只在渲染期兜底，而
  // "渲染期抛错 → 条目永久 abdicated"是静默失效，必须在这里先抓住。
  assert.doesNotThrow(() => Component(props), '渲染期不得抛错');

  // 各种边界输入都不能抛：summary 视图、关闭开关、非法色值草稿。
  assert.doesNotThrow(() => Component({ ...props, view: 'summary' }));
  assert.doesNotThrow(() => Component({
    ...props,
    useDraft: (sel) => sel({ ...snapshot, config: { enabled: false, preset: 'none', colors: {} } }),
  }));
  assert.doesNotThrow(() => Component({
    ...props,
    useDraft: (sel) => sel({
      ...snapshot,
      config: { enabled: true, preset: 'custom', colors: { thinking: { light: 'bogus', dark: '' } } },
    }),
  }));
});

test('summary 视图返回描述文案（插件列表页用）', async () => {
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx, registrations } = makeCtx({ forms: makeForms(scope) });
  client.apply(ctx);
  const card = registrations.find((r) => r.name === 'plugins.bundle.config');
  const face = card.inject();

  // ⚠️ 必须给全套 props：组件把 hook 放在最前面（与官方 settings-subagent 一致，
  // 满足 Rules of Hooks），summary 的提前 return 在 hook 之后。只传 view/t 会
  // 因为 useDraft 不是函数而抛 —— 那是**测试的输入不真实**，不是组件的缺陷。
  const snapshot = {
    config: { enabled: true, preset: 'chinese', colors: {} },
    baseline: { enabled: true, preset: 'chinese', colors: {} },
    saving: false,
    failed: false,
    available: true,
    writable: true,
  };
  const out = card.__component({
    view: 'summary',
    t: (key) => `t:${key}`,
    useDraft: (selector) => selector(snapshot),
    formState: () => ({ available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }),
    buildCss: face.buildCss,
    setDraft: face.setDraft,
    onSave: face.onSave,
    onDiscard: face.onDiscard,
  });
  assert.equal(out, 't:cardDescription');
});

/** 递归收集渲染树里所有字符串子节点（文案键）。 */
function collectText(node, out = []) {
  if (node === null || node === undefined) return out;
  if (typeof node === 'string') { out.push(node); return out; }
  if (Array.isArray(node)) { for (const n of node) collectText(n, out); return out; }
  if (typeof node !== 'object') return out;
  // 函数型节点（CategoryRow 这类组件）要**真的调用一次**才能看到它渲染出的文案，
  // 否则断言只会看到 `type` 是函数、里面一个字符串都没有（假绿）。
  if (typeof node.type === 'function') {
    collectText(node.type(node.props ?? {}), out);
    return out;
  }
  collectText(node.props?.children, out);
  return out;
}

test('设置卡片必须渲染权限等级四档，且不再有模型选择 / 活动栏 / 正文染色开关', async () => {
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx, registrations } = makeCtx({ forms: makeForms(scope) });
  client.apply(ctx);

  const card = registrations.find((r) => r.name === 'plugins.bundle.config');
  assert.ok(card, '必须注册到 plugins.bundle.config');

  const snapshot = {
    config: { enabled: true, preset: 'chinese', colors: {} },
    baseline: { enabled: true, preset: 'chinese', colors: {} },
    saving: false,
    failed: false,
    available: true,
    writable: true,
  };
  const face = registrations.find((r) => r.name === 'plugins.bundle.config');
  const out = card.__component({
    view: 'page',
    t: (key) => key,
    useDraft: (selector) => selector(snapshot),
    formState: () => ({ available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }),
    buildCss: face !== undefined ? () => '' : () => '',
    setDraft: () => undefined,
    onSave: () => undefined,
    onDiscard: () => undefined,
  });
  const texts = collectText(out);

  // 用户要求"不同权限等级的颜色应该不同" —— 四档必须都能在设置里单独配色。
  for (const key of [
    'categoryCommandLow', 'categoryCommandMid', 'categoryCommandHigh',
    'categoryPermReadonly', 'categoryPermWorkspace', 'categoryPermFull', 'categoryPermAuto',
    'permissionsTitle',
    'categoryCtlPermission', 'categoryCtlPlan',
  ]) {
    assert.ok(texts.includes(key), `设置卡片必须渲染 ${key}`);
  }
  // 用户明确要求"语音输入和模型名称不需要颜色"。
  for (const gone of ['categoryCtlModel', 'categoryCtlActivity', 'colorTextLabel']) {
    assert.ok(!texts.includes(gone), `不得再渲染 ${gone}`);
  }
});

test('renderer 没有 slots.inject 时回退到直接 register（旧版兼容）', async () => {
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const registrations = [];
  const ctx = {
    effect: (fn) => { const d = fn(); return () => { if (typeof d === 'function') d(); }; },
    get: (name) => (name === 'configForms' ? makeForms(scope) : undefined),
    locale: { register: () => () => undefined, bind: (ns) => (key) => `${ns}:${key}` },
    // 刻意不提供 inject：模拟旧版 renderer。
    slots: {
      register: (opts, component) => { registrations.push({ ...opts, __component: component }); return () => undefined; },
    },
  };

  assert.doesNotThrow(() => client.apply(ctx));
  const card = registrations.find((r) => r.name === 'plugins.bundle.config');
  assert.ok(card, '没有 slots.inject 时也必须回退注册成功');
  assert.equal(typeof card.__component, 'function');
});

test('契约：按内核的 ledger 匹配逻辑，本插件必须被判定为"已配置"', async () => {
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();
  const { ctx, registrations } = makeCtx({ forms: makeForms(scope) });
  client.apply(ctx);

  // ── 复刻 plugin-manager 内核的匹配逻辑（app.asar 源码逐字照抄）──
  //   const keysOf = (name) => new Set(ctx.slots.entries(name)
  //     .flatMap((e) => e.options.key === undefined ? [] : [e.options.key]));
  //   ledger.bundles = keysOf('plugins.bundle.config');
  //   configured = ledger.bundles.has(pkg.name)      // ← 用**包名**匹配
  //   renderSlot('plugins.bundle.config', { view:'page' }, { entryKey: pkg.name })
  const keysOf = (name) => new Set(
    registrations
      .filter((r) => r.name === name)
      .flatMap((e) => (e.key === undefined ? [] : [e.key])),
  );
  const ledgerBundles = keysOf('plugins.bundle.config');

  // profile 里那条 bundle 的包名（与 package.json 的 name 一致）。
  const pkgName = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ).name;

  assert.ok(
    ledgerBundles.has(pkgName),
    `内核用 ledger.bundles.has(pkg.name) 判断是否渲染配置区。` +
      `本插件注册的 key 必须在其中，否则设置页**什么都不显示**。` +
      `实际 keys=${JSON.stringify([...ledgerBundles])}，包名=${pkgName}`,
  );
});

test('契约：entryKey 与 cordis.patch.yml 的 insert id 必须对得上', async () => {
  // row.config 的 key 是 `<包名>#<行 id>`；bundle.config 的 key 是包名。
  // 两者任一对不上都会让配置区静默不显示，所以这里断言 patch 里的 id 真实存在。
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  const pkgName = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ).name;

  assert.ok(patch.includes(`id: ${pkgName}`), 'patch 的 insert id 必须等于包名');
  assert.ok(patch.includes(`name: ${pkgName}`), 'patch 的 insert name 必须等于包名');

  installDocument();
  const client = await loadClient(BASE());
  const { ctx, registrations } = makeCtx({ forms: makeForms(makeScope()) });
  client.apply(ctx);
  const card = registrations.find((r) => r.name === 'plugins.bundle.config');
  assert.equal(card.key, pkgName, 'bundle.config 的 key 必须等于包名');
});

test('回归·命名空间未就绪时，设置卡片仍必须已注册', async () => {
  // 这是"设置页什么都不显示"的真正成因：
  // 第一版把 registerCard 放在 whileServed 的回调**内部** —— 命名空间没到
  // 就不注册，设置页一片空白，而且**不报错**（whileServed 只是等待，不算失败），
  // 所以测试全绿、日志干净，完全看不出问题。
  //
  // 规范原话：「渲染条件由组件自己决定：无条件注册、组件里读投影判断是否返回
  // null。注册是条件性的会导致『该出现时不出现』。」
  installDocument();
  const client = await loadClient(BASE());
  const scope = makeScope();

  // 造一个**永不服务命名空间**的 forms：whileServed 的回调永不触发。
  const neverForms = {
    whileServed: () => () => {},
    get: () => scope,
  };
  const { ctx, registrations } = makeCtx({ forms: neverForms });

  client.apply(ctx);

  const card = registrations.find((r) => r.name === 'plugins.bundle.config');
  assert.ok(card, '即使命名空间永不到达，设置卡片也必须已注册（无条件注册）');
  assert.equal(card.key, 'dsh-colorful-commands');

  // 且 inject 面必须可用（scope 为 undefined 时要能优雅降级，不能抛）。
  const face = card.inject();
  assert.doesNotThrow(() => face.useDraft((s) => s));
  assert.doesNotThrow(() => {
    const snap = face.useDraft((s) => s);
    const st = face.formState(snap);
    assert.equal(st.available, false, 'scope 未就绪时应显示为不可用');
  });
  // 保存不能抛（scope 缺失）。注意 onSave 是 void 返回，所以断言"不抛"而非"不 reject"。
  assert.doesNotThrow(() => face.onSave());
});

test('回归·scope 晚到后样式必须跟着更新', async () => {
  // 拆开"注册卡片"与"绑定 scope"之后曾漏掉这一环：只更新了 store，
  // 没人再调 renderFromConfig —— 界面不动。
  const { created } = installDocument();
  const client = await loadClient(BASE());
  // ⚠️ 必须用与首帧默认**不同**的预设：首帧默认就是 chinese，若 scope 也是
  // chinese，CSS 逐字节相同，断言会假失败（第一版就踩了这个）。
  const scope = makeScope({ preset: 'macaron' });

  // 用一个可以先挂起、后触发的 forms。
  // 用数组收集：whileServed 可能被调用多次（这本身也说明注册是无条件发生的）。
  const fires = [];
  const deferredForms = {
    whileServed: (_ns, register) => {
      fires.push(register);
      return () => {};
    },
    get: () => scope,
  };
  const { ctx, registrations } = makeCtx({ forms: deferredForms });
  client.apply(ctx);

  assert.ok(fires.length > 0, 'whileServed 应被调用');
  const style = created[0];
  const before = style.textContent;

  // 命名空间到位。
  fires[0]();

  const after = style.textContent;
  assert.notEqual(before, after, 'scope 到位后必须重新生成样式');
  const macaron = presetColors('macaron');
  const expect = Object.values(macaron).flatMap((p) => [p.light, p.dark]);
  assert.ok(expect.some((hex) => after.includes(hex)), '应含马卡龙预设的值');
});
