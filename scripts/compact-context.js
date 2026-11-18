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

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico',
  'exe', 'dll', 'so', 'dylib', 'bin', 'obj', 'o',
  'zip', 'tar', 'gz', '7z', 'rar',
  'pdf', 'doc', 'docx',
  'mp4', 'mp3', 'wav', 'mov', 'avi',
  'wasm', 'node', 'pyc', 'class'
]);

/**
 * Production-Grade AST Token Compactor using Babel.
 * Preserves exports, types, interfaces, and function signatures.
 * Strips all internal function bodies down to {} for 80-90% token reduction.
 * Optionally injects cross-file caller annotations.
 */
export function compactSourceCode(code, options = {}) {
  if (!code || !code.trim()) return '';

  const callers = options.callers || {}; // { [symbolName]: [ { file, line } ] }
  const ext = (options.ext || 'ts').replace(/^\./, '').toLowerCase();

  // Reject binary files or buffers with null bytes or non-text control characters
  if (BINARY_EXTENSIONS.has(ext) || code.includes('\0') || /[\x00-\x08\x0E-\x1F]/.test(code.slice(0, 512))) {
    return `// [Apex Compactor: Binary asset (${ext}) excluded from text context]`;
  }

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
 * Replaces balanced `{ ... }` function bodies following a signature regex on a single line,
 * properly respecting nested braces and quoted string literals so outer blocks (e.g. `impl Cache { ... }`) stay intact.
 */
function stripSingleLineBalancedBodies(line, sigRegex, options = {}) {
  let result = '';
  let cursor = 0;
  const flags = sigRegex.flags.includes('g') ? sigRegex.flags : sigRegex.flags + 'g';
  const re = new RegExp(sigRegex.source, flags);
  const isRust = options.lang === 'rust';

  while (cursor < line.length) {
    re.lastIndex = cursor;
    const match = re.exec(line);
    if (!match) {
      result += line.slice(cursor);
      break;
    }

    const openBraceIdx = match.index + match[0].length - 1;
    let depth = 0;
    let closeBraceIdx = -1;
    let inQuote = null;
    let inBlockComment = false;
    let escaped = false;

    for (let j = openBraceIdx; j < line.length; j++) {
      const ch = line[j];
      if (inBlockComment) {
        if (ch === '*' && line[j + 1] === '/') {
          inBlockComment = false;
          j++;
        }
        continue;
      }
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inQuote) {
        if (ch === '\\' && inQuote !== '`') {
          escaped = true;
        } else if (ch === inQuote) {
          inQuote = null;
        }
        continue;
      }
      if (ch === '/' && line[j + 1] === '*') {
        inBlockComment = true;
        j++;
        continue;
      }
      if (ch === "'") {
        if (isRust) {
          // Only treat single quote as char literal in Rust ('x', '\n', '\x7f', '\u{...}'); ignore lifetimes like 'a / 'static
          const charMatch = /^'(?:[^'\\]|\\(?:[nrt0\\'"]|x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,6}\}))'/.exec(line.slice(j));
          if (charMatch) {
            j += charMatch[0].length - 1;
          }
          continue;
        }
        inQuote = ch;
        continue;
      }
      if (ch === '"' || ch === '`') {
        inQuote = ch;
        continue;
      }
      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          closeBraceIdx = j;
          break;
        }
      }
    }

    if (closeBraceIdx === -1) {
      // Unclosed body on this line — leave untouched for multi-line handler
      result += line.slice(cursor);
      break;
    }

    result += line.slice(cursor, openBraceIdx) + '{ /* stripped */ }';
    cursor = closeBraceIdx + 1;
  }

  return result;
}

function createBraceScannerState() {
  return {
    inBlockComment: false,
    blockCommentDepth: 0,
    inGoRawString: false,
    rustRawHashes: -1
  };
}

/**
 * Counts real code `{` and `}` braces on a single line while skipping:
 * - double-quoted strings (`"..."` with `\"` escapes)
 * - Go backtick raw strings (`` `...` ``) and Rust raw strings (`r#"..."#`) across lines
 * - Rust lifetimes (`'a`, `'static`) vs valid char literals (`'}'`, `'\n'`, `'\u{7d}'`)
 * - Go rune literals (`'}'`, `'\''`)
 * - `//` line comments and multi-line `/* ... *\/` block comments (nested in Rust)
 */
