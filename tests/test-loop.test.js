import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectTestRunner, parseTestFailures, generateFixPrompt } from '../scripts/test-loop.js';

describe('Autonomous Test-Loop & Self-Healing Suite', () => {
  test('should detect test runner from package.json or config files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-testloop-'));
    try {
      // 1. package.json with test:unit
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        scripts: { 'test:unit': 'vitest run' }
      }));
      assert.strictEqual(detectTestRunner(tmpDir), 'npm run test:unit');

      // 2. package.json with test
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        scripts: { test: 'jest --coverage' }
      }));
      assert.strictEqual(detectTestRunner(tmpDir), 'npm test');

      // 3. vitest.config.ts fallback
      fs.unlinkSync(path.join(tmpDir, 'package.json'));
      fs.writeFileSync(path.join(tmpDir, 'vitest.config.ts'), 'export default {}');
      assert.strictEqual(detectTestRunner(tmpDir), 'npx vitest run');

      // 4. jest.config.js fallback
      fs.unlinkSync(path.join(tmpDir, 'vitest.config.ts'));
      fs.writeFileSync(path.join(tmpDir, 'jest.config.js'), 'module.exports = {}');
      assert.strictEqual(detectTestRunner(tmpDir), 'npx jest');

      // 5. Cargo.toml (Rust)
      fs.unlinkSync(path.join(tmpDir, 'jest.config.js'));
      fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "test"');
      assert.strictEqual(detectTestRunner(tmpDir), 'cargo test');

      // 6. pytest.ini (Python)
      fs.unlinkSync(path.join(tmpDir, 'Cargo.toml'));
      fs.writeFileSync(path.join(tmpDir, 'pytest.ini'), '[pytest]');
      assert.strictEqual(detectTestRunner(tmpDir), 'pytest');

      // 7. pnpm detection
      fs.unlinkSync(path.join(tmpDir, 'pytest.ini'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest' } }));
      fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 5.4');
      assert.strictEqual(detectTestRunner(tmpDir), 'pnpm test');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should parse test failure traces accurately', () => {
    const sampleOutput = `
      ▶ UserService test suite
        ✔ should fetch user by id (12ms)
        ✖ should reject invalid credentials (45ms)
          AssertionError: expected 401 but received 500
            at c:\\projects\\auth\\user.test.ts:42:15
            at processTicksAndRejections (node:internal/process/task_queues:95:5)
      ℹ tests 2
      ℹ pass 1
      ℹ fail 1
    `;

    const failures = parseTestFailures(sampleOutput);
    assert.strictEqual(failures.length, 1);
    assert.strictEqual(failures[0].name, 'should reject invalid credentials (45ms)');
    assert.match(failures[0].file, /user\.test\.ts/);
    assert.strictEqual(failures[0].line, 42);
    assert.match(failures[0].error, /AssertionError: expected 401 but received 500/);
    assert.strictEqual(failures[0].stack.length, 2);
  });

  test('should generate structured APEX_FIX_PROMPT.md with anti-tampering constraints', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-fixprompt-'));
    try {
      const mockFailures = [
        {
          name: 'computeHash should be deterministic',
          file: 'tests/crypto.test.ts',
          line: 18,
          error: 'AssertionError [ERR_ASSERTION]: Expected "a1b2" to equal "c3d4"',
          stack: ['at tests/crypto.test.ts:18:7']
        }
      ];

      const promptFile = generateFixPrompt(tmpDir, mockFailures, 'Full mock failure log');
      assert.strictEqual(fs.existsSync(promptFile), true);

      const content = fs.readFileSync(promptFile, 'utf-8');
      assert.match(content, /# APEX AGENTS: AUTONOMOUS TEST FAILURE FIX PROMPT/);
      assert.match(content, /computeHash should be deterministic/);
      assert.match(content, /tests\/crypto\.test\.ts/);
      assert.match(content, /STRICT NEGATIVE CONSTRAINTS/);
      assert.match(content, /DO NOT.*it\.only.*test\.skip/);
      assert.match(content, /REQUIRED AGENT WORKFLOW/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should not generate fake fix prompt when no test runner or script is configured', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-notest-'));
    try {
      const { runTestLoop } = await import('../scripts/test-loop.js');
      const res = await runTestLoop(tmpDir);
      assert.strictEqual(res.success, false);
      assert.strictEqual(fs.existsSync(path.join(tmpDir, 'APEX_FIX_PROMPT.md')), false);

      // Verify custom non-existent command (: not found) does not produce fake prompt
      const resMissing = await runTestLoop(tmpDir, 'non_existent_binary_tool_xyz_123');
      assert.strictEqual(resMissing.success, false);
      assert.strictEqual(fs.existsSync(path.join(tmpDir, 'APEX_FIX_PROMPT.md')), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should handle attemptAutoHeal gracefully when no API keys are present', async () => {
    const { attemptAutoHeal } = await import('../scripts/test-loop.js');
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const res = await attemptAutoHeal(process.cwd(), [], 'sample crash');
      assert.strictEqual(res.healed, false);
      assert.strictEqual(res.reason, 'NO_API_KEY');
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
