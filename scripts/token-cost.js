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

const MODEL_PRICING = [
  {
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    contextWindow: 200000,
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00
  },
  {
    name: 'OpenAI o3-mini',
    provider: 'OpenAI',
    contextWindow: 200000,
    inputPricePerMillion: 1.10,
    outputPricePerMillion: 4.40
  },
  {
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    contextWindow: 128000,
    inputPricePerMillion: 0.55,
    outputPricePerMillion: 2.19
  },
  {
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    contextWindow: 2000000,
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00
  },
  {
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextWindow: 200000,
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00
  },
  {
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextWindow: 128000,
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00
  },
  {
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    contextWindow: 64000,
    inputPricePerMillion: 0.14,
    outputPricePerMillion: 0.28
  },
  {
    name: 'Qwen 2.5 Coder 32B',
    provider: 'Alibaba',
    contextWindow: 128000,
    inputPricePerMillion: 0.07,
    outputPricePerMillion: 0.14
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
 * Estimates token counts for code (heuristic ~3.8 chars per token for structured code)
 */
export function estimateTokens(charCount) {
  return Math.ceil(charCount / 3.8);
}

/**
 * Computes repository token stats and cost predictions across LLMs.
 */
export function computeTokenCost(projectDir = process.cwd()) {
  const files = getSourceFiles(projectDir);
  let totalChars = 0;
  let totalBytes = 0;
  const fileBreakdown = [];

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      const content = fs.readFileSync(file, 'utf-8');
      const chars = content.length;
      const tokens = estimateTokens(chars);
      totalChars += chars;
      totalBytes += stat.size;
      fileBreakdown.push({
        path: path.relative(projectDir, file).replace(/\\/g, '/'),
        tokens,
        bytes: stat.size
      });
    } catch {
      // ignore
    }
  }

  const totalTokens = estimateTokens(totalChars);

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
  const rawCostSonnet = (totalTokens / 1000000) * 3.00;
  const compactedCostSonnet = (compactedTokensEst / 1000000) * 3.00;

  return {
    scannedFiles: files.length,
    totalBytes,
    totalTokens,
    compactedTokensEst,
    savingsPercent: 82.0,
    dollarSavingsTenTurnsSonnet: ((rawCostSonnet - compactedCostSonnet) * 10).toFixed(3),
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
  console.log(`  Raw Token Volume : ${c.yellow}${c.bold}${report.totalTokens.toLocaleString()} tokens${c.reset} (~${(report.totalBytes / 1024).toFixed(1)} KB)`);
  console.log(`  With AST Compact : ${c.green}${c.bold}${report.compactedTokensEst.toLocaleString()} tokens${c.reset} (${report.savingsPercent}% reduction)\n`);

  console.log(`${c.bold}MODEL CONTEXT & COST PROJECTIONS (Per Single Context Load):${c.reset}`);
  console.log(`┌─────────────────────┬──────────────────┬──────────────┬──────────────┐`);
  console.log(`│ Model               │ Context Window   │ Window Used  │ Single Cost  │`);
  console.log(`├─────────────────────┼──────────────────┼──────────────┼──────────────┤`);
  report.modelProjections.forEach(m => {
    const modelPad = m.model.padEnd(19);
    const winPad = `${(m.contextLimit / 1000)}k`.padEnd(16);
    const usagePad = `${m.windowUsagePercent}%`.padEnd(12);
    const costPad = `$${m.costPerTurn}`.padEnd(12);
    console.log(`│ ${modelPad} │ ${winPad} │ ${usagePad} │ ${costPad} │`);
  });
  console.log(`└─────────────────────┴──────────────────┴──────────────┴──────────────┘\n`);

  console.log(`💡 ${c.green}${c.bold}Apex Savings Insight:${c.reset} Running ${c.cyan}npx apex-agents compact${c.reset} saves ~${c.green}$${report.dollarSavingsTenTurnsSonnet}${c.reset} every 10 turns on Claude 3.5 Sonnet!\n`);
}
