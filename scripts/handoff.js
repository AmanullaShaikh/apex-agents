#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

export function generateHandoff(cwd = process.cwd()) {
  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: SESSION HANDOFF GENERATOR ═════${c.reset}`);
  console.log(`Extracting clean session state to prevent context window degradation (>120k tokens)...\n`);

  // 1. Get modified files from git
  let modifiedFiles = [];
  try {
    const status = execSync('git status --short', { encoding: 'utf-8', cwd });
    modifiedFiles = status.trim().split('\n').filter(Boolean).map((l) => l.trim());
  } catch {}

  // 2. Read recent git commit
  let lastCommit = 'None';
  try {
    lastCommit = execSync('git log -1 --oneline', { encoding: 'utf-8', cwd }).trim();
  } catch {}

  // 3. Read active branch
  let currentBranch = 'main';
  try {
    currentBranch = execSync('git branch --show-current', { encoding: 'utf-8', cwd }).trim();
  } catch {}

  // 4. Read memory if available
  const memPath = path.join(cwd, '.agents', 'memory.json');
  let memoryData = { architecturalRules: [], decisions: [], knownBugs: [] };
  if (fs.existsSync(memPath)) {
    try {
      memoryData = JSON.parse(fs.readFileSync(memPath, 'utf-8'));
    } catch {}
  }

  // Format high-density, low-token handoff block
  const handoffContent = `
<session_handoff timestamp="${new Date().toISOString()}" branch="${currentBranch}">
<last_commit>${lastCommit}</last_commit>

<modified_files count="${modifiedFiles.length}">
${modifiedFiles.length > 0 ? modifiedFiles.map((f) => `  - ${f}`).join('\n') : '  - None (clean working tree)'}
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

  const outputPath = path.join(cwd, 'APEX_HANDOFF.md');
  fs.writeFileSync(outputPath, handoffContent + '\n');

  console.log(`${c.bold}SESSION HANDOFF BLOCK (~85 tokens):${c.reset}`);
  console.log(c.yellow + handoffContent + c.reset + '\n');
  console.log(`  ${c.green}✓${c.reset} Saved clean handoff state to: ${c.cyan}${outputPath}${c.reset}`);
  console.log(`${c.gray}Tip: Run '/compact' or start a fresh session and paste this block to eliminate attention drift.${c.reset}\n`);

  return handoffContent;
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('handoff.js')) {
  generateHandoff();
}
