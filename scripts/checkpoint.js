#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

export function getCheckpointsDir(projectDir = process.cwd()) {
  const dir = path.join(projectDir, '.agents', 'checkpoints');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Creates an atomic checkpoint of the working tree.
 */
export function createCheckpoint(label = 'manual-checkpoint', projectDir = process.cwd()) {
  const checkpointsDir = getCheckpointsDir(projectDir);
  const timestamp = Date.now();
  const id = `chk_${timestamp}`;
  const chkFolder = path.join(checkpointsDir, id);
  const filesFolder = path.join(chkFolder, 'files');
  fs.mkdirSync(filesFolder, { recursive: true });

  let gitCommit = 'non-git';
  let branch = 'unknown';
  let modifiedFiles = [];

  try {
    gitCommit = execSync('git rev-parse HEAD', { cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const statusOutput = execSync('git status --porcelain', { cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    
    const lines = statusOutput.split('\n').filter(Boolean);
    for (const line of lines) {
      const filePath = line.slice(3).trim();
      // Skip checkpoints folder itself
      if (filePath.includes('.agents/checkpoints') || filePath.includes('.agents\\checkpoints')) continue;
      modifiedFiles.push({
        status: line.slice(0, 2).trim(),
        path: filePath
      });

      const fullSource = path.join(projectDir, filePath);
      if (fs.existsSync(fullSource) && fs.statSync(fullSource).isFile()) {
        const dest = path.join(filesFolder, filePath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(fullSource, dest);
      }
    }
  } catch {
    // If not a git repo, fallback to manual files snapshot
  }

  const meta = {
    id,
    label,
    timestamp,
    iso: new Date(timestamp).toISOString(),
    gitCommit,
    branch,
    modifiedFilesCount: modifiedFiles.length,
    modifiedFiles
  };

  fs.writeFileSync(path.join(chkFolder, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}

/**
 * Lists all available checkpoints.
 */
export function listCheckpoints(projectDir = process.cwd()) {
  const checkpointsDir = getCheckpointsDir(projectDir);
  const entries = fs.readdirSync(checkpointsDir, { withFileTypes: true });
  const list = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('chk_')) {
      const metaPath = path.join(checkpointsDir, entry.name, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          list.push(meta);
        } catch {
          // Ignore corrupt entry
        }
      }
    }
  }

  return list.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Restores the working tree to a specified checkpoint.
 */
export function rollbackToCheckpoint(checkpointId = null, projectDir = process.cwd()) {
  const list = listCheckpoints(projectDir);
  if (list.length === 0) {
    throw new Error('No checkpoints found to rollback to.');
  }

  const target = checkpointId
    ? list.find(c => c.id === checkpointId || c.label === checkpointId)
    : list[0]; // Most recent

  if (!target) {
    throw new Error(`Checkpoint "${checkpointId}" not found.`);
  }

  const chkFolder = path.join(getCheckpointsDir(projectDir), target.id);
  const filesFolder = path.join(chkFolder, 'files');

  let restoredCount = 0;
  if (fs.existsSync(filesFolder)) {
    const copyRecursive = (src, destBase, rel = '') => {
      const items = fs.readdirSync(src, { withFileTypes: true });
      for (const item of items) {
        const currentRel = path.join(rel, item.name);
        const itemSrc = path.join(src, item.name);
        if (item.isDirectory()) {
          copyRecursive(itemSrc, destBase, currentRel);
        } else {
          const itemDest = path.join(destBase, currentRel);
          fs.mkdirSync(path.dirname(itemDest), { recursive: true });
          fs.copyFileSync(itemSrc, itemDest);
          restoredCount++;
        }
      }
    };
    copyRecursive(filesFolder, projectDir);
  }

  return { target, restoredCount };
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('checkpoint.js')) {
  const action = process.argv[2] || 'create';
  const param = process.argv[3];

  if (action === 'create' || action === 'save') {
    const meta = createCheckpoint(param || 'manual-save');
    console.log(`\n${c.green}${c.bold}✓ CHECKPOINT SAVED:${c.reset} ${c.cyan}${meta.id}${c.reset} ("${meta.label}")`);
    console.log(`  Modified files preserved: ${c.yellow}${meta.modifiedFilesCount}${c.reset}\n`);
  } else if (action === 'list') {
    const list = listCheckpoints();
    console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: GIT-NATIVE CHECKPOINTS (${list.length}) ═════${c.reset}`);
    list.forEach(chk => {
      console.log(`  • ${c.bold}${chk.id}${c.reset} [${chk.iso.slice(0, 19)}] - "${chk.label}" (${chk.modifiedFilesCount} files)`);
    });
    console.log();
  } else if (action === 'rollback' || action === 'restore') {
    try {
      const res = rollbackToCheckpoint(param);
      console.log(`\n${c.green}${c.bold}✓ ROLLBACK COMPLETE:${c.reset} Restored to ${c.cyan}${res.target.id}${c.reset} ("${res.target.label}")`);
      console.log(`  Files restored: ${c.yellow}${res.restoredCount}${c.reset}\n`);
    } catch (err) {
      console.error(`\n${c.red}✖ Rollback failed:${c.reset}`, err.message);
      process.exit(1);
    }
  }
}
