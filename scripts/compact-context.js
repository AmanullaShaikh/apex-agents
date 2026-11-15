#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import * as t from '@babel/traverse';
import * as g from '@babel/generator';
import { buildDependencyGraph, extractSymbolCallers } from './dependency-graph.js';

const traverse = t.default?.default || t.default;
const generate = g.default?.default || g.default;

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

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.agents', '.worktrees', 'coverage']);

/**
 * Production-Grade AST Token Compactor using Babel.
 * Preserves exports, types, interfaces, and function signatures.
 * Strips all internal function bodies down to {} for 80-90% token reduction.
 * Optionally injects cross-file caller annotations.
 */
export function compactSourceCode(code, options = {}) {
  if (!code || !code.trim()) return '';

  const callers = options.callers || {}; // { [symbolName]: [ { file, line } ] }
  const ext = options.ext || 'ts';

  if (ext === 'py') {
    return compactPythonCode(code);
  } else if (ext === 'go') {
    return compactGoCode(code);
  } else if (ext === 'rs') {
    return compactRustCode(code);
  }

  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        'decorators-legacy',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'topLevelAwait'
      ]
    });

    traverse(ast, {
      Function(p) {
        let funcName = null;
        if (p.node.id?.name) {
          funcName = p.node.id.name;
        } else if (p.parent?.type === 'VariableDeclarator' && p.parent.id?.name) {
          funcName = p.parent.id.name;
        } else if (p.node.key?.name) {
          funcName = p.node.key.name;
        }

        // Inject caller annotation comment if callers exist
        if (funcName && callers[funcName] && callers[funcName].length > 0) {
          const list = callers[funcName];
          const callerSummary = list.map(c => `${c.file}:${c.line}`).slice(0, 3).join(', ') + (list.length > 3 ? '...' : '');
          const comment = {
            type: 'CommentLine',
            value: ` 🔗 Callers (${list.length}): ${callerSummary}`
          };
          if (!p.node.leadingComments) p.node.leadingComments = [];
          // Avoid duplicate comments
          if (!p.node.leadingComments.some(c => c.value.includes('🔗 Callers'))) {
            p.node.leadingComments.push(comment);
          }
        }

        if (p.node.body && p.node.body.type === 'BlockStatement') {
          p.node.body = {
            type: 'BlockStatement',
            body: [],
            directives: []
          };
        }
      }
    });

    const output = generate(ast, { retainLines: false, compact: false }, code);
    return output.code;
  } catch (err) {
    // Graceful fallback for non-JS/TS or malformed WIP files
    return fallbackCompact(code, callers);
  }
}

// Backward compatibility alias for legacy callers
export const compactJavaScript = compactSourceCode;

/**
 * Multi-Language Compactor: Python (.py)
 * Preserves def/class signatures, type hints, docstrings, imports; replaces bodies with pass.
 */
export function compactPythonCode(code) {
  const lines = code.split('\n');
  const compacted = [];
  let inFunc = false;
  let inSignature = false;
  let inDocstring = false;
  let docstringToken = null;
  let funcIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Preserve empty lines outside function bodies
    if (!trimmed) {
      if (!inFunc) compacted.push(line);
      continue;
    }

    // Track multi-line triple-quoted docstrings
    const hasTripleDouble = trimmed.includes('"""');
    const hasTripleSingle = trimmed.includes("'''");
    if (hasTripleDouble || hasTripleSingle) {
      const token = hasTripleDouble ? '"""' : "'''";
      const count = (trimmed.match(new RegExp(token, 'g')) || []).length;
      if (count % 2 === 1) {
        if (!inDocstring) {
          inDocstring = true;
          docstringToken = token;
        } else if (docstringToken === token) {
          inDocstring = false;
          docstringToken = null;
        }
      }
      if (!inFunc) compacted.push(line);
      continue;
    }

    if (inDocstring) {
      if (!inFunc) compacted.push(line);
      continue;
    }

    // Check if we are inside a multi-line def signature: def foo(\n a,\n b\n):
    if (inSignature) {
      compacted.push(line);
      if (trimmed.endsWith(':')) {
        inSignature = false;
        inFunc = true;
        compacted.push(' '.repeat(funcIndent + 4) + 'pass');
      }
      continue;
    }

    // Check if function body is ending based on indentation
    if (inFunc) {
      const currentIndent = (line.match(/^(\s*)/) || ['', ''])[1].length;
      if (currentIndent > funcIndent) {
        // Skip function implementation line
        continue;
      } else {
        inFunc = false;
      }
    }

    // Preserved class, import, decorator, and comment headers
    if (
      trimmed.startsWith('import ') ||
      trimmed.startsWith('from ') ||
      trimmed.startsWith('@') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('class ')
    ) {
      compacted.push(line);
      inFunc = false;
      continue;
    }

    // Function definition start
    if (/^(async\s+)?def\s+[a-zA-Z0-9_]+\s*\(/.test(trimmed)) {
      compacted.push(line);
      const indentMatch = line.match(/^(\s*)/);
      funcIndent = indentMatch ? indentMatch[1].length : 0;

      if (trimmed.endsWith(':')) {
        // Single-line def signature
        inFunc = true;
        inSignature = false;
        compacted.push(' '.repeat(funcIndent + 4) + 'pass');
      } else {
        // Multi-line def signature
        inSignature = true;
        inFunc = false;
      }
      continue;
    }

    if (!inFunc) {
      compacted.push(line);
    }
  }

  return compacted.join('\n');
}

