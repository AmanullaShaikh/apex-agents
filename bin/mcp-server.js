#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let pkgVersion = '3.0.3';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  if (pkg.version) pkgVersion = pkg.version;
} catch {}

// Helper to read agent files
function getAgentContent(agentId) {
  if (!agentId || typeof agentId !== 'string') return null;
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
  if (!instinctId || typeof instinctId !== 'string') return null;
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
    description: 'Lists all available specialized agents in Aveyx by division',
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
    name: 'aveyx_compact_code',
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
    name: 'aveyx_audit_code_bugs',
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
    name: 'aveyx_checkpoint',
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
    name: 'aveyx_rollback',
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
    name: 'aveyx_trace_symbol',
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
    name: 'aveyx_impact_radius',
    description: 'Computes transitive reverse-dependency blast radius for modified or specified files, returning direct dependents, transitive dependents, affected test suites, and risk level.',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of relative file paths to analyze. If omitted, uses uncommitted git changes.'
        },
        project_dir: {
          type: 'string',
          description: 'Optional workspace root directory (must stay inside server cwd).'
        }
      }
    }
  },
  {
    name: 'aveyx_audit_diff',
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
const MAX_STDIN_BUFFER_BYTES = 10 * 1024 * 1024;
let buffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  if (buffer.length > MAX_STDIN_BUFFER_BYTES) {
    buffer = '';
    sendError(null, -32700, 'Parse error: Input buffer exceeded 10MB limit.');
    return;
  }
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Retain incomplete line

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const message = JSON.parse(trimmed);
      handleMessage(message).catch((err) => {
        const msgId = message && typeof message === 'object' && !Array.isArray(message) ? (message.id ?? null) : null;
        sendError(msgId, -32603, `Internal error: ${err?.message || 'Unknown error'}`);
      });
    } catch (err) {
      // Return standard JSON-RPC 2.0 parse error on malformed/garbage input
      sendError(null, -32700, 'Parse error: Invalid JSON was received by the server.');
    }
  }
});

async function handleMessage(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    sendError(null, -32600, 'Invalid Request: Expected a JSON-RPC object.');
    return;
  }
  const { id, method, params } = msg;

  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        prompts: {}
      },
      serverInfo: {
        name: 'aveyx-mcp',
        version: pkgVersion
      }
    });
    return;
  }

  if (method === 'notifications/initialized') {
    // Client confirmation notification, no response required
    return;
  }

  if (method === 'prompts/list') {
    const agents = getAllAgents().map(a => ({
      name: `specialist:${a.id}`,
      description: `Aveyx specialist (${a.division}): @${a.id}`
    }));
    const instinctsDir = path.join(ROOT_DIR, 'instincts');
    const instincts = fs.existsSync(instinctsDir)
      ? fs.readdirSync(instinctsDir).filter(f => f.endsWith('.md')).map(f => {
          const id = f.replace('.md', '');
          return { name: `instinct:${id}`, description: `Aveyx operational instinct: ${id}` };
        })
      : [];
    sendResponse(id, { prompts: [...agents, ...instincts] });
    return;
  }

  if (method === 'prompts/get') {
    const promptName = params?.name;
    if (!promptName || typeof promptName !== 'string') {
      sendError(id, -32602, 'Invalid params: prompt name must be a string');
      return;
    }
    let content = null;
    if (promptName.startsWith('specialist:')) {
      content = getAgentContent(promptName.slice('specialist:'.length))?.content || null;
    } else if (promptName.startsWith('instinct:')) {
      content = getInstinctContent(promptName.slice('instinct:'.length));
    } else {
      content = getAgentContent(promptName)?.content || getInstinctContent(promptName);
    }
    if (!content) {
      sendError(id, -32601, `Prompt '${promptName}' not found`);
      return;
    }
    sendResponse(id, {
      description: `Aveyx directive: ${promptName}`,
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: content }
        }
      ]
    });
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
          content: [{ type: 'text', text: `Error: Specialist '${agentId}' not found in Aveyx.` }]
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
          content: [{ type: 'text', text: `Error: Instinct '${instinctId}' not found in Aveyx.` }]
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

    if (name === 'aveyx_compact_code') {
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

    if (name === 'aveyx_audit_code_bugs') {
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

    if (name === 'aveyx_checkpoint') {
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

    if (name === 'aveyx_rollback') {
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

    if (name === 'aveyx_trace_symbol') {
      try {
        const workspaceRoot = path.resolve(process.cwd());
        const requestedDir = args?.project_dir ? path.resolve(workspaceRoot, String(args.project_dir)) : workspaceRoot;
        const rel = path.relative(workspaceRoot, requestedDir);
        const allowExternal = process.env.AVEYX_ALLOW_EXTERNAL_DIR === '1';
        if (!allowExternal && (rel.startsWith('..') || path.isAbsolute(rel))) {
          sendResponse(id, {
            isError: true,
            content: [{ type: 'text', text: 'Error: project_dir must stay within the active workspace directory.' }]
          });
          return;
        }
        const { traceSymbol } = await import('../scripts/symbol-tracer.js');
        const res = traceSymbol(args?.symbol_name || '', requestedDir);
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

    if (name === 'aveyx_impact_radius') {
      try {
        const workspaceRoot = path.resolve(process.cwd());
        const requestedDir = args?.project_dir ? path.resolve(workspaceRoot, String(args.project_dir)) : workspaceRoot;
        const rel = path.relative(workspaceRoot, requestedDir);
        const allowExternal = process.env.AVEYX_ALLOW_EXTERNAL_DIR === '1';
        if (!allowExternal && (rel.startsWith('..') || path.isAbsolute(rel))) {
          sendResponse(id, {
            isError: true,
            content: [{ type: 'text', text: 'Error: project_dir must stay within the active workspace directory.' }]
          });
          return;
        }
        if (args?.files !== undefined && (!Array.isArray(args.files) || args.files.some(f => typeof f !== 'string'))) {
          sendResponse(id, {
            isError: true,
            content: [{ type: 'text', text: 'Error: files parameter must be an array of string file paths.' }]
          });
          return;
        }
        const { analyzeImpact } = await import('../scripts/impact-analyzer.js');
        const filesArg = Array.isArray(args?.files) ? args.files : [];
        const res = analyzeImpact(filesArg, requestedDir);
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
        });
      } catch (err) {
        sendResponse(id, {
          isError: true,
          content: [{ type: 'text', text: `Error analyzing impact: ${err.message}` }]
        });
      }
      return;
    }

    if (name === 'aveyx_audit_diff') {
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
