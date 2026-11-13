#!/usr/bin/env node

import { execSync } from 'child_process';
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

const action = process.argv[2] || 'status';
const taskName = process.argv[3] || `task-${Date.now().toString().slice(-4)}`;

export function handleStart(name, cwd = process.cwd()) {
  const safeName = path.basename(name || 'task').replace(/[^a-zA-Z0-9_-]/g, '_');
  const branchName = `apex/${safeName}`;
  const worktreesBase = path.join(cwd, '.worktrees');
  const worktreeDir = path.join(worktreesBase, safeName);
  const lockFile = path.join(worktreesBase, '.lock');

  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: GIT WORKTREE SANDBOX ═════${c.reset}`);
  console.log(`Spawning isolated workspace: ${c.cyan}${safeName}${c.reset}...\n`);

  fs.mkdirSync(worktreesBase, { recursive: true });

  // Concurrency lock check
  if (fs.existsSync(lockFile)) {
    const lockAgeMs = Date.now() - fs.statSync(lockFile).mtimeMs;
    if (lockAgeMs < 10000) {
      console.error(`${c.red}Collision Blocked: Another worktree operation is currently running.${c.reset}`);
      process.exit(1);
    }
  }

  fs.writeFileSync(lockFile, `pid: ${process.pid}\nstarted: ${new Date().toISOString()}`);

  try {
    // Check if branch already exists
    let branchExists = false;
    try {
      execSync(`git rev-parse --verify ${branchName}`, { stdio: 'ignore', cwd });
      branchExists = true;
    } catch {}

    if (branchExists) {
      execSync(`git worktree add "${worktreeDir}" ${branchName}`, { stdio: 'inherit', cwd });
    } else {
      execSync(`git worktree add -b ${branchName} "${worktreeDir}"`, { stdio: 'inherit', cwd });
    }

    // Copy .env.example if present so new sandbox can build without manual intervention
    const envExample = path.join(cwd, '.env.example');
    const targetEnv = path.join(worktreeDir, '.env');
    if (fs.existsSync(envExample) && !fs.existsSync(targetEnv)) {
      fs.copyFileSync(envExample, targetEnv);
      console.log(`  ${c.green}✓${c.reset} Initialized ${c.cyan}.env${c.reset} from .env.example in sandbox`);
    }

    console.log(`\n  ${c.green}${c.bold}✓ Isolated sandbox created at:${c.reset} ${c.cyan}${worktreeDir}${c.reset}`);
    console.log(`  ${c.gray}Main branch is protected. The agent can build, refactor, and experiment safely here.${c.reset}\n`);
  } catch (err) {
    console.error(`\n${c.red}Failed to create git worktree: ${err.message}${c.reset}\n`);
  } finally {
    try {
      fs.unlinkSync(lockFile);
    } catch {}
  }
}

export function handleStatus(cwd = process.cwd()) {
  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: ACTIVE WORKTREE SANDBOXES ═════${c.reset}\n`);
  try {
    const output = execSync('git worktree list', { encoding: 'utf-8', cwd });
    const lines = output.trim().split('\n');
    for (const l of lines) {
      console.log(`  ${c.green}•${c.reset} ${l}`);
    }
    console.log();
  } catch (err) {
    console.error(`${c.red}Failed to list worktrees: ${err.message}${c.reset}\n`);
  }
}

export function handleClean(name, cwd = process.cwd()) {
  const safeName = path.basename(name || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeName) return;
  const worktreeDir = path.join(cwd, '.worktrees', safeName);
  console.log(`\n${c.cyan}[Apex-Agents] Removing worktree: ${safeName}...${c.reset}`);
  try {
    execSync(`git worktree remove "${worktreeDir}" --force`, { stdio: 'inherit', cwd });
    execSync(`git worktree prune`, { stdio: 'ignore', cwd });
    console.log(`  ${c.green}✓ Worktree removed cleanly.${c.reset}\n`);
  } catch (err) {
    console.error(`  ${c.red}Failed to clean worktree: ${err.message}${c.reset}\n`);
  }
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('worktree-sandbox.js')) {
  switch (action) {
    case 'start':
      handleStart(taskName);
      break;
    case 'clean':
      handleClean(taskName);
      break;
    case 'status':
    default:
      handleStatus();
      break;
  }
}
