#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  SECRET_PATTERNS,
  ZERO_WIDTH_REGEX,
  foldStringLiterals,
  inspectBase64Payloads
} from './audit-diff.js';

export { foldStringLiterals, inspectBase64Payloads };

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

function scanDirectory(dir, findings = [], visited = new Set()) {
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
          if (fs.statSync(fullPath).isDirectory()) {
            scanDirectory(fullPath, findings, visited);
          }
        } catch {
          continue;
        }
      } else if (entry.isDirectory()) {
        scanDirectory(fullPath, findings, visited);
      } else if (entry.isFile()) {
      // Exclude self and test files from false alarm scanning
      if (entry.name === 'scan-secrets.js' || entry.name === 'audit-diff.js' || entry.name.includes('.test.')) {
        continue;
      }

      // Check .env files directly
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
        findings.push({ file: fullPath, pattern: 'Exposed .env File', match: entry.name });
      }

      // Check text files
      try {
        const rawContent = fs.readFileSync(fullPath, 'utf-8');
        const content = rawContent.replace(ZERO_WIDTH_REGEX, '');
        const folded = foldStringLiterals(content);

        for (const { name, regex } of SECRET_PATTERNS) {
          const match = regex.exec(content) || regex.exec(folded);
          if (match) {
            const matchedText = match[0];
            const masked = matchedText.slice(0, 7) + '...' + matchedText.slice(-4);
            findings.push({ file: fullPath, pattern: name, match: masked });
            break;
          }
        }

        const b64 = inspectBase64Payloads(content) || inspectBase64Payloads(folded);
        if (b64) {
          findings.push({ file: fullPath, pattern: 'Base64 Encoded AWS Key', match: b64.matched.slice(0, 8) + '...' });
        }
      } catch {
        // Binary or unreadable files skipped safely
      }
    }
  }
} catch {}
return findings;
}

const targetDir = process.argv[2] || process.cwd();
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
