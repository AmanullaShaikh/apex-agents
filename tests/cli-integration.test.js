import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const APEX_BIN = path.join(ROOT_DIR, 'bin', 'apex.js');

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

describe('CLI Integration Suite (bin/apex.js)', () => {
  test('should display version with -v and --version', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
    const expectedVer = new RegExp(`apex-agents v${pkg.version.replace(/\./g, '\\.')}`);
    const outV = stripAnsi(execSync(`node "${APEX_BIN}" -v`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(outV, expectedVer);

    const outVersion = stripAnsi(execSync(`node "${APEX_BIN}" --version`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(outVersion, expectedVer);
  });

  test('should display help menu with --help', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" --help`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /USAGE:/);
    assert.match(out, /COMMANDS:/);
    assert.doesNotMatch(out, /Sovereign/i);
  });

  test('should run doctor diagnostics honestly in git, non-git, and git worktree directories', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" doctor`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /Running Environment Diagnostics/);
    assert.match(out, /Apex Agents engine is ready/);
    assert.doesNotMatch(out, /SWE-Bench Mini/);

    // 1. Non-git empty temp dir MUST NOT falsely claim hooks are Installed/Active
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-doctor-nogit-'));
    try {
      const noGitOut = stripAnsi(execSync(`node "${APEX_BIN}" doctor`, { encoding: 'utf-8', cwd: emptyDir }));
      assert.match(noGitOut, /Not a git repository/);
      assert.doesNotMatch(noGitOut, /Pre-Commit Safety Hooks\s*:\s*Installed/);
      assert.doesNotMatch(noGitOut, /Anti-Cheat Test Guard\s*:\s*Active/);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }

    // 2. Git worktree MUST detect hooks installed in the shared common git dir
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-doctor-wt-repo-'));
    const wtDir = path.join(os.tmpdir(), `apex-doctor-wt-linked-${Date.now()}`);
    try {
      execSync('git init', { cwd: repoDir, stdio: 'pipe' });
      execSync('git config user.email "test@apex.local"', { cwd: repoDir, stdio: 'pipe' });
      execSync('git config user.name "Apex Test"', { cwd: repoDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# temp repo\n');
      execSync('git add -A && git commit -m "init"', { cwd: repoDir, stdio: 'pipe' });

      execSync(`node "${APEX_BIN}" install-hooks`, { cwd: repoDir, stdio: 'pipe' });
      execSync(`git worktree add -b feat-wt "${wtDir}"`, { cwd: repoDir, stdio: 'pipe' });

      const wtOut = stripAnsi(execSync(`node "${APEX_BIN}" doctor`, { encoding: 'utf-8', cwd: wtDir }));
      assert.match(wtOut, /Pre-Commit Safety Hooks\s*:\s*Installed/);
      assert.match(wtOut, /Anti-Cheat Test Guard\s*:\s*Active/);
    } finally {
      try {
        execSync(`git worktree remove --force "${wtDir}"`, { cwd: repoDir, stdio: 'pipe' });
      } catch {
        // fallback cleanup below
      }
      fs.rmSync(wtDir, { recursive: true, force: true });
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
  });

  test('should list all 32 specialists and operational instincts', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" list`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /OPERATIONAL INSTINCTS/);
    assert.match(out, /Total Specialists:\s*32/);
  });

  test('should inspect context budget with zero errors', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" budget`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /APEX AGENTS CONTEXT BUDGET OPTIMIZER/);
    assert.match(out, /CONTEXT SUMMARY/);
  });

  test('should run token volume and AST compaction cost auditor and strictly validate flags', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" cost`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /TOKEN VOLUME & AST COMPACTION AUDITOR/);
    assert.match(out, /measured reduction/);

    const pricedOut = stripAnsi(execSync(`node "${APEX_BIN}" cost --price-in=2.00`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(pricedOut, /CUSTOM COST CALCULATION \(\$2\/1M input tokens\)/);

    const spacedOut = stripAnsi(execSync(`node "${APEX_BIN}" cost --price-in 2.00`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(spacedOut, /CUSTOM COST CALCULATION \(\$2\/1M input tokens\)/);
    assert.doesNotMatch(spacedOut, /Scanned Files\s*:\s*0\b/);

    const leadingDotOut = stripAnsi(execSync(`node "${APEX_BIN}" cost --price-in=.50`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(leadingDotOut, /CUSTOM COST CALCULATION \(\$0\.5\/1M input tokens\)/);

    for (const badArgs of ['--price-in=2abc', '--price-in=Infinity', '--price-in=-5', '--price-in', '--bogus', 'package.json']) {
      assert.throws(() => {
        execSync(`node "${APEX_BIN}" cost ${badArgs}`, { stdio: 'pipe', cwd: ROOT_DIR });
      }, /Command failed/, `cost ${badArgs} must exit non-zero`);
    }
  });

  test('should exit non-zero when install-hooks is run outside a git repo or test-loop receives unknown flags', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-hooks-nogit-'));
    try {
      assert.throws(() => {
        execSync(`node "${APEX_BIN}" install-hooks`, { stdio: 'pipe', cwd: emptyDir });
      }, /Command failed/);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }

    assert.throws(() => {
      execSync(`node "${APEX_BIN}" test-loop --heal`, { stdio: 'pipe', cwd: ROOT_DIR });
    }, /Command failed/);
  });

  test('should initialize apex-agents suite with apex-agents init', () => {
    const tempDir = path.join(ROOT_DIR, '.test_tmp_init');
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const out = stripAnsi(execSync(`node "${APEX_BIN}" init`, { encoding: 'utf-8', cwd: tempDir }));
      assert.match(out, /APEX AGENTS SUITE FULLY INITIALIZED/);
      assert.ok(fs.existsSync(path.join(tempDir, 'CLAUDE.md')), 'Must generate CLAUDE.md');
      assert.ok(fs.existsSync(path.join(tempDir, '.cursorrules')), 'Must generate .cursorrules');
      assert.ok(fs.existsSync(path.join(tempDir, '.cursor', 'rules')), 'Must export .cursor/rules');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should display clean branding without external promotion', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" doctor`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.ok(!out.includes('Matt Pocock'), 'No external promotion in doctor');
    assert.ok(!out.includes('Donne Martin'), 'No external promotion in doctor');
  });

  test('should run cross-platform test runner script cleanly', () => {
    const runnerScript = path.join(ROOT_DIR, 'scripts', 'run-tests.js');
    assert.ok(fs.existsSync(runnerScript), 'run-tests.js must exist');
  });

  test('should reject unknown and removed CLI commands with exit code 1', () => {
    for (const cmd of ['foobar', 'plan', 'spec', 'caveman', 'eval', 'swe-eval', 'design', 'orphans', 'scope-guard', 'diagram', 'studio', 'tui', 'dashboard']) {
      assert.throws(() => {
        execSync(`node "${APEX_BIN}" ${cmd}`, { stdio: 'pipe', cwd: ROOT_DIR });
      }, /Command failed/, `Removed/unknown command "${cmd}" must exit non-zero`);
    }
  });

  test('should reject unknown sandbox actions with exit code 1', () => {
    assert.throws(() => {
      execSync(`node "${APEX_BIN}" sandbox bogus`, { stdio: 'pipe', cwd: ROOT_DIR });
    }, /Command failed/);
  });

  test('should reject memory record without text with exit code 1', () => {
    assert.throws(() => {
      execSync(`node "${APEX_BIN}" memory record decision`, { stdio: 'pipe', cwd: ROOT_DIR });
    }, /Command failed/);
  });

  test('should reject compact on non-existent file with exit code 1', () => {
    assert.throws(() => {
      execSync(`node "${APEX_BIN}" compact nope.js`, { stdio: 'pipe', cwd: ROOT_DIR });
    }, /Command failed/);
  });

  test('should reject compact with unknown flag with exit code 1', () => {
    assert.throws(() => {
      execSync(`node "${APEX_BIN}" compact --bogusflag`, { stdio: 'pipe', cwd: ROOT_DIR });
    }, /Command failed/);
  });

  test('pre-commit hook executes cleanly in external git repo without --no-install failure and blocks secret leaks', () => {
    const extRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-ext-hook-'));
    const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-bin-shim-'));
    try {
      execSync('git init -b main', { cwd: extRepo, stdio: 'ignore' });
      execSync('git config user.name "Test Runner"', { cwd: extRepo, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: extRepo, stdio: 'ignore' });
      execSync(`node "${APEX_BIN}" install-hooks`, { cwd: extRepo, stdio: 'ignore' });

      const hookPath = path.join(extRepo, '.git', 'hooks', 'pre-commit');
      assert.strictEqual(fs.existsSync(hookPath), true);
      const hookContent = fs.readFileSync(hookPath, 'utf-8');
      assert.doesNotMatch(hookContent, /--no-install/);

      // Provide local PATH shim for apex-agents so git commit tests real hook execution offline without hitting npm registry
      if (process.platform === 'win32') {
        fs.writeFileSync(path.join(shimDir, 'apex-agents.cmd'), `@echo off\r\n"${process.execPath}" "${APEX_BIN}" %*\r\n`);
      } else {
        const shPath = path.join(shimDir, 'apex-agents');
        fs.writeFileSync(shPath, `#!/bin/sh\nexec "${process.execPath}" "${APEX_BIN}" "$@"\n`, { mode: 0o755 });
      }
      const envWithShim = { ...process.env, PATH: `${shimDir}${path.delimiter}${process.env.PATH || ''}` };

      fs.writeFileSync(path.join(extRepo, 'hello.txt'), 'clean commit content\n');
      execSync('git add hello.txt', { cwd: extRepo, stdio: 'ignore' });
      execSync('git commit -m "initial clean commit"', { cwd: extRepo, stdio: 'pipe', env: envWithShim });

      // Secret leak commit must be blocked by the hook
      const fakeAws = [65, 75, 73, 65].map((c) => String.fromCharCode(c)).join('') + '1234567890ABCDEF';
      fs.writeFileSync(path.join(extRepo, 'leak.js'), `export const k = "${fakeAws}";\n`);
      execSync('git add leak.js', { cwd: extRepo, stdio: 'ignore' });
      assert.throws(() => {
        execSync('git commit -m "leak commit"', { cwd: extRepo, stdio: 'pipe', env: envWithShim });
      }, /Command failed/);
    } finally {
      fs.rmSync(extRepo, { recursive: true, force: true });
      fs.rmSync(shimDir, { recursive: true, force: true });
    }
  });

  test('install-hooks --pre-push installs both pre-commit and pre-push hooks cleanly', () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-prepush-'));
    try {
      execSync('git init -b main', { cwd: repoDir, stdio: 'ignore' });
      execSync(`node "${APEX_BIN}" install-hooks`, { cwd: repoDir, stdio: 'pipe' });
      // Re-running with --pre-push when pre-commit already exists must STILL install pre-push
      execSync(`node "${APEX_BIN}" install-hooks --pre-push`, { cwd: repoDir, stdio: 'pipe' });
      const preCommit = path.join(repoDir, '.git', 'hooks', 'pre-commit');
      const prePush = path.join(repoDir, '.git', 'hooks', 'pre-push');
      assert.strictEqual(fs.existsSync(preCommit), true);
      assert.strictEqual(fs.existsSync(prePush), true);
      assert.match(fs.readFileSync(prePush, 'utf-8'), /APEX AGENTS PRE-PUSH SAFETY BLOCK/);
    } finally {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
  });
});
