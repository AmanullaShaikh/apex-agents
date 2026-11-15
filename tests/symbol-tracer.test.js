import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { traceSymbol, formatTraceReport } from '../scripts/symbol-tracer.js';

describe('Local Semantic Symbol Tracer Suite', () => {
  test('should detect declarations and call sites across project files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-trace-test-'));
    try {
      // Create target module with definition
      const targetFile = path.join(tmpDir, 'authService.ts');
      fs.writeFileSync(targetFile, `
        export function verifyToken(token: string) {
          return token.length > 10;
        }
      `);

      // Create caller 1
      const caller1 = path.join(tmpDir, 'middleware.ts');
      fs.writeFileSync(caller1, `
        import { verifyToken } from './authService';
        export function authMiddleware(req) {
          const valid = verifyToken(req.headers.auth);
          return valid;
        }
      `);

      // Create caller 2
      const caller2 = path.join(tmpDir, 'routes.ts');
      fs.writeFileSync(caller2, `
        import { verifyToken } from './authService';
        verifyToken('direct-call');
      `);

      const trace = traceSymbol('verifyToken', tmpDir);
      assert.strictEqual(trace.symbol, 'verifyToken');
      assert.strictEqual(trace.declarations.length, 1);
      assert.strictEqual(trace.declarations[0].type, 'function');
      assert.strictEqual(trace.declarations[0].exported, true);
      assert.strictEqual(trace.callers.length, 2);

      const report = formatTraceReport(trace);
      assert.match(report, /SYMBOL TRACE DOSSIER/);
      assert.match(report, /verifyToken/);
      assert.match(report, /middleware\.ts/);
      assert.match(report, /routes\.ts/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should reject empty symbol name', () => {
    assert.throws(() => {
      traceSymbol('');
    }, /Symbol name is required/);
  });
});
