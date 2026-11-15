import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildDependencyGraph, computePageRank, extractSymbolCallers } from '../scripts/dependency-graph.js';
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

  test('should compute PageRank centrality and rank core modules', () => {
    const mockGraph = new Map([
      ['app.ts', new Set(['auth.ts', 'db.ts'])],
      ['auth.ts', new Set(['db.ts'])],
      ['db.ts', new Set([])],
      ['util.ts', new Set([])]
    ]);
    const pr = computePageRank(mockGraph);
    assert.ok(pr.has('db.ts'), 'Should calculate rank for db.ts');
    assert.ok(pr.get('db.ts') > pr.get('util.ts'), 'Heavily imported db.ts should have higher PageRank than isolated util.ts');
  });

  test('should extract cross-file callers cleanly', () => {
    const callers = extractSymbolCallers(ROOT_DIR);
    assert.strictEqual(typeof callers, 'object');
    // scripts/dependency-graph.js exports buildDependencyGraph which is imported by compact-context.js
    const depGraphCallers = callers['scripts/dependency-graph.js'];
    assert.ok(depGraphCallers, 'Should find callers for scripts/dependency-graph.js');
    assert.ok(depGraphCallers['buildDependencyGraph']?.length > 0, 'Should map callers for buildDependencyGraph');
  });
});
