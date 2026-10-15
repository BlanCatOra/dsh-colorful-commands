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
  return buildStylesheet(colors, { enabled });
}

/**
 * 创建一个设置卡片面。
 *
 * @param options.scope configForms scope（可能 undefined：命名空间尚未就绪）。
 * @param options.t 文案函数。
 * @param options.onError 失败回调（收集进启动报告）。
 * @returns face 对象，作为插槽 `inject` 的返回值。
 */
export function createSettingsFace(options = {}) {
  const { scope, t } = options;
  const report = typeof options.onError === 'function' ? options.onError : () => {};

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

  /** scope 变化时：非脏则跟随，脏则保留用户草稿。 */
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
    } catch (error) {
      report('face:sync', error);
    }
  };

  let unsubscribe;
  try {
    if (typeof scope?.subscribe === 'function') unsubscribe = scope.subscribe(syncFromScope);
  } catch (error) {
    report('face:subscribe', error);
  }

  const face = {
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
      if (before.writable === false) {
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
