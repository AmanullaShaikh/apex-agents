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

const IGNORED_SNAPSHOT_DIRS = new Set([
  'node_modules',
  '.git',
  '.agents',
  'dist',
  'build',
  '.next',
  'coverage'
]);

export function getCheckpointsDir(projectDir = process.cwd()) {
  const dir = path.join(projectDir, '.agents', 'checkpoints');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function isGitRepository(projectDir = process.cwd()) {
  try {
    const res = execSync('git rev-parse --is-inside-work-tree', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return res === 'true';
  } catch {
    return false;
  }
}

function getNonGitFiles(dir, baseDir = dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_SNAPSHOT_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getNonGitFiles(full, baseDir, acc);
    } else if (entry.isFile()) {
      acc.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return acc;
}

/**
 * Creates an atomic checkpoint of the working tree.
 * Uses -uall to avoid folder collapse, and snapshots all working changes.
 */
export function createCheckpoint(label = 'manual-checkpoint', projectDir = process.cwd()) {
  const checkpointsDir = getCheckpointsDir(projectDir);
  const timestamp = Date.now();
  const id = `chk_${timestamp}`;
  const chkFolder = path.join(checkpointsDir, id);
  const filesFolder = path.join(chkFolder, 'files');
  const envFolder = path.join(chkFolder, 'env');
  fs.mkdirSync(filesFolder, { recursive: true });
  fs.mkdirSync(envFolder, { recursive: true });

  let gitCommit = 'non-git';
  let branch = 'unknown';
  let isGit = isGitRepository(projectDir);
  const modifiedFiles = [];
  const untrackedFiles = [];
  const capturedFiles = [];
  const envFiles = [];

  // Snapshot all .env and gitignored local environment files
  try {
    const dirEntries = fs.readdirSync(projectDir, { withFileTypes: true });
    for (const entry of dirEntries) {
      if (entry.isFile() && entry.name.startsWith('.env')) {
        const fullEnv = path.join(projectDir, entry.name);
        const destEnv = path.join(envFolder, entry.name);
        fs.copyFileSync(fullEnv, destEnv);
        envFiles.push(entry.name);
      }
    }
  } catch {}

  if (isGit) {
    try {
      gitCommit = execSync('git rev-parse HEAD', { cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();

      // Use -uall so nested untracked files are never collapsed as '?? dir/'
      const statusOutput = execSync('git status --porcelain -uall', { cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = statusOutput.split('\n').filter(Boolean);

      for (const line of lines) {
        const status = line.slice(0, 2).trim();
        const filePath = line.slice(3).trim();

        if (filePath.includes('.agents/checkpoints') || filePath.includes('.agents\\checkpoints')) continue;

        if (status === '??') {
          untrackedFiles.push(filePath);
        }

        modifiedFiles.push({ status, path: filePath });
        capturedFiles.push(filePath);

        const fullSource = path.join(projectDir, filePath);
        if (fs.existsSync(fullSource) && fs.statSync(fullSource).isFile()) {
          const dest = path.join(filesFolder, filePath);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(fullSource, dest);
        }
      }
    } catch {
      isGit = false;
    }
  }

  // Non-git fallback: capture current working directory files
  if (!isGit) {
    const allFiles = getNonGitFiles(projectDir);
    for (const relFile of allFiles) {
      modifiedFiles.push({ status: '??', path: relFile });
      untrackedFiles.push(relFile);
      capturedFiles.push(relFile);

      const fullSource = path.join(projectDir, relFile);
      const dest = path.join(filesFolder, relFile);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(fullSource, dest);
    }
  }

  const meta = {
    id,
    label,
    timestamp,
    iso: new Date(timestamp).toISOString(),
    isGit,
    gitCommit,
    branch,
    modifiedFilesCount: modifiedFiles.length,
    modifiedFiles,
    untrackedFiles,
    capturedFiles,
    envFiles
  };

  fs.writeFileSync(path.join(chkFolder, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}

/**
 * Lists all available checkpoints.
 */
export function listCheckpoints(projectDir = process.cwd()) {
  const checkpointsDir = getCheckpointsDir(projectDir);
  if (!fs.existsSync(checkpointsDir)) return [];

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
 * Robustly reverts corrupted clean files, deletes newly spawned untracked files,
 * and restores snapshot files.
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
  const isGit = isGitRepository(projectDir);

  // 1. If Git: revert any rogue agent commits by resetting to target.gitCommit, or checking out target.gitCommit
  if (isGit && target.isGit !== false) {
    if (target.gitCommit && target.gitCommit !== 'non-git') {
      try {
        // Reset working tree and branch back to exact checkpoint commit to undo rogue agent commits
        execSync(`git reset --hard ${target.gitCommit}`, { cwd: projectDir, stdio: ['pipe', 'pipe', 'ignore'] });
      } catch {
        try {
          execSync(`git checkout ${target.gitCommit} -- .`, { cwd: projectDir, stdio: ['pipe', 'pipe', 'ignore'] });
        } catch {
          try {
            execSync('git checkout HEAD -- .', { cwd: projectDir, stdio: ['pipe', 'pipe', 'ignore'] });
          } catch {}
        }
      }
    } else {
      try {
        execSync('git checkout HEAD -- .', { cwd: projectDir, stdio: ['pipe', 'pipe', 'ignore'] });
      } catch {}
    }

    // 2. Wipe rogue untracked files and folders with git clean
    try {
      execSync('git clean -fd -e .agents', { cwd: projectDir, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch {}

    // 3. Fallback check for newly untracked files not in target snapshot
    try {
      const currentStatus = execSync('git status --porcelain -uall', {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      });

      const knownUntracked = new Set(target.untrackedFiles || []);
      const currentLines = currentStatus.split('\n').filter(Boolean);

      for (const line of currentLines) {
        const status = line.slice(0, 2).trim();
        const relPath = line.slice(3).trim();

        if (relPath.includes('.agents/checkpoints') || relPath.includes('.agents\\checkpoints')) continue;

        if (status === '??' && !knownUntracked.has(relPath)) {
          const fullPath = path.join(projectDir, relPath);
          if (fs.existsSync(fullPath)) {
            if (fs.statSync(fullPath).isDirectory()) {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(fullPath);
            }
          }
        }
      }
    } catch {
      // safe fallback
    }
  } else {
    // Non-git cleanup: remove newly created files that were not in target's capturedFiles
    const knownCaptured = new Set(target.capturedFiles || []);
    const currentFiles = getNonGitFiles(projectDir);
    for (const cur of currentFiles) {
      if (!knownCaptured.has(cur)) {
        const p = path.join(projectDir, cur);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
  }

  // 4. Restore files that were modified or captured at the time of the checkpoint
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

  // 5. Restore snapshotted .env and gitignored config vault
  const envFolder = path.join(chkFolder, 'env');
  if (fs.existsSync(envFolder)) {
    try {
      const envItems = fs.readdirSync(envFolder);
      for (const item of envItems) {
        const envSrc = path.join(envFolder, item);
        const envDest = path.join(projectDir, item);
        fs.copyFileSync(envSrc, envDest);
        restoredCount++;
      }
    } catch {}
  }

  return { target, restoredCount };
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('checkpoint.js')) {
  const action = process.argv[2] || 'create';
  const param = process.argv[3];

  if (action === 'create' || action === 'save') {
    try {
      const meta = createCheckpoint(param || 'manual-save');
      console.log(`\n${c.green}${c.bold}✓ CHECKPOINT SAVED:${c.reset} ${c.cyan}${meta.id}${c.reset} ("${meta.label}")`);
      console.log(`  Modified files preserved: ${c.yellow}${meta.modifiedFilesCount}${c.reset}\n`);
    } catch (err) {
      console.error(`\n${c.red}✖ Checkpoint save failed:${c.reset}`, err.message);
      process.exit(1);
    }
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
      console.log(`  Files restored / reconciled: ${c.yellow}${res.restoredCount}${c.reset}\n`);
    } catch (err) {
      console.error(`\n${c.red}✖ Rollback failed:${c.reset}`, err.message);
      process.exit(1);
    }
  }
}
