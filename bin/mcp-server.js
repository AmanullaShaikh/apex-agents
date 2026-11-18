#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let pkgVersion = '2.1.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  if (pkg.version) pkgVersion = pkg.version;
} catch {}

// Helper to read agent files
function getAgentContent(agentId) {
  if (!agentId) return null;
  const safeId = path.basename(agentId);
  const agentsDir = path.join(ROOT_DIR, 'agents');
  const divisions = fs.readdirSync(agentsDir);
  for (const div of divisions) {
    const filePath = path.join(agentsDir, div, `${safeId}.md`);
    if (fs.existsSync(filePath)) {
      return {
        id: safeId,
        division: div,
        content: fs.readFileSync(filePath, 'utf-8')
      };
    }
  }
  return null;
}

function getAllAgents() {
  const agentsDir = path.join(ROOT_DIR, 'agents');
  const divisions = fs.readdirSync(agentsDir).filter((d) => fs.statSync(path.join(agentsDir, d)).isDirectory());
  const list = [];
  for (const div of divisions) {
    const files = fs.readdirSync(path.join(agentsDir, div)).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      list.push({ id: file.replace('.md', ''), division: div });
    }
  }
  return list;
}

function getInstinctContent(instinctId) {
  if (!instinctId) return null;
  const safeId = path.basename(instinctId);
  const filePath = path.join(ROOT_DIR, 'instincts', `${safeId}.md`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

const TOOLS = [
  {
    name: 'list_specialists',
    description: 'Lists all available specialized agents in Apex Agents by division',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'summon_specialist',
    description: 'Summons a specialized agent persona and returns its complete operational workflow, constraints, and instructions',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The unique ID of the specialist (e.g. "database-tuner", "frontend-architect", "appsec-auditor")'
        }
      },
      required: ['agent_id']
    }
  },
  {
    name: 'get_operational_instinct',
    description: 'Retrieves strict operational instincts (zero-slop contract, verification rules, test-driven discipline)',
    inputSchema: {
      type: 'object',
      properties: {
        instinct_id: {
          type: 'string',
          description: 'The instinct ID (e.g. "zero-slop-contract", "verification-before-completion", "test-driven-discipline")'
        }
      },
      required: ['instinct_id']
    }
  },
  {
    name: 'apex_compact_code',
    description: 'Compacts JS, TS, React, Python, Go, or Rust source code using Babel AST. Strips method and function bodies down to {} or pass, preserving 100% of types, interfaces, struct fields, and signatures. Reduces token size by 80-90%.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Raw source code to compact'
        },
        ext: {
          type: 'string',
          description: 'File extension (ts, js, py, go, rs). Defaults to ts'
        }
      },
      required: ['code']
    }
  },
  {
    name: 'apex_audit_code_bugs',
    description: 'Performs AST static analysis on code to detect critical bugs: SQL injections (template literals, concatenation, multi-hop aliases, .call/.apply/.bind), React timer leaks (useEffect missing cleanup), and unhandled floating promises (e.g. unawaited u.save()).',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Source code string to audit'
        },
        file_path: {
          type: 'string',
          description: 'Optional file path for reporting (e.g. "src/db.ts")'
        }
      },
      required: ['code']
    }
  },
  {
    name: 'apex_checkpoint',
    description: 'Creates an atomic Git snapshot of the current working tree, untracked files, gitignored .env files, and hooks. Essential safety gate before executing destructive code modifications.',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Descriptive checkpoint label (e.g. "pre-refactor-auth")'
        }
      }
    }
  },
  {
    name: 'apex_rollback',
    description: 'Instantly rolls back working tree to the latest checkpoint or a specific checkpoint label, cleaning rogue untracked files and restoring .env/hooks.',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Optional specific checkpoint label to restore. If omitted, restores most recent checkpoint.'
        }
      }
    }
  },
  {
    name: 'apex_trace_symbol',
    description: 'Scans project AST to trace declarations and cross-file call sites of any symbol across TypeScript and JavaScript modules.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol_name: {
          type: 'string',
          description: 'Function, class, or variable name to trace'
        },
        project_dir: {
          type: 'string',
          description: 'Optional root project directory. Defaults to cwd.'
        }
      },
      required: ['symbol_name']
    }
  },
  {
    name: 'apex_audit_diff',
    description: 'Audits a raw Git diff for leaked credentials (API keys, Stripe/AWS/GitHub keys, hex/unicode escape evasion), test tampering (.skip, .skipIf, microtasks, deleted assertions), and AI slop.',
    inputSchema: {
      type: 'object',
      properties: {
        diff: {
          type: 'string',
          description: 'Raw git diff string'
        }
      },
      required: ['diff']
    }
  }
];

