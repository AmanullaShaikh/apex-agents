#!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

export const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]|\\u(?:200[b-d]|feff|00ad|2060|180e)/gi;

export const SECRET_PATTERNS = [
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/ },
  { name: 'Stripe Publishable Key', regex: /pk_live_[0-9a-zA-Z]{24}/ },
  { name: 'OpenAI API Key', regex: /sk-proj-[0-9a-zA-Z-_]{48,}/ },
  { name: 'Anthropic API Key', regex: /sk-ant-api03-[0-9a-zA-Z-_]{80,}/ },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Base64 Encoded AWS Key', regex: /\bQUtJ[0-9a-zA-Z+/=_-]{16,}\b/ },
  { name: 'GitHub Personal Token', regex: /ghp_[0-9a-zA-Z]{36}/ },
  { name: 'Slack Bot Token', regex: /xoxb-[0-9]{11}-[0-9]{11}-[0-9a-zA-Z]{24}/ },
  { name: 'Private Key Header', regex: /-----BEGIN (?:(?:RSA|OPENSSH|EC|DSA|ENCRYPTED|PGP)\s+)?PRIVATE KEY(?:\s+BLOCK)?-----/ },
  { name: 'Concatenated / Split Secret', regex: /(['"])(sk_live_|sk-proj-|sk-ant-api03-|AKIA|ghp_)\1\s*\+\s*(['"])[0-9a-zA-Z-_]{8,}\3/ },
  { name: 'Hardcoded Password Assignment', regex: /\b(password|passwd|api_secret|client_secret)\s*[:=]\s*['"][^'"]{6,}['"]/i }
];

const SLOP_PATTERNS = [
  { name: 'Lazy Placeholder Comment', regex: /\/\/\s*(TODO|FIXME|TBD|IMPLEMENT\s+LATER)/i },
  { name: 'Truncated Code Ellipsis', regex: /\/\/\s*\.{3}\s*(rest|remaining|unchanged)/i },
  { name: 'Generic Lazy Ellipsis', regex: /^\s*\.{3}\s*$/m },
  { name: 'Unimplemented Error Stub', regex: /throw new Error\(["'](Not implemented|TODO|stub)["']\)/i },
  { name: 'Empty Catch Block', regex: /catch\s*\([^)]*\)\s*\{\s*\}/ },
  { name: 'Sleep Timer Bypass', regex: /(setTimeout|sleep)\s*\(\s*[0-9]+\s*\)/ }
];

const DEBUG_PATTERNS = [
  { name: 'Console Log Remnant', regex: /\bconsole\.(log|debug|dir)\s*\(/ },
  { name: 'Debugger Statement', regex: /\bdebugger;\b/ },
  { name: 'Python Print Debug', regex: /\bprint\s*\(\s*["']DEBUG/i }
];

const TEST_TAMPERING_PATTERNS = [
  { name: 'Skipped Test Suite / Case', regex: /\b(it|test|describe)(?:\s*\.\s*[a-zA-Z0-9_$]+)*\s*\.\s*(skip|skipIf|runIf)\s*\(|\b(xit|xtest)\s*\(|\b(it|test|describe)\s*\[\s*(['"`]skip['"`]|String\s*\(\s*['"`]skip['"`]\s*\))\s*\]|\b(it|test|describe)\s*\([^)]*,\s*\{[^}]*\bskip\s*:\s*(?:true|['"`][^'"`]+['"`])|\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\.\s*skip\s*\(/ },
  { name: 'Test Todo Cheat (.todo bypass)', regex: /\b(it|test|describe)(?:\s*\.\s*[a-zA-Z0-9_$]+)*\s*\.\s*(todo)\s*\(/ },
  { name: 'Isolated Test Suite / Case (.only cheat)', regex: /\b(it|test|describe)(?:\s*\.\s*[a-zA-Z0-9_$]+)*\s*\.\s*(only)\s*\(|\b(it|test|describe)\s*\[\s*['"`]only['"`]\s*\]|\b(it|test|describe)\s*\([^)]*,\s*\{[^}]*\bonly\s*:\s*true\b/ },
  { name: 'Commented Out Assertion', regex: /(\/\/|\/\*)\s*(expect|assert|should)\s*\(/ },
  { name: 'Early Return Injection (Bypassing Test Execution)', regex: /^\s*return(\s*;|\s+null\s*;|\s+undefined\s*;|\s+true\s*;|\s*$)/ },
  { name: 'Process Exit Injection (Silent Test Killer)', regex: /\bprocess\s*\.\s*exit\s*\(|(?:\b(?:globalThis|global|window)\s*\[\s*['"`]process['"`]\s*\]|\bprocess)\s*\[\s*['"`]exit['"`]\s*\]\s*\(|\bReflect\s*\.\s*get\s*\(\s*(?:(?:globalThis|global|window)(?:\s*\.\s*process|\s*\[\s*['"`]process['"`]\s*\])|process)\s*,\s*['"`]exit['"`]\s*\)/ },
  { name: 'Local Assertion Library Shadowing', regex: /\b(?:const|let|var)\s+(?:expect|assert|should)\s*=/ },
  { name: 'Test Runner Global Monkey-Patching / Hijacking', regex: /\b(globalThis|global|window)\s*\.\s*(it|test|describe|expect|assert)\s*=|^\s*(?:it|test|describe)\s*=\s*/ },
  { name: 'Test Matcher Hijacking (expect.extend)', regex: /\bexpect\s*\.\s*extend\s*\(/ },
  { name: 'Unhandled Asynchronous Timer or Microtask in Test Execution', regex: /\b(setTimeout|setImmediate|queueMicrotask|process\.nextTick)\s*\(/ },
  { name: 'Dead Branch Conditional Assertion Wrap', regex: /\bif\s*\(\s*(false|0|null|undefined)\s*\)\s*(?:\{|\b(?:assert|expect|should|return|throw)\b)/ },
  { name: 'Tautological Assertion Cheat', regex: /\bexpect\s*\(\s*([^)]+?)\s*\)\s*\.\s*(toBe|toEqual|toStrictEqual)\s*\(\s*\1\s*\)|\bexpect\s*\(\s*(true|false|1|0|'[^']*'|"[^"]*")\s*\)\s*\.\s*(toBeTruthy|toBeFalsy|toBeDefined)\s*\(\s*\)|\bassert\.(strictEqual|equal|deepStrictEqual)\s*\(\s*([^,]+?)\s*,\s*\2\s*\)|\bassert(\.ok)?\s*\(\s*true\s*\)|\bexpect\s*\(\s*typeof\s+[^)]+\)\.toBe\s*\(\s*['"][^'"]+['"]\s*\)|\bexpect\s*\(\s*\[[^\]]*\]\[0\]\s*\)\.toBe\s*\(/i }
];

function hasConstantFalseIf(text) {
  const m = /\bif\s*\(\s*(-?\d+(?:\.\d+)?)\s*(===|==|!==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)\s*\)\s*(?:\{|\b(?:assert|expect|should|return|throw)\b)/.exec(text);
  if (!m) return false;
  const a = Number(m[1]);
  const op = m[2];
  const b = Number(m[3]);
  if (op === '>') return !(a > b);
  if (op === '<') return !(a < b);
  if (op === '>=') return !(a >= b);
  if (op === '<=') return !(a <= b);
  if (op === '===' || op === '==') return !(a === b);
  if (op === '!==' || op === '!=') return !(a !== b);
  return false;
}

export function foldStringLiterals(text) {
  let folded = text.replace(ZERO_WIDTH_REGEX, '');

  // 0. Decode hex (\xHH), BMP unicode (\uHHHH), and ES6 unicode code point (\u{...}) escape sequences in strings
  folded = folded.replace(/\\x([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  folded = folded.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (m, cp) => {
    const code = parseInt(cp, 16);
    return code <= 0x10FFFF ? String.fromCodePoint(code) : m;
  });
  folded = folded.replace(/\\u([0-9a-fA-F]{4})/g, (m, u) => String.fromCharCode(parseInt(u, 16)));

  // 1. Evaluate Buffer.from(hex, 'hex')
  folded = folded.replace(/Buffer\.from\s*\(\s*['"]([0-9a-fA-F]{8,})['"]\s*,\s*['"]hex['"]\s*\)(\.toString\(\s*['"]?utf-?8['"]?\s*\))?/g, (m, hex) => {
    try {
      return "'" + Buffer.from(hex, 'hex').toString('utf-8') + "'";
    } catch {
      return m;
    }
  });

  // 2. Evaluate String.fromCharCode(...) / String.fromCodePoint(...) including spread arrays (...[...]), bitwise, arithmetic, and hex expressions
  folded = folded.replace(/String\.(fromCharCode|fromCodePoint)\s*\(\s*(?:\.\.\.\s*\[\s*)?([0-9a-fA-FxX\s,\^\&\|\+\-\*\/\(\)]+?)(?:\s*\])?\s*\)/g, (m, fn, nums) => {
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

  // 2b. Evaluate numeric byte arrays: TextDecoder.decode(new Uint8Array(Array.of(...))), Uint8Array([...]), Uint8Array.from([...]), Buffer.from([...])
  folded = folded.replace(
    /(?:new\s+TextDecoder\s*\([^)]*\)\s*\.\s*decode\s*\(\s*)?(?:(?:new\s+)?Uint8Array(?:\.from)?|Buffer\.from)\s*\(\s*(?:Array\.of\s*\(|\[)\s*([0-9a-fA-FxX\s,\^\&\|\+\-\*\/\(\)]+?)\s*(?:\)|\])\s*\)(?:\s*\))?/g,
    (m, nums) => {
      try {
        const bytes = nums.split(',').map(expr => {
          const trimmed = expr.trim();
          if (/^[0-9a-fA-FxX\s\^\&\|\+\-\*\/\(\)]+$/.test(trimmed)) {
            const val = Number(Function(`'use strict'; return (${trimmed});`)());
            if (Number.isInteger(val) && val >= 0 && val <= 255) return val;
          }
          return null;
        });
        if (bytes.length >= 4 && bytes.every(b => b !== null)) {
          return "'" + Buffer.from(bytes).toString('utf-8') + "'";
        }
        return m;
      } catch {
        return m;
      }
    }
  );

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

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Shared single-line + cross-line string variable resolution helper.
 * Properly handles `$`-prefixed identifiers (`$p1 + $p2`) and avoids `$&`/`$1` replacement injection.
 */
export function resolveLineWithVars(line, fileStringVars) {
  const normalized = line.replace(ZERO_WIDTH_REGEX, '');
  const folded = foldStringLiterals(normalized);
  let resolved = folded;

  if (fileStringVars.size > 0) {
    for (const [varName, varVal] of fileStringVars.entries()) {
      const escapedName = escapeRegExp(varName);
      const varRef = new RegExp(`(?<![a-zA-Z0-9_$.])${escapedName}(?![a-zA-Z0-9_$])(?!\\s*[:=])`, 'g');
      if (varRef.test(resolved)) {
        resolved = resolved.replace(varRef, () => `'${varVal}'`);
      }
    }
    resolved = foldStringLiterals(resolved);
  }

  const varAssign = /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(['"`])([a-zA-Z0-9_\-\/+=$]{1,500})\2/.exec(resolved);
  if (varAssign) {
    fileStringVars.set(varAssign[1], varAssign[3]);
  }

  return { normalized, folded, resolved };
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

export function calculateShannonEntropy(str) {
  const len = str.length;
  if (len === 0) return 0;
  const freq = {};
  for (let i = 0; i < len; i++) {
    const char = str[i];
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function getGitDiff(targetBranch = null, stagedOnly = false) {
  try {
    if (targetBranch) {
      return execSync(`git diff ${targetBranch}...HEAD`, { encoding: 'utf-8' });
    }
    if (stagedOnly) {
      return execSync('git diff --cached', { encoding: 'utf-8' });
    }
    // Default: Check working tree diff + staged diff + untracked files
    let diff = '';
    try {
      diff += execSync('git diff HEAD', { encoding: 'utf-8' });
    } catch {}
    if (!diff.trim()) {
      try {
        diff = execSync('git diff', { encoding: 'utf-8' });
      } catch {}
    }

    // Include untracked files in working tree diff
    try {
      const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
      const untrackedFiles = statusOutput
        .split('\n')
        .filter(line => line.startsWith('?? '))
        .map(line => line.slice(3).trim());

      for (const file of untrackedFiles) {
        if (!fs.existsSync(file)) continue;
        try {
          const stat = fs.statSync(file);
          if (stat.isDirectory() || stat.size > 1024 * 512) continue;
          const content = fs.readFileSync(file, 'utf-8');
          diff += `\ndiff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n`;
          diff += content.split('\n').map(l => '+' + l).join('\n') + '\n';
        } catch {}
      }
    } catch {}

    return diff;
  } catch (err) {
    return '';
  }
}

/**
 * Audits a raw git diff for leaked secrets, AI slop, debug statements, and test tampering.
 */
export function auditDiff(rawDiff) {
  if (!rawDiff || !rawDiff.trim()) {
    return {
      clean: true,
      issues: [],
      files: [],
      stats: { secrets: 0, slop: 0, debug: 0, tampering: 0 }
    };
  }

  const lines = rawDiff.split('\n');
  let currentFile = 'unknown';
  const changedFiles = new Set();
  const testFiles = new Set();
  const issues = [];
  const deletedAssertions = [];
  const commentedAssertions = new Set();
  const fileStringVars = new Map();

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const parts = line.split(' ');
      currentFile = parts[parts.length - 1].replace(/^b\//, '');
      changedFiles.add(currentFile);
      fileStringVars.clear();

      // Check if sensitive credential/env file itself is modified or added
      const baseName = currentFile.split('/').pop().toLowerCase();
      if ((baseName.startsWith('.env') && !baseName.endsWith('.example')) || baseName.endsWith('.pem') || baseName.endsWith('.key') || baseName === 'id_rsa') {
        issues.push({
          severity: 'CRITICAL',
          category: 'SECRET_LEAK',
          file: currentFile,
          description: `Exposed sensitive environment or credential key file: ${currentFile}`,
          snippet: `[Sensitive File Added/Modified: ${currentFile}]`
        });
      }

      if (currentFile.includes('.test.') || currentFile.includes('.spec.') || currentFile.includes('tests/')) {
        testFiles.add(currentFile);
      }
      continue;
    }

    // Collect deleted assertions
    if (line.startsWith('-') && !line.startsWith('---')) {
      const isTestFile = currentFile.includes('.test.') || currentFile.includes('.spec.') || currentFile.includes('tests/');
      const deletedText = line.substring(1).trim();
      if (isTestFile && /\b(expect|assert|should)\s*\(/.test(deletedText) && !deletedText.startsWith('//')) {
        deletedAssertions.push({ file: currentFile, snippet: deletedText.slice(0, 80) });
      }
    }

    // Audit added lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedText = line.substring(1);

      const isSelfAuditTest = currentFile.includes('diff-audit.test.');

      // Check secrets
      if (!isSelfAuditTest) {
        const { normalized: normalizedAdded, folded: foldedText, resolved: resolvedText } = resolveLineWithVars(addedText, fileStringVars);

        for (const sp of SECRET_PATTERNS) {
          if (sp.regex.test(normalizedAdded) || sp.regex.test(foldedText) || sp.regex.test(resolvedText)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'SECRET_LEAK',
              file: currentFile,
              description: `Exposed ${sp.name}`,
              snippet: normalizedAdded.trim().slice(0, 80)
            });
            break;
          }
        }

        // Base64 payload deep inspection
        const b64Secret = inspectBase64Payloads(normalizedAdded) || inspectBase64Payloads(foldedText) || inspectBase64Payloads(resolvedText);
        if (b64Secret) {
          issues.push({
            severity: 'CRITICAL',
            category: 'SECRET_LEAK',
            file: currentFile,
            description: 'Exposed Base64 Encoded Credential Payload',
            snippet: b64Secret.matched.slice(0, 40)
          });
        }

        // Shannon entropy scan for hardcoded tokens
        const assignMatch = /\b(?:const|let|var|[a-zA-Z0-9_]+)\s*[:=]\s*['"]([A-Za-z0-9_\-\/+=$]{30,})['"]/.exec(addedText);
        if (assignMatch) {
          const val = assignMatch[1];
          if (calculateShannonEntropy(val) > 4.5 && /[A-Z]/.test(val) && /[a-z]/.test(val) && /[0-9]/.test(val)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'SECRET_LEAK',
              file: currentFile,
              description: 'High-Entropy Secret / Token Detected (Shannon Entropy > 4.5)',
              snippet: val.slice(0, 10) + '...' + val.slice(-4)
            });
          }
        }
      }

      // Check AI slop (only in code files, not rule manifests or docs)
      const isDocOrRule = /\.(md|mdc|txt)$/i.test(currentFile) || ['CLAUDE.md', '.cursorrules', '.windsurfrules'].some(f => currentFile.endsWith(f));
      if (!isDocOrRule && !isSelfAuditTest) {
        for (const slp of SLOP_PATTERNS) {
          if (slp.regex.test(addedText)) {
            issues.push({
              severity: 'HIGH',
              category: 'AI_SLOP',
              file: currentFile,
              description: `Found ${slp.name}`,
              snippet: addedText.trim().slice(0, 80)
            });
          }
        }
      }

      // Check test tampering if modifying tests
      const isTestFile = currentFile.includes('.test.') || currentFile.includes('.spec.') || currentFile.includes('tests/');
      if (isTestFile && !isSelfAuditTest) {
        const foldedText = foldStringLiterals(addedText);
        for (const ttp of TEST_TAMPERING_PATTERNS) {
          if (ttp.regex.test(addedText) || ttp.regex.test(foldedText)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'TEST_TAMPERING',
              file: currentFile,
              description: `AI Agent Attempted Test Weakening: ${ttp.name}`,
              snippet: addedText.trim().slice(0, 80)
            });
            if (ttp.name === 'Commented Out Assertion') {
              commentedAssertions.add(currentFile);
            }
          }
        }
        if (hasConstantFalseIf(addedText) || hasConstantFalseIf(foldedText)) {
          issues.push({
            severity: 'CRITICAL',
            category: 'TEST_TAMPERING',
            file: currentFile,
            description: 'AI Agent Attempted Test Weakening: Constant-False Dead Branch Wrap',
            snippet: addedText.trim().slice(0, 80)
          });
        }
      }

      // Check debug remnants (exclude CLI entrypoints and scripts)
      const isCliOrScript = currentFile.startsWith('bin/') || currentFile.startsWith('scripts/') || currentFile.includes('cli.') || isSelfAuditTest;
      if (!isCliOrScript) {
        for (const dbg of DEBUG_PATTERNS) {
          if (dbg.regex.test(addedText)) {
            issues.push({
              severity: 'MEDIUM',
              category: 'DEBUG_REMNANT',
              file: currentFile,
              description: `Residual ${dbg.name}`,
              snippet: addedText.trim().slice(0, 80)
            });
          }
        }
      }
    }
  }

  // Only count deleted assertions if the file was not already flagged for commenting them out
  for (const del of deletedAssertions) {
    if (!commentedAssertions.has(del.file)) {
      issues.push({
        severity: 'HIGH',
        category: 'TEST_TAMPERING',
        file: del.file,
        description: 'AI Agent Deleted Assertion Line from Test Suite',
        snippet: del.snippet
      });
    }
  }

  const stats = {
    secrets: issues.filter(i => i.category === 'SECRET_LEAK').length,
    slop: issues.filter(i => i.category === 'AI_SLOP').length,
    debug: issues.filter(i => i.category === 'DEBUG_REMNANT').length,
    tampering: issues.filter(i => i.category === 'TEST_TAMPERING').length
  };

  return {
    clean: issues.length === 0,
    issues,
    files: Array.from(changedFiles),
    stats
  };
}

export function runDiffAuditCli(options = {}) {
  const diff = getGitDiff(options.branch, options.staged);
  const result = auditDiff(diff);

  if (options.format === 'markdown') {
    if (result.clean) {
      console.log('### ⚡ Apex Agents Diff Review: PASSED\nZero leaked secrets, AI placeholders, or test tampering detected.');
    } else {
      console.log('### ❌ Apex Agents Diff Review: FAILED\n');
      console.log(`Found **${result.issues.length}** critical issue(s):\n`);
      result.issues.forEach(iss => {
        console.log(`- **[${iss.severity}] ${iss.category}** in \`${iss.file}\`: ${iss.description}`);
        console.log(`  \`\`\`\n  ${iss.snippet}\n  \`\`\``);
      });
      console.log('\n> *Agent execution halted to prevent codebase degradation.*');
    }
    return result;
  }

  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS ZERO-SLOP DIFF AUDITOR ═════${c.reset}`);
  console.log(`  Files Audited: ${c.bold}${result.files.length}${c.reset}`);
  console.log(`  Critical Secrets: ${result.stats.secrets > 0 ? c.red : c.green}${result.stats.secrets}${c.reset}`);
  console.log(`  Test Tampering:   ${result.stats.tampering > 0 ? c.red : c.green}${result.stats.tampering}${c.reset}`);
  console.log(`  AI Slop / Stubs:  ${result.stats.slop > 0 ? c.yellow : c.green}${result.stats.slop}${c.reset}`);
  console.log(`  Debug Remnants:   ${result.stats.debug > 0 ? c.yellow : c.green}${result.stats.debug}${c.reset}\n`);

  if (!result.clean) {
    result.issues.forEach(iss => {
      const color = iss.severity === 'CRITICAL' ? c.red : c.yellow;
      console.log(`  ${color}[${iss.severity}]${c.reset} ${c.bold}${iss.category}${c.reset} in ${c.cyan}${iss.file}${c.reset}`);
      console.log(`    ${iss.description}`);
      console.log(`    ${c.gray}Snippet: ${iss.snippet}${c.reset}\n`);
    });

    const hasCritical = result.issues.some(iss => iss.severity === 'CRITICAL');
    if (options.strict || hasCritical) {
      console.error(`${c.red}${c.bold}❌ AUDIT FAILED: Fix the issues above before committing or merging.${c.reset}\n`);
      process.exit(1);
    }
  } else {
    console.log(`  ${c.green}${c.bold}✓ PASSED:${c.reset} Diff is clean, secure, and production-ready.\n`);
  }

  return result;
}

if (process.argv[1] && process.argv[1].endsWith('audit-diff.js')) {
  const args = process.argv.slice(2);
  const staged = args.includes('--staged');
  const strict = args.includes('--strict');
  const branchArg = args.find(a => a.startsWith('--branch='));
  const branch = branchArg ? branchArg.split('=')[1] : null;
  const formatArg = args.find(a => a.startsWith('--format='));
  const format = formatArg ? formatArg.split('=')[1] : 'text';

  runDiffAuditCli({ staged, strict, branch, format });
}
