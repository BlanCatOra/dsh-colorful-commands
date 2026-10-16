/**
 * dsh-colorful-commands —— 浏览器侧入口。
 *
 * ## 职责
 *
 * 1. 读取设置（settings 命名空间）；
 * 2. 生成并注入样式表；
 * 3. 启动 DOM 观察器给界面元素打类别标记；
 * 4. 在「插件详情页」注册设置卡片。
 *
 * ## 两条硬规则的落实
 *
 * **规则一：`ctx.<service>` 必须出现在本文件导出的 `inject` 里。**
 * cordis 的 `ctx.<service>` 是代理，服务名没写进 `inject` 会**同步抛**
 * `cannot get property "X" without inject` → `apply` 抛错 → fiber FAILED →
 * web boot `throw new Error("web boot: N entry did not activate")` → **整站白屏**，
 * 且 crash log 只有一行 `<包名>: failed`、没有堆栈。
 *
 * 本文件用到的服务与 `inject` 一一对应：
 * - `ctx.slots` → `"slots"`
 * - `ctx.locale` → `"locale"`
 * - `ctx.effect` / `ctx.inject` / `ctx.get` / `ctx.fiber` 是 Context 自带成员，不用声明。
 *
 * ⚠️ `configForms` **刻意不写进 `inject`**：命名空间可能晚于 `apply` 到达，
 * 写进去就变成硬依赖（别人挂了本插件也起不来）。改用 `ctx.get('configForms')`
 * 安全探测 —— Context 自带方法不受白名单限制，服务没到返回 undefined。
 *
 * **规则二：`apply` 绝不允许把异常抛出去。** 每个表面各自 guard，失败只降级、
 * 只记录（`console.error` + `localStorage`）。详见 `boot-diagnostics.js`。
 *
 * @module dsh-colorful-commands/client
 */
import { LOCALE_NS, PLUGIN_ID, SETTINGS_NAMESPACE, STYLE_TAG_ID } from './constants.js';
import { dictionaries } from './locale.js';
import { buildStylesheet, resolveColors } from './css.js';
import { presetColors } from './palettes.js';
import { createFailures, guard, safeStorage, writeBootReport } from './boot-diagnostics.js';
import { startObserver } from './dom.js';
import { ColorfulCommandsCard } from './settings-card.js';
import { createSettingsFace, readConfig } from './settings-face.js';

/**
 * 必需服务白名单（cordis fiber inject）。
 *
 * 只列本文件真正用到的服务名。多列一项 = 多一个"别人挂了我也起不来"的硬依赖；
 * 少列一项 = 整站白屏。两侧都要靠静态守卫测试兜住。
 */
export const inject = ['slots', 'locale'];

/** 样式标签：注入到 head，卸载时移除。 */
let styleElement = null;

/**
 * 把 CSS 写进 head。
 *
 * `document` 当**不可信输入**：head 可能被冻结、可能没有 head。全部包 try/catch，
 * 失败返回 false 表示降级（而不是抛错 —— 抛错会让插槽条目被永久撤销）。
 *
 * @param cssText 样式文本。
 * @returns 是否成功。
 */
export function applyStylesheet(cssText) {
  try {
    const doc = globalThis.document;
    if (doc === null || doc === undefined) return false;

    if (cssText === '') {
      // 空样式 = 关闭着色：移除已有标签。
      if (styleElement !== null) {
        styleElement.remove();
        styleElement = null;
      }
      return true;
    }

    if (styleElement === null) {
      styleElement = doc.createElement('style');
      styleElement.dataset.plugin = PLUGIN_ID;
      styleElement.id = STYLE_TAG_ID;
      const head = doc.head ?? doc.documentElement;
      if (head === null || head === undefined) return false;
      head.appendChild(styleElement);
    } else if (styleElement.isConnected === false) {
      // 标签还在引用里、但已被移出文档（head 被重建 / HMR 清理）。继续写它的
      // textContent 是**静默失效**：样式永远不生效。重新挂回去。
      const head = doc.head ?? doc.documentElement;
      if (head === null || head === undefined) return false;
      head.appendChild(styleElement);
    }
    styleElement.textContent = cssText;
    return true;
  } catch {
    // head 冻结 / DOM 被改写：降级为"没有着色"，不影响宿主。
    return false;
  }
}

