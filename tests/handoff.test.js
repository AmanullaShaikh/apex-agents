import { test, describe } from 'node:test';
import assert from 'node:assert';
import { generateHandoff } from '../scripts/handoff.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('Session Handoff & Context Degradation Defense', () => {
  test('should generate a structured session handoff XML block under 200 tokens', () => {
    const handoff = generateHandoff(ROOT_DIR);
    assert.match(handoff, /<session_handoff/);
    assert.match(handoff, /<last_commit>/);
    assert.match(handoff, /<modified_files/);
    assert.match(handoff, /<\/session_handoff>/);
    assert.ok(handoff.length < 2000, 'Handoff block should be compact and lightweight');
  });

  test('should survive null memory.json without crashing and report branch="none" outside git', async () => {
    const fs = await import('fs');
    const os = await import('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-handoff-null-'));
    try {
      fs.mkdirSync(path.join(tmpDir, '.agents'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.agents', 'memory.json'), 'null');
      const xml = generateHandoff(tmpDir);
      assert.match(xml, /branch="none"/);
      assert.match(xml, /<session_handoff/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
