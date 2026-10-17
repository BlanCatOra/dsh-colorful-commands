/**
 * 面向 agent 的仓库规范自检。
 *
 * ## 规范出处
 *
 * `~/Projects/dsh-plugin-standards/docs/AGENT-FACING-STANDARDS.md`。
 * 用户 2026-10-17 要求：**每个公开仓库必须有 `AGENTS.md` + `llms.txt`，
 * 且 README 正文要提示 agent 先看这两个文件。**
 *
 * ## 为什么把"规范"写成测试
 *
 * 规范只写在文档里就是**纸面要求**：忘了没人拦，补了没验证。
 * 这条测试让约定变成**可执行的门槛** —— `npm test` 一跑就知道缺没缺。
 *
 * ## 断言的三件事
 *
 * 1. 两个文件都在，且**有实质内容**（不是空文件占位）；
 * 2. 结构符合规范（`llms.txt` 有 H1 + blockquote 摘要 + 分节链接；
 *    `AGENTS.md` 覆盖 6 个必需主题）；
 * 3. README（**所有语言版本**）都指了路，且链接指向的文件真实存在。
 *
 * 外加一条**脱敏**断言：这几个文件会随仓库公开，不得含本机私有信息。
 *
 * @module dsh-colorful-commands/test/agent-facing
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 读仓库根下的文件（不存在则返回 undefined）。 */
async function readIfExists(name) {
  try {
    return await readFile(join(ROOT, name), 'utf8');
  } catch {
    return undefined;
  }
}

const AGENTS = await readIfExists('AGENTS.md');
const LLMS = await readIfExists('llms.txt');
const READMES = {};
for (const name of ['README.md', 'README.en.md']) {
  READMES[name] = await readIfExists(name);
}

test('仓库根必须有 AGENTS.md，且覆盖规范要求的 6 个主题', () => {
  assert.ok(AGENTS !== undefined, '缺少 AGENTS.md（规范：面向 agent 的仓库必须有）');
  assert.ok(AGENTS.trim().length > 500, `AGENTS.md 内容过少（${AGENTS.trim().length} 字符），像是占位文件`);

  // 规范 §2.2 的 6 块。用中/英关键词匹配，容忍措辞差异但要求主题在场。
  const required = [
    { key: '验证命令', patterns: [/验证/, /npm test/, /命令/] },
    { key: '构建产物', patterns: [/产物/, /lib\/client\.js/] },
    { key: '硬性约束', patterns: [/硬性约束|硬规则/, /seed/i] },
    { key: '禁区', patterns: [/禁区|不许动|off-limits/i] },
    { key: '提交规范', patterns: [/提交/, /Generated-by/] },
    { key: '本仓库特有的坑', patterns: [/坑|踩过|gotcha/i] },
  ];
  const missing = required
    .filter(({ patterns }) => !patterns.every((re) => re.test(AGENTS)))
    .map(({ key }) => key);
  assert.deepEqual(missing, [], `AGENTS.md 缺少这些必需主题：${missing.join('、')}`);
});

test('AGENTS.md 每条"坑"都要有实测依据（不得是空泛建议）', () => {
  // 规范 §2.3：只写踩过的坑，且带证据。抽查：文中必须出现"实测/踩过/曾经/曾"这类
  // 证据标记，否则说明写成了通用大道理。
  assert.match(AGENTS, /实测|踩过|曾经|曾出现|已验证/,
    'AGENTS.md 里没有任何"实测/踩过"类证据标记 → 可能写成了通用建议，不符合规范 §2.3');
});

