import { test, describe } from 'node:test';
import assert from 'node:assert';
import { auditCodeBugs } from '../scripts/audit-bugs.js';

describe('Production AST Bug & Flaw Hunter Suite', () => {
  test('should detect raw SQL string concatenation and template literal injection', () => {
    const badSqlCode = `
      export async function getUser(req, res) {
        const userId = req.params.id;
        // Vulnerable string concat
        const user1 = await db.query("SELECT * FROM users WHERE id = " + userId);
        // Vulnerable template literal
        const user2 = await db.query(\`SELECT * FROM accounts WHERE owner = \${userId}\`);
        return { user1, user2 };
      }
    `;

    const issues = auditCodeBugs(badSqlCode, 'src/api/user.ts');
    assert.strictEqual(issues.length, 2);
    assert.strictEqual(issues[0].category, 'SQL_INJECTION');
    assert.strictEqual(issues[0].severity, 'CRITICAL');
    assert.strictEqual(issues[1].category, 'SQL_INJECTION');
  });

  test('should detect React useEffect timer leak without cleanup', () => {
    const leakyReactCode = `
      import React, { useEffect } from 'react';
      export const TimerComponent = () => {
        useEffect(() => {
          let count = 0;
          setInterval(() => {
            count++;
          }, 1000);
          // Missing cleanup return () => clearInterval(...)
        }, []);
        return <div>Timer</div>;
      };
    `;

    const issues = auditCodeBugs(leakyReactCode, 'src/components/Timer.tsx');
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].category, 'MEMORY_LEAK');
    assert.strictEqual(issues[0].severity, 'HIGH');
  });

  test('should pass clean safe code with parameterized queries and proper cleanups', () => {
    const cleanCode = `
      import React, { useEffect } from 'react';
      export async function getSafeUser(userId: string) {
        return await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      }
      export const SafeTimer = () => {
        useEffect(() => {
          const t = setInterval(() => {}, 1000);
          return () => clearInterval(t);
        }, []);
        return <div>Safe</div>;
      };
    `;

    const issues = auditCodeBugs(cleanCode, 'src/safe.tsx');
    assert.strictEqual(issues.length, 0);
  });

  test('should detect variable-based SQL injection and not false positive on sync cache operations', () => {
    const varSqlCode = `
      export function search(id) {
        const sql = "SELECT * FROM items WHERE id = " + id;
        db.query(sql);
      }
      export function syncOps() {
        cache.fetch('item-1');
        cache.save('item-1', { ok: true });
      }
    `;

    const issues = auditCodeBugs(varSqlCode, 'src/api/search.ts');
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].category, 'SQL_INJECTION');
  });

  test('should detect multi-hop alias, mutation, function return SQLi, and bogus hook returns', () => {
    const complexCode = `
      export function multiHopAlias(id) {
        const queryStr = "SELECT * FROM users WHERE id = " + id;
        const alias1 = queryStr;
        const finalQuery = alias1;
        db.query(finalQuery);
      }

      export function mutatedSql(id) {
        let sql = "SELECT * FROM users";
        sql += " WHERE id = " + id;
        db.query(sql);
      }

      export function builderSql(id) {
        function getQuery(param) {
          return "SELECT * FROM items WHERE id = " + param;
        }
        db.query(getQuery(id));
      }

      export const BadReturnHook = () => {
        useEffect(() => {
          setInterval(() => {}, 1000);
          ${'return'} null;
        });
      };
    `;

    const issues = auditCodeBugs(complexCode, 'src/api/complex.ts');
    assert.strictEqual(issues.length, 4);
    assert.strictEqual(issues[0].category, 'SQL_INJECTION');
    assert.strictEqual(issues[1].category, 'SQL_INJECTION');
    assert.strictEqual(issues[2].category, 'SQL_INJECTION');
    assert.strictEqual(issues[3].category, 'MEMORY_LEAK');
  });
});
