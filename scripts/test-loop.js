#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

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
      if (pkg.scripts?.['test:unit']) return 'npm run test:unit';
      if (pkg.scripts?.test) return 'npm test';
    } catch {
      // fallback
    }
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

/**
 * Parses test output to extract failing suites, test names, errors, and files.
 */
export function parseTestFailures(output) {
  const failures = [];
  const lines = output.split('\n');

  let currentFailure = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip summary lines from test reporters
    if (line.trim().startsWith('ℹ') || /^(?:Tests:|Suites:|Summary:)/i.test(line.trim())) {
      continue;
    }

    // Detect failing test indicators (Jest / Vitest / Node test runner)
    const failMatch = line.match(/^\s*(?:✖|FAIL\b|✕|not ok\b)\s+(.+)/i);
    if (failMatch) {
      if (currentFailure) failures.push(currentFailure);
      currentFailure = {
        name: failMatch[1].trim(),
        file: null,
        error: '',
        stack: []
      };
      continue;
    }

    // Detect file location
    const fileMatch = line.match(/(?:at\s+|in\s+)?([a-zA-Z0-9_\-\\/.]+\.(?:test|spec)\.[a-zA-Z0-9]+):?(\d+)?/i);
    if (fileMatch && currentFailure && !currentFailure.file) {
      currentFailure.file = fileMatch[1];
      if (fileMatch[2]) currentFailure.line = parseInt(fileMatch[2], 10);
    }

    // Accumulate error details
    if (currentFailure) {
      if (line.includes('AssertionError') || line.includes('Error:') || line.includes('Expected') || line.includes('Received')) {
        currentFailure.error += line.trim() + '\n';
      }
      if (line.trim().startsWith('at ')) {
        currentFailure.stack.push(line.trim());
      }
    }
  }

  if (currentFailure) failures.push(currentFailure);

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
 * Generates structured APEX_FIX_PROMPT.md for AI agents.
 */
export function generateFixPrompt(projectDir, failures, fullOutput) {
  const outputPath = path.join(projectDir, 'APEX_FIX_PROMPT.md');
  const timestamp = new Date().toISOString();

  let md = `# APEX AGENTS: AUTONOMOUS TEST FAILURE FIX PROMPT\n`;
  md += `> **Generated**: ${timestamp}\n`;
  md += `> **Target**: Immediate zero-slop repair of failing test assertions.\n\n`;

  md += `## ⚠️ FAILURE SUMMARY (${failures.length} Issue${failures.length === 1 ? '' : 's'})\n\n`;

  failures.forEach((f, idx) => {
    md += `### ${idx + 1}. Failing Test: \`${f.name}\`\n`;
    if (f.file) md += `- **File**: \`${f.file}\`${f.line ? ` (Line ${f.line})` : ''}\n`;
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
  md += `1. Inspect the failing file and the implementation file.\n`;
  md += `2. Identify why the assertion failed (root cause analysis).\n`;
  md += `3. Modify the source code to satisfy the test contract.\n`;
  md += `4. Run \`npx apex-agents test-loop\` to verify the fix.\n\n`;

  md += `## RAW TEST RUNNER TAIL\n`;
  md += `\`\`\`text\n${fullOutput.slice(-2000)}\n\`\`\`\n`;

  fs.writeFileSync(outputPath, md);
  return outputPath;
}

/**
 * Runs the self-healing test loop.
 */
export function runTestLoop(projectDir = process.cwd(), customCmd = null) {
  return new Promise((resolve, reject) => {
    const cmdStr = customCmd || detectTestRunner(projectDir);
    console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: AUTONOMOUS TEST-LOOP RUNNER ═════${c.reset}`);
    console.log(`Executing test suite: ${c.yellow}${cmdStr}${c.reset} in ${c.cyan}${projectDir}${c.reset}...\n`);

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';
    const flag = isWindows ? '/c' : '-c';

    const child = spawn(shell, [flag, cmdStr], {
      cwd: projectDir,
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      const str = chunk.toString();
      stdout += str;
      process.stdout.write(str);
    });

    child.stderr.on('data', chunk => {
      const str = chunk.toString();
      stderr += str;
      process.stderr.write(str);
    });

    child.on('close', code => {
      const fullOutput = stdout + '\n' + stderr;
      const promptPath = path.join(projectDir, 'APEX_FIX_PROMPT.md');

      if (code === 0) {
        console.log(`\n${c.green}${c.bold}✓ ALL TESTS PASSING! (100% Zero-Slop Verified)${c.reset}`);
        if (fs.existsSync(promptPath)) {
          fs.unlinkSync(promptPath);
        }
        resolve({ success: true, code: 0 });
      } else {
        console.log(`\n${c.red}${c.bold}✖ TESTS FAILED (Exit Code: ${code})${c.reset}`);
        console.log(`${c.yellow}Synthesizing failure traces into autonomous agent fix prompt...${c.reset}`);

        const failures = parseTestFailures(fullOutput);
        const fixPromptFile = generateFixPrompt(projectDir, failures, fullOutput);

        console.log(`  ${c.green}✓${c.reset} Generated AI Fix Prompt: ${c.cyan}${fixPromptFile}${c.reset}`);
        console.log(`\n${c.bold}Next Action:${c.reset} Feed ${c.cyan}APEX_FIX_PROMPT.md${c.reset} into Cursor or Claude Code to auto-repair implementation.\n`);
        resolve({ success: false, code, failures, fixPromptFile });
      }
    });

    child.on('error', err => {
      console.error(`${c.red}Failed to execute test command:${c.reset}`, err.message);
      reject(err);
    });
  });
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('test-loop.js')) {
  const args = process.argv.slice(2);
  const customCmd = args.find(a => !a.startsWith('--'));
  runTestLoop(process.cwd(), customCmd).then(res => {
    process.exit(res.success ? 0 : 1);
  });
}
