/**
 * dsh-colorful-commands —— 「插件详情页」里的设置卡片。
 *
 * ## 位置契约
 *
 * 注册到 **`plugins.item`**（插件详情页的配置卡片），不是 `settings.section`。
 * 权威原句（`dsh-client-ui-plugin-manager/README.zh.md`）：
 * 「注册了配置页的插件在这里、在它自己的页面上编辑；设置里只保留只读的插件列表。」
 * 用户路径：侧栏「插件」→ 找到本插件 → 在里面配色。
 *
 * ## UI 组件来源
 *
 * 除**颜色选择器**外，全部控件来自 `@deepseek-ai/dsh-client-ui-primitives`
 * （Switch / Button / SegmentedControl / Input / SettingsForm / Tooltip / Tag）。
 *
 * 颜色选择器是唯一的自写控件：primitives 没有颜色选择器，而"颜色预览 + 实际
 * 渲染预览 + 色号"这个组合无法用现有导出拼出来。规范允许「需求确实特殊时在
 * 自己的包里写自己的组件」，前提是**不复制已有控件** —— 这里没有复制任何东西：
 * 色板格子是原生 button，取色用原生 `<input type="color">`，色号输入用 primitives
 * 的 `Input`。
 *
 * ## 草稿语义
 *
 * 所有改动先落在本地 draft，点「保存」才写回 Host（与官方 SettingsForm 契约一致：
 * 「只在按钮点击时保存，卸载即丢弃」）。这样用户调色过程中不会每动一下就写盘。
 *
 * @module dsh-colorful-commands/settings-card
 */
