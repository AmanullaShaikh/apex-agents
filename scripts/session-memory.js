#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __memFilename = fileURLToPath(import.meta.url);
const __memDirname = path.dirname(__memFilename);
let PKG_VERSION = '3.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__memDirname, '..', 'package.json'), 'utf-8'));
  if (pkg.version) PKG_VERSION = pkg.version;
} catch {}

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
  const fallback = {
    version: PKG_VERSION,
    lastUpdated: new Date().toISOString(),
    decisions: [],
    architecturalRules: [],
    knownBugs: []
  };

  if (!fs.existsSync(filePath)) return fallback;

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback;
    }
    return {
      version: parsed.version || PKG_VERSION,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      architecturalRules: Array.isArray(parsed.architecturalRules) ? parsed.architecturalRules : [],
      knownBugs: Array.isArray(parsed.knownBugs) ? parsed.knownBugs : []
    };
  } catch {
    return fallback;
  }
}

function saveMemory(filePath, data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}


export function generateHandoff(cwd = process.cwd()) {
  console.log(`\n${c.cyan}${c.bold}═════ AVEYX: SESSION HANDOFF GENERATOR ═════${c.reset}`);
  console.log(`Extracting clean session state to prevent context window degradation (>120k tokens)...\n`);

  let modifiedFiles = [];
  try {
    const status = execSync('git status --short', { encoding: 'utf-8', cwd, stdio: ['pipe', 'pipe', 'ignore'] });
    modifiedFiles = status.trim().split('\n').filter(Boolean).map((l) => l.trim());
  } catch {}

  let lastCommit = 'None';
  try {
    lastCommit = execSync('git log -1 --oneline', { encoding: 'utf-8', cwd, stdio: ['pipe', 'pipe', 'ignore'] }).trim() || 'None';
  } catch {}

  let currentBranch = 'none';
  try {
    const branchOut = execSync('git branch --show-current', { encoding: 'utf-8', cwd, stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    currentBranch = branchOut || 'HEAD';
  } catch {}

  const memPath = path.join(cwd, '.agents', 'memory.json');
  let memoryData = { architecturalRules: [], decisions: [], knownBugs: [] };
  if (fs.existsSync(memPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(memPath, 'utf-8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        memoryData = {
          architecturalRules: Array.isArray(parsed.architecturalRules) ? parsed.architecturalRules : [],
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
          knownBugs: Array.isArray(parsed.knownBugs) ? parsed.knownBugs : []
        };
      }
    } catch {}
  }

  const displayFiles = modifiedFiles.slice(0, 15);
  const remainingCount = modifiedFiles.length - displayFiles.length;
  const filesListStr = displayFiles.length > 0
    ? displayFiles.map((f) => `  - ${f}`).join('\n') + (remainingCount > 0 ? `\n  - ... and ${remainingCount} more files` : '')
    : '  - None (clean working tree)';

  const handoffContent = `
<session_handoff timestamp="${new Date().toISOString()}" branch="${currentBranch}">
<last_commit>${lastCommit}</last_commit>

<modified_files count="${modifiedFiles.length}">
${filesListStr}
</modified_files>

<active_decisions count="${memoryData.decisions.length}">
${memoryData.decisions.length > 0 ? memoryData.decisions.map((d) => `  - ${d.text}`).join('\n') : '  - Standard architecture conventions active'}
</active_decisions>

<known_bugs count="${memoryData.knownBugs.length}">
${memoryData.knownBugs.length > 0 ? memoryData.knownBugs.map((b) => `  - ${b.text}`).join('\n') : '  - Zero known blockers recorded'}
</known_bugs>

<next_actions>
  1. Review modified files list and verify active branch state.
  2. Continue task without reloading historical conversational logs.
</next_actions>
</session_handoff>
`.trim();

  const outputPath = path.join(cwd, 'AVEYX_HANDOFF.md');
  fs.writeFileSync(outputPath, handoffContent + '\n');

  console.log(`${c.bold}SESSION HANDOFF BLOCK (~85 tokens):${c.reset}`);
  console.log(c.yellow + handoffContent + c.reset + '\n');
  console.log(`  ${c.green}✓${c.reset} Saved clean handoff state to: ${c.cyan}${outputPath}${c.reset}`);
  console.log(`${c.gray}Tip: Run '/compact' or start a fresh session and paste this block to eliminate attention drift.${c.reset}\n`);

  return handoffContent;
}

export function handleMemory(args = [], cwd = process.cwd()) {
  const subCommand = args[0] || 'recall';
  const memoryFile = getMemoryFile(cwd);
  const data = loadMemory(memoryFile);

  switch (subCommand) {
    case 'record':
    case 'add': {
      const validCategories = ['decision', 'decisions', 'rule', 'rules', 'architecture', 'bug', 'bugs'];
      let category = 'decision';
      let entry = '';

      // Check for flags: -k / --key / -t / --type, -v / --value
      const kIdx = args.findIndex(a => a === '-k' || a === '--key' || a === '-t' || a === '--type');
      const vIdx = args.findIndex(a => a === '-v' || a === '--value');

      if (kIdx !== -1 && args[kIdx + 1]) {
        category = args[kIdx + 1].toLowerCase();
      }
      if (vIdx !== -1 && args[vIdx + 1]) {
        entry = args.slice(vIdx + 1).filter(a => !a.startsWith('-')).join(' ').trim();
      }

      // If no flags, parse positional
      if (!entry) {
        if (args.length >= 3) {
          category = args[1].toLowerCase();
          entry = args.slice(2).join(' ').trim();
        } else if (args.length === 2 && !args[1].startsWith('-')) {
          if (validCategories.includes(args[1].toLowerCase())) {
            console.error(`\n${c.red}Error: Entry text is required for category "${args[1]}".${c.reset}`);
            console.error(`Usage: npx aveyx memory record <decision|rule|bug> "<text>"\n`);
            process.exit(1);
          } else {
            entry = args[1].trim();
          }
        }
      }

      if (!validCategories.includes(category)) {
        console.error(`\n${c.red}Error: Invalid category "${category}".${c.reset}`);
        console.error(`Allowed categories: ${c.cyan}decision${c.reset}, ${c.cyan}rule${c.reset}, ${c.cyan}bug${c.reset}`);
        console.error(`Usage: npx aveyx memory record <decision|rule|bug> "<text>"`);
        console.error(`   or: npx aveyx memory record -k <rule|decision|bug> -v "<text>"\n`);
        process.exit(1);
      }

      if (!entry) {
        console.error(`\n${c.red}Usage: npx aveyx memory record <decision|rule|bug> "<text>"${c.reset}\n`);
        process.exit(1);
      }

      const normalizedCat = category.replace(/s$/, '');
      if (normalizedCat === 'rule' || normalizedCat === 'architecture') {
        data.architecturalRules.push({ text: entry, timestamp: new Date().toISOString() });
      } else if (normalizedCat === 'bug') {
        data.knownBugs.push({ text: entry, timestamp: new Date().toISOString() });
      } else {
        data.decisions.push({ text: entry, timestamp: new Date().toISOString() });
      }

      saveMemory(memoryFile, data);
      console.log(`\n${c.green}${c.bold}✓ Memory recorded [${normalizedCat.toUpperCase()}]:${c.reset} ${c.cyan}${entry}${c.reset}\n`);
      break;
    }

    case 'recall':
    case 'list': {
      console.log(`\n${c.cyan}${c.bold}═════ AVEYX: PERSISTENT SESSION MEMORY ═════${c.reset}`);
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
      let memoryBlock = `\n<!-- AVEYX PERSISTENT MEMORY -->\n## Persistent Repository Memory & Decisions\n`;
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
          content = content.replace(/<!-- AVEYX PERSISTENT MEMORY -->[\s\S]*?(?=(<!--|$))/, '');
          content = content.trim() + '\n\n' + memoryBlock.trim() + '\n';
          fs.writeFileSync(p, content);
          console.log(`  ${c.green}✓${c.reset} Synced memory to ${c.cyan}${f}${c.reset}`);
        }
      }
      console.log(`\n${c.green}${c.bold}✓ AI agent context updated with persistent memory!${c.reset}\n`);
      break;
    }

    case 'handoff': {
      generateHandoff(cwd);
      break;
    }

    case 'clear': {
      saveMemory(memoryFile, {
        version: PKG_VERSION,
        lastUpdated: new Date().toISOString(),
        decisions: [],
        architecturalRules: [],
        knownBugs: []
      });
      console.log(`\n${c.yellow}✓ Persistent session memory cleared.${c.reset}\n`);
      break;
    }

    default:
      console.error(`\n${c.red}Error: Unknown memory subcommand "${subCommand}".${c.reset}`);
      console.log(`\n${c.bold}Aveyx Session Memory Commands:${c.reset}`);
      console.log(`  ${c.green}npx aveyx memory record decision "<text>"${c.reset}`);
      console.log(`  ${c.green}npx aveyx memory record rule "<text>"${c.reset}`);
      console.log(`  ${c.green}npx aveyx memory record bug "<text>"${c.reset}`);
      console.log(`  ${c.green}npx aveyx memory recall${c.reset}`);
      console.log(`  ${c.green}npx aveyx memory sync${c.reset}`);
      console.log(`  ${c.green}npx aveyx memory clear${c.reset}\n`);
      process.exit(1);
  }
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('session-memory.js')) {
  handleMemory(process.argv.slice(2));
}
