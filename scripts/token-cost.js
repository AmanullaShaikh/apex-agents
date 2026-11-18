#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import {
  compactSourceCode,
  compactPythonCode,
  compactGoCode,
  compactRustCode
} from './compact-context.js';

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

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.agents',
  '.worktrees'
]);

function getSourceFiles(dir, visited = new Set()) {
  let results = [];
  try {
    const realDir = fs.realpathSync(dir);
    if (visited.has(realDir)) return results;
    visited.add(realDir);

    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          const target = fs.realpathSync(fullPath);
          if (visited.has(target)) continue;
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            results = results.concat(getSourceFiles(fullPath, visited));
          } else if (stat.isFile() && /\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|json|md)$/.test(entry.name)) {
            visited.add(target);
            results.push(fullPath);
          }
        } catch {
          continue;
        }
      } else if (entry.isDirectory()) {
        results = results.concat(getSourceFiles(fullPath, visited));
      } else if (entry.isFile() && /\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|json|md)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return results;
}

/**
 * Subword Regex Tokenizer Pattern (Heuristic Approximation based on cl100k/o200k regex split rules)
 * Splits text by words, contractions, numbers (1-3 digits), symbols, and whitespace.
 * Provides a fast local token approximation without requiring external binary merge tables.
 */
const BPE_TOKEN_REGEX = /'s|'t|'re|'ve|'m|'ll|'d|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;

/**
 * Tokenizes text using subword regex decomposition (heuristic approximation).
 */
export function countBpeTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const matches = text.match(BPE_TOKEN_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Estimates token counts for code and prose.
 * Accepts either numeric character counts or raw string text.
 */
export function estimateTokens(input) {
  if (typeof input === 'number') {
    if (input <= 0) return 0;
    return Math.ceil(input / 3.8);
  }
  if (!input || typeof input !== 'string') return 0;
  return countBpeTokens(input);
}

function compactByExtension(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(ext)) return compactSourceCode(content);
    if (ext === '.py') return compactPythonCode(content);
    if (ext === '.go') return compactGoCode(content);
    if (ext === '.rs') return compactRustCode(content);
  } catch {
    // fall back to raw content if parser fails on malformed syntax
  }
  return content;
}

/**
 * Computes repository token volume, real measured AST compaction savings,
 * and optional user-supplied dollar cost estimates (--price-in=<$/1M>).
 */
export function computeTokenCost(projectDir = process.cwd(), options = {}) {
  const files = getSourceFiles(projectDir);
  let totalBytes = 0;
  let totalTokens = 0;
  let compactedCodeTokens = 0;
  let rawCodeTokens = 0;
  const fileBreakdown = [];

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (stat.size > 500 * 1024) continue;
      const content = fs.readFileSync(file, 'utf-8');
      totalBytes += stat.size;
      const tokens = countBpeTokens(content);
      totalTokens += tokens;

      const isCode = /\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs)$/.test(file);
      let compactedTokens = tokens;
      if (isCode) {
        const compacted = compactByExtension(file, content);
        compactedTokens = countBpeTokens(compacted);
        rawCodeTokens += tokens;
        compactedCodeTokens += compactedTokens;
      }

      fileBreakdown.push({
        file: path.relative(projectDir, file).replace(/\\/g, '/'),
        bytes: stat.size,
        tokens,
        compactedTokens
      });
    } catch {
      // ignore unreadable files
    }
  }

  const codeSavingsPercent = rawCodeTokens > 0
    ? Number((((rawCodeTokens - compactedCodeTokens) / rawCodeTokens) * 100).toFixed(1))
    : 0;

  const priceIn = typeof options.priceInPerMillion === 'number' && Number.isFinite(options.priceInPerMillion) && options.priceInPerMillion >= 0
    ? options.priceInPerMillion
    : null;

  let customCost = null;
  if (priceIn !== null) {
    const rawPerLoad = (totalTokens / 1000000) * priceIn;
    const rawCodePerLoad = (rawCodeTokens / 1000000) * priceIn;
    const compactedCodePerLoad = (compactedCodeTokens / 1000000) * priceIn;
    customCost = {
      priceInPerMillion: priceIn,
      rawRepoCostPerLoad: Number(rawPerLoad.toFixed(4)),
      rawCodeCostPerLoad: Number(rawCodePerLoad.toFixed(4)),
      compactedCodeCostPerLoad: Number(compactedCodePerLoad.toFixed(4)),
      savingsTenTurns: Number(((rawCodePerLoad - compactedCodePerLoad) * 10).toFixed(4))
    };
  }

  return {
    scannedFiles: files.length,
    totalBytes,
    totalTokens,
    rawCodeTokens,
    compactedCodeTokens,
    codeSavingsPercent,
    customCost,
    topFiles: fileBreakdown.sort((a, b) => b.tokens - a.tokens).slice(0, 5)
  };
}

