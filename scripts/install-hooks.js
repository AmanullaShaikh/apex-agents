#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function installGitHooks() {
  const gitDir = path.join(process.cwd(), '.git');
  if (!fs.existsSync(gitDir)) {
    console.error(`\x1b[31mError: No .git directory found in ${process.cwd()}. Initialize git first.\x1b[0m`);
    process.exit(1);
  }

  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const preCommitHookPath = path.join(hooksDir, 'pre-commit');

  // Shell script for pre-commit
  const hookScript = `#!/bin/sh
# Apex Agents Automated Zero-Slop & Secret Leak Pre-Commit Hook

echo "⚡ [Apex-Agents Hook] Running pre-commit safety checks..."

# Check if node is available
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found in PATH, skipping hook."
  exit 0
fi

# Run Secret Leak Sentinel if available
if [ -f "./scripts/scan-secrets.js" ]; then
  node "./scripts/scan-secrets.js" || {
    echo "❌ COMMIT BLOCKED: Secret Leak Sentinel detected exposed credentials!"
    exit 1
  }
fi

# Run Zero-Slop & Test Tampering Diff Auditor if available
if [ -f "./scripts/audit-diff.js" ]; then
  node "./scripts/audit-diff.js" --staged --strict || {
    echo "❌ COMMIT BLOCKED: Audit Diff detected critical secrets, slop, or test tampering!"
    exit 1
  }
fi

# Run Anti-Drift Scope Guard if available
if [ -f "./scripts/scope-enforcer.js" ]; then
  node "./scripts/scope-enforcer.js" || {
    echo "⚠️ Warning: Potential scope drift detected."
  }
fi

echo "✓ [Apex-Agents Hook] Safety checks passed."
exit 0
`;

  // Always force POSIX LF line endings to avoid "\r: command not found" on Git Bash / Linux / macOS
  const normalizedScript = hookScript.replace(/\r\n/g, '\n');
  fs.writeFileSync(preCommitHookPath, normalizedScript, { mode: 0o755 });

  try {
    fs.chmodSync(preCommitHookPath, 0o755);
  } catch {
    // Windows chmod may be a no-op, which is fine
  }

  console.log(`\x1b[32m\x1b[1m✓ Successfully installed Apex Agents pre-commit hook in .git/hooks/pre-commit\x1b[0m`);
  console.log(`\x1b[90mYour repository is now automatically protected from leaking API keys and unintended file drift.\x1b[0m\n`);
}

installGitHooks();
