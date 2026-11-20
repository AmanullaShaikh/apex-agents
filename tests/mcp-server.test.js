import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MCP_BIN = path.join(ROOT_DIR, 'bin', 'mcp-server.js');

function callMcpSession(requests) {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [MCP_BIN], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: ROOT_DIR
    });

    const responses = [];
    let buffer = '';

    const checkDone = () => {
      if (responses.length >= requests.length) {
        proc.kill();
        resolve(responses);
      }
    };

    proc.stdout.on('data', (d) => {
      buffer += d.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            responses.push(JSON.parse(trimmed));
          } catch {}
        }
      }
      checkDone();
    });

    proc.on('close', () => {
      resolve(responses);
    });

    for (const req of requests) {
      proc.stdin.write(JSON.stringify(req) + '\n');
    }
  });
}

describe('Native MCP Tooling Integration Suite', () => {
  test('should list all tools including physical AST tools', async () => {
    const responses = await callMcpSession([
      { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    ]);
    const resp = responses.find(r => r.id === 1);
    assert.ok(resp && resp.result && resp.result.tools);
    const toolNames = resp.result.tools.map(t => t.name);
    assert.ok(toolNames.includes('apex_compact_code'));
    assert.ok(toolNames.includes('apex_audit_code_bugs'));
    assert.ok(toolNames.includes('apex_checkpoint'));
    assert.ok(toolNames.includes('apex_rollback'));
    assert.ok(toolNames.includes('apex_trace_symbol'));
    assert.ok(toolNames.includes('apex_audit_diff'));
  });

  test('should execute apex_compact_code via MCP', async () => {
    const code = 'function add(a: number, b: number): number {\n  const res = a + b;\n  return res;\n}';
    const responses = await callMcpSession([
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'apex_compact_code',
          arguments: { code, ext: 'ts' }
        }
      }
    ]);
    const resp = responses.find(r => r.id === 2);
    assert.ok(resp && resp.result && resp.result.content);
    assert.ok(resp.result.content[0].text.includes('function add(a: number, b: number): number { /* stripped */ }') || resp.result.content[0].text.includes('function add(a: number, b: number): number {}'));
  });

  test('should execute apex_audit_code_bugs via MCP and report bugs', async () => {
    const vulnerableCode = 'export async function test(req) { const id = req.id; const q = "SELECT * FROM users WHERE id = " + id; return await db.query(q); }';
    const responses = await callMcpSession([
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'apex_audit_code_bugs',
          arguments: { code: vulnerableCode, file_path: 'auth.ts' }
        }
      }
    ]);
    const resp = responses.find(r => r.id === 3);
    assert.ok(resp && resp.result && resp.result.content);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.ok(parsed.length > 0);
    assert.strictEqual(parsed[0].category, 'SQL_INJECTION');
  });

  test('should execute apex_audit_diff via MCP and catch tampering', async () => {
    const dirtyDiff = [
      'diff --git a/tests/auth.test.js b/tests/auth.test.js',
      '--- a/tests/auth.test.js',
      '+++ b/tests/auth.test.js',
      '@@ -10,3 +10,3 @@',
      '-test(\'should authenticate user\', async () => {',
      '+test' + '.skip(\'should authenticate user\', async () => {'
    ].join('\n');

    const responses = await callMcpSession([
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'apex_audit_diff',
          arguments: { diff: dirtyDiff }
        }
      }
    ]);
    const resp = responses.find(r => r.id === 4);
    assert.ok(resp && resp.result && resp.result.content);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.strictEqual(parsed.clean, false);
    assert.strictEqual(parsed.stats.tampering, 1);
  });

  test('should return isError on non-string agent_id without crashing server and reject external project_dir', async () => {
    const responses = await callMcpSession([
      {
        jsonrpc: '2.0',
        id: 100,
        method: 'tools/call',
        params: { name: 'summon_specialist', arguments: { agent_id: 123 } }
      },
      {
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/call',
        params: { name: 'apex_trace_symbol', arguments: { symbol_name: 'traceSymbol', project_dir: '/tmp' } }
      },
      {
        jsonrpc: '2.0',
        id: 102,
        method: 'initialize'
      }
    ]);
    const r100 = responses.find(r => r.id === 100);
    const r101 = responses.find(r => r.id === 101);
    const r102 = responses.find(r => r.id === 102);
    assert.ok(r100?.result?.isError, 'Non-string agent_id must return isError');
    assert.ok(r101?.result?.isError, 'External project_dir must be rejected');
    assert.ok(r102?.result?.serverInfo, 'Server must stay alive after errors');
  });

  test('should expose prompts/list, prompts/get, and apex_impact_radius tool', async () => {
    const responses = await callMcpSession([
      { jsonrpc: '2.0', id: 200, method: 'tools/list' },
      { jsonrpc: '2.0', id: 201, method: 'prompts/list' },
      { jsonrpc: '2.0', id: 202, method: 'prompts/get', params: { name: 'instinct:zero-slop-contract' } },
      { jsonrpc: '2.0', id: 203, method: 'tools/call', params: { name: 'apex_impact_radius', arguments: { files: ['scripts/dependency-graph.js'] } } }
    ]);
    const r200 = responses.find(r => r.id === 200);
    const r201 = responses.find(r => r.id === 201);
    const r202 = responses.find(r => r.id === 202);
    const r203 = responses.find(r => r.id === 203);

    assert.ok(r200.result.tools.some(t => t.name === 'apex_impact_radius'));
    assert.ok(r201.result.prompts.some(p => p.name === 'instinct:zero-slop-contract'));
    assert.ok(r202.result.messages[0].content.text.includes('Zero-Slop'));
    const impact = JSON.parse(r203.result.content[0].text);
    assert.ok(Array.isArray(impact.directDependents) && impact.directDependents.length > 0);
  });
});
