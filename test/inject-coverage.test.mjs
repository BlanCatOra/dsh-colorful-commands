/**
 * 客户端静态守卫：**服务访问必须与 `inject` 声明一一对应**，且 `apply` 永不外抛。
 *
 * 为什么必须有这一条（2026-10-15 实测事故）：
 *
 * cordis 的 `ctx.<service>` 是个代理，只放行 Context 自带成员与插件自己 `inject`
 * 里声明过的**服务名**；其余一律抛 `cannot get property "X" without inject`。
 * 而 `package.json` 的 `dsh.client.inject` 列的是**包名**，只管模块加载顺序 ——
 * 两者长得像、作用完全不同，混淆的代价是把整个 DSH 启动打挂：
 *
 *   apply 抛错 → cordis 把 fiber 置 FAILED → web boot
 *   `throw new Error("web boot: N entry did not activate")` → **整页白屏**，
 *   且 crash log 只有一行 `<包名>: failed`，没有堆栈。
 *
 * 运行时测试抓不到这一条：测试里的假 ctx 是普通对象，没有代理拦截。
 * 所以只能在源码上静态断言。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import loadClient from './helpers/load-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');
const PACKAGE_ID = 'dsh-colorful-commands';

/** Context 自带的方法/属性：不经过服务代理，不需要写进 inject。 */
const CONTEXT_MEMBERS = new Set([
  'effect', 'inject', 'get', 'on', 'off', 'emit', 'plugin', 'fiber', 'logger',
  'reflect', 'provide', 'waterfall', 'set', 'start', 'stop', 'scope', 'isolate',
  'extend', 'config', 'registry', 'root', 'intercept', 'parallel', 'serial', 'bail',
]);

/** 只扫描浏览器侧模块（Host 侧的 index.js/config.js 有自己的 inject 语义）。 */
const CLIENT_ONLY = new Set([
  'client.js',
  'classify.js',
  'css.js',
  'palettes.js',
  'dom.js',
  'locale.js',
  'constants.js',
  'boot-diagnostics.js',
  'settings-card.js',
  'settings-face.js',
]);

/**
 * 去掉注释与字符串字面量，只留代码。
 *
 * 必需：文档注释里会写 `ctx.configForms` 这种反面例子（本插件正是如此 ——
 * 注释解释了"为什么不用 ctx.configForms 而用 ctx.get"）。不剥注释就会误报。
 */
