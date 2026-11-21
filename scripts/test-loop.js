#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

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

export function detectTestRunner(projectDir = process.cwd()) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const hasBun = fs.existsSync(path.join(projectDir, 'bun.lockb')) || fs.existsSync(path.join(projectDir, 'bun.lock'));
      const hasPnpm = fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'));
      const hasYarn = fs.existsSync(path.join(projectDir, 'yarn.lock'));
      const runner = hasBun ? 'bun test' : (hasPnpm ? 'pnpm test' : (hasYarn ? 'yarn test' : 'npm test'));

      if (pkg.scripts?.['test:unit']) return hasBun ? 'bun run test:unit' : (hasPnpm ? 'pnpm run test:unit' : (hasYarn ? 'yarn run test:unit' : 'npm run test:unit'));
      if (pkg.scripts?.test) return runner;
    } catch {
      // fallback
    }
  }

  // Non-Node environments
  if (fs.existsSync(path.join(projectDir, 'Cargo.toml')) && !fs.existsSync(pkgPath)) {
    return 'cargo test';
  }
  if (fs.existsSync(path.join(projectDir, 'pytest.ini')) || (fs.existsSync(path.join(projectDir, 'pyproject.toml')) && !fs.existsSync(pkgPath))) {
    return 'pytest';
  }
  if (fs.existsSync(path.join(projectDir, 'go.mod')) && !fs.existsSync(pkgPath)) {
    return 'go test ./...';
  }

  // Fallbacks
  if (fs.existsSync(path.join(projectDir, 'vitest.config.ts')) || fs.existsSync(path.join(projectDir, 'vitest.config.js'))) {
    return 'npx vitest run';
  }
  if (fs.existsSync(path.join(projectDir, 'jest.config.js')) || fs.existsSync(path.join(projectDir, 'jest.config.ts'))) {
    return 'npx jest';
  }
  return 'npm test';
}

export function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Parses test output to extract failing suites, test names, errors, and files.
 */
export function parseTestFailures(output) {
  const rawFailures = [];
  const cleanOutput = stripAnsi(output);
  const lines = cleanOutput.split('\n');

  let currentFailure = null;
  let pendingFile = null;
  let pendingLine = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Skip summary lines and section headers from test reporters
    if (
      line.startsWith('ℹ') ||
      /^(?:Tests:|Suites:|Summary:)/i.test(line) ||
      /^✖\s*failing tests:?\s*$/i.test(line)
    ) {
      continue;
    }

    // Node --test detailed failure header: "test at greet.test.js:4:9"
    const nodeHeaderMatch = line.match(/^test at\s+(?:file:\/\/\/)?([a-zA-Z]:[\\/][^:\s]+|[^:\s]+\.(?:test|spec)\.[a-zA-Z0-9]+):(\d+)/i);
    if (nodeHeaderMatch) {
      pendingFile = nodeHeaderMatch[1];
      pendingLine = parseInt(nodeHeaderMatch[2], 10);
      continue;
    }

    // Detect failing test indicators (Jest / Vitest / Node test runner)
    const failMatch = line.match(/^(?:✖|FAIL\b|✕|not ok\b)\s+(.+)/i);
    if (failMatch) {
      if (currentFailure) rawFailures.push(currentFailure);
      currentFailure = {
        name: failMatch[1].trim(),
        file: pendingFile,
        ...(pendingLine ? { line: pendingLine } : {}),
        error: '',
        expected: null,
        actual: null,
        stack: []
      };
      pendingFile = null;
      pendingLine = null;
      continue;
    }

    // Detect file location (preserves Windows drive letters like C:\... and file:///C:/...)
    const fileMatch = line.length > 2048 ? null : line.match(/(?:at\s+|in\s+)?(?:file:\/\/\/)?([a-zA-Z]:[\\/][^\s:)]+?\.(?:test|spec)\.[a-zA-Z0-9]+|[^\s:()\\/]+(?:[\\/][^\s:()\\/]+)*?\.(?:test|spec)\.[a-zA-Z0-9]+)(?::(\d+))?/i);
    if (fileMatch && currentFailure && !currentFailure.file) {
      currentFailure.file = fileMatch[1];
      if (fileMatch[2]) currentFailure.line = parseInt(fileMatch[2], 10);
    }

    // Accumulate error details
    if (currentFailure) {
      if (line.includes('AssertionError') || line.includes('Error:') || line.includes('Expected') || line.includes('Received')) {
        currentFailure.error += line.trim() + '\n';
      }
      if (/^(?:expected|Expected):/i.test(line)) {
        currentFailure.expected = line.replace(/^(?:expected|Expected):\s*/i, '').trim();
      }
      if (/^(?:actual|actual value|received|Received):/i.test(line)) {
        currentFailure.actual = line.replace(/^(?:actual|actual value|received|Received):\s*/i, '').trim();
      }
      if (line.trim().startsWith('at ')) {
        currentFailure.stack.push(line.trim());
      }
    }
  }

  if (currentFailure) rawFailures.push(currentFailure);

  // Deduplicate summary lines vs detailed blocks with identical test names (common in node --test)
  const byName = new Map();
  const failures = [];
  for (const f of rawFailures) {
    const score = (f.file ? 2 : 0) + (f.error ? 2 : 0) + (f.stack.length > 0 ? 1 : 0);
    if (byName.has(f.name)) {
      const existingIdx = byName.get(f.name);
      const ex = failures[existingIdx];
      const exScore = (ex.file ? 2 : 0) + (ex.error ? 2 : 0) + (ex.stack.length > 0 ? 1 : 0);
      if (score > exScore) {
        failures[existingIdx] = f;
      }
    } else {
      byName.set(f.name, failures.length);
      failures.push(f);
    }
  }

  // If no specific parsed failure but non-zero, capture entire stderr/tail
  if (failures.length === 0) {
    const tailLines = lines.slice(-25).join('\n').trim();
    failures.push({
      name: 'Unspecified Test Suite Failure',
      file: 'Unknown',
      error: tailLines,
      stack: []
    });
  }

  return failures;
}

