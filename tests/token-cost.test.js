import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { computeTokenCost, estimateTokens, countBpeTokens } from '../scripts/token-cost.js';

describe('Token Volume & Measured AST Compaction Auditor Suite', () => {
  test('should estimate tokens from numeric char counts', () => {
    assert.strictEqual(estimateTokens(380), 100);
    assert.strictEqual(estimateTokens(0), 0);
  });

  test('should estimate tokens using subword regex tokenizer', () => {
    const text = 'function calculateTotal(price: number, tax: number): number { return price * (1 + tax); }';
    const tokens = countBpeTokens(text);
    assert.ok(tokens > 10 && tokens < 35);
    assert.strictEqual(estimateTokens(text), tokens);
    assert.strictEqual(estimateTokens(''), 0);
  });

  test('should measure actual AST compaction savings without hardcoded vendor tables', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aveyx-cost-test-'));
    try {
      const sampleTs = `
        export interface Invoice {
          id: string;
          subtotal: number;
          taxRate: number;
        }

        export function calculateInvoiceTotal(inv: Invoice): number {
          const base = inv.subtotal;
          const tax = base * inv.taxRate;
          const discount = base > 500 ? base * 0.05 : 0;
          const handlingFee = 12.5;
          const intermediate = base + tax - discount + handlingFee;
          const rounded = Math.round(intermediate * 100) / 100;
          return rounded;
        }
      `.repeat(5);

      fs.writeFileSync(path.join(tmpDir, 'billing.ts'), sampleTs);
      fs.writeFileSync(path.join(tmpDir, 'notes.md'), '# Notes\nShort project note.\n');

      const report = computeTokenCost(tmpDir);
      assert.strictEqual(report.scannedFiles, 2);
      assert.ok(report.totalTokens > 0);
      assert.ok(report.rawCodeTokens > 0);
      assert.ok(report.compactedCodeTokens > 0);
      assert.ok(report.compactedCodeTokens < report.rawCodeTokens, 'AST compaction must genuinely shrink code tokens');
      assert.ok(report.codeSavingsPercent > 20, `Expected real >20% AST reduction, got ${report.codeSavingsPercent}%`);
      assert.strictEqual(report.customCost, null);
      assert.strictEqual(report.topFiles.length, 2);
      assert.strictEqual(report.topFiles[0].file, 'billing.ts');

      // Custom user-supplied rate (--price-in=<$/1M>)
      const pricedReport = computeTokenCost(tmpDir, { priceInPerMillion: 2.0 });
      assert.ok(pricedReport.customCost);
      assert.strictEqual(pricedReport.customCost.priceInPerMillion, 2.0);
      assert.ok(pricedReport.customCost.rawCodeCostPerLoad >= pricedReport.customCost.compactedCodeCostPerLoad);
      assert.ok(pricedReport.customCost.savingsTenTurns >= 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
