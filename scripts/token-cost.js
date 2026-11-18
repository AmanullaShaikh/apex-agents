#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

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

export const PRICING_UPDATED = '2026-11';

export const MODEL_PRICING = [
  {
    name: 'GPT-6 Astra',
    provider: 'OpenAI',
    contextWindow: 1050000,
    inputPricePerMillion: 10.00,
    outputPricePerMillion: 50.00,
    verified: true
  },
  {
    name: 'GPT-6.1 Sol',
    provider: 'OpenAI',
    contextWindow: 1050000,
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 10.00,
    verified: true
  },
  {
    name: 'Gemini 4 Argon',
    provider: 'Google',
    contextWindow: 1048576,
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 10.00,
    verified: true
  },
  {
    name: 'Gemini 4 Hydrogen',
    provider: 'Google',
    contextWindow: 1048576,
    inputPricePerMillion: 1.50,
    outputPricePerMillion: 7.50,
    verified: true
  },
  {
    name: 'Meta Muse Spark',
    provider: 'Meta',
    contextWindow: 1048576,
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 4.25,
    verified: true
  },
  {
    name: 'Claude Sonnet 5.5',
    provider: 'Anthropic',
    contextWindow: 1000000,
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 10.00,
    verified: true
  },
  {
    name: 'Claude Opus 5.5',
    provider: 'Anthropic',
    contextWindow: 1000000,
    inputPricePerMillion: 4.00,
    outputPricePerMillion: 20.00,
    verified: true
  },
  {
    name: 'Grok 4.7',
    provider: 'xAI',
    contextWindow: 500000,
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 6.00,
    verified: true
  },
  {
    name: 'DeepSeek V4-Pro',
    provider: 'DeepSeek',
    contextWindow: 1000000,
    inputPricePerMillion: 0.66,
    outputPricePerMillion: 1.98,
    verified: true
  },
  {
    name: 'DeepSeek V4.1-Flash',
    provider: 'DeepSeek',
    contextWindow: 1000000,
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    verified: true
  }
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.agents'
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
    // ignore
  }
  return results;
}

/**
 * Subword Regex Tokenizer Pattern (Heuristic Approximation based on cl100k/o200k regex split rules)
 * Splits text by words, contractions, numbers (1-3 digits), symbols, and whitespace.
 * Provides a fast local token approximation without requiring heavy external binary dictionaries.
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

/**
 * Computes repository token stats and cost predictions across LLMs.
 */
export function computeTokenCost(projectDir = process.cwd()) {
  const files = getSourceFiles(projectDir);
  let totalChars = 0;
  let totalBytes = 0;
  let totalTokensAcc = 0;
  const fileBreakdown = [];

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      const content = fs.readFileSync(file, 'utf-8');
      const chars = content.length;
      const bpeTokens = countBpeTokens(content);
      const tokens = bpeTokens > 0 ? bpeTokens : estimateTokens(chars);
      totalChars += chars;
      totalBytes += stat.size;
      totalTokensAcc += tokens;
      fileBreakdown.push({
        path: path.relative(projectDir, file).replace(/\\/g, '/'),
        tokens,
        bytes: stat.size
      });
    } catch {
      // ignore
    }
  }

  const totalTokens = totalTokensAcc > 0 ? totalTokensAcc : estimateTokens(totalChars);

  // Projections
  const modelProjections = MODEL_PRICING.map(m => {
    const windowUsagePercent = ((totalTokens / m.contextWindow) * 100).toFixed(2);
    const costPerTurn = ((totalTokens / 1000000) * m.inputPricePerMillion).toFixed(4);
    const costTenTurns = (costPerTurn * 10).toFixed(3);
    return {
      model: m.name,
      provider: m.provider,
      contextLimit: m.contextWindow,
      windowUsagePercent: parseFloat(windowUsagePercent),
      costPerTurn: parseFloat(costPerTurn),
      costTenTurns: parseFloat(costTenTurns)
    };
  });

  // Calculate potential savings with Apex AST Compactor (~80% reduction average)
  const compactedTokensEst = Math.ceil(totalTokens * 0.18);
  const baselineModel = MODEL_PRICING[0];
  const rawCostBaseline = (totalTokens / 1000000) * baselineModel.inputPricePerMillion;
  const compactedCostBaseline = (compactedTokensEst / 1000000) * baselineModel.inputPricePerMillion;

  return {
    pricingUpdated: PRICING_UPDATED,
    scannedFiles: files.length,
    totalBytes,
    totalTokens,
    compactedTokensEst,
    savingsPercent: 82.0,
    baselineModel: baselineModel.name,
    dollarSavingsTenTurnsBaseline: ((rawCostBaseline - compactedCostBaseline) * 10).toFixed(3),
    modelProjections,
    topFiles: fileBreakdown.sort((a, b) => b.tokens - a.tokens).slice(0, 5)
  };
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('token-cost.js')) {
  const projectDir = process.argv[2] || process.cwd();
  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: MULTI-MODEL TOKEN COST AUDITOR ═════${c.reset}`);
  console.log(`Analyzing repository: ${c.yellow}${projectDir}${c.reset}...\n`);

  const report = computeTokenCost(projectDir);

  console.log(`  Scanned Files    : ${c.bold}${report.scannedFiles}${c.reset}`);
  console.log(`  Raw Token Volume : ${c.yellow}${c.bold}${report.totalTokens.toLocaleString()} tokens${c.reset} (~${(report.totalBytes / 1024).toFixed(1)} KB, subword regex estimate)`);
  console.log(`  With AST Compact : ${c.green}${c.bold}${report.compactedTokensEst.toLocaleString()} tokens${c.reset} (${report.savingsPercent}% est. reduction)\n`);

  console.log(`${c.bold}MODEL CONTEXT & COST PROJECTIONS (Pricing ref: ${report.pricingUpdated}, approximate):${c.reset}`);
  console.log(`┌────────────────────────────┬──────────────────┬──────────────┬──────────────┐`);
  console.log(`│ Model                      │ Context Window   │ Window Used  │ Single Cost  │`);
  console.log(`├────────────────────────────┼──────────────────┼──────────────┼──────────────┤`);
  report.modelProjections.forEach(m => {
    const modelPad = m.model.padEnd(26);
    const winLabel = m.contextLimit === 1048576 ? '1,048k (1M)' : `${Math.round(m.contextLimit / 1000)}k`;
    const winPad = winLabel.padEnd(16);
    const usagePad = `${m.windowUsagePercent}%`.padEnd(12);
    const costPad = `$${m.costPerTurn}`.padEnd(12);
    console.log(`│ ${modelPad} │ ${winPad} │ ${usagePad} │ ${costPad} │`);
  });
  console.log(`└────────────────────────────┴──────────────────┴──────────────┴──────────────┘`);
  console.log(`${c.gray}Note: Reference vendor rates as of Nov 2026 (approximate; Gemini 4 Argon promo $2/$10 shifts to $4/$20 Dec 1, 2026; DeepSeek off-peak tiers).${c.reset}\n`);

  console.log(`💡 ${c.green}${c.bold}Apex Savings Estimate:${c.reset} Running ${c.cyan}npx apex-agents compact${c.reset} saves ~${c.green}$${report.dollarSavingsTenTurnsBaseline}${c.reset} every 10 turns on ${report.baselineModel}.\n`);
}
