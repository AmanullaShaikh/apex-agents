#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, spawnSync, execSync } from 'child_process';
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
  ${c.gray}Developer Tooling & AST Compactor Harness • 10 Divisions, 38 Specialists • 13 Instincts${c.reset}
  ${c.dim}AST Compactor • Dependency Graph • Handoff Engine • Studio TUI • Native MCP${c.reset}
  ${c.dim}Author: Amanulla Shaikh • MIT Open Source${c.reset}
`);
}

function printHelp() {
  banner();
  console.log(`${c.bold}USAGE:${c.reset}`);
  console.log(`  npx apex-agents <command> [options]\n`);
  console.log(`${c.bold}COMMANDS:${c.reset}`);
  console.log(`  ${c.green}init | setup${c.reset}    One-shot setup: injects router, exports Cursor rules & pre-commit hooks`);
  console.log(`  ${c.green}install${c.reset}         Install all agent personas & instincts globally`);
  console.log(`  ${c.green}studio | tui${c.reset}    Launch the interactive keyboard-driven terminal studio`);
  console.log(`  ${c.green}review | diff${c.reset}   Audit staged/committed git diff for secret leaks, test tampering & slop`);
  console.log(`  ${c.green}budget${c.reset}          Analyze context window token bloat & generate .cursorignore`);
  console.log(`  ${c.green}memory [cmd]${c.reset}    Manage persistent cross-session memory [record|recall|sync|clear]`);
  console.log(`  ${c.green}graph${c.reset}           Analyze AST codebase dependencies & detect circular import cycles`);
  console.log(`  ${c.green}diagram${c.reset}         Generate responsive dark-mode HTML architecture diagram`);
  console.log(`  ${c.green}compact${c.reset}         Shrink codebase tokens with Babel AST PageRank & callers [--xml|--json|--top|--budget]`);
  console.log(`  ${c.green}test-loop${c.reset}       Run test suite & synthesize structured APEX_FIX_PROMPT.md on failure`);
  console.log(`  ${c.green}checkpoint${c.reset}      Save atomic git-native working tree snapshot [save <label>|list|rollback]`);
  console.log(`  ${c.green}rollback${c.reset}        Restore working tree, .env & hooks to previous checkpoint`);
  console.log(`  ${c.green}trace <symbol>${c.reset}  Trace declaration & cross-file call sites with AST call-graph`);
  console.log(`  ${c.green}audit-bugs${c.reset}      Static AST scan for runtime bugs (SQL injection, hook leaks, floating promises)`);
  console.log(`  ${c.green}cost${c.reset}            Measure repo token volume, AST compaction savings & optional --price-in=<$/1M>`);
  console.log(`  ${c.green}handoff${c.reset}         Generate clean session handoff block to reduce context drift`);
  console.log(`  ${c.green}export-all${c.reset}      Generate configs for Claude, Cursor, Windsurf, Copilot, & Aider`);
  console.log(`  ${c.green}cursor-rules${c.reset}    Export modern .cursor/rules/*.mdc files into current project`);
  console.log(`  ${c.green}inject${c.reset}          Inject rules into local CLAUDE.md and .cursorrules`);
  console.log(`  ${c.green}install-hooks${c.reset}   Install pre-commit safety hooks (.git/hooks/pre-commit)
  ${c.green}scan-secrets${c.reset}    Scan workspace files for leaked credentials`);
  console.log(`  ${c.green}sandbox${c.reset}         Manage isolated Git Worktree sandboxes [start|clean|status]`);
  console.log(`  ${c.green}dashboard${c.reset}       Open the interactive visual Agent Explorer in browser`);
  console.log(`  ${c.green}mcp${c.reset}             Start the native Model Context Protocol (MCP) server`);
  console.log(`  ${c.green}test${c.reset}            Run the automated schema validation suite`);
  console.log(`  ${c.green}doctor${c.reset}          Verify environment, git hooks, and agent setup\n`);
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
    console.log(`  ${c.yellow}⚡ ${inst.id.padEnd(32)}${c.reset} ${c.gray}${inst.title}${c.reset}`);
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

  console.log(`${c.bold}Deploying Apex Agents...${c.reset}\n`);

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

function handleInject(args = []) {
  banner();
  const cwd = process.cwd();
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  const cursorRulesPath = path.join(cwd, '.cursorrules');
  const isFull = args.includes('--full');

  let injectionContent = `\n\n<!-- APEX-AGENTS OPERATIONAL DIRECTIVES -->\n`;
  injectionContent += `# Apex Agents Operational Directives\n`;
  injectionContent += `This repository uses Apex Agents developer tooling and zero-slop execution rules.\n\n`;

  if (isFull) {
    const instincts = getInstincts();
    injectionContent += `## Mandatory Operational Instincts (Full Inlined):\n`;
    for (const inst of instincts) {
      injectionContent += `### ${inst.title}\n${inst.content}\n\n`;
    }
  } else {
    // Lean router (<120 tokens) to prevent context inflation trap
    injectionContent += `## Core Zero-Slop Execution Directives:
1. Zero-Slop Contract: Strictly forbids TODO and FIXME placeholders, empty handlers, and cosmetic stubs.
2. Anti-Test-Tampering: Never skip tests (it.skip/xit) or comment out assertions to fake success. Fix the code, never weaken the test.
3. Verification Gate: Run compilers, linters, and test suites physically before claiming completion.
4. Minimal Diffs: The best code is code never written. Delete before adding. Standard library over npm dependencies.

## Dynamic Specialists & Memory:
- For deep tasks, summon domain specialists: @frontend-architect, @database-tuner, @appsec-auditor, @system-design-architect, @typescript-pro.
- Track project decisions with 'npx apex-agents memory record <type> "<text>"'.
- Generate lean codebase context with 'npx apex-agents compact'.\n\n`;
  }

  const upsertDirectives = (filePath, label) => {
    const marker = '<!-- APEX-AGENTS OPERATIONAL DIRECTIVES -->';
    const trimmedBlock = injectionContent.trim();
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf-8');
      if (existing.includes(marker)) {
        const updated = existing.replace(/<!-- APEX-AGENTS OPERATIONAL DIRECTIVES -->[\s\S]*?(?=(<!--|$))/, trimmedBlock + '\n\n').trim() + '\n';
        fs.writeFileSync(filePath, updated);
      } else {
        fs.writeFileSync(filePath, existing.trimEnd() + '\n\n' + trimmedBlock + '\n');
      }
      console.log(`  ${c.green}✓${c.reset} Updated ${c.cyan}${label}${c.reset}`);
    } else {
      fs.writeFileSync(filePath, trimmedBlock + '\n');
      console.log(`  ${c.green}✓${c.reset} Created ${c.cyan}${label}${c.reset}`);
    }
  };

  upsertDirectives(claudeMdPath, 'CLAUDE.md');
  upsertDirectives(cursorRulesPath, '.cursorrules');

  console.log(`\n${c.green}${c.bold}✓ Injected Apex Agents rules into local IDE config files.${c.reset}\n`);
}

function handleCompact(args) {
  const compactorScript = path.join(ROOT_DIR, 'scripts', 'compact-context.js');
  const child = spawn(process.execPath, [compactorScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleTestLoop(args) {
  const testLoopScript = path.join(ROOT_DIR, 'scripts', 'test-loop.js');
  const child = spawn(process.execPath, [testLoopScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleCheckpoint(args) {
  const checkpointScript = path.join(ROOT_DIR, 'scripts', 'checkpoint.js');
  let action = 'save';
  let param = '';
  if (args[0] === 'list' || args[0] === 'ls') {
    action = 'list';
  } else if (args[0] === 'rollback' || args[0] === 'restore') {
    action = 'rollback';
    param = args[1] || '';
  } else if (args[0] === 'save' || args[0] === 'create') {
    action = 'save';
    param = args.slice(1).join(' ') || 'manual-save';
  } else {
    action = 'save';
    param = args.join(' ') || 'manual-save';
  }
  const child = spawn(process.execPath, [checkpointScript, action, param], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleRollback(args) {
  const checkpointScript = path.join(ROOT_DIR, 'scripts', 'checkpoint.js');
  const param = args.join(' ') || '';
  const child = spawn(process.execPath, [checkpointScript, 'rollback', param], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleTrace(args) {
  const traceScript = path.join(ROOT_DIR, 'scripts', 'symbol-tracer.js');
  const child = spawn(process.execPath, [traceScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleAuditBugs(args) {
  const auditBugsScript = path.join(ROOT_DIR, 'scripts', 'audit-bugs.js');
  const child = spawn(process.execPath, [auditBugsScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleCost(args) {
  const costScript = path.join(ROOT_DIR, 'scripts', 'token-cost.js');
  const child = spawn(process.execPath, [costScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleExportAll(args) {
  const exporterScript = path.join(ROOT_DIR, 'scripts', 'export-all.js');
  const child = spawn(process.execPath, [exporterScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleStudio() {
  const tuiScript = path.join(__dirname, 'tui.js');
  const child = spawn(process.execPath, [tuiScript], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleInit(args) {
  banner();
  console.log(`${c.bold}⚡ Initializing Apex Agents Developer Tooling Suite in Project...${c.reset}\n`);

  console.log(`${c.cyan}1. Injecting Lean Agent Directives (CLAUDE.md & .cursorrules)...${c.reset}`);
  handleInject(args);

  console.log(`${c.cyan}2. Exporting Modern .cursor/rules/*.mdc Specialists...${c.reset}`);
  handleCursorRules();

  console.log(`${c.cyan}3. Installing Pre-Commit Hardened Safety Hooks...${c.reset}`);
  const gitCommonDir = resolveGitCommonDir(process.cwd());
  if (gitCommonDir) {
    const hooksScript = path.join(ROOT_DIR, 'scripts', 'install-hooks.js');
    const hookRes = spawnSync(process.execPath, [hooksScript], { stdio: 'inherit' });
    if (hookRes.status !== 0) {
      process.exit(hookRes.status || 1);
    }
  } else {
    console.log(`  ${c.yellow}! Skipped git hook installation (no git repository in current workspace)${c.reset}`);
  }

  console.log(`\n${c.green}${c.bold}🚀 APEX AGENTS SUITE FULLY INITIALIZED!${c.reset}`);
  console.log(`${c.bold}Your repository is now equipped with:${c.reset}`);
  console.log(`  • 38 Domain Specialist prompt packs in Cursor & Claude Code`);
  console.log(`  • Pre-commit anti-test-tampering and secret leak gates`);
  console.log(`  • Babel AST context compactor ('npx apex-agents compact')`);
  console.log(`  • Cross-session persistent memory ('npx apex-agents memory')\n`);
}

function handleInstallHooks() {
  const hooksScript = path.join(ROOT_DIR, 'scripts', 'install-hooks.js');
  const child = spawn(process.execPath, [hooksScript], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleSandbox(subAction = 'status', name = null) {
  const sandboxScript = path.join(ROOT_DIR, 'scripts', 'worktree-sandbox.js');
  const sandboxArgs = [sandboxScript, subAction || 'status'];
  if (name) sandboxArgs.push(name);
  const child = spawn(process.execPath, sandboxArgs, { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleScanSecrets(args) {
  const scanScript = path.join(ROOT_DIR, 'scripts', 'scan-secrets.js');
  const child = spawn(process.execPath, [scanScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
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

function resolveGitCommonDir(cwd) {
  try {
    const common = execSync('git rev-parse --git-common-dir', {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (!common) return null;
    return path.resolve(cwd, common);
  } catch {
    return null;
  }
}

function handleDoctor() {
  banner();
  console.log(`${c.bold}Running Environment Diagnostics...${c.reset}\n`);

  const homeDir = os.homedir();
  const cwd = process.cwd();
  const gitCommonDir = resolveGitCommonDir(cwd);
  const hasGit = Boolean(gitCommonDir);
  const preCommitPath = gitCommonDir ? path.join(gitCommonDir, 'hooks', 'pre-commit') : null;
  let hookInstalled = false;
  if (preCommitPath && fs.existsSync(preCommitPath)) {
    try {
      const hookContent = fs.readFileSync(preCommitPath, 'utf-8');
      hookInstalled = /apex-agents|audit-diff/i.test(hookContent);
    } catch {
      hookInstalled = false;
    }
  }
  const hookStatus = !hasGit
    ? 'Not a git repository'
    : (hookInstalled ? 'Installed (.git/hooks/pre-commit)' : 'Not installed (run npx apex-agents install-hooks)');
  const antiCheatStatus = !hasGit
    ? 'Inactive (not a git repository)'
    : (hookInstalled ? 'Active (.git/hooks/pre-commit)' : 'Inactive (run npx apex-agents install-hooks)');
  const cursorRulesStatus = fs.existsSync(path.join(cwd, '.cursor', 'rules'))
    ? 'Installed (.cursor/rules)'
    : 'Not initialized (run npx apex-agents init)';

  const checks = [
    { name: 'Node.js Runtime', status: process.version },
    { name: 'OS Platform', status: `${os.platform()} (${os.arch()})` },
    { name: 'Git Repository', status: hasGit ? 'Detected (.git)' : 'Not detected in cwd' },
    { name: 'Claude Code Directory', status: fs.existsSync(path.join(homeDir, '.claude')) ? 'Found' : 'Not detected' },
    { name: 'Cursor Rules Support', status: cursorRulesStatus },
    { name: 'Multi-IDE Exporter', status: 'Available (npx apex-agents export-all)' },
    { name: 'AST PageRank Compactor', status: 'Ready (npx apex-agents compact)' },
    { name: 'Test-Loop Runner', status: 'Ready (npx apex-agents test-loop)' },
    { name: 'Git-Native Checkpoints', status: hasGit ? 'Ready (npx apex-agents checkpoint)' : 'Requires git repo' },
    { name: 'Semantic Symbol Tracer', status: 'Ready (npx apex-agents trace)' },
    { name: 'AST Bug Hunter', status: 'Ready (npx apex-agents audit-bugs)' },
    { name: 'Token Volume Auditor', status: 'Ready (npx apex-agents cost)' },
    { name: 'AST Dependency Graph', status: 'Available (npx apex-agents graph)' },
    { name: 'Architecture Diagram', status: 'Available (npx apex-agents diagram)' },
    { name: 'Session Handoff Engine', status: 'Available (npx apex-agents handoff)' },
    { name: 'Persistent Session Memory', status: 'Available (npx apex-agents memory)' },
    { name: 'Anti-Cheat Test Guard', status: antiCheatStatus },
    { name: 'Terminal Studio (TUI)', status: 'Available (npx apex-agents studio)' },
    { name: 'Git Worktree Sandbox', status: hasGit ? 'Available (npx apex-agents sandbox)' : 'Requires git repo' },
    { name: 'Pre-Commit Safety Hooks', status: hookStatus },
    { name: 'Native MCP Server', status: 'Built-in (npx apex-agents mcp)' },
    { name: 'Interactive Dashboard', status: 'Available (npx apex-agents dashboard)' }
  ];

  for (const check of checks) {
    console.log(`  • ${check.name.padEnd(25)}: ${c.cyan}${check.status}${c.reset}`);
  }
  console.log(`\n${c.green}✓ Apex Agents engine is ready.${c.reset}\n`);
}

function handleReview(args) {
  const reviewScript = path.join(ROOT_DIR, 'scripts', 'audit-diff.js');
  const child = spawn(process.execPath, [reviewScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleBudget(args) {
  const budgetScript = path.join(ROOT_DIR, 'scripts', 'token-budget.js');
  const child = spawn(process.execPath, [budgetScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleMemory(args) {
  const memoryScript = path.join(ROOT_DIR, 'scripts', 'session-memory.js');
  const child = spawn(process.execPath, [memoryScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleGraph(args) {
  const graphScript = path.join(ROOT_DIR, 'scripts', 'dependency-graph.js');
  const child = spawn(process.execPath, [graphScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleDiagram(args) {
  const diagramScript = path.join(ROOT_DIR, 'scripts', 'generate-diagram.js');
  const child = spawn(process.execPath, [diagramScript, ...args], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function handleHandoff() {
  const handoffScript = path.join(ROOT_DIR, 'scripts', 'handoff.js');
  const child = spawn(process.execPath, [handoffScript], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
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

function printVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
    console.log(`apex-agents v${pkg.version}`);
  } catch {
    console.log('apex-agents v2.1.0');
  }
}

// Command dispatcher
const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
  case '-v':
  case '--version':
  case 'version':
    printVersion();
    break;
  case '-h':
  case '--help':
  case 'help':
    printHelp();
    break;
  case 'init':
  case 'setup':
    handleInit(args.slice(1));
    break;
  case 'install':
    handleInstall();
    break;
  case 'list':
    handleList();
    break;
  case 'review':
  case 'diff':
    handleReview(args.slice(1));
    break;
  case 'budget':
    handleBudget(args.slice(1));
    break;
  case 'memory':
    handleMemory(args.slice(1));
    break;
  case 'graph':
    handleGraph(args.slice(1));
    break;
  case 'diagram':
    handleDiagram(args.slice(1));
    break;
  case 'compact':
    handleCompact(args.slice(1));
    break;
  case 'test-loop':
    handleTestLoop(args.slice(1));
    break;
  case 'checkpoint':
  case 'checkpoints':
    handleCheckpoint(args.slice(1));
    break;
  case 'rollback':
  case 'restore':
    handleRollback(args.slice(1));
    break;
  case 'trace':
    handleTrace(args.slice(1));
    break;
  case 'audit-bugs':
  case 'lint-ast':
    handleAuditBugs(args.slice(1));
    break;
  case 'cost':
    handleCost(args.slice(1));
    break;
  case 'export-all':
    handleExportAll(args.slice(1));
    break;
  case 'studio':
  case 'tui':
    handleStudio();
    break;
  case 'inject':
    handleInject(args.slice(1));
    break;
  case 'handoff':
    handleHandoff();
    break;
  case 'cursor-rules':
    handleCursorRules();
    break;
  case 'install-hooks':
    handleInstallHooks();
    break;
  case 'scan-secrets':
    handleScanSecrets(args.slice(1));
    break;
  case 'sandbox':
    handleSandbox(args[1], args[2]);
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
  default:
    if (!command) {
      printHelp();
      process.exit(0);
    } else {
      console.error(`\n${c.red}Error: Unknown command "${command}".${c.reset}`);
      console.error(`Run "${c.cyan}apex --help${c.reset}" to view all available commands.\n`);
      process.exit(1);
    }
    break;
}