/**
 * Multi-Language Compactor: Go (.go)
 * Preserves package, imports, struct/interface definitions, and func signatures; replaces bodies with {}.
 */
export function compactGoCode(code) {
  const lines = code.split('\n');
  const compacted = [];
  let inFunc = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (
      trimmed.startsWith('package ') ||
      trimmed.startsWith('import ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      compacted.push(line);
      continue;
    }

    if (/^func\s+(\([^)]+\)\s+)?[a-zA-Z0-9_]+\s*\(/.test(trimmed)) {
      if (trimmed.includes('{')) {
        const sig = line.slice(0, line.indexOf('{') + 1);
        compacted.push(sig + ' /* stripped */ }');
      } else {
        compacted.push(line);
      }
      continue;
    }

    if (trimmed === '}') {
      inFunc = false;
      continue;
    }

    if (!inFunc && (trimmed.startsWith('var ') || trimmed.startsWith('const '))) {
      compacted.push(line);
    }
  }

  return compacted.join('\n');
}

/**
 * Multi-Language Compactor: Rust (.rs)
 * Preserves use, struct, enum, trait, and fn signatures; replaces bodies with {}.
 */
export function compactRustCode(code) {
  const lines = code.split('\n');
  const compacted = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (
      trimmed.startsWith('use ') ||
      trimmed.startsWith('pub use ') ||
      trimmed.startsWith('mod ') ||
      trimmed.startsWith('pub mod ') ||
      trimmed.startsWith('struct ') ||
      trimmed.startsWith('pub struct ') ||
      trimmed.startsWith('enum ') ||
      trimmed.startsWith('pub enum ') ||
      trimmed.startsWith('trait ') ||
      trimmed.startsWith('pub trait ') ||
      trimmed.startsWith('impl ') ||
      trimmed.startsWith('#[') ||
      trimmed.startsWith('//')
    ) {
      compacted.push(line);
      continue;
    }

    if (/^(pub\s+)?(async\s+)?(unsafe\s+)?fn\s+[a-zA-Z0-9_]+/.test(trimmed)) {
      if (trimmed.includes('{')) {
        const sig = line.slice(0, line.indexOf('{') + 1);
        compacted.push(sig + ' /* stripped */ }');
      } else {
        compacted.push(line);
      }
      continue;
    }

    if (trimmed === '}') {
      continue;
    }
  }

  return compacted.join('\n');
}

function fallbackCompact(code, callers = {}) {
  const lines = code.split('\n');
  const compacted = [];
  let inClass = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (
      trimmed.startsWith('import ') ||
      trimmed.startsWith('export *') ||
      trimmed.startsWith('export type ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('export interface ') ||
      trimmed.startsWith('interface ') ||
      trimmed.startsWith('export enum ') ||
      trimmed.startsWith('enum ') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      compacted.push(line);
      continue;
    }

    if (/^(export\s+)?(default\s+)?(abstract\s+)?class\s+[a-zA-Z0-9_$]+/.test(trimmed)) {
      compacted.push(line);
      inClass = true;
      continue;
    }

    if (inClass && trimmed === '}') {
      compacted.push(line);
      inClass = false;
      continue;
    }

    const isFunctionHeader =
      /^(export\s+)?(default\s+)?(async\s+)?function\b/.test(trimmed) ||
      /^(export\s+)?const\s+[a-zA-Z0-9_$]+\s*=\s*(async\s*)?\([^)]*\)\s*(:\s*[^=]+)?\s*=>/.test(trimmed) ||
      /^(public|private|protected|static|async|\s)*[a-zA-Z0-9_$]+\([^)]*\)\s*(:\s*[^{]+)?\s*\{/.test(trimmed);

    if (isFunctionHeader && trimmed.includes('{')) {
      const sig = line.slice(0, line.indexOf('{') + 1);
      compacted.push(sig + ' /* stripped */ }');
      continue;
    }

    if (trimmed.startsWith('export const') || trimmed.startsWith('export let') || trimmed.startsWith('export default')) {
      if (trimmed.length < 120) {
        compacted.push(line);
      }
    }
  }

  return compacted.join('\n');
}

