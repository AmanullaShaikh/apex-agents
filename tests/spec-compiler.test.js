import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { compileSpec, validateSpec } from '../scripts/spec-compiler.js';

describe('Spec-First Architectural Compiler Suite', () => {
  test('should compile a comprehensive 5-phase SPEC.md and only link semantically relevant contracts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-spec-test-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'types.ts'),
        'export interface SubscriptionRecord { id: string; }\nexport interface UnrelatedPizzaOven { temp: number; }\n'
      );
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
      assert.match(res.content, /SubscriptionRecord/);
      // Unrelated types must NOT be blindly linked
      assert.doesNotMatch(res.content, /UnrelatedPizzaOven/);

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
      assert.match(res.content, /\[UNMOUNTED\]/);
      assert.doesNotMatch(res.content, /Idempotency-Key/);
      assert.doesNotMatch(res.content, /EMIT 400 ERROR/);

      const val = validateSpec(res.content);
      assert.strictEqual(val.valid, true);
      assert.strictEqual(val.score, 100);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should classify Login form as UI and CLI/Cache without HTTP POST or Idempotency-Key', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-spec-domains-'));
    try {
      const formSpec = compileSpec('Login form', tmpDir);
      assert.match(formSpec.content, /UI Component & State Contract/);
      assert.match(formSpec.content, /\[UNMOUNTED\]/);
      assert.doesNotMatch(formSpec.content, /\/api\/v1\//);
      assert.doesNotMatch(formSpec.content, /Idempotency-Key/);

      const cliSpec = compileSpec('CLI log file parser', tmpDir);
      assert.match(cliSpec.content, /CLI Invocation & Exit Code Contract/);
      assert.match(cliSpec.content, /VALIDATING_ARGS/);
      assert.doesNotMatch(cliSpec.content, /\/api\/v1\//);
      assert.doesNotMatch(cliSpec.content, /Idempotency-Key/);

      const cacheSpec = compileSpec('Redis caching layer', tmpDir);
      assert.match(cacheSpec.content, /Cache Operation & Consistency Contract/);
      assert.match(cacheSpec.content, /CACHE_HIT/);
      assert.doesNotMatch(cacheSpec.content, /\/api\/v1\//);
      assert.doesNotMatch(cacheSpec.content, /Idempotency-Key/);

      const gqlSpec = compileSpec('GraphQL API for billing', tmpDir);
      assert.match(gqlSpec.content, /GraphQL Schema & Resolver Contract/);
      assert.match(gqlSpec.content, /\/graphql/);
      assert.doesNotMatch(gqlSpec.content, /\/api\/v1\//);

      const dbSpec = compileSpec('PostgreSQL database migration script', tmpDir);
      assert.match(dbSpec.content, /Database Migration & Rollback Contract/);
      assert.match(dbSpec.content, /BEGIN_TX/);
      assert.doesNotMatch(dbSpec.content, /CLI Invocation & Exit Code Contract/);
      assert.doesNotMatch(dbSpec.content, /\/api\/v1\//);
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
