#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
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
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/g },
  { name: 'OpenAI API Key', regex: /sk-proj-[0-9a-zA-Z-_]{48,}/g },
  { name: 'Anthropic API Key', regex: /sk-ant-api03-[0-9a-zA-Z-_]{80,}/g },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'GitHub Personal Token', regex: /ghp_[0-9a-zA-Z]{36}/g },
  { name: 'Private Key Header', regex: /-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----/g }
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
  { name: 'Skipped Test Suite / Case', regex: /\b(it|test|describe)\s*(\.|\b)\s*(skip)\s*\(|\b(xit|xtest)\s*\(/ },
  { name: 'Isolated Test Suite / Case (.only cheat)', regex: /\b(it|test|describe)\s*(\.|\b)\s*(only)\s*\(/ },
  { name: 'Commented Out Assertion', regex: /(\/\/|\/\*)\s*(expect|assert|should)\s*\(/ }
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

export function auditDiff(diffText) {
  if (!diffText || !diffText.trim()) {
    return {
      clean: true,
      filesChanged: 0,
      issues: [],
      stats: { secrets: 0, slop: 0, debug: 0, warnings: 0 },
      hasTests: false
    };
  }

  const lines = diffText.split('\n');
  let currentFile = 'unknown';
  const changedFiles = new Set();
  const testFiles = new Set();
  const issues = [];

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

    // Only audit added lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedText = line.substring(1);

      // Check secrets
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

      // Check AI slop
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

      // Check test tampering if modifying tests
      const isTestFile = currentFile.includes('.test.') || currentFile.includes('.spec.') || currentFile.includes('tests/');
      if (isTestFile) {
        for (const ttp of TEST_TAMPERING_PATTERNS) {
          if (ttp.regex.test(addedText)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'TEST_TAMPERING',
              file: currentFile,
              description: `AI Agent Attempted Test Weakening: ${ttp.name}`,
              snippet: addedText.trim().slice(0, 80)
            });
          }
        }
      }

      // Check debug remnants (exclude CLI entrypoints and scripts)
      const isCliOrScript = currentFile.startsWith('bin/') || currentFile.startsWith('scripts/') || currentFile.includes('cli.');
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

  // TDD & Scope Discipline Checks
  const codeFiles = Array.from(changedFiles).filter((f) => {
    return /\.(js|ts|jsx|tsx|py|go|rs|cpp|cs)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.');
  });

  if (codeFiles.length > 0 && testFiles.size === 0) {
    issues.push({
      severity: 'WARNING',
      category: 'TEST_DISCIPLINE',
      file: 'Pull Request / Diff',
      description: `Modified ${codeFiles.length} source code file(s) with 0 accompanying test updates. Violation of Zero-Slop TDD Discipline!`,
      snippet: codeFiles.slice(0, 3).join(', ') + (codeFiles.length > 3 ? '...' : '')
    });
  }

  if (changedFiles.size > 12) {
    issues.push({
      severity: 'WARNING',
      category: 'SCOPE_DRIFT',
      file: 'Repository Scope',
      description: `Agent modified ${changedFiles.size} files in one turn. Potential hallucination or unconstrained scope explosion!`,
      snippet: `${changedFiles.size} files touched`
    });
  }

  const stats = {
    secrets: issues.filter((i) => i.category === 'SECRET_LEAK').length,
    slop: issues.filter((i) => i.category === 'AI_SLOP').length,
    tampering: issues.filter((i) => i.category === 'TEST_TAMPERING').length,
    debug: issues.filter((i) => i.category === 'DEBUG_REMNANT').length,
    warnings: issues.filter((i) => i.severity === 'WARNING').length
  };

  return {
    clean: issues.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length === 0,
    filesChanged: changedFiles.size,
    changedFilesList: Array.from(changedFiles),
    issues,
    stats,
    hasTests: testFiles.size > 0
  };
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('audit-diff.js')) {
  const args = process.argv.slice(2);
  const isStaged = args.includes('--staged');
  const targetBranch = args.find((a) => a.startsWith('--branch='))?.split('=')[1] || null;
  const isMarkdown = args.includes('--format=markdown') || args.includes('--markdown');
  const isStrict = args.includes('--strict');

  const diff = getGitDiff(targetBranch, isStaged);

  if (!diff.trim()) {
    if (isMarkdown) {
      console.log('### Apex Agents Diff Review\n\n✓ Working tree clean. No changes detected to review.');
    } else {
      console.log(`\n${c.green}✓ Working tree is clean. No uncommitted diff detected.${c.reset}\n`);
    }
    process.exit(0);
  }

  const result = auditDiff(diff);

  if (isMarkdown) {
    console.log(`## 🛡️ Apex Agents Automated Diff Review\n`);
    console.log(`**Files Changed:** \`${result.filesChanged}\` | **Critical Secrets:** \`${result.stats.secrets}\` | **AI Slop:** \`${result.stats.slop}\` | **Debug Remnants:** \`${result.stats.debug}\`\n`);
    
    if (result.issues.length === 0) {
      console.log(`> **Verdict: PASSED** 🎉  \n> Zero credential leaks, zero lazy placeholders, and strict discipline maintained.`);
    } else {
      console.log(`### ⚠️ Identified Violations\n`);
      console.log(`| Severity | Category | File | Description | Snippet |`);
      console.log(`| :--- | :--- | :--- | :--- | :--- |`);
      for (const iss of result.issues) {
        console.log(`| **${iss.severity}** | \`${iss.category}\` | \`${iss.file}\` | ${iss.description} | \`${iss.snippet}\` |`);
      }
      console.log(`\n> **Required Action:** Clean up the above findings before requesting review or merging.`);
    }
  } else {
    console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS ZERO-SLOP DIFF AUDITOR ═════${c.reset}`);
    console.log(`  ${c.bold}Files Audited:${c.reset} ${c.cyan}${result.filesChanged}${c.reset}`);
    console.log(`  ${c.bold}Critical Secrets:${c.reset} ${result.stats.secrets > 0 ? c.red : c.green}${result.stats.secrets}${c.reset}`);
    console.log(`  ${c.bold}Test Tampering:${c.reset} ${result.stats.tampering > 0 ? c.red : c.green}${result.stats.tampering}${c.reset}`);
    console.log(`  ${c.bold}AI Slop / Stubs:${c.reset} ${result.stats.slop > 0 ? c.red : c.green}${result.stats.slop}${c.reset}`);
    console.log(`  ${c.bold}Debug Remnants:${c.reset} ${result.stats.debug > 0 ? c.yellow : c.green}${result.stats.debug}${c.reset}`);
    console.log(`  ${c.bold}Discipline Warnings:${c.reset} ${result.stats.warnings > 0 ? c.yellow : c.green}${result.stats.warnings}${c.reset}\n`);

    if (result.issues.length === 0) {
      console.log(`  ${c.green}${c.bold}✓ PASSED: Diff is clean, secure, and production-ready.${c.reset}\n`);
      process.exit(0);
    } else {
      for (const iss of result.issues) {
        const color = iss.severity === 'CRITICAL' ? c.red : iss.severity === 'HIGH' ? c.magenta : c.yellow;
        console.log(`  ${color}[${iss.severity}] ${iss.category}${c.reset} in ${c.cyan}${iss.file}${c.reset}`);
        console.log(`    ${c.gray}Reason:${c.reset} ${iss.description}`);
        console.log(`    ${c.dim}Snippet: ${iss.snippet}${c.reset}\n`);
      }

      if (isStrict || result.stats.secrets > 0 || result.stats.slop > 0 || result.stats.tampering > 0) {
        console.log(`  ${c.red}${c.bold}FAILED: Zero-slop or secret-protection thresholds violated.${c.reset}\n`);
        process.exit(1);
      }
    }
  }
}
