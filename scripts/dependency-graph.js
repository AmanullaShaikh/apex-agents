#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
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

export function resolveImportPath(sourceFile, importString, rootDir) {
  if (!importString.startsWith('.')) {
    // Third-party package import (e.g. 'express', 'react')
    return { type: 'external', name: importString };
  }

  const dir = path.dirname(sourceFile);
  let resolved = path.resolve(dir, importString);

  // Try file as-is, or with extensions
  const extensions = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.js', '/index.tsx', '/index.jsx'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { type: 'internal', path: path.relative(rootDir, candidate).replace(/\\/g, '/') };
    }
  }

  // NodeNext TypeScript ESM convention: import './bar.js' -> resolves to bar.ts / bar.tsx
  const esmExtMap = [
    [/\.js$/i, ['.ts', '.tsx']],
    [/\.jsx$/i, ['.tsx']],
    [/\.mjs$/i, ['.mts']],
    [/\.cjs$/i, ['.cts']]
  ];
  for (const [pattern, tsExts] of esmExtMap) {
    if (pattern.test(resolved)) {
      const base = resolved.replace(pattern, '');
      for (const tsExt of tsExts) {
        const candidate = base + tsExt;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { type: 'internal', path: path.relative(rootDir, candidate).replace(/\\/g, '/') };
        }
      }
    }
  }

  return { type: 'internal', path: path.relative(rootDir, resolved).replace(/\\/g, '/') };
}

/**
 * Standard PageRank power-iteration algorithm for graph centrality ranking.
 * High-centrality hub modules (e.g. schema, types, auth) bubble to the top.
 */
export function computePageRank(graph, damping = 0.85, iterations = 20) {
  const nodes = Array.from(graph.keys());
  const N = nodes.length;
  if (N === 0) return new Map();

  let rank = new Map();
  for (const node of nodes) {
    rank.set(node, 1 / N);
  }

  const incoming = new Map();
  const outDegree = new Map();
  for (const node of nodes) {
    incoming.set(node, []);
    outDegree.set(node, graph.get(node)?.size || 0);
  }

  for (const [node, edges] of graph.entries()) {
    for (const dep of edges) {
      if (incoming.has(dep)) {
        incoming.get(dep).push(node);
      }
    }
  }

  for (let it = 0; it < iterations; it++) {
    const nextRank = new Map();
    for (const node of nodes) {
      let sum = 0;
      for (const caller of incoming.get(node) || []) {
        const out = outDegree.get(caller) || 1;
        sum += rank.get(caller) / out;
      }
      nextRank.set(node, ((1 - damping) / N) + (damping * sum));
    }
    rank = nextRank;
  }

  return rank;
}

/**
 * Cross-File Call-Site and Usage Extractor.
 * Scans codebase to map which external files and lines call or import exported symbols.
 */
