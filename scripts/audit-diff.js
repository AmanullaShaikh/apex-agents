#!/usr/bin/env node

import fs from 'node:fs';
import { execSync, execFileSync } from 'node:child_process';
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

export const ZERO_WIDTH_REGEX = /[\u200B-\u200F\uFEFF\u00AD\u2060-\u206F\u180E\u202A-\u202E]|\\u(?:200[b-f]|feff|00ad|206[0-9a-f]|180e|202[a-e])/gi;

export const SECRET_PATTERNS = [
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/ },
  { name: 'Stripe Publishable Key', regex: /pk_live_[0-9a-zA-Z]{24}/ },
  { name: 'OpenAI API Key', regex: /sk-proj-[0-9a-zA-Z-_]{48,}/ },
  { name: 'Anthropic API Key', regex: /sk-ant-api03-[0-9a-zA-Z-_]{80,}/ },
  { name: 'AWS Access Key ID', regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'Base64 Encoded AWS Key', regex: /\bQUtJ[0-9a-zA-Z+/=_-]{16,}\b/ },
  { name: 'GitHub Token (PAT / OAuth / App)', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{36,}\b/ },
  { name: 'GitHub Fine-Grained Personal Access Token', regex: /\bgithub_pat_[0-9a-zA-Z_]{82}\b/ },
  { name: 'Google Cloud / Maps API Key', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: 'JSON Web Token (JWT)', regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: 'Slack Bot Token', regex: /xoxb-[0-9]{9,13}-[0-9]{9,13}-[0-9a-zA-Z]{16,}/ },
  { name: 'Private Key Header', regex: /-----BEGIN (?:(?:RSA|OPENSSH|EC|DSA|ENCRYPTED|PGP)\s+)?PRIVATE KEY(?:\s+BLOCK)?-----/ },
  { name: 'Concatenated / Split Secret', regex: /(['"])(sk_live_|sk-proj-|sk-ant-api03-|AKIA|ASIA|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|AIza)\1\s*\+\s*(['"])[0-9a-zA-Z-_]{8,}\3/ },
  { name: 'Hardcoded Password Assignment', regex: /\b(password|passwd|api_secret|client_secret)\s*[:=]\s*['"][^'"]{6,}['"]/i }
];

const SLOP_PATTERNS = [
  { name: 'Lazy Placeholder Comment', regex: /\/\/\s*(TODO|FIXME|TBD|IMPLEMENT\s+LATER)/i },
  { name: 'Truncated Code Ellipsis', regex: /\/\/\s*\.{3}\s*(rest|remaining|unchanged)/i },
  { name: 'Generic Lazy Ellipsis', regex: /^\s*\.{3}\s*$/m },
  { name: 'Unimplemented Error Stub', regex: /throw new Error\(["'](Not implemented|TODO|stub)["']\)/i },
  { name: 'Empty Catch Block', regex: /catch\s*\([^)]*\)\s*\{\s*\}/ },
  { name: 'Sleep Timer Bypass', regex: /(setTimeout|sleep)\s*\(\s*[0-9]+\s*\)/ }
];

const DEBUG_PATTERNS = [
  { name: 'Console Log Remnant', regex: /\bconsole\.(log|debug|dir)\s*\(/ },
  { name: 'Debugger Statement', regex: /\bdebugger;\b/ },
  { name: 'Python Print Debug', regex: /\bprint\s*\(\s*["']DEBUG/i }
];

const TEST_TAMPERING_PATTERNS = [
  { name: 'Skipped Test Suite / Case', regex: /\b(it|test|describe)(?:\s*\.\s*[a-zA-Z0-9_$]+)*\s*\.\s*(skip|skipIf|runIf)\s*\(|\b(xit|xtest)\s*\(|\b(it|test|describe)\s*\[\s*(['"`]skip['"`]|String\s*\(\s*['"`]skip['"`]\s*\))\s*\]|\b(it|test|describe)\s*\([^)]*,\s*\{[^}]*\bskip\s*:\s*(?:true|['"`][^'"`]+['"`])|\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\.\s*skip\s*\(\s*(?:\)|['"`])/ },
  { name: 'Test Todo Cheat (.todo bypass)', regex: /\b(it|test|describe)(?:\s*\.\s*[a-zA-Z0-9_$]+)*\s*\.\s*(todo)\s*\(/ },
  { name: 'Isolated Test Suite / Case (.only cheat)', regex: /\b(it|test|describe)(?:\s*\.\s*[a-zA-Z0-9_$]+)*\s*\.\s*(only)\s*\(|\b(it|test|describe)\s*\[\s*['"`]only['"`]\s*\]|\b(it|test|describe)\s*\([^)]*,\s*\{[^}]*\bonly\s*:\s*true\b/ },
  { name: 'Commented Out Assertion', regex: /(\/\/|\/\*)\s*(expect|assert(?:\.[a-zA-Z0-9_$]+)?|should(?:\.[a-zA-Z0-9_$]+)?)\s*\(/ },
  { name: 'Early Return Injection (Bypassing Test Execution)', regex: /^\s*return(?:\s*;|\s+[\w\d'"`[{]|\s*$)/ },
  { name: 'Process Exit Injection (Silent Test Killer)', regex: /\bprocess\s*\.\s*(?:exit|abort|kill|reallyExit)\s*\(|\b(?:globalThis|global|window)\s*\.\s*process\s*\.\s*(?:exit|abort|kill|reallyExit)\s*\(|(?:\b(?:globalThis|global|window)\s*\[\s*['"`]process['"`]\s*\]|\bprocess)\s*\[\s*['"`](?:exit|reallyExit|abort|kill)['"`]\s*\]\s*\(|\bReflect\s*\.\s*get\s*\(\s*(?:(?:globalThis|global|window)(?:\s*\.\s*process|\s*\[\s*['"`]process['"`]\s*\])|process)\s*,\s*['"`](?:exit|reallyExit|abort|kill)['"`]\s*\)|\bReflect\s*\.\s*apply\s*\(\s*(?:(?:globalThis|global|window)\s*\.\s*)?process\s*\.\s*(?:exit|reallyExit)\b|\b(?:const|let|var)\s*\{[^}]*\b(?:exit|abort|kill|reallyExit)\b[^}]*\}\s*=\s*(?:(?:globalThis|global|window)\s*\.\s*)?process\b|\b(?:const|let|var)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*(?:(?:globalThis|global|window)\s*\.\s*)?process\s*\.\s*(?:exit|abort|kill|reallyExit)\b/ },
  { name: 'Local Assertion Library Shadowing', regex: /\b(?:const|let|var)\s+(?:expect|assert|should)\s*=/ },
  { name: 'Test Runner Global Monkey-Patching / Hijacking', regex: /\b(globalThis|global|window)\s*\.\s*(it|test|describe|expect|assert)\s*=|^\s*(?:it|test|describe)\s*=\s*|\b(?:Object\.defineProperty|Reflect\.set)\s*\(\s*(?:globalThis|global|window)\s*,\s*['"`](?:it|test|describe|expect|assert)['"`]/ },
  { name: 'Test Matcher Hijacking (expect.extend)', regex: /\bexpect\s*\.\s*extend\s*\(/ },
  { name: 'Unhandled Asynchronous Timer or Microtask in Test Execution', regex: /\b(setTimeout|setImmediate|queueMicrotask|process\.nextTick)\s*\(/ },
  { name: 'Dead Branch Conditional Assertion Wrap', regex: /\bif\s*\(\s*(?:false|0|null|undefined|!\s*(?:true|1))\s*\)\s*(?:\{|\b(?:assert|expect|should|return|throw)\b)/ },
  { name: 'Tautological Assertion Cheat', regex: /\bexpect\s*\(\s*([^()\r\n]{1,120})\s*\)\s*\.\s*(toBe|toEqual|toStrictEqual)\s*\(\s*\1\s*\)|\bexpect\s*\(\s*(true|false|1|0|'[^'\r\n]{0,80}'|"[^"\r\n]{0,80}")\s*\)\s*\.\s*(toBeTruthy|toBeFalsy|toBeDefined)\s*\(\s*\)|\bassert\.(?:strictEqual|equal|deepStrictEqual)\s*\(\s*([^,\r\n]{1,120})\s*,\s*\5\s*\)|\bassert(\.ok)?\s*\(\s*(?:true|1)\s*\)|\bexpect\s*\(\s*typeof\s+[^()\r\n]{1,120}\)\.toBe\s*\(\s*['"][^'"\r\n]{1,40}['"]\s*\)|\bexpect\s*\(\s*\[[^\]\r\n]{0,120}\]\[0\]\s*\)\.toBe\s*\(/i }
];

function hasConstantFalseIf(text) {
  const m = /\bif\s*\(\s*(-?\d+(?:\.\d+)?)\s*(===|==|!==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)\s*\)\s*(?:\{|\b(?:assert|expect|should|return|throw)\b)/.exec(text);
  if (!m) return false;
  const a = Number(m[1]);
  const op = m[2];
  const b = Number(m[3]);
  if (op === '>') return !(a > b);
  if (op === '<') return !(a < b);
  if (op === '>=') return !(a >= b);
  if (op === '<=') return !(a <= b);
  if (op === '===' || op === '==') return !(a === b);
  if (op === '!==' || op === '!=') return !(a !== b);
  return false;
}

export function foldStringLiterals(text) {
  let folded = text.replace(ZERO_WIDTH_REGEX, '');

  // 0. Decode hex (\xHH), BMP unicode (\uHHHH), and ES6 unicode code point (\u{...}) escape sequences in strings
  folded = folded.replace(/\\x([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  folded = folded.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (m, cp) => {
    const code = parseInt(cp, 16);
    return code <= 0x10FFFF ? String.fromCodePoint(code) : m;
  });
  folded = folded.replace(/\\u([0-9a-fA-F]{4})/g, (m, u) => String.fromCharCode(parseInt(u, 16)));

  // 1. Evaluate Buffer.from(hex, 'hex')
  folded = folded.replace(/Buffer\.from\s*\(\s*['"]([0-9a-fA-F]{8,})['"]\s*,\s*['"]hex['"]\s*\)(\.toString\(\s*['"]?utf-?8['"]?\s*\))?/g, (m, hex) => {
    try {
      return "'" + Buffer.from(hex, 'hex').toString('utf-8') + "'";
    } catch {
      return m;
    }
  });

  // 2. Evaluate String.fromCharCode(...) / String.fromCodePoint(...) including spread arrays (...[...]), bitwise, arithmetic, and hex expressions
  folded = folded.replace(/String\.(fromCharCode|fromCodePoint)\s*\(\s*(?:\.\.\.\s*\[\s*)?([0-9a-fA-FxX\s,\^\&\|\+\-\*\/\(\)]+?)(?:\s*\])?\s*\)/g, (m, fn, nums) => {
    try {
      const chars = nums.split(',').map(expr => {
        const trimmed = expr.trim();
        if (/^[0-9a-fA-FxX\s\^\&\|\+\-\*\/\(\)]+$/.test(trimmed)) {
          return String.fromCharCode(Function(`'use strict'; return (${trimmed});`)());
        }
        return '';
      }).join('');
      return "'" + chars + "'";
    } catch {
      return m;
    }
  });

  // 2b. Evaluate numeric byte arrays: TextDecoder.decode(new Uint8Array(Array.of(...))), Uint8Array([...]), Uint8Array.from([...]), Buffer.from([...])
  folded = folded.replace(
    /(?:new\s+TextDecoder\s*\([^)]*\)\s*\.\s*decode\s*\(\s*)?(?:(?:new\s+)?Uint8Array(?:\.from)?|Buffer\.from)\s*\(\s*(?:Array\.of\s*\(|\[)\s*([0-9a-fA-FxX\s,\^\&\|\+\-\*\/\(\)]+?)\s*(?:\)|\])\s*\)(?:\s*\))?/g,
    (m, nums) => {
      try {
        const bytes = nums.split(',').map(expr => {
          const trimmed = expr.trim();
          if (/^[0-9a-fA-FxX\s\^\&\|\+\-\*\/\(\)]+$/.test(trimmed)) {
            const val = Number(Function(`'use strict'; return (${trimmed});`)());
            if (Number.isInteger(val) && val >= 0 && val <= 255) return val;
          }
          return null;
        });
        if (bytes.length >= 4 && bytes.every(b => b !== null)) {
          return "'" + Buffer.from(bytes).toString('utf-8') + "'";
        }
        return m;
      } catch {
        return m;
      }
    }
  );

  // 3. Evaluate String.split('').reverse().join('')
  folded = folded.replace(/['"]([a-zA-Z0-9_\-\/+=$]{8,})['"]\.split\(['"]{2}\)\.reverse\(\)\.join\(['"]{2}\)/g, (m, s) => {
    return "'" + s.split('').reverse().join('') + "'";
  });

  // 4. Evaluate function templates: ${(() => 'AKIA')()}
  folded = folded.replace(/\$\{\s*\(\s*\(\s*\)\s*=>\s*['"]([^'"]+)['"]\s*\)\s*\(\s*\)\s*\}/g, '$1');

  // 5. Fold array joins: ['a', 'b', 'c'].join('') -> 'abc'
  folded = folded.replace(/\[\s*((?:['"`][^'"`\r\n]*['"`]\s*,\s*)+['"`][^'"`\r\n]*['"`])\s*\]\s*\.\s*join\s*\(\s*['"`]{2}\s*\)/g, (m, items) => {
    const joined = items.split(',').map(part => part.trim().slice(1, -1)).join('');
    return joined.includes("'") ? JSON.stringify(joined) : `'${joined}'`;
  });

  // 6. Fold native .concat(): 'a'.concat('b') -> 'ab'
  folded = folded.replace(/(['"`])([a-zA-Z0-9_\-\/+=$]+)\1\.concat\((['"`])([a-zA-Z0-9_\-\/+=$]+)\3\)/g, '$1$2$4$1');

  // 7. Fold template literals: `${'a'}${'b'}` -> 'ab'
  folded = folded.replace(/\$\{\s*(['"`])([a-zA-Z0-9_\-\/+=$]+)\1\s*\}\s*\$\{\s*(['"`])([a-zA-Z0-9_\-\/+=$]+)\3\s*\}/g, '$2$4');

  // 8. Fold .replace() and .replaceAll() string transformations
  folded = folded.replace(/(['"])([^'"]+)\1\.(replace|replaceAll)\s*\(\s*(['"])([^'"]+)\4\s*,\s*(['"])([^'"]*)\6\s*\)/g, (m, q1, str, method, q2, search, q3, repl) => {
    try {
      if (method === 'replaceAll') {
        return q1 + str.replaceAll(search, repl) + q1;
      } else {
        return q1 + str.replace(search, repl) + q1;
      }
    } catch {
      return m;
    }
  });

  // 9. Fold string concatenation in loop for arbitrary multi-part additions (callback replacer prevents $&/$1 injection)
  let prev;
  let iterations = 0;
  do {
    prev = folded;
    folded = folded.replace(/(['"`])([^'"`\r\n]{1,500})\1\s*\+\s*(['"`])([^'"`\r\n]{1,500})\3/g, (m, q1, a, q2, b) => q1 + a + b + q1);
    iterations++;
  } while (folded !== prev && iterations < 20);

  return folded;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Shared single-line + cross-line string variable resolution helper.
 * Properly handles `$`-prefixed identifiers (`$p1 + $p2`) and special characters (`$&`, `!@#`) without `$&`/`$1` replacement injection.
 */
export function resolveLineWithVars(line, fileStringVars) {
  const normalized = line.replace(ZERO_WIDTH_REGEX, '');
  const folded = foldStringLiterals(normalized);
  let resolved = folded;

  if (fileStringVars.size > 0) {
    for (const [varName, varVal] of fileStringVars.entries()) {
      const escapedName = escapeRegExp(varName);
      const varRef = new RegExp(`(?<![a-zA-Z0-9_$.])${escapedName}(?![a-zA-Z0-9_$])(?!\\s*[:=])`, 'g');
      if (varRef.test(resolved)) {
        const quotedVal = varVal.includes("'") ? JSON.stringify(varVal) : `'${varVal}'`;
        resolved = resolved.replace(varRef, () => quotedVal);
      }
    }
    resolved = foldStringLiterals(resolved);
  }

  const varAssign = /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(['"`])([^'"`\r\n]{1,500})\2/.exec(resolved);
  if (varAssign) {
    fileStringVars.set(varAssign[1], varAssign[3]);
  }

  return { normalized, folded, resolved };
}

export function inspectBase64Payloads(text) {
  const normalized = text.replace(ZERO_WIDTH_REGEX, '');
  const b64Regex = /\b[A-Za-z0-9+/=]{16,}\b/g;
  let m;
  while ((m = b64Regex.exec(normalized)) !== null) {
    try {
      const decoded = Buffer.from(m[0], 'base64').toString('utf-8');
      if (/\b(AKIA|ASIA)[0-9A-Z]{16}\b/.test(decoded) || /sk_live_[0-9a-zA-Z]{24}/.test(decoded) || /sk-proj-/.test(decoded) || /ghp_[0-9a-zA-Z]{36}/.test(decoded)) {
        return { matched: m[0], decodedSnippet: decoded.slice(0, 30) };
      }
    } catch {}
  }
  return null;
}

export function calculateShannonEntropy(str) {
  const len = str.length;
  if (len === 0) return 0;
  const freq = {};
  for (let i = 0; i < len; i++) {
    const char = str[i];
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}


function astAuditTestSnippet(file, code) {
  const astIssues = [];
  if (!code || !code.trim()) return astIssues;

  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      errorRecovery: true,
      plugins: ['typescript', 'jsx', 'classProperties', 'decorators-legacy', 'dynamicImport', 'topLevelAwait']
    });
  } catch {
    return astIssues;
  }

  const processAliases = new Set();
  const processExitFuncs = new Set();
  const skippedAliases = new Set();
  const isAssertionName = (name) => /^(expect|assert|should)$/.test(name);
  const evalStaticStr = (n) => {
    if (!n) return null;
    if (n.type === 'StringLiteral') return n.value;
    if (n.type === 'TemplateLiteral' && n.expressions.length === 0) return n.quasis.map(q => q.value.cooked).join('');
    if (n.type === 'BinaryExpression' && n.operator === '+') {
      const l = evalStaticStr(n.left);
      const r = evalStaticStr(n.right);
      if (l !== null && r !== null) return l + r;
    }
    return null;
  };

  try {
    traverse(ast, {
      ImportDeclaration(p) {
        const src = p.node.source?.value;
        if (src !== 'process' && src !== 'node:process') return;
        for (const spec of p.node.specifiers || []) {
          if (spec.type === 'ImportSpecifier') {
            const imported = spec.imported?.name || spec.imported?.value;
            if (['exit', 'abort', 'kill', 'reallyExit'].includes(imported) && spec.local?.name) {
              processExitFuncs.add(spec.local.name);
            }
          } else if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportNamespaceSpecifier') {
            if (spec.local?.name) processAliases.add(spec.local.name);
          }
        }
      },
      AssignmentExpression(p) {
        const right = p.node.right;
        if (
          p.node.left?.type === 'Identifier' &&
          right?.type === 'MemberExpression' &&
          ((right.object?.type === 'Identifier' && right.object.name === 'process') ||
           (right.object?.type === 'MemberExpression' && ['globalThis', 'global', 'window'].includes(right.object.object?.name) && right.object.property?.name === 'process'))
        ) {
          const prop = right.property?.name || right.property?.value;
          if (['exit', 'abort', 'kill', 'reallyExit'].includes(prop)) {
            processExitFuncs.add(p.node.left.name);
          }
        }
      },
      VariableDeclarator(p) {
        const init = p.node.init;
        if (
          init?.type === 'MemberExpression' &&
          init.object?.type === 'Identifier' &&
          ['it', 'test', 'describe'].includes(init.object.name) &&
          ['skip', 'only', 'todo', 'skipIf', 'runIf'].includes(init.property?.name || evalStaticStr(init.property)) &&
          p.node.id?.type === 'Identifier'
        ) {
          skippedAliases.add(p.node.id.name);
          return;
        }
        if (p.node.id?.type === 'ArrayPattern' && init?.type === 'ArrayExpression') {
          (init.elements || []).forEach((elem, idx) => {
            if (
              elem?.type === 'MemberExpression' &&
              elem.object?.type === 'Identifier' &&
              ['it', 'test', 'describe'].includes(elem.object.name) &&
              ['skip', 'only', 'todo', 'skipIf', 'runIf'].includes(elem.property?.name || evalStaticStr(elem.property))
            ) {
              const targetId = p.node.id.elements?.[idx];
              if (targetId?.type === 'Identifier') skippedAliases.add(targetId.name);
            }
          });
          return;
        }
        if (
          p.node.id?.type === 'Identifier' &&
          init?.type === 'CallExpression' &&
          init.callee?.type === 'MemberExpression' &&
          init.callee.object?.name === 'Reflect' &&
          init.callee.property?.name === 'get' &&
          init.arguments?.[0]?.type === 'Identifier' &&
          ['it', 'test', 'describe'].includes(init.arguments[0].name) &&
          ['skip', 'only', 'todo', 'skipIf', 'runIf'].includes(evalStaticStr(init.arguments[1]))
        ) {
          skippedAliases.add(p.node.id.name);
          return;
        }
        if (
          p.node.id?.type === 'ObjectPattern' &&
          init?.type === 'Identifier' &&
          ['it', 'test', 'describe'].includes(init.name)
        ) {
          for (const prop of p.node.id.properties || []) {
            if (prop.type !== 'ObjectProperty') continue;
            const key = prop.key?.name || prop.key?.value;
            const local = prop.value?.name || key;
            if (['skip', 'only', 'todo', 'skipIf', 'runIf'].includes(key) && local) {
              skippedAliases.add(local);
            }
          }
          return;
        }
        if (
          init?.type === 'MemberExpression' &&
          ((init.object?.type === 'Identifier' && init.object.name === 'process') ||
           (init.object?.type === 'MemberExpression' && ['globalThis', 'global', 'window'].includes(init.object.object?.name) && init.object.property?.name === 'process'))
        ) {
          const prop = init.property?.name || init.property?.value;
          if (['exit', 'abort', 'kill', 'reallyExit'].includes(prop) && p.node.id?.type === 'Identifier') {
            processExitFuncs.add(p.node.id.name);
            return;
          }
        }
        const isImportExpr =
          (init?.type === 'AwaitExpression' &&
           ((init.argument?.type === 'CallExpression' && init.argument.callee?.type === 'Import') ||
            init.argument?.type === 'ImportExpression'));
        if (isImportExpr) {
          const src = init.argument.source?.value || init.argument.arguments?.[0]?.value;
          if ((src === 'process' || src === 'node:process') && p.node.id?.type === 'Identifier') {
            processAliases.add(p.node.id.name);
            return;
          }
        }
        const isProc = (init?.type === 'Identifier' && init.name === 'process') ||
          (init?.type === 'MemberExpression' && ['globalThis', 'global', 'window'].includes(init.object?.name) && init.property?.name === 'process');
        if (!isProc) return;
        if (p.node.id?.type === 'Identifier') {
          processAliases.add(p.node.id.name);
        } else if (p.node.id?.type === 'ObjectPattern') {
          for (const prop of p.node.id.properties || []) {
            const keyName = prop.key?.name || prop.key?.value;
            const aliasName = prop.value?.name || keyName;
            if (['exit', 'abort', 'kill', 'reallyExit'].includes(keyName) && aliasName) {
              processExitFuncs.add(aliasName);
            }
          }
        }
      },
      CallExpression(p) {
        const callee = p.node.callee;
        // 0a-indirect. Indirect invocation: test.skip.call(...) / Reflect.apply(test.skip, ...)
        if (callee?.type === 'MemberExpression' && ['call', 'apply', 'bind'].includes(callee.property?.name)) {
          const obj = callee.object;
          if (
            (obj?.type === 'MemberExpression' && ['skip', 'only', 'todo'].includes(obj.property?.name)) ||
            (obj?.type === 'Identifier' && skippedAliases.has(obj.name))
          ) {
            astIssues.push({
              severity: 'CRITICAL',
              category: 'TEST_TAMPERING',
              file,
              line: p.node.loc?.start?.line || 1,
              description: `AI Agent Attempted Test Weakening: Indirect ${obj.property?.name || obj.name}.${callee.property.name}() (AST)`,
              snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || `${callee.property.name}()`
            });
            return;
          }
        }
        if (
          callee?.type === 'CallExpression' &&
          callee.callee?.type === 'MemberExpression' &&
          callee.callee.object?.name === 'Reflect' &&
          callee.callee.property?.name === 'get' &&
          callee.arguments?.[0]?.type === 'Identifier' &&
          ['it', 'test', 'describe'].includes(callee.arguments[0].name) &&
          ['skip', 'only', 'todo', 'skipIf', 'runIf'].includes(evalStaticStr(callee.arguments[1]))
        ) {
          astIssues.push({
            severity: 'CRITICAL',
            category: 'TEST_TAMPERING',
            file,
            line: p.node.loc?.start?.line || 1,
            description: 'AI Agent Attempted Test Weakening: Reflect.get on test.skip (AST)',
            snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || 'Reflect.get(test, skip)'
          });
          return;
        }
        if (
          callee?.type === 'MemberExpression' &&
          callee.object?.name === 'Reflect' &&
          callee.property?.name === 'apply' &&
          p.node.arguments[0]
        ) {
          const target = p.node.arguments[0];
          if (
            (target.type === 'MemberExpression' && ['skip', 'only', 'todo'].includes(target.property?.name)) ||
            (target.type === 'Identifier' && skippedAliases.has(target.name))
          ) {
            astIssues.push({
              severity: 'CRITICAL',
              category: 'TEST_TAMPERING',
              file,
              line: p.node.loc?.start?.line || 1,
              description: 'AI Agent Attempted Test Weakening: Reflect.apply on test.skip (AST)',
              snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || 'Reflect.apply(skip)'
            });
            return;
          }
        }
        // 0a. Aliased skip/only call: const s = test.skip; s(...);
        if (callee?.type === 'Identifier' && skippedAliases.has(callee.name)) {
          astIssues.push({
            severity: 'CRITICAL',
            category: 'TEST_TAMPERING',
            file,
            line: p.node.loc?.start?.line || 1,
            description: `AI Agent Attempted Test Weakening: Aliased Test Skip/Only ${callee.name}() (AST)`,
            snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || `${callee.name}()`
          });
          return;
        }
        // 0b. Computed string-concat process exit: globalThis['pro'+'cess']['ex'+'it'](0)
        if (callee?.type === 'MemberExpression' && callee.computed) {
          const propStr = evalStaticStr(callee.property);
          if (['exit', 'abort', 'kill', 'reallyExit'].includes(propStr)) {
            const obj = callee.object;
            const isComputedGlobalProc =
              (obj?.type === 'Identifier' && (obj.name === 'process' || processAliases.has(obj.name))) ||
              (obj?.type === 'MemberExpression' &&
               obj.object?.type === 'Identifier' &&
               ['globalThis', 'global', 'window'].includes(obj.object.name) &&
               evalStaticStr(obj.property) === 'process');
            if (isComputedGlobalProc) {
              astIssues.push({
                severity: 'CRITICAL',
                category: 'TEST_TAMPERING',
                file,
                line: p.node.loc?.start?.line || 1,
                description: `AI Agent Attempted Test Weakening: Obfuscated Process ${propStr}() Injection (AST)`,
                snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || `process.${propStr}()`
              });
              return;
            }
          }
        }
        // 0. Direct destructured call: const { abort } = process; abort();
        if (callee?.type === 'Identifier' && processExitFuncs.has(callee.name)) {
          astIssues.push({
            severity: 'CRITICAL',
            category: 'TEST_TAMPERING',
            file,
            line: p.node.loc?.start?.line || 1,
            description: `AI Agent Attempted Test Weakening: Destructured Process ${callee.name}() Injection (AST)`,
            snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || `${callee.name}()`
          });
          return;
        }
        // 1. Aliased process exit/abort/kill: const p = process; p.exit(0);
        if (callee?.type === 'MemberExpression' && callee.object?.type === 'Identifier' && processAliases.has(callee.object.name)) {
          const prop = callee.property?.name || callee.property?.value;
          if (['exit', 'abort', 'kill', 'reallyExit'].includes(prop)) {
            astIssues.push({
              severity: 'CRITICAL',
              category: 'TEST_TAMPERING',
              file,
              line: p.node.loc?.start?.line || 1,
              description: `AI Agent Attempted Test Weakening: Aliased Process ${prop}() Injection (AST)`,
              snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || `${callee.object.name}.${prop}()`
            });
          }
        }
        // 2. Empty test body: test('x', () => {}) or it('x', function() {})
        let testFnName = null;
        if (callee?.type === 'Identifier' && ['test', 'it'].includes(callee.name)) {
          testFnName = callee.name;
        } else if (
          callee?.type === 'MemberExpression' &&
          callee.object?.type === 'Identifier' &&
          ['test', 'it'].includes(callee.object.name) &&
          (callee.property?.name || callee.property?.value) !== 'todo'
        ) {
          const propName = callee.property?.name || callee.property?.value || '';
          testFnName = `${callee.object.name}.${propName}`;
        }
        if (testFnName && !/skip|only/i.test(testFnName)) {
          const hasCheatOptions = p.node.arguments.some(a =>
            a.type === 'ObjectExpression' &&
            a.properties?.some(prop => /^(skip|only)$/.test(prop.key?.name || prop.key?.value))
          );
          const cb = !hasCheatOptions && p.node.arguments.find(a => a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression');
          const isAssertionCall = (n) => {
            if (n?.type !== 'CallExpression') return false;
            let curr = n.callee;
            while (curr) {
              if (curr.type === 'Identifier') {
                return /\b(?:expect|assert|should)\b/i.test(curr.name);
              }
              if (curr.type === 'MemberExpression') {
                const prop = curr.property?.name || curr.property?.value || '';
                if (/\b(?:expect|assert|should)\b/i.test(prop)) return true;
                curr = curr.object;
              } else if (curr.type === 'CallExpression') {
                curr = curr.callee;
              } else {
                break;
              }
            }
            return false;
          };
          if (cb && cb.body?.type === 'BlockStatement') {
            const stmts = cb.body.body;
            if (stmts.length === 0) {
              astIssues.push({
                severity: 'CRITICAL',
                category: 'TEST_TAMPERING',
                file,
                line: p.node.loc?.start?.line || 1,
                description: `AI Agent Attempted Test Weakening: Empty ${testFnName}() Body (AST)`,
                snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || `${testFnName}(...)`
              });
            } else if (stmts[0]?.type === 'ReturnStatement') {
              astIssues.push({
                severity: 'CRITICAL',
                category: 'TEST_TAMPERING',
                file,
                line: stmts[0].loc?.start?.line || p.node.loc?.start?.line || 1,
                description: `AI Agent Attempted Test Weakening: Early return injection in ${testFnName}() (AST)`,
                snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || `${testFnName}(...)`
              });
            } else {
              let hasAssertion = false;
              const cbPath = p.get('arguments')[p.node.arguments.indexOf(cb)];
              cbPath.traverse({
                CallExpression(inner) {
                  if (isAssertionCall(inner.node)) hasAssertion = true;
                }
              });
              if (!hasAssertion) {
                astIssues.push({
                  severity: 'CRITICAL',
                  category: 'TEST_TAMPERING',
                  file,
                  line: p.node.loc?.start?.line || 1,
                  description: `AI Agent Attempted Test Weakening: Non-asserting ${testFnName}() body (AST)`,
                  snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || `${testFnName}(...)`
                });
              }
            }
          } else if (cb && cb.body && cb.body.type !== 'BlockStatement') {
            if (!isAssertionCall(cb.body)) {
              astIssues.push({
                severity: 'CRITICAL',
                category: 'TEST_TAMPERING',
                file,
                line: cb.body.loc?.start?.line || p.node.loc?.start?.line || 1,
                description: `AI Agent Attempted Test Weakening: Non-asserting concise arrow return in ${testFnName}() (AST)`,
                snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || `${testFnName}(...)`
              });
            }
          }
        }
      },
      TryStatement(p) {
        const handler = p.node.handler;
        if (!handler || !handler.body) return;
        const catchStmts = handler.body.body || [];
        const hasRethrow = catchStmts.some(st => st.type === 'ThrowStatement');
        if (catchStmts.length === 0 || !hasRethrow) {
          let hasAssertionInTry = false;
          p.get('block').traverse({
            CallExpression(inner) {
              const c = inner.node.callee;
              if (c.type === 'Identifier' && isAssertionName(c.name)) hasAssertionInTry = true;
              if (c.type === 'MemberExpression' && c.object?.type === 'Identifier' && isAssertionName(c.object.name)) hasAssertionInTry = true;
            }
          });
          if (hasAssertionInTry) {
            astIssues.push({
              severity: 'CRITICAL',
              category: 'TEST_TAMPERING',
              file,
              line: p.node.loc?.start?.line || 1,
              description: 'AI Agent Attempted Test Weakening: Swallowed Assertion in Non-Throwing try/catch (AST)',
              snippet: code.split('\n')[(p.node.loc?.start?.line || 1) - 1]?.trim().slice(0, 80) || 'try { ... } catch {}'
            });
          }
        }
      }
    });
  } catch {
    // Graceful fallback on partial diff snippets
  }

  return astIssues;
}

export function buildSarifReport(issues, toolName = 'aveyx-review', version = '3.0.4') {
  const rulesMap = new Map();
  const results = [];

  for (const iss of issues) {
    const ruleId = iss.category || 'AVEYX_FINDING';
    if (!rulesMap.has(ruleId)) {
      rulesMap.set(ruleId, {
        id: ruleId,
        shortDescription: { text: ruleId.replace(/_/g, ' ') },
        helpUri: 'https://github.com/AmanullaShaikh/aveyx#readme'
      });
    }
    const level = (iss.severity === 'CRITICAL' || iss.severity === 'HIGH') ? 'error' : (iss.severity === 'MEDIUM' ? 'warning' : 'note');
    results.push({
      ruleId,
      level,
      message: { text: `${iss.description}${iss.snippet ? ` (${iss.snippet})` : ''}` },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: (iss.file || 'unknown').replace(/\\/g, '/') },
            region: { startLine: iss.line || 1 }
          }
        }
      ]
    });
  }

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            version,
            rules: Array.from(rulesMap.values())
          }
        },
        results
      }
    ]
  };
}

function getGitDiff(targetBranch = null, stagedOnly = false) {
  try {
    if (targetBranch) {
      return execFileSync('git', ['diff', `${targetBranch}...HEAD`], { encoding: 'utf-8' });
    }
    if (stagedOnly) {
      return execFileSync('git', ['diff', '--cached'], { encoding: 'utf-8' });
    }
    // Default: Check working tree diff + staged diff + untracked files
    let diff = '';
    try {
      diff += execFileSync('git', ['diff', 'HEAD'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {}
    if (!diff.trim()) {
      try {
        diff = execSync('git diff', { encoding: 'utf-8' });
      } catch {}
    }

    // Include untracked files in working tree diff
    try {
      const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
      const untrackedFiles = statusOutput
        .split('\n')
        .filter(line => line.startsWith('?? '))
        .map(line => line.slice(3).trim());

      for (const file of untrackedFiles) {
        if (!fs.existsSync(file)) continue;
        try {
          const stat = fs.statSync(file);
          if (stat.isDirectory() || stat.size > 1024 * 512) continue;
          const content = fs.readFileSync(file, 'utf-8');
          diff += `\ndiff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n`;
          diff += content.split('\n').map(l => '+' + l).join('\n') + '\n';
        } catch {}
      }
    } catch {}

    return diff;
  } catch (err) {
    return '';
  }
}

/**
 * Audits a raw git diff for leaked secrets, AI slop, debug statements, and test tampering.
 */
export function auditDiff(rawDiff) {
  if (!rawDiff || !rawDiff.trim()) {
    return {
      clean: true,
      issues: [],
      files: [],
      stats: { secrets: 0, slop: 0, debug: 0, tampering: 0 }
    };
  }

  const lines = rawDiff.split('\n');
  let currentFile = 'unknown';
  const changedFiles = new Set();
  const testFiles = new Set();
  const issues = [];
  const deletedAssertions = [];
  const fileAddedAssertions = new Map();
  const commentedAssertions = new Set();
  const fileStringVars = new Map();
  const testAddedSnippets = new Map();
  const deletedPkgTestLine = new Set();
  let inTestOptionsBlock = false;
  let testOptionsDepth = 0;
  let helperFnDepth = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const parts = line.split(' ');
      currentFile = parts[parts.length - 1].replace(/^b\//, '');
      changedFiles.add(currentFile);
      fileStringVars.clear();
      inTestOptionsBlock = false;
      testOptionsDepth = 0;
      helperFnDepth = 0;

      // Check if sensitive credential/env file itself is modified or added
      const baseName = currentFile.split('/').pop().toLowerCase();
      if ((baseName.startsWith('.env') && !baseName.endsWith('.example')) || baseName.endsWith('.pem') || baseName.endsWith('.key') || baseName === 'id_rsa') {
        issues.push({
          severity: 'CRITICAL',
          category: 'SECRET_LEAK',
          file: currentFile,
          description: `Exposed sensitive environment or credential key file: ${currentFile}`,
          snippet: `[Sensitive File Added/Modified: ${currentFile}]`
        });
      }

      if (
        currentFile.startsWith('.git/hooks/') ||
        currentFile.startsWith('.github/workflows/') ||
        currentFile === '.claude/settings.json' ||
        currentFile === '.claude/settings.local.json'
      ) {
        issues.push({
          severity: 'CRITICAL',
          category: 'PROTECTED_CONFIG_TAMPER',
          file: currentFile,
          description: `Unauthorized modification to protected agent/hook config: ${currentFile}`,
          snippet: `[Protected Config: ${currentFile}]`
        });
      }

      if (currentFile.includes('.test.') || currentFile.includes('.spec.') || currentFile.includes('tests/')) {
        testFiles.add(currentFile);
      }
      continue;
    }

    // Collect deleted assertions & package.json test script tampering
    if (line.startsWith('-') && !line.startsWith('---')) {
      if (currentFile === 'package.json' && /"test"\s*:/.test(line)) {
        deletedPkgTestLine.add(currentFile);
      }
      const isSelfAuditTest = currentFile.includes('diff-audit.test.') || currentFile.includes('redteam') || currentFile.includes('fuzz-stress.test.');
      const isTestFile = (currentFile.includes('.test.') || currentFile.includes('.spec.') || currentFile.includes('tests/')) && !isSelfAuditTest;
      const deletedText = line.substring(1).trim();
      if (isTestFile && /\b(expect|assert(?:\.[a-zA-Z0-9_$]+)?|should(?:\.[a-zA-Z0-9_$]+)?)\s*\(/.test(deletedText) && !deletedText.startsWith('//')) {
        deletedAssertions.push({ file: currentFile, snippet: deletedText.slice(0, 80) });
      }
    }

    // Audit added lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedText = line.substring(1);

      const isSelfAuditTest = currentFile.includes('diff-audit.test.') || currentFile.includes('redteam') || currentFile.includes('fuzz-stress.test.');
      if (currentFile === 'package.json' && deletedPkgTestLine.has('package.json') && /"test"\s*:\s*"(?:echo\b|true\b|exit\s+0|:|\s*node\s+-e\s+['"]?(?:0|process\.exit\(0\)|;?)['"]?|.*(?:\|\||\||;|&&|&)\s*(?:exit\s+[0-9]+|true\b|:))/i.test(addedText)) {
        issues.push({
          severity: 'CRITICAL',
          category: 'TEST_TAMPERING',
          file: currentFile,
          description: 'AI Agent Weakened package.json "test" script to a no-op',
          snippet: addedText.trim().slice(0, 80)
        });
      }
      const lineEval = !isSelfAuditTest ? resolveLineWithVars(addedText, fileStringVars) : null;

      // Check secrets
      if (!isSelfAuditTest) {
        const { normalized: normalizedAdded, folded: foldedText, resolved: resolvedText } = lineEval;

        for (const sp of SECRET_PATTERNS) {
          if (sp.regex.test(normalizedAdded) || sp.regex.test(foldedText) || sp.regex.test(resolvedText)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'SECRET_LEAK',
              file: currentFile,
              description: `Exposed ${sp.name}`,
              snippet: normalizedAdded.trim().slice(0, 80)
            });
            break;
          }
        }

        // Base64 payload deep inspection
        const b64Secret = inspectBase64Payloads(normalizedAdded) || inspectBase64Payloads(foldedText) || inspectBase64Payloads(resolvedText);
        if (b64Secret) {
          issues.push({
            severity: 'CRITICAL',
            category: 'SECRET_LEAK',
            file: currentFile,
            description: 'Exposed Base64 Encoded Credential Payload',
            snippet: b64Secret.matched.slice(0, 40)
          });
        }

        // Shannon entropy scan for hardcoded tokens
        const assignMatch = /\b(?:const|let|var|[a-zA-Z0-9_]+)\s*[:=]\s*['"]([A-Za-z0-9_\-\/+=$]{30,})['"]/.exec(addedText);
        if (assignMatch) {
          const val = assignMatch[1];
          if (calculateShannonEntropy(val) > 4.5 && /[A-Z]/.test(val) && /[a-z]/.test(val) && /[0-9]/.test(val)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'SECRET_LEAK',
              file: currentFile,
              description: 'High-Entropy Secret / Token Detected (Shannon Entropy > 4.5)',
              snippet: val.slice(0, 10) + '...' + val.slice(-4)
            });
          }
        }
      }

      // Check AI slop (only in code files, not rule manifests or docs)
      const isDocOrRule = /\.(md|mdc|txt)$/i.test(currentFile) || ['CLAUDE.md', '.cursorrules', '.windsurfrules'].some(f => currentFile.endsWith(f));
      if (!isDocOrRule && !isSelfAuditTest) {
        for (const slp of SLOP_PATTERNS) {
          if (slp.regex.test(addedText)) {
            issues.push({
              severity: 'HIGH',
              category: 'AI_SLOP',
              file: currentFile,
              description: `Found ${slp.name}`,
              snippet: addedText.trim().slice(0, 80)
            });
          }
        }
      }

      // Check test tampering if modifying tests
      const isTestFile = currentFile.includes('.test.') || currentFile.includes('.spec.') || currentFile.includes('tests/');
      if (isTestFile && !isSelfAuditTest) {
        if (!testAddedSnippets.has(currentFile)) testAddedSnippets.set(currentFile, []);
        testAddedSnippets.get(currentFile).push(addedText);
        if (/^\s*(?:await\s+)?(?:expect|assert(?:\.[a-zA-Z0-9_$]+)?|should(?:\.[a-zA-Z0-9_$]+)?)\s*\(/.test(addedText)) {
          fileAddedAssertions.set(currentFile, (fileAddedAssertions.get(currentFile) || 0) + 1);
        }
        const foldedText = lineEval.folded;
        const resolvedText = lineEval.resolved;

        // Track standalone helper function declarations so `return;` inside helpers doesn't false-positive
        const trimmedAdded = addedText.trim();
        if (helperFnDepth === 0 && /^(?:export\s+)?(?:async\s+)?function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/.test(trimmedAdded)) {
          const opens = (addedText.match(/\{/g) || []).length;
          const closes = (addedText.match(/\}/g) || []).length;
          if (opens > closes) {
            helperFnDepth = opens - closes;
          }
        } else if (helperFnDepth > 0) {
          const opens = (addedText.match(/\{/g) || []).length;
          const closes = (addedText.match(/\}/g) || []).length;
          helperFnDepth = Math.max(0, helperFnDepth + opens - closes);
        }

        // Track multiline test/it/describe option objects: test("x", {\n skip: true \n}, ...)
        if (!inTestOptionsBlock && /\b(?:it|test|describe)\s*\([^)]*,\s*\{[^}]*$/.test(addedText)) {
          inTestOptionsBlock = true;
          testOptionsDepth = (addedText.match(/\{/g) || []).length - (addedText.match(/\}/g) || []).length;
          if (testOptionsDepth <= 0) {
            inTestOptionsBlock = false;
            testOptionsDepth = 0;
          }
        } else if (inTestOptionsBlock) {
          if (/\bskip\s*:\s*(?:true|['"`][^'"`]+['"`])/.test(resolvedText) || /\bskip\s*:\s*(?:true|['"`][^'"`]+['"`])/.test(addedText)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'TEST_TAMPERING',
              file: currentFile,
              description: 'AI Agent Attempted Test Weakening: Skipped Test Suite / Case (multiline options)',
              snippet: addedText.trim().slice(0, 80)
            });
          } else if (/\bonly\s*:\s*true\b/.test(resolvedText) || /\bonly\s*:\s*true\b/.test(addedText)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'TEST_TAMPERING',
              file: currentFile,
              description: 'AI Agent Attempted Test Weakening: Isolated Test Suite / Case (.only cheat)',
              snippet: addedText.trim().slice(0, 80)
            });
          }
          testOptionsDepth += (addedText.match(/\{/g) || []).length - (addedText.match(/\}/g) || []).length;
          if (testOptionsDepth <= 0) {
            inTestOptionsBlock = false;
            testOptionsDepth = 0;
          }
        }

        for (const ttp of TEST_TAMPERING_PATTERNS) {
          if (ttp.name.startsWith('Early Return Injection') && helperFnDepth > 0) {
            continue;
          }
          if (ttp.regex.test(addedText) || ttp.regex.test(foldedText) || ttp.regex.test(resolvedText)) {
            issues.push({
              severity: 'CRITICAL',
              category: 'TEST_TAMPERING',
              file: currentFile,
              description: `AI Agent Attempted Test Weakening: ${ttp.name}`,
              snippet: addedText.trim().slice(0, 80)
            });
            if (ttp.name === 'Commented Out Assertion') {
              commentedAssertions.add(currentFile);
            }
          }
        }
        if (hasConstantFalseIf(addedText) || hasConstantFalseIf(foldedText) || hasConstantFalseIf(resolvedText)) {
          issues.push({
            severity: 'CRITICAL',
            category: 'TEST_TAMPERING',
            file: currentFile,
            description: 'AI Agent Attempted Test Weakening: Constant-False Dead Branch Wrap',
            snippet: addedText.trim().slice(0, 80)
          });
        }
      }

      // Check debug remnants (exclude CLI entrypoints and scripts)
      const isTestOrHelperFile = currentFile.includes('.test.') || currentFile.includes('.spec.') || currentFile.includes('tests/');
      const isCliOrScript = currentFile.startsWith('bin/') || currentFile.startsWith('scripts/') || currentFile.includes('cli.') || isTestOrHelperFile || isSelfAuditTest;
      if (!isCliOrScript) {
        for (const dbg of DEBUG_PATTERNS) {
          if (dbg.regex.test(addedText)) {
            issues.push({
              severity: 'MEDIUM',
              category: 'DEBUG_REMNANT',
              file: currentFile,
              description: `Residual ${dbg.name}`,
              snippet: addedText.trim().slice(0, 80)
            });
          }
        }
      }
    }
  }

  // Run Babel AST anti-tamper pass on added test file snippets
  for (const [tFile, snippetLines] of testAddedSnippets.entries()) {
    const astFindings = astAuditTestSnippet(tFile, snippetLines.join('\n'));
    for (const af of astFindings) {
      const isDuplicate = issues.some(i => i.file === af.file && i.category === af.category && i.snippet && af.snippet && (i.snippet.includes(af.snippet) || af.snippet.includes(i.snippet)));
      if (!isDuplicate) {
        issues.push(af);
      }
    }
  }

  // Reconcile deleted assertions strictly within the SAME file (prevents cross-file assertion smuggling)
  for (const del of deletedAssertions) {
    if (commentedAssertions.has(del.file)) continue;
    const inSameFile = fileAddedAssertions.get(del.file) || 0;
    if (inSameFile > 0) {
      fileAddedAssertions.set(del.file, inSameFile - 1);
      continue;
    }
    issues.push({
      severity: 'HIGH',
      category: 'TEST_TAMPERING',
      file: del.file,
      description: 'AI Agent Deleted Assertion Line from Test Suite',
      snippet: del.snippet
    });
  }

  const stats = {
    secrets: issues.filter(i => i.category === 'SECRET_LEAK').length,
    slop: issues.filter(i => i.category === 'AI_SLOP').length,
    debug: issues.filter(i => i.category === 'DEBUG_REMNANT').length,
    tampering: issues.filter(i => i.category === 'TEST_TAMPERING').length
  };

  return {
    clean: issues.length === 0,
    issues,
    files: Array.from(changedFiles),
    stats
  };
}

export function runDiffAuditCli(options = {}) {
  const diff = getGitDiff(options.branch, options.staged);
  const result = auditDiff(diff);

  if (options.format === 'sarif') {
    console.log(JSON.stringify(buildSarifReport(result.issues, 'aveyx-review', '3.0.4'), null, 2));
    const hasCritical = result.issues.some(iss => iss.severity === 'CRITICAL');
    if (!result.clean && (options.strict || hasCritical)) {
      process.exit(1);
    }
    return result;
  }

  if (options.format === 'markdown') {
    if (result.clean) {
      console.log('### ⚡ Aveyx Diff Review: PASSED\nZero leaked secrets, AI placeholders, or test tampering detected.');
    } else {
      console.log('### ❌ Aveyx Diff Review: FAILED\n');
      console.log(`Found **${result.issues.length}** critical issue(s):\n`);
      result.issues.forEach(iss => {
        console.log(`- **[${iss.severity}] ${iss.category}** in \`${iss.file}\`: ${iss.description}`);
        console.log(`  \`\`\`\n  ${iss.snippet}\n  \`\`\``);
      });
      console.log('\n> *Agent execution halted to prevent codebase degradation.*');
    }
    return result;
  }

  console.log(`\n${c.cyan}${c.bold}═════ AVEYX ZERO-SLOP DIFF AUDITOR ═════${c.reset}`);
  console.log(`  Files Audited: ${c.bold}${result.files.length}${c.reset}`);
  console.log(`  Critical Secrets: ${result.stats.secrets > 0 ? c.red : c.green}${result.stats.secrets}${c.reset}`);
  console.log(`  Test Tampering:   ${result.stats.tampering > 0 ? c.red : c.green}${result.stats.tampering}${c.reset}`);
  console.log(`  AI Slop / Stubs:  ${result.stats.slop > 0 ? c.yellow : c.green}${result.stats.slop}${c.reset}`);
  console.log(`  Debug Remnants:   ${result.stats.debug > 0 ? c.yellow : c.green}${result.stats.debug}${c.reset}\n`);

  if (!result.clean) {
    result.issues.forEach(iss => {
      const color = iss.severity === 'CRITICAL' ? c.red : c.yellow;
      console.log(`  ${color}[${iss.severity}]${c.reset} ${c.bold}${iss.category}${c.reset} in ${c.cyan}${iss.file}${c.reset}`);
      console.log(`    ${iss.description}`);
      console.log(`    ${c.gray}Snippet: ${iss.snippet}${c.reset}\n`);
    });

    const hasCritical = result.issues.some(iss => iss.severity === 'CRITICAL');
    if (options.strict || hasCritical) {
      console.error(`${c.red}${c.bold}❌ AUDIT FAILED: Fix the issues above before committing or merging.${c.reset}\n`);
      process.exit(1);
    }
  } else {
    console.log(`  ${c.green}${c.bold}✓ PASSED:${c.reset} Diff is clean, secure, and production-ready.\n`);
  }

  return result;
}

if (process.argv[1] && process.argv[1].endsWith('audit-diff.js')) {
  const args = process.argv.slice(2);
  const staged = args.includes('--staged');
  const strict = args.includes('--strict');
  const branchArg = args.find(a => a.startsWith('--branch='));
  const branch = branchArg ? branchArg.split('=')[1] : null;
  const formatArg = args.find(a => a.startsWith('--format='));
  const format = formatArg ? formatArg.split('=')[1] : 'text';

  runDiffAuditCli({ staged, strict, branch, format });
}
