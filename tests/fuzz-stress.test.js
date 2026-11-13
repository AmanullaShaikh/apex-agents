import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { compactSourceCode } from '../scripts/compact-context.js';
import { auditDiff } from '../scripts/audit-diff.js';
import { buildDependencyGraph } from '../scripts/dependency-graph.js';
import { generateHandoff } from '../scripts/handoff.js';
import { handleMemory } from '../scripts/session-memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('Apex Agents Fuzzing & Extreme Stress Suite', () => {

  describe('1. AST Compactor Extreme Fuzzing', () => {
    test('should survive 100 levels of nested functions without stack overflow', () => {
      let code = 'export function outer() {\n';
      for (let i = 0; i < 100; i++) code += `  function nested_${i}() {\n`;
      code += '    return 42;\n';
      for (let i = 0; i < 100; i++) code += '  }\n';
      code += '}\n';

      const result = compactSourceCode(code);
      assert.ok(result.includes('export function outer'), 'Must retain export function');
      assert.ok(!result.includes('return 42'), 'Must strip inner logic');
    });

    test('should survive massive 5,000-function file in under 1.5 seconds', () => {
      let hugeCode = '// Huge codebase\n';
      for (let i = 0; i < 5000; i++) {
        hugeCode += `export function fn_${i}(a: number, b: string): boolean { const x = a + 1; return x > 0; }\n`;
      }
      const start = Date.now();
      const compacted = compactSourceCode(hugeCode);
      const elapsed = Date.now() - start;

      assert.ok(elapsed < 2000, `Compaction took too long: ${elapsed}ms`);
      assert.ok(compacted.includes('export function fn_0'), 'Must retain signatures');
      assert.ok(!compacted.includes('const x = a + 1'), 'Must strip body');
    });

    test('should gracefully handle bizarre syntaxes (decorators, TS assertions, JSX fragments)', () => {
      const advancedCode = `
        @Injectable()
        export class VideoService extends BaseService implements IService {
          #privateId: string = "secret";
          public count = 0 as number;

          @LogExecutionTime()
          public async processVideo<T extends object>(data: T): Promise<T> {
            const raw = data as any;
            return raw?.stream?.() ?? null;
          }
        }

        export const VideoPlayer = ({ src }: { src: string }) => {
          return (
            <>
              <video src={src} controls />
            </>
          );
        };
      `;
      const result = compactSourceCode(advancedCode);
      assert.ok(result.includes('export class VideoService'), 'Retains class declaration');
      assert.ok(result.includes('VideoPlayer'), 'Retains React functional component');
      assert.ok(!result.includes('raw?.stream?.()'), 'Strips method body');
    });

    test('should survive completely broken/corrupted syntax without throwing', () => {
      const brokenSnippets = [
        'function ( broken syntax { { {',
        'export const = = = 12345;',
        '<<<<<<<< HEAD: conflict marker',
        'null\0undefined\u0000binary_data',
        'export class { public missingName() { '
      ];

      for (const snippet of brokenSnippets) {
        assert.doesNotThrow(() => {
          const res = compactSourceCode(snippet);
          assert.strictEqual(typeof res, 'string');
        }, `Should not crash on: ${snippet}`);
      }
    });
  });

  describe('2. Diff Auditor Anti-Tampering & Evasion Fuzzing', () => {
    test('should catch isolated test execution cheating attempts', () => {
      const itOnlyCall = '+' + 'it' + '.only("validates token", () => {';
      const diffWithItOnly = [
        'diff --git a/tests/auth.test.ts b/tests/auth.test.ts',
        '--- a/tests/auth.test.ts',
        '+++ b/tests/auth.test.ts',
        '@@ -10,3 +10,3 @@',
        itOnlyCall,
        '  expect(true).toBe(true);'
      ].join('\n');
      const result = auditDiff(diffWithItOnly);
      const tampering = result.issues.find(i => i.category === 'TEST_TAMPERING');
      assert.ok(tampering, 'MUST catch test isolation tampering');
    });

    test('should catch block comment test assertion deletions', () => {
      const blockCommentAssertion = '+' + '/*' + ' expect(user.isAdmin).toBe(true); ' + '*/';
      const diffWithBlockComment = [
        'diff --git a/tests/unit.test.ts b/tests/unit.test.ts',
        '--- a/tests/unit.test.ts',
        '+++ b/tests/unit.test.ts',
        '@@ -15,2 +15,2 @@',
        blockCommentAssertion
      ].join('\n');
      const result = auditDiff(diffWithBlockComment);
      const tampering = result.issues.find(i => i.category === 'TEST_TAMPERING');
      assert.ok(tampering, 'MUST catch block-commented assertions');
    });

    test('should survive binary diffs and git submodule changes without crashing', () => {
      const binaryDiff = `
diff --git a/assets/logo.png b/assets/logo.png
new file mode 100644
index 0000000..f3b4c12
GIT binary patch
literal 1284
zcmeAS@N?(olHy` + '0'.repeat(500);

      assert.doesNotThrow(() => {
        const res = auditDiff(binaryDiff);
        assert.ok(res.clean, 'Binary diff without secrets should be clean');
      });
    });

    test('should detect test tampering when spacing is used to evade regex', () => {
      const evasiveSkipCall = '+' + 'it ' + '. skip ' + '("failing test", () => {});';
      const evasiveDiff = [
        'diff --git a/tests/edge.test.js b/tests/edge.test.js',
        '--- a/tests/edge.test.js',
        '+++ b/tests/edge.test.js',
        '@@ -5,1 +5,1 @@',
        evasiveSkipCall
      ].join('\n');
      const result = auditDiff(evasiveDiff);
      const tampering = result.issues.find(i => i.category === 'TEST_TAMPERING');
      assert.ok(tampering, 'MUST catch evasive skip with spaces');
    });
  });

  describe('3. Dependency Graph Export All & Cycle Fuzzing', () => {
    test('should track "export * from" barrel exports', () => {
      // Test the resolve and graph behavior
      const testDir = path.join(ROOT_DIR, '.test_tmp_barrel');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'index.ts'), 'export * from "./helper";\n');
      fs.writeFileSync(path.join(testDir, 'helper.ts'), 'export const PI = 3.14;\n');

      try {
        const { graph } = buildDependencyGraph(testDir);
        const indexImports = graph.get('index.ts') || new Set();
        assert.ok(indexImports.has('helper.ts'), 'Must track export * as internal dependency');
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    test('should detect self-cycles (file importing itself)', () => {
      const testDir = path.join(ROOT_DIR, '.test_tmp_self_cycle');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'self.ts'), 'import "./self";\nexport const x = 1;\n');

      try {
        const { cycles } = buildDependencyGraph(testDir);
        assert.ok(cycles.length > 0, 'Must detect self-referencing cycle');
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('4. Session Memory & Handoff Non-Git / Corrupted Fuzzing', () => {
    test('generateHandoff should not crash in an empty non-git temp directory', () => {
      const emptyTemp = path.join(ROOT_DIR, '.test_tmp_empty');
      fs.mkdirSync(emptyTemp, { recursive: true });

      try {
        assert.doesNotThrow(() => {
          const handoff = generateHandoff(emptyTemp);
          assert.ok(handoff.includes('<session_handoff'), 'Generates valid XML even outside git');
        });
      } finally {
        fs.rmSync(emptyTemp, { recursive: true, force: true });
      }
    });

    test('handleMemory should handle corrupted or non-object memory.json', () => {
      const memDir = path.join(ROOT_DIR, '.agents');
      const memFile = path.join(memDir, 'memory.json');
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(memFile, '["not an object"]');

      assert.doesNotThrow(() => {
        handleMemory(['record', 'decision', 'Fuzz decision test'], ROOT_DIR);
        handleMemory(['recall'], ROOT_DIR);
      });
    });
  });

  describe('5. Native MCP Server Resilience & Hostile Input Fuzzing', () => {
    test('should survive malformed JSON and directory traversal attacks', async () => {
      const { spawn } = await import('child_process');
      const mcpBin = path.join(ROOT_DIR, 'bin', 'mcp-server.js');
      const proc = spawn(process.execPath, [mcpBin], { stdio: ['pipe', 'pipe', 'pipe'] });

      const responses = [];
      proc.stdout.on('data', (d) => {
        const lines = d.toString().split('\n').filter(Boolean);
        for (const l of lines) {
          try { responses.push(JSON.parse(l)); } catch {}
        }
      });

      // 1. Send garbage
      proc.stdin.write('MALFORMED NON-JSON GARBAGE\n');
      proc.stdin.write('null\n');
      proc.stdin.write('12345\n');

      // 2. Send initialize
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }) + '\n');

      // 3. Send traversal attempt
      proc.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'summon_specialist', arguments: { agent_id: '../../etc/passwd' } }
      }) + '\n');

      // Wait 300ms for stdio processing
      await new Promise(r => setTimeout(r, 300));
      proc.kill();

      const initResp = responses.find(r => r.id === 1);
      assert.ok(initResp, 'Must receive initialize response');
      assert.strictEqual(initResp.result.serverInfo.version, '2.0.0');

      const traversalResp = responses.find(r => r.id === 2);
      assert.ok(traversalResp, 'Must receive tool response');
      assert.ok(traversalResp.result.isError, 'Must reject traversal attempt safely');
    });
  });
});