import { useCallback, useMemo, useState } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import {
  Button,
  Input,
  SegmentedControl,
  SettingsForm,
  Switch,
  Tag,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives';
import {
  ALL_CATEGORIES,
  CATEGORIES,
  CONTROL_CATEGORIES,
  PERMISSION_CATEGORIES,
  PRESETS,
} from './constants.js';
import { presetColorFor, presetColors } from './palettes.js';
import { CATEGORY_KEYS, PRESET_KEYS } from './locale.js';
import { sanitizeColor } from './css.js';

/** 预设选择顺序。 */
/**
 * 每个类别在当前 draft 下的有效颜色。
 *
 * @param draft 草稿配置。
 * @param category 类别 id。
 * @returns `{ light, dark }`，可能含空串（表示未设置）。
 */
function effectiveColor(draft, category) {
  const custom = draft.colors?.[category];
  if (custom !== undefined) {
    return { light: custom.light ?? '', dark: custom.dark ?? '' };
  }
  const fromPreset = draft.preset === 'none' ? undefined : presetColorFor(draft.preset, category);
  return fromPreset ?? { light: '', dark: '' };
}

/**
 * 色板每行放几个格子（26 个候选 → 2 行 × 13）。
 *
 * 用户 2026-10-17：「这个预设颜色可以多一点 两行吧 数量比现在多一倍
 * 依旧从传统色中选择适合的 不要太鲜艳」。
 */
export const SWATCH_COLUMNS = 13;

/**
 * 取某个预设下该类别的色板候选。
 *
 * 返回的是「整对」而非单个色：色板里每个颜色都有配套的浅/深值，用户点一下
 * 想要的是"这一套"，不是把同一个色值塞进两边（那会在另一个主题下失明）。
 *
 * ## 数量：14 → 26（2026-10-17 修正）
 *
 * 旧实现结尾是 `list.slice(0, 14)` —— **硬砍一半**。实测：
 *
 * ```
 * presetColors('chinese'|'japanese'|'macaron') 键数 = 26（三套预设都一样）
 * ALL_CATEGORIES 数量 = 26
 * ALL_CATEGORIES 里不在 palette 的 = （无，完全覆盖）
 * ```
 *
 * 即 `palette` 本来就是**全部 26 个类别色**（含状态类与权限类），
 * `slice(0, 14)` 才是真限制。去掉它 → **26 个 = 2 行 × 13**，
 * 同时满足用户「多一倍」（14→26 ≈ 1.86×）与「两行」两个要求。
 *
 * ## ⚠️ 为什么不去凑满 28（实测过，不可靠）
 *
 * 用户说的是"多一倍"（14×2=28）。Lead 试过用 `buildPalette` 另挑 5 个传统色补到 28，
 * **实测失败**：`japanese`（58 色）与 `macaron`（34 色）色库太小，
 * 挑出来的色对出现 `light === dark`（同一色值塞两边 → 换主题就失明）
 * 或与已有色撞车。这与 `palettes.js` 里状态类改固定色的原因是同一个
 * （见 `STATUS_COLORS` 的说明）。
 *
 * → 结论：**26 是"零新增色、零风险"能给出的最大整齐值**（且刚好两行）。
 *   26 已覆盖全部 26 个类别，语义上也最完整：色板 = "所有类别的颜色任选"。
 *
 * ## 关于「重复色」
 *
 * 26 个键里有 3 组是**权限类刻意复用内容类**的色值（如 `perm-auto` 与 `thinking`
 * 同色 —— 见 `PERMISSION_SEMANTICS`）。所以格子里会有 3 对**看起来一样**的色块。
 * 这是真实情况（那些类别的颜色本来就相同），**不做跨类别去重** ——
 * 去重会让数量掉到 23，既凑不出整齐的两行，也不再等于"全部类别"。
 *
 * ⚠️ 候选值全部来自**既有预设**（传统色），因此：
 * - 天然满足「从传统色中选择适合的、不要太鲜艳」；
 * - **不可能引入新撞色**（值本来就在调色板里，撞色断言必然仍绿）。
 *
 * 顺序：**本类别自己那一对排在最前**（保持既有行为，用户点第一格即"回到本类语义色"），
 * 其余按 `palette` 的键序。
 *
 * @param presetId 预设 id。
 * @param category 类别。
 * @returns `[{ light, dark }]` 列表，长度 == `presetColors(presetId)` 的键数（26）。
 */
export function swatchesFor(presetId, category) {
  const palette = presetColors(presetId);
  const list = [];

  // 本类别自己的一对排最前（用户点第一格 = 回到本类语义色）。
  const own = palette[category];
  if (own !== undefined) list.push({ light: own.light, dark: own.dark });

  // 其余类别按键序追加；跳过自己（已在最前），**不按色值去重**（见上方说明）。
  for (const [key, pair] of Object.entries(palette)) {
    if (key === category) continue;
    if (pair === undefined) continue;
    list.push({ light: pair.light, dark: pair.dark });
  }
  return list;
}

/**
 * 单个颜色格子。
 *
 * 原生 button + 内联背景色；不引入任何自写"下拉/弹窗"。
 */
function Swatch(props) {
  const { color, active, label, onPick } = props;
  return jsx(Tooltip, {
    label: color,
    children: jsxs('button', {
      type: 'button',
      'aria-label': `${label}: ${color}`,
      'aria-pressed': active ? 'true' : 'false',
      onClick: () => onPick(color),
      style: {
        width: '20px',
        height: '20px',
        padding: 0,
        borderRadius: '6px',
        cursor: 'pointer',
        background: color,
        border: active ? '2px solid var(--dsw-alias-label-primary)' : '1px solid var(--dsw-alias-border-l2)',
        flex: 'none',
      },
    }),
  });
}

/**
 * 一个类别的一行：类别名 + 浅色 + 深色两组控件。
 *
 * 每组控件 = 当前色预览 + 原生取色器 + 色号输入 + 色板格子。
 */
function CategoryRow(props) {
  const { t, category, draft, onEdit } = props;
  const color = effectiveColor(draft, category);
  const swatches = useMemo(
    () => swatchesFor(draft.preset === 'none' ? 'chinese' : draft.preset, category),
    [draft.preset, category],
  );

  const field = (mode) => {
    const value = color[mode];
    const valid = value === '' || sanitizeColor(value) !== null;
    return jsxs('div', {
      style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 },
      children: [
        // 当前色预览：始终显示"实际会被用上的颜色"。
        jsx('span', {
          'aria-hidden': 'true',
          style: {
            width: '18px',
            height: '18px',
            borderRadius: '5px',
            flex: 'none',
            background: sanitizeColor(value) ?? 'transparent',
            border: '1px solid var(--dsw-alias-border-l2)',
            backgroundImage: sanitizeColor(value) === null
              ? 'linear-gradient(45deg, var(--dsw-alias-border-l1) 25%, transparent 25%, transparent 75%, var(--dsw-alias-border-l1) 75%)'
              : 'none',
            backgroundSize: '6px 6px',
          },
        }),
        // 原生取色器：系统级体验，无需自写色轮。
        jsx('input', {
          type: 'color',
          'aria-label': `${t(CATEGORY_KEYS[category])} ${mode === 'light' ? t('columnLight') : t('columnDark')}`,
          value: sanitizeColor(value) ?? '#000000',
          onChange: (event) => onEdit(category, mode, event.target.value),
          style: {
            width: '28px',
            height: '22px',
            padding: 0,
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: '6px',
            background: 'transparent',
            cursor: 'pointer',
            flex: 'none',
          },
        }),
        jsx(Input, {
          value,
          spellCheck: false,
          'aria-invalid': valid ? undefined : 'true',
          'aria-label': `${t(CATEGORY_KEYS[category])} ${t('hexLabel')}`,
          onChange: (event) => onEdit(category, mode, event.target.value),
          style: { width: '104px' },
        }),
      ],
    });
  };

  return jsxs('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 2fr)',
      gap: '8px 12px',
      alignItems: 'center',
      padding: '8px 0',
      borderTop: '1px solid var(--dsw-alias-border-l1)',
    },
    children: [
      jsxs('div', {
        style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 },
        children: [
          jsx('span', {
            style: {
              fontSize: '13px',
              color: 'var(--dsw-alias-label-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
            children: t(CATEGORY_KEYS[category]),
          }),
          color.light === '' && color.dark === ''
            ? jsx(Tag, { children: '—' })
            : null,
        ],
      }),
      jsxs('div', {
        style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px' },
        children: [
          jsxs('div', {
            style: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
            children: [
              jsx('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('columnLight') }),
              field('light'),
            ],
          }),
          jsxs('div', {
            style: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
            children: [
              jsx('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('columnDark') }),
              field('dark'),
            ],
          }),
        ],
      }),
      // ── 色板：固定 **两行**（用户 2026-10-17：「两行吧」）──────────────
      //
      // 旧实现用 `flexWrap: 'wrap'` 让浏览器自行折行 —— 折成几行取决于容器宽度，
      // 用户在窄侧栏里可能看到 3~4 行、宽屏上看到 1 行，不稳定。
      // 现在用 grid 固定列数，26 个候选 = 2 行 × 13。
      //
      // ⚠️ 「恢复预设值」按钮**不放进 grid**（否则会被当成一个格子挤进去）。
      //    把它放在色板右侧，用 flex 包一层。
      jsxs('div', {
        style: {
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        },
        children: [
          jsx('div', {
            style: {
              display: 'grid',
              gridTemplateColumns: `repeat(${SWATCH_COLUMNS}, 20px)`,
              gap: '4px',
            },
            children: swatches.map((pair) => jsx(Swatch, {
              key: `${pair.light}|${pair.dark}`,
              color: pair.dark,
              label: t(CATEGORY_KEYS[category]),
              active: sanitizeColor(color.light) === sanitizeColor(pair.light)
                && sanitizeColor(color.dark) === sanitizeColor(pair.dark),
              onPick: () => onEdit(category, 'pair', pair),
            }, `${pair.light}|${pair.dark}`)),
          }),
          jsx(Button, {
            variant: 'ghost',
            size: 'sm',
            onClick: () => onEdit(category, 'reset', ''),
            children: t('resetOne'),
          }),
        ],
      }),
    ],
  });
}



