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

export function installGitHooks(projectDir = process.cwd(), options = {}) {
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
  # 1. Run Secret Leak Sentinel
  if [ -f "./scripts/scan-secrets.js" ]; then
    node "./scripts/scan-secrets.js" || {
      echo "❌ COMMIT BLOCKED: Secret Leak Sentinel detected exposed credentials!"
      exit 1
    }
  elif command -v apex-agents >/dev/null 2>&1; then
    apex-agents scan-secrets || {
      echo "❌ COMMIT BLOCKED: Secret Leak Sentinel detected exposed credentials!"
      exit 1
    }
  elif command -v apex >/dev/null 2>&1; then
    apex scan-secrets || {
      echo "❌ COMMIT BLOCKED: Secret Leak Sentinel detected exposed credentials!"
      exit 1
    }
  elif command -v npx >/dev/null 2>&1; then
    npx apex-agents scan-secrets || {
      echo "❌ COMMIT BLOCKED: Secret Leak Sentinel detected exposed credentials!"
      exit 1
    }
  fi

  # 2. Run Staged Diff Auditor (Secrets, Slop, Anti-Tamper)
  if [ -f "./scripts/audit-diff.js" ]; then
    node "./scripts/audit-diff.js" --staged --strict || {
      echo "❌ COMMIT BLOCKED: Audit Diff detected critical secrets, slop, or test tampering!"
      exit 1
    }
  elif command -v apex-agents >/dev/null 2>&1; then
    apex-agents review --staged --strict || {
      echo "❌ COMMIT BLOCKED: Audit Diff detected critical secrets, slop, or test tampering!"
      exit 1
    }
  elif command -v apex >/dev/null 2>&1; then
    apex review --staged --strict || {
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


  if (options.prePush) {
    const prePushPath = path.join(hooksDir, 'pre-push');
    const prePushSnippet = `
# --- APEX AGENTS PRE-PUSH SAFETY BLOCK ---
echo "⚡ [Apex-Agents Hook] Running pre-push verification..."

if command -v node >/dev/null 2>&1; then
  if [ -f "./scripts/scan-secrets.js" ]; then
    node "./scripts/scan-secrets.js" || { echo "❌ PUSH BLOCKED: Secret Leak Sentinel failed!"; exit 1; }
  elif command -v apex-agents >/dev/null 2>&1; then
    apex-agents scan-secrets || { echo "❌ PUSH BLOCKED: Secret Leak Sentinel failed!"; exit 1; }
  elif command -v npx >/dev/null 2>&1; then
    npx apex-agents scan-secrets || { echo "❌ PUSH BLOCKED: Secret Leak Sentinel failed!"; exit 1; }
  fi

  if [ -f "./scripts/audit-bugs.js" ]; then
    node "./scripts/audit-bugs.js" || { echo "❌ PUSH BLOCKED: AST Bug Auditor detected runtime flaws!"; exit 1; }
  elif command -v apex-agents >/dev/null 2>&1; then
    apex-agents audit-bugs || { echo "❌ PUSH BLOCKED: AST Bug Auditor detected runtime flaws!"; exit 1; }
  fi

  if [ -f "./package.json" ] && grep -q '"test"' ./package.json; then
    npm test || { echo "❌ PUSH BLOCKED: Test suite failed!"; exit 1; }
  fi

  echo "✓ [Apex-Agents Hook] Pre-push verification passed."
fi
# --- END APEX AGENTS PRE-PUSH BLOCK ---
`;
    if (fs.existsSync(prePushPath)) {
      const existing = fs.readFileSync(prePushPath, 'utf-8');
      if (!existing.includes('APEX AGENTS PRE-PUSH')) {
        const backup = `${prePushPath}.apex-backup.${Date.now()}`;
        fs.copyFileSync(prePushPath, backup);
        fs.writeFileSync(prePushPath, (existing.trim() + '\n' + prePushSnippet).replace(/\r\n/g, '\n'), { mode: 0o755 });
      }
    } else {
      fs.writeFileSync(prePushPath, `#!/bin/sh\n# Apex Agents Pre-Push Safety Hook\n${prePushSnippet}\nexit 0\n`.replace(/\r\n/g, '\n'), { mode: 0o755 });
    }
    try { fs.chmodSync(prePushPath, 0o755); } catch {}
    console.log(`\x1b[32m\x1b[1m✓ Configured Apex Agents pre-push hook in .git/hooks/pre-push\x1b[0m`);
  }

  console.log(`\x1b[32m\x1b[1m✓ Successfully configured Apex Agents pre-commit hook in .git/hooks/pre-commit\x1b[0m`);
  console.log(`\x1b[90mRepository is protected against secret leaks and test tampering.\x1b[0m\n`);
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('install-hooks.js')) {
  const prePush = process.argv.includes('--pre-push');
  const installed = installGitHooks(process.cwd(), { prePush });
  if (!installed) {
    process.exit(1);
  }
}
