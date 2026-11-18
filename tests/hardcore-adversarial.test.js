import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { compactSourceCode, compactPythonCode, compactGoCode, compactRustCode } from '../scripts/compact-context.js';
import { createCheckpoint, listCheckpoints, rollbackToCheckpoint } from '../scripts/checkpoint.js';
import { traceSymbol } from '../scripts/symbol-tracer.js';
import { auditCodeBugs, auditWorkspaceBugs } from '../scripts/audit-bugs.js';
import { computeTokenCost, estimateTokens } from '../scripts/token-cost.js';
import { parseTestFailures } from '../scripts/test-loop.js';

describe('HARDEST ADVERSARIAL STRESS & BREAK TEST SUITE', () => {

  describe('1. AST Compactor Extreme Multi-Language Hostility', () => {
    test('should handle Python with docstrings containing fake "def", complex type hints, and decorators', () => {
      const hostilePython = `
import typing
from typing import List, Dict, Optional, Union

@dataclass(frozen=True)
@audit_log(level="CRITICAL")
class PaymentProcessor:
    """
    Fake docstring with tricky content:
    def fake_in_docstring(a, b):
        return a + b
    """
    api_key: str
    timeout: int = 30

    async def execute_transaction(
        self,
        account_id: str,
        amount: Union[int, float],
        options: Optional[Dict[str, typing.Any]] = None
    ) -> bool:
        # Internal secrets that MUST be stripped
        secret = "ultra_secret_key"
        db = connect()
        db.save(secret)
        return True
      `;

      const compacted = compactPythonCode(hostilePython);
      assert.ok(compacted.includes('class PaymentProcessor:'), 'Must retain class');
      assert.ok(compacted.includes('async def execute_transaction'), 'Must retain method signature');
      assert.ok(!compacted.includes('ultra_secret_key'), 'Must strip internal secrets');
      assert.ok(compacted.includes('pass'), 'Must inject pass placeholder');
    });

    test('should handle Go code with multiline signatures and struct receivers', () => {
      const hostileGo = `
package server

import (
  "net/http"
  "context"
)

type Server struct {
  port int
}

func (s *Server) HandlePayment(
  ctx context.Context,
  w http.ResponseWriter,
  r *http.Request,
) (bool, error) {
  // Heavy internal business logic
  token := r.Header.Get("Authorization")
  validate(token)
  return true, nil
}
      `;

      const compacted = compactGoCode(hostileGo);
      assert.ok(compacted.includes('type Server struct'), 'Must retain struct');
      assert.ok(compacted.includes('func (s *Server) HandlePayment'), 'Must retain func signature');
      assert.ok(!compacted.includes('r.Header.Get'), 'Must strip internal lines');
    });

    test('should handle Rust code with complex lifetimes and macros', () => {
      const hostileRust = `
pub struct MemoryCache<'a, T: 'a + Send + Sync> {
    data: &'a [T],
}

impl<'a, T: Send + Sync> MemoryCache<'a, T> {
    pub fn get_value<K>(&self, key: &'a K) -> Option<&'a T> {
        let internal_map = self.lock();
        internal_map.find(key)
    }
}
      `;

      const compacted = compactRustCode(hostileRust);
      assert.ok(compacted.includes('pub struct MemoryCache'), 'Must retain struct');
      assert.ok(compacted.includes('pub fn get_value'), 'Must retain method signature');
      assert.ok(!compacted.includes('self.lock()'), 'Must strip implementation details');
    });

    test('should survive corrupted and hostile tokens without throwing', () => {
      const garbage = 'export function %%%@@@ broken((((( {{{ ;;;; \0\0\0\x01\x02';
      assert.doesNotThrow(() => {
        const res = compactSourceCode(garbage);
        assert.ok(typeof res === 'string');
      });
    });
  });

  describe('2. Git Checkpoint & Rollback Extreme Hostility', () => {
    test('should handle filenames with spaces, unicode, and deep directory trees', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-hostile-chk-'));
      try {
        const deepDir = path.join(tmpDir, 'deep', 'level1', 'level2');
        fs.mkdirSync(deepDir, { recursive: true });

        const strangeFile = path.join(deepDir, 'special & file @ test #1.ts');
        fs.writeFileSync(strangeFile, 'export const initial = "safe";');

        // Checkpoint 1
        const chk = createCheckpoint('special-chars-checkpoint', tmpDir);
        assert.ok(chk.id);

        // Mutate file
        fs.writeFileSync(strangeFile, 'export const destroyed = "corrupted";');

        // Rollback
        const restored = rollbackToCheckpoint(chk.id, tmpDir);
        assert.strictEqual(restored.target.id, chk.id);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('should gracefully handle corrupted meta.json in checkpoints directory', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-corrupt-chk-'));
      try {
        const chkDir = path.join(tmpDir, '.agents', 'checkpoints', 'chk_999999999');
        fs.mkdirSync(chkDir, { recursive: true });
        // Write invalid JSON
        fs.writeFileSync(path.join(chkDir, 'meta.json'), '{ invalid json ...');

        assert.doesNotThrow(() => {
          const list = listCheckpoints(tmpDir);
          assert.strictEqual(list.length, 0); // Gracefully skips corrupt entries
        });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('3. Symbol Tracer Hostile Names & Prototype Collision', () => {
    test('should safely trace Object prototype property names without collision', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-proto-trace-'));
      try {
        const file = path.join(tmpDir, 'model.ts');
        fs.writeFileSync(file, `
          export class User {
            toString() {
              return "UserInstance";
            }
          }
          const u = new User();
          u.toString();
        `);

        assert.doesNotThrow(() => {
          const res = traceSymbol('toString', tmpDir);
          assert.strictEqual(res.symbol, 'toString');
        });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('4. Production AST Bug Hunter Adversarial Evasion Checks', () => {
    test('should catch multiline and fragmented SQL injection attempts', () => {
      const sneakySql = `
        async function queryDb(userInput) {
          const res = await db.query(
            "SELECT * FROM accounts WHERE id = " +
            userInput +
            " AND active = 1"
          );
          return res;
        }
      `;

      const issues = auditCodeBugs(sneakySql, 'sneaky.ts');
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].category, 'SQL_INJECTION');
      assert.strictEqual(issues[0].severity, 'CRITICAL');
    });

    test('should not trigger false positives on safe React hooks with cleanups', () => {
      const cleanHooks = `
        import React, { useEffect } from 'react';
        export const Clock = () => {
          useEffect(() => {
            const id = setInterval(() => {}, 1000);
            return () => clearInterval(id);
          }, []);
          return <div>Clock</div>;
        };
      `;

      const issues = auditCodeBugs(cleanHooks, 'Clock.tsx');
      assert.strictEqual(issues.length, 0, 'Clean hook must not be flagged');
    });
  });

  describe('5. Test Failure Parser Hostility', () => {
    test('should parse heavily nested ANSI-colored and multiline stack traces', () => {
      const coloredFailure = `
        \u001b[31m✖ \u001b[39mPaymentGateway::processOrder \u001b[90m(124ms)\u001b[39m
          \u001b[31mAssertionError [ERR_ASSERTION]: Expected status 200 to equal 402\u001b[39m
            at src/services/gateway.test.ts:88:14
            at async runTest (node:internal/test_runner/test:1389:7)
      `;

      const failures = parseTestFailures(coloredFailure);
      assert.strictEqual(failures.length, 1);
      assert.match(failures[0].file, /gateway\.test\.ts/);
      assert.strictEqual(failures[0].line, 88);
    });

    test('should handle completely empty or garbage test runner output gracefully', () => {
      const emptyFailures = parseTestFailures('');
      assert.strictEqual(emptyFailures.length, 1);
      assert.strictEqual(emptyFailures[0].name, 'Unspecified Test Suite Failure');
    });
  });

});
