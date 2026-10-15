/**
 * dsh-colorful-commands —— Host 侧入口。
 *
 * ## 这个插件为什么几乎没有 Host 逻辑
 *
 * 着色完全发生在浏览器侧（DOM 打标 + 注入样式），Host 侧只负责一件事：
 * **声明设置命名空间**，让 DSH 的设置服务发现它、在「插件详情页」渲染我们的
 * 配置卡片，并把用户的选择持久化到 `$DSH_HOME`。
 *
 * 因此这里刻意不注册 HTTP 路由、不读写文件、不引入运行时依赖 —— 攻击面为零。
 *
 * ## 命名空间契约（最容易写错的一处）
 *
 * 内核实测：settings 服务的命名空间取自 **loader entry id**
 * （`ns: entry.options.id`），即 `cordis.patch.yml` 里那条 `insert.id`，
 * **不是**包名，也不是 `package.json` 的任何字段。
 * 本插件的 patch 用包名作 id，所以 `SETTINGS_NAMESPACE === PLUGIN_ID`。
 * 若改了 patch 的 id，必须同步改 `constants.js`，否则设置卡片永远读到默认值。
 *
 * @module dsh-colorful-commands
 */
import { Config as ConfigSchema } from './config.js';
import { PLUGIN_ID, SETTINGS_NAMESPACE } from './constants.js';

export const name = PLUGIN_ID;

/**
 * 模块级必需依赖为空。
 *
 * 本插件 Host 侧不访问任何服务（配置读取由 DSH 的 settings 服务自己完成），
 * 所以保持空数组 —— 任何写进这里的服务都会变成"缺了它插件就不启动"的硬依赖。
 */
export const inject = [];

/** 导出 Config，settings 服务据此发现并渲染本插件的命名空间。 */
export const Config = ConfigSchema;

/** 供测试与调试使用。 */
export { SETTINGS_NAMESPACE };

/**
 * Host 侧不做任何事。
 *
 * 保留这个函数是必要的：cordis 需要一个可执行的插件体；同时这里刻意保持
 * 空实现 —— Host 侧越少动作，能出错的地方就越少。
 *
 * @param ctx Host 插件上下文（本插件不使用）。
 */
export function apply(ctx) {
  // 有意为空：着色是纯浏览器侧行为，Host 只需声明 schema。
  void ctx;
}
