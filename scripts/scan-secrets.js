#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SECRET_PATTERNS,
  ZERO_WIDTH_REGEX,
  foldStringLiterals,
  inspectBase64Payloads,
  resolveLineWithVars
} from './audit-diff.js';

export { foldStringLiterals, inspectBase64Payloads };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.worktrees', '.agents']);

function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

const SELF_EXCLUDED_PATHS = new Set([
  safeRealpath(path.join(ROOT_DIR, 'scripts', 'scan-secrets.js')),
  safeRealpath(path.join(ROOT_DIR, 'scripts', 'audit-diff.js')),
  safeRealpath(path.join(ROOT_DIR, 'tests', 'diff-audit.test.js'))
]);

function scanFile(fullPath, fileName, findings) {
  const realFile = safeRealpath(fullPath);
  if (SELF_EXCLUDED_PATHS.has(realFile)) return;

  // Check .env files directly
  if (fileName.startsWith('.env') && fileName !== '.env.example') {
    findings.push({ file: fullPath, pattern: 'Exposed .env File', match: fileName });
  }

  // Check text files
  try {
    const rawContent = fs.readFileSync(fullPath, 'utf-8');
    const content = rawContent.replace(ZERO_WIDTH_REGEX, '');
    const folded = foldStringLiterals(content);

    // Cross-line variable resolution (shared single source of truth from audit-diff.js)
    const fileStringVars = new Map();
    const resolvedLines = rawContent.split('\n').map(l => resolveLineWithVars(l, fileStringVars).resolved);
    const resolvedContent = resolvedLines.join('\n');

    for (const { name, regex } of SECRET_PATTERNS) {
      const match = regex.exec(content) || regex.exec(folded) || regex.exec(resolvedContent);
      if (match) {
        const matchedText = match[0];
        const masked = matchedText.slice(0, 7) + '...' + matchedText.slice(-4);
        findings.push({ file: fullPath, pattern: name, match: masked });
        break;
      }
    }

    const b64 = inspectBase64Payloads(content) || inspectBase64Payloads(folded) || inspectBase64Payloads(resolvedContent);
    if (b64) {
      findings.push({ file: fullPath, pattern: 'Base64 Encoded Credential Payload', match: b64.matched.slice(0, 8) + '...' });
    }
  } catch {
    // Binary or unreadable files skipped safely
  }
}

export function scanDirectory(dir, findings = [], visited = new Set()) {
  if (!fs.existsSync(dir)) return findings;
  try {
    const realDir = fs.realpathSync(dir);
    if (visited.has(realDir)) return findings;
    visited.add(realDir);

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          const target = fs.realpathSync(fullPath);
          if (visited.has(target)) continue;
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDirectory(fullPath, findings, visited);
          } else if (stat.isFile()) {
            visited.add(target);
            scanFile(fullPath, entry.name, findings);
          }
        } catch {
          continue;
        }
      } else if (entry.isDirectory()) {
        scanDirectory(fullPath, findings, visited);
      } else if (entry.isFile()) {
        scanFile(fullPath, entry.name, findings);
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return findings;
}

if (process.argv[1] && safeRealpath(process.argv[1]) === safeRealpath(__filename)) {
  const targetDir = process.argv[2] || process.cwd();
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error(`\x1b[31mError: Target path does not exist or is not a directory: ${targetDir}\x1b[0m`);
    process.exit(1);
  }
  console.log(`[Apex-Agents] Scanning for leaked credentials in: ${targetDir}...`);
  const findings = scanDirectory(targetDir);

  if (findings.length === 0) {
    console.log(`\x1b[32m✓ Zero leaked credentials found. Repository is clean.\x1b[0m`);
    process.exit(0);
  } else {
    console.error(`\x1b[31m⚠️ CRITICAL: Found ${findings.length} potential secret leak(s)!\x1b[0m`);
    for (const f of findings) {
      console.error(`  - \x1b[33m${f.pattern}\x1b[0m in \x1b[36m${f.file}\x1b[0m: ${f.match}`);
    }
    process.exit(1);
  }
}
