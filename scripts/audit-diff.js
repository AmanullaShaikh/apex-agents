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

const SECRET_PATTERNS = [
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/ },
  { name: 'OpenAI API Key', regex: /sk-proj-[0-9a-zA-Z-_]{48,}/ },
  { name: 'Anthropic API Key', regex: /sk-ant-api03-[0-9a-zA-Z-_]{80,}/ },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Base64 Encoded AWS Key', regex: /\bQUtJ[0-9a-zA-Z+/=_-]{16,}\b/ },
  { name: 'GitHub Personal Token', regex: /ghp_[0-9a-zA-Z]{36}/ },
  { name: 'Private Key Header', regex: /-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----/ },
  { name: 'Concatenated / Split Secret', regex: /(['"])(sk_live_|sk-proj-|sk-ant-api03-|AKIA|ghp_)\1\s*\+\s*(['"])[0-9a-zA-Z-_]{8,}\3/ },
  { name: 'Hardcoded Password Assignment', regex: /\b(password|passwd|api_secret|client_secret)\s*[:=]\s*['"][^'"]{6,}['"]/i }
];

const SLOP_PATTERNS = [
  { name: 'Lazy Placeholder Comment', regex: /\/\/\s*(TODO|FIXME|TBD|IMPLEMENT\s+LATER)/i },
  { name: 'Truncated Code Ellipsis', regex: /\/\/\s*\.{3}\s*(rest|remaining|unchanged)/i },
  { name: 'Generic Lazy Ellipsis', regex: /^\s*\.{3}\s*$/m },
  { name: 'Unimplemented Error Stub', regex: /throw new Error\(["'](Not implemented|TODO|stub)["']\)/i },
  { name: 'Empty Catch Block', regex: /catch\s*\([^)]*\)\s*\{\s*\}/ },
  { name: 'Sleep Timer Bypass', regex: /(setTimeout|sleep)\s*\(\s*[0-9]{4,}\s*\)/ }
];

const DEBUG_PATTERNS = [
  { name: 'Console Log Remnant', regex: /\bconsole\.(log|debug|dir)\s*\(/ },
  { name: 'Debugger Statement', regex: /\bdebugger;\b/ },
  { name: 'Python Print Debug', regex: /\bprint\s*\(\s*["']DEBUG/i }
];

const TEST_TAMPERING_PATTERNS = [
  { name: 'Skipped Test Suite / Case', regex: /\b(it|test|describe)\s*(\.|\b)\s*(skip)\s*\(|\b(xit|xtest)\s*\(|\b(it|test|describe)\s*\[\s*['"`]skip['"`]\s*\]/ },
  { name: 'Test Todo Cheat (.todo bypass)', regex: /\b(it|test|describe)\s*(\.|\b)\s*(todo)\s*\(/ },
  { name: 'Isolated Test Suite / Case (.only cheat)', regex: /\b(it|test|describe)\s*(\.|\b)\s*(only)\s*\(|\b(it|test|describe)\s*\[\s*['"`]only['"`]\s*\]/ },
  { name: 'Commented Out Assertion', regex: /(\/\/|\/\*)\s*(expect|assert|should)\s*\(/ },
  { name: 'Tautological Assertion Cheat', regex: /\bexpect\s*\(\s*(true|false|1|0)\s*\)\s*\.\s*(toBe|toEqual)\s*\(\s*\1\s*\)|\bassert\s*\(\s*true\s*\)|\bassert\.(strictEqual|equal|deepStrictEqual)\s*\(\s*(true|false|1|0)\s*,\s*\2\s*\)/i }
];

function getGitDiff(targetBranch = null, stagedOnly = false) {
  try {
    if (targetBranch) {
      return execSync(`git diff ${targetBranch}...HEAD`, { encoding: 'utf-8' });
    }
    if (stagedOnly) {
      return execSync('git diff --cached', { encoding: 'utf-8' });
    }
    // Default: Check working tree diff + staged diff
    const workingDiff = execSync('git diff HEAD', { encoding: 'utf-8' });
    if (workingDiff.trim()) return workingDiff;
    return execSync('git diff', { encoding: 'utf-8' });
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

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const parts = line.split(' ');
      currentFile = parts[parts.length - 1].replace(/^b\//, '');
      changedFiles.add(currentFile);
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

      const isSelfAuditTest = currentFile.includes('diff-audit.test.') || currentFile.includes('benchmark-eval.');

      // Check secrets
      if (!isSelfAuditTest) {
        for (const sp of SECRET_PATTERNS) {
          if (sp.regex.test(addedText)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'SECRET_LEAK',
              file: currentFile,
              description: `Exposed ${sp.name}`,
              snippet: addedText.trim().slice(0, 80)
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
        for (const ttp of TEST_TAMPERING_PATTERNS) {
          if (ttp.regex.test(addedText)) {
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

    if (options.strict) {
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