/**
 * 由配置生成样式并应用。
 *
 * @param config 配置值。
 * @returns 生成的 CSS 文本。
 */
export function renderFromConfig(config) {
  const { colors, enabled } = resolveColors(config, { presetColors: presetColors(config?.preset) });
  const css = buildStylesheet(colors, { enabled });
  applyStylesheet(css);
  return css;
}

/**
 * 浏览器侧插件体。
 *
 * @param ctx 客户端 cordis 上下文。
 */
export function apply(ctx) {
  const failures = createFailures();

  /** 当前配置（scope 未就绪时用默认值，保证首帧也有配色）。 */
  let current = { enabled: true, preset: 'chinese', colors: {} };

  // ── 1. locale 字典 ──────────────────────────────────────────────
  guard(failures, 'locale', () => {
    ctx.effect(() => ctx.locale.register(LOCALE_NS, dictionaries), `${PLUGIN_ID}: dictionaries`);
  });
  const t = guard(failures, 'locale-bind', () => ctx.locale.bind(LOCALE_NS))
    ?? ((key) => key);

  // ── 2. 首帧着色（不等设置到达，避免闪一下原生配色） ──────────────
  guard(failures, 'first-paint', () => {
    renderFromConfig(current);
  });

  // ── 3. DOM 观察器 ───────────────────────────────────────────────
  guard(failures, 'dom-observer', () => {
    const stop = startObserver({
      onError: (where, error) => {
        failures.push({ where, message: String(error?.message ?? error), stack: '' });
      },
    });
    ctx.effect(() => stop, `${PLUGIN_ID}: dom observer`);
  });

  // ── 4. 设置卡片  // ── 4. 设置卡片  // ── 4. 设置卡片：**无条件注册** ─────────────────────────────────
  //
  // ⚠️⚠️ 这里曾经是本插件"设置页什么都不显示"的真正原因，务必别改回去。
  //
  // 第一版把 `registerCard(...)` 放在了 `forms.whileServed([命名空间], cb)`
  // **内部**，于是：
  //   命名空间未就绪 → whileServed 不触发 → 卡片**从未注册** → 设置页空白。
  // 而且这**不报错**（whileServed 只是等待，不算失败），所以测试全绿、日志干净，
  // 完全看不出问题。
  //
  // 规范原话（dsh-connect-workbuddy 的注释）：
  //   「渲染条件由组件自己决定：**无条件注册**、组件里读投影判断是否返回 null。
  //     注册是条件性的会导致『该出现时不出现』。」
  //
  // 所以：卡片**无条件注册**；settings scope 单独在下面绑定，晚到也没关系
  // —— face 对 `scope === undefined` 有完整降级（显示默认色 + 只读提示）。
  const face = createSettingsFace({
    scope: undefined,
    t,
    // 配置变化 → 重渲染样式表。face 只管设置数据，样式注入是这里的职责。
    onConfigChange: (config) => {
      current = config;
      renderFromConfig(config);
    },
    onError: (where, error) => {
      failures.push({ where, message: String(error?.message ?? error), stack: '' });
    },
  });
  guard(failures, 'settings:register-card', () => {
    const offCard = registerCard(ctx, failures, t, face);
    ctx.effect(() => offCard, `${PLUGIN_ID}: settings card`);
  });

  // ── 5. 设置：绑定命名空间并跟随变化（与卡片注册解耦） ────────────
  guard(failures, 'settings:bind-namespace', () => {
    // configForms 用 ctx.get 探测：命名空间可能晚于 apply 到达。
    // ⚠️ `ctx.get` 本身也可能不在（极端降级上下文），所以要判类型再调。
    const get = typeof ctx.get === 'function' ? ctx.get.bind(ctx) : undefined;
    const forms = get === undefined ? undefined : get('configForms');
    if (forms === undefined || typeof forms.whileServed !== 'function') {
      // 没有 settings 服务：插件仍工作（用默认配色），只是不能配置。
      // 注意这是**降级而非失败**：不 push failures，避免把正常部署误报成故障。
      return;
    }

    ctx.effect(() => forms.whileServed([SETTINGS_NAMESPACE], () => {
      let scope;
      try {
        scope = forms.get(SETTINGS_NAMESPACE);
      } catch (error) {
        failures.push({ where: 'settings:get', message: String(error?.message ?? error), stack: '' });
        return () => {};
      }

      // 把 scope 接进已经注册好的卡片面（卡片本身早已注册，与这里无关）。
      face.attachScope(scope);
      return () => {
        face.detachScope();
      };
    }), `${PLUGIN_ID}: settings namespace`);
  });

  // ── 6. 写启动报告（无论成败；ok:false 会列出失败步骤） ──────────
  guard(failures, 'boot-report', () => {
    writeBootReport(failures, { inject: inject.join(',') });
  });
}

