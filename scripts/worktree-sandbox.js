#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const action = process.argv[2] || 'status';
const taskName = process.argv[3] || `task-${Date.now().toString().slice(-4)}`;

function handleStart(name) {
  const branchName = `apex/${name}`;
  const worktreeDir = path.join(process.cwd(), '.worktrees', name);

  console.log(`\x1b[36m[Apex-Agents] Spawning isolated Git Worktree: ${name}...\x1b[0m`);
  try {
    fs.mkdirSync(path.join(process.cwd(), '.worktrees'), { recursive: true });
    execSync(`git worktree add -b ${branchName} "${worktreeDir}"`, { stdio: 'inherit' });
    console.log(`\n\x1b[32m✓ Isolated sandbox created at:\x1b[0m \x1b[36m${worktreeDir}\x1b[0m`);
    console.log(`\x1b[90mYour main branch is 100% safe. The agent can work in this isolated workspace.\x1b[0m\n`);
  } catch (err) {
    console.error(`\x1b[31mFailed to create git worktree: ${err.message}\x1b[0m`);
  }
}

function handleStatus() {
  console.log(`\x1b[36m[Apex-Agents] Active Git Worktrees:\x1b[0m\n`);
  try {
    const output = execSync('git worktree list', { encoding: 'utf-8' });
    console.log(output);
  } catch (err) {
    console.error(`Failed to list worktrees: ${err.message}`);
  }
}

function handleClean(name) {
  const worktreeDir = path.join(process.cwd(), '.worktrees', name);
  console.log(`\x1b[36m[Apex-Agents] Removing worktree: ${name}...\x1b[0m`);
  try {
    execSync(`git worktree remove "${worktreeDir}" --force`, { stdio: 'inherit' });
    console.log(`\x1b[32m✓ Worktree removed cleanly.\x1b[0m`);
  } catch (err) {
    console.error(`Failed to clean worktree: ${err.message}`);
  }
}

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