// Strict numeric price parser (rejects trailing garbage like "2abc", "Infinity", negative values, or empty strings)
function parseStrictPrice(rawVal) {
  if (typeof rawVal !== 'string') return null;
  const trimmed = rawVal.trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('token-cost.js')) {
  const args = process.argv.slice(2);
  let priceInPerMillion = null;
  let projectDir = process.cwd();
  let explicitDir = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--price-in=')) {
      const val = parseStrictPrice(arg.slice('--price-in='.length));
      if (val === null) {
        console.error(`${c.red}Invalid --price-in value: ${arg} (expected a non-negative finite number, e.g. --price-in=2.00)${c.reset}`);
        process.exit(1);
      }
      priceInPerMillion = val;
    } else if (arg === '--price-in') {
      const nextVal = args[i + 1];
      const val = parseStrictPrice(nextVal);
      if (val === null) {
        console.error(`${c.red}Invalid --price-in value: ${nextVal ?? '(missing)'} (expected a non-negative finite number, e.g. --price-in 2.00)${c.reset}`);
        process.exit(1);
      }
      priceInPerMillion = val;
      i++;
    } else if (arg.startsWith('-')) {
      console.error(`${c.red}Unknown flag: ${arg}${c.reset}\nUsage: npx apex-agents cost [dir] [--price-in=<dollars_per_1M>]`);
      process.exit(1);
    } else if (!explicitDir) {
      projectDir = arg;
      explicitDir = true;
    } else {
      console.error(`${c.red}Unexpected positional argument: ${arg}${c.reset}`);
      process.exit(1);
    }
  }

  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    console.error(`${c.red}Directory not found or not a directory: ${projectDir}${c.reset}`);
    process.exit(1);
  }

  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: TOKEN VOLUME & AST COMPACTION AUDITOR ═════${c.reset}`);
  console.log(`Analyzing repository: ${c.yellow}${projectDir}${c.reset}...\n`);

  const report = computeTokenCost(projectDir, { priceInPerMillion });

  console.log(`  Scanned Files       : ${c.bold}${report.scannedFiles}${c.reset}`);
  console.log(`  Total Token Volume  : ${c.yellow}${c.bold}${report.totalTokens.toLocaleString()} tokens${c.reset} (~${(report.totalBytes / 1024).toFixed(1)} KB, subword regex estimate)`);
  console.log(`  Source Code Tokens  : ${c.bold}${report.rawCodeTokens.toLocaleString()} raw${c.reset} -> ${c.green}${c.bold}${report.compactedCodeTokens.toLocaleString()} AST-compacted${c.reset} (${c.green}${report.codeSavingsPercent}% measured reduction${c.reset})\n`);

  if (report.topFiles.length > 0) {
    console.log(`${c.bold}TOP 5 HEAVIEST FILES:${c.reset}`);
    for (const f of report.topFiles) {
      console.log(`  • ${f.file.padEnd(42)} ${c.yellow}${f.tokens.toLocaleString()}t${c.reset} -> ${c.green}${f.compactedTokens.toLocaleString()}t${c.reset}`);
    }
    console.log();
  }

  if (report.customCost) {
    console.log(`${c.bold}CUSTOM COST CALCULATION ($${report.customCost.priceInPerMillion}/1M input tokens):${c.reset}`);
    console.log(`  • Full Repo Load (Raw)       : $${report.customCost.rawRepoCostPerLoad}`);
    console.log(`  • Code Only (Raw -> Compact) : $${report.customCost.rawCodeCostPerLoad} -> ${c.green}$${report.customCost.compactedCodeCostPerLoad}${c.reset}`);
    console.log(`  • Est. 10-Turn Code Savings  : ${c.green}$${report.customCost.savingsTenTurns}${c.reset}\n`);
  } else {
    console.log(`${c.gray}Tip: Pass --price-in=<dollars_per_1M> to calculate cost for your model's current rate.${c.reset}\n`);
  }
}
