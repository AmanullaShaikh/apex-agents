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
});
