#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import * as t from '@babel/traverse';

const traverse = t.default?.default || t.default;

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

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.agents', '.worktrees', 'coverage']);

function resolveImportPath(sourceFile, importString, rootDir) {
  if (!importString.startsWith('.')) {
    // Third-party package import (e.g. 'express', 'react')
    return { type: 'external', name: importString };
  }

  const dir = path.dirname(sourceFile);
  let resolved = path.resolve(dir, importString);

  // Try file as-is, or with extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { type: 'internal', path: path.relative(rootDir, candidate).replace(/\\/g, '/') };
    }
  }

  return { type: 'internal', path: path.relative(rootDir, resolved).replace(/\\/g, '/') };
}

export function buildDependencyGraph(rootDir = process.cwd()) {
  const files = [];

  function walk(current) {
    if (!fs.existsSync(current)) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      if (IGNORED.has(e.name)) continue;
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
        files.push(full);
      }
    }
  }

  walk(rootDir);

  const graph = new Map(); // file -> Set of imported files
  const externalDeps = new Set();
  const inDegree = new Map(); // file -> count of dependents

  for (const f of files) {
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    graph.set(rel, new Set());
    inDegree.set(rel, 0);
  }

  for (const f of files) {
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    try {
      const code = fs.readFileSync(f, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'classProperties', 'decorators-legacy', 'dynamicImport', 'exportDefaultFrom', 'exportNamespaceFrom', 'topLevelAwait']
      });

      traverse(ast, {
        ImportDeclaration(p) {
          const src = p.node.source.value;
          const resolved = resolveImportPath(f, src, rootDir);
          if (resolved.type === 'internal') {
            graph.get(rel)?.add(resolved.path);
          } else {
            externalDeps.add(resolved.name);
          }
        },
        ExportNamedDeclaration(p) {
          if (p.node.source) {
            const src = p.node.source.value;
            const resolved = resolveImportPath(f, src, rootDir);
            if (resolved.type === 'internal') {
              graph.get(rel)?.add(resolved.path);
            } else {
              externalDeps.add(resolved.name);
            }
          }
        },
        CallExpression(p) {
          if (p.node.callee.name === 'require' && p.node.arguments[0]?.value) {
            const src = p.node.arguments[0].value;
            const resolved = resolveImportPath(f, src, rootDir);
            if (resolved.type === 'internal') {
              graph.get(rel)?.add(resolved.path);
            } else {
              externalDeps.add(resolved.name);
            }
          }
        }
      });
    } catch {
      // safe fallback on WIP files
    }
  }

  // Calculate in-degrees
  for (const [node, edges] of graph.entries()) {
    for (const dep of edges) {
      inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
    }
  }

  // Detect Circular Dependencies (Cycles) using DFS
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();
  const pathStack = [];

  function findCycles(node) {
    visited.add(node);
    inStack.add(node);
    pathStack.push(node);

    const edges = graph.get(node) || [];
    for (const next of edges) {
      if (!visited.has(next)) {
        findCycles(next);
      } else if (inStack.has(next)) {
        const cycleStartIndex = pathStack.indexOf(next);
        const cycle = pathStack.slice(cycleStartIndex).concat(next);
        cycles.push(cycle);
      }
    }

    pathStack.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      findCycles(node);
    }
  }

  return {
    modulesCount: graph.size,
    graph,
    externalDeps: Array.from(externalDeps),
    cycles,
    inDegree
  };
}

export function printDependencyGraph(rootDir = process.cwd(), exportJson = false) {
  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: AST CODEBASE DEPENDENCY GRAPH ═════${c.reset}`);
  console.log(`Analyzing modules and import topology in: ${c.cyan}${rootDir}${c.reset}...\n`);

  const { modulesCount, graph, externalDeps, cycles, inDegree } = buildDependencyGraph(rootDir);

  let totalEdges = 0;
  for (const edges of graph.values()) {
    totalEdges += edges.size;
  }

  console.log(`${c.bold}GRAPH TOPOLOGY SUMMARY:${c.reset}`);
  console.log(`  • Internal Modules   : ${c.green}${modulesCount}${c.reset}`);
  console.log(`  • Internal Import Links: ${c.cyan}${totalEdges}${c.reset}`);
  console.log(`  • External Packages  : ${c.magenta}${externalDeps.length}${c.reset} (${externalDeps.slice(0, 5).join(', ')}${externalDeps.length > 5 ? '...' : ''})`);
  console.log(`  • Circular Cycles    : ${cycles.length > 0 ? c.red + cycles.length + ' DETECTED' : c.green + '0 (Clean DAG)'}${c.reset}\n`);

  if (cycles.length > 0) {
    console.log(`${c.red}${c.bold}⚠️ CRITICAL: Circular Dependencies Found:${c.reset}`);
    for (let i = 0; i < cycles.length; i++) {
      console.log(`  Cycle ${i + 1}: ${c.yellow}${cycles[i].join(' -> ')}${c.reset}`);
    }
    console.log();
  }

  // Top Most Depended-Upon Core Modules
  const sortedByDep = Array.from(inDegree.entries())
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sortedByDep.length > 0) {
    console.log(`${c.bold}MOST DEPENDED-UPON CORE MODULES:${c.reset}`);
    for (const [mod, count] of sortedByDep) {
      console.log(`  ${c.cyan}• ${mod.padEnd(35)}${c.reset} (imported by ${c.green}${count}${c.reset} files)`);
    }
    console.log();
  }

  if (exportJson) {
    const exportPath = path.join(rootDir, 'DEPENDENCY_GRAPH.json');
    const serializable = {
      modulesCount,
      totalEdges,
      externalDeps,
      cycles,
      modules: {}
    };
    for (const [k, v] of graph.entries()) {
      serializable.modules[k] = {
        imports: Array.from(v),
        dependedByCount: inDegree.get(k) || 0
      };
    }
    fs.writeFileSync(exportPath, JSON.stringify(serializable, null, 2));
    console.log(`  ${c.green}✓${c.reset} Exported graph topology to: ${c.cyan}${exportPath}${c.reset}\n`);
  }
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('dependency-graph.js')) {
  const args = process.argv.slice(2);
  const exportJson = args.includes('--json');
  const targetDir = args.find((a) => !a.startsWith('--')) || process.cwd();
  printDependencyGraph(targetDir, exportJson);
}
