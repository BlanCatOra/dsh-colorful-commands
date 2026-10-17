/**
 * 产物同源守卫：提交的 `lib/client.js` 必须与 `src/` 一致。
 *
 * ## 这条测试防的是什么（真实事故，2026-10-17）
 *
 * 提交 `05bb2f5`（通用工具行 `single → other`）**只提交了 `src/classify.js` 和测试，
 * 漏提交了构建产物 `lib/client.js`**。于是：
 *
 * - `src/` 有 `single: 'other'`，`lib/client.js` 没有；
 * - 本地 `npm test` 会**先重建产物**，所以测试跑的是"新产物" → 190 条全绿；
 * - 用户从 GitHub 安装拿到的是**仓库里那份旧产物** → 修复根本没生效。
 *
 * 这是「测试全绿、真机全废」的典型：**测试自己把证据重建掉了**。
 *
 * ## 为什么要"构建前备份 → 构建 → 比对 → 还原"
 *
 * ⚠️ 踩两个坑：
 *
 * 1. **不能只比文件内容**：`build-client.mjs` 会写入
 *    `__CC_BUILD_STAMP__ = "<ISO 时间戳>"`，每次构建都不同 ——
 *    直接比哈希会**永远失败**。所以比较前要先把时间戳归一化掉。
 * 2. **不能让测试留下副作用**：构建会覆盖 `lib/client.js`。若不管，
 *    每次 `npm test` 都会把工作区弄脏、还可能把"陈旧"状态洗掉。
 *    所以先备份原始字节，比对完在 `finally` 里**原样还原**。
 *
 * ⚠️ 顺序也很关键：**必须先读原始内容再构建**。如果反过来（先构建再读），
 * 就读到了刚重建的产物，断言永远成立 —— 那是假绿。
 *
 * @module dsh-colorful-commands/test/build-sync
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'lib/client.js');

/** 把构建时间戳归一化，否则每次构建都不同、比对必然失败。 */
function normalize(code) {
  return code.replace(/__CC_BUILD_STAMP__\s*=\s*"[^"]*"/, '__CC_BUILD_STAMP__ = "<stamp>"');
}

test('lib/client.js 必须与 src/ 同源（防止提交陈旧产物）', async () => {
  // ⚠️ 必须先读原始内容，再构建。反过来就是"重建后再检查"，永远绿。
  const committedOriginal = await readFile(LIB, 'utf8');

  let rebuilt;
  try {
    execFileSync(process.execPath, ['src/build-client.mjs'], { cwd: ROOT, stdio: 'ignore' });
    rebuilt = await readFile(LIB, 'utf8');
  } finally {
    // 还原，保证测试不把工作区弄脏、也不掩盖真实的"陈旧"状态。
    await writeFile(LIB, committedOriginal);
  }

  assert.notEqual(rebuilt, undefined, '构建失败：没有读到重建后的产物');

  // 归一化时间戳后再比。两者不同 ⇒ 仓库里的产物落后于 src/。
  if (normalize(rebuilt) !== normalize(committedOriginal)) {
    assert.fail(
      '提交的 `lib/client.js` 与 `src/` 不同源 —— 仓库里的产物是陈旧的。\n'
      + '后果：测试会先重建产物所以全绿，但用户从 GitHub 装到的是旧产物，修复根本不生效。\n'
      + '修法：`npm run build` 后把 `lib/client.js` 一起提交。',
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
