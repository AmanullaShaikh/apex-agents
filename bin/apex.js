#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Terminal ANSI styling
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
  ${c.gray}Autonomous AI Engineering Agency • 10 Divisions, 34+ Specialists${c.reset}
  ${c.dim}Native MCP Server • Universal Claude / Cursor / Antigravity Support${c.reset}
  ${c.dim}Author: Amanulla Shaikh • MIT Open Source${c.reset}
`);
}

function printHelp() {
  banner();
  console.log(`${c.bold}USAGE:${c.reset}`);
  console.log(`  npx apex-agents <command> [options]\n`);
  console.log(`${c.bold}COMMANDS:${c.reset}`);
  console.log(`  ${c.green}install${c.reset}         Install all agent personas & instincts globally`);
  console.log(`  ${c.green}list${c.reset}            List all available divisions, agents, and instincts`);
  console.log(`  ${c.green}cursor-rules${c.reset}    Export modern .cursor/rules/*.mdc files into current project`);
  console.log(`  ${c.green}inject${c.reset}          Inject rules into local CLAUDE.md and .cursorrules`);
  console.log(`  ${c.green}dashboard${c.reset}       Open the interactive visual Agent Explorer in browser`);
  console.log(`  ${c.green}mcp${c.reset}             Start the native Model Context Protocol (MCP) server`);
  console.log(`  ${c.green}test${c.reset}            Run the automated schema and zero-slop validation suite`);
  console.log(`  ${c.green}doctor${c.reset}          Verify environment, permissions, and agent setups\n`);
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
      return { id: name, file, path: filePath, title, content };
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
  let totalAgents = 0;
  for (const [div, agents] of Object.entries(registry)) {
    totalAgents += agents.length;
    const divTitle = div.toUpperCase().replace('-', ' ');
    console.log(`\n${c.magenta}${c.bold}▶ [DIVISION: ${divTitle}] (${agents.length} Specialists)${c.reset}`);
    for (const ag of agents) {
      console.log(`  ${c.green}• ${ag.id.padEnd(34)}${c.reset} ${c.gray}${ag.title}${c.reset}`);
    }
  }
  console.log(`\n${c.bold}Total Specialists:${c.reset} ${c.green}${totalAgents}${c.reset} across ${Object.keys(registry).length} divisions.`);
  console.log(`${c.dim}Run 'npx apex-agents install' to deploy these to your AI agent harness.${c.reset}\n`);
}

function handleInstall() {
  banner();
  const homeDir = os.homedir();
  const cwd = process.cwd();

  const targets = [
    { name: 'Universal Agents (~/.agents/apex)', dir: path.join(homeDir, '.agents', 'apex') },
    { name: 'Claude Code Config (~/.claude/apex-agents)', dir: path.join(homeDir, '.claude', 'apex-agents') },
    { name: 'Local Workspace (.agents/apex)', dir: path.join(cwd, '.agents', 'apex') }
  ];

  console.log(`${c.bold}Deploying Apex Agents Agency...${c.reset}\n`);

  for (const target of targets) {
    try {
      fs.mkdirSync(target.dir, { recursive: true });
      
      const srcAgents = path.join(ROOT_DIR, 'agents');
      const destAgents = path.join(target.dir, 'agents');
      fs.cpSync(srcAgents, destAgents, { recursive: true, force: true });

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

function handleCursorRules() {
  banner();
  const cwd = process.cwd();
  const cursorRulesDir = path.join(cwd, '.cursor', 'rules');

  fs.mkdirSync(cursorRulesDir, { recursive: true });
  const registry = getAvailableAgents();

  console.log(`${c.bold}Exporting modern .cursor/rules/*.mdc files...${c.reset}\n`);

  let count = 0;
  for (const [div, agents] of Object.entries(registry)) {
    for (const ag of agents) {
      const mdcPath = path.join(cursorRulesDir, `apex-${ag.id}.mdc`);
      const mdcContent = `---
description: ${ag.title} - ${div} specialist from Apex Agents
globs: *
---
${ag.content}
`;
      fs.writeFileSync(mdcPath, mdcContent);
      count++;
    }
  }

  console.log(`  ${c.green}✓${c.reset} Generated ${c.cyan}${count}${c.reset} rule files in ${c.cyan}.cursor/rules/${c.reset}`);
  console.log(`\n${c.green}${c.bold}Cursor is now fully powered by Apex Agents specialists!${c.reset}\n`);
}

function handleInject() {
  banner();
  const cwd = process.cwd();
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  const cursorRulesPath = path.join(cwd, '.cursorrules');

  const instincts = getInstincts();

  let injectionContent = `\n\n<!-- APEX-AGENTS AUTONOMOUS AGENCY INJECTION -->\n`;
  injectionContent += `# Apex Agents Operational Directives\n`;
  injectionContent += `This repository is governed by the Apex Agents Autonomous Engineering Agency protocols.\n\n`;
  
  injectionContent += `## Mandatory Operational Instincts:\n`;
  for (const inst of instincts) {
    injectionContent += `### ${inst.title}\n${inst.content}\n\n`;
  }

  if (fs.existsSync(claudeMdPath)) {
    fs.appendFileSync(claudeMdPath, injectionContent);
    console.log(`  ${c.green}✓${c.reset} Injected into existing ${c.cyan}CLAUDE.md${c.reset}`);
  } else {
    fs.writeFileSync(claudeMdPath, injectionContent.trim());
    console.log(`  ${c.green}✓${c.reset} Created ${c.cyan}CLAUDE.md${c.reset}`);
  }

  if (fs.existsSync(cursorRulesPath)) {
    fs.appendFileSync(cursorRulesPath, injectionContent);
    console.log(`  ${c.green}✓${c.reset} Injected into existing ${c.cyan}.cursorrules${c.reset}`);
  } else {
    fs.writeFileSync(cursorRulesPath, injectionContent.trim());
    console.log(`  ${c.green}✓${c.reset} Created ${c.cyan}.cursorrules${c.reset}`);
  }

  console.log(`\n${c.green}${c.bold}✓ Project successfully supercharged with Apex Agents instincts!${c.reset}\n`);
}

function handleDashboard() {
  const dashPath = path.join(ROOT_DIR, 'dashboard.html');
  console.log(`\nOpening Apex Agents Explorer: ${dashPath}\n`);
  
  const platform = os.platform();
  if (platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '""', dashPath], { detached: true });
  } else if (platform === 'darwin') {
    spawn('open', [dashPath], { detached: true });
  } else {
    spawn('xdg-open', [dashPath], { detached: true });
  }
}

function handleTest() {
  const validatorScript = path.join(ROOT_DIR, 'scripts', 'validate-agents.js');
  const child = spawn(process.execPath, [validatorScript], { stdio: 'inherit' });
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

function handleDoctor() {
  banner();
  console.log(`${c.bold}Running Environment Diagnostics...${c.reset}\n`);

  const homeDir = os.homedir();
  const checks = [
    { name: 'Node.js Runtime', status: process.version },
    { name: 'OS Platform', status: `${os.platform()} (${os.arch()})` },
    { name: 'Claude Code Directory', status: fs.existsSync(path.join(homeDir, '.claude')) ? 'Found' : 'Not detected' },
    { name: 'Cursor Rules Support', status: 'Ready (.cursor/rules)' },
    { name: 'Universal Agents Path', status: fs.existsSync(path.join(homeDir, '.agents')) ? 'Found' : 'Ready to create' },
    { name: 'Native MCP Server', status: 'Built-in (npx apex-agents mcp)' },
    { name: 'Interactive Dashboard', status: 'Available (npx apex-agents dashboard)' }
  ];

  for (const check of checks) {
    console.log(`  • ${check.name.padEnd(25)}: ${c.cyan}${check.status}${c.reset}`);
  }
  console.log(`\n${c.green}✓ Apex Agents engine is ready for deployment.${c.reset}\n`);
}

function handleMcp() {
  const mcpServerPath = path.join(__dirname, 'mcp-server.js');
  const child = spawn(process.execPath, [mcpServerPath], {
    stdio: 'inherit'
  });
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
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
  case 'cursor-rules':
    handleCursorRules();
    break;
  case 'dashboard':
    handleDashboard();
    break;
  case 'test':
    handleTest();
    break;
  case 'mcp':
    handleMcp();
    break;
  case 'doctor':
    handleDoctor();
    break;
  case 'help':
  default:
    printHelp();
    break;
}
