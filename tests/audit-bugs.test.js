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

  test('should detect computed calls, destructuring, reflection, currying, and object aliasing SQLi', () => {
    const offensiveCode = `
      export function testComputed(id) {
        db['query']("SELECT * FROM users WHERE id = " + id);
      }
      export function testComputedString(id) {
        db[String('query')]("SELECT * FROM users WHERE id = " + id);
      }
      export function testDestructure(id) {
        const { query } = db;
        query("SELECT * FROM users WHERE id = " + id);
      }
      export function testReflection(id) {
        Reflect.apply(db.query, db, ["SELECT * FROM users WHERE id = " + id]);
      }
      export function testCurry(id) {
        runner(db.query, "SELECT * FROM users WHERE id = " + id);
      }
      export function testObjectAliasing(id) {
        const payload = {};
        payload.query = "SELECT * FROM users WHERE id = " + id;
        db.query(payload.query);
      }
      export const HookIIFEDeception = () => {
        useEffect(() => {
          setInterval(() => {}, 1000);
          ${'return'} (() => null)();
        });
      };
      export const HookNoopDeception = () => {
        useEffect(() => {
          setInterval(() => {}, 1000);
          const noop = undefined;
          ${'return'} noop;
        });
      };
    `;

    const issues = auditCodeBugs(offensiveCode, 'src/api/offensive.ts');
    assert.strictEqual(issues.length, 8);
    const sqli = issues.filter(i => i.category === 'SQL_INJECTION');
    const leaks = issues.filter(i => i.category === 'MEMORY_LEAK');
    assert.strictEqual(sqli.length, 6);
    assert.strictEqual(leaks.length, 2);
  });

  test('should detect tagged templates, renamed re-exports, barrel imports, Reflect.get, Promise chains, and Proxy SQLi', () => {
    const advancedCode = `
      import { query as runQuery } from './db';
      import * as orm from './barrel';

      export function testTaggedTemplate(id) {
        db.query\`SELECT * FROM users WHERE id = \${id}\`;
      }

      export function testCustomTag(id) {
        const sql = raw\`SELECT * FROM users WHERE id = \${id}\`;
        db.query(sql);
      }

      export function testRenamedImport(id) {
        runQuery("SELECT * FROM users WHERE id = " + id);
      }

      export function testBarrelImport(id) {
        orm.runQuery("SELECT * FROM users WHERE id = " + id);
      }

      export function testReflectGet(id) {
        Reflect.get(db, 'query')("SELECT * FROM users WHERE id = " + id);
      }

      export function testPromiseChain(id) {
        Promise.resolve("SELECT * FROM users WHERE id = " + id).then(data => db.query(data));
      }

      export function testProxyTrap(id) {
        const client = new Proxy(db, { get(t, p) { return (q) => t.query(q); } });
        client.run("SELECT * FROM users WHERE id = " + id);
      }

      export function testCall(id) {
        db.query.call(db, "SELECT * FROM users WHERE id = " + id);
      }

      export function testApply(id) {
        db.query.apply(db, ["SELECT * FROM users WHERE id = " + id]);
      }

      export function testBind(id) {
        db.query.bind(db)("SELECT * FROM users WHERE id = " + id);
      }
    `;

    const issues = auditCodeBugs(advancedCode, 'src/api/advanced.ts');
    const sqli = issues.filter(i => i.category === 'SQL_INJECTION');
    assert.strictEqual(sqli.length, 11);
  });
});
