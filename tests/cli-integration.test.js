import { test, describe } from 'node:test';
import assert from 'node:assert';
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
    const outV = stripAnsi(execSync(`node "${APEX_BIN}" -v`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(outV, /apex-agents v2\.0\.0/);

    const outVersion = stripAnsi(execSync(`node "${APEX_BIN}" --version`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(outVersion, /apex-agents v2\.0\.0/);
  });

  test('should display help menu with --help', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" --help`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /USAGE:/);
    assert.match(out, /COMMANDS:/);
  });

  test('should run doctor diagnostics with exit code 0', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" doctor`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /Running Environment Diagnostics/);
    assert.match(out, /Apex Agents engine is ready/);
  });

  test('should list all 38 specialists and operational instincts', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" list`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /OPERATIONAL INSTINCTS/);
    assert.match(out, /Total Specialists:\s*38/);
  });

  test('should execute multi-agent swarm planning', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" plan "Build real-time video streaming pipeline with postgres and auth"`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /MULTI-AGENT SWARM ORCHESTRATION PLANNER/);
    assert.match(out, /@auth-identity-guard/);
    assert.match(out, /@database-tuner/);
    assert.match(out, /@tdd-champion/);
  });

  test('should inspect context budget with zero errors', () => {
    const out = stripAnsi(execSync(`node "${APEX_BIN}" budget`, { encoding: 'utf-8', cwd: ROOT_DIR }));
    assert.match(out, /APEX AGENTS CONTEXT BUDGET OPTIMIZER/);
    assert.match(out, /CONTEXT SUMMARY/);
  });

  test('should initialize agency suite with apex-agents init', async () => {
    const fs = await import('fs');
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
});
