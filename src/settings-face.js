/**
 * dsh-colorful-commands —— 设置卡片的「接线面」。
 *
 * ## 这一层在解决什么
 *
 * 设置卡片需要三样东西，而它们都来自宿主、且都可能"晚到"或"不在"：
 * 1. **settings 命名空间的 scope**（`ctx.configForms.get(ns)`）—— 异步填充；
 * 2. **locale 绑定**（`ctx.locale.bind(ns)`）；
 * 3. **一个稳定的 store**，组件通过它读草稿与表单状态。
 *
 * 把这三样收敛到一个 face 对象里，插槽的 `inject: () => face` 把它交给组件。
 * 组件因此完全不碰宿主服务，只读 props —— 这也让组件可以在测试里直接渲染。
 *
 * ## 为什么草稿与表单状态放在同一个 store
 *
 * `SettingsForm` 的 `state`（dirty / saving / failed）与草稿必须**一起**变化：
 * 如果 state 是"渲染时现算"的普通函数，React 不会因它变化而重渲染，
 * 于是"点保存后按钮一直转圈"或"改完按钮不亮"这类静默失效就会出现。
 * 放进同一个快照，订阅一次就全都有了。
 *
 * @module dsh-colorful-commands/settings-face
 */
import { useSyncExternalStore } from 'react';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { buildStylesheet, resolveColors } from './css.js';
import { presetColors } from './palettes.js';
import { ALL_CATEGORIES } from './constants.js';

/**
 * 从 scope 快照里读出配置值。
 *
 * ⚠️ 快照形状（内核实测）：`{ status, value, base, user, revision, writable, mode }`。
 * 读 `value`（**已合并**的当前值）而不是 `user`，因为要显示"实际生效的值"。
 *
 * @param snapshot scope 快照。
 * @returns 规范化后的配置。
 */
export function readConfig(snapshot) {
  const value = snapshot?.value ?? {};
  const colors = value.colors;
  return {
    enabled: value.enabled !== false,
    preset: typeof value.preset === 'string' ? value.preset : 'chinese',
    colorText: value.colorText === true,
    colors: colors !== null && typeof colors === 'object' ? { ...colors } : {},
  };
}

