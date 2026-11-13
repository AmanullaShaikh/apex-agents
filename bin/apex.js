#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Terminal ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function banner() {
  console.log(`
${c.cyan}${c.bold}   ___    ___  ______ _  __     ___   _____ _____ _  __ _____ ___ 
  / _ \\  / _ \\|  ____| |/ /    /   \\ / ____|  ___| \\| |_   _/ ___|
 / /_\\ \\| |_| | |__  | ' /    / /_\\ \\ |  __| |__ | . ' | | | \\___ \\ 
 |  _  ||  __/|  __| | . \\    |  _  | | |_ |  __|| |\\  | | |  ___) |
 |_| |_||_|   |____|_|\\_\\   |_| |_|\\_____|_____|_| \\_| |_| |____/ ${c.reset}
  ${c.gray}Autonomous AI Engineering Agency • 60+ Specialists for Claude, Cursor & AGY${c.reset}
  ${c.dim}Author: Amanulla Shaikh • MIT Open Source${c.reset}
`);
}

function printHelp() {
  banner();
  console.log(`${c.bold}USAGE:${c.reset}`);
  console.log(`  npx apex-agents <command> [options]\n`);
  console.log(`${c.bold}COMMANDS:${c.reset}`);
  console.log(`  ${c.green}install${c.reset}     Install all agent personas & instincts into your AI harness`);
  console.log(`  ${c.green}list${c.reset}        List all available divisions, agents, and operational instincts`);
  console.log(`  ${c.green}inject${c.reset}      Inject agent rules into current project (CLAUDE.md / .cursorrules)`);
  console.log(`  ${c.green}doctor${c.reset}      Verify environment, permissions, and agent configurations\n`);
  console.log(`${c.bold}OPTIONS:${c.reset}`);
  console.log(`  --target    Target harness: claude, cursor, agents, or all (default: all)`);
  console.log(`  --workspace Target current workspace directory (default: current dir)\n`);
}

