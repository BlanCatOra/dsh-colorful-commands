/**
 * dsh-colorful-commands —— 启动自检与失败留痕。
 *
 * ## 为什么需要这一层
 *
 * DSH 的 web boot 把**每个客户端插件**的 cordis fiber 都当成必须 ACTIVE 的
 * 条目；`apply` 里冒出来的任何异常都会把该 fiber 置为 FAILED，于是整页启动
 * 直接抛 `web boot: N entry did not activate` 而**白屏**。
 * 用户能看到的只有 `dsh-colorful-commands: failed` 这一行 —— 没有堆栈、
 * 没有出错位置（cordis 把它交给了渲染进程 logger，而它不落盘）。
 *
 * 所以本模块做两件事：
 *  1. 提供一个「绝不抛错」的步骤包装，让单个表面的接线失败不拖垮整页；
 *  2. 把失败步骤、消息、堆栈写进 `localStorage` —— 渲染进程里**唯一**事后
 *     能从磁盘读回来的地方（`~/.config/@deepseek-ai/dsh-desktop` 下的
 *     Local Storage leveldb 是可读的纯文本），并 `console.error` 一份。
 *
 * 读取：`~/.dsh/bin/dsh-boot-report --key cc`（本插件注册的别名）。
 *
 * @module dsh-colorful-commands/boot-diagnostics
 */
import { PLUGIN_ID } from './constants.js';

/** 留痕键。`dsh-boot-report` 的 `--list-keys` 会列出它。 */
export const BOOT_REPORT_KEY = 'dsh.colorful-commands.boot';

/**
 * 取一个可用的 Web Storage；取不到返回 undefined。
 *
 * 把存储当**不可信输入**：无痕模式、被策略禁用、Node 里没有该全局、
 * 访问 `length` 就抛 SecurityError —— 全部按「没有存储」处理。
 *
 * @param kind 全局名。
 * @returns 可用的 storage，或 undefined。
 */
export function safeStorage(kind) {
  try {
    const store = globalThis[kind];
    if (store === undefined || store === null) return undefined;
    // 读一次属性：被禁用时异常就抛在这里，而不是抛在后面的 setItem 里。
    void store.length;
    return store;
  } catch {
    return undefined;
  }
}

/** 把附加上下文收敛成短字符串：优先 JSON，退化到 String，最后截断。 */
function stringifyExtra(extra) {
  if (extra === undefined) return undefined;
  if (typeof extra === 'string') return extra.slice(0, 500);
  try {
    const json = JSON.stringify(extra);
    if (typeof json === 'string') return json.slice(0, 500);
  } catch {
    // 循环引用之类：退到 String。
  }
  return String(extra).slice(0, 500);
}

/** 把一次失败收敛成可 JSON 化的记录（消息与堆栈都可能缺失或非字符串）。 */
function describe(where, error, extra) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && typeof error.stack === 'string' ? error.stack : '';
  const detail = stringifyExtra(extra);
  return {
    where: String(where),
    message,
    // 截断：localStorage 有配额，且要的只是前几帧。
    stack: stack.slice(0, 4000),
    ...(detail === undefined ? {} : { extra: detail }),
  };
}

/**
 * 写一份启动报告。**任何一步失败都只吞掉，绝不外抛。**
 *
 * @param failures 本次启动累积的失败记录（空数组表示全部步骤成功）。
 * @param context 额外环境信息（版本号之类），可选。
 * @returns 写进去的报告对象（便于测试断言）。
 */
export function writeBootReport(failures, context) {
  const report = {
    at: new Date().toISOString(),
    plugin: PLUGIN_ID,
    ok: failures.length === 0,
    ...(context === undefined ? {} : { context: stringifyExtra(context) }),
    failures: failures.map((item) => ({ ...item })),
  };
  try {
    const store = safeStorage('localStorage');
    if (store !== undefined) store.setItem(BOOT_REPORT_KEY, JSON.stringify(report));
  } catch {
    // 存储不可用/超配额：报告写不进去也不该影响插件运行。
  }
  return report;
}

/**
 * 创建一个失败收集器。
 *
 * 用法：`const failures = createFailures(); guard(failures, 'where', fn)`。
 * 调用方在 `apply` 末尾调 `writeBootReport(failures, ...)`。
 *
 * @returns 失败记录数组。
 */
export function createFailures() {
  return [];
}

/**
 * 执行一个步骤，失败只记录、绝不外抛。
 *
 * @param failures `createFailures()` 的返回值。
 * @param where 步骤标识（写进报告，便于定位）。
 * @param run 实际动作。
 * @param onError 可选的降级回调；它自己抛错也会被吞掉并记录。
 * @returns `run` 的返回值；失败时为 undefined。
 */
export function guard(failures, where, run, onError) {
  try {
    return run();
  } catch (error) {
    const record = describe(where, error);
    failures.push(record);
    try {
      console.error(`[${PLUGIN_ID}] ${where} failed:`, error);
    } catch {
      // console 被劫持也不该让插件挂掉。
    }
    if (onError === undefined) return undefined;
    try {
      return onError(error);
    } catch (nested) {
      failures.push(describe(`${where}:fallback`, nested));
      return undefined;
    }
  }
}
