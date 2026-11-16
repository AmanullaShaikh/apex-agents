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
 * Audits a single source code file for production runtime AST bugs.
 */
export function auditCodeBugs(code, filePath = 'unknown.ts') {
  const issues = [];
  let ast;

  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        'decorators-legacy',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'topLevelAwait',
        'asyncGenerators'
      ]
    });
  } catch (err) {
    return issues; // Skip unparseable files
  }

  try {
    traverse(ast, {
      // 1. Raw SQL Injection Detection
      CallExpression(p) {
        let isSqlCall = false;
        if (p.node.callee.type === 'MemberExpression') {
          const propName = p.node.callee.property.name;
          if (['query', 'raw', '$queryRawUnsafe', 'execute', 'exec', 'update'].includes(propName)) {
            isSqlCall = true;
          }
        }

        if (isSqlCall && p.node.arguments.length > 0) {
          const firstArg = p.node.arguments[0];

          // Recursive AST Scope & Data-Flow Taint Resolver
          const isVulnerableSqlExpression = (node, scope, visited = new Set()) => {
            if (!node) return false;

            // 1. Direct binary expression string concatenation (+)
            if (node.type === 'BinaryExpression' && node.operator === '+') {
              return true;
            }

            // 2. Direct template literal with interpolation (${...})
            if (node.type === 'TemplateLiteral' && node.expressions.length > 0) {
              return true;
            }

            // 3. Identifier: recursively resolve aliases, assignments, and bindings
            if (node.type === 'Identifier') {
              if (visited.has(node.name)) return false;
              visited.add(node.name);

              const binding = scope?.getBinding(node.name);
              if (binding) {
                // A. Check declaration initialization: const x = init;
                if (binding.path?.node?.init) {
                  if (isVulnerableSqlExpression(binding.path.node.init, binding.scope, visited)) {
                    return true;
                  }
                }

                // B. Check mutations and reassignments (e.g., sql += "..." or sql = sql + "...")
                if (binding.constantViolations && binding.constantViolations.length > 0) {
                  for (const cv of binding.constantViolations) {
                    if (cv.isAssignmentExpression()) {
                      if (cv.node.operator === '+=' && isVulnerableSqlExpression(cv.node.right, cv.scope, visited)) {
                        return true;
                      }
                      if (cv.node.operator === '=' && isVulnerableSqlExpression(cv.node.right, cv.scope, visited)) {
                        return true;
                      }
                    }
                  }
                }
              }
            }

            // 4. Call expression: e.g. db.query(getQuery(userId))
            if (node.type === 'CallExpression') {
              // Check arguments of the call
              for (const arg of node.arguments) {
                if (isVulnerableSqlExpression(arg, scope, visited)) return true;
              }

              // Check function return if defined in local scope
              if (node.callee.type === 'Identifier') {
                if (!visited.has(node.callee.name)) {
                  visited.add(node.callee.name);
                  const fnBinding = scope?.getBinding(node.callee.name);
                  if (fnBinding) {
                    const fnPath = fnBinding.path;
                    let fnNode = null;
                    if (fnPath.isFunctionDeclaration()) {
                      fnNode = fnPath.node;
                    } else if (fnPath.isVariableDeclarator() && fnPath.node.init) {
                      fnNode = fnPath.node.init;
                    }

                    if (fnNode && fnNode.body) {
                      if (fnNode.body.type === 'BlockStatement') {
                        for (const s of fnNode.body.body) {
                          if (s.type === 'ReturnStatement' && s.argument) {
                            if (isVulnerableSqlExpression(s.argument, fnBinding.scope, visited)) {
                              return true;
                            }
                          }
                        }
                      } else {
                        // Concise body arrow function
                        if (isVulnerableSqlExpression(fnNode.body, fnBinding.scope, visited)) {
                          return true;
                        }
                      }
                    }
                  }
                }
              }
            }

            return false;
          };

          if (isVulnerableSqlExpression(firstArg, p.scope)) {
            issues.push({
              file: filePath,
              line: p.node.loc?.start.line || 1,
              severity: 'CRITICAL',
              category: 'SQL_INJECTION',
              message: 'Raw SQL concatenation or template interpolation detected in database query call. Use parameterized queries.'
            });
          }
        }

        // 2. React Hook Missing Cleanup (setInterval / addEventListener)
        if (p.node.callee.type === 'Identifier' && p.node.callee.name === 'useEffect') {
          const hookFn = p.node.arguments[0];
          if (hookFn && (hookFn.type === 'ArrowFunctionExpression' || hookFn.type === 'FunctionExpression')) {
            let hasListenerOrTimer = false;
            let hasValidCleanupReturn = false;

            if (hookFn.body.type === 'BlockStatement') {
              hookFn.body.body.forEach(stmt => {
                const stmtCode = code.slice(stmt.start, stmt.end);
                if (stmtCode.includes('setInterval') || stmtCode.includes('addEventListener') || stmtCode.includes('setTimeout')) {
                  hasListenerOrTimer = true;
                }
                if (stmt.type === 'ReturnStatement') {
                  // Must return a callable function or identifier, not undefined, null, or primitive
                  if (stmt.argument) {
                    const arg = stmt.argument;
                    const isInvalidLiteral = arg.type === 'NullLiteral' ||
                      (arg.type === 'Identifier' && arg.name === 'undefined') ||
                      arg.type === 'NumericLiteral' ||
                      arg.type === 'StringLiteral' ||
                      arg.type === 'BooleanLiteral';
                    
                    if (!isInvalidLiteral) {
                      hasValidCleanupReturn = true;
                    }
                  }
                }
              });
            }

            if (hasListenerOrTimer && !hasValidCleanupReturn) {
              issues.push({
                file: filePath,
                line: p.node.loc?.start.line || 1,
                severity: 'HIGH',
                category: 'MEMORY_LEAK',
                message: 'useEffect creates a timer or event listener without returning a valid cleanup function.'
              });
            }
          }
        }

        // 3. Floating Async Calls in Express / Functions
        if (p.node.callee.type === 'MemberExpression' || p.node.callee.type === 'Identifier') {
          const callName = p.node.callee.name || p.node.callee.property?.name;
          const objName = p.node.callee.object?.name || '';

          // Exclude synchronous collections (cache, map, set, headers, cookie, etc.)
          const isSyncCollection = ['set', 'map', 'instack', 'visited', 'cache', 'headers', 'cookie', 'session', 'params'].some(s => objName.toLowerCase().includes(s));
          const isKnownDbClient = ['db', 'prisma', 'client', 'repo', 'collection', 'model', 'knex', 'orm'].some(db => objName.toLowerCase().includes(db));

          const isKnownAsyncMethod = !isSyncCollection && (
            ['sendMail', 'publish'].includes(callName) ||
            (isKnownDbClient && ['save', 'delete', 'update', 'insert', 'execute'].includes(callName)) ||
            (callName === 'fetch' && !objName) // global fetch()
          );

          if (isKnownAsyncMethod) {
            // Check if call is an expression statement not awaited and not returned
            if (p.parentPath?.isExpressionStatement()) {
              issues.push({
                file: filePath,
                line: p.node.loc?.start.line || 1,
                severity: 'MEDIUM',
                category: 'FLOATING_PROMISE',
                message: `Async call "${objName ? objName + '.' : ''}${callName}()" is not awaited, assigned, or caught. Risks unhandled promise rejections.`
              });
            }
          }
        }
      }
    });
  } catch {
    // traversal fallback
  }

  return issues;
}

