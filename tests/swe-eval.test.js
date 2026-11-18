import { test, describe } from 'node:test';
import assert from 'node:assert';
import { runSweMiniBenchmark } from '../scripts/swe-eval.js';

describe('Internal AST & Engine Self-Check Harness Suite', () => {
  test('should execute 5 internal verification vectors and pass cleanly', async () => {
    const report = await runSweMiniBenchmark();
    assert.strictEqual(report.results.length, 5);
    assert.strictEqual(report.score, 100);
    assert.strictEqual(report.grade, 'PASS (5/5 Internal Vectors)');
    assert.ok(report.durationMs < 5000);
  });
});
