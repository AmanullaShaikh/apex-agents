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

const IGNORED_SPEC_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.agents'
]);

function getProjectSourceFiles(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
      if (entry.isDirectory()) {
        if (!IGNORED_SPEC_DIRS.has(entry.name)) {
          results = results.concat(getProjectSourceFiles(path.join(dir, entry.name)));
        }
      } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
        results.push(path.join(dir, entry.name));
      }
    }
  } catch {}
  return results;
}

export function discoverCodebaseContracts(projectDir = process.cwd(), featureIntent = '') {
  const discovered = [];
  const intentKeywords = (featureIntent || '').toLowerCase().split(/[^a-z0-9]+/g).filter(w => w.length > 2);

  try {
    const files = getProjectSourceFiles(projectDir);
    for (const file of files.slice(0, 40)) {
      const rel = path.relative(projectDir, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.matchAll(/export\s+(?:interface|type|class)\s+([A-Za-z0-9_]+)/g);
      for (const m of matches) {
        if (!discovered.some(d => d.name === m[1])) {
          discovered.push({ name: m[1], file: rel });
        }
      }
    }
  } catch {}

  if (intentKeywords.length > 0) {
    const semanticMatches = discovered.filter(d =>
      intentKeywords.some(kw => d.name.toLowerCase().includes(kw) || d.file.toLowerCase().includes(kw))
    );
    if (semanticMatches.length > 0) {
      return semanticMatches.slice(0, 6);
    }
  }

  return discovered.slice(0, 6);
}

/**
 * Compiles a feature intent into a rigorous, zero-slop architectural SPEC.md
 */
export function compileSpec(featureIntent, projectDir = process.cwd(), options = {}) {
  if (!featureIntent || typeof featureIntent !== 'string' || featureIntent.trim().length === 0) {
    throw new Error('Feature intent description is required to compile a spec.');
  }

  const cleanIntent = featureIntent.trim();
  const timestamp = new Date().toISOString();
  const slug = cleanIntent.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const specFileName = options.fileName || 'SPEC.md';
  const outputPath = path.join(projectDir, specFileName);

  const title = cleanIntent.charAt(0).toUpperCase() + cleanIntent.slice(1);

  let md = `# APEX AGENTS: ARCHITECTURAL SPECIFICATION\n`;
  md += `> **Feature**: ${title}\n`;
  md += `> **Generated**: ${timestamp}\n`;
  md += `> **Standard**: Zero-Slop 5-Phase Intent Compiler (gstack / Roo Architecture)\n\n`;

  md += `## 1. 🎯 INTENT & BOUNDARIES\n\n`;
  md += `### Problem Statement\n`;
  md += `Implement ${cleanIntent} with deterministic error handling, type safety, and zero regression impact.\n\n`;
  md += `### In-Scope\n`;
  md += `- Core functionality for "${cleanIntent}".\n`;
  md += `- Strict input validation and sanitization at system boundaries.\n`;
  md += `- Unit and integration test coverage verifying both happy path and failure cases.\n\n`;
  md += `### Out-of-Scope (Negative Boundary)\n`;
  md += `- Modifying unrelated repository modules or dependencies.\n`;
  md += `- Adding unverified third-party libraries without explicit architectural review.\n`;
  md += `- Placeholder implementations or dummy return stubs.\n\n`;

  md += `## 2. 🏛️ DATA CONTRACTS & TYPE INTERFACES\n\n`;

  const discoveredContracts = discoverCodebaseContracts(projectDir, cleanIntent);
  if (discoveredContracts.length > 0) {
    md += `### 🔗 Discovered Codebase Contracts Linked\n`;
    md += `Reusing existing project domain contracts to prevent duplicate type declarations:\n`;
    discoveredContracts.forEach(dc => {
      md += `- Reusing \`${dc.name}\` from \`${dc.file}\`\n`;
    });
    md += `\n`;
  }

  md += `\`\`\`typescript\n`;
  md += `import { z } from 'zod';\n\n`;
  md += `// 1. Zod Runtime Validation Schema\n`;
  md += `export const ${pascalCase(slug)}Schema = z.object({\n`;
  md += `  id: z.string().uuid(),\n`;
  md += `  timestamp: z.number().int().positive(),\n`;
  md += `  idempotencyKey: z.string().min(16).max(128),\n`;
  md += `  actor: z.object({\n`;
  md += `    id: z.string(),\n`;
  md += `    role: z.enum(['admin', 'member', 'system'])\n`;
  md += `  }).optional(),\n`;
  md += `  metadata: z.record(z.string(), z.unknown())\n`;
  md += `});\n\n`;
  md += `export type ${pascalCase(slug)}Input = z.infer<typeof ${pascalCase(slug)}Schema>;\n\n`;
  md += `// 2. Target Domain Entity Interface for ${title}\n`;
  md += `export interface ${pascalCase(slug)}Config {\n`;
  md += `  enabled: boolean;\n`;
  md += `  timeoutMs?: number;\n`;
  md += `  retryLimit?: number;\n`;
  md += `}\n\n`;
  md += `export interface ${pascalCase(slug)}Payload {\n`;
  md += `  id: string;\n`;
  md += `  timestamp: number;\n`;
  md += `  metadata: Record<string, unknown>;\n`;
  md += `}\n\n`;
  md += `// 3. Discriminated Union Result & Typed Error Codes\n`;
  md += `export type ${pascalCase(slug)}Result =\n`;
  md += `  | { success: true; status: 'completed'; data: ${pascalCase(slug)}Payload; latencyMs: number }\n`;
  md += `  | { success: false; status: 'failed'; error: string; code: ${pascalCase(slug)}ErrorCode; details?: unknown };\n\n`;
  md += `export type ${pascalCase(slug)}ErrorCode =\n`;
  md += `  | 'VALIDATION_FAILED'\n`;
  md += `  | 'UNAUTHORIZED_ACCESS'\n`;
  md += `  | 'IDEMPOTENCY_CONFLICT'\n`;
  md += `  | 'UPSTREAM_SERVICE_TIMEOUT'\n`;
  md += `  | 'INTERNAL_ERROR';\n`;
  md += `\`\`\`\n\n`;
  md += `### 🌐 Ingress Wire Protocol Contract\n`;
  md += `| Method | Route Path | Required Headers | Success Status | Idempotency Keyed |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  md += `| \`POST\` | \`/api/v1/${slug}\` | \`Content-Type: application/json\`, \`Idempotency-Key\` | \`200 OK\` | Yes (UUIDv4 header) |\n\n`;

  md += `## 3. 🔄 STATE MACHINE & EVENT TRANSITIONS\n\n`;
  md += `\`\`\`text\n`;
  md += `[IDLE] ──(Receive Request)──► [VALIDATING]\n`;
  md += `                                   │\n`;
  md += `               ┌───────────────────┴───────────────────┐\n`;
  md += `               ▼                                       ▼\n`;
  md += `        [INVALID PAYLOAD]                       [PROCESSING]\n`;
  md += `               │                                       │\n`;
  md += `               ▼                               ┌───────┴───────┐\n`;
  md += `        [EMIT 400 ERROR]                       ▼               ▼\n`;
  md += `                                        [EXECUTION FAILS] [SUCCESS]\n`;
  md += `                                               │               │\n`;
  md += `                                               ▼               ▼\n`;
  md += `                                        [CIRCUIT RECOVERY] [EMIT 200/RESULT]\n`;
  md += `\`\`\`\n\n`;

  md += `## 4. ⛔ STRICT NEGATIVE CONSTRAINTS (ZERO-SLOP CONTRACT)\n\n`;
  md += `1. **NO LAZY PLACEHOLDERS**: Every function must be fully implemented. TODO or placeholder stubs are strictly forbidden.\n`;
  md += `2. **NO UNTYPED ANY**: TypeScript strict mode must be respected. No casting to \`any\` or suppressing compiler diagnostics with \`@ts-ignore\`.\n`;
  md += `3. **NO TEST CHEATING**: Existing tests must not be modified or skipped to simulate passing builds.\n`;
  md += `4. **FAIL FAST WITH EXPLICIT ERRORS**: Catch and wrap low-level exceptions with contextual messages.\n\n`;

  md += `## 5. 🧪 TDD ACCEPTANCE CRITERIA & TEST MATRIX\n\n`;
  md += `| Test ID | Scenario | Expected Behavior | Verification Command |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  md += `| **TC-01** | Valid Payload Processing | Returns \`{ success: true }\` with expected result | \`npx apex-agents test-loop\` |\n`;
  md += `| **TC-02** | Malformed / Empty Input | Rejects with explicit 400 validation error | \`npx apex-agents test-loop\` |\n`;
  md += `| **TC-03** | Upstream Service Timeout | Recovers gracefully without crashing node process | \`npx apex-agents test-loop\` |\n`;
  md += `| **TC-04** | Concurrency / Double Request | Idempotent execution (no duplicate mutations) | \`npx apex-agents test-loop\` |\n\n`;

  md += `## 6. 🛠️ SEQUENTIAL EXECUTION PROTOCOL\n\n`;
  md += `1. [ ] Review this spec and verify contracts match existing codebase conventions.\n`;
  md += `2. [ ] Write failing test suite in \`tests/${slug}.test.js\` (Red phase).\n`;
  md += `3. [ ] Implement production code in target module (Green phase).\n`;
  md += `4. [ ] Run \`npx apex-agents test-loop\` to verify 100% pass rate.\n`;
  md += `5. [ ] Run \`npx apex-agents review --staged\` before committing.\n`;

  fs.writeFileSync(outputPath, md);
  return { path: outputPath, content: md, slug };
}

/**
 * Validates whether an existing SPEC.md conforms to zero-slop requirements.
 */
export function validateSpec(specContent) {
  const requiredSections = [
    'INTENT & BOUNDARIES',
    'DATA CONTRACTS',
    'STATE MACHINE',
    'STRICT NEGATIVE CONSTRAINTS',
    'TEST MATRIX',
    'SEQUENTIAL EXECUTION PROTOCOL'
  ];

  const missing = [];
  requiredSections.forEach(sec => {
    if (!specContent.includes(sec)) missing.push(sec);
  });

  const score = Math.round(((requiredSections.length - missing.length) / requiredSections.length) * 100);
  return {
    valid: missing.length === 0,
    score,
    missing
  };
}

function pascalCase(str) {
  return str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('spec-compiler.js')) {
  const intent = process.argv.slice(2).join(' ');
  if (!intent) {
    console.log(`\n${c.red}Usage: npx apex-agents spec "<feature intent description>"${c.reset}\n`);
    process.exit(1);
  }

  const res = compileSpec(intent);
  console.log(`\n${c.green}${c.bold}✓ ARCHITECTURAL SPEC COMPILED:${c.reset} ${c.cyan}${res.path}${c.reset}`);
  console.log(`  Feed ${c.yellow}SPEC.md${c.reset} to Cursor / Claude Code before writing code to prevent hallucinated architecture.\n`);
}
