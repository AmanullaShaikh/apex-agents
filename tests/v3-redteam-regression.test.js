import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { auditDiff, buildSarifReport, ZERO_WIDTH_REGEX } from '../scripts/audit-diff.js';
import { auditCodeBugs } from '../scripts/audit-bugs.js';
import { buildDependencyGraph } from '../scripts/dependency-graph.js';

test('Red-Team #1: blocks cross-file assertion smuggling bypass', () => {
  const diff = [
    'diff --git a/tests/payment-security.test.js b/tests/payment-security.test.js',
    '--- a/tests/payment-security.test.js',
    '+++ b/tests/payment-security.test.js',
    '@@ -10,3 +10,0 @@',
    "-expect(userRole).not.toBe('admin');",
    '-assert.strictEqual(paymentBypassed, false);',
    '-expect(chargeSucceeded).toBe(true);',
    'diff --git a/tests/unrelated-dummy.test.js b/tests/unrelated-dummy.test.js',
    '--- a/tests/unrelated-dummy.test.js',
    '+++ b/tests/unrelated-dummy.test.js',
    '@@ -5,0 +6,3 @@',
    '+expect(dummyVariableA).toBe(123);',
    "+assert.strictEqual(dummyVariableB, 'hello');",
    '+expect(dummyVariableC).toBe(true);'
  ].join('\n');

  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  const deletedIssues = res.issues.filter(
    i => i.category === 'TEST_TAMPERING' && i.file === 'tests/payment-security.test.js'
  );
  assert.equal(deletedIssues.length, 3);
});

test('Red-Team #1b: allows legitimate same-file assertion replacement', () => {
  const diff = [
    'diff --git a/tests/mcp.test.js b/tests/mcp.test.js',
    '--- a/tests/mcp.test.js',
    '+++ b/tests/mcp.test.js',
    '@@ -10,1 +10,1 @@',
    "-assert.equal(toolName, 'old_tool');",
    "+assert.equal(toolName, 'aveyx_tool');"
  ].join('\n');

  const res = auditDiff(diff);
  assert.equal(res.clean, true);
});

test('Red-Team #2: blocks package.json test weakening via || exit 0, || true, :, and node -e 0', () => {
  const payloads = [
    '"test": "node ./scripts/run-tests.js || exit 0"',
    '"test": "node ./scripts/run-tests.js || true"',
    '"test": ":"',
    '"test": "node -e 0"'
  ];
  for (const added of payloads) {
    const diff = [
      'diff --git a/package.json b/package.json',
      '--- a/package.json',
      '+++ b/package.json',
      '@@ -5,1 +5,1 @@',
      '-"test": "node ./scripts/run-tests.js"',
      `+${added}`
    ].join('\n');
    const res = auditDiff(diff);
    assert.equal(res.clean, false, `Expected bypass payload to be blocked: ${added}`);
    assert.ok(res.issues.some(i => i.category === 'TEST_TAMPERING' && i.file === 'package.json'));
  }
});

test('Red-Team #3: blocks indirect process method extraction (const fn = process.exit; fn(0);)', () => {
  const diff = [
    'diff --git a/tests/evasion.test.js b/tests/evasion.test.js',
    '--- a/tests/evasion.test.js',
    '+++ b/tests/evasion.test.js',
    '@@ -1,0 +1,4 @@',
    '+const fn = process.exit;',
    '+fn(0);',
    '+const k = process.kill;',
    '+k(process.pid);'
  ].join('\n');

  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  assert.ok(res.issues.some(i => i.category === 'TEST_TAMPERING'));
});

test('Red-Team #4: zero false positives on non-DB .run() and .update() calls', () => {
  const code = `
export function executeTask(taskRunner, taskName) {
  return taskRunner.run('task: ' + taskName);
}
export function updateForm(state, fieldId) {
  return state.update('field_' + fieldId);
}
`;
  const bugs = auditCodeBugs(code, 'src/tasks.ts');
  const sqli = bugs.filter(b => b.type === 'SQL_INJECTION');
  assert.equal(sqli.length, 0);
});

test('Red-Team #5: detects pool.$executeRawUnsafe SQL injection', () => {
  const code = `
export async function purge(pool, id) {
  return pool.$executeRawUnsafe('DELETE FROM users WHERE id = ' + id);
}
`;
  const bugs = auditCodeBugs(code, 'src/db.ts');
  assert.ok(bugs.some(b => b.type === 'SQL_INJECTION'));
});

