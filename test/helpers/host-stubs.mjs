// 测试期 ESM resolve 钩子（host-stubs）。
//
// 为什么存在：
//   src/settings-face.js 顶层静态 import 了两个「宿主 seed 模块」——
//     import { useSyncExternalStore } from 'react';
//     import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
//   这两个模块在运行时由 DSH 宿主在浏览器 boot 时注入，本仓库（以及 node 测试环境）
//   没有、也不该有它们的真实依赖。readConfig() 是纯函数，运行时不触达这两个符号，
//   只需让模块能成功 import 即可。
//
// 做法：
//   用 node 的 register() 注册本钩子，把上述两个 specifier 重定向到本目录下的桩文件。
//   桩只提供「具名导出」，使 import 成功解析，不执行任何宿主逻辑。
//
// 可移植性（关键）：
//   桩路径一律用 new URL(..., import.meta.url) 相对本文件定位，绝不写仓库外的
//   易失临时目录或任何绝对路径。这样测试随仓库走、跨机器/易失目录都不会失效。
//   旧版本曾把桩放在仓库外的易失临时目录，一旦该目录被清理测试即直接抛错，属定时炸弹。

import { fileURLToPath, pathToFileURL } from 'node:url';

const stubs = {
  'react': fileURLToPath(new URL('./stub-react.mjs', import.meta.url)),
  '@deepseek-ai/dsh-client-store': fileURLToPath(new URL('./stub-store.mjs', import.meta.url)),
  // ── 2026-10-17 扩充：settings-card.js 的顶层依赖 ──
  // 它的 swatchesFor() 也要单测（纯函数），而该模块顶层还 import 了
  // react/jsx-runtime 与 primitives。同样只提供具名导出即可。
  'react/jsx-runtime': fileURLToPath(new URL('./stub-jsx-runtime.mjs', import.meta.url)),
  '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(new URL('./stub-primitives.mjs', import.meta.url)),
};

export async function resolve(specifier, context, next) {
  if (stubs[specifier]) {
    return { url: pathToFileURL(stubs[specifier]).href, shortCircuit: true };
  }
  return next(specifier, context);
}
