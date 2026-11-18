#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { auditDiff } from './audit-diff.js';
import { createCheckpoint } from './checkpoint.js';

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

  let md = `# APEX AGENTS: TEST FAILURE FIX PROMPT\n`;
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
 * Ironclad guard: returns true if a path belongs to a test suite or spec file.
 * Auto-heal is strictly forbidden from ever modifying test files.
 */
export function isTestFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const normalized = filePath.replace(/\\/g, '/');
  return (
    /\.(test|spec)\.[a-zA-Z0-9]+$/i.test(normalized) ||
    /(?:^|\/)(?:__tests__|tests|test)\//i.test(normalized)
  );
}

function isSafeImplementationFile(projectDir, candidatePath) {
  if (!candidatePath) return false;
  const resolvedRoot = path.resolve(projectDir);
  const resolvedTarget = path.resolve(candidatePath);
  if (!resolvedTarget.startsWith(resolvedRoot + path.sep) && resolvedTarget !== resolvedRoot) {
    return false;
  }
  const normalized = resolvedTarget.replace(/\\/g, '/');
  if (normalized.includes('/node_modules/') || normalized.includes('/.git/')) return false;
  if (isTestFile(resolvedTarget)) return false;
  try {
    return fs.existsSync(resolvedTarget) && fs.statSync(resolvedTarget).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolves a real, non-test implementation source file from failure traces or test imports.
 * Never returns a test file.
 */
export function resolveImplementationTarget(projectDir, failures, fullOutput = '') {
  if (!failures || failures.length === 0) return null;
  const failure = failures[0];

  // 1. Scan stack frames for the first local non-test source file
  const stackLines = [
    ...(Array.isArray(failure.stack) ? failure.stack : []),
    ...stripAnsi(fullOutput).split('\n').filter(l => /\bat\s+/.test(l))
  ];

  for (const line of stackLines) {
    const match = line.match(/(?:file:\/\/\/)?([a-zA-Z]:[\\/][^:)\s]+|(?:\.{0,2}[\\/])?[a-zA-Z0-9_.\-\\/]+\.(?:js|jsx|ts|tsx|mjs|cjs|py|go|rs))(?::\d+)?/i);
    if (!match) continue;
    let rawFile = match[1];
    const candidate = path.isAbsolute(rawFile) ? rawFile : path.join(projectDir, rawFile);
    if (isSafeImplementationFile(projectDir, candidate)) {
      return {
        targetPath: path.resolve(candidate),
        relPath: path.relative(projectDir, candidate).replace(/\\/g, '/'),
        testFilePath: failure.file && isTestFile(failure.file)
          ? (path.isAbsolute(failure.file) ? failure.file : path.join(projectDir, failure.file))
          : null
      };
    }
  }

  // 2. If failure.file itself is explicitly a non-test implementation file
  if (failure.file) {
    const candidate = path.isAbsolute(failure.file) ? failure.file : path.join(projectDir, failure.file);
    if (isSafeImplementationFile(projectDir, candidate)) {
      return {
        targetPath: path.resolve(candidate),
        relPath: path.relative(projectDir, candidate).replace(/\\/g, '/'),
        testFilePath: null
      };
    }

    // 3. If failure.file is a test file, inspect its local relative imports read-only
    //    and accept ONLY if there is an unambiguous single local implementation target.
    if (isTestFile(candidate) && fs.existsSync(candidate)) {
      try {
        const testSrc = fs.readFileSync(candidate, 'utf-8');
        const importRegex = /(?:import\s+[\s\S]*?\s+from\s+|require\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g;
        const candidates = new Set();
        const exts = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
        let m;
        while ((m = importRegex.exec(testSrc)) !== null) {
          const base = path.resolve(path.dirname(candidate), m[1]);
          for (const ext of exts) {
            const p = base + ext;
            if (isSafeImplementationFile(projectDir, p)) {
              candidates.add(p);
              break;
            }
          }
        }
        if (candidates.size === 1) {
          const resolved = [...candidates][0];
          return {
            targetPath: resolved,
            relPath: path.relative(projectDir, resolved).replace(/\\/g, '/'),
            testFilePath: path.resolve(candidate)
          };
        }
      } catch {
        // ignore read error
      }
    }
  }

  return null;
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

function synthesizeUnifiedDiff(relFile, originalContent, patchedContent) {
  const origLines = originalContent.split('\n');
  const newLines = patchedContent.split('\n');
  const lines = [
    `diff --git a/${relFile} b/${relFile}`,
    `--- a/${relFile}`,
    `+++ b/${relFile}`,
    `@@ -1,${origLines.length} +1,${newLines.length} @@`
  ];
  origLines.forEach(l => lines.push(`-${l}`));
  newLines.forEach(l => lines.push(`+${l}`));
  return lines.join('\n');
}

function extractCodeFromResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const codeMatch = rawText.match(/```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)\r?\n```/);
  return (codeMatch ? codeMatch[1] : rawText).trim();
}

/**
 * Transactional patch gate:
 * 1. Enforces test-file immutability (never edits test files).
 * 2. Audits proposed patch via auditDiff() for secrets, slop, or tampering BEFORE writing.
 * 3. Creates a pre-patch checkpoint (git checkpoint if in git repo + atomic in-memory backup).
 * 4. Writes patch, re-runs the test suite, and automatically rolls back if tests still fail.
 */
async function applyAndVerifyPatch(projectDir, target, patchedContent, testCmd, method) {
  if (isTestFile(target.targetPath) || isTestFile(target.relPath)) {
    return { healed: false, reason: 'TEST_FILE_PROTECTED' };
  }

  const originalContent = fs.readFileSync(target.targetPath, 'utf-8');
  if (!patchedContent || patchedContent.trim() === originalContent.trim()) {
    return { healed: false, reason: 'NO_EFFECTIVE_CHANGE' };
  }

  // Gate 1: Run diff security & anti-slop auditor before accepting patch
  const syntheticDiff = synthesizeUnifiedDiff(target.relPath, originalContent, patchedContent);
  const diffAudit = auditDiff(syntheticDiff);
  if (!diffAudit.clean) {
    console.log(`  ${c.red}✖${c.reset} Patch rejected by zero-slop diff auditor (${diffAudit.stats.secrets} secrets, ${diffAudit.stats.tampering} tamper, ${diffAudit.stats.slop} slop). Original file untouched.\n`);
    return { healed: false, reason: 'REJECTED_BY_DIFF_AUDITOR', findings: diffAudit.findings };
  }

  // Gate 2: Pre-patch checkpoint (git checkpoint if repo exists + atomic backup)
  let checkpointId = null;
  if (fs.existsSync(path.join(projectDir, '.git'))) {
    try {
      const cp = createCheckpoint(`pre-heal-${path.basename(target.relPath)}`, projectDir);
      checkpointId = cp?.id || null;
    } catch {
      // Proceed with atomic in-memory backup
    }
  }

  // Gate 3: Apply patch and re-run test suite to verify real fix
  try {
    fs.writeFileSync(target.targetPath, patchedContent);
    const verifyCmd = testCmd || detectTestRunner(projectDir);
    const verifyRun = await runCommandCapture(projectDir, verifyCmd, false);

    if (verifyRun.code === 0) {
      console.log(`  ${c.green}✓${c.reset} Verified ${method} repair patch on ${c.cyan}${target.relPath}${c.reset} (re-test exited 0).\n`);
      return { healed: true, method, file: target.relPath, verified: true, checkpointId };
    }

    // Tests still failed -> immediate atomic rollback
    fs.writeFileSync(target.targetPath, originalContent);
    console.log(`  ${c.yellow}↩${c.reset} Patch on ${c.cyan}${target.relPath}${c.reset} failed verification (exit ${verifyRun.code}). Rolled back cleanly.\n`);
    return { healed: false, reason: 'ROLLBACK_TEST_VERIFICATION_FAILED', file: target.relPath, checkpointId };
  } catch (err) {
    // Rollback on any unexpected runtime error
    fs.writeFileSync(target.targetPath, originalContent);
    return { healed: false, reason: 'ROLLBACK_RUNTIME_ERROR', error: err.message };
  }
}

export async function attemptAutoHeal(projectDir, failures, fullOutput, options = {}) {
  if (!failures || failures.length === 0) {
    return { healed: false, reason: 'NO_FAILURES' };
  }

  console.log(`\n${c.cyan}${c.bold}⚡ [Test-Loop Repair Engine]: Analyzing failure traces...${c.reset}`);

  // Ironclad target resolution: NEVER edit test files
  const target = resolveImplementationTarget(projectDir, failures, fullOutput);
  if (!target) {
    const rawFile = failures[0]?.file;
    if (rawFile && isTestFile(rawFile)) {
      console.log(`  ${c.yellow}ℹ [Test-File Guard]: Refusing to modify test file (${rawFile}).${c.reset}`);
      console.log(`  No unambiguous implementation file resolved. Delegating to ${c.cyan}APEX_FIX_PROMPT.md${c.reset}.\n`);
      return { healed: false, reason: 'TEST_FILE_PROTECTED_DELEGATED_TO_IDE' };
    }
    console.log(`  ${c.yellow}ℹ Target implementation file not resolved (${rawFile || 'unknown'}). Delegating to APEX_FIX_PROMPT.md.${c.reset}\n`);
    return { healed: false, reason: 'TARGET_FILE_NOT_FOUND' };
  }

  const fileContent = fs.readFileSync(target.targetPath, 'utf-8');
  const failureError = failures[0]?.error || 'Unknown assertion failure';
  let testContextSnippet = '';
  if (target.testFilePath && fs.existsSync(target.testFilePath)) {
    try {
      testContextSnippet = fs.readFileSync(target.testFilePath, 'utf-8').slice(0, 3000);
    } catch {
      // ignore
    }
  }

  const prompt = [
    `You are a senior software engineer fixing a failing unit test.`,
    `STRICT RULES:`,
    `1. Fix the bug ONLY in the implementation file below (${target.relPath}).`,
    `2. NEVER emit placeholders, TODO stubs, or untyped 'any' shortcuts.`,
    `3. Output ONLY the complete fixed implementation file inside a single fenced code block. No prose.`,
    `Failure Output:\n${failureError}`,
    testContextSnippet ? `Read-Only Failing Test Specification:\n${testContextSnippet}` : '',
    `Implementation File (${target.relPath}):\n${fileContent}`
  ].filter(Boolean).join('\n\n');

  const testCmd = options.testCmd || null;

  // Tier 1: Local Ollama (0 API Key / 100% Offline, Two-Stage Timeout)
  const ollamaHost = (options.ollamaHost || process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
  const probeTimeoutMs = options.ollamaProbeTimeoutMs || 1500;
  const genTimeoutMs = options.ollamaTimeoutMs || 120000;

  try {
    // Stage 1: Fast liveness probe (1.5s)
    const probeController = new AbortController();
    const probeTimer = setTimeout(() => probeController.abort(), probeTimeoutMs);
    const tagsRes = await fetch(`${ollamaHost}/api/tags`, {
      method: 'GET',
      signal: probeController.signal
    });
    clearTimeout(probeTimer);

    if (tagsRes.ok) {
      const tagsData = await tagsRes.json().catch(() => ({}));
      const installedModels = Array.isArray(tagsData.models) ? tagsData.models.map(m => m.name) : [];
      const preferredModel = options.ollamaModel ||
        process.env.OLLAMA_MODEL ||
        installedModels.find(n => /qwen2\.5-coder|deepseek-coder|codellama/i.test(n)) ||
        installedModels[0] ||
        'qwen2.5-coder:latest';

      // Stage 2: Full generation timeout (default 120s)
      const genController = new AbortController();
      const genTimer = setTimeout(() => genController.abort(), genTimeoutMs);
      const genRes = await fetch(`${ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: preferredModel,
          prompt,
          stream: false
        }),
        signal: genController.signal
      });
      clearTimeout(genTimer);

      if (genRes.ok) {
        const data = await genRes.json();
        const fixedCode = extractCodeFromResponse(data.response || '');
        if (fixedCode) {
          const verifiedRes = await applyAndVerifyPatch(projectDir, target, fixedCode, testCmd, `LOCAL_OLLAMA (${preferredModel})`);
          if (verifiedRes.healed) return verifiedRes;
          return verifiedRes;
        }
      }
    }
  } catch {
    // Local Ollama not running or unreachable; fall through cleanly
  }

  // Tier 2: Optional Cloud LLM API (Only if user explicitly provides keys in env)
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey || anthropicKey || openaiKey) {
    try {
      let rawText = '';

      if (geminiKey) {
        const model = process.env.APEX_GEMINI_MODEL || 'gemini-2.0-flash';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (anthropicKey) {
        const model = process.env.APEX_ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await res.json();
        rawText = data.content?.[0]?.text || '';
      } else if (openaiKey) {
        const model = process.env.APEX_OPENAI_MODEL || 'gpt-4o';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await res.json();
        rawText = data.choices?.[0]?.message?.content || '';
      }

      const fixedCode = extractCodeFromResponse(rawText);
      if (fixedCode) {
        return await applyAndVerifyPatch(projectDir, target, fixedCode, testCmd, 'CLOUD_API');
      }
    } catch (err) {
      console.error(`  ${c.yellow}! Optional cloud heal request failed: ${err.message}${c.reset}\n`);
    }
  }

  // Tier 3: Zero-Paid-API IDE Agent Handoff
  console.log(`  ${c.yellow}ℹ [Zero-Paid-API Mode]: No local Ollama instance or optional cloud key active.${c.reset}`);
  console.log(`  Handoff ready in ${c.cyan}APEX_FIX_PROMPT.md${c.reset} for your active IDE agent (Cursor / Claude Code / Windsurf).\n`);
  return { healed: false, reason: 'DELEGATED_TO_IDE_AGENT' };
}

/**
 * Runs the test-loop runner and synthesizes structured fix prompts on failure.
 */
export async function runTestLoop(projectDir = process.cwd(), customCmd = null, options = {}) {
  const cmdStr = customCmd || detectTestRunner(projectDir);
  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: TEST-LOOP RUNNER ═════${c.reset}`);
  console.log(`Executing test suite: ${c.yellow}${cmdStr}${c.reset} in ${c.cyan}${projectDir}${c.reset}...\n`);

  const { code, stdout, stderr } = await runCommandCapture(projectDir, cmdStr, true);
  const fullOutput = stdout + '\n' + stderr;
  const promptPath = path.join(projectDir, 'APEX_FIX_PROMPT.md');

  if (code === 0) {
    console.log(`\n${c.green}${c.bold}✓ ALL TESTS PASSING! (Exit Code: 0)${c.reset}`);
    if (fs.existsSync(promptPath)) {
      fs.unlinkSync(promptPath);
    }
    return { success: true, code: 0 };
  }

  if (detectNoRunner(code, stdout, stderr)) {
    console.error(`\n${c.red}${c.bold}✖ NO TEST RUNNER CONFIGURED:${c.reset} No test script found or runner failed to launch.`);
    console.error(`Configure "scripts.test" in package.json or run with custom command: apex test-loop "<cmd>"\n`);
    return { success: false, code, failures: [], fixPromptFile: null };
  }

  console.log(`\n${c.red}${c.bold}✖ TESTS FAILED (Exit Code: ${code})${c.reset}`);
  console.log(`${c.yellow}Synthesizing failure traces into structured fix prompt...${c.reset}`);

  const failures = parseTestFailures(fullOutput);
  const fixPromptFile = generateFixPrompt(projectDir, failures, fullOutput);

  console.log(`  ${c.green}✓${c.reset} Generated Fix Prompt: ${c.cyan}${fixPromptFile}${c.reset}`);

  const shouldHeal = options.heal || process.argv.includes('--heal');
  if (shouldHeal) {
    const healRes = await attemptAutoHeal(projectDir, failures, fullOutput, {
      ...options,
      testCmd: cmdStr
    });
    if (healRes.healed && healRes.verified) {
      if (fs.existsSync(promptPath)) {
        fs.unlinkSync(promptPath);
      }
      return { success: true, code: 0, failures, fixPromptFile: null, autoHeal: healRes };
    }
    console.log(`${c.bold}Next Action:${c.reset} Feed ${c.cyan}APEX_FIX_PROMPT.md${c.reset} to your active IDE agent.\n`);
    return { success: false, code, failures, fixPromptFile, autoHeal: healRes };
  }

  console.log(`\n${c.bold}Next Action:${c.reset} Feed ${c.cyan}APEX_FIX_PROMPT.md${c.reset} into Cursor or Claude Code to repair implementation.\n`);
  return { success: false, code, failures, fixPromptFile };
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('test-loop.js')) {
  const args = process.argv.slice(2);
  const customCmd = args.find(a => !a.startsWith('--'));
  runTestLoop(process.cwd(), customCmd).then(res => {
    process.exit(res.success ? 0 : 1);
  });
}
