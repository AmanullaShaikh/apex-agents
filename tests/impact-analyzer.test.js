import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { analyzeImpact } from '../scripts/impact-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const IMPACT_BIN = path.join(ROOT_DIR, 'scripts', 'impact-analyzer.js');

describe('AST Blast-Radius & Impact Analyzer Suite', () => {
  test('should compute direct dependents, transitive dependents, and affected test suites', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-impact-test-'));
    try {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });

      fs.writeFileSync(path.join(tmpDir, 'src', 'core.js'), 'export const VERSION = 1;\n');
      fs.writeFileSync(path.join(tmpDir, 'src', 'service.js'), "import { VERSION } from './core.js';\nexport const v = VERSION;\n");
      fs.writeFileSync(path.join(tmpDir, 'src', 'routes.js'), "import { v } from './service.js';\nexport const r = v;\n");
      fs.writeFileSync(path.join(tmpDir, 'tests', 'routes.test.js'), "import { r } from '../src/routes.js';\nconsole.log(r);\n");

      const report = analyzeImpact(['src/core.js'], tmpDir);
      assert.deepStrictEqual(report.directDependents, ['src/service.js']);
      assert.deepStrictEqual(report.transitiveDependents, ['src/routes.js', 'tests/routes.test.js']);
      assert.deepStrictEqual(report.affectedTests, ['tests/routes.test.js']);
      assert.strictEqual(report.riskLevel, 'MEDIUM');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should handle cyclic imports without infinite loops and reject invalid CLI inputs', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-impact-cycle-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), "import './b.js';\n");
      fs.writeFileSync(path.join(tmpDir, 'b.js'), "import './a.js';\n");
      const report = analyzeImpact(['a.js'], tmpDir);
      assert.deepStrictEqual(report.directDependents, ['b.js']);

      assert.throws(() => {
        execSync(`node "${IMPACT_BIN}" --bogus-flag`, { stdio: 'pipe', cwd: tmpDir });
      }, /Command failed/);

      assert.throws(() => {
        execSync(`node "${IMPACT_BIN}" nonexistent-file.js`, { stdio: 'pipe', cwd: tmpDir });
      }, /Command failed/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
