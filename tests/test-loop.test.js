import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import {
  detectTestRunner,
  parseTestFailures,
  generateFixPrompt,
  detectNoRunner,
  runTestLoop
} from '../scripts/test-loop.js';

describe('Deterministic Test-Loop Runner & Fix Prompt Suite', () => {
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

  test('should parse test failure traces accurately including Windows file:/// paths and node --test deduplication', () => {
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

    // Deduplicate summary + detailed node --test output and preserve Windows drive letters
    const nodeTestOutput = `
✖ greet returns hello (3.1ms)
ℹ tests 1
ℹ fail 1

✖ failing tests:

test at file:///C:/Users/dev/app/greet.test.mjs:4:1
✖ greet returns hello (3.1ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  expected: 'hello'
  actual: 'hi'
    at TestContext.<anonymous> (file:///C:/Users/dev/app/greet.test.mjs:4:31)
    `;

    const deduped = parseTestFailures(nodeTestOutput);
    assert.strictEqual(deduped.length, 1);
    assert.strictEqual(deduped[0].file, 'C:/Users/dev/app/greet.test.mjs');
    assert.strictEqual(deduped[0].line, 4);
    assert.strictEqual(deduped[0].expected, "'hello'");
    assert.strictEqual(deduped[0].actual, "'hi'");
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
      assert.match(content, /# APEX AGENTS: TEST FAILURE FIX PROMPT/);
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
      const res = await runTestLoop(tmpDir);
      assert.strictEqual(res.success, false);
      assert.strictEqual(fs.existsSync(path.join(tmpDir, 'APEX_FIX_PROMPT.md')), false);

      // Verify custom non-existent command does not produce fake prompt
      const resMissing = await runTestLoop(tmpDir, 'non_existent_binary_tool_xyz_123');
      assert.strictEqual(resMissing.success, false);
      assert.strictEqual(fs.existsSync(path.join(tmpDir, 'APEX_FIX_PROMPT.md')), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should NOT false-positive detectNoRunner on real test assertions containing "not found" or "Cannot find module"', async () => {
    assert.strictEqual(detectNoRunner(1, '', 'AssertionError [ERR_ASSERTION]: user not found'), false);
    assert.strictEqual(detectNoRunner(1, '', "Error: Cannot find module './missing-helper'"), false);
    assert.strictEqual(detectNoRunner(127, '', '/bin/sh: 1: vitest: not found'), true);
    assert.strictEqual(detectNoRunner(1, '', "'fakebin' is not recognized as an internal or external command"), true);
    assert.strictEqual(detectNoRunner(1, '', 'npm error Missing script: "test"'), true);

    // End-to-end real node:test failure with "user not found" MUST generate APEX_FIX_PROMPT.md
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-notfound-err-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'user.test.mjs'), `
        import { test } from 'node:test';
        import assert from 'node:assert';
        test('finds user', () => { assert.ok(false, 'user not found'); });
      `);
      const res = await runTestLoop(tmpDir, 'node --test user.test.mjs');
      assert.strictEqual(res.success, false);
      assert.strictEqual(fs.existsSync(path.join(tmpDir, 'APEX_FIX_PROMPT.md')), true);
      assert.strictEqual(res.failures.length, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should support unquoted multi-token CLI test commands without spawning Node REPL', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-unquoted-cli-'));
    try {
      const testFile = path.join(tmpDir, 'ok.test.mjs');
      fs.writeFileSync(testFile, `import { test } from 'node:test';\nimport assert from 'node:assert';\ntest('ok', () => { assert.strictEqual(1 + 1, 2); });\n`);
      const scriptPath = path.resolve(process.cwd(), 'scripts', 'test-loop.js');
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_TEST_CONTEXT;
      const out = execSync(`node "${scriptPath}" node --test ok.test.mjs`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 8000,
        env: cleanEnv
      });
      assert.match(out, /ALL TESTS PASSING/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should clean stale APEX_FIX_PROMPT.md once tests pass', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-clean-prompt-'));
    try {
      const promptPath = path.join(tmpDir, 'APEX_FIX_PROMPT.md');
      fs.writeFileSync(promptPath, '# stale prompt');
      fs.writeFileSync(path.join(tmpDir, 'pass.test.mjs'), `import { test } from 'node:test';\nimport assert from 'node:assert';\ntest('passes', () => { assert.strictEqual(2 + 2, 4); });\n`);

      const res = await runTestLoop(tmpDir, 'node --test pass.test.mjs');
      assert.strictEqual(res.success, true);
      assert.strictEqual(fs.existsSync(promptPath), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should reject removed --heal flag with non-zero exit code', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'test-loop.js');
    assert.throws(() => {
      execSync(`node "${scriptPath}" --heal`, { stdio: 'pipe' });
    }, /Command failed/);
  });
});
