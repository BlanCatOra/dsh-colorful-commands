// 测试期桩：react 占位。
//
// 为什么存在：
//   src/settings-face.js 顶层 import 了 react 的 useSyncExternalStore，但本仓库（及 node
//   测试环境）没有 react 依赖——react 是 DSH 宿主在浏览器 boot 时注入的 seed 模块。
//   readConfig() 运行时不调用 react 的任何符号，只需让模块成功 import 即可。
//   因此这里只提供与真实导出同名的具名导出，内容为最小桩。
//   本文件由 test/helpers/host-stubs.mjs 的 resolve 钩子按需重定向载入。

export function useSyncExternalStore() { return undefined; }
