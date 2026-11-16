#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// High-confidence regex signatures for sensitive credentials
const SECRET_PATTERNS = [
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/ },
  { name: 'Stripe Publishable Key', regex: /pk_live_[0-9a-zA-Z]{24}/ },
  { name: 'OpenAI API Key', regex: /sk-proj-[0-9a-zA-Z-_]{48,}/ },
  { name: 'Anthropic API Key', regex: /sk-ant-api03-[0-9a-zA-Z-_]{80,}/ },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Base64 Encoded AWS Key', regex: /\bQUtJQS[0-9a-zA-Z+/=]{16,}\b/ },
  { name: 'GitHub Personal Token', regex: /ghp_[0-9a-zA-Z]{36}/ },
  { name: 'Slack Bot Token', regex: /xoxb-[0-9]{11}-[0-9]{11}-[0-9a-zA-Z]{24}/ },
  { name: 'Private SSH Key', regex: /-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----/ },
  { name: 'Concatenated / Split Secret', regex: /(['"])(sk_live_|sk-proj-|sk-ant-api03-|AKIA|ghp_)\1\s*\+\s*(['"])[0-9a-zA-Z-_]{8,}\3/ },
  { name: 'Hardcoded Password Assignment', regex: /\b(password|passwd|api_secret|client_secret)\s*[:=]\s*['"][^'"]{6,}['"]/i }
];

export function foldStringLiterals(text) {
  let folded = text;
  folded = folded.replace(/(['"`])([a-zA-Z0-9_\-\/+=$]{1,50})\1\s*\+\s*(['"`])([a-zA-Z0-9_\-\/+=$]{1,60})\3/g, '$1$2$4$1');
  folded = folded.replace(/(['"`])([a-zA-Z0-9_\-\/+=$]{1,60})\1\s*\+\s*(['"`])([a-zA-Z0-9_\-\/+=$]{1,60})\3/g, '$1$2$4$1');
  folded = folded.replace(/(['"`])([a-zA-Z0-9_\-\/+=$]{1,80})\1\s*\+\s*(['"`])([a-zA-Z0-9_\-\/+=$]{1,80})\3/g, '$1$2$4$1');
  folded = folded.replace(/\[\s*(['"`][a-zA-Z0-9_\-\/+=$]+['"`]\s*,\s*)+['"`][a-zA-Z0-9_\-\/+=$]+['"`]\s*\]\.join\(['"`]['"`]\)/g, m => {
    return "'" + m.replace(/\[|\]|\.join\(['"`]['"`]\)/g, '').split(',').map(s => s.trim().replace(/^['"`]|['"`]$/g, '')).join('') + "'";
  });
  folded = folded.replace(/(['"`])([a-zA-Z0-9_\-\/+=$]+)\1\.concat\((['"`])([a-zA-Z0-9_\-\/+=$]+)\3\)/g, '$1$2$4$1');
  folded = folded.replace(/\$\{\s*(['"`])([a-zA-Z0-9_\-\/+=$]+)\1\s*\}\s*\$\{\s*(['"`])([a-zA-Z0-9_\-\/+=$]+)\3\s*\}/g, '$2$4');
  return folded;
}

export function inspectBase64Payloads(text) {
  const b64Regex = /\b[A-Za-z0-9+/=]{16,}\b/g;
  let m;
  while ((m = b64Regex.exec(text)) !== null) {
    try {
      const decoded = Buffer.from(m[0], 'base64').toString('utf-8');
      if (/\bAKIA[0-9A-Z]{16}\b/.test(decoded) || /sk_live_[0-9a-zA-Z]{24}/.test(decoded) || /sk-proj-/.test(decoded) || /ghp_[0-9a-zA-Z]{36}/.test(decoded)) {
        return { matched: m[0], decodedSnippet: decoded.slice(0, 30) };
      }
    } catch {}
  }
  return null;
}

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
        const content = fs.readFileSync(fullPath, 'utf-8');
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

        const b64 = inspectBase64Payloads(content);
        if (b64) {
          findings.push({ file: fullPath, pattern: 'Base64 Encoded AWS Key', match: b64.matched.slice(0, 8) + '...' });
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