/** 深比较两个配置（值都是 JSON 形状，字符串化足够）。 */
function sameConfig(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 由草稿生成样式文本（预览与生产走同一条路径）。
 *
 * @param draft 草稿配置。
 * @returns CSS 文本。
 */
export function draftCss(draft) {
  const { colors, enabled } = resolveColors(draft, { presetColors: presetColors(draft?.preset) });
  return buildStylesheet(colors, { enabled, colorText: draft?.colorText === true });
}

/**
 * 创建一个设置卡片面。
 *
 * ## 生命周期：先注册、后接 scope
 *
 * 卡片**无条件注册**，而 settings scope 可能晚到（甚至永远不到）。所以本对象
 * 先以 `scope === undefined` 的降级状态构造，之后由 `attachScope(scope)` 接上。
 *
 * 为什么必须这样拆（实测事故）：第一版把"注册卡片"放在 `whileServed` 内部，
 * 命名空间没就绪时卡片**从未注册**，设置页一片空白 —— 而且不报错，测试全绿。
 *
 * @param options.scope 初始 scope（可省略）。
 * @param options.t 文案函数。
 * @param options.onError 失败回调。
 * @returns face 对象。
 */
export function createSettingsFace(options = {}) {
  const { t } = options;
  const report = typeof options.onError === 'function' ? options.onError : () => {};

  /** 当前 scope（可被 attachScope 替换）。 */
  let scope = options.scope;
  let unsubscribe;
  /**
   * 配置变化回调：由调用方（client.js）注入，用来把最新配置写成样式表。
   *
   * 之所以要这个回调而不是让 face 自己写样式：face 只该管"设置数据"，
   * 样式注入是 client 的职责（它持有 styleElement）。分开也让 face 可单测。
   */
  const notifyConfigChange = typeof options.onConfigChange === 'function'
    ? options.onConfigChange
    : () => {};

  const initial = readConfig(scope?.getSnapshot?.());

  /** 单一 store：草稿 + 表单状态 + 命名空间可用性。 */
  const store = createSnapshotStore({
    config: { ...initial },
    /** 上次从 scope 同步进来的值，用于判断草稿是否被用户改过。 */
    baseline: { ...initial },
    saving: false,
    failed: false,
    available: scope !== undefined,
    writable: scope?.getSnapshot?.().writable !== false,
  });

  /** scope 变化时：非脏则跟随，脏则保留用户草稿，并**通知外部重渲染样式**。 */
  const syncFromScope = () => {
    try {
      const snapshot = scope?.getSnapshot?.();
      const next = readConfig(snapshot);
      const state = store.getSnapshot();
      const dirty = !sameConfig(state.config, state.baseline);
      store.update((draft) => {
        draft.baseline = { ...next };
        draft.available = snapshot !== undefined && snapshot.status !== 'unavailable';
        draft.writable = snapshot?.writable !== false;
        // 用户正在改的时候不要覆盖他的草稿。
        if (!dirty) draft.config = { ...next };
      });
      // ⚠️ 必须把最新草稿交回给调用方去**重渲染样式表**。
      // 曾经的教训：拆开"注册卡片"与"绑定 scope"之后，这里只更新了 store，
      // 没人再调 renderFromConfig —— 结果改配置界面不动，测试立刻抓到了。
      notifyConfigChange(store.getSnapshot().config);
    } catch (error) {
      report('face:sync', error);
    }
  };

  /** 订阅当前 scope（先退订旧的）。 */
  const bindScopeSubscriptions = () => {
    try {
      unsubscribe?.();
    } catch { /* 忽略 */ }
    unsubscribe = undefined;
    try {
      if (typeof scope?.subscribe === 'function') unsubscribe = scope.subscribe(syncFromScope);
    } catch (error) {
      report('face:subscribe', error);
    }
    syncFromScope();
  };

  if (scope !== undefined) bindScopeSubscriptions();

  const face = {
    /**
     * 接上（或替换）settings scope。晚到也能用：卡片早已注册。
     *
     * @param nextScope configForms 的命名空间 scope。
     */
    attachScope: (nextScope) => {
      scope = nextScope;
      try {
        store.update((state) => {
          state.available = nextScope !== undefined;
          state.writable = nextScope?.getSnapshot?.().writable !== false;
        });
      } catch (error) {
        report('face:attach', error);
      }
      bindScopeSubscriptions();
    },
    /** 断开 scope（命名空间下线）。 */
    detachScope: () => {
      try {
        unsubscribe?.();
      } catch { /* 忽略 */ }
      unsubscribe = undefined;
      scope = undefined;
      try {
        store.update((state) => {
          state.available = false;
          state.writable = false;
        });
      } catch (error) {
        report('face:detach', error);
      }
    },
    /**
     * 组件订阅完整快照。
     *
     * ⚠️ 这是 hook：只能在组件顶层无条件调用（Rules of Hooks）。
     */
    useDraft: (selector) => {
      const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
      return selector(snapshot);
    },
    t,
    buildCss: draftCss,
    /** 组件写入草稿。 */
    setDraft: (updater) => {
      try {
        store.update((state) => {
          const next = typeof updater === 'function' ? updater(state.config) : updater;
          state.config = { ...next };
          state.failed = false;
        });
      } catch (error) {
        report('face:set-draft', error);
      }
    },
    /** 保存：把草稿写回命名空间。 */
    save: async () => {
      const before = store.getSnapshot();
      if (before.saving) return;
      if (sameConfig(before.config, before.baseline)) return;
      // scope 还没到 / 不可写：标记失败而不是抛错（卡片是无条件注册的，
      // 命名空间可能永远不到，这条路径必须能安全走过）。
      if (scope === undefined || typeof scope.set !== 'function' || before.writable === false) {
        store.update((state) => {
          state.failed = true;
        });
        return;
      }

      store.update((state) => {
        state.saving = true;
        state.failed = false;
      });

      try {
        // 逐字段写入：settings 的写入契约是单字段的。
        const draft = store.getSnapshot().config;
        const results = await Promise.all([
          scope.set('enabled', draft.enabled),
          scope.set('preset', draft.preset),
          scope.set('colorText', draft.colorText === true),
          scope.set('colors', draft.colors),
        ]);
        store.update((state) => {
          if (results.some((ok) => ok === false)) {
            state.failed = true;
          } else {
            // 保存成功：把当前草稿当作新的基线。
            state.baseline = { ...state.config };
          }
        });
      } catch (error) {
        report('face:save', error);
        store.update((state) => {
          state.failed = true;
        });
      } finally {
        store.update((state) => {
          state.saving = false;
        });
      }
    },
    /** 放弃：回到基线值。 */
    discard: () => {
      store.update((state) => {
        state.config = { ...state.baseline };
        state.failed = false;
      });
    },
    /** SettingsForm 需要的状态（由 store 快照派生）。 */
    formState: (snapshot) => ({
      available: snapshot.available,
      writable: snapshot.writable,
      dirty: !sameConfig(snapshot.config, snapshot.baseline),
      invalid: false,
      saving: snapshot.saving,
      failed: snapshot.failed,
    }),
    dispose: () => {
      try {
        unsubscribe?.();
      } catch {
        // 忽略。
      }
    },
  };

  return face;
}

export { ALL_CATEGORIES };
