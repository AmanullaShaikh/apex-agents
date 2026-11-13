#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let pkgVersion = '2.0.0';
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
    description: 'Lists all available specialized agents in the Apex Agents Agency by division',
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
      // Invalid JSON
    }
  }
});

function handleMessage(msg) {
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

    sendError(id, -32601, `Method not found: tool ${name}`);
    return;
  }

  // Fallback for unknown methods
  if (id !== undefined) {
    sendError(id, -32601, `Method '${method}' not implemented`);
  }
}