/**
 * 注册设置卡片到「插件详情页」。
 *
 * ## 插槽名（这里曾经写错，导致设置页根本不出现）
 *
 * plugin-manager 内核源码里的三个配置插槽，各有明确归属：
 *
 * | 插槽 | kind | 归属 |
 * |---|---|---|
 * | `plugins.item` | list | **官方插件**，按 `id` 列在「内置插件配置」分组 |
 * | `plugins.bundle.config` | keyed | **组合包自己的配置**，`key` = 组合包包名 |
 * | `plugins.row.config` | keyed | 组合包里某一行，`key` = `<包名>#<行 id>` |
 *
 * 本插件是 profile 里的**第三方组合包**，所以必须用 `plugins.bundle.config`
 * 且 `key` 写包名 —— 内核按 `ledger.bundles.has(pkg.name)` 决定是否渲染，
 * 用 `plugins.item` 会**什么都不显示**（第一版就是这个错误）。
 *
 * ⚠️ keyed 槽用 `key:`，list 槽用 `id:`；写错属性名同样静默不显示。
 * 参考实现（本机已验证可用）：`dsh-connect-workbuddy` 的 `registerCard`。
 *
 * ## 时机
 *
 * 用 `slots.inject(槽名, cb)` 而不是直接 `register`：`inject` 会**等该插槽被
 * 声明**再执行回调，避免与 plugin-manager 声明插槽的时机竞争。
 *
 * @param ctx 客户端上下文。
 * @param failures 失败收集器。
 * @param t 文案函数。
 * @param face 设置面。
 * @returns disposer。
 */
function registerCard(ctx, failures, t, face) {
  const SLOT = 'plugins.bundle.config';
  try {
    const register = () => ctx.slots.register({
      name: SLOT,
      // keyed 槽：key 必须是**组合包包名**（内核据此匹配 pkg.name）。
      key: PLUGIN_ID,
      priority: 30,
      locale: LOCALE_NS,
      inject: () => ({
        t,
        buildCss: face.buildCss,
        setDraft: face.setDraft,
        useDraft: face.useDraft,
        formState: face.formState,
        onSave: () => { void face.save(); },
        onDiscard: () => face.discard(),
      }),
    }, ColorfulCommandsCard);

    if (typeof ctx.slots.inject === 'function') {
      return ctx.slots.inject(SLOT, register);
    }
    return register();
  } catch (error) {
    failures.push({
      where: 'settings:register-card',
      message: String(error?.message ?? error),
      stack: error instanceof Error ? String(error.stack ?? '').slice(0, 2000) : '',
    });
    return undefined;
  }
}
