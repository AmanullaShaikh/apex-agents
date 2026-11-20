#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildDependencyGraph } from './dependency-graph.js';

const __filename = fileURLToPath(import.meta.url);

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

function getGitChangedFiles(projectDir) {
  const changed = new Set();
  try {
    const status = execSync('git status --porcelain', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    for (const line of status.split('\n')) {
      if (!line.trim()) continue;
      const filePart = line.slice(3).trim();
      const arrowIdx = filePart.indexOf(' -> ');
      const rel = (arrowIdx !== -1 ? filePart.slice(arrowIdx + 4) : filePart).replace(/^"|"$/g, '').replace(/\\/g, '/');
      if (rel) changed.add(rel);
    }
  } catch {
    // Not a git repository or git unavailable
  }
  return Array.from(changed);
}

/**
 * Computes transitive reverse-dependency blast radius for modified or target files.
 * Identifies direct dependents, transitive dependents, affected test suites, and risk level.
 */
export function analyzeImpact(targets = [], projectDir = process.cwd()) {
  const absRoot = path.resolve(projectDir);
  let normalizedTargets = (Array.isArray(targets) ? targets : [targets])
    .filter(t => typeof t === 'string' && t.trim().length > 0)
    .map(t => {
      const resolved = path.isAbsolute(t) ? t : path.resolve(absRoot, t);
      return path.relative(absRoot, resolved).replace(/\\/g, '/');
    })
    .filter(rel => rel && !rel.startsWith('..'));

  if (normalizedTargets.length === 0) {
    normalizedTargets = getGitChangedFiles(absRoot);
  }

  const { graph, pageRank, modulesCount } = buildDependencyGraph(absRoot);

  // Build reverse dependency map: importedFile -> Set<importerFile>
  const reverseGraph = new Map();
  for (const mod of graph.keys()) {
    if (!reverseGraph.has(mod)) reverseGraph.set(mod, new Set());
  }
  for (const [importer, deps] of graph.entries()) {
    for (const dep of deps) {
      if (!reverseGraph.has(dep)) reverseGraph.set(dep, new Set());
      reverseGraph.get(dep).add(importer);
    }
  }

  const visited = new Set(normalizedTargets);
  const queue = normalizedTargets.map(t => ({ file: t, depth: 0 }));
  const directDependents = new Set();
  const transitiveDependents = new Set();

  while (queue.length > 0) {
    const { file, depth } = queue.shift();
    const dependents = reverseGraph.get(file);
    if (!dependents) continue;

    for (const dep of dependents) {
      if (visited.has(dep)) continue;
      visited.add(dep);
      if (depth === 0) {
        directDependents.add(dep);
      } else {
        transitiveDependents.add(dep);
      }
      queue.push({ file: dep, depth: depth + 1 });
    }
  }

  const allImpacted = Array.from(new Set([...directDependents, ...transitiveDependents])).sort();
  const affectedTests = Array.from(new Set(
    [...normalizedTargets, ...allImpacted].filter(f => /\.(test|spec)\.[a-z0-9]+$/i.test(f) || /^tests\//i.test(f))
  )).sort();

  const maxPageRank = normalizedTargets.reduce((max, t) => Math.max(max, pageRank.get(t) || 0), 0);
  const riskLevel = (allImpacted.length >= 5 || (modulesCount >= 10 && maxPageRank >= 0.08))
    ? 'HIGH'
    : (allImpacted.length >= 2 || affectedTests.length >= 1 ? 'MEDIUM' : 'LOW');

  return {
    targets: normalizedTargets,
    modulesScanned: modulesCount,
    directDependents: Array.from(directDependents).sort(),
    transitiveDependents: Array.from(transitiveDependents).sort(),
    allImpacted,
    affectedTests,
    riskLevel
  };
}

// CLI Execution
if (process.argv[1] && safeRealpath(process.argv[1]) === safeRealpath(__filename)) {
  const args = process.argv.slice(2);
  const knownFlags = new Set(['--json', '--diff']);
  const unknownFlag = args.find(a => a.startsWith('-') && !knownFlags.has(a));
  if (unknownFlag) {
    console.error(`${c.red}Unknown flag: ${unknownFlag}${c.reset}`);
    console.error('Usage: npx aveyx impact [file1 file2 ...] [--diff] [--json]');
    process.exit(1);
  }

  const jsonMode = args.includes('--json');
  const positional = args.filter(a => !a.startsWith('-'));

  for (const target of positional) {
    const resolved = path.resolve(process.cwd(), target);
    const rel = path.relative(process.cwd(), resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      console.error(`${c.red}Error: Target file must be inside workspace directory: ${target}${c.reset}`);
      process.exit(1);
    }
    if (!fs.existsSync(resolved)) {
      console.error(`${c.red}Error: Target file not found: ${target}${c.reset}`);
      process.exit(1);
    }
    if (fs.statSync(resolved).isDirectory()) {
      console.error(`${c.red}Error: Target cannot be a directory: ${target}. Specify source file paths.${c.reset}`);
      process.exit(1);
    }
  }

  const report = analyzeImpact(positional, process.cwd());

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  console.log(`\n${c.cyan}${c.bold}═════ AVEYX: BLAST-RADIUS & IMPACT ANALYZER ═════${c.reset}`);
  if (report.targets.length === 0) {
    console.log(`${c.yellow}No target files or uncommitted git changes found to analyze.${c.reset}\n`);
    process.exit(0);
  }

  const riskColor = report.riskLevel === 'HIGH' ? c.red : (report.riskLevel === 'MEDIUM' ? c.yellow : c.green);
  console.log(`  Targets (${report.targets.length})       : ${c.cyan}${report.targets.join(', ')}${c.reset}`);
  console.log(`  Blast Radius Risk : ${riskColor}${c.bold}${report.riskLevel}${c.reset} (${report.allImpacted.length} downstream modules across ${report.modulesScanned} scanned)`);
  console.log(`  Direct Dependents : ${c.bold}${report.directDependents.length}${c.reset}`);
  for (const f of report.directDependents) console.log(`    • ${f}`);
  console.log(`  Transitive Impact : ${c.bold}${report.transitiveDependents.length}${c.reset}`);
  for (const f of report.transitiveDependents) console.log(`    • ${c.dim}${f}${c.reset}`);
  console.log(`  Affected Tests    : ${c.green}${report.affectedTests.length}${c.reset}`);
  for (const t of report.affectedTests) console.log(`    ✓ ${c.green}${t}${c.reset}`);
  console.log();
}
