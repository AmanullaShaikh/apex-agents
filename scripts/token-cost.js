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

function getSourceFiles(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          results = results.concat(getSourceFiles(path.join(dir, entry.name)));
        }
      } else if (/\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|json|md)$/.test(entry.name)) {
        results.push(path.join(dir, entry.name));
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

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('token-cost.js')) {
  const args = process.argv.slice(2);
  let priceInPerMillion = null;
  let projectDir = process.cwd();

  for (const arg of args) {
    if (arg.startsWith('--price-in=')) {
      const val = parseFloat(arg.split('=')[1]);
      if (!Number.isNaN(val) && val >= 0) {
        priceInPerMillion = val;
      } else {
        console.error(`${c.red}Invalid --price-in value: ${arg}${c.reset}`);
        process.exit(1);
      }
    } else if (!arg.startsWith('-')) {
      projectDir = arg;
    }
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
