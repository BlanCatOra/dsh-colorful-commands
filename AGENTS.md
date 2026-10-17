# AGENTS.md

> 本文件给 **AI 编码 agent** 看。人类请看 [README.md](./README.md)。
> 格式遵循 [agents.md](https://agents.md/)。
>
> 这里只写**会影响你改对代码**的事，每条都有实测依据，不是通用建议。

---

## 0. 本仓库在多插件工作区里的位置

本机有一个多插件工作区 `~/Projects/dsh-plugin`，**本仓库以软链形式挂在里面**：

| 位置 | 是什么 |
|---|---|
| `~/Projects/dsh-colorful-commands` | **真身** —— git 仓库在这里，所有改动都落在这里 |
| `~/Projects/dsh-plugin/plugins/dsh-colorful-commands` | **软链** → 指向真身 |

⚠️ 三条要点：

1. **软链是单向的**：改真身，软链跟着变；反过来如果有人在软链路径下新建 git 仓库/提交，
   会出现"两份历史"，非常难收拾。**永远在真身路径下操作 git**。
2. 有些会话的默认 cwd 是 `~/Projects/dsh-plugin`（工作区根），**不代表仓库搬走了** ——
   源码真身仍在 `~/Projects/dsh-colorful-commands`。
3. 跑构建/测试前先 `pwd` 确认路径。在软链目录里跑 `npm run build` 本身没问题（真身会被更新），
   但如果你在别处又 `cp` 了一份 `lib/client.js`，就会出现"两份产物不同步"的假故障。

## 1. 验证（改完必须跑这条）

```sh
npm test     # = node src/build-client.mjs && node --test test/*.test.mjs
```

一条命令覆盖**构建 + 全量测试**（当前 192 条）。提交前必须绿。

⚠️ **只跑 `node --test` 不算验证** —— 测试全绿 ≠ 构建能过。
构建期有额外断言（见 §3），历史上出现过"测试全绿、构建直接失败"。
所以：**只要碰了 `src/`，就先跑一次 `node src/build-client.mjs`**。

其它入口：

```sh
npm run build    # 只构建（含产物守卫）
npm run check    # 只做语法检查
```

**改配色 / 改分类逻辑后**，除了跑测试，还应发一次
[`docs/DEMO-PROMPT.md`](./docs/DEMO-PROMPT.md) 里的 prompt 做真机回归 ——
它会一次点亮全部类别，能立刻看出「命令三档是否还是三级红」「混合活动是否还是靛蓝」
「尾部复制/点赞是否还是灰的」这类**测试抓不到的视觉回归**。

## 2. 产物

| 文件 | 是什么 | 提交吗 |
|---|---|---|
| `src/**/*.js` | **源码，只改这里** | ✅ |
| `lib/client.js` | **构建产物**（宿主按文件加载，运行时不构建） | ✅ **必须提交** |
| `src/data/*.js` | 色库数据（742 / 196 条），手改会破坏选色测试 | ✅ |

⚠️ **不要手改 `lib/client.js`**。改 `src/` → `npm run build` → 提交两者。

## 3. 硬性约束（违反后会**静默失效**，不一定报错）

1. **客户端 bundle 只允许 require seed 表里的 9 个模块**，超出**构建失败**：
   `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、
   `@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、
   `@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。
   ⚠️ **不要放宽 `SEED_MODULES` 去"修"构建失败** —— 那说明你引入了不该进浏览器的依赖。
   真因通常是浏览器侧模块 import 了宿主侧模块（例如 `@deepseek-ai/schemastery`），
   正确做法是**把它内联**或改成本地纯函数。

2. **每个 `ctx.<service>` 必须在导出的 `inject` 里声明**，否则 `apply` 抛错 →
   cordis fiber `FAILED` → **整个界面白屏**，日志只有一行 `<包名>: failed`，没有堆栈。
   需要探测"可能还不存在"的服务时用 `ctx.get('name')`，**不要**把它写进 `inject`。

3. **`apply` 绝不允许把异常抛出去**。每个表面各自守卫，失败只降级 + 记录
   （`console.error` + 写 localStorage）。

4. **模板字符串内部的注释不能出现反引号** —— 会提前闭合字符串，产物语法坏掉，
   真机表现是白屏 + `import failed`，**没有任何堆栈**。
   （普通 `//` 注释里的反引号无害，只有落在模板字符串**内部**的注释才会炸。）

5. **设置项必须注册到 `plugins.bundle.config`**（key = 包名），不是 `settings.section`。
   且宿主侧 `Config` 必须至少有一个 `.volatile()` 字段 ——
   否则内核 `volatileForm()` 返回 `undefined`，命名空间不被服务，设置页显示
   「该设置命名空间尚未就绪」。**这是静默失效，不报错。**

6. **`package.json` 的 `dsh.client.immediately` 必须是 `true`** ——
   第三方客户端 bundle 是惰性加载的，不声明会在建 entry 之前赶不上预取，
   偶发 `import failed` → 整站白屏，而插件自己的启动报告可能还是 `ok: true`。

### 3.5 DSH 版本判定：`engines.dsh` 的取值规则

插件清单里的 `engines.dsh` 由内核 `@deepseek-ai/dsh-app-boot` 判定（源码已核对）：

```js
if (Object.hasOwn(engines, "dsh")) {
  return satisfies(runtimeVersion, range) ? {} : { "engines.dsh": range }   // 声明了就只看它
}
// 否则只检查以 @deepseek-ai/dsh 或 @deepseek-ai/dsh-* 开头的 peer
```

两条关键语义：

1. **声明了 `engines.dsh` → 独占判定，`peerDependencies` 被完全忽略。**
2. **没声明 → 只检查 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 开头的 peer。**
   本插件的 peer 是 `@deepseek-ai/cordis` 与 `@deepseek-ai/schemastery`，**都不匹配**，
   所以不声明时的判定结果是「无版本要求」= 任何 DSH 版本都放行。

### 当前取值：`>=0.2.0-0`（2026-10-18 定）

用内核同款 semver（7.8.5，`includePrerelease: true`）实测：

| manifest | DSH 0.2.1-rc.2 | 0.2.1-alpha.2 | 0.2.0 | 0.2.0-rc.2 | 0.1.7-rc.2 |
|---|---|---|---|---|---|
| 不声明 | 通过 | 通过 | 通过 | 通过 | 通过 |
| **`>=0.2.0-0`（当前）** | **通过** | **通过** | **通过** | **通过** | **拒绝** |
| `>=0.2.1-rc.1` | 通过 | 拒绝 | 拒绝 | 拒绝 | 拒绝 |
| `>=0.2.0` | 通过 | 通过 | 通过 | **拒绝** | 拒绝 |

选 `>=0.2.0-0` 的理由：**表达支持下限（不承诺 0.1.x），同时不误伤 alpha.2 及之后的所有版本。**

⚠️ 为什么是 `-0` 后缀而不是 `>=0.2.0`：按 semver 规则，`>=0.2.0` **不包含**
`0.2.0-rc.1` / `0.2.0-rc.2` 这类 0.2.0 的预发布版。加 `-0` 下限后 `0.2.0-*` 全部放行，
只拒绝 0.1.x 及更早 —— 这才是"表达下限、不误伤"的准确写法。

⚠️ 改这个范围是**破坏性**的：不满足的版本会在 profile 加载阶段被跳过（`skippedBundles`）
或被启动 preflight 禁用。改完按上表核对一遍。

**判断方法**：先问「有没有真的用到某个版本才有的内核能力」。
有 → 声明并写实际下限；没有 → 仍建议声明一个保守下限（如 `>=0.2.0-0`），
让用户知道支持边界，但**不要把下限抬到最新版**（那等于主动拒绝能用的旧版）。

## 4. 禁区（冻结实现，改了会让已验证功能失效）

用户明确要求**保留**的两处（"压缩中上色"真机验证有效）：

- `src/classify.js` 的 **`isRunningCompaction()`** 实现
- `src/dom.js` 的 `CANDIDATE_SELECTOR` 里 **`[data-variant="others"]`**

改它们之前先问维护者。相关测试：`test/actions-compaction.test.mjs`（15 条，必须保持绿）。

其它禁区：

- **不要碰宿主的运行时配置目录**（`dsh` 的 profile 目录，不属于本仓库）
- **不要碰 `node_modules/`**

## 5. 本仓库特有的坑（都有实测依据）

### 5.1 测试写得太死会误报，且**新守卫必须做变异验证**

- 断言 CSS 生成结果时，正则要容忍合理变体。踩过：`svg\{color:` 把新增的
  `svg:not(...){color:` 误判成"缺 svg 规则"。
- 反过来：**任何新增守卫都要把实现改坏跑一遍**，否则很容易写出**假绿**。踩过两次：
  - 删掉 `CANDIDATE_SELECTOR` 里的 `[data-variant="others"]`，14 条测试**全绿**；
  - 某个单测的输入没覆盖"一刀切"分支，把实现改成无视配置也**抓不到**。
  → **新测试写完，必须把实现改坏跑一遍**。

### 5.2 浏览器 bundle 里不能拖进宿主侧模块

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
条目被修好也会变红（提醒同步清单）。**要修请先问维护者**（涉及预设实际配色）。

### 5.5 真机验证 > 源码推断

内核结构会随版本/状态变化。**要动 DOM 判据之前，本轮重新取一次真机证据**，
不要引用历史结论（踩过：旧报告说"某按钮在某个插槽内"，本轮真机实测它在外面，
导致第一版改法只修好一半）。

### 5.6 过程组「内层行」的文字**不能**用简单办法染色（已试过，回退）

先是「创建子智能体 / 更新任务清单没上色」，改成**整行染色**后立刻变成
「**思考的正文错误染色**」。

真机实测（别再重复踩）：

```
DIV.ZmL7Ga_root[data-cc-cat="thinking"]   ← 打标元素，**不带 data-process-activity**
  DIV._root_k7ery_9
    DIV._header_k7ery_16[data-disclosure-header]
      DIV._row_k7ery_26[data-disclosure-row]
        SPAN._leading                    ← 图标（svg 规则已覆盖）
        SPAN._root_1rdzk_1
          SPAN._content_1rdzk_11          ← 文字
```

四个卡点：

1. 内层行**没有任何语义钩子**（全部属性只有 `data-disclosure-row` /
   `data-expandable` / `role` / `aria-expanded`），分不出是「思考」还是「读取」；
2. 文字在 `_content_1rdzk_11` 里，**没有 `_title` 类** → 旧规则命中不到；
3. 行文本里**没有字面 ` · `** —— 界面上那个分隔符是 **CSS 伪元素**画的，
   所以"按分隔符切出标签"（`splitTitleLabel` 那套）**切不到**；
4. 打标元素不带 `data-process-activity`，按该属性触发的切分逻辑不会跑。

**结论**：当前只染内层行的**图标**，文字保持原生色（宁可不染，也不能染正文）。
**不要再试"整行染色"** —— 用户明确拒绝。要做"只染标签"需要内核给出
标签/正文的独立 DOM 钩子，或改走多语言文字匹配（易碎，不推荐）。

### 5.7 🔴 提交产物时**不要机械回滚**（真实事故，2026-10-17）

`05bb2f5`（通用工具行 `single → other`）**只提交了 `src/` 和测试，漏提交 `lib/client.js`**。
后果：仓库里的产物停在上一版 → **任何人从 GitHub 安装都拿不到这个修复**；
而本地 `npm test` 每次都会先重建产物，所以 190 条测试全绿 ——
**测试自己把证据重建掉了**，这是最隐蔽的一类缺陷。

直接原因：我为了给**纯文档提交**避免构建时间戳噪音，习惯性跑了
`git checkout HEAD -- lib/client.js`，但那次**改了 `src/`**，回滚产物等于提交旧产物。

**正确规则（按改动类型二选一，别混）**：

| 改了什么 | 对 `lib/client.js` 该怎么做 |
|---|---|
| **任何 `src/` 下的文件** | `npm run build` 后**连产物一起提交** |
| 只改文档 / 测试 / `package.json` / `locale` | 可以 `git checkout HEAD -- lib/client.js` 丢掉时间戳噪音 |

判断方法：`git status` 里有没有 `src/`？有就必须提交产物。

**守卫**：`test/build-sync.test.mjs` 会**构建前后比对**（归一化掉构建时间戳），
产物落后于 `src/` 时**必然变红**。它构建前备份、比对后还原，不留工作区副作用。

⚠️ 注意 `npm test` 的第一步就是重建产物，所以**跑完测试后 `git status` 里
`lib/client.js` 显示改动是正常的**（只有时间戳变）—— 别把它当成"多了个改动"，
也别在 `src/` 也改了的情况下把它回滚掉。

## 6. 提交规范

- 一个提交只做一件事；信息写清**改了什么、为什么、怎么验证的**。
- **未证实的结论必须标注「未证实」**，不要把推断写成事实。
- 若是 AI 代理提交，请在提交信息末尾加：

  ```
  Generated-by: <agent-name> (<harness> / <model>)
  AI-Disclosure: 本提交由 AI 编码代理生成；可能含未经人工复核的改动。
  ```

  用 `Generated-by:`，**不要**用 `Co-Authored-By:`（那会冒充人类共同作者）。

## 7. 发布前

⚠️ **`git push`、建远端、发 PR/issue 必须先得到维护者明确同意**，不要自行推送。

### 🔴 发版必须重新打包（踩过一次）

预构建包挂在 GitHub Release 上，供市场/用户按
`releases/latest/download/dsh-colorful-commands.tgz` 直接安装。
**这个 tarball 是 `npm pack` 的静态快照，不会随仓库更新自动重建。**

已经踩过：`v0.2.0` 的 tarball 在 `locale/*.json` **之前**打的包，
于是包里有代码但没有官方展示元信息（插件页标题/描述仍回退到 `package.json`），
等于那份元信息白加。

**规矩**：只要改了会被打进包的路径（`src/`、`lib/`、`docs/`、`locale/`、`icon.svg`、
`package.json` 的 `files`），**发版时就必须**：

```sh
npm test                                  # 先全绿（含构建）
npm pack                                  # 重新生成 .tgz
gh release upload v<x.y.z> dsh-colorful-commands-<x.y.z>.tgz --clobber
```

并且**保持资产名不带版本号**（否则 `latest/download/` 链接会静默 404，
见 awesome-list 的规则说明）。


发布流程（GitHub topic、npm 包名、`locale/en.json` 元信息、图标约束）
见 DSH 官方文档 `docs/cookbook/adding-a-package.md`。

## 8. 目录速览

```
src/              源码（改这里）
  index.js        宿主侧入口（apply/inject）
  config.js       宿主侧设置 schema（⚠️ 必须有 .volatile() 字段）
  classify.js     DOM → 类别判定（含冻结的 isRunningCompaction）
  dom.js          候选元素选择与标记（含冻结的 CANDIDATE_SELECTOR）
  css.js          CSS 生成（作用域规则）
  palettes.js     三套预设色板 + 状态色 + 权限色
  settings-card.js / settings-face.js   设置页 UI
  locale.js       zh/en 文案
  data/           传统色库（742 条中国色 / 196 条命令红）
lib/client.js     构建产物（提交，不手改）
test/             9 个测试文件，npm test 全跑
docs/DEMO-PROMPT.md  一键配色自检 prompt
```
