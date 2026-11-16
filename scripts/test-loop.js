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
  const failures = [];
  const cleanOutput = stripAnsi(output);
  const lines = cleanOutput.split('\n');

  let currentFailure = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Skip summary lines from test reporters
    if (line.startsWith('ℹ') || /^(?:Tests:|Suites:|Summary:)/i.test(line)) {
      continue;
    }

    // Detect failing test indicators (Jest / Vitest / Node test runner)
    const failMatch = line.match(/^(?:✖|FAIL\b|✕|not ok\b)\s+(.+)/i);
    if (failMatch) {
      if (currentFailure) failures.push(currentFailure);
      currentFailure = {
        name: failMatch[1].trim(),
        file: null,
        error: '',
        expected: null,
        actual: null,
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
  md += `1. Inspect the failing file and the implementation file.\n`;
  md += `2. Identify why the assertion failed (root cause analysis).\n`;
  md += `3. Modify the source code to satisfy the test contract.\n`;
  md += `4. Run \`npx apex-agents test-loop\` to verify the fix.\n\n`;

  md += `## RAW TEST RUNNER TAIL\n`;
  md += `\`\`\`text\n${fullOutput.slice(-2000)}\n\`\`\`\n`;

  fs.writeFileSync(outputPath, md);
  return outputPath;
}

export async function attemptAutoHeal(projectDir, failures, fullOutput) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !anthropicKey && !openaiKey) {
    console.log(`\n${c.yellow}ℹ [Autonomous Heal]: No LLM API key detected in environment (GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY).${c.reset}`);
    console.log(`  Falling back to deterministic APEX_FIX_PROMPT.md for developer agent handoff.\n`);
    return { healed: false, reason: 'NO_API_KEY' };
  }

  console.log(`\n${c.cyan}${c.bold}⚡ [Autonomous Heal Engine]: LLM credentials detected. Synthesizing zero-slop repair patch...${c.reset}`);

  const failingFile = failures[0]?.file;
  if (!failingFile || !fs.existsSync(path.join(projectDir, failingFile))) {
    console.log(`  ${c.yellow}! Target failing source file not found for auto-repair: ${failingFile || 'unknown'}${c.reset}\n`);
    return { healed: false, reason: 'TARGET_FILE_NOT_FOUND' };
  }

  const targetPath = path.join(projectDir, failingFile);
  const fileContent = fs.readFileSync(targetPath, 'utf-8');
  const failureError = failures[0]?.error || 'Unknown assertion failure';

  const prompt = [
    `You are an elite software engineer executing an autonomous test fix loop.`,
    `STRICT RULE: Fix the bug in the target file so tests pass. DO NOT delete, disable, or weaken test assertions.`,
    `Test failure error:`,
    failureError,
    `Failing File: ${failingFile}`,
    `Source Code:`,
    fileContent,
    `Output ONLY the full fixed file content inside a single code block (\`\`\`ts or \`\`\`js). No preamble.`
  ].join('\n\n');

  try {
    let fixedCode = null;

    if (geminiKey) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const codeMatch = rawText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```/);
      fixedCode = codeMatch ? codeMatch[1] : rawText.trim();
    } else if (anthropicKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      const rawText = data.content?.[0]?.text || '';
      const codeMatch = rawText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```/);
      fixedCode = codeMatch ? codeMatch[1] : rawText.trim();
    } else if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || '';
      const codeMatch = rawText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```/);
      fixedCode = codeMatch ? codeMatch[1] : rawText.trim();
    }

    if (fixedCode && fixedCode.trim().length > 0) {
      fs.writeFileSync(targetPath, fixedCode);
      console.log(`  ${c.green}✓${c.reset} Applied autonomous repair patch to: ${c.cyan}${failingFile}${c.reset}\n`);
      return { healed: true, file: failingFile };
    }
  } catch (err) {
    console.error(`  ${c.red}! Auto-heal network call failed: ${err.message}${c.reset}\n`);
  }

  return { healed: false, reason: 'HEAL_ATTEMPT_FAILED' };
}

/**
 * Runs the self-healing test loop.
 */
export function runTestLoop(projectDir = process.cwd(), customCmd = null, options = {}) {
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
        const isNoRunner = /Missing script|no test specified|ENOENT.*package\.json|command not found|cannot find|not recognized|:\s*not found|\bnot found\b|No such file or directory/i.test(fullOutput);
        if (isNoRunner) {
          console.error(`\n${c.red}${c.bold}✖ NO TEST RUNNER CONFIGURED:${c.reset} No test script found or runner failed to launch.`);
          console.error(`Configure "scripts.test" in package.json or run with custom command: apex test-loop "<cmd>"\n`);
          resolve({ success: false, code, failures: [], fixPromptFile: null });
          return;
        }

        console.log(`\n${c.red}${c.bold}✖ TESTS FAILED (Exit Code: ${code})${c.reset}`);
        console.log(`${c.yellow}Synthesizing failure traces into autonomous agent fix prompt...${c.reset}`);

        const failures = parseTestFailures(fullOutput);
        const fixPromptFile = generateFixPrompt(projectDir, failures, fullOutput);

        console.log(`  ${c.green}✓${c.reset} Generated AI Fix Prompt: ${c.cyan}${fixPromptFile}${c.reset}`);

        const shouldHeal = options.heal || process.argv.includes('--heal');
        if (shouldHeal) {
          attemptAutoHeal(projectDir, failures, fullOutput).then(healRes => {
            console.log(`${c.bold}Next Action:${c.reset} Review ${c.cyan}APEX_FIX_PROMPT.md${c.reset} or inspect automated heal patch.\n`);
            resolve({ success: false, code, failures, fixPromptFile, autoHeal: healRes });
          });
          return;
        }

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
