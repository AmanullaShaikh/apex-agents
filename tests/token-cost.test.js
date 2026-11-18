import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { computeTokenCost, estimateTokens } from '../scripts/token-cost.js';

describe('Multi-Model Token Cost & Window Predictor Suite', () => {
  test('should estimate tokens accurately from char counts', () => {
    assert.strictEqual(estimateTokens(380), 100);
    assert.strictEqual(estimateTokens(0), 0);
  });

  test('should estimate tokens using subword BPE tokenizer regex', () => {
    const text = 'function calculateTotal(price: number, tax: number): number { return price * (1 + tax); }';
    const tokens = estimateTokens(text);
    assert.ok(tokens > 10 && tokens < 35);
    assert.strictEqual(estimateTokens(''), 0);
  });

  test('should compute multi-model context window usage and pricing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-cost-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'large.ts'), 'const x = "hello world";\n'.repeat(100));

      const report = computeTokenCost(tmpDir);
      assert.strictEqual(report.scannedFiles, 1);
      assert.strictEqual(report.pricingUpdated, '2026-11');
      assert.ok(report.totalTokens > 0);
      assert.ok(report.compactedTokensEst < report.totalTokens);
      assert.strictEqual(report.modelProjections.length, 10);

      const astra = report.modelProjections.find(m => m.model === 'GPT-6 Astra');
      assert.ok(astra);
      assert.strictEqual(astra.contextLimit, 1050000);
      assert.ok(astra.costPerTurn >= 0);

      const argon = report.modelProjections.find(m => m.model === 'Gemini 4 Argon');
      assert.ok(argon);
      assert.strictEqual(argon.contextLimit, 1048576);

      const spark = report.modelProjections.find(m => m.model === 'Meta Muse Spark');
      assert.ok(spark);
      assert.strictEqual(spark.contextLimit, 1048576);

      const sonnet = report.modelProjections.find(m => m.model === 'Claude Sonnet 5.5');
      assert.ok(sonnet);
      assert.strictEqual(sonnet.contextLimit, 1000000);

      const grok = report.modelProjections.find(m => m.model === 'Grok 4.7');
      assert.ok(grok);
      assert.strictEqual(grok.contextLimit, 500000);

      const deepseek = report.modelProjections.find(m => m.model === 'DeepSeek V4-Pro');
      assert.ok(deepseek);
      assert.strictEqual(deepseek.contextLimit, 1000000);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
