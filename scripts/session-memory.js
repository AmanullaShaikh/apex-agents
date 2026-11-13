#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function getMemoryFile(targetDir = process.cwd()) {
  const memoryDir = path.join(targetDir, '.agents');
  fs.mkdirSync(memoryDir, { recursive: true });
  return path.join(memoryDir, 'memory.json');
}

function loadMemory(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      decisions: [],
      architecturalRules: [],
      knownBugs: []
    };
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      decisions: [],
      architecturalRules: [],
      knownBugs: []
    };
  }
}

function saveMemory(filePath, data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

export function handleMemory(args = [], cwd = process.cwd()) {
  const subCommand = args[0] || 'recall';
  const memoryFile = getMemoryFile(cwd);
  const data = loadMemory(memoryFile);

  switch (subCommand) {
    case 'record':
    case 'add': {
      const category = args[1] || 'decision';
      const entry = args.slice(2).join(' ').trim();

      if (!entry) {
        console.error(`\n${c.red}Usage: npx apex-agents memory record <decision|rule|bug> "<text>"${c.reset}\n`);
        process.exit(1);
      }

      if (category === 'rule' || category === 'architecture') {
        data.architecturalRules.push({ text: entry, timestamp: new Date().toISOString() });
      } else if (category === 'bug') {
        data.knownBugs.push({ text: entry, timestamp: new Date().toISOString() });
      } else {
        data.decisions.push({ text: entry, timestamp: new Date().toISOString() });
      }

      saveMemory(memoryFile, data);
      console.log(`\n${c.green}${c.bold}✓ Memory recorded [${category.toUpperCase()}]:${c.reset} ${c.cyan}${entry}${c.reset}\n`);
      break;
    }

    case 'recall':
    case 'list': {
      console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: PERSISTENT SESSION MEMORY ═════${c.reset}`);
      console.log(`Storage: ${c.cyan}${memoryFile}${c.reset} (Updated: ${new Date(data.lastUpdated).toLocaleString()})\n`);

      console.log(`${c.bold}Architectural Rules (${data.architecturalRules.length}):${c.reset}`);
      if (data.architecturalRules.length === 0) console.log(`  ${c.gray}(None recorded yet)${c.reset}`);
      for (const r of data.architecturalRules) {
        console.log(`  ${c.green}•${c.reset} ${r.text}`);
      }

      console.log(`\n${c.bold}Key Technical Decisions (${data.decisions.length}):${c.reset}`);
      if (data.decisions.length === 0) console.log(`  ${c.gray}(None recorded yet)${c.reset}`);
      for (const d of data.decisions) {
        console.log(`  ${c.cyan}•${c.reset} ${d.text}`);
      }

      console.log(`\n${c.bold}Known Bugs & Gotchas (${data.knownBugs.length}):${c.reset}`);
      if (data.knownBugs.length === 0) console.log(`  ${c.gray}(None recorded yet)${c.reset}`);
      for (const b of data.knownBugs) {
        console.log(`  ${c.yellow}•${c.reset} ${b.text}`);
      }
      console.log();
      break;
    }

    case 'sync': {
      // Sync memory into CLAUDE.md and .cursorrules
      let memoryBlock = `\n<!-- APEX-AGENTS PERSISTENT MEMORY -->\n## Persistent Repository Memory & Decisions\n`;
      if (data.architecturalRules.length > 0) {
        memoryBlock += `### Core Architectural Rules:\n` + data.architecturalRules.map((r) => `- ${r.text}`).join('\n') + '\n\n';
      }
      if (data.decisions.length > 0) {
        memoryBlock += `### Key Decisions:\n` + data.decisions.map((d) => `- ${d.text}`).join('\n') + '\n\n';
      }
      if (data.knownBugs.length > 0) {
        memoryBlock += `### Known Bugs & Gotchas:\n` + data.knownBugs.map((b) => `- ${b.text}`).join('\n') + '\n\n';
      }

      for (const f of ['CLAUDE.md', '.cursorrules']) {
        const p = path.join(cwd, f);
        if (fs.existsSync(p)) {
          let content = fs.readFileSync(p, 'utf-8');
          content = content.replace(/<!-- APEX-AGENTS PERSISTENT MEMORY -->[\s\S]*?(?=(<!--|$))/, '');
          content = content.trim() + '\n\n' + memoryBlock.trim() + '\n';
          fs.writeFileSync(p, content);
          console.log(`  ${c.green}✓${c.reset} Synced memory to ${c.cyan}${f}${c.reset}`);
        }
      }
      console.log(`\n${c.green}${c.bold}✓ AI agent context updated with persistent memory!${c.reset}\n`);
      break;
    }

    case 'clear': {
      saveMemory(memoryFile, {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        decisions: [],
        architecturalRules: [],
        knownBugs: []
      });
      console.log(`\n${c.yellow}✓ Persistent session memory cleared.${c.reset}\n`);
      break;
    }

    default:
      console.log(`\n${c.bold}Apex Agents Session Memory Commands:${c.reset}`);
      console.log(`  ${c.green}npx apex-agents memory record decision "<text>"${c.reset}`);
      console.log(`  ${c.green}npx apex-agents memory record rule "<text>"${c.reset}`);
      console.log(`  ${c.green}npx apex-agents memory record bug "<text>"${c.reset}`);
      console.log(`  ${c.green}npx apex-agents memory recall${c.reset}`);
      console.log(`  ${c.green}npx apex-agents memory sync${c.reset}`);
      console.log(`  ${c.green}npx apex-agents memory clear${c.reset}\n`);
      break;
  }
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('session-memory.js')) {
  handleMemory(process.argv.slice(2));
}
