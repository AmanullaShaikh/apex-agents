import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { setTimeout as delay } from 'node:timers/promises';
import {
  detectTestRunner,
  parseTestFailures,
  generateFixPrompt,
  isTestFile,
  detectNoRunner,
  resolveImplementationTarget
} from '../scripts/test-loop.js';

describe('Test-Loop & Transactional Self-Healing Suite', () => {
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

  test('should NOT false-positive isNoRunner on real test assertions containing "not found" or "Cannot find module"', async () => {
    assert.strictEqual(detectNoRunner(1, '', "AssertionError [ERR_ASSERTION]: user not found"), false);
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
      const { runTestLoop } = await import('../scripts/test-loop.js');
      const res = await runTestLoop(tmpDir, 'node --test user.test.mjs');
      assert.strictEqual(res.success, false);
      assert.strictEqual(fs.existsSync(path.join(tmpDir, 'APEX_FIX_PROMPT.md')), true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should strictly refuse to modify test files during --heal (zero test tampering)', async () => {
    const { attemptAutoHeal } = await import('../scripts/test-loop.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-no-tamper-'));
    try {
      const testFile = path.join(tmpDir, 'greet.test.mjs');
      const originalTest = `import { test } from 'node:test';\nimport assert from 'node:assert';\ntest('greets', () => { assert.strictEqual('hi', 'hello'); });\n`;
      fs.writeFileSync(testFile, originalTest);

      assert.strictEqual(isTestFile(testFile), true);
      assert.strictEqual(isTestFile('tests/foo.js'), true);
      assert.strictEqual(isTestFile('src/greet.js'), false);

      const mockFailures = [{
        file: testFile,
        error: "AssertionError: Expected 'hi' to equal 'hello'",
        stack: [`at ${testFile}:3:25`]
      }];

      const res = await attemptAutoHeal(tmpDir, mockFailures, 'AssertionError');
      assert.strictEqual(res.healed, false);
      assert.strictEqual(res.reason, 'TEST_FILE_PROTECTED_DELEGATED_TO_IDE');
      // Test file must remain 100% untouched byte-for-byte
      assert.strictEqual(fs.readFileSync(testFile, 'utf-8'), originalTest);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should support slow Ollama generation (>1.5s), verify re-test, and auto-rollback broken patches', async () => {
    const { attemptAutoHeal } = await import('../scripts/test-loop.js');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-ollama-tx-'));
    let mode = 'broken';

    const server = http.createServer(async (req, res) => {
      if (req.url === '/api/tags') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: [{ name: 'qwen2.5-coder:latest' }] }));
      } else if (req.url === '/api/generate') {
        // Delay 1800ms (> old 1500ms bug) to prove two-stage timeout handles real LLM latency
        await delay(1800);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (mode === 'broken') {
          res.end(JSON.stringify({ response: '```js\nexport function add(a, b) { return a * b; }\n```' }));
        } else {
          res.end(JSON.stringify({ response: '```js\nexport function add(a, b) { return a + b; }\n```' }));
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const ollamaHost = `http://127.0.0.1:${port}`;

    try {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      const srcFile = path.join(tmpDir, 'src', 'add.mjs');
      const testFile = path.join(tmpDir, 'add.test.mjs');
      const originalSrc = 'export function add(a, b) { return a - b; }\n';
      const originalTest = `import { test } from 'node:test';\nimport assert from 'node:assert';\nimport { add } from './src/add.mjs';\ntest('adds', () => { assert.strictEqual(add(2, 3), 5); });\n`;
      fs.writeFileSync(srcFile, originalSrc);
      fs.writeFileSync(testFile, originalTest);

      const resolved = resolveImplementationTarget(tmpDir, [{ file: testFile, stack: [] }]);
      assert.ok(resolved);
      assert.strictEqual(resolved.relPath, 'src/add.mjs');

      const failures = [{ file: testFile, error: 'AssertionError: -1 !== 5', stack: [] }];

      // 1. Broken patch -> must rollback src/add.mjs to originalSrc
      mode = 'broken';
      const brokenRes = await attemptAutoHeal(tmpDir, failures, 'fail', {
        ollamaHost,
        ollamaTimeoutMs: 10000,
        testCmd: 'node --test add.test.mjs'
      });
      assert.strictEqual(brokenRes.healed, false);
      assert.strictEqual(brokenRes.reason, 'ROLLBACK_TEST_VERIFICATION_FAILED');
      assert.strictEqual(fs.readFileSync(srcFile, 'utf-8'), originalSrc);
      assert.strictEqual(fs.readFileSync(testFile, 'utf-8'), originalTest);

      // 2. Valid patch (with 1.8s delay) -> must succeed and verify exit 0
      mode = 'valid';
      const goodRes = await attemptAutoHeal(tmpDir, failures, 'fail', {
        ollamaHost,
        ollamaTimeoutMs: 10000,
        testCmd: 'node --test add.test.mjs'
      });
      assert.strictEqual(goodRes.healed, true);
      assert.strictEqual(goodRes.verified, true);
      assert.match(fs.readFileSync(srcFile, 'utf-8'), /return a \+ b/);
      // Test file NEVER modified
      assert.strictEqual(fs.readFileSync(testFile, 'utf-8'), originalTest);
    } finally {
      server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should handle attemptAutoHeal gracefully with zero API keys and delegate to IDE agent', async () => {
    const { attemptAutoHeal } = await import('../scripts/test-loop.js');
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const emptyRes = await attemptAutoHeal(process.cwd(), [], 'sample crash');
      assert.strictEqual(emptyRes.healed, false);
      assert.strictEqual(emptyRes.reason, 'NO_FAILURES');

      const mockFailures = [{
        file: 'non_existent_file_xyz.ts',
        error: 'General complex unresolvable logic error'
      }];
      const delegRes = await attemptAutoHeal(process.cwd(), mockFailures, 'sample crash');
      assert.strictEqual(delegRes.healed, false);
      assert.strictEqual(delegRes.reason, 'TARGET_FILE_NOT_FOUND');
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
