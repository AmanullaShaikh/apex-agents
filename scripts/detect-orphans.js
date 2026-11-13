#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function findOrphanedFiles(projectDir) {
  console.log(`\x1b[36m\x1b[1m[Apex-Agents] Scanning for unwired orphaned files in ${projectDir}...\x1b[0m`);

  const srcDir = path.join(projectDir, 'src');
  const targetDir = fs.existsSync(srcDir) ? srcDir : projectDir;

  const allFiles = getAllSourceFiles(targetDir);
  const entryFiles = new Set(['index.ts', 'index.tsx', 'index.js', 'main.ts', 'main.tsx', 'App.tsx', 'App.jsx', 'server.js', 'server.ts']);

  // Read all content
  let combinedCode = '';
  for (const f of allFiles) {
    try {
      combinedCode += '\n' + fs.readFileSync(f, 'utf-8');
    } catch {}
  }

  const orphans = [];
  for (const f of allFiles) {
    const baseName = path.basename(f);
    const nameWithoutExt = baseName.replace(/\.[^/.]+$/, '');

    // Skip standard entrypoints
    if (entryFiles.has(baseName)) continue;

    // Check if filename appears in any import statement
    const importRegex = new RegExp(`['"][^'"]*${nameWithoutExt}['"]`, 'g');
    if (!importRegex.test(combinedCode)) {
      orphans.push(path.relative(projectDir, f));
    }
  }

  if (orphans.length === 0) {
    console.log(`\x1b[32m✓ Zero orphaned files found. All source files are properly wired.\x1b[0m`);
    process.exit(0);
  } else {
    console.warn(`\x1b[33m⚠️ Found ${orphans.length} potential orphaned file(s) (never imported anywhere):\x1b[0m`);
    for (const o of orphans) {
      console.warn(`  - \x1b[36m${o}\x1b[0m`);
    }
    process.exit(0);
  }
}

function getAllSourceFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', 'build', '.next', '.agents', 'bin', 'scripts'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      getAllSourceFiles(fullPath, acc);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

const target = process.argv[2] || process.cwd();
findOrphanedFiles(target);
