import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildDependencyGraph } from '../scripts/dependency-graph.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('AST Codebase Dependency Graph & Cycle Detection', () => {
  test('should analyze workspace modules and verify zero circular cycles', () => {
    const result = buildDependencyGraph(ROOT_DIR);
    assert.ok(result.modulesCount > 10, 'Should find at least 10 modules');
    assert.strictEqual(result.cycles.length, 0, 'Workspace DAG should have zero cycles');
    assert.ok(result.externalDeps.length > 0, 'Should detect external npm/node dependencies');
  });
});
