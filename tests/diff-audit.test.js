import { test, describe } from 'node:test';
import assert from 'node:assert';
import { auditDiff } from '../scripts/audit-diff.js';

describe('Diff Security & Anti-Cheat Audit', () => {
  test('should detect test tampering when an agent skips a test', () => {
    // Constructed dynamically to prevent false-positive during self-diff audit
    const diff = [
      'diff --git a/tests/auth.test.js b/tests/auth.test.js',
      '--- a/tests/auth.test.js',
      '+++ b/tests/auth.test.js',
      '@@ -10,3 +10,3 @@',
      '-test(\'should authenticate user\', async () => {',
      '+test' + '.skip(\'should authenticate user\', async () => {'
    ].join('\n');

    const result = auditDiff(diff);
    assert.strictEqual(result.clean, false);
    assert.strictEqual(result.stats.tampering, 1);
    assert.match(result.issues[0].description, /Test Weakening/);
  });

  test('should detect test tampering when an assertion is commented out', () => {
    const diff = [
      'diff --git a/src/api.spec.ts b/src/api.spec.ts',
      '--- a/src/api.spec.ts',
      '+++ b/src/api.spec.ts',
      '@@ -25,2 +25,2 @@',
      '-expect(res.status).toBe(200);',
      '+//' + ' expect(res.status).toBe(200);'
    ].join('\n');

    const result = auditDiff(diff);
    assert.strictEqual(result.clean, false);
    assert.strictEqual(result.stats.tampering, 1);
  });

  test('should not trigger false AI slop on markdown or rule files explaining TODOs', () => {
    const docDiff = [
      'diff --git a/CLAUDE.md b/CLAUDE.md',
      '--- a/CLAUDE.md',
      '+++ b/CLAUDE.md',
      '@@ -1,2 +1,2 @@',
      '+1. **Forbidden Placeholders:** Strictly forbid `// ' + 'TODO: implement later`'
    ].join('\n');

    const result = auditDiff(docDiff);
    assert.strictEqual(result.stats.slop, 0);
  });

  test('should detect real AI slop in source code files', () => {
    const codeDiff = [
      'diff --git a/src/service.ts b/src/service.ts',
      '--- a/src/service.ts',
      '+++ b/src/service.ts',
      '@@ -5,2 +5,2 @@',
      '+// ' + 'TODO: implement later'
    ].join('\n');

    const result = auditDiff(codeDiff);
    assert.strictEqual(result.stats.slop, 1);
  });

  test('should detect computed test skip, tautology, and deleted assertions', () => {
    // 1. Computed skip: it['skip']
    const skipDiff = [
      'diff --git a/tests/user.test.ts b/tests/user.test.ts',
      '--- a/tests/user.test.ts',
      '+++ b/tests/user.test.ts',
      '@@ -10,1 +10,1 @@',
      '+it["' + 'skip"]("should create user", () => {});'
    ].join('\n');
    assert.strictEqual(auditDiff(skipDiff).stats.tampering, 1);

    // 2. Tautology: expect(true).toBe(true)
    const tautologyDiff = [
      'diff --git a/tests/user.test.ts b/tests/user.test.ts',
      '--- a/tests/user.test.ts',
      '+++ b/tests/user.test.ts',
      '@@ -15,1 +15,1 @@',
      '+expect(true).toBe(true);'
    ].join('\n');
    assert.strictEqual(auditDiff(tautologyDiff).stats.tampering, 1);

    // 3. Deleted assertion
    const deletedDiff = [
      'diff --git a/tests/user.test.ts b/tests/user.test.ts',
      '--- a/tests/user.test.ts',
      '+++ b/tests/user.test.ts',
      '@@ -20,2 +20,1 @@',
      '-expect(res.status).toBe(200);'
    ].join('\n');
    assert.strictEqual(auditDiff(deletedDiff).stats.tampering, 1);
  });

  test('should detect split secrets and base64 AWS credentials', () => {
    const sPrefix = 'sk_live_';
    const sSuffix = '51abcd1234567890efghij';
    const splitDiff = [
      'diff --git a/src/config.ts b/src/config.ts',
      '--- a/src/config.ts',
      '+++ b/src/config.ts',
      '@@ -1,1 +1,1 @@',
      `+const key = "${sPrefix}" + "${sSuffix}";`
    ].join('\n');
    assert.strictEqual(auditDiff(splitDiff).stats.secrets, 1);

    const b64Diff = [
      'diff --git a/src/aws.ts b/src/aws.ts',
      '--- a/src/aws.ts',
      '+++ b/src/aws.ts',
      '@@ -1,1 +1,1 @@',
      '+const awsB64 = "QUtJQS1234567890ABCD";'
    ].join('\n');
    assert.strictEqual(auditDiff(b64Diff).stats.secrets, 1);
  });

  test('should detect early return injection, non-boolean tautology, array joins, and 3-way splits', () => {
    // 1. Early return in test
    const earlyReturnDiff = [
      'diff --git a/tests/auth.test.ts b/tests/auth.test.ts',
      '--- a/tests/auth.test.ts',
      '+++ b/tests/auth.test.ts',
      '@@ -5,2 +5,3 @@',
      '+  return;',
      '   expect(auth.isValid).toBe(true);'
    ].join('\n');
    assert.strictEqual(auditDiff(earlyReturnDiff).stats.tampering, 1);

    // 2. Non-literal tautologies
    const nonLiteralTautologyDiff = [
      'diff --git a/tests/sample.test.ts b/tests/sample.test.ts',
      '--- a/tests/sample.test.ts',
      '+++ b/tests/sample.test.ts',
      '@@ -10,1 +10,1 @@',
      '+expect("foo").toBe("foo");'
    ].join('\n');
    assert.strictEqual(auditDiff(nonLiteralTautologyDiff).stats.tampering, 1);

    // 3. Array join secret bypass
    const p1 = 'AK';
    const p2 = 'IA';
    const p3 = '1234567890123456';
    const arrayJoinDiff = [
      'diff --git a/src/vault.ts b/src/vault.ts',
      '--- a/src/vault.ts',
      '+++ b/src/vault.ts',
      '@@ -1,1 +1,1 @@',
      `+const key = ['${p1}', '${p2}', '${p3}'].join('');`
    ].join('\n');
    assert.strictEqual(auditDiff(arrayJoinDiff).stats.secrets, 1);
  });

  test('should detect process.exit, assertion shadowing, dead branch, complex tautologies, and encoded secrets', () => {
    // 1. Process exit in test
    const exitDiff = [
      'diff --git a/tests/kill.test.ts b/tests/kill.test.ts',
      '--- a/tests/kill.test.ts',
      '+++ b/tests/kill.test.ts',
      '@@ -1,2 +1,3 @@',
      '+process.exit(0);',
      ' expect(true).toBe(true);'
    ].join('\n');
    assert.strictEqual(auditDiff(exitDiff).stats.tampering, 1);

    // 2. Assertion shadowing
    const shadowDiff = [
      'diff --git a/tests/shadow.test.ts b/tests/shadow.test.ts',
      '--- a/tests/shadow.test.ts',
      '+++ b/tests/shadow.test.ts',
      '@@ -1,2 +1,3 @@',
      '+const expect = () => ({ toBe: () => true });'
    ].join('\n');
    assert.strictEqual(auditDiff(shadowDiff).stats.tampering, 1);

    // 3. Dead branch wrapping
    const deadBranchDiff = [
      'diff --git a/tests/branch.test.ts b/tests/branch.test.ts',
      '--- a/tests/branch.test.ts',
      '+++ b/tests/branch.test.ts',
      '@@ -1,2 +1,3 @@',
      '+if (false) {',
      '+  expect(user.isAdmin).toBe(true);',
      '+}'
    ].join('\n');
    assert.strictEqual(auditDiff(deadBranchDiff).stats.tampering, 1);

    // 4. Complex tautologies
    const complexTautology = [
      'diff --git a/tests/tautology.test.ts b/tests/tautology.test.ts',
      '--- a/tests/tautology.test.ts',
      '+++ b/tests/tautology.test.ts',
      '@@ -1,1 +1,2 @@',
      '+expect(typeof "foo").toBe("string");',
      '+expect([1][0]).toBe(1);'
    ].join('\n');
    assert.strictEqual(auditDiff(complexTautology).stats.tampering, 2);

    // 5. FromCharCode secret
    const charCodeDiff = [
      'diff --git a/src/creds.ts b/src/creds.ts',
      '--- a/src/creds.ts',
      '+++ b/src/creds.ts',
      '@@ -1,1 +1,1 @@',
      '+const k = String.fromCharCode(65, 75, 73, 65) + "1234567890ABCDEF";'
    ].join('\n');
    assert.strictEqual(auditDiff(charCodeDiff).stats.secrets, 1);

    // 6. Hex buffer secret
    const hexDiff = [
      'diff --git a/src/hex.ts b/src/hex.ts',
      '--- a/src/hex.ts',
      '+++ b/src/hex.ts',
      '@@ -1,1 +1,1 @@',
      '+const k = Buffer.from("414b494131323334353637383930414243444546", "hex").toString();'
    ].join('\n');
    assert.strictEqual(auditDiff(hexDiff).stats.secrets, 1);

    // 7. Reversed secret
    const revDiff = [
      'diff --git a/src/rev.ts b/src/rev.ts',
      '--- a/src/rev.ts',
      '+++ b/src/rev.ts',
      '@@ -1,1 +1,1 @@',
      '+const k = "FEDCBA0987654321AIKA".split("").reverse().join("");'
    ].join('\n');
    assert.strictEqual(auditDiff(revDiff).stats.secrets, 1);

    // 8. Multi-chunk base64 split
    const b1 = 'eyJrZXkiOiAi';
    const b2 = 'QUtJQTEyMzQ1Njc4';
    const b3 = 'OTBBQkNERUYifQ==';
    const multiB64Diff = [
      'diff --git a/src/b64.ts b/src/b64.ts',
      '--- a/src/b64.ts',
      '+++ b/src/b64.ts',
      '@@ -1,1 +1,1 @@',
      `+const b64 = "${b1}" + "${b2}" + "${b3}";`
    ].join('\n');
    assert.strictEqual(auditDiff(multiB64Diff).stats.secrets, 1);
  });

  test('should detect zero-width Unicode secrets, bitwise XOR secrets, replaceAll secrets, and async test sabotage', () => {
    // 1. Zero-width space injection
    const zwDiff = [
      'diff --git a/src/zw.ts b/src/zw.ts',
      '--- a/src/zw.ts',
      '+++ b/src/zw.ts',
      '@@ -1,1 +1,1 @@',
      '+const key = "AK\\u200BIA1234567890ABCDEF";'
    ].join('\n');
    assert.strictEqual(auditDiff(zwDiff).stats.secrets, 1);

    // 2. BOM injection
    const bomDiff = [
      'diff --git a/src/bom.ts b/src/bom.ts',
      '--- a/src/bom.ts',
      '+++ b/src/bom.ts',
      '@@ -1,1 +1,1 @@',
      '+const key = "AK\\uFEFFIA1234567890ABCDEF";'
    ].join('\n');
    assert.strictEqual(auditDiff(bomDiff).stats.secrets, 1);

    // 3. Bitwise XOR fromCharCode secret
    const xorDiff = [
      'diff --git a/src/xor.ts b/src/xor.ts',
      '--- a/src/xor.ts',
      '+++ b/src/xor.ts',
      '@@ -1,1 +1,1 @@',
      '+const key = String.fromCharCode(65 ^ 0, 75 ^ 0, 73 ^ 0, 65 ^ 0) + "1234567890ABCDEF";'
    ].join('\n');
    assert.strictEqual(auditDiff(xorDiff).stats.secrets, 1);

    // 4. Dynamic replaceAll secret
    const replDiff = [
      'diff --git a/src/repl.ts b/src/repl.ts',
      '--- a/src/repl.ts',
      '+++ b/src/repl.ts',
      '@@ -1,1 +1,1 @@',
      '+const key = "XKIX1234567890ABCDEF".replaceAll("X", "A");'
    ].join('\n');
    assert.strictEqual(auditDiff(replDiff).stats.secrets, 1);

    // 5. Unhandled event loop timer in test
    const timerDiff = [
      'diff --git a/tests/eventloop.test.ts b/tests/eventloop.test.ts',
      '--- a/tests/eventloop.test.ts',
      '+++ b/tests/eventloop.test.ts',
      '@@ -1,3 +1,5 @@',
      '+it("unhandled event loop evasion", () => {',
      '+  setTimeout(() => {',
      '+    expect(false).toBe(true);',
      '+  }, 100);',
      '+});'
    ].join('\n');
    assert.strictEqual(auditDiff(timerDiff).stats.tampering, 1);

    // 6. Dynamic string skip
    const concatSkipDiff = [
      'diff --git a/tests/concatskip.test.ts b/tests/concatskip.test.ts',
      '--- a/tests/concatskip.test.ts',
      '+++ b/tests/concatskip.test.ts',
      '@@ -1,2 +1,3 @@',
      '+it["sk" + "ip"]("auth test", () => { expect(false).toBe(true); });'
    ].join('\n');
    assert.strictEqual(auditDiff(concatSkipDiff).stats.tampering, 1);

    // 7. Constructor skip
    const stringSkipDiff = [
      'diff --git a/tests/strskip.test.ts b/tests/strskip.test.ts',
      '--- a/tests/strskip.test.ts',
      '+++ b/tests/strskip.test.ts',
      '@@ -1,2 +1,3 @@',
      '+it[String("skip")]("auth test", () => { expect(false).toBe(true); });'
    ].join('\n');
    assert.strictEqual(auditDiff(stringSkipDiff).stats.tampering, 1);

    // 8. Global runner monkey-patching
    const patchDiff = [
      'diff --git a/tests/patch.test.ts b/tests/patch.test.ts',
      '--- a/tests/patch.test.ts',
      '+++ b/tests/patch.test.ts',
      '@@ -1,2 +1,3 @@',
      '+globalThis.it = (name, fn) => orig(name, () => {});'
    ].join('\n');
    assert.strictEqual(auditDiff(patchDiff).stats.tampering, 1);

    // 9. Matcher hijacking
    const matcherDiff = [
      'diff --git a/tests/matcher.test.ts b/tests/matcher.test.ts',
      '--- a/tests/matcher.test.ts',
      '+++ b/tests/matcher.test.ts',
      '@@ -1,2 +1,3 @@',
      '+expect.extend({ toBeTrue: () => ({ pass: true, message: () => "" }) });'
    ].join('\n');
    assert.strictEqual(auditDiff(matcherDiff).stats.tampering, 1);

    // 10. ES6 String.fromCodePoint
    const fromCodePointDiff = [
      'diff --git a/src/codepoint.ts b/src/codepoint.ts',
      '--- a/src/codepoint.ts',
      '+++ b/src/codepoint.ts',
      '@@ -1,1 +1,1 @@',
      '+const k = String.fromCodePoint(65, 75, 73, 65) + "1234567890ABCDEF";'
    ].join('\n');
    assert.strictEqual(auditDiff(fromCodePointDiff).stats.secrets, 1);

    // 11. Hex numbers in fromCharCode
    const hexCharCodeDiff = [
      'diff --git a/src/hexchar.ts b/src/hexchar.ts',
      '--- a/src/hexchar.ts',
      '+++ b/src/hexchar.ts',
      '@@ -1,1 +1,1 @@',
      '+const k = String.fromCharCode(0x41, 0x4B, 0x49, 0x41) + "1234567890ABCDEF";'
    ].join('\n');
    assert.strictEqual(auditDiff(hexCharCodeDiff).stats.secrets, 1);

    // 12. Microtask event loop evasion
    const microtaskDiff = [
      'diff --git a/tests/microtask.test.ts b/tests/microtask.test.ts',
      '--- a/tests/microtask.test.ts',
      '+++ b/tests/microtask.test.ts',
      '@@ -1,3 +1,4 @@',
      '+queueMicrotask(() => { expect(false).toBe(true); });'
    ].join('\n');
    assert.strictEqual(auditDiff(microtaskDiff).stats.tampering, 1);

    // 13. Conditional skipIf
    const skipIfDiff = [
      'diff --git a/tests/skipif.test.ts b/tests/skipif.test.ts',
      '--- a/tests/skipif.test.ts',
      '+++ b/tests/skipif.test.ts',
      '@@ -1,2 +1,3 @@',
      '+test.skipIf(true)("auth test", () => { expect(false).toBe(true); });'
    ].join('\n');
    assert.strictEqual(auditDiff(skipIfDiff).stats.tampering, 1);

    // 14. Chained concurrent.skip
    const concurrentSkipDiff = [
      'diff --git a/tests/concurrent.test.ts b/tests/concurrent.test.ts',
      '--- a/tests/concurrent.test.ts',
      '+++ b/tests/concurrent.test.ts',
      '@@ -1,2 +1,3 @@',
      '+test.concurrent.skip("auth test", () => { expect(false).toBe(true); });'
    ].join('\n');
    assert.strictEqual(auditDiff(concurrentSkipDiff).stats.tampering, 1);
  });
});
