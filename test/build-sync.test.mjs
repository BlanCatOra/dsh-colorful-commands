/**
 * 产物同源守卫：提交的 `lib/client.js` 必须与 `src/` 一致。
 *
 * ## 这条测试防的是什么（真实事故，2026-10-17）
 *
 * 提交 `05bb2f5`（通用工具行 `single → other`）**只提交了 `src/classify.js` 和测试，
 * 漏提交了构建产物 `lib/client.js`**。于是：
 *
 * - `src/` 有 `single: 'other'`，`lib/client.js` 没有；
 * - 本地 `npm test` 会**先重建产物**，所以测试跑的是"新产物" → 全绿；
 * - 用户从 GitHub 安装拿到的是**仓库里那份旧产物** → 修复根本没生效。
 *
 * 这是「测试全绿、真机全废」的典型：**测试自己把证据重建掉了**。
 *
 * ## 三个必须的设计点
 *
 * 1. **构建到临时目录，绝不覆盖 `lib/client.js`。**
 *    `build-client.mjs` 导出了 `build({ output })`，可以指定输出路径。
 *    ⚠️ 早期版本是"备份 → 原地重建 → 还原"，结果 `node --test` **并行跑测试文件**时，
 *    它会和其他读 `lib/client.js` 的测试撞车，产生**间歇性 flake**
 *    （实测同一命令跑两次，一次 191/192、一次 192/192，红的正是本文件）。
 *    → 构建到 `os.tmpdir()` 后，测试对工作区**零副作用**，并发也安全。
 *
 * 2. **归一化构建时间戳。**
 *    banner 里有 `__CC_BUILD_STAMP__ = "<ISO 时间戳>"`，每次构建都不同 ——
 *    不归一化会**永远失败**。
 *
 * 3. **归一化必须只吃掉时间戳**（第二条测试反向验证），
 *    否则真实代码差异被抹平，第一条会假绿。
 *
 * @module dsh-colorful-commands/test/build-sync
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'lib/client.js');
const SRC = join(ROOT, 'src');

/** 把构建时间戳归一化，否则每次构建都不同、比对必然失败。 */
function normalize(code) {
  return code.replace(/__CC_BUILD_STAMP__\s*=\s*"[^"]*"/, '__CC_BUILD_STAMP__ = "<stamp>"');
}

test('lib/client.js 必须与 src/ 同源（防止提交陈旧产物）', async () => {
  const committed = await readFile(LIB, 'utf8');
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));

  // 构建到临时目录：不碰工作区、不与并行测试抢 lib/client.js。
  const outDir = join(tmpdir(), `dsh-cc-buildsync-${process.pid}-${Date.now()}`);
  const outFile = join(outDir, 'client.js');
  // 必须用官方的 `bannerFor`：`build()` 内部会再注入一行 `__CC_BUILD_STAMP__`，
  // banner 若自己多塞一个时间戳，产物就和 CLI 构建的不一致了（踩过）。
  const { build, bannerFor } = await import(pathToFileURL(join(SRC, 'build-client.mjs')).href);
  const { mkdir } = await import('node:fs/promises');
  await mkdir(outDir, { recursive: true });

  let rebuilt;
  try {
    await build({
      entry: join(SRC, 'client.js'),
      root: SRC,
      packageId: pkg.name,
      output: outFile,
      banner: bannerFor(pkg.name),
    });
    rebuilt = await readFile(outFile, 'utf8');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  assert.notEqual(rebuilt, undefined, '构建失败：没有读到重建的产物');
  if (normalize(rebuilt) !== normalize(committed)) {
    assert.fail(
      '提交的 `lib/client.js` 与 `src/` 不同源 —— 仓库里的产物是陈旧的。\n'
      + '后果：测试会先重建产物所以全绿，但用户从 GitHub 装到的是旧产物，修复根本不生效。\n'
      + '修法：`npm run build` 后把 `lib/client.js` 一起提交（见 AGENTS.md §5.7）。',
    );
  }
});

test('归一化只吃掉构建时间戳，不动真实代码差异', () => {
  // 反向守卫：确保 normalize 不会把真正的代码差异也抹平（否则上面那条会假绿）。
  const a = 'globalThis.__CC_BUILD_STAMP__ = "2026-01-01T00:00:00.000Z";\nvar x = 1;';
  const b = 'globalThis.__CC_BUILD_STAMP__ = "2026-12-31T23:59:59.999Z";\nvar x = 1;';
  const c = 'globalThis.__CC_BUILD_STAMP__ = "2026-12-31T23:59:59.999Z";\nvar x = 2;';
  assert.equal(normalize(a), normalize(b), '仅时间戳不同 → 归一化后应相等');
  assert.notEqual(normalize(a), normalize(c), '真实代码不同 → 归一化后必须仍不相等');
});
