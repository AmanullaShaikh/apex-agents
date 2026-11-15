#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

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
      } else if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) {
        results.push(path.join(dir, entry.name));
      }
    }
  } catch {
    // Ignore read errors
  }
  return results;
}

/**
 * Traces a symbol across all workspace files via AST parsing.
 */
export function traceSymbol(symbolName, projectDir = process.cwd()) {
  if (!symbolName || typeof symbolName !== 'string') {
    throw new Error('Symbol name is required for tracing.');
  }

  const cleanSymbol = symbolName.trim();
  const files = getSourceFiles(projectDir);
  const declarations = [];
  const callers = [];

  for (const file of files) {
    const relPath = path.relative(projectDir, file).replace(/\\/g, '/');
    let code = '';
    try {
      code = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'asyncGenerators']
      });
    } catch {
      continue;
    }

    try {
      traverse(ast, {
        // Detect definitions
        FunctionDeclaration(p) {
          if (p.node.id && p.node.id.name === cleanSymbol) {
            const params = p.node.params.map(param => param.name || (param.typeAnnotation ? 'param' : '?')).join(', ');
            declarations.push({
              file: relPath,
              line: p.node.loc?.start.line || 1,
              type: 'function',
              signature: `function ${cleanSymbol}(${params})`,
              exported: p.parentPath?.isExportNamedDeclaration() || p.parentPath?.isExportDefaultDeclaration() || false
            });
          }
        },
        VariableDeclarator(p) {
          if (p.node.id && p.node.id.name === cleanSymbol) {
            let sig = `const ${cleanSymbol}`;
            if (p.node.init?.type === 'ArrowFunctionExpression' || p.node.init?.type === 'FunctionExpression') {
              const params = (p.node.init.params || []).map(param => param.name || '?').join(', ');
              sig = `const ${cleanSymbol} = (${params}) => ...`;
            }
            declarations.push({
              file: relPath,
              line: p.node.loc?.start.line || 1,
              type: 'variable',
              signature: sig,
              exported: p.parentPath?.parentPath?.isExportNamedDeclaration() || false
            });
          }
        },
        ClassDeclaration(p) {
          if (p.node.id && p.node.id.name === cleanSymbol) {
            declarations.push({
              file: relPath,
              line: p.node.loc?.start.line || 1,
              type: 'class',
              signature: `class ${cleanSymbol}`,
              exported: p.parentPath?.isExportNamedDeclaration() || false
            });
          }
        },
        TSInterfaceDeclaration(p) {
          if (p.node.id && p.node.id.name === cleanSymbol) {
            declarations.push({
              file: relPath,
              line: p.node.loc?.start.line || 1,
              type: 'interface',
              signature: `interface ${cleanSymbol}`,
              exported: p.parentPath?.isExportNamedDeclaration() || false
            });
          }
        },
        // Detect Call Sites
        CallExpression(p) {
          let calledName = null;
          if (p.node.callee.type === 'Identifier') {
            calledName = p.node.callee.name;
          } else if (p.node.callee.type === 'MemberExpression' && p.node.callee.property.type === 'Identifier') {
            calledName = p.node.callee.property.name;
          }

          if (calledName === cleanSymbol) {
            const line = p.node.loc?.start.line || 1;
            // Avoid duplicate reporting if definition is in the same line
            const isDef = declarations.some(d => d.file === relPath && d.line === line);
            if (!isDef) {
              callers.push({
                file: relPath,
                line,
                callSnippet: code.split('\n')[line - 1]?.trim() || `${cleanSymbol}(...)`
              });
            }
          }
        }
      });
    } catch {
      // traversal fallback
    }
  }

  return {
    symbol: cleanSymbol,
    declarations,
    callers,
    totalCallers: callers.length,
    scannedFiles: files.length
  };
}

/**
 * Formats trace results as an LLM-ready markdown block.
 */
export function formatTraceReport(traceData) {
  let md = `### 🔗 SYMBOL TRACE DOSSIER: \`${traceData.symbol}\`\n`;
  md += `- **Declarations (${traceData.declarations.length})**:\n`;
  if (traceData.declarations.length === 0) {
    md += `  (No explicit declaration found in AST)\n`;
  } else {
    traceData.declarations.forEach(d => {
      md += `  • \`${d.file}:${d.line}\` ➔ \`${d.signature}\` ${d.exported ? '[EXPORTED]' : '[INTERNAL]'}\n`;
    });
  }

  md += `- **Call Sites & Dependents (${traceData.callers.length})**:\n`;
  if (traceData.callers.length === 0) {
    md += `  (Zero direct callers detected across scanned files)\n`;
  } else {
    traceData.callers.forEach(c => {
      md += `  • \`${c.file}:${c.line}\`: \`${c.callSnippet}\`\n`;
    });
  }

  return md;
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('symbol-tracer.js')) {
  const symbol = process.argv[2];
  if (!symbol) {
    console.log(`\n${c.red}Usage: npx apex-agents trace <symbolName>${c.reset}\n`);
    process.exit(1);
  }

  const res = traceSymbol(symbol);
  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: SYMBOL TRACER ═════${c.reset}`);
  console.log(`Symbol: ${c.yellow}${c.bold}${res.symbol}${c.reset} (Scanned ${res.scannedFiles} files)\n`);
  console.log(formatTraceReport(res));
}
