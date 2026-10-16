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
import { ALL_CATEGORIES, CATEGORIES, CONTROL_CATEGORIES } from './constants.js';
import { presetColorFor, presetColors } from './palettes.js';
import { CATEGORY_KEYS, PRESET_KEYS } from './locale.js';
import { sanitizeColor, scopedPreviewCss } from './css.js';

/** 预设选择顺序。 */
const PRESET_IDS = ['chinese', 'japanese', 'macaron', 'none'];

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
 * 取某个预设下该类别的色板候选。
 *
 * 返回的是「整对」而非单个色：色板里每个颜色都有配套的浅/深值，用户点一下
 * 想要的是"这一套"，不是把同一个色值塞进两边（那会在另一个主题下失明）。
 *
 * @param presetId 预设 id。
 * @param category 类别。
 * @returns `[{ light, dark }]` 列表，本类别自己的一对排在最前。
 */
function swatchesFor(presetId, category) {
  const palette = presetColors(presetId);
  const own = palette[category];
  const seen = new Set();
  const list = [];
  const push = (pair) => {
    if (pair === undefined) return;
    const key = `${pair.light}|${pair.dark}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ light: pair.light, dark: pair.dark });
  };
  push(own);
  for (const pair of Object.values(palette)) push(pair);
  return list.slice(0, 14);
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
      jsx('div', {
        style: {
          gridColumn: '1 / -1',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          alignItems: 'center',
        },
        children: [
          ...swatches.map((pair) => jsx(Swatch, {
            key: `${pair.light}|${pair.dark}`,
            color: pair.dark,
            label: t(CATEGORY_KEYS[category]),
            active: sanitizeColor(color.light) === sanitizeColor(pair.light)
              && sanitizeColor(color.dark) === sanitizeColor(pair.dark),
            onPick: () => onEdit(category, 'pair', pair),
          }, `${pair.light}|${pair.dark}`)),
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
 * 实时预览：用当前 draft 生成同一套 CSS，并渲染几个样例行。
 *
 * 这样"实际渲染预览"是真的走生产样式生成器（`css.js`），不是另画一份 ——
 * 预览与真实效果不可能不一致。
 *
 * @param props.draft 当前草稿。
 * @param props.cssText 由 draft 生成的样式文本。
 * @param props.t 文案函数。
 */
function Preview(props) {
  const { cssText, t } = props;
  const rows = [
    { cat: 'thinking', label: t('categoryThinking') },
    { cat: 'command', label: t('categoryCommand') },
    { cat: 'danger', label: t('categoryDanger') },
    { cat: 'read', label: t('categoryRead') },
  ];
  return jsxs('div', {
    children: [
      // 预览区自带一份样式，且作用域限定在 .cc-preview 内，避免影响页面其他部分。
      jsx('style', { children: scopedPreviewCss(cssText) }),
      jsxs('div', {
        className: 'cc-preview',
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          padding: '8px 10px',
          borderRadius: '8px',
          background: 'var(--dsw-alias-bg-base)',
          border: '1px solid var(--dsw-alias-border-l1)',
        },
        children: rows.map((row) => jsxs('div', {
          // 模拟宿主结构：根元素带类别标记，表头带 [data-disclosure-header]。
          'data-cc-cat': row.cat,
          'data-cc-scope': 'header',
          style: { display: 'flex', flexDirection: 'column' },
          children: [
            jsxs('div', {
              'data-disclosure-header': true,
              style: { display: 'flex', alignItems: 'center', gap: '6px', height: '24px' },
              children: [
                jsx('span', {
                  'data-disclosure-row': true,
                  style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
                  children: [
                    jsx('span', {
                      'aria-hidden': 'true',
                      style: {
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: '1.5px solid currentColor',
                        display: 'inline-block',
                      },
                    }),
                    jsx('span', { children: row.label }),
                  ],
                }),
              ],
            }),
          ],
        }, row.cat)),
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
  const { t, onSave, onDiscard, setDraft, buildCss, formState } = props;
  // 订阅完整快照：草稿与表单状态在同一个 store 里，所以一次订阅拿全。
  const snapshot = props.useDraft((value) => value);
  const draft = snapshot.config;
  const state = formState(snapshot);

  const cssText = useMemo(() => buildCss(draft), [draft, buildCss]);

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

        // ── 染色范围 ──────────────────────────────────────────────
        // 默认「只染图标与短标签」：第一版把整段摘要一起染了，满屏饱和色、
        // 层级全丢（实测被用户判为"丑死了"）。想要更花的人可以在这里开。
        jsxs('div', {
          style: { display: 'flex', alignItems: 'center', gap: '10px' },
          children: [
            jsx(Switch, {
              checked: draft.colorText === true,
              label: t('colorTextLabel'),
              onChange: (checked) => setDraft((current) => ({ ...current, colorText: checked })),
            }),
            jsxs('div', {
              children: [
                jsx('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-primary)' }, children: t('colorTextLabel') }),
                jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }, children: t('colorTextHint') }),
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
              options: PRESET_IDS.map((id) => ({ value: id, label: t(PRESET_KEYS[id]) })),
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

        // ── 界面控件 ──────────────────────────────────────────────
        jsxs('section', {
          children: [
            jsx('h3', { style: { margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: t('controlsTitle') }),
            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginBottom: '4px' }, children: t('controlsHint') }),
            ...CONTROL_CATEGORIES.map((category) => jsx(CategoryRow, { t, category, draft, onEdit: edit }, category)),
          ],
        }),

        // ── 预览 ──────────────────────────────────────────────────
        jsxs('section', {
          children: [
            jsx('h3', { style: { margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: t('previewTitle') }),
            jsx('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', marginBottom: '6px' }, children: t('previewHint') }),
            jsx(Preview, { draft, cssText, t }),
          ],
        }),

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

export { ALL_CATEGORIES, presetColors };
