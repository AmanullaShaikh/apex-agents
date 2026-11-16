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

const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]|\\u(?:200[b-d]|feff|00ad|2060|180e)/gi;

export function foldStringLiterals(text) {
  let folded = text.replace(ZERO_WIDTH_REGEX, '');

  // 0. Decode hex (\xHH) and unicode (\uHHHH) escape sequences in strings
  folded = folded.replace(/\\x([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  folded = folded.replace(/\\u([0-9a-fA-F]{4})/g, (m, u) => String.fromCharCode(parseInt(u, 16)));

  // 1. Evaluate Buffer.from(hex, 'hex')
  folded = folded.replace(/Buffer\.from\s*\(\s*['"]([0-9a-fA-F]{8,})['"]\s*,\s*['"]hex['"]\s*\)(\.toString\(\s*['"]?utf-?8['"]?\s*\))?/g, (m, hex) => {
    try {
      return "'" + Buffer.from(hex, 'hex').toString('utf-8') + "'";
    } catch {
      return m;
    }
  });

  // 2. Evaluate String.fromCharCode(...) / String.fromCodePoint(...) including bitwise, arithmetic, and hex expressions
  folded = folded.replace(/String\.(fromCharCode|fromCodePoint)\s*\(\s*([0-9a-fA-FxX\s,\^\&\|\+\-\*\/\(\)]+)\s*\)/g, (m, fn, nums) => {
    try {
      const chars = nums.split(',').map(expr => {
        const trimmed = expr.trim();
        if (/^[0-9a-fA-FxX\s\^\&\|\+\-\*\/\(\)]+$/.test(trimmed)) {
          return String.fromCharCode(Function(`'use strict'; return (${trimmed});`)());
        }
        return '';
      }).join('');
      return "'" + chars + "'";
    } catch {
      return m;
    }
  });

  // 3. Evaluate String.split('').reverse().join('')
  folded = folded.replace(/['"]([a-zA-Z0-9_\-\/+=$]{8,})['"]\.split\(['"]{2}\)\.reverse\(\)\.join\(['"]{2}\)/g, (m, s) => {
    return "'" + s.split('').reverse().join('') + "'";
  });

  // 4. Evaluate function templates: ${(() => 'AKIA')()}
  folded = folded.replace(/\$\{\s*\(\s*\(\s*\)\s*=>\s*['"]([^'"]+)['"]\s*\)\s*\(\s*\)\s*\}/g, '$1');

  // 5. Fold array joins: ['a', 'b', 'c'].join('') -> 'abc'
  folded = folded.replace(/\[\s*(['"`][a-zA-Z0-9_\-\/+=$]+['"`]\s*,\s*)+['"`][a-zA-Z0-9_\-\/+=$]+['"`]\s*\]\.join\(['"`]['"`]\)/g, m => {
    return "'" + m.replace(/\[|\]|\.join\(['"`]['"`]\)/g, '').split(',').map(s => s.trim().replace(/^['"`]|['"`]$/g, '')).join('') + "'";
  });

  // 6. Fold native .concat(): 'a'.concat('b') -> 'ab'
  folded = folded.replace(/(['"`])([a-zA-Z0-9_\-\/+=$]+)\1\.concat\((['"`])([a-zA-Z0-9_\-\/+=$]+)\3\)/g, '$1$2$4$1');

  // 7. Fold template literals: `${'a'}${'b'}` -> 'ab'
  folded = folded.replace(/\$\{\s*(['"`])([a-zA-Z0-9_\-\/+=$]+)\1\s*\}\s*\$\{\s*(['"`])([a-zA-Z0-9_\-\/+=$]+)\3\s*\}/g, '$2$4');

  // 8. Fold .replace() and .replaceAll() string transformations
  folded = folded.replace(/(['"])([^'"]+)\1\.(replace|replaceAll)\s*\(\s*(['"])([^'"]+)\4\s*,\s*(['"])([^'"]*)\6\s*\)/g, (m, q1, str, method, q2, search, q3, repl) => {
    try {
      if (method === 'replaceAll') {
        return q1 + str.replaceAll(search, repl) + q1;
      } else {
        return q1 + str.replace(search, repl) + q1;
      }
    } catch {
      return m;
    }
  });

  // 9. Fold string concatenation in loop for arbitrary multi-part additions
  let prev;
  let iterations = 0;
  do {
    prev = folded;
    folded = folded.replace(/(['"`])([a-zA-Z0-9_\-\/+=$]{1,500})\1\s*\+\s*(['"`])([a-zA-Z0-9_\-\/+=$]{1,500})\3/g, '$1$2$4$1');
    iterations++;
  } while (folded !== prev && iterations < 20);

  return folded;
}

export function inspectBase64Payloads(text) {
  const normalized = text.replace(ZERO_WIDTH_REGEX, '');
  const b64Regex = /\b[A-Za-z0-9+/=]{16,}\b/g;
  let m;
  while ((m = b64Regex.exec(normalized)) !== null) {
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
