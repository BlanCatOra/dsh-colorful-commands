// 测试期桩：@deepseek-ai/dsh-client-ui-primitives 占位。
//
// 为什么存在（与 stub-react.mjs 同理）：
//   src/settings-card.js 顶层从 primitives 导入了 7 个 UI 组件
//   （Button / Input / SegmentedControl / SettingsForm / Switch / Tag / Tooltip）。
//   primitives 是 DSH 宿主前端 boot 的 **seed 表基座模块**，
//   本仓库（及 node 测试环境）没有该依赖。
//
//   被测的 `swatchesFor()` 是**纯函数**（只算颜色候选列表），不渲染任何组件 ——
//   这里只需让具名导入解析成功。
//
// ⚠️ ESM 会静态校验具名导入：settings-card.js 从 primitives 导入几个名字，
//    这里就必须导出几个，否则整个模块 import 失败。
// ⚠️ 这些桩**不会被调用**。若将来要测组件渲染，请走真实的 DSH 环境
//    （或 test/bundle.test.mjs 那条「经 window.__ModuleLoader__ 装载真实 bundle」的路径），
//    不要往桩里塞假组件。
//
// 本文件由 test/helpers/host-stubs.mjs 的 resolve 钩子重定向载入。

/** 占位组件工厂：真实用例不渲染，只保证具名导出存在。 */
function stub(name) {
  const component = () => null;
  component.displayName = `Stub(${name})`;
  return component;
}

export const Button = stub('Button');
export const Input = stub('Input');
export const SegmentedControl = stub('SegmentedControl');
export const SettingsForm = stub('SettingsForm');
export const Switch = stub('Switch');
export const Tag = stub('Tag');
export const Tooltip = stub('Tooltip');
