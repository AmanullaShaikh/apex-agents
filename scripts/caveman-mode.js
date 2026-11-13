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

const CAVEMAN_PROMPT = `
<!-- APEX-AGENTS CAVEMAN TOKEN THRIFT MODE ACTIVE -->
[MODE: CAVEMAN - 65% TOKEN THRIFT]
talk terse. no polite filler. no "sure!", "happy to help".
state root cause in 1 line. state fix in 1 line.
code blocks 100% complete, never truncate or stub.
extreme density. save tokens.
`;

export function handleCavemanCommand(action = 'show', targetDir = process.cwd()) {
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
  const cursorRulesPath = path.join(targetDir, '.cursorrules');

  if (action === 'on' || action === 'enable') {
    for (const file of [claudeMdPath, cursorRulesPath]) {
      let existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
      if (!existing.includes('CAVEMAN - 65% TOKEN THRIFT')) {
        existing = CAVEMAN_PROMPT.trim() + '\n\n' + existing;
        fs.writeFileSync(file, existing);
        console.log(`  ${c.green}✓${c.reset} Caveman mode enabled in ${c.cyan}${path.basename(file)}${c.reset}`);
      }
    }
    console.log(`\n${c.green}${c.bold}🪨 Caveman 65% Token Thrift Mode ENABLED!${c.reset}`);
    console.log(`${c.gray}Agent responses will now be ultra-terse, saving 50-65% tokens per interaction.${c.reset}\n`);
  } else if (action === 'off' || action === 'disable') {
    for (const file of [claudeMdPath, cursorRulesPath]) {
      if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf-8');
        content = content.replace(/<!-- APEX-AGENTS CAVEMAN TOKEN THRIFT MODE ACTIVE -->[\s\S]*?extreme density\. save tokens\.\n?/g, '');
        fs.writeFileSync(file, content.trim() + '\n');
        console.log(`  ${c.green}✓${c.reset} Caveman mode removed from ${c.cyan}${path.basename(file)}${c.reset}`);
      }
    }
    console.log(`\n${c.yellow}Caveman mode disabled. Normal conversational length restored.${c.reset}\n`);
  } else {
    console.log(`\n${c.cyan}${c.bold}🪨 APEX AGENTS: CAVEMAN 65% TOKEN REDUCER${c.reset}`);
    console.log(`${c.gray}Based on JuliusBrussee/caveman: "why use many token when few token do trick"${c.reset}\n`);
    console.log(`${c.bold}Directive snippet:${c.reset}`);
    console.log(c.yellow + CAVEMAN_PROMPT.trim() + c.reset + '\n');
    console.log(`Usage:`);
    console.log(`  ${c.green}npx apex-agents caveman on${c.reset}   Enable in local CLAUDE.md and .cursorrules`);
    console.log(`  ${c.green}npx apex-agents caveman off${c.reset}  Disable in local configs\n`);
  }
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('caveman-mode.js')) {
  const action = process.argv[2] || 'show';
  handleCavemanCommand(action);
}