/**
 * 设置卡片本体。
 *
 * props 由插槽的 `inject` 面提供（见 `settings-card-face`）。
 */
export function ColorfulCommandsCard(props) {
  // ⚠️ `buildCss` 仍留在插槽 inject 面里（其它地方/测试按契约使用），
  //    但本卡片**不再消费它** —— 原先只有已删除的预览区块需要它。
  const { t, onSave, onDiscard, setDraft, formState } = props;
  // 订阅完整快照：草稿与表单状态在同一个 store 里，所以一次订阅拿全。
  const snapshot = props.useDraft((value) => value);
  const draft = snapshot.config;
  const state = formState(snapshot);

  const edit = useCallback((category, mode, value) => {
    setDraft((current) => {
      const next = { ...current, colors: { ...current.colors } };
      if (mode === 'reset') {
        // 恢复预设值 = 删掉覆盖项，让预设重新生效。
        delete next.colors[category];
        return next;
      }
      if (mode === 'pair') {
        // 色板点选：写入配套的浅/深一对。
        next.colors[category] = { light: value.light, dark: value.dark };
        return next;
      }
      // 单边编辑（取色器或色号输入）：只改一边，另一边保留当前有效值。
      const existing = next.colors[category] ?? effectiveColor(current, category);
      next.colors[category] = { ...existing, [mode]: value };
      return next;
    });
  }, [setDraft]);

  const resetAll = useCallback(() => {
    setDraft((current) => ({ ...current, colors: {} }));
  }, [setDraft]);

  if (props.view === 'summary') return t('cardDescription');

  return jsx(SettingsForm, {
    labels: {
      save: t('save'),
      saving: t('save'),
      saveFailed: t('saveFailed'),
      unavailable: t('unavailable'),
      readOnly: t('readOnlyNotice'),
    },
    state,
    onSave,
    onDiscard,
    children: jsxs('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '16px' },
      children: [
        jsxs('p', {
          style: { margin: 0, fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' },
          children: t('cardDescription'),
        }),

        // ── 总开关 ────────────────────────────────────────────────
        jsxs('div', {
          style: { display: 'flex', alignItems: 'center', gap: '10px' },
          children: [
            jsx(Switch, {
              checked: draft.enabled,
              label: t('masterLabel'),
              onChange: (checked) => setDraft((current) => ({ ...current, enabled: checked })),
            }),
            jsxs('div', {
              children: [
                jsx('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-primary)' }, children: t('masterLabel') }),
                jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('masterHint') }),
              ],
            }),
          ],
        }),

        // ── 预设 ──────────────────────────────────────────────────
        jsxs('div', {
          style: { display: 'flex', flexDirection: 'column', gap: '6px' },
          children: [
            jsx('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-primary)' }, children: t('presetLabel') }),
            jsx(SegmentedControl, {
              id: 'cc-preset',
              label: t('presetLabel'),
              value: draft.preset,
              // 顺序取自 constants.js 的 PRESETS（单一真源），不在这里另抄一份。
              options: PRESETS.map((id) => ({ value: id, label: t(PRESET_KEYS[id]) })),
              onChange: (value) => setDraft((current) => ({ ...current, preset: value, colors: {} })),
            }),
            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('presetHint') }),
          ],
        }),

        // ── 分类配色 ──────────────────────────────────────────────
        jsxs('section', {
          children: [
            jsx('h3', { style: { margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: t('categoriesTitle') }),
            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginBottom: '4px' }, children: t('categoriesHint') }),
            ...CATEGORIES.map((category) => jsx(CategoryRow, { t, category, draft, onEdit: edit }, category)),
          ],
        }),

        // ── 权限等级 ──────────────────────────────────────────────
        jsxs('section', {
          children: [
            jsx('h3', { style: { margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: t('permissionsTitle') }),
            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginBottom: '4px' }, children: t('permissionsHint') }),
            ...PERMISSION_CATEGORIES.map((category) => jsx(CategoryRow, { t, category, draft, onEdit: edit }, category)),
          ],
        }),

        // ── 界面控件 ──────────────────────────────────────────────
        jsxs('section', {
          children: [
            jsx('h3', { style: { margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: t('controlsTitle') }),
            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginBottom: '4px' }, children: t('controlsHint') }),
            ...CONTROL_CATEGORIES.map((category) => jsx(CategoryRow, { t, category, draft, onEdit: edit }, category)),
          ],
        }),

        // ── 预览区块已删除（用户 2026-10-17：「设置里的这个预览删掉 有bug 懒得修」）
        //    原先这里渲染一个 <Preview>：它用 scopedPreviewCss() 把生产样式
        //    加 .cc-preview 前缀后局部渲染几行样例行。删除原因：该区块有 bug，
        //    用户明确表示不修、直接去掉。随之清理：
        //      · Preview 组件本体
        //      · css.js 的 scopedPreviewCss()（仅此处使用）
        //      · locale 的 previewTitle / previewHint
        //    ⚠️ 不要再加回来 —— 若将来要做预览，请重新评估实现（别再复用这段）。

        jsxs('div', {
          style: { display: 'flex', gap: '8px', alignItems: 'center' },
          children: [
            jsx(Button, { variant: 'outline', size: 'sm', onClick: resetAll, children: t('resetAll') }),
            jsx('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('categoriesHint') }),
          ],
        }),
      ],
    }),
  });
}

export { ALL_CATEGORIES, PERMISSION_CATEGORIES, presetColors };
