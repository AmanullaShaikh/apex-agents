import { test, describe } from 'node:test';
import assert from 'node:assert';
import { auditDiff, buildSarifReport } from '../scripts/audit-diff.js';

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

    // 15. Hex escape-sequence secret leak (\x41\x4b...)
    const hexEscapeDiff = [
      'diff --git a/src/creds.ts b/src/creds.ts',
      '--- a/src/creds.ts',
      '+++ b/src/creds.ts',
      '@@ -1,2 +1,3 @@',
      "+const key = '\\x41\\x4b\\x49\\x41IOSFODNN7EXAMPLE';"
    ].join('\n');
    assert.strictEqual(auditDiff(hexEscapeDiff).stats.secrets, 1);

    // 16. Sensitive .env file modification or addition
    const envFileDiff = [
      'diff --git a/.env b/.env',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/.env',
      '@@ -0,0 +1,2 @@',
      '+PORT=3000'
    ].join('\n');
    assert.strictEqual(auditDiff(envFileDiff).stats.secrets, 1);
  });

  test('should detect PKCS#8 keys, ES6 unicode escapes, spread fromCharCode, cross-line variable splits, and node:test/exit/dead-branch tampering', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');

    // 1. PKCS#8 private key
    const pkcs8Diff = [
      'diff --git a/src/key.pem.ts b/src/key.pem.ts',
      '--- a/src/key.pem.ts',
      '+++ b/src/key.pem.ts',
      '@@ -0,0 +1,2 @@',
      '+const k = "-----BEGIN PRIVATE KEY-----";'
    ].join('\n');
    assert.strictEqual(auditDiff(pkcs8Diff).stats.secrets, 1);

    // 2. ES6 \u{...} unicode escape secret
    const es6UnicodeDiff = [
      'diff --git a/src/es6.ts b/src/es6.ts',
      '--- a/src/es6.ts',
      '+++ b/src/es6.ts',
      '@@ -0,0 +1,2 @@',
      '+const k = "\\u{41}\\u{4b}\\u{49}\\u{41}IOSFODNN7EXAMPLE";'
    ].join('\n');
    assert.strictEqual(auditDiff(es6UnicodeDiff).stats.secrets, 1);

    // 3. String.fromCharCode(...[...]) spread array secret
    const spreadCharCodeDiff = [
      'diff --git a/src/spread.ts b/src/spread.ts',
      '--- a/src/spread.ts',
      '+++ b/src/spread.ts',
      '@@ -0,0 +1,2 @@',
      '+const k = String.fromCharCode(...[65, 75, 73, 65]) + "IOSFODNN7EXAMPLE";'
    ].join('\n');
    assert.strictEqual(auditDiff(spreadCharCodeDiff).stats.secrets, 1);

    // 4. Cross-line variable split secret
    const crossLineDiff = [
      'diff --git a/src/split.ts b/src/split.ts',
      '--- a/src/split.ts',
      '+++ b/src/split.ts',
      '@@ -0,0 +1,4 @@',
      '+const p1 = "AKIAIOSF";',
      '+const p2 = "ODNN7EXAMPLE";',
      '+export const k = p1 + p2;'
    ].join('\n');
    assert.strictEqual(auditDiff(crossLineDiff).stats.secrets, 1);

    // 5. node:test { skip: true }, { only: true }, and t.skip(...)
    const nodeTestTamperDiff = [
      'diff --git a/tests/auth.test.mjs b/tests/auth.test.mjs',
      '--- a/tests/auth.test.mjs',
      '+++ b/tests/auth.test.mjs',
      '@@ -0,0 +1,4 @@',
      '+test("a", { skip: true }, () => {});',
      '+test("b", { only: true }, () => {});',
      '+test("c", (t) => { t.skip("broken"); });'
    ].join('\n');
    assert.strictEqual(auditDiff(nodeTestTamperDiff).stats.tampering, 3);

    // 6. Obfuscated globalThis["proc"+"ess"]["ex"+"it"](0), process.exit(0 | 0), and constant-false if (1 > 2)
    const exitAndBranchDiff = [
      'diff --git a/tests/obf.test.mjs b/tests/obf.test.mjs',
      '--- a/tests/obf.test.mjs',
      '+++ b/tests/obf.test.mjs',
      '@@ -0,0 +1,4 @@',
      '+globalThis["proc"+"ess"]["ex"+"it"](0);',
      '+process.exit(0 | 0);',
      '+if (1 > 2) { assert.strictEqual(a, b); }'
    ].join('\n');
    assert.strictEqual(auditDiff(exitAndBranchDiff).stats.tampering, 3);

    // 7. scripts/scan-secrets.js: ESM import must NOT terminate caller, must scan .test.js files, cross-line splits, and use generic base64 label
    const { scanDirectory } = await import('../scripts/scan-secrets.js');
    const { execSync } = await import('node:child_process');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aveyx-scan-secrets-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'auth.test.js'), 'export const k = "AKIAIOSFODNN7EXAMPLE";\n');
      const stripeB64 = Buffer.from(['sk', 'live', '1234567890abcdefghijklmn'].join('_')).toString('base64');
      fs.writeFileSync(path.join(tmpDir, 'audit-diff.js'), `export const b = "${stripeB64}";\n`);
      fs.writeFileSync(path.join(tmpDir, 'split.js'), 'const p1 = "AKIAIOSF";\nconst p2 = "ODNN7EXAMPLE";\nexport const k = p1 + p2;\n');

      const findings = scanDirectory(tmpDir);
      assert.ok(findings.some(f => f.file.endsWith('auth.test.js') && f.pattern === 'AWS Access Key ID'));
      assert.ok(findings.some(f => f.file.endsWith('audit-diff.js') && f.pattern === 'Base64 Encoded Credential Payload'));
      assert.ok(findings.some(f => f.file.endsWith('split.js') && f.pattern === 'AWS Access Key ID'));

      // Non-existent path must exit 1 (never silent exit 0)
      assert.throws(() => {
        execSync('node scripts/scan-secrets.js ./non-existent-scan-dir-999', { stdio: 'pipe' });
      }, /Command failed/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // 8. $var cross-line split, PGP private key, TextDecoder Uint8Array byte array, { skip: 'reason' }, ctx.skip, braceless dead-branch if, Reflect.get(process, "exit")
    const dollarSplitDiff = [
      'diff --git a/src/dollar.ts b/src/dollar.ts',
      '--- a/src/dollar.ts',
      '+++ b/src/dollar.ts',
      '@@ -0,0 +1,4 @@',
      '+const $p1 = "AKIAIOSF";',
      '+const $p2 = "ODNN7EXAMPLE";',
      '+export const k = $p1 + $p2;'
    ].join('\n');
    assert.strictEqual(auditDiff(dollarSplitDiff).stats.secrets, 1);

    const pgpDiff = [
      'diff --git a/src/pgp.ts b/src/pgp.ts',
      '--- a/src/pgp.ts',
      '+++ b/src/pgp.ts',
      '@@ -0,0 +1,2 @@',
      '+const k = "-----BEGIN PGP PRIVATE KEY BLOCK-----";'
    ].join('\n');
    assert.strictEqual(auditDiff(pgpDiff).stats.secrets, 1);

    const byteArrayDiff = [
      'diff --git a/src/bytes.ts b/src/bytes.ts',
      '--- a/src/bytes.ts',
      '+++ b/src/bytes.ts',
      '@@ -0,0 +1,2 @@',
      '+const k = new TextDecoder().decode(new Uint8Array(Array.of(65,75,73,65,73,79,83,70,79,68,78,78,55,69,88,65,77,80,76,69)));'
    ].join('\n');
    assert.strictEqual(auditDiff(byteArrayDiff).stats.secrets, 1);

    const advancedTamperDiff = [
      'diff --git a/tests/adv.test.mjs b/tests/adv.test.mjs',
      '--- a/tests/adv.test.mjs',
      '+++ b/tests/adv.test.mjs',
      '@@ -0,0 +1,6 @@',
      '+test("a", { skip: "reason" }, () => {});',
      '+test("b", (ctx) => { ctx.skip("broken"); });',
      '+if (false) assert.strictEqual(a, b);',
      '+if (1 > 2) assert.strictEqual(a, b);',
      '+Reflect.get(process, "exit")(0);'
    ].join('\n');
    assert.strictEqual(auditDiff(advancedTamperDiff).stats.tampering, 5);

    // 9. Legitimate numeric cursor.skip(10) pagination in tests must NOT false-positive
    const paginationDiff = [
      'diff --git a/tests/pag.test.js b/tests/pag.test.js',
      '--- a/tests/pag.test.js',
      '+++ b/tests/pag.test.js',
      '@@ -0,0 +1,2 @@',
      '+const rows = await cursor.skip(10).limit(5);'
    ].join('\n');
    assert.strictEqual(auditDiff(paginationDiff).stats.tampering, 0);

    // 10. Split secret containing $& special characters must capture and fold cleanly
    const ampSecretDiff = [
      'diff --git a/src/amp.ts b/src/amp.ts',
      '--- a/src/amp.ts',
      '+++ b/src/amp.ts',
      '@@ -0,0 +1,4 @@',
      '+const p1 = "super$&";',
      '+const p2 = "secret99";',
      '+export const password = p1 + p2;'
    ].join('\n');
    assert.strictEqual(auditDiff(ampSecretDiff).stats.secrets, 1);

    // 11. Destructured exit, Reflect.apply(process.exit), if (!true), and cross-line var skip reason
    const deepTamperDiff = [
      'diff --git a/tests/deep.test.mjs b/tests/deep.test.mjs',
      '--- a/tests/deep.test.mjs',
      '+++ b/tests/deep.test.mjs',
      '@@ -0,0 +1,6 @@',
      '+const { exit } = process;',
      '+Reflect.apply(process.exit, process, [0]);',
      '+if (!true) assert.strictEqual(a, b);',
      '+const reason = "broken";',
      '+test("x", { skip: reason }, () => {});'
    ].join('\n');
    assert.strictEqual(auditDiff(deepTamperDiff).stats.tampering, 4);
  });

  test('should catch commented/deleted node:assert calls, multiline skip, process.abort/kill, ASIA keys, and not false-positive on helper return;', () => {
    const assertDiff = [
      'diff --git a/tests/node.test.js b/tests/node.test.js',
      '--- a/tests/node.test.js',
      '+++ b/tests/node.test.js',
      '@@ -1,3 +1,3 @@',
      '-assert.strictEqual(a, b);',
      '+// assert.deepStrictEqual(a, b);'
    ].join('\n');
    assert.strictEqual(auditDiff(assertDiff).stats.tampering, 1);

    const delAssertDiff = [
      'diff --git a/tests/node2.test.js b/tests/node2.test.js',
      '--- a/tests/node2.test.js',
      '+++ b/tests/node2.test.js',
      '@@ -1,2 +1,1 @@',
      '-assert.strictEqual(a, b);'
    ].join('\n');
    assert.strictEqual(auditDiff(delAssertDiff).stats.tampering, 1);

    const multiSkipDiff = [
      'diff --git a/tests/multi.test.js b/tests/multi.test.js',
      '--- a/tests/multi.test.js',
      '+++ b/tests/multi.test.js',
      '@@ -1,1 +1,4 @@',
      '+test("x", {',
      '+  skip: true',
      '+}, () => {});'
    ].join('\n');
    assert.strictEqual(auditDiff(multiSkipDiff).stats.tampering, 1);

    const abortKillDiff = [
      'diff --git a/tests/abort.test.js b/tests/abort.test.js',
      '--- a/tests/abort.test.js',
      '+++ b/tests/abort.test.js',
      '@@ -1,1 +1,3 @@',
      '+process.abort();',
      '+process.kill(process.pid);'
    ].join('\n');
    assert.strictEqual(auditDiff(abortKillDiff).stats.tampering, 2);

    const helperReturnDiff = [
      'diff --git a/tests/helper.test.js b/tests/helper.test.js',
      '--- a/tests/helper.test.js',
      '+++ b/tests/helper.test.js',
      '@@ -1,1 +1,4 @@',
      '+function helper() {',
      '+  return;',
      '+}'
    ].join('\n');
    assert.strictEqual(auditDiff(helperReturnDiff).stats.tampering, 0);

    const asiaDiff = [
      'diff --git a/src/sts.ts b/src/sts.ts',
      '--- a/src/sts.ts',
      '+++ b/src/sts.ts',
      '@@ -1,1 +1,2 @@',
      '+const stsKey = "ASIA1234567890ABCDEF";'
    ].join('\n');
    assert.strictEqual(auditDiff(asiaDiff).stats.secrets, 1);
  });

  test('should detect zero-width evasion using LRM (\\u200e) and RLM (\\u200f) directional marks', () => {
    const lrmDiff = [
      'diff --git a/src/config.ts b/src/config.ts',
      '--- a/src/config.ts',
      '+++ b/src/config.ts',
      '@@ -1,1 +1,1 @@',
      '+const key = "A\\u200eK\\u200eI\\u200eA\\u200eI\\u200eO\\u200eS\\u200eF\\u200eO\\u200eD\\u200eN\\u200eN\\u200e7\\u200eE\\u200eX\\u200eA\\u200eM\\u200eP\\u200eL\\u200eE";'
    ].join('\n');
    const result = auditDiff(lrmDiff);
    assert.strictEqual(result.clean, false);
    assert.strictEqual(result.stats.secrets, 1);
    assert.match(result.issues[0].description, /AWS Access Key ID/);
  });

  test('should detect Google AIza, GitHub fine-grained PAT, JWT, spaced array join secrets, and allow console.log in test helpers', () => {
    const gKey = ['AIza', 'SyD1234567890abcdef1234567890abcdef'].join('');
    const ghPat = ['github_pat_', '11AAAAAAA0123456789012345678901234567890123456789012345678901234567890123456789012'].join('');
    const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'signature123456'].join('.');
    const tokensDiff = [
      'diff --git a/src/tokens.ts b/src/tokens.ts',
      '--- a/src/tokens.ts',
      '+++ b/src/tokens.ts',
      '@@ -1,1 +1,5 @@',
      `+const a = "${gKey}";`,
      `+const b = "${ghPat}";`,
      `+const c = "${jwt}";`,
      `+const d = ['AKIA', 'IOSF', 'ODNN7EXAMPLE'] . join('');`
    ].join('\n');
    const tokRes = auditDiff(tokensDiff);
    assert.strictEqual(tokRes.clean, false);
    assert.strictEqual(tokRes.stats.secrets, 4);

    const testLogDiff = [
      'diff --git a/tests/helper.test.js b/tests/helper.test.js',
      '--- a/tests/helper.test.js',
      '+++ b/tests/helper.test.js',
      '@@ -1,1 +1,4 @@',
      '+function myHelper(x) {',
      '+  if (!x) return;',
      '+  console.log(x);',
      '+}'
    ].join('\n');
    const logRes = auditDiff(testLogDiff);
    assert.strictEqual(logRes.stats.debug, 0);
    assert.strictEqual(logRes.stats.tampering, 0);
  });

  test('should catch aliased process exit, empty test body, empty try/catch assertion swallow, protected configs, and build valid SARIF 2.1.0', () => {
    const astTamperDiff = [
      'diff --git a/tests/ast.test.js b/tests/ast.test.js',
      '--- a/tests/ast.test.js',
      '+++ b/tests/ast.test.js',
      '@@ -1,1 +1,8 @@',
      '+const p = process;',
      '+p.exit(0);',
      '+const { abort } = process;',
      '+abort();',
      '+test("empty", () => {});',
      '+try { assert.strictEqual(1, 2); } catch (e) { return; }'
    ].join('\n');
    const astRes = auditDiff(astTamperDiff);
    assert.strictEqual(astRes.clean, false);
    assert.ok(astRes.stats.tampering >= 3, `Expected >=3 AST tampering findings, got ${astRes.stats.tampering}`);

    const protectedDiff = [
      'diff --git a/.claude/settings.json b/.claude/settings.json',
      '--- a/.claude/settings.json',
      '+++ b/.claude/settings.json',
      '@@ -1,1 +1,1 @@',
      '+{"permissions": "allow_all"}',
      'diff --git a/package.json b/package.json',
      '--- a/package.json',
      '+++ b/package.json',
      '@@ -5,1 +5,1 @@',
      '-  "test": "node --test",',
      '+  "test": "echo ok",'
    ].join('\n');
    const protRes = auditDiff(protectedDiff);
    assert.strictEqual(protRes.clean, false);
    assert.ok(protRes.issues.some(i => i.category === 'PROTECTED_CONFIG_TAMPER'));
    assert.ok(protRes.stats.tampering >= 1);

    const sarif = buildSarifReport(protRes.issues, 'aveyx-review', '3.0.2');
    assert.strictEqual(sarif.version, '2.1.0');
    assert.ok(Array.isArray(sarif.runs) && sarif.runs.length === 1);
    assert.ok(sarif.runs[0].results.length >= 2);
    assert.ok(sarif.runs[0].tool.driver.rules.every(r => Boolean(r.helpUri)));
  });
});