export function runContextCompactor(projectDir = process.cwd(), options = {}) {
  const format = options.format || 'md'; // 'md' | 'xml' | 'json'
  const topLimit = options.top ? parseInt(options.top, 10) : null;
  const tokenBudget = options.budget ? parseInt(options.budget, 10) : null;
  const annotateCallers = options.callers !== false;

  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: BABEL AST CONTEXT COMPACTOR (v2.1.0) ═════${c.reset}`);
  console.log(`Scanning codebase: ${c.cyan}${projectDir}${c.reset} (Format: ${c.yellow}${format.toUpperCase()}${c.reset}, Caller Graph: ${annotateCallers ? c.green + 'ON' : c.gray + 'OFF'}${c.reset})...\n`);

  let files = getAllSourceFiles(projectDir);

  if (files.length === 0) {
    console.log(`${c.yellow}No source files found to compact.${c.reset}\n`);
    return;
  }

  // 1. Compute PageRank centrality
  let callersData = {};
  let pageRankScores = new Map();
  try {
    const depData = buildDependencyGraph(projectDir);
    pageRankScores = depData.pageRank || new Map();
    if (annotateCallers) {
      callersData = extractSymbolCallers(projectDir);
    }
  } catch {
    // safe fallback
  }

  // Sort files by PageRank centrality so high-impact architectural files appear first
  files.sort((a, b) => {
    const relA = path.relative(projectDir, a).replace(/\\/g, '/');
    const relB = path.relative(projectDir, b).replace(/\\/g, '/');
    const scoreA = pageRankScores.get(relA) || 0;
    const scoreB = pageRankScores.get(relB) || 0;
    return scoreB - scoreA;
  });

  if (topLimit && topLimit > 0) {
    files = files.slice(0, topLimit);
    console.log(`  ${c.dim}• Applied top ${topLimit} PageRank filter${c.reset}`);
  }

  let originalChars = 0;
  let compactedChars = 0;
  let processedFiles = [];

  let cumulativeTokens = 0;

  for (const file of files) {
    const relPath = path.relative(projectDir, file).replace(/\\/g, '/');
    const ext = path.extname(file).replace('.', '').toLowerCase();
    try {
      const rawContent = fs.readFileSync(file, 'utf-8');
      const fileCallers = callersData[relPath] || {};

      const skeleton = compactSourceCode(rawContent, { ext, callers: fileCallers });
      const estTokens = Math.ceil(skeleton.length / 3.8);

      if (tokenBudget && cumulativeTokens + estTokens > tokenBudget) {
        console.log(`  ${c.yellow}• Reached token budget of ~${tokenBudget} tokens (stopped at ${processedFiles.length} files)${c.reset}`);
        break;
      }

      cumulativeTokens += estTokens;
      originalChars += rawContent.length;
      compactedChars += skeleton.length;

      processedFiles.push({
        path: relPath,
        ext,
        tokens: estTokens,
        pageRank: (pageRankScores.get(relPath) || 0) * 100,
        content: skeleton
      });
    } catch {
      // safely skip
    }
  }

  const originalTokensEst = Math.ceil(originalChars / 3.8);
  const compactedTokensEst = Math.ceil(compactedChars / 3.8);
  const savingsPct = (((originalTokensEst - compactedTokensEst) / (originalTokensEst || 1)) * 100).toFixed(1);

  // Generate Output according to format
  let outputContent = '';
  let outputFileName = 'APEX_CONTEXT.md';

  if (format === 'xml') {
    outputFileName = 'APEX_CONTEXT.xml';
    outputContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    outputContent += `<apex_context files="${processedFiles.length}" original_tokens="${originalTokensEst}" compacted_tokens="${compactedTokensEst}" reduction="${savingsPct}%">\n`;
    for (const f of processedFiles) {
      outputContent += `  <file path="${f.path}" tokens="${f.tokens}" pagerank="${f.pageRank.toFixed(2)}%">\n`;
      outputContent += `<![CDATA[\n${f.content}\n]]>\n`;
      outputContent += `  </file>\n`;
    }
    outputContent += `</apex_context>\n`;
  } else if (format === 'json') {
    outputFileName = 'APEX_CONTEXT.json';
    outputContent = JSON.stringify({
      apexContext: {
        filesCount: processedFiles.length,
        originalTokens: originalTokensEst,
        compactedTokens: compactedTokensEst,
        reductionPercent: parseFloat(savingsPct),
        files: processedFiles.map(f => ({
          path: f.path,
          tokens: f.tokens,
          pageRankPercent: parseFloat(f.pageRank.toFixed(2)),
          skeleton: f.content
        }))
      }
    }, null, 2);
  } else {
    // Markdown
    outputFileName = 'APEX_CONTEXT.md';
    outputContent = `# Project Codebase Skeleton (Generated by Apex Agents AST Compactor v2.1.0)\n\n`;
    outputContent += `> **Stats**: ${processedFiles.length} files • ~${compactedTokensEst.toLocaleString()} tokens (${savingsPct}% saved from ~${originalTokensEst.toLocaleString()} tokens)\n`;
    outputContent += `> **Architecture**: Files ranked by PageRank centrality. Cross-file reverse callers annotated inline.\n\n`;

    for (const f of processedFiles) {
      const codeLang = ['ts', 'tsx'].includes(f.ext) ? 'typescript' : ['js', 'jsx'].includes(f.ext) ? 'javascript' : f.ext;
      outputContent += `## File: \`${f.path}\` (PageRank: ${f.pageRank.toFixed(2)}%, ~${f.tokens} tokens)\n`;
      outputContent += `\`\`\`${codeLang}\n`;
      outputContent += f.content + '\n';
      outputContent += `\`\`\`\n\n`;
    }
  }

  const outputPath = path.join(projectDir, outputFileName);
  fs.writeFileSync(outputPath, outputContent);

  console.log(`  ${c.green}✓${c.reset} Processed ${c.cyan}${processedFiles.length}${c.reset} files.`);
  console.log(`  ${c.green}✓${c.reset} Skeleton written to: ${c.cyan}${outputPath}${c.reset}`);
  console.log(`  • Original Context : ${c.yellow}~${originalTokensEst.toLocaleString()} tokens${c.reset} (${(originalChars / 1024).toFixed(1)} KB)`);
  console.log(`  • Compacted Context: ${c.green}~${compactedTokensEst.toLocaleString()} tokens${c.reset} (${(compactedChars / 1024).toFixed(1)} KB)`);
  console.log(`  • ${c.bold}Context Reduction : ${c.green}${c.bold}${savingsPct}% Saved!${c.reset}\n`);
  console.log(`${c.gray}Inject ${outputFileName} directly into Cursor or Claude Code for whole-codebase awareness with zero context bloat.${c.reset}\n`);

  return {
    filesCount: processedFiles.length,
    originalTokens: originalTokensEst,
    compactedTokens: compactedTokensEst,
    savingsPct: parseFloat(savingsPct),
    outputPath
  };
}

function getAllSourceFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      getAllSourceFiles(fullPath, acc);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs'].includes(ext) && !entry.name.endsWith('.d.ts')) {
        acc.push(fullPath);
      }
    }
  }

  return acc;
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('compact-context.js')) {
  const args = process.argv.slice(2);
  const formatArg = args.find(a => a.startsWith('--format='));
  const format = formatArg ? formatArg.split('=')[1] : args.includes('--xml') ? 'xml' : args.includes('--json') ? 'json' : 'md';
  const topArg = args.find(a => a.startsWith('--top='));
  const top = topArg ? topArg.split('=')[1] : null;
  const budgetArg = args.find(a => a.startsWith('--budget='));
  const budget = budgetArg ? budgetArg.split('=')[1] : null;
  const noCallers = args.includes('--no-callers');

  const targetDir = args.find(a => !a.startsWith('--')) || process.cwd();
  runContextCompactor(targetDir, { format, top, budget, callers: !noCallers });
}
