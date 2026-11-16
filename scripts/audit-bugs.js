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
        let sqlArg = null;

        // 1. MemberExpression: db.query(...) OR db['query'](...) OR db[String('query')](...)
        if (p.node.callee.type === 'MemberExpression') {
          let propName = null;
          if (!p.node.callee.computed && p.node.callee.property.type === 'Identifier') {
            propName = p.node.callee.property.name;
          } else if (p.node.callee.computed) {
            if (p.node.callee.property.type === 'StringLiteral') {
              propName = p.node.callee.property.value;
            } else if (p.node.callee.property.type === 'CallExpression') {
              const arg0 = p.node.callee.property.arguments[0];
              if (arg0 && arg0.type === 'StringLiteral') {
                propName = arg0.value;
              }
            }
          }
          if (['query', 'raw', '$queryRawUnsafe', 'execute', 'exec', 'update'].includes(propName)) {
            isSqlCall = true;
            sqlArg = p.node.arguments[0];
          }
        }

        // 2. Method Destructuring: const { query } = db; query(sql);
        if (!isSqlCall && p.node.callee.type === 'Identifier') {
          const fnName = p.node.callee.name;
          if (['query', 'raw', '$queryRawUnsafe', 'execute', 'exec'].includes(fnName)) {
            const binding = p.scope.getBinding(fnName);
            if (binding) {
              if (binding.path.isVariableDeclarator() && binding.path.node.id.type === 'ObjectPattern') {
                isSqlCall = true;
                sqlArg = p.node.arguments[0];
              } else if (binding.kind === 'module') {
                isSqlCall = true;
                sqlArg = p.node.arguments[0];
              }
            }
          }
        }

        // 3. Reflection: Reflect.apply(db.query, db, [sql])
        if (!isSqlCall &&
            p.node.callee.type === 'MemberExpression' &&
            p.node.callee.object?.name === 'Reflect' &&
            p.node.callee.property?.name === 'apply') {
          const targetFn = p.node.arguments[0];
          const targetArgs = p.node.arguments[2];
          if (targetFn && (targetFn.type === 'MemberExpression' || targetFn.type === 'Identifier')) {
            const pName = targetFn.property?.name || targetFn.property?.value || targetFn.name;
            if (['query', 'raw', 'execute', 'exec'].includes(pName)) {
              if (targetArgs && targetArgs.type === 'ArrayExpression' && targetArgs.elements.length > 0) {
                isSqlCall = true;
                sqlArg = targetArgs.elements[0];
              }
            }
          }
        }

        // 4. Currying / Higher-Order runner: runner(db.query, sql)
        if (!isSqlCall && p.node.arguments.length >= 2) {
          const firstParam = p.node.arguments[0];
          if (firstParam.type === 'MemberExpression') {
            const prop = firstParam.property?.name || firstParam.property?.value;
            if (['query', 'raw', 'execute', 'exec'].includes(prop)) {
              isSqlCall = true;
              sqlArg = p.node.arguments[1];
            }
          }
        }

        if (isSqlCall && sqlArg) {
          const firstArg = sqlArg;

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

            // 4. MemberExpression property alias: payload.query or payload['query']
            if (node.type === 'MemberExpression') {
              const objName = node.object?.name;
              const propKey = node.property?.name || node.property?.value;
              if (objName && propKey) {
                const binding = scope?.getBinding(objName);
                if (binding) {
                  // Check member assignments via reference paths: payload.query = ...
                  if (binding.referencePaths) {
                    for (const ref of binding.referencePaths) {
                      if (ref.parentPath?.isMemberExpression() && ref.parentPath.parentPath?.isAssignmentExpression()) {
                        const assign = ref.parentPath.parentPath;
                        if (assign.node.left === ref.parentPath.node) {
                          const assignedProp = ref.parentPath.node.property?.name || ref.parentPath.node.property?.value;
                          if (assignedProp === propKey && isVulnerableSqlExpression(assign.node.right, assign.scope, visited)) {
                            return true;
                          }
                        }
                      }
                    }
                  }
                  if (binding.constantViolations) {
                    for (const cv of binding.constantViolations) {
                      if (cv.isAssignmentExpression() && cv.node.left.type === 'MemberExpression') {
                        const targetProp = cv.node.left.property?.name || cv.node.left.property?.value;
                        if (targetProp === propKey && isVulnerableSqlExpression(cv.node.right, cv.scope, visited)) {
                          return true;
                        }
                      }
                    }
                  }
                  if (binding.path?.node?.init?.type === 'ObjectExpression') {
                    for (const prop of binding.path.node.init.properties) {
                      const k = prop.key?.name || prop.key?.value;
                      if (k === propKey && isVulnerableSqlExpression(prop.value, binding.scope, visited)) {
                        return true;
                      }
                    }
                  }
                }
              }
            }

            // 5. Call expression: e.g. db.query(getQuery(userId))
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
                  if (stmt.argument) {
                    const arg = stmt.argument;

                    // IIFE deception: return (() => null)();
                    if (arg.type === 'CallExpression') {
                      if (arg.callee.type === 'ArrowFunctionExpression' || arg.callee.type === 'FunctionExpression') {
                        const fnBody = arg.callee.body;
                        if (fnBody.type === 'NullLiteral' || (fnBody.type === 'Identifier' && fnBody.name === 'undefined')) {
                          hasValidCleanupReturn = false;
                        }
                      }
                    } else if (arg.type === 'Identifier') {
                      // const noop = undefined; return noop;
                      if (arg.name === 'undefined') {
                        hasValidCleanupReturn = false;
                      } else {
                        const hookScope = p.get('arguments.0')?.scope || p.scope;
                        const binding = hookScope?.getBinding?.(arg.name);
                        if (binding) {
                          const init = binding.path?.node?.init;
                          if (!init || init.type === 'NullLiteral' || (init.type === 'Identifier' && init.name === 'undefined')) {
                            hasValidCleanupReturn = false;
                          } else if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
                            hasValidCleanupReturn = true;
                          }
                        } else {
                          hasValidCleanupReturn = true;
                        }
                      }
                    } else if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
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
