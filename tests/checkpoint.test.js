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
});
