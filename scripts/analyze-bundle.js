#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function findGhostDependencies(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(`No package.json found in ${projectDir}`);
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const dependencies = Object.keys(pkg.dependencies || {});

  if (dependencies.length === 0) {
    console.log(`\x1b[32mNo production dependencies declared in package.json.\x1b[0m`);
    process.exit(0);
  }

  console.log(`[Apex-Agents] Analyzing ${dependencies.length} dependencies for ghost usage...`);
  
  // Recursively read source files
  const srcDir = path.join(projectDir, 'src');
  const targetScanDir = fs.existsSync(srcDir) ? srcDir : projectDir;
  
  const sourceCode = readAllSourceFiles(targetScanDir);
  const ghostDeps = [];

  for (const dep of dependencies) {
    const importRegex = new RegExp(`['"]${dep}(/.*)?['"]`, 'g');
    if (!importRegex.test(sourceCode)) {
      ghostDeps.push(dep);
    }
  }

  if (ghostDeps.length === 0) {
    console.log(`\x1b[32m✓ All declared dependencies are actively imported in source code.\x1b[0m`);
  } else {
    console.warn(`\x1b[33m⚠️ Found ${ghostDeps.length} potential ghost dependency(ies) (unused in src): \x1b[0m`);
    for (const g of ghostDeps) {
      console.warn(`  - \x1b[36m${g}\x1b[0m`);
    }
  }
}

function readAllSourceFiles(dir, acc = '') {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      acc = readAllSourceFiles(fullPath, acc);
    } else if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) {
      try {
        acc += '\n' + fs.readFileSync(fullPath, 'utf-8');
      } catch {
        // Skip unreadable files
      }
    }
  }
  return acc;
}

const target = process.argv[2] || process.cwd();
findGhostDependencies(target);