export function extractSymbolCallers(rootDir = process.cwd()) {
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

  // file -> { localImportName: { sourceFile, originalName } }
  const fileImports = new Map();
  // sourceFile -> { symbolName: [ { file, line } ] }
  const callersMap = new Map();

  for (const f of files) {
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    callersMap.set(rel, new Map());
    fileImports.set(rel, new Map());

    try {
      const code = fs.readFileSync(f, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'classProperties', 'decorators-legacy', 'dynamicImport', 'exportDefaultFrom', 'exportNamespaceFrom', 'topLevelAwait']
      });

      traverse(ast, {
        ImportDeclaration(p) {
          if (!p.node.source?.value) return;
          const resolved = resolveImportPath(f, p.node.source.value, rootDir);
          if (resolved.type !== 'internal') return;

          for (const spec of p.node.specifiers || []) {
            if (spec.type === 'ImportSpecifier') {
              fileImports.get(rel).set(spec.local.name, {
                sourceFile: resolved.path,
                originalName: spec.imported.name
              });
            } else if (spec.type === 'ImportDefaultSpecifier') {
              fileImports.get(rel).set(spec.local.name, {
                sourceFile: resolved.path,
                originalName: 'default'
              });
            }
          }
        }
      });
    } catch {
      // safe fallback
    }
  }

  // Second pass: track call sites
  for (const f of files) {
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    const imports = fileImports.get(rel);
    if (!imports || imports.size === 0) continue;

    try {
      const code = fs.readFileSync(f, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'classProperties', 'decorators-legacy', 'dynamicImport', 'exportDefaultFrom', 'exportNamespaceFrom', 'topLevelAwait']
      });

      traverse(ast, {
        CallExpression(p) {
          let calleeName = null;
          if (p.node.callee.type === 'Identifier') {
            calleeName = p.node.callee.name;
          } else if (p.node.callee.type === 'MemberExpression' && p.node.callee.property.type === 'Identifier') {
            calleeName = p.node.callee.property.name;
          }

          if (calleeName && imports.has(calleeName)) {
            const { sourceFile, originalName } = imports.get(calleeName);
            if (callersMap.has(sourceFile)) {
              const fileMap = callersMap.get(sourceFile);
              if (!fileMap.has(originalName)) {
                fileMap.set(originalName, []);
              }
              const list = fileMap.get(originalName);
              const loc = p.node.loc?.start?.line || 0;
              // Avoid duplicate identical caller references
              if (!list.some(c => c.file === rel && c.line === loc)) {
                list.push({ file: rel, line: loc });
              }
            }
          }
        }
      });
    } catch {
      // safe fallback
    }
  }

  // Convert Map to plain object for easy consumption
  const result = {};
  for (const [sourceFile, symMap] of callersMap.entries()) {
    result[sourceFile] = {};
    for (const [sym, list] of symMap.entries()) {
      result[sourceFile][sym] = list;
    }
  }

  return result;
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
          if (p.node.source?.value) {
            const src = p.node.source.value;
            const resolved = resolveImportPath(f, src, rootDir);
            if (resolved.type === 'internal') {
              graph.get(rel)?.add(resolved.path);
            } else {
              externalDeps.add(resolved.name);
            }
          }
        },
        ExportNamedDeclaration(p) {
          if (p.node.source?.value) {
            const src = p.node.source.value;
            const resolved = resolveImportPath(f, src, rootDir);
            if (resolved.type === 'internal') {
              graph.get(rel)?.add(resolved.path);
            } else {
              externalDeps.add(resolved.name);
            }
          }
        },
        ExportAllDeclaration(p) {
          if (p.node.source?.value) {
            const src = p.node.source.value;
            const resolved = resolveImportPath(f, src, rootDir);
            if (resolved.type === 'internal') {
              graph.get(rel)?.add(resolved.path);
            } else {
              externalDeps.add(resolved.name);
            }
          }
        },
        ImportExpression(p) {
          if (p.node.source?.value) {
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
          const isReq = p.node.callee.name === 'require';
          const isDynImport = p.node.callee.type === 'Import';
          if ((isReq || isDynImport) && p.node.arguments[0]?.value) {
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

  // Calculate PageRank Centrality
  const pageRank = computePageRank(graph);

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
    inDegree,
    pageRank
  };
}

export function printDependencyGraph(rootDir = process.cwd(), exportJson = false) {
  console.log(`\n${c.cyan}${c.bold}═════ AVEYX: AST CODEBASE DEPENDENCY GRAPH & PAGERANK ═════${c.reset}`);
  console.log(`Analyzing modules and import topology in: ${c.cyan}${rootDir}${c.reset}...\n`);

  const { modulesCount, graph, externalDeps, cycles, inDegree, pageRank } = buildDependencyGraph(rootDir);

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

  // Top Ranked Core Architectural Modules by PageRank Centrality
  const sortedByPageRank = Array.from(pageRank.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sortedByPageRank.length > 0) {
    console.log(`${c.bold}CORE ARCHITECTURAL HUBS (PAGERANK CENTRALITY):${c.reset}`);
    for (const [mod, pr] of sortedByPageRank) {
      const dependents = inDegree.get(mod) || 0;
      console.log(`  ${c.cyan}• ${mod.padEnd(35)}${c.reset} (PageRank: ${c.green}${(pr * 100).toFixed(2)}%${c.reset}, imported by ${c.yellow}${dependents}${c.reset} files)`);
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
        dependedByCount: inDegree.get(k) || 0,
        pageRankScore: pageRank.get(k) || 0
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