function sendResponse(id, result) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id,
    result
  });
  process.stdout.write(payload + '\n');
}

function sendError(id, code, message) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message }
  });
  process.stdout.write(payload + '\n');
}

// Stdio JSON-RPC line parser
let buffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Retain incomplete line

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const message = JSON.parse(trimmed);
      handleMessage(message);
    } catch (err) {
      // Return standard JSON-RPC 2.0 parse error on malformed/garbage input
      sendError(null, -32700, 'Parse error: Invalid JSON was received by the server.');
    }
  }
});

async function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;

  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'apex-agents-mcp',
        version: pkgVersion
      }
    });
    return;
  }

  if (method === 'notifications/initialized') {
    // Client confirmation notification, no response required
    return;
  }

  if (method === 'tools/list') {
    sendResponse(id, {
      tools: TOOLS
    });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};

    if (name === 'list_specialists') {
      const agents = getAllAgents();
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify(agents, null, 2)
          }
        ]
      });
      return;
    }

    if (name === 'summon_specialist') {
      const agentId = args?.agent_id;
      const specialist = getAgentContent(agentId);
      if (!specialist) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Error: Specialist '${agentId}' not found in Apex Agents.` }]
        });
        return;
      }
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: specialist.content
          }
        ]
      });
      return;
    }

    if (name === 'get_operational_instinct') {
      const instinctId = args?.instinct_id;
      const instinct = getInstinctContent(instinctId);
      if (!instinct) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Error: Instinct '${instinctId}' not found in Apex Agents.` }]
        });
        return;
      }
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: instinct
          }
        ]
      });
      return;
    }

    if (name === 'apex_compact_code') {
      try {
        const { compactSourceCode } = await import('../scripts/compact-context.js');
        const compacted = compactSourceCode(args?.code || '', { ext: args?.ext || 'ts' });
        sendResponse(id, {
          content: [{ type: 'text', text: compacted }]
        });
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Error compacting code: ${err.message}` }]
        });
      }
      return;
    }

    if (name === 'apex_audit_code_bugs') {
      try {
        const { auditCodeBugs } = await import('../scripts/audit-bugs.js');
        const bugs = auditCodeBugs(args?.code || '', args?.file_path || 'virtual.ts');
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(bugs, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Error auditing code: ${err.message}` }]
        });
      }
      return;
    }

    if (name === 'apex_checkpoint') {
      try {
        const { createCheckpoint } = await import('../scripts/checkpoint.js');
        const res = createCheckpoint(args?.label || 'mcp-checkpoint');
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Error creating checkpoint: ${err.message}` }]
        });
      }
      return;
    }

    if (name === 'apex_rollback') {
      try {
        const { rollbackToCheckpoint } = await import('../scripts/checkpoint.js');
        const res = rollbackToCheckpoint(args?.label || null);
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Error executing rollback: ${err.message}` }]
        });
      }
      return;
    }

    if (name === 'apex_trace_symbol') {
      try {
        const { traceSymbol } = await import('../scripts/symbol-tracer.js');
        const res = traceSymbol(args?.symbol_name || '', args?.project_dir || process.cwd());
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Error tracing symbol: ${err.message}` }]
        });
      }
      return;
    }

    if (name === 'apex_audit_diff') {
      try {
        const { auditDiff } = await import('../scripts/audit-diff.js');
        const res = auditDiff(args?.diff || '');
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Error auditing diff: ${err.message}` }]
        });
      }
      return;
    }

    sendError(id, -32601, `Method not found: tool ${name}`);
    return;
  }

  // Fallback for unknown methods
  if (id !== undefined) {
    sendError(id, -32601, `Method '${method}' not implemented`);
  }
}