test('仓库根必须有 llms.txt，且结构符合规范（H1 + 摘要 + 分节链接）', () => {
  assert.ok(LLMS !== undefined, '缺少 llms.txt（规范：面向 agent 的仓库必须有）');

  const lines = LLMS.split('\n');
  // H1 = 项目名（唯一）
  const h1 = lines.filter((l) => /^# /.test(l));
  assert.equal(h1.length, 1, `llms.txt 必须恰好有一个 H1（项目名），实际 ${h1.length} 个`);
  assert.match(h1[0], /dsh-colorful-commands/, 'llms.txt 的 H1 应为项目名');

  // 紧跟 blockquote 摘要
  assert.match(LLMS, /^> /m, 'llms.txt 缺少 blockquote 摘要（规范 §3.2 要求 H1 后紧跟 1-3 句摘要）');

  // 至少一个 ## 分节，且节内有指向具体文件的 markdown 链接
  const h2Count = lines.filter((l) => /^## /.test(l)).length;
  assert.ok(h2Count >= 1, 'llms.txt 至少要有一个 ## 分节');
  const links = [...LLMS.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length >= 2, `llms.txt 的分节应是指向文档的链接列表，实际只有 ${links.length} 条链接`);
  // 至少有一条指向本地 md 文档（而不是全是外链）
  assert.ok(links.some((l) => /\.md(#|$)/.test(l)),
    'llms.txt 至少应有一条指向本地 markdown 文档的链接');

  // 规范 §3.2：文件本身要小到能塞进上下文
  assert.ok(LLMS.length < 8000, `llms.txt 过长（${LLMS.length} 字符），规范要求能塞进上下文`);
});

test('README 的所有语言版本都要指路（AGENTS.md + llms.txt）', async () => {
  const names = Object.keys(READMES);
  assert.ok(names.length >= 1, '一个 README 都没找到');
  for (const [name, content] of Object.entries(READMES)) {
    assert.ok(content !== undefined, `${name} 不存在`);
    assert.match(content, /AGENTS\.md/, `${name} 正文没有提到 AGENTS.md → agent 不会去读它`);
    assert.match(content, /llms\.txt/, `${name} 正文没有提到 llms.txt → agent 不会去读它`);
  }
});

test('README 的指路必须在正文靠前处（不能只放文件末尾）', () => {
  // 规范 §4.1：人和 agent 都常只读前半屏。这里要求指路出现在前 1/3。
  for (const [name, content] of Object.entries(READMES)) {
    if (content === undefined) continue;
    const idx = content.indexOf('AGENTS.md');
    assert.ok(idx >= 0, `${name} 未提到 AGENTS.md`);
    const ratio = idx / content.length;
    assert.ok(
      ratio < 0.34,
      `${name} 的 AGENTS.md 指路出现在 ${(ratio * 100).toFixed(0)}% 处，太靠后（要求前 1/3）`,
    );
  }
});

test('指路引用的文件真实存在（相对链接不能写错）', async () => {
  // 规范 §5：「指路文案里的链接路径真实可点（相对路径别写错）」。
  for (const [name, content] of Object.entries(READMES)) {
    if (content === undefined) continue;
    for (const target of ['AGENTS.md', 'llms.txt']) {
      if (!content.includes(target)) continue;
      const exists = await stat(join(ROOT, target)).then(() => true).catch(() => false);
      assert.ok(exists, `${name} 指向 ./${target}，但该文件不存在`);
    }
  }
});

test('这些会公开的文件不得含本机私有信息（脱敏）', () => {
  // 规范 §5 最后一条 + 全局 AGENTS.md 的脱敏要求。
  const forbidden = [
    // ⚠️ 这里**不写死具体私人邮箱**：本文件本身是公开的，
    //    把要防的地址原文写进来等于自己泄漏一次（已踩过）。
    //    改为"任何非 agent 的 qq.com 邮箱"这种泛化判据。
    { re: /[\w.+-]+@qq\.com/g, what: '非 agent 的 qq.com 邮箱', allow: ['blancatora@agent.qq.com'] },
    { re: /192\.168\.\d+\.\d+/, what: '内网 IP' },
    { re: /\/home\/[a-z][\w-]*\b/, what: '本机绝对路径（含用户名）' },
  ];
  // ⚠️ 注意 **不要**把 `blancatora@agent.qq.com` 列为禁止项：
  //    它是全局规范指定的**公开通讯邮箱**，也是本仓库的提交身份
  //    （commit author 本来就会公开它）。把它算成隐私是规则写错了 ——
  //    本测试第一版就是这么误报的。
  const files = { 'AGENTS.md': AGENTS, 'llms.txt': LLMS, ...READMES };
  const hits = [];
  for (const [name, content] of Object.entries(files)) {
    if (content === undefined) continue;
    for (const { re, what, allow } of forbidden) {
      const pattern = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
      for (const match of content.matchAll(pattern)) {
        const hit = match[0];
        if (allow !== undefined && allow.includes(hit)) continue; // 允许的公开地址
        hits.push(`${name} 含${what}：${hit}`);
      }
    }
  }
  assert.deepEqual(hits, [], `公开文件里出现私有信息：\n${hits.join('\n')}`);
});