/**
 * Generates structured AVEYX_FIX_PROMPT.md for IDE coding agents (Cursor, Claude Code, Windsurf).
 */
export function generateFixPrompt(projectDir, failures, fullOutput) {
  const outputPath = path.join(projectDir, 'AVEYX_FIX_PROMPT.md');
  const timestamp = new Date().toISOString();

  let md = `# AVEYX: TEST FAILURE FIX PROMPT\n`;
  md += `> **Generated**: ${timestamp}\n`;
  md += `> **Target**: Zero-slop repair of failing implementation code.\n\n`;

  md += `## ⚠️ FAILURE SUMMARY (${failures.length} Issue${failures.length === 1 ? '' : 's'})\n\n`;

  failures.forEach((f, idx) => {
    md += `### ${idx + 1}. Failing Test: \`${f.name}\`\n`;
    if (f.file) md += `- **File**: \`${f.file}\`${f.line ? ` (Line ${f.line})` : ''}\n`;
    if (f.expected || f.actual) {
      md += `- **Expected vs Actual Comparison**:\n`;
      if (f.expected) md += `  - **Expected**: \`${f.expected}\`\n`;
      if (f.actual) md += `  - **Received / Actual**: \`${f.actual}\`\n`;
    }
    if (f.error) {
      md += `- **Assertion / Error**:\n\`\`\`text\n${f.error.trim()}\n\`\`\`\n`;
    }
    if (f.stack.length > 0) {
      md += `- **Stack Trace**:\n\`\`\`text\n${f.stack.slice(0, 5).join('\n')}\n\`\`\`\n`;
    }
    md += `\n`;
  });

  md += `## ⛔ STRICT NEGATIVE CONSTRAINTS (NO CHEATING)\n`;
  md += `1. **DO NOT** delete, disable, or comment out any failing test assertions.\n`;
  md += `2. **DO NOT** add \`it.only\`, \`test.skip\`, or dummy pass returns to fake success.\n`;
  md += `3. **DO NOT** weaken expectation bounds or change expected test values unless the test itself has an invalid specification.\n`;
  md += `4. **FIX** the actual implementation code in the target module.\n\n`;

  md += `## 🛠️ REQUIRED AGENT WORKFLOW\n`;
  md += `1. Inspect the failing test file and the implementation file.\n`;
  md += `2. Identify why the assertion failed (root cause analysis).\n`;
  md += `3. Modify the source code to satisfy the test contract.\n`;
  md += `4. Run \`npx aveyx test-loop\` to verify the fix.\n\n`;

  md += `## RAW TEST RUNNER TAIL\n`;
  md += `\`\`\`text\n${fullOutput.slice(-2000)}\n\`\`\`\n`;

  fs.writeFileSync(outputPath, md);
  return outputPath;
}

/**
 * Accurately distinguishes a missing test runner/script from genuine test failures.
 * Never false-positives on assertion errors like "user not found" or "Cannot find module".
 */
