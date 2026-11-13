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
});