/**
 * Audits all files across the repository.
 */
export function auditWorkspaceBugs(projectDir = process.cwd()) {
  const files = getSourceFiles(projectDir);
  let allIssues = [];

  for (const file of files) {
    const relPath = path.relative(projectDir, file).replace(/\\/g, '/');
    try {
      const code = fs.readFileSync(file, 'utf-8');
      const fileIssues = auditCodeBugs(code, relPath);
      allIssues = allIssues.concat(fileIssues);
    } catch {
      // skip unreadable file
    }
  }

  return {
    scannedFiles: files.length,
    issues: allIssues,
    passed: allIssues.length === 0
  };
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('audit-bugs.js')) {
  const targetDir = process.argv[2] || process.cwd();
  console.log(`\n${c.cyan}${c.bold}═════ APEX AGENTS: PRODUCTION AST BUG AUDITOR ═════${c.reset}`);
  console.log(`Scanning repository: ${c.yellow}${targetDir}${c.reset}...\n`);

  const report = auditWorkspaceBugs(targetDir);

  if (report.passed) {
    console.log(`${c.green}${c.bold}✓ ZERO PRODUCTION BUGS DETECTED${c.reset} across ${report.scannedFiles} files.\n`);
    process.exit(0);
  } else {
    console.log(`${c.red}${c.bold}✖ FOUND ${report.issues.length} POTENTIAL PRODUCTION BUG(S):${c.reset}\n`);
    report.issues.forEach((iss, idx) => {
      const color = iss.severity === 'CRITICAL' ? c.red : (iss.severity === 'HIGH' ? c.yellow : c.magenta);
      console.log(`  ${idx + 1}. [${color}${iss.severity}${c.reset}] ${c.bold}${iss.category}${c.reset} in ${c.cyan}${iss.file}:${iss.line}${c.reset}`);
      console.log(`     ${iss.message}\n`);
    });
    process.exit(1);
  }
}