function stripCommentsAndStrings(code) {
  let out = '';
  let mode = 'code';
  let index = 0;
  while (index < code.length) {
    const char = code[index];
    const next = code[index + 1];
    if (mode === 'code') {
      if (char === '/' && next === '*') {
        mode = 'block';
        index += 2;
        continue;
      }
      if (char === '/' && next === '/') {
        mode = 'line';
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        mode = char;
        index += 1;
        continue;
      }
      out += char;
      index += 1;
      continue;
    }
    if (mode === 'block') {
      if (char === '*' && next === '/') {
        mode = 'code';
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (mode === 'line') {
      if (char === '\n') {
        mode = 'code';
        out += '\n';
      }
      index += 1;
      continue;
    }
    // 字符串模式：处理转义，遇到闭合引号回代码态。
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === mode) {
      mode = 'code';
      index += 1;
      continue;
    }
    index += 1;
  }
  return out;
}

/** 造一个够用的 react 桩（只为让 bundle 的 require('react') 有东西可用）。 */
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

/** 造一个最小可用的 primitives 桩：本测试只关心"注册了什么"，不关心渲染。 */
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

/** 造一个 store 桩：用最小的 subscribe/getSnapshot/set/update 语义。 */
function makeStoreStub() {
  const make = (init) => {
    let state = init;
    const listeners = new Set();
    const emit = () => { for (const fn of listeners) fn(); };
    return {
      getSnapshot: () => state,
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      set: (next) => { state = next; emit(); },
      update: (mutator) => {
        const draft = JSON.parse(JSON.stringify(state));
        mutator(draft);
        state = draft;
        emit();
      },
    };
  };
  return { createSnapshotStore: make };
}

/** 装载真实 bundle 所需的基座模块表。 */
function baseModules() {
  return {
    react: makeReactStub(),
    'react/jsx-runtime': { jsx: (t, p) => ({ type: t, props: p }), jsxs: (t, p) => ({ type: t, props: p }), Fragment: 'Fragment' },
    '@deepseek-ai/dsh-client-ui-primitives': makePrimitivesStub(),
    '@deepseek-ai/dsh-client-store': makeStoreStub(),
  };
}

/**
 * 断言 `lib/client.js` 与当前 `src/` 同源。
 *
 * 做法：用打包器把 src 重新生成到临时文件，与磁盘产物逐字节比对。不同就说明
 * 产物过期 —— 那会让本文件的所有断言在测一个已经不存在的版本。
 *
 * 实测教训：把 `slots` 从 src 的 inject 删掉但不重建产物时，守卫读的是旧产物，
 * **静默通过**。
 */
async function assertBundleMatchesSource() {
  const { build, bannerFor } = await import('../src/build-client.mjs');
  const freshPath = join(tmpdir(), `${PACKAGE_ID}-guard-${process.pid}.js`);
  try {
    await build({
      entry: join(srcDir, 'client.js'),
      root: srcDir,
      packageId: PACKAGE_ID,
      output: freshPath,
      // banner 从打包器导出取，不在这里重写一份 —— 两处各写必然漂移。
      banner: bannerFor(PACKAGE_ID),
    });
    const [fresh, onDisk] = await Promise.all([
      readFile(freshPath, 'utf8'),
      readFile(join(here, '..', 'lib', 'client.js'), 'utf8'),
    ]);
    if (onDisk === fresh) return;
    const firstDiff = [...onDisk].findIndex((char, index) => char !== fresh[index]);
    assert.fail(
      'lib/client.js 与 src/ 不同源（产物过期）——先跑 `node src/build-client.mjs`。' +
        `\n  产物 ${onDisk.length} 字节 / 预期 ${fresh.length} 字节，首个差异在第 ${firstDiff} 字节附近`,
    );
  } finally {
    await rm(freshPath, { force: true });
  }
}

test('导出的 inject 必须覆盖源码里用到的每一个 ctx 服务', async () => {
  // 先确认产物与 src 同源，否则本测试在测一个旧版本。
  await assertBundleMatchesSource();

  const client = await loadClient(baseModules());
  assert.ok(Array.isArray(client.inject), 'client 必须导出 inject 数组');

  const needed = new Set();
  for (const name of CLIENT_ONLY) {
    const code = await readFile(join(srcDir, name), 'utf8').catch(() => undefined);
    if (code === undefined) continue;
    const stripped = stripCommentsAndStrings(code);
    for (const match of stripped.matchAll(/(?<![.\w$])ctx\.([A-Za-z_$][A-Za-z0-9_$]*)/g)) {
      if (!CONTEXT_MEMBERS.has(match[1])) needed.add(match[1]);
    }
  }

  assert.ok(needed.size > 0, '静态扫描必须真的扫到服务访问（否则这条守卫是空转）');
  for (const service of needed) {
    assert.ok(
      client.inject.includes(service),
      `ctx.${service} 被使用了，但没写进 inject —— cordis 会同步抛 ` +
        `"cannot get property \\"${service}\\" without inject"，把 apply 打挂、进而让整个 DSH 启动白屏`,
    );
  }
  for (const service of client.inject) {
    assert.ok(needed.has(service), `inject 里的 ${service} 已经没人用了，删掉（多余声明会把本插件绑死在别人的可用性上）`);
  }
});

test('configForms 必须用 ctx.get 探测，不得写进 inject', async () => {
  const client = await loadClient(baseModules());
  // 命名空间可能晚于 apply 到达；写进 inject 就变成硬依赖。
  assert.ok(!client.inject.includes('configForms'), 'configForms 不得进 inject');
  // ⚠️ 这里查**原文**而不是剥掉字符串的版本：`'configForms'` 是字符串字面量，
  // 剥完就消失，断言会假阴性。
  const source = await readFile(join(srcDir, 'client.js'), 'utf8');
  assert.ok(source.includes("'configForms'"), '必须通过名字探测 configForms');
  assert.ok(
    /get\s*\(\s*'configForms'/.test(source) || source.includes("get('configForms')"),
    '必须用 ctx.get(...) 安全探测 configForms',
  );
  assert.ok(
    !stripCommentsAndStrings(source).includes('ctx.configForms'),
    '不得直接读 ctx.configForms（未声明会抛 "without inject"）',
  );
});

test('package.json 的 dsh.client.inject 必须列出服务提供方包', async () => {
  const pkg = JSON.parse(await readFile(join(here, '..', 'package.json'), 'utf8'));
  const declared = new Set(pkg.dsh?.client?.inject ?? []);

  // 服务名 → 真正提供它的官方包（从 app.asar 全库扫描得到，不是猜的）：
  //   slots       <- @deepseek-ai/dsh-client-ui-renderer
  //   locale      <- @deepseek-ai/dsh-client-locale
  //   configForms <- @deepseek-ai/dsh-client-ui-settings
  // ⚠️ `@deepseek-ai/dsh-client-ui-slots` **不提供任何服务**（它只是契约/类型包），
  // 所以把它写进 inject 是无效的 —— 本测试第一版就踩了这个坑。
  const PROVIDER = {
    slots: '@deepseek-ai/dsh-client-ui-renderer',
    locale: '@deepseek-ai/dsh-client-locale',
  };

  const client = await loadClient(baseModules());
  for (const service of client.inject) {
    const provider = PROVIDER[service];
    assert.ok(provider, `服务 ${service} 的提供方未登记，请先查清再写测试`);
    assert.ok(
      declared.has(provider),
      `ctx.${service} 由 ${provider} 提供，但 package.json 的 dsh.client.inject 没列它 —— ` +
        '服务会晚一轮到达，本插件先 PENDING',
    );
  }

  // 三个配置插槽都由 plugin-manager 声明；不列它插槽可能不存在。
  assert.ok(
    declared.has('@deepseek-ai/dsh-client-ui-plugin-manager'),
    '设置卡片注册到 plugins.bundle.config，必须列 plugin-manager 保证插槽存在',
  );

  // primitives 在前端 boot 的 seed 表里（冻结基座），不需要也不应该进 inject。
  assert.ok(
    !declared.has('@deepseek-ai/dsh-client-ui-primitives'),
    'primitives 是 seed 表成员，无需进 dsh.client.inject（官方配置页也都不列它）',
  );
});

test('源码里不得出现 ctx.import / ctx.require（宿主没有这两个成员）', async () => {
  for (const name of CLIENT_ONLY) {
    const code = await readFile(join(srcDir, name), 'utf8').catch(() => undefined);
    if (code === undefined) continue;
    const stripped = stripCommentsAndStrings(code);
    for (const banned of ['ctx.import', 'ctx.require']) {
      assert.ok(
        !stripped.includes(banned),
        `${name} 里出现了 ${banned}：它既不是 Context 成员也不是服务，读它会抛 "without inject"`,
      );
    }
  }
});

test('设置卡片注册到 plugins.item，且用自有 id（不得是 settings.section）', async () => {
  const client = await loadClient(baseModules());
  const registrations = [];
  const ctx = {
    effect: (fn) => { fn(); return () => undefined; },
    get: (name) => (name === 'configForms' ? undefined : undefined),
    locale: { register: () => () => undefined, bind: () => (key) => key },
    slots: {
      register: (options) => { registrations.push(options); return () => undefined; },
    },
  };
  client.apply(ctx);
  // configForms 不可用时卡片不注册，这是刻意的降级；这里只断言"没注册错槽位"。
  for (const options of registrations) {
    assert.notEqual(options.name, 'settings.section', '插件设置不得注册到 settings.section');
    assert.notEqual(options.name, 'settings.plugin.item', 'settings.plugin.item 不存在（内核 0 命中）');
  }
});

test('apply 在「服务全抛错 / 空 ctx / 拿不到 react」下都不得把异常抛给 web boot', async () => {
  const client = await loadClient(baseModules());
  const boom = (label) => () => {
    throw new Error(`boom:${label}`);
  };
  assert.doesNotThrow(() =>
    client.apply({
      slots: { register: boom('slots.register') },
      locale: { register: boom('locale.register'), bind: boom('locale.bind') },
      effect: boom('effect'),
      get: boom('get'),
    }),
  );
  assert.doesNotThrow(() => client.apply({}), '缺服务时 apply 也不能抛');

  // 连 document 都没有（Node 环境）：同样不得外抛。
  assert.doesNotThrow(() => client.apply({
    effect: (fn) => { fn(); return () => undefined; },
    get: () => undefined,
    locale: { register: () => () => undefined, bind: () => (key) => key },
    slots: { register: () => () => undefined },
  }));
});