function getAvailableAgents() {
  const agentsDir = path.join(ROOT_DIR, 'agents');
  const divisions = fs.readdirSync(agentsDir).filter((d) => {
    return fs.statSync(path.join(agentsDir, d)).isDirectory();
  });

  const registry = {};
  for (const div of divisions) {
    const divPath = path.join(agentsDir, div);
    const files = fs.readdirSync(divPath).filter((f) => f.endsWith('.md'));
    registry[div] = files.map((file) => {
      const filePath = path.join(divPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const name = file.replace('.md', '');
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : name;
      return { id: name, file, path: filePath, title };
    });
  }
  return registry;
}

function getInstincts() {
  const instinctsDir = path.join(ROOT_DIR, 'instincts');
  if (!fs.existsSync(instinctsDir)) return [];
  return fs.readdirSync(instinctsDir).filter((f) => f.endsWith('.md')).map((file) => {
    const filePath = path.join(instinctsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const name = file.replace('.md', '');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : name;
    return { id: name, file, path: filePath, title, content };
  });
}

function handleList() {
  banner();
  const registry = getAvailableAgents();
  const instincts = getInstincts();

  console.log(`${c.cyan}${c.bold}═══ OPERATIONAL INSTINCTS (Zero-Slop Reflexes) ═══${c.reset}`);
  for (const inst of instincts) {
    console.log(`  ${c.yellow}⚡ ${inst.id.padEnd(30)}${c.reset} ${c.gray}${inst.title}${c.reset}`);
  }
  console.log();

  console.log(`${c.cyan}${c.bold}═══ SPECIALIZED AGENT DIVISIONS ═══${c.reset}`);
  for (const [div, agents] of Object.entries(registry)) {
    const divTitle = div.toUpperCase().replace('-', ' ');
    console.log(`\n${c.magenta}${c.bold}▶ [DIVISION: ${divTitle}] (${agents.length} Specialists)${c.reset}`);
    for (const ag of agents) {
      console.log(`  ${c.green}• ${ag.id.padEnd(32)}${c.reset} ${c.gray}${ag.title}${c.reset}`);
    }
  }
  console.log(`\n${c.dim}Run 'npx apex-agents install' to deploy these to your AI agent harness.${c.reset}\n`);
}

function handleInstall() {
  banner();
  const homeDir = os.homedir();
  const cwd = process.cwd();

  const targets = [
    { name: 'Universal Agents (~/.agents/apex)', dir: path.join(homeDir, '.agents', 'apex') },
    { name: 'Claude Code Config (~/.claude/agents)', dir: path.join(homeDir, '.claude', 'apex-agents') },
    { name: 'Local Workspace (.agents/apex)', dir: path.join(cwd, '.agents', 'apex') }
  ];

  console.log(`${c.bold}Deploying Apex Agents Agency...${c.reset}\n`);

  for (const target of targets) {
    try {
      fs.mkdirSync(target.dir, { recursive: true });
      
      // Copy agents
      const srcAgents = path.join(ROOT_DIR, 'agents');
      const destAgents = path.join(target.dir, 'agents');
      fs.cpSync(srcAgents, destAgents, { recursive: true, force: true });

      // Copy instincts
      const srcInstincts = path.join(ROOT_DIR, 'instincts');
      const destInstincts = path.join(target.dir, 'instincts');
      fs.cpSync(srcInstincts, destInstincts, { recursive: true, force: true });

      console.log(`  ${c.green}✓${c.reset} Successfully installed to ${c.cyan}${target.name}${c.reset}`);
    } catch (err) {
      console.log(`  ${c.yellow}!${c.reset} Skipped ${target.name}: ${err.message}`);
    }
  }

  console.log(`\n${c.green}${c.bold}🎉 Apex Agents successfully installed!${c.reset}`);
  console.log(`\n${c.bold}HOW TO ACTIVATE IN CHAT OR TERMINAL:${c.reset}`);
  console.log(`  Simply tell your AI agent:`);
  console.log(`  ${c.cyan}"Act as @frontend-architect from Apex Agents to refactor this UI."${c.reset}`);
  console.log(`  ${c.cyan}"Use @database-tuner to diagnose this slow query."${c.reset}`);
  console.log(`  ${c.cyan}"Run @appsec-auditor to audit my authentication endpoints."${c.reset}\n`);
}

function handleInject() {
  banner();
  const cwd = process.cwd();
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  const cursorRulesPath = path.join(cwd, '.cursorrules');

  const registry = getAvailableAgents();
  const instincts = getInstincts();

  let injectionContent = `\n\n<!-- APEX-AGENTS AUTONOMOUS AGENCY INJECTION -->\n`;
  injectionContent += `# Apex Agents Operational Directives\n`;
  injectionContent += `This repository is managed with the Apex Agents Autonomous Engineering Agency standards.\n\n`;
  
  injectionContent += `## Mandatory Operational Instincts:\n`;
  for (const inst of instincts) {
    injectionContent += `### ${inst.title}\n${inst.content}\n\n`;
  }

  // Write to CLAUDE.md
  if (fs.existsSync(claudeMdPath)) {
    fs.appendFileSync(claudeMdPath, injectionContent);
    console.log(`  ${c.green}✓${c.reset} Injected into existing ${c.cyan}CLAUDE.md${c.reset}`);
  } else {
    fs.writeFileSync(claudeMdPath, injectionContent.trim());
    console.log(`  ${c.green}✓${c.reset} Created ${c.cyan}CLAUDE.md${c.reset} with Apex Agents protocols`);
  }

  // Write to .cursorrules
  if (fs.existsSync(cursorRulesPath)) {
    fs.appendFileSync(cursorRulesPath, injectionContent);
    console.log(`  ${c.green}✓${c.reset} Injected into existing ${c.cyan}.cursorrules${c.reset}`);
  } else {
    fs.writeFileSync(cursorRulesPath, injectionContent.trim());
    console.log(`  ${c.green}✓${c.reset} Created ${c.cyan}.cursorrules${c.reset} with Apex Agents protocols`);
  }

  console.log(`\n${c.green}${c.bold}✓ Project successfully supercharged with Apex Agents instincts!${c.reset}\n`);
}

function handleDoctor() {
  banner();
  console.log(`${c.bold}Running Environment Diagnostics...${c.reset}\n`);

  const homeDir = os.homedir();
  const checks = [
    { name: 'Node.js Runtime', status: process.version },
    { name: 'OS Platform', status: `${os.platform()} (${os.arch()})` },
    { name: 'Claude Code Directory', status: fs.existsSync(path.join(homeDir, '.claude')) ? 'Found' : 'Not detected' },
    { name: 'Cursor Configs', status: fs.existsSync(path.join(homeDir, '.cursor')) ? 'Found' : 'Not detected' },
    { name: 'Universal Agents Path', status: fs.existsSync(path.join(homeDir, '.agents')) ? 'Found' : 'Ready to create' },
  ];

  for (const check of checks) {
    console.log(`  • ${check.name.padEnd(25)}: ${c.cyan}${check.status}${c.reset}`);
  }
  console.log(`\n${c.green}✓ Apex Agents engine is ready for deployment.${c.reset}\n`);
}

// Command dispatcher
const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
  case 'install':
    handleInstall();
    break;
  case 'list':
    handleList();
    break;
  case 'inject':
    handleInject();
    break;
  case 'doctor':
    handleDoctor();
    break;
  case 'help':
  default:
    printHelp();
    break;
}