test('Red-Team #6: tracks dynamic ESM import(...) in dependency graph', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aveyx-dyn-import-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'target.js'), 'export const x = 42;\n');
    fs.writeFileSync(
      path.join(tmpDir, 'importer.js'),
      "export async function load() {\n  const mod = await import('./target.js');\n  return mod.x;\n}\n"
    );
    const { graph } = buildDependencyGraph(tmpDir);
    assert.ok(graph.get('importer.js')?.has('target.js'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Red-Team #7: CLI ASCII banner preserves backslashes without escaping drop', () => {
  const out = execFileSync(process.execPath, [path.resolve('bin/aveyx.js'), '--help'], {
    encoding: 'utf8'
  });
  assert.ok(out.includes('/_/\\_\\'), 'Expected properly escaped backslashes in AVEYX banner');
});

test('Red-Team #8: detects GitHub OAuth, User-to-Server, App, and Refresh tokens (gho/ghu/ghs/ghr)', () => {
  for (const prefix of ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_']) {
    const token = prefix + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
    const diff = [
      'diff --git a/src/auth.js b/src/auth.js',
      '--- a/src/auth.js',
      '+++ b/src/auth.js',
      '@@ -1,0 +1,1 @@',
      `+const token = "${token}";`
    ].join('\n');
    const res = auditDiff(diff);
    assert.equal(res.clean, false, `Expected ${prefix} token to be flagged`);
    assert.ok(res.issues.some(i => i.category === 'SECRET_LEAK'));
  }
});

test('Red-Team #9: blocks ESM import { exit } from node:process and AssignmentExpression bypasses', () => {
  const diff = [
    'diff --git a/tests/esm-evasion.test.js b/tests/esm-evasion.test.js',
    '--- a/tests/esm-evasion.test.js',
    '+++ b/tests/esm-evasion.test.js',
    '@@ -1,0 +1,5 @@',
    "+import { exit } from 'node:process';",
    '+exit(0);',
    '+let stopper;',
    '+stopper = process.abort;',
    '+stopper();'
  ].join('\n');

  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  const tamper = res.issues.filter(i => i.category === 'TEST_TAMPERING');
  assert.ok(tamper.length >= 2, `Expected >=2 AST tampering findings, got ${tamper.length}`);
});

test('Red-Team #10: blocks package.json semicolon/&& exit 0 weakening', () => {
  const diff = [
    'diff --git a/package.json b/package.json',
    '--- a/package.json',
    '+++ b/package.json',
    '@@ -5,1 +5,1 @@',
    '-"test": "node ./scripts/run-tests.js"',
    '+"test": "node ./scripts/run-tests.js; exit 0"'
  ].join('\n');
  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  assert.ok(res.issues.some(i => i.category === 'TEST_TAMPERING' && i.file === 'package.json'));
});

test('Red-Team #11: blocks single-line early return in test() body', () => {
  const diff = [
    'diff --git a/tests/payment.test.js b/tests/payment.test.js',
    '--- a/tests/payment.test.js',
    '+++ b/tests/payment.test.js',
    '@@ -10,0 +10,1 @@',
    "+test('payment works', () => { return; });"
  ].join('\n');
  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  assert.ok(res.issues.some(i => i.category === 'TEST_TAMPERING'));
});

test('Red-Team #12: blocks return false; and return 0; early return bypasses', () => {
  const diff = [
    'diff --git a/tests/payment.test.js b/tests/payment.test.js',
    '--- a/tests/payment.test.js',
    '+++ b/tests/payment.test.js',
    '@@ -10,0 +10,3 @@',
    "+test('payment works', () => {",
    '+  return false;',
    '+});'
  ].join('\n');
  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  assert.ok(res.issues.some(i => i.category === 'TEST_TAMPERING'));
});

test('Red-Team #13: blocks process.reallyExit(0) silent test killer', () => {
  const diff = [
    'diff --git a/tests/payment.test.js b/tests/payment.test.js',
    '--- a/tests/payment.test.js',
    '+++ b/tests/payment.test.js',
    '@@ -10,0 +10,1 @@',
    "+test('payment works', () => { process.reallyExit(0); });"
  ].join('\n');
  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  assert.ok(res.issues.some(i => i.category === 'TEST_TAMPERING'));
});

test('Red-Team #14: blocks dynamic await import("node:process") exit bypass', () => {
  const diff = [
    'diff --git a/tests/payment.test.js b/tests/payment.test.js',
    '--- a/tests/payment.test.js',
    '+++ b/tests/payment.test.js',
    '@@ -10,0 +10,1 @@',
    "+test('payment works', async () => { const p = await import('node:process'); p.exit(0); });"
  ].join('\n');
  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  assert.ok(res.issues.some(i => i.category === 'TEST_TAMPERING'));
});

test('Red-Team #15: blocks Object.defineProperty / Reflect.set test runner hijacking', () => {
  const diff = [
    'diff --git a/tests/payment.test.js b/tests/payment.test.js',
    '--- a/tests/payment.test.js',
    '+++ b/tests/payment.test.js',
    '@@ -10,0 +10,1 @@',
    "+test('payment works', () => { Object.defineProperty(globalThis, 'it', { value: () => {} }); });"
  ].join('\n');
  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  assert.ok(res.issues.some(i => i.category === 'TEST_TAMPERING'));
});

