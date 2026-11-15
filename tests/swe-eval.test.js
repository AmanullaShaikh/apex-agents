import { test, describe } from 'node:test';
import assert from 'node:assert';
import { runSweMiniBenchmark } from '../scripts/swe-eval.js';

describe('SWE-Bench Mini Evaluation Harness Suite', () => {
  test('should execute 5 SWE benchmark vectors and achieve Grade A+', async () => {
    const report = await runSweMiniBenchmark();
    assert.strictEqual(report.results.length, 5);
    assert.strictEqual(report.score, 100);
    assert.strictEqual(report.grade, 'A+ (Sovereign Tier)');
    assert.ok(report.durationMs < 5000);
  });
});
