# AGENTS.md

> 本文件给 **AI 编码 agent** 看。人类请看 [README.md](./README.md)。
> 规范依据：本机规范文档 `~/Projects/dsh-plugin-standards/docs/AGENT-FACING-STANDARDS.md`
> （**不随本仓库发布**，公开读者可参考 [agents.md](https://agents.md/)）
> （[agents.md](https://agents.md/) 格式）。
>
> 本文件只写**会影响你改对代码**的事。每条结论都有实测依据，不是通用建议。

---

## 1. 验证（改完必须跑这条）

```sh
npm test          # = node src/build-client.mjs && node --test test/*.test.mjs
```

**一条命令覆盖构建 + 全量测试**（当前 179 条）。提交前必须绿。

⚠️ **只跑 `node --test` 不算验证** —— 测试全绿 ≠ 构建能过。
构建期有额外断言（见 §4），曾经出现过"测试全绿、构建直接失败"的情况。
所以：**只要碰了 `src/`，就先跑 `node src/build-client.mjs`**。

其它入口：

```sh
npm run build     # 只构建（含产物守卫）
npm run check     # 只做语法检查（不跑逻辑）
```

## 2. 产物

| 文件 | 是什么 | 提交吗 |
|---|---|---|
| `src/**/*.js` | **源码，只改这里** | ✅ |
| `lib/client.js` | **构建产物**（宿主按文件加载，运行时不构建） | ✅ **必须提交** |
| `src/data/*.js` | 色库数据（742 / 196 条），手改会破坏选色测试 | ✅ |

⚠️ **不要手改 `lib/client.js`**。改 `src/` → `npm run build` → 提交两者。

## 3. 硬性约束（违反后会**静默失效**，不一定报错）

这些是踩过的坑，绝大多数不会给你堆栈：

1. **客户端 bundle 只允许 require seed 表里的 9 个模块**，超出**构建失败**：
   `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、
   `@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、
   `@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。
   ⚠️ **不要放宽 `SEED_MODULES`** 去"修"构建失败 —— 那说明你引入了不该进浏览器的依赖。
   真因通常是某个浏览器侧模块 import 了 Host 侧模块（例如 `@deepseek-ai/schemastery`），
   正确做法是**把它内联**或改成本地纯函数。

2. **每个 `ctx.<service>` 必须在导出的 `inject` 里声明**，否则 `apply` 抛错 →
   cordis fiber `FAILED` → **整个 DSH 白屏**，crash log 只有一行 `<包名>: failed`，没有堆栈。
   需要探测"可能还不存在"的服务时用 `ctx.get('name')`，**不要**把它写进 `inject`。

3. **`apply` 绝不允许把异常抛出去**。每个表面各自守卫，失败只降级 + 记录
   （`console.error` + 写 localStorage）。

4. **模板字符串内部的注释不能出现反引号** —— 会提前闭合字符串，产物语法坏掉，
   真机表现是白屏 + `import failed`，**没有任何堆栈**。
   （普通 `//` 注释里的反引号无害，只有落在模板字符串**内部**的注释才会炸。）

5. **设置项必须注册到 `plugins.bundle.config`**（key = 包名），不是 `settings.section`。
   且 Host 侧 `Config` 必须至少有一个 `.volatile()` 字段 ——
   否则内核 `volatileForm()` 返回 `undefined`，命名空间不被服务，设置页显示
   「该设置命名空间尚未就绪」。**这是静默失效，不报错。**

6. **`ctx.<service>` 的 `as` 语义方向**、`Config` 活引用解包（`{get()}`）、
   pnpm 硬链接脱钩——细节见 skill `dsh-plugin-development`，
   **涉及插件任务第一件事就是加载那个 skill**，不要凭记忆写。

## 4. 禁区（冻结实现，改了会让已验证功能失效）

以下两处是用户明确要求**保留**的（"压缩中上色"真机验证有效）：

- `src/classify.js` 的 **`isRunningCompaction()`** 实现
- `src/dom.js` 的 `CANDIDATE_SELECTOR` 里 **`[data-variant="others"]`**

改它们之前先问用户。相关测试：`test/actions-compaction.test.mjs`（15 条，必须保持绿）。

其它禁区：

- **不要碰 `~/.dsh/profiles/`**（运行时配置，不属于本仓库）
- **不要碰 `node_modules/`**（`file:` 依赖是硬链接快照）

## 5. 本仓库特有的坑（都有实测依据）

### 5.1 测试写得太死会误报

- 断言 CSS 生成结果时，**正则要容忍合理变体**。踩过：`svg\{color:` 把新增的
  `svg:not(...){color:` 误判成"缺 svg 规则"。
- 反过来：**任何"新增的守卫"都要做变异验证**（把实现改坏，确认测试变红），
  否则很容易写出**假绿**。本仓库踩过两次：
  - 删掉 `CANDIDATE_SELECTOR` 里的 `[data-variant="others"]`，14 条测试**全绿**；
  - `applySaturationCaps` 的单测只传了含目标键的 specs，"一刀切"变异**抓不到**。
  → **新测试写完，必须把实现改坏跑一遍**。

### 5.2 浏览器 bundle 里不能拖进 Host 侧模块

测试用 node ESM 会通过符号链接解析依赖，**绕开打包器**，所以测试全绿但构建失败。
真因与修法见 §3.1。

### 5.3 颜色类改动有两条硬断言

`test/unit.test.mjs`：

- 「状态类颜色在三套预设下都必须与内容类互不撞色」
- 「每套预设的两套主题都必须达到对比度下限」（白底/深底 ≥3.0 且 ≤10.5）

加新颜色类别要**四处同步**：`src/constants.js` 的 `CATEGORIES`、
`src/palettes.js` 的颜色、`src/locale.js` 的 `CATEGORY_KEYS`、以及 zh+en 两份文案字典。

### 5.4 已知的既存缺陷（不要"顺手修"，先问）

`macaron` 有 10/26、`japanese` 有 2/26 个类别的浅深色**完全相同**
（换主题即"失明"）。根因是小色库导致 `buildPalette` 降级复用。
该清单已被 `test/settings-card-swatches.test.mjs` **冻结**：出现新条目会变红，
条目被修好也会变红（提醒同步清单）。**要修请先问用户**（涉及预设实际配色）。

### 5.5 真机验证 > 源码推断

内核结构会随版本/状态变化。**要动 DOM 判据之前，本轮重新取一次真机证据**，
不要引用历史取证报告里的结构结论（踩过：上轮报告说"复制按钮在某个插槽内"，
本轮真机实测它在外面，导致第一版改法只修好一半）。

## 6. 提交规范

```sh
git -c user.name="blancatora" -c user.email="blancatora@agent.qq.com" commit \
  -m "fix: ..." \
  -m "Generated-by: blancatora (DeepSeek Harness / deepseek-v4.1-flash)" \
  -m "AI-Disclosure: 本提交由 AI 编码代理生成；可能含未经人工复核的改动。"
```

- 用 `Generated-by:`，**不要**用 `Co-Authored-By:`（那会冒充人类共同作者）。
- 提交信息写清**改了什么、为什么、怎么验证的**；未证实的结论要标注「未证实」。

## 7. 发布前

⚠️ **`git push` / 建远端 / 发 PR、issue 必须先得到用户明确同意**，不要自行推送。

发布流程（GitHub topic、npm 包名、`locale/en.json` 元信息、图标约束）见
`~/.dsh/AGENTS.md` 的「📦 怎么把一个插件发布到 DSH 生态」。

## 8. 目录速览

```
src/            源码（改这里）
  index.js        Host 侧入口（apply/inject 在这里导出）
  config.js       Host 侧设置 schema（⚠️ 必须有 .volatile() 字段）
  classify.js     DOM → 类别判定（含冻结的 isRunningCompaction）
  dom.js          候选元素选择与标记（含冻结的 CANDIDATE_SELECTOR）
  css.js          CSS 生成（作用域规则）
  palettes.js     三套预设色板 + 状态色 + 权限色
  settings-card.js/settings-face.js   设置页 UI
  locale.js      zh/en 文案
  data/          传统色库（742 条中国色 / 196 条命令红）
lib/client.js    构建产物（提交，不手改）
test/            9 个测试文件，npm test 全跑
```