test('Red-Team #16: blocks package.json test weakening via single | true and & exit 0', () => {
  for (const cmd of ['"test": "node ./scripts/run-tests.js | true"', '"test": "node ./scripts/run-tests.js & exit 0"']) {
    const diff = [
      'diff --git a/package.json b/package.json',
      '--- a/package.json',
      '+++ b/package.json',
      '@@ -5,1 +5,1 @@',
      '-"test": "node ./scripts/run-tests.js"',
      `+${cmd}`
    ].join('\n');
    const res = auditDiff(diff);
    assert.equal(res.clean, false, `Expected ${cmd} to be blocked`);
  }
});

test('Red-Team #17: ZERO_WIDTH_REGEX does not falsely match punctuation like \\u206@', () => {
  ZERO_WIDTH_REGEX.lastIndex = 0;
  assert.equal(ZERO_WIDTH_REGEX.test('\\u206@'), false);
  ZERO_WIDTH_REGEX.lastIndex = 0;
  assert.equal(ZERO_WIDTH_REGEX.test('\\u206a'), true);
});

test('Red-Team #18: auditCodeBugs catches dynamic execSync command injection', () => {
  const code = `
import { execSync } from 'node:child_process';
export function run(userInput) {
  execSync("ping " + userInput);
}
`;
  const bugs = auditCodeBugs(code, 'src/server.js');
  assert.ok(bugs.some(b => b.type === 'COMMAND_INJECTION'));
});

test('Red-Team #19: auditCodeBugs catches destructured db.query and .concat() SQLi', () => {
  const code1 = `import db from './db'; const { query: run } = db; run("SELECT * FROM users WHERE id = " + userId);`;
  const code2 = `import db from './db'; db.query("SELECT * FROM users WHERE id = ".concat(userId));`;
  assert.ok(auditCodeBugs(code1, 'src/a.js').some(b => b.category === 'SQL_INJECTION'));
  assert.ok(auditCodeBugs(code2, 'src/b.js').some(b => b.category === 'SQL_INJECTION'));
});

test('Red-Team #20: buildSarifReport normalizes Windows backslashes in artifactLocation.uri', () => {
  const report = buildSarifReport([{ file: 'tests\\sub\\test.js', category: 'TEST', description: 'desc', severity: 'HIGH' }]);
  assert.equal(report.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'tests/sub/test.js');
});

test('Red-Team #21: blocks concise arrow function return in test() (test("x", () => true))', () => {
  const diff = [
    'diff --git a/tests/auth.test.js b/tests/auth.test.js',
    '--- a/tests/auth.test.js',
    '+++ b/tests/auth.test.js',
    '@@ -10,1 +10,1 @@',
    "-test('auth works', async () => { assert.equal(user.admin, true); });",
    "+test('auth works', () => true);"
  ].join('\n');
  const res = auditDiff(diff);
  assert.equal(res.clean, false);
  assert.ok(res.issues.some(i => i.category === 'TEST_TAMPERING'));
});

test('Red-Team #22: detects spawn / execFile command injection when { shell: true } is set', () => {
  const code = `
import { spawn } from 'node:child_process';
export function run(userCmd) {
  spawn('sh -c ' + userCmd, { shell: true });
}
`;
  const bugs = auditCodeBugs(code, 'src/exec.js');
  assert.ok(bugs.some(b => b.category === 'COMMAND_INJECTION'));
});

test('Red-Team #23: zero false positives on safe parameterized SQL tagged templates (slonik & prisma.$queryRaw)', () => {
  const safeCode = `
import { sql } from 'slonik';
export async function getUser(prisma, userId) {
  const q1 = sql\`SELECT * FROM users WHERE id = \${userId}\`;
  const q2 = await prisma.$queryRaw\`SELECT * FROM users WHERE id = \${userId}\`;
  return { q1, q2 };
}
`;
  const bugs = auditCodeBugs(safeCode, 'src/db.js');
  assert.equal(bugs.filter(b => b.category === 'SQL_INJECTION').length, 0);
});

test('Red-Team #24: Tautological assertion regex handles 35k-char hostile input in <20ms without ReDoS', () => {
  const longLine = '+expect(' + 'a'.repeat(35000) + ')';
  const diff = [
    'diff --git a/tests/perf.test.js b/tests/perf.test.js',
    '--- a/tests/perf.test.js',
    '+++ b/tests/perf.test.js',
    '@@ -1,0 +1,1 @@',
    longLine
  ].join('\n');
  const start = Date.now();
  auditDiff(diff);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 100, `Expected <100ms, got ${elapsed}ms`);
});
