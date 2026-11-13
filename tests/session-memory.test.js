import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { handleMemory } from '../scripts/session-memory.js';

describe('Persistent Session Memory Engine', () => {
  const tmpDir = path.join(os.tmpdir(), 'apex-memory-test-' + Date.now());

  test('should record and recall architectural decisions and rules', () => {
    fs.mkdirSync(tmpDir, { recursive: true });

    handleMemory(['record', 'rule', 'Always use TypeScript in strict mode'], tmpDir);
    handleMemory(['record', 'decision', 'Selected PostgreSQL over MongoDB'], tmpDir);

    const memPath = path.join(tmpDir, '.agents', 'memory.json');
    assert.ok(fs.existsSync(memPath));

    const data = JSON.parse(fs.readFileSync(memPath, 'utf-8'));
    assert.strictEqual(data.architecturalRules.length, 1);
    assert.strictEqual(data.decisions.length, 1);
    assert.match(data.architecturalRules[0].text, /strict mode/);
    assert.match(data.decisions[0].text, /PostgreSQL/);

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
