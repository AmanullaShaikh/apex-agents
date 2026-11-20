#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { buildSarifReport } from './audit-diff.js';
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
          } else if (stat.isFile() && /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) {
            visited.add(target);
            results.push(fullPath);
          }
        } catch {
          continue;
        }
      } else if (entry.isDirectory()) {
        results = results.concat(getSourceFiles(fullPath, visited));
      } else if (entry.isFile() && /\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) {
        results.push(fullPath);
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

  const queryFnNames = new Set(['query', 'raw', '$queryRawUnsafe', '$executeRawUnsafe', 'execute', 'exec', 'runQuery', 'execSql', 'executeSql', 'rawQuery']);
  const dbClientIdentifiers = new Set(['db', 'pool', 'client', 'conn', 'connection', 'tx', 'trx', 'sql', 'prisma', 'knex', 'sequelize', 'orm']);
  const syncClassMethods = new Map();
  const varToClass = new Map();

  // Pre-scan local class definitions to distinguish synchronous methods (e.g. `class Cache { save(k, v) {} }`) from async ORM saves
  try {
    traverse(ast, {
      ClassDeclaration(p) {
        const clsName = p.node.id?.name;
        if (!clsName) return;
        const methods = new Set();
        for (const member of p.node.body?.body || []) {
          if (member.type === 'ClassMethod' && !member.async && member.key?.name) {
            methods.add(member.key.name);
          }
        }
        syncClassMethods.set(clsName, methods);
      },
      VariableDeclarator(p) {
        if (p.node.id?.type === 'Identifier' && p.node.init?.type === 'NewExpression' && p.node.init.callee?.type === 'Identifier') {
          varToClass.set(p.node.id.name, p.node.init.callee.name);
        }
      }
    });
  } catch {
    // ignore pre-scan errors
  }

  function evalStaticString(node, scope, visited = new Set()) {
    if (!node) return null;
    if (node.type === 'StringLiteral') return node.value;
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
      return node.quasis.map(q => q.value.cooked ?? q.value.raw).join('');
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      const left = evalStaticString(node.left, scope, visited);
      const right = evalStaticString(node.right, scope, visited);
      if (left !== null && right !== null) return left + right;
      return null;
    }
    if (node.type === 'CallExpression') {
      if (node.callee.type === 'Identifier' && node.callee.name === 'String' && node.arguments.length > 0) {
        return evalStaticString(node.arguments[0], scope, visited);
      }
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.property?.name === 'join' &&
        node.callee.object?.type === 'ArrayExpression'
      ) {
        const sep = node.arguments.length > 0 ? evalStaticString(node.arguments[0], scope, visited) : ',';
        if (sep === null) return null;
        const parts = [];
        for (const el of node.callee.object.elements) {
          const v = evalStaticString(el, scope, visited);
          if (v === null) return null;
          parts.push(v);
        }
        return parts.join(sep);
      }
    }
    if (node.type === 'Identifier') {
      if (visited.has(node.name)) return null;
      visited.add(node.name);
      const binding = scope?.getBinding(node.name);
      if (binding?.path?.node?.init) {
        return evalStaticString(binding.path.node.init, binding.scope, visited);
      }
    }
    return null;
  }

  try {
    traverse(ast, {
      ImportDeclaration(p) {
        const src = p.node.source?.value?.toLowerCase() || '';
        // Skip Node.js native runtime modules that have nothing to do with database queries
        if (src === 'child_process' || src === 'node:child_process' || src === 'fs' || src === 'node:fs' || src === 'path' || src === 'node:path') {
          return;
        }
        const isDbSource = /db|sql|database|pg|mysql|sqlite|orm|prisma|knex|barrel|\.\//i.test(src);
        for (const spec of p.node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const imported = spec.imported.name || spec.imported.value;
            if (['execSync', 'execFileSync', 'spawnSync', 'spawn', 'execFile'].includes(imported)) continue;
            if (queryFnNames.has(imported) || /^(query|raw|execute|runQuery|execSql|rawQuery)$/i.test(imported) || (isDbSource && /query|raw|exec|sql/i.test(imported))) {
              queryFnNames.add(spec.local.name);
            }
          } else if (spec.type === 'ImportNamespaceSpecifier' || spec.type === 'ImportDefaultSpecifier') {
            if (isDbSource || /db|orm|client|sql/i.test(spec.local.name)) {
              dbClientIdentifiers.add(spec.local.name);
            }
          }
        }
      },

      VariableDeclarator(p) {
        if (p.node.id?.type === 'Identifier') {
          const init = p.node.init;
          if (init && init.type === 'NewExpression' && init.callee?.name === 'Proxy') {
            dbClientIdentifiers.add(p.node.id.name);
          }
        }
      },

      TaggedTemplateExpression(p) {
        let isSqlTag = false;
        if (p.node.tag.type === 'MemberExpression') {
          const prop = p.node.tag.property.name || p.node.tag.property.value;
          const obj = p.node.tag.object?.name;
          if (queryFnNames.has(prop) || dbClientIdentifiers.has(obj) || /query|raw|exec|sql/i.test(prop)) {
            isSqlTag = true;
          }
        } else if (p.node.tag.type === 'Identifier') {
          if (queryFnNames.has(p.node.tag.name) || /query|raw|exec|sql/i.test(p.node.tag.name)) {
            isSqlTag = true;
          }
        }

        if (isSqlTag && p.node.quasi?.expressions?.length > 0) {
          issues.push({
            file: filePath,
            line: p.node.loc?.start.line || 1,
            severity: 'CRITICAL',
            category: 'SQL_INJECTION',
            type: 'SQL_INJECTION',
            message: 'Raw SQL concatenation or template interpolation detected in database query call. Use parameterized queries.'
          });
        }
      },

      // 1. Raw SQL Injection Detection
      CallExpression(p) {
        // Skip native shell process execution calls
        if (p.node.callee.type === 'Identifier' && ['execSync', 'execFileSync', 'spawnSync', 'spawn', 'execFile'].includes(p.node.callee.name)) {
          return;
        }
        if (p.node.callee.type === 'MemberExpression' && ['execSync', 'execFileSync', 'spawnSync', 'spawn', 'execFile'].includes(p.node.callee.property?.name)) {
          return;
        }

        // Skip RegExp.prototype.exec calls: /.../.exec(...) or regex.exec(...)
        if (p.node.callee.type === 'MemberExpression') {
          const prop = p.node.callee.property?.name || p.node.callee.property?.value;
          if (prop === 'exec') {
            const calleeObj = p.node.callee.object;
            if (calleeObj?.type === 'RegExpLiteral') return;
            if (calleeObj?.type === 'NewExpression' && calleeObj.callee?.name === 'RegExp') return;
            if (calleeObj?.type === 'Identifier') {
              const init = p.scope?.getBinding(calleeObj.name)?.path?.node?.init;
              if (init?.type === 'RegExpLiteral' || (init?.type === 'NewExpression' && init.callee?.name === 'RegExp')) {
                return;
              }
            }
          }
        }

        let isSqlCall = false;
        let sqlArg = null;

        // 1. MemberExpression: db.query(...) OR db['query'](...) OR db[String('query')](...) OR orm.runQuery(...)
        if (p.node.callee.type === 'MemberExpression') {
          let propName = null;
          if (!p.node.callee.computed && p.node.callee.property.type === 'Identifier') {
            propName = p.node.callee.property.name;
          } else if (p.node.callee.computed) {
            propName = evalStaticString(p.node.callee.property, p.scope);
          }
          const objName = p.node.callee.object?.name;
          const isGenericQuery = /^(query|raw|\$queryRawUnsafe|\$executeRawUnsafe|execute|exec|runQuery|rawQuery|execSql)$/i.test(propName);
          const isDbClientMethod = dbClientIdentifiers.has(objName) && /query|raw|exec|run|update/i.test(propName);
          if (queryFnNames.has(propName) || isGenericQuery || isDbClientMethod) {
            isSqlCall = true;
            sqlArg = p.node.arguments[0];
          }
        }

        // 2. Direct Identifier: query(...), runQuery(...)
        if (!isSqlCall && p.node.callee.type === 'Identifier') {
          const fnName = p.node.callee.name;
          if (queryFnNames.has(fnName) || /^(query|raw|\$queryRawUnsafe|\$executeRawUnsafe|execute|exec|runQuery|execSql|rawQuery)$/i.test(fnName)) {
            isSqlCall = true;
            sqlArg = p.node.arguments[0];
          }
        }

        // 3. Dynamic Reflection via Reflect.get: Reflect.get(db, 'query')(...)
        if (!isSqlCall && p.node.callee.type === 'CallExpression') {
          const inner = p.node.callee;
          if (inner.callee?.type === 'MemberExpression' && inner.callee.object?.name === 'Reflect' && inner.callee.property?.name === 'get') {
            const propArg = inner.arguments[1];
            const propVal = propArg?.value || propArg?.name;
            if (queryFnNames.has(propVal) || /query|raw|exec|run/i.test(propVal)) {
              isSqlCall = true;
              sqlArg = p.node.arguments[0];
            }
          }
        }

        // 4. Reflection: Reflect.apply(db.query, db, [sql])
        if (!isSqlCall &&
            p.node.callee.type === 'MemberExpression' &&
            p.node.callee.object?.name === 'Reflect' &&
            p.node.callee.property?.name === 'apply') {
          const targetFn = p.node.arguments[0];
          const targetArgs = p.node.arguments[2];
          if (targetFn && (targetFn.type === 'MemberExpression' || targetFn.type === 'Identifier')) {
            const pName = targetFn.property?.name || targetFn.property?.value || targetFn.name;
            if (queryFnNames.has(pName) || /query|raw|exec|run/i.test(pName)) {
              if (targetArgs && targetArgs.type === 'ArrayExpression' && targetArgs.elements.length > 0) {
                isSqlCall = true;
                sqlArg = targetArgs.elements[0];
              }
            }
          }
        }

        // 5. Currying / Higher-Order runner: runner(db.query, sql)
        if (!isSqlCall && p.node.arguments.length >= 2) {
          const firstParam = p.node.arguments[0];
          if (firstParam.type === 'MemberExpression' || firstParam.type === 'Identifier') {
            const prop = firstParam.property?.name || firstParam.property?.value || firstParam.name;
            if (queryFnNames.has(prop) || /query|raw|exec|run/i.test(prop)) {
              isSqlCall = true;
              sqlArg = p.node.arguments[1];
            }
          }
        }

        // 6. Method invocation via .call(): db.query.call(db, sql)
        if (!isSqlCall && p.node.callee.type === 'MemberExpression' && p.node.callee.property?.name === 'call') {
          const innerTarget = p.node.callee.object;
          if (innerTarget) {
            const innerProp = innerTarget.property?.name || innerTarget.property?.value || innerTarget.name;
            if (queryFnNames.has(innerProp) || /query|raw|exec|run/i.test(innerProp)) {
              if (p.node.arguments.length >= 2) {
                isSqlCall = true;
                sqlArg = p.node.arguments[1];
              }
            }
          }
        }

        // 7. Method invocation via .apply(): db.query.apply(db, [sql])
        if (!isSqlCall && p.node.callee.type === 'MemberExpression' && p.node.callee.property?.name === 'apply') {
          const innerTarget = p.node.callee.object;
          if (innerTarget) {
            const innerProp = innerTarget.property?.name || innerTarget.property?.value || innerTarget.name;
            if (queryFnNames.has(innerProp) || /query|raw|exec|run/i.test(innerProp)) {
              if (p.node.arguments.length >= 2 && p.node.arguments[1].type === 'ArrayExpression' && p.node.arguments[1].elements.length > 0) {
                isSqlCall = true;
                sqlArg = p.node.arguments[1].elements[0];
              }
            }
          }
        }

        // 8. Method binding invocation via .bind(): db.query.bind(db)(sql)
        if (!isSqlCall && p.node.callee.type === 'CallExpression') {
          const inner = p.node.callee;
          if (inner.callee?.type === 'MemberExpression' && inner.callee.property?.name === 'bind') {
            const target = inner.callee.object;
            if (target) {
              const prop = target.property?.name || target.property?.value || target.name;
              if (queryFnNames.has(prop) || /query|raw|exec|run/i.test(prop)) {
                if (p.node.arguments.length > 0) {
                  isSqlCall = true;
                  sqlArg = p.node.arguments[0];
                }
              }
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

            // 2. Direct template literal or tagged template with interpolation (${...})
            if ((node.type === 'TemplateLiteral' || node.type === 'TaggedTemplateExpression') && (node.expressions?.length > 0 || node.quasi?.expressions?.length > 0)) {
              return true;
            }

            // 2b. Conditional (ternary) & logical expressions
            if (node.type === 'ConditionalExpression') {
              return isVulnerableSqlExpression(node.consequent, scope, visited) || isVulnerableSqlExpression(node.alternate, scope, visited);
            }
            if (node.type === 'LogicalExpression') {
              return isVulnerableSqlExpression(node.left, scope, visited) || isVulnerableSqlExpression(node.right, scope, visited);
            }

            // 3. Identifier: recursively resolve aliases, assignments, bindings, and Promise parameters
            if (node.type === 'Identifier') {
              if (visited.has(node.name)) return false;
              visited.add(node.name);

              const binding = scope?.getBinding(node.name);
              if (binding) {
                // Parameter in a Promise .then(...) callback
                if (binding.kind === 'param') {
                  const parentFn = binding.path.parentPath;
                  if (parentFn && parentFn.parentPath?.isCallExpression()) {
                    const call = parentFn.parentPath;
                    if (call.node.callee?.type === 'MemberExpression' && call.node.callee.property?.name === 'then') {
                      const obj = call.node.callee.object;
                      if (obj?.type === 'CallExpression') {
                        if (obj.callee?.type === 'MemberExpression' && obj.callee.object?.name === 'Promise' && obj.callee.property?.name === 'resolve') {
                          if (isVulnerableSqlExpression(obj.arguments[0], scope, visited)) {
                            return true;
                          }
                        } else {
                          for (const a of obj.arguments) {
                            if (isVulnerableSqlExpression(a, scope, visited)) return true;
                          }
                        }
                      }
                    }
                  }
                }

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

            // 5. Call expression: e.g. db.query(getQuery(userId)) or db.query(["SELECT ... ", id].join(''))
            if (node.type === 'CallExpression') {
              if (
                node.callee?.type === 'MemberExpression' &&
                node.callee.property?.name === 'join'
              ) {
                let arrayNode = node.callee.object;
                if (arrayNode?.type === 'Identifier') {
                  const binding = scope?.getBinding(arrayNode.name);
                  if (binding?.path?.node?.init?.type === 'ArrayExpression') {
                    arrayNode = binding.path.node.init;
                  }
                }
                if (arrayNode?.type === 'ArrayExpression') {
                  const elements = arrayNode.elements || [];
                  const hasSql = elements.some(el => (el?.type === 'StringLiteral' && /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(el.value)) || isVulnerableSqlExpression(el, scope, visited));
                  const hasDynamic = elements.some(el => el && el.type !== 'StringLiteral');
                  if (hasSql && hasDynamic) return true;
                  for (const el of elements) {
                    if (el && isVulnerableSqlExpression(el, scope, visited)) return true;
                  }
                }
              }
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
              type: 'SQL_INJECTION',
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
                type: 'MEMORY_LEAK',
                message: 'useEffect creates a timer or event listener without returning a valid cleanup function.'
              });
            }
          }
        }

        // 3. Floating Async Calls in Express / Functions
        if (p.node.callee.type === 'MemberExpression' || p.node.callee.type === 'Identifier') {
          const callName = p.node.callee.name || p.node.callee.property?.name;
          const objName = p.node.callee.object?.name || '';

          // Exclude synchronous collections, Canvas/Graphics contexts, and locally declared non-async class methods
          const isSyncCollection = ['set', 'map', 'instack', 'visited', 'cache', 'headers', 'cookie', 'session', 'params', 'store', 'ctx', 'canvas', 'graphics', 'context'].some(s => objName.toLowerCase().includes(s));
          const instantiatedClass = varToClass.get(objName);
          const isKnownLocalSyncMethod = Boolean(instantiatedClass && syncClassMethods.get(instantiatedClass)?.has(callName));
          const EXACT_DB_IDENTIFIERS = new Set(['u', 'db', 'doc', 'row', 'orm', 'sql', 'knex', 'prisma', 'client', 'repo', 'model', 'user', 'entity', 'record', 'item', 'account', 'profile', 'post', 'order', 'collection']);
          const DB_WORD_SEGMENTS = new Set(['db', 'prisma', 'client', 'repo', 'repository', 'collection', 'model', 'knex', 'orm', 'user', 'entity', 'record', 'doc', 'document', 'item', 'account', 'profile', 'post', 'order', 'row', 'dao']);
          const objSegments = objName
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(Boolean);
          const isKnownDbClient = EXACT_DB_IDENTIFIERS.has(objName.toLowerCase()) || objSegments.some(seg => DB_WORD_SEGMENTS.has(seg));

          const isKnownAsyncMethod = !isSyncCollection && !isKnownLocalSyncMethod && (
            ['sendMail', 'publish'].includes(callName) ||
            (['save'].includes(callName) && objName && isKnownDbClient) ||
            (isKnownDbClient && ['delete', 'update', 'insert', 'execute'].includes(callName)) ||
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
                type: 'FLOATING_PROMISE',
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
  const args = process.argv.slice(2);
  const formatArg = args.find(a => a.startsWith('--format='));
  const format = formatArg ? formatArg.split('=')[1] : (args.includes('--json') ? 'json' : 'text');
  const unknownFlag = args.find(a => a.startsWith('-') && !a.startsWith('--format=') && a !== '--json');
  if (unknownFlag) {
    console.error(`${c.red}Unknown flag: ${unknownFlag}${c.reset}`);
    process.exit(1);
  }
  const targetDir = args.find(a => !a.startsWith('-')) || process.cwd();
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error(`${c.red}Directory not found: ${targetDir}${c.reset}`);
    process.exit(1);
  }

  const report = auditWorkspaceBugs(targetDir);

  if (format === 'sarif') {
    const sarifIssues = report.issues.map(i => ({
      severity: i.severity,
      category: i.category,
      file: i.file,
      line: i.line,
      description: i.message,
      snippet: ''
    }));
    console.log(JSON.stringify(buildSarifReport(sarifIssues, 'aveyx-audit-bugs', '3.0.0'), null, 2));
    process.exit(report.passed ? 0 : 1);
  }

  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.passed ? 0 : 1);
  }

  console.log(`\n${c.cyan}${c.bold}═════ AVEYX: PRODUCTION AST BUG AUDITOR ═════${c.reset}`);
  console.log(`Scanning repository: ${c.yellow}${targetDir}${c.reset}...\n`);

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
