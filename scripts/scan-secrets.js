#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// High-confidence regex signatures for sensitive credentials
const SECRET_PATTERNS = [
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/g },
  { name: 'Stripe Publishable Key', regex: /pk_live_[0-9a-zA-Z]{24}/g },
  { name: 'OpenAI API Key', regex: /sk-proj-[0-9a-zA-Z-_]{48,}/g },
  { name: 'Anthropic API Key', regex: /sk-ant-api03-[0-9a-zA-Z-_]{80,}/g },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'GitHub Personal Token', regex: /ghp_[0-9a-zA-Z]{36}/g },
  { name: 'Slack Bot Token', regex: /xoxb-[0-9]{11}-[0-9]{11}-[0-9a-zA-Z]{24}/g },
  { name: 'Private SSH Key', regex: /-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----/g }
];

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

function scanDirectory(dir, findings = []) {
  if (!fs.existsSync(dir)) return findings;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath, findings);
    } else if (entry.isFile()) {
      // Check .env files directly
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
        findings.push({ file: fullPath, pattern: 'Exposed .env File', match: entry.name });
      }

      // Check text files
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const { name, regex } of SECRET_PATTERNS) {
          const matches = content.match(regex);
          if (matches) {
            for (const match of matches) {
              const masked = match.slice(0, 7) + '...' + match.slice(-4);
              findings.push({ file: fullPath, pattern: name, match: masked });
            }
          }
        }
      } catch {
        // Binary or unreadable files skipped safely
      }
    }
  }
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
