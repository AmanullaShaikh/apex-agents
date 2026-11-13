#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';

function checkScopeDrift() {
  console.log(`\x1b[36m\x1b[1m[Apex-Agents] Running Anti-Drift Scope Audit...\x1b[0m`);

  let modifiedFiles = [];
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8' });
    modifiedFiles = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.slice(3).trim());
  } catch (err) {
    console.warn(`\x1b[33mNot inside a git repository or git command failed.\x1b[0m`);
    process.exit(0);
  }

  if (modifiedFiles.length === 0) {
    console.log(`\x1b[32m✓ Working tree is clean. Zero uncommitted scope drift.\x1b[0m`);
    process.exit(0);
  }

  console.log(`\x1b[34mModified / Untracked files (${modifiedFiles.length}):\x1b[0m`);
  for (const f of modifiedFiles) {
    console.log(`  • ${f}`);
  }

  // Check for suspicious drift: modifying package.json or config when working on UI
  const configFiles = modifiedFiles.filter((f) => 
    f.endsWith('package.json') || 
    f.endsWith('package-lock.json') || 
    f.endsWith('.env') ||
    f.startsWith('.git')
  );

  if (configFiles.length > 0 && modifiedFiles.length > configFiles.length) {
    console.warn(`\x1b[33m⚠️ WARNING: Config files were modified alongside source files:\x1b[0m`);
    for (const c of configFiles) {
      console.warn(`    - ${c}`);
    }
  } else {
    console.log(`\x1b[32m✓ Scope boundaries appear coherent.\x1b[0m`);
  }
}

checkScopeDrift();
