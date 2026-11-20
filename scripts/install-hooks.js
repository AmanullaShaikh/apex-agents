#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function resolveGitCommonDir(projectDir) {
  try {
    const common = execSync('git rev-parse --git-common-dir', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (!common) return null;
    return path.resolve(projectDir, common);
  } catch {
    return null;
  }
}

export function installGitHooks(projectDir = process.cwd()) {
  const gitCommonDir = resolveGitCommonDir(projectDir);
  if (!gitCommonDir) {
    console.error(`\x1b[31mError: No git repository found in ${projectDir}. Initialize git first.\x1b[0m`);
    return false;
  }

  const hooksDir = path.join(gitCommonDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const preCommitHookPath = path.join(hooksDir, 'pre-commit');

  const apexSnippet = `
# --- APEX AGENTS PRE-COMMIT SAFETY BLOCK ---
echo "⚡ [Apex-Agents Hook] Running pre-commit safety checks..."

if command -v node >/dev/null 2>&1; then
  if [ -f "./scripts/scan-secrets.js" ]; then
    node "./scripts/scan-secrets.js" || {
      echo "❌ COMMIT BLOCKED: Secret Leak Sentinel detected exposed credentials!"
      exit 1
    }
  elif command -v npx >/dev/null 2>&1; then
    npx --no-install apex-agents scan-secrets || {
      echo "❌ COMMIT BLOCKED: Secret Leak Sentinel detected exposed credentials!"
      exit 1
    }
  fi

  if [ -f "./scripts/audit-diff.js" ]; then
    node "./scripts/audit-diff.js" --staged --strict || {
      echo "❌ COMMIT BLOCKED: Audit Diff detected critical secrets, slop, or test tampering!"
      exit 1
    }
  elif command -v npx >/dev/null 2>&1; then
    npx apex-agents review --staged --strict || {
      echo "❌ COMMIT BLOCKED: Audit Diff detected critical secrets, slop, or test tampering!"
      exit 1
    }
  fi

  echo "✓ [Apex-Agents Hook] Safety checks passed."
fi
# --- END APEX AGENTS BLOCK ---
`;

  if (fs.existsSync(preCommitHookPath)) {
    const existingContent = fs.readFileSync(preCommitHookPath, 'utf-8');
    if (existingContent.includes('APEX AGENTS PRE-COMMIT') || existingContent.includes('Apex-Agents Hook')) {
      console.log(`\x1b[33m• Pre-commit hook already contains Apex Agents protection.\x1b[0m`);
      return true;
    }

    // Safety backup of existing hook
    const backupPath = `${preCommitHookPath}.apex-backup.${Date.now()}`;
    fs.copyFileSync(preCommitHookPath, backupPath);
    console.log(`\x1b[36m• Preserved existing pre-commit hook (backed up to: ${path.basename(backupPath)})\x1b[0m`);

    // Chain/append without destroying user's existing hook
    const chained = existingContent.trim() + '\n' + apexSnippet;
    fs.writeFileSync(preCommitHookPath, chained.replace(/\r\n/g, '\n'), { mode: 0o755 });
  } else {
    // Create new executable hook
    const fullHook = `#!/bin/sh\n# Apex Agents Automated Zero-Slop & Secret Leak Pre-Commit Hook\n${apexSnippet}\nexit 0\n`;
    fs.writeFileSync(preCommitHookPath, fullHook.replace(/\r\n/g, '\n'), { mode: 0o755 });
  }

  try {
    fs.chmodSync(preCommitHookPath, 0o755);
  } catch {
    // Windows chmod is a no-op, safe
  }

  console.log(`\x1b[32m\x1b[1m✓ Successfully configured Apex Agents pre-commit hook in .git/hooks/pre-commit\x1b[0m`);
  console.log(`\x1b[90mRepository is protected against secret leaks and test tampering.\x1b[0m\n`);
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('install-hooks.js')) {
  const installed = installGitHooks();
  if (!installed) {
    process.exit(1);
  }
}
