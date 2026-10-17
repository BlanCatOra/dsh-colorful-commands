// 测试期桩：react 占位。
//
// 为什么存在：
//   仓库里的浏览器侧模块（src/settings-face.js、src/settings-card.js）顶层 import
//   了 react 的 hooks，但本仓库（及 node 测试环境）没有 react 依赖
//   —— react 是 DSH 宿主在浏览器 boot 时注入的 seed 模块。
//   被测的都是**纯函数**（readConfig / swatchesFor），运行时不调用任何 hook，
//   只需让模块成功 import 即可。
//
//   因此这里只提供与真实导出**同名**的具名导出，内容为最小桩。
//   ⚠️ ESM 会静态校验具名导入是否存在 —— 少一个导出就会让整个模块 import 失败，
//      所以凡是仓库源码从 'react' 导入的名字都必须在这里出现。
//   ⚠️ 这些桩**不会**被调用；若将来某个被测函数真的需要 hook 语义，
//      应改用真实的 react 测试环境，而不是往桩里塞假实现。
//
// 本文件由 test/helpers/host-stubs.mjs 的 resolve 钩子重定向载入。

/** src/settings-face.js 使用。 */
export function useSyncExternalStore() { return undefined; }

/** src/settings-card.js 使用（纯函数被测时不触达）。 */
export function useCallback(fn) { return fn; }
export function useMemo(fn) { return fn(); }
export function useState(initial) { return [initial, () => {}]; }
export function useRef(initial) { return { current: initial }; }
export function useEffect() { return undefined; }
export function createContext() { return { Provider: () => null, Consumer: () => null }; }
export function useContext() { return undefined; }
export function memo(component) { return component; }
