import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createCheckpoint, listCheckpoints, rollbackToCheckpoint } from '../scripts/checkpoint.js';

describe('Git-Native Checkpoint & Rollback Suite', () => {
  test('should create, list, and restore checkpoints in working tree', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-chk-test-'));
    try {
      // Create initial file
      const testFile = path.join(tmpDir, 'service.ts');
      fs.writeFileSync(testFile, 'export const version = 1;');

      // 1. Create checkpoint 1
      const chk1 = createCheckpoint('initial-state', tmpDir);
      assert.strictEqual(chk1.label, 'initial-state');
      assert.match(chk1.id, /^chk_\d+/);

      // 2. List checkpoints
      const list = listCheckpoints(tmpDir);
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].id, chk1.id);

      // 3. Mutate file (simulating agent breaking code)
      fs.writeFileSync(testFile, 'export const broken = true; // corrupted');
      assert.strictEqual(fs.readFileSync(testFile, 'utf-8'), 'export const broken = true; // corrupted');

      // 4. Create checkpoint 2
      const chk2 = createCheckpoint('broken-state', tmpDir);
      assert.strictEqual(listCheckpoints(tmpDir).length, 2);

      // 5. Rollback to checkpoint 1 (if files were captured)
      const res = rollbackToCheckpoint(chk1.id, tmpDir);
      assert.strictEqual(res.target.id, chk1.id);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should throw error when rolling back with empty checkpoint list', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-chk-empty-'));
    try {
      assert.throws(() => {
        rollbackToCheckpoint('non-existent', tmpDir);
      }, /No checkpoints found/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should revert corrupted clean files and delete rogue untracked files on rollback', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-chk-adv-'));
    try {
      const cleanFile = path.join(tmpDir, 'app.js');
      fs.writeFileSync(cleanFile, 'export const version = "clean";');

      const chk = createCheckpoint('clean-save', tmpDir);

      // Rogue agent corrupts app.js
      fs.writeFileSync(cleanFile, 'CORRUPTED');

      // Rogue agent creates a new file in a nested folder
      const rogueFolder = path.join(tmpDir, 'rogue', 'nested');
      fs.mkdirSync(rogueFolder, { recursive: true });
      const rogueFile = path.join(rogueFolder, 'bad.js');
      fs.writeFileSync(rogueFile, 'export const rogue = true;');

      assert.strictEqual(fs.existsSync(rogueFile), true);
      assert.strictEqual(fs.readFileSync(cleanFile, 'utf-8'), 'CORRUPTED');

      // Rollback
      rollbackToCheckpoint(chk.id, tmpDir);

      // Verify cleanFile was restored to clean state
      assert.strictEqual(fs.readFileSync(cleanFile, 'utf-8'), 'export const version = "clean";');

      // Verify rogue file was deleted
      assert.strictEqual(fs.existsSync(rogueFile), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should snapshot and restore gitignored .env files on rollback', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-chk-env-'));
    try {
      const envPath = path.join(tmpDir, '.env');
      fs.writeFileSync(envPath, 'PORT=3000\nSECRET_KEY=initial_secret');

      const chk = createCheckpoint('env-save', tmpDir);

      // Rogue agent corrupts .env
      fs.writeFileSync(envPath, 'PORT=CORRUPTED');

      // Rollback
      rollbackToCheckpoint(chk.id, tmpDir);

      // Verify .env restored
      assert.strictEqual(fs.readFileSync(envPath, 'utf-8'), 'PORT=3000\nSECRET_KEY=initial_secret');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should handle and delete untracked unicode path files on rollback', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-chk-unicode-'));
    try {
      const chk = createCheckpoint('unicode-save', tmpDir);

      // Rogue agent creates unicode nested directories
      const unicodeDir = path.join(tmpDir, '📁_folder_測試');
      fs.mkdirSync(unicodeDir, { recursive: true });
      const badUnicodeFile = path.join(unicodeDir, 'bad_🔥.js');
      fs.writeFileSync(badUnicodeFile, 'export const bad = true;');

      assert.strictEqual(fs.existsSync(badUnicodeFile), true);

      // Rollback
      rollbackToCheckpoint(chk.id, tmpDir);

      // Verify rogue unicode file was wiped
      assert.strictEqual(fs.existsSync(badUnicodeFile), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should snapshot git hooks and wipe rogue poisoned hooks on rollback', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-chk-hook-'));
    try {
      const hooksDir = path.join(tmpDir, '.git', 'hooks');
      fs.mkdirSync(hooksDir, { recursive: true });

      // Initial legitimate hook
      const goodHook = path.join(hooksDir, 'prepare-commit-msg');
      fs.writeFileSync(goodHook, '#!/bin/sh\n# good hook');

      const chk = createCheckpoint('hook-save', tmpDir);

      // Rogue agent injects malicious pre-commit hook and corrupts prepare-commit-msg
      const evilHook = path.join(hooksDir, 'pre-commit');
      fs.writeFileSync(evilHook, '#!/bin/sh\nexit 1');
      fs.writeFileSync(goodHook, '#!/bin/sh\n# poisoned');

      assert.strictEqual(fs.existsSync(evilHook), true);

      // Rollback
      rollbackToCheckpoint(chk.id, tmpDir);

      // Verify poisoned hook was wiped and good hook was restored
      assert.strictEqual(fs.existsSync(evilHook), false);
      assert.strictEqual(fs.readFileSync(goodHook, 'utf-8'), '#!/bin/sh\n# good hook');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should preserve branch (no detached HEAD) on rollback and ignore null meta.json', async () => {
    const { execSync } = await import('child_process');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-chk-branch-'));
    try {
      execSync('git init -b main', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.email "test@apex.local"', { cwd: tmpDir, stdio: 'pipe' });
      execSync('git config user.name "Apex Test"', { cwd: tmpDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'export const v = 1;\n');
      execSync('git add -A && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });

      const chk = createCheckpoint('snap1', tmpDir);
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'export const v = 2;\n');
      rollbackToCheckpoint(chk.id, tmpDir);

      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
      assert.strictEqual(branch, 'main');

      const nullDir = path.join(tmpDir, '.agents', 'checkpoints', 'chk_999999999');
      fs.mkdirSync(nullDir, { recursive: true });
      fs.writeFileSync(path.join(nullDir, 'meta.json'), 'null');
      const list = listCheckpoints(tmpDir);
      assert.strictEqual(list.length, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