export function detectNoRunner(exitCode, stdout = '', stderr = '') {
  const combined = stripAnsi(`${stdout}\n${stderr}`);
  const cleanStderr = stripAnsi(stderr);

  // If any real test runner assertion, module error inside tests, or TAP/Jest/Vitest failure appeared,
  // a test runner definitely executed.
  if (/(?:AssertionError|ERR_ASSERTION|Cannot find module|ERR_MODULE_NOT_FOUND|\bFAIL\s+|\bPASS\s+|✖|✗|not ok \d+|Expected:|Received:)/i.test(combined)) {
    return false;
  }

  // POSIX exit code 127 = command not found
  if (exitCode === 127) return true;

  // Explicit npm / package.json missing test script errors
  if (/npm (?:ERR!|error) Missing script:|Error: no test specified|Could not read package\.json|ENOENT: no such file or directory, open ['"]?.*package\.json/i.test(combined)) {
    return true;
  }

  // Explicit shell binary-not-found errors on stderr
  if (/'[^']+' is not recognized as an internal or external command/i.test(cleanStderr)) return true;
  if (/^\/bin\/sh:\s*\d+:.*:\s*not found$/im.test(cleanStderr)) return true;
  if (/^[^:\n]+:\s*command not found$/im.test(cleanStderr)) return true;
  if (/is not recognized as the name of a cmdlet/i.test(cleanStderr)) return true;

  return false;
}

function runCommandCapture(projectDir, cmdStr, streamToConsole = false) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';
    const flag = isWindows ? '/c' : '-c';

    const childEnv = { ...process.env, FORCE_COLOR: '1' };
    delete childEnv.NODE_TEST_CONTEXT;

    const child = spawn(shell, [flag, cmdStr], {
      cwd: projectDir,
      stdio: 'pipe',
      env: childEnv
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      const str = chunk.toString();
      stdout += str;
      if (streamToConsole) process.stdout.write(str);
    });

    child.stderr.on('data', chunk => {
      const str = chunk.toString();
      stderr += str;
      if (streamToConsole) process.stderr.write(str);
    });

    child.on('close', code => {
      resolve({ code: code ?? 1, stdout, stderr });
    });

    child.on('error', err => reject(err));
  });
}

/**
 * Runs the deterministic test-loop runner and synthesizes structured fix prompts on failure.
 */
export async function runTestLoop(projectDir = process.cwd(), customCmd = null) {
  const cmdStr = customCmd || detectTestRunner(projectDir);
  console.log(`\n${c.cyan}${c.bold}═════ AVEYX: TEST-LOOP RUNNER ═════${c.reset}`);
  console.log(`Executing test suite: ${c.yellow}${cmdStr}${c.reset} in ${c.cyan}${projectDir}${c.reset}...\n`);

  const { code, stdout, stderr } = await runCommandCapture(projectDir, cmdStr, true);
  const fullOutput = stdout + '\n' + stderr;
  const promptPath = path.join(projectDir, 'AVEYX_FIX_PROMPT.md');

  if (code === 0) {
    console.log(`\n${c.green}${c.bold}✓ ALL TESTS PASSING! (Exit Code: 0)${c.reset}`);
    if (fs.existsSync(promptPath)) {
      fs.unlinkSync(promptPath);
    }
    return { success: true, code: 0 };
  }

  if (detectNoRunner(code, stdout, stderr)) {
    console.error(`\n${c.red}${c.bold}✖ NO TEST RUNNER CONFIGURED:${c.reset} No test script found or runner failed to launch.`);
    console.error(`Configure "scripts.test" in package.json or run with custom command: aveyx test-loop "<cmd>"\n`);
    return { success: false, code, failures: [], fixPromptFile: null };
  }

  console.log(`\n${c.red}${c.bold}✖ TESTS FAILED (Exit Code: ${code})${c.reset}`);
  console.log(`${c.yellow}Synthesizing failure traces into structured fix prompt...${c.reset}`);

  const failures = parseTestFailures(fullOutput);
  const fixPromptFile = generateFixPrompt(projectDir, failures, fullOutput);

  console.log(`  ${c.green}✓${c.reset} Generated Fix Prompt: ${c.cyan}${fixPromptFile}${c.reset}`);
  console.log(`\n${c.bold}Next Action:${c.reset} Feed ${c.cyan}AVEYX_FIX_PROMPT.md${c.reset} into Cursor, Claude Code, or Windsurf to repair implementation.\n`);
  return { success: false, code, failures, fixPromptFile };
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('test-loop.js')) {
  const args = process.argv.slice(2);
  if (args.length > 0 && args[0].startsWith('-')) {
    console.error(`${c.red}Unknown flag "${args[0]}".${c.reset}`);
    console.error(`Usage: npx aveyx test-loop [custom test command]`);
    process.exit(1);
  }
  const customCmd = args.length > 0 ? args.join(' ') : null;
  runTestLoop(process.cwd(), customCmd).then(res => {
    process.exit(res.success ? 0 : 1);
  });
}
