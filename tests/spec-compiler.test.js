import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { compileSpec, validateSpec } from '../scripts/spec-compiler.js';

describe('Spec-First Architectural Compiler Suite', () => {
  test('should compile a comprehensive 5-phase SPEC.md from intent', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-spec-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'types.ts'), 'export interface UserAccount { id: string; }\nexport type AuthToken = string;\n');
      const res = compileSpec('Stripe Webhook Subscription Sync', tmpDir);
      assert.strictEqual(fs.existsSync(res.path), true);
      assert.match(res.content, /APEX AGENTS: ARCHITECTURAL SPECIFICATION/);
      assert.match(res.content, /Stripe Webhook Subscription Sync/);
      assert.match(res.content, /STRICT NEGATIVE CONSTRAINTS/);
      assert.match(res.content, /TDD ACCEPTANCE CRITERIA/);
      assert.match(res.content, /SEQUENTIAL EXECUTION PROTOCOL/);
      assert.match(res.content, /z\.object\(\{/);
      assert.match(res.content, /Discriminated Union Result/);
      assert.match(res.content, /Ingress Wire Protocol Contract/);
      assert.match(res.content, /Discovered Codebase Contracts Linked/);
      assert.match(res.content, /UserAccount/);

      // Validate generated spec
      const val = validateSpec(res.content);
      assert.strictEqual(val.valid, true);
      assert.strictEqual(val.score, 100);
      assert.strictEqual(val.missing.length, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should detect missing sections in incomplete specs', () => {
    const incompleteSpec = '# Some Spec\n## 1. INTENT & BOUNDARIES\nSome notes';
    const val = validateSpec(incompleteSpec);
    assert.strictEqual(val.valid, false);
    assert.ok(val.score < 50);
    assert.ok(val.missing.includes('DATA CONTRACTS'));
    assert.ok(val.missing.includes('STATE MACHINE'));
  });

  test('should compile UI-specific component props schema without forcing idempotency keys', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-spec-ui-'));
    try {
      const res = compileSpec('Dark Mode Toggle Button Component', tmpDir);
      assert.strictEqual(fs.existsSync(res.path), true);
      assert.match(res.content, /DarkModeToggleButtonComponentPropsSchema/);
      assert.match(res.content, /theme: z\.enum\(\['light', 'dark', 'system'\]\)/);
      assert.match(res.content, /UI Component & State Contract/);
      assert.doesNotMatch(res.content, /Idempotency-Key/);

      const val = validateSpec(res.content);
      assert.strictEqual(val.valid, true);
      assert.strictEqual(val.score, 100);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should reject empty intent', () => {
    assert.throws(() => {
      compileSpec('');
    }, /Feature intent description is required/);
  });
});
