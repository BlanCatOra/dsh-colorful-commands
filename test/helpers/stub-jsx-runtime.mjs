// 测试期桩：react/jsx-runtime 占位。
//
// 为什么存在（与 stub-react.mjs 同理）：
//   src/settings-card.js 顶层 `import { jsx, jsxs } from 'react/jsx-runtime'`，
//   而 react 是 DSH 宿主浏览器 boot 时注入的 seed 模块，本仓库没有该依赖。
//   被测的 `swatchesFor()` 是**纯函数**，不会真的渲染任何 JSX ——
//   这里只需让具名导入解析成功。
//
// ⚠️ 若将来要在 node 里**渲染**这些组件，必须改用真实 react + 渲染器，
//    不要靠这个桩（它返回的是描述对象，没有 React 语义）。
//
// 本文件由 test/helpers/host-stubs.mjs 的 resolve 钩子重定向载入。

/** 返回与 React 元素形状相近的最小描述对象（仅供 import 解析，不用于渲染）。 */
function element(type, props, key) {
  return { $$typeof: Symbol.for('react.element'), type, props, key };
}

export function jsx(type, props, key) { return element(type, props, key); }
export function jsxs(type, props, key) { return element(type, props, key); }
export const Fragment = Symbol.for('react.fragment');
