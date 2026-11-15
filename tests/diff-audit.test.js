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
});