function countCodeBraces(line, state, lang = 'go') {
  const isRust = lang === 'rust';
  let open = 0;
  let close = 0;
  let inDoubleQuote = false;
  let escaped = false;

  for (let j = 0; j < line.length; j++) {
    const ch = line[j];

    // 1. Multi-line block comment state
    if (state.inBlockComment) {
      if (isRust && ch === '/' && line[j + 1] === '*') {
        state.blockCommentDepth++;
        j++;
      } else if (ch === '*' && line[j + 1] === '/') {
        state.blockCommentDepth--;
        if (state.blockCommentDepth <= 0) {
          state.inBlockComment = false;
          state.blockCommentDepth = 0;
        }
        j++;
      }
      continue;
    }

    // 2. Multi-line Go raw backtick string state
    if (state.inGoRawString) {
      if (ch === '`') {
        state.inGoRawString = false;
      }
      continue;
    }

    // 3. Multi-line Rust raw string state (r"...", r#"..."#, r##"..."##)
    if (state.rustRawHashes >= 0) {
      if (ch === '"') {
        let hashes = 0;
        while (hashes < state.rustRawHashes && line[j + 1 + hashes] === '#') {
          hashes++;
        }
        if (hashes === state.rustRawHashes) {
          state.rustRawHashes = -1;
          j += hashes;
        }
      }
      continue;
    }

    // 4. Single-line double-quoted string state
    if (inDoubleQuote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    // 5. Line comment `//` skips rest of line
    if (ch === '/' && line[j + 1] === '/') {
      break;
    }

    // 6. Block comment start `/*`
    if (ch === '/' && line[j + 1] === '*') {
      state.inBlockComment = true;
      state.blockCommentDepth = 1;
      j++;
      continue;
    }

    // 7. Rust raw string start `r#"..."#` / `br#"..."#`
    if (isRust && (ch === 'r' || (ch === 'b' && line[j + 1] === 'r'))) {
      const startOffset = ch === 'b' ? 2 : 1;
      const prevCh = j > 0 ? line[j - 1] : '';
      if (!/[a-zA-Z0-9_]/.test(prevCh)) {
        const rawMatch = /^(#*)(")/.exec(line.slice(j + startOffset));
        if (rawMatch) {
          state.rustRawHashes = rawMatch[1].length;
          j += startOffset + rawMatch[1].length;
          continue;
        }
      }
    }

    // 8. Go raw backtick string start
    if (!isRust && ch === '`') {
      state.inGoRawString = true;
      continue;
    }

    // 9. Double-quoted string start
    if (ch === '"') {
      inDoubleQuote = true;
      escaped = false;
      continue;
    }

    // 10. Single quote: Rust char literal vs lifetime, or Go rune literal
    if (ch === "'") {
      if (isRust) {
        const charMatch = /^'(?:[^'\\]|\\(?:[nrt0\\'"]|x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,6}\}))'/.exec(line.slice(j));
        if (charMatch) {
          j += charMatch[0].length - 1;
        }
        continue;
      } else {
        const runeMatch = /^'(?:[^'\\]|\\(?:[abfnrtv\\'"]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{3}))'/.exec(line.slice(j));
        if (runeMatch) {
          j += runeMatch[0].length - 1;
        }
        continue;
      }
    }

    if (ch === '{') {
      open++;
    } else if (ch === '}') {
      close++;
    }
  }

  return { open, close, delta: open - close };
}

/**
 * Multi-Language Compactor: Go (.go)
 * Preserves package, imports, struct/interface definitions, and func signatures; replaces bodies with {}.
 */
export function compactGoCode(code) {
  const lines = code.split('\n');
  const compacted = [];
  let inFunc = false;
  let braceDepth = 0;
  let scanState = createBraceScannerState();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (inFunc) {
      const { delta } = countCodeBraces(line, scanState, 'go');
      braceDepth += delta;
      if (braceDepth <= 0) {
        inFunc = false;
        braceDepth = 0;
        scanState = createBraceScannerState();
      }
      continue;
    }

    if (/^func\s+(\([^)]+\)\s+)?[a-zA-Z0-9_]+\s*\(/.test(trimmed)) {
      const lineBraces = countCodeBraces(line, createBraceScannerState(), 'go');

      // Single-line inline function (balanced braces on one line, including nested braces and comments)
      if (lineBraces.open > 0 && lineBraces.open === lineBraces.close) {
        const strippedLine = stripSingleLineBalancedBodies(
          line,
          /\bfunc\s+(?:\([^)]+\)\s+)?[a-zA-Z0-9_]+\s*\([^)]*\)[^{]*\{/g,
          { lang: 'go' }
        );
        compacted.push(strippedLine);
        continue;
      }

      if (lineBraces.open > 0) {
        const sig = line.slice(0, line.indexOf('{') + 1);
        compacted.push(sig + ' /* stripped */ }');
        scanState = createBraceScannerState();
        const { open, close } = countCodeBraces(line, scanState, 'go');
        if (open > close) {
          inFunc = true;
          braceDepth = open - close;
        }
      } else {
        let sigLines = [line];
        let foundOpenBrace = false;
        while (i + 1 < lines.length) {
          i++;
          const nextLine = lines[i];
          sigLines.push(nextLine);
          const nextBraces = countCodeBraces(nextLine, createBraceScannerState(), 'go');
          if (nextBraces.open > 0) {
            foundOpenBrace = true;
            const fullSig = sigLines.join('\n');
            const idx = fullSig.indexOf('{');
            compacted.push(fullSig.slice(0, idx + 1) + ' /* stripped */ }');
            scanState = createBraceScannerState();
            let openTotal = 0;
            let closeTotal = 0;
            for (const sl of sigLines) {
              const b = countCodeBraces(sl, scanState, 'go');
              openTotal += b.open;
              closeTotal += b.close;
            }
            if (openTotal > closeTotal) {
              inFunc = true;
              braceDepth = openTotal - closeTotal;
            }
            break;
          }
        }
        if (!foundOpenBrace) {
          compacted.push(...sigLines);
        }
      }
      continue;
    }

    // Preserve all declarations outside functions (package, imports, structs, fields, interfaces, types, consts, vars)
    compacted.push(line);
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
  let inFnBody = false;
  let fnBraceDepth = 0;
  let scanState = createBraceScannerState();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Inside function body, count real code braces until function finishes
    if (inFnBody) {
      const { delta } = countCodeBraces(line, scanState, 'rust');
      fnBraceDepth += delta;
      if (fnBraceDepth <= 0) {
        inFnBody = false;
        fnBraceDepth = 0;
        scanState = createBraceScannerState();
      }
      continue;
    }

    // Single-line inline function / method (e.g. `impl Cache { pub fn get<'a>(&'a self) -> &'a str { ... } }`)
    if (/\bfn\s+[a-zA-Z0-9_]+/.test(trimmed)) {
      const lineBraces = countCodeBraces(line, createBraceScannerState(), 'rust');
      if (lineBraces.open > 0 && lineBraces.open === lineBraces.close) {
        const strippedLine = stripSingleLineBalancedBodies(
          line,
          /\b(?:(?:pub(?:\s*\([^)]*\))?\s+)?(?:async\s+)?(?:const\s+)?(?:unsafe\s+)?(?:extern\s+(?:"[^"]*"\s+)?)?)?fn\s+[a-zA-Z0-9_]+[^{]*\{/g,
          { lang: 'rust' }
        );
        compacted.push(strippedLine);
        continue;
      }
    }

    // Function/method signatures: fn, pub fn, pub(crate) fn, pub(super) fn, async fn, const fn, unsafe fn
    if (/^(pub(\s*\([^)]*\))?\s+)?(async\s+)?(const\s+)?(unsafe\s+)?(extern\s+("[^"]*"\s+)?)?fn\s+[a-zA-Z0-9_]+/i.test(trimmed)) {
      const lineBraces = countCodeBraces(line, createBraceScannerState(), 'rust');
      if (lineBraces.open > 0) {
        const sig = line.slice(0, line.indexOf('{') + 1);
        compacted.push(sig + ' /* stripped */ }');
        scanState = createBraceScannerState();
        const { open, close } = countCodeBraces(line, scanState, 'rust');
        if (open > close) {
          inFnBody = true;
          fnBraceDepth = open - close;
        }
      } else {
        // Multi-line signature until '{'
        let sigLines = [line];
        let foundOpenBrace = false;
        while (i + 1 < lines.length) {
          i++;
          const nextLine = lines[i];
          sigLines.push(nextLine);
          const nextBraces = countCodeBraces(nextLine, createBraceScannerState(), 'rust');
          if (nextBraces.open > 0) {
            foundOpenBrace = true;
            const fullSig = sigLines.join('\n');
            const idx = fullSig.indexOf('{');
            compacted.push(fullSig.slice(0, idx + 1) + ' /* stripped */ }');
            scanState = createBraceScannerState();
            let openTotal = 0;
            let closeTotal = 0;
            for (const sl of sigLines) {
              const b = countCodeBraces(sl, scanState, 'rust');
              openTotal += b.open;
              closeTotal += b.close;
            }
            if (openTotal > closeTotal) {
              inFnBody = true;
              fnBraceDepth = openTotal - closeTotal;
            }
            break;
          }
        }
        if (!foundOpenBrace) {
          compacted.push(...sigLines);
        }
      }
      continue;
    }

    // Preserve all declarations outside functions (structs, struct fields, enums, variants, traits, impls, use, mod, attributes)
    compacted.push(line);
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

  if (options.top !== null && options.top !== undefined) {
    const parsed = parseInt(options.top, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.error(`${c.red}Error: Invalid --top value "${options.top}". Must be a positive integer.${c.reset}`);
      process.exit(1);
    }
  }
  if (options.budget !== null && options.budget !== undefined) {
    const parsed = parseInt(options.budget, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.error(`${c.red}Error: Invalid --budget value "${options.budget}". Must be a positive integer.${c.reset}`);
      process.exit(1);
    }
  }

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
      if (skeleton.startsWith('// [Apex Compactor: Binary asset')) {
        // Binary asset or non-text file - skip entirely without fake savings
        continue;
      }
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

  const outputDir = fs.existsSync(projectDir) && fs.statSync(projectDir).isFile() ? process.cwd() : projectDir;
  const outputPath = path.join(outputDir, outputFileName);
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

export function getAllSourceFiles(dir, acc = [], visited = new Set()) {
  if (!fs.existsSync(dir)) return acc;
  try {
    const stat = fs.statSync(dir);
    if (stat.isFile()) {
      acc.push(path.resolve(dir));
      return acc;
    }
    const realDir = fs.realpathSync(dir);
    if (visited.has(realDir)) return acc;
    visited.add(realDir);

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          const target = fs.realpathSync(fullPath);
          if (visited.has(target)) continue;
          if (fs.statSync(fullPath).isDirectory()) {
            getAllSourceFiles(fullPath, acc, visited);
          }
        } catch {
          continue;
        }
      } else if (entry.isDirectory()) {
        getAllSourceFiles(fullPath, acc, visited);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs'].includes(ext) && !entry.name.endsWith('.d.ts')) {
          acc.push(fullPath);
        }
      }
    }
  } catch {}

  return acc;
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('compact-context.js')) {
  const args = process.argv.slice(2);

  // Validate flags
  const knownFlags = ['--format', '--xml', '--json', '--md', '--top', '--budget', '--no-callers'];
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const flagName = arg.split('=')[0];
      if (!knownFlags.includes(flagName)) {
        console.error(`${c.red}Error: Unknown flag "${arg}".${c.reset}`);
        console.error(`Allowed flags: ${knownFlags.join(', ')}`);
        process.exit(1);
      }
    }
  }

  const formatArg = args.find(a => a.startsWith('--format='));
  const format = formatArg ? formatArg.split('=')[1] : args.includes('--xml') ? 'xml' : args.includes('--json') ? 'json' : 'md';
  const topArg = args.find(a => a.startsWith('--top='));
  const top = topArg ? topArg.split('=')[1] : null;
  const budgetArg = args.find(a => a.startsWith('--budget='));
  const budget = budgetArg ? budgetArg.split('=')[1] : null;
  const noCallers = args.includes('--no-callers');

  const rawTarget = args.find(a => !a.startsWith('--'));
  if (rawTarget && !fs.existsSync(rawTarget)) {
    console.error(`${c.red}Error: File or directory not found: "${rawTarget}".${c.reset}`);
    process.exit(1);
  }
  const targetDir = rawTarget || process.cwd();
  runContextCompactor(targetDir, { format, top, budget, callers: !noCallers });
}
