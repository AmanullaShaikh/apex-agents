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
    return semanticMatches.slice(0, 6);
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

  const lower = cleanIntent.toLowerCase();
  const isGraphql = /\b(graphql|gql|subgraph|resolver|federation)\b/i.test(lower);
  const isDatabase = !isGraphql && /\b(postgres|postgresql|mysql|sqlite|sql|migration|prisma|drizzle|schema\s+migration|database)\b/i.test(lower);
  const isUi = !isGraphql && !isDatabase && /\b(ui|frontend|react|vue|svelte|component|theme|dark\s*mode|toggle|button|modal|dialog|card|form|input|page|nav|sidebar|animation|css|style|layout|widget)\b/i.test(lower);
  const isCli = !isGraphql && !isDatabase && !isUi && /\b(cli|command[\s-]?line|parser|terminal|stdin|stdout|argv|log\s+file)\b/i.test(lower);
  const isCache = !isGraphql && !isDatabase && !isUi && !isCli && /\b(cache|caching|redis|memcached|lru|ttl|queue|worker|broker)\b/i.test(lower);
  const isPayment = !isGraphql && !isDatabase && !isUi && !isCli && !isCache && /\b(payment|checkout|webhook|order|stripe|billing|transfer|transaction)\b/i.test(lower);
  const isAuth = !isGraphql && !isDatabase && !isUi && !isCli && !isCache && !isPayment && /\b(auth|authentication|login|signup|password|jwt|session|token|credential|oauth)\b/i.test(lower);
  const isRestApi = !isGraphql && !isDatabase && !isUi && !isCli && !isCache && !isPayment && !isAuth && /\b(api|rest|crud|endpoint|route|http|server|microservice)\b/i.test(lower);

  md += `\`\`\`typescript\n`;
  md += `import { z } from 'zod';\n\n`;

  if (isGraphql) {
    md += `// 1. Zod Runtime GraphQL Resolver Input Schema\n`;
    md += `export const ${pascalCase(slug)}InputSchema = z.object({\n`;
    md += `  id: z.string().min(1),\n`;
    md += `  limit: z.number().int().min(1).max(100).default(20),\n`;
    md += `  cursor: z.string().optional()\n`;
    md += `});\n\n`;
    md += `export type ${pascalCase(slug)}Input = z.infer<typeof ${pascalCase(slug)}InputSchema>;\n\n`;
    md += `// 2. GraphQL Resolver Context & DataLoader Interface for ${title}\n`;
    md += `export interface ${pascalCase(slug)}Context {\n`;
    md += `  actorId: string;\n`;
    md += `  requestId: string;\n`;
    md += `}\n\n`;
    md += `// 3. Discriminated Union Resolver Payload\n`;
    md += `export type ${pascalCase(slug)}Result =\n`;
    md += `  | { __typename: '${pascalCase(slug)}Success'; data: Record<string, unknown> }\n`;
    md += `  | { __typename: '${pascalCase(slug)}Error'; message: string; code: ${pascalCase(slug)}ErrorCode };\n\n`;
    md += `export type ${pascalCase(slug)}ErrorCode =\n`;
    md += `  | 'BAD_USER_INPUT'\n`;
    md += `  | 'UNAUTHENTICATED'\n`;
    md += `  | 'NOT_FOUND'\n`;
    md += `  | 'INTERNAL_SERVER_ERROR';\n`;
    md += `\`\`\`\n\n`;
    md += `### ◈ GraphQL Schema & Resolver Contract\n`;
    md += `| Operation Type | Operation Name | Endpoint | Batching Policy |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `| \`Query\` | \`${slug.replace(/-/g, '_')}\` | \`/graphql\` | DataLoader per-request batching |\n`;
    md += `| \`Mutation\` | \`update_${slug.replace(/-/g, '_')}\` | \`/graphql\` | Explicit input validation + typed union |\n\n`;
  } else if (isDatabase) {
    md += `// 1. Zod Runtime Database Migration & Schema Config\n`;
    md += `export const ${pascalCase(slug)}MigrationSchema = z.object({\n`;
    md += `  version: z.string().regex(/^\\d{14}_[a-z0-9_]+$/),\n`;
    md += `  transactional: z.boolean().default(true),\n`;
    md += `  lockTimeoutMs: z.number().int().positive().default(5000),\n`;
    md += `  statementTimeoutMs: z.number().int().positive().default(30000)\n`;
    md += `});\n\n`;
    md += `export type ${pascalCase(slug)}MigrationConfig = z.infer<typeof ${pascalCase(slug)}MigrationSchema>;\n\n`;
    md += `// 2. Reversible Migration Interface for ${title}\n`;
    md += `export interface ${pascalCase(slug)}Migration {\n`;
    md += `  up(tx: unknown): Promise<void>;\n`;
    md += `  down(tx: unknown): Promise<void>;\n`;
    md += `}\n\n`;
    md += `// 3. Discriminated Union Migration Result\n`;
    md += `export type ${pascalCase(slug)}Result =\n`;
    md += `  | { success: true; appliedVersion: string; durationMs: number }\n`;
    md += `  | { success: false; rolledBack: boolean; error: string; code: ${pascalCase(slug)}ErrorCode };\n\n`;
    md += `export type ${pascalCase(slug)}ErrorCode =\n`;
    md += `  | 'LOCK_TIMEOUT'\n`;
    md += `  | 'CONSTRAINT_VIOLATION'\n`;
    md += `  | 'MIGRATION_CONFLICT'\n`;
    md += `  | 'CONNECTION_ERROR';\n`;
    md += `\`\`\`\n\n`;
    md += `### 🗄️ Database Migration & Rollback Contract\n`;
    md += `| Phase | Direction | Safety Policy | Verification |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `| \`up()\` | Forward DDL | Wrapped in transaction + \`lock_timeout\` | Schema checksum + row count check |\n`;
    md += `| \`down()\` | Rollback DDL | Reversible without data loss | Re-apply idempotency check |\n\n`;
  } else if (isUi) {
    const isForm = /\b(form|login|signup|input)\b/i.test(lower);
    md += `// 1. Zod Runtime UI Component Props Schema\n`;
    md += `export const ${pascalCase(slug)}PropsSchema = z.object({\n`;
    if (isForm) {
      md += `  initialValues: z.record(z.string(), z.string()).optional(),\n`;
      md += `  disabled: z.boolean().default(false),\n`;
      md += `  submitLabel: z.string().min(1).default('Submit'),\n`;
      md += `  className: z.string().optional()\n`;
    } else {
      md += `  theme: z.enum(['light', 'dark', 'system']).default('system'),\n`;
      md += `  enabled: z.boolean().default(true),\n`;
      md += `  variant: z.enum(['default', 'compact', 'minimal']).optional(),\n`;
      md += `  className: z.string().optional()\n`;
    }
    md += `});\n\n`;
    md += `export type ${pascalCase(slug)}Props = z.infer<typeof ${pascalCase(slug)}PropsSchema>;\n\n`;
    md += `// 2. Component State & Event Handlers\n`;
    md += `export interface ${pascalCase(slug)}State {\n`;
    md += `  active: boolean;\n`;
    md += `  loading: boolean;\n`;
    md += `  validationError: string | null;\n`;
    md += `}\n\n`;
    md += `// 3. Discriminated Union Result & Typed Error Codes\n`;
    md += `export type ${pascalCase(slug)}Result =\n`;
    md += `  | { success: true; status: 'rendered'; state: ${pascalCase(slug)}State }\n`;
    md += `  | { success: false; status: 'render_error'; error: string; code: ${pascalCase(slug)}ErrorCode };\n\n`;
    md += `export type ${pascalCase(slug)}ErrorCode =\n`;
    md += `  | 'INVALID_PROPS'\n`;
    md += `  | 'VALIDATION_ERROR'\n`;
    md += `  | 'MOUNT_FAILED';\n`;
    md += `\`\`\`\n\n`;
    md += `### 🎨 UI Component & State Contract\n`;
    md += `| Property | Type | Default | Description |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    if (isForm) {
      md += `| \`disabled\` | \`boolean\` | \`false\` | Disables form inputs during submission |\n`;
      md += `| \`submitLabel\` | \`string\` | \`'Submit'\` | Accessible primary button text |\n`;
      md += `| \`className\` | \`string\` | \`undefined\` | Optional styling override |\n\n`;
    } else {
      md += `| \`theme\` | \`'light' \\| 'dark' \\| 'system'\` | \`'system'\` | Active visual mode |\n`;
      md += `| \`enabled\` | \`boolean\` | \`true\` | Interactive toggle state |\n`;
      md += `| \`variant\` | \`'default' \\| 'compact' \\| 'minimal'\` | \`'default'\` | Visual design variant |\n\n`;
    }
  } else if (isCli) {
    md += `// 1. Zod Runtime CLI Arguments & Options Schema\n`;
    md += `export const ${pascalCase(slug)}ArgsSchema = z.object({\n`;
    md += `  inputPath: z.string().min(1),\n`;
    md += `  outputPath: z.string().optional(),\n`;
    md += `  format: z.enum(['json', 'text', 'csv']).default('json'),\n`;
    md += `  verbose: z.boolean().default(false)\n`;
    md += `});\n\n`;
    md += `export type ${pascalCase(slug)}Args = z.infer<typeof ${pascalCase(slug)}ArgsSchema>;\n\n`;
    md += `// 2. Parsed Record & Summary Interface for ${title}\n`;
    md += `export interface ${pascalCase(slug)}Summary {\n`;
    md += `  recordsProcessed: number;\n`;
    md += `  errorsSkipped: number;\n`;
    md += `  durationMs: number;\n`;
    md += `}\n\n`;
    md += `// 3. Discriminated Union Exit Result\n`;
    md += `export type ${pascalCase(slug)}Result =\n`;
    md += `  | { success: true; exitCode: 0; summary: ${pascalCase(slug)}Summary }\n`;
    md += `  | { success: false; exitCode: 1 | 2; error: string; code: ${pascalCase(slug)}ErrorCode };\n\n`;
    md += `export type ${pascalCase(slug)}ErrorCode =\n`;
    md += `  | 'INVALID_ARGS'\n`;
    md += `  | 'FILE_NOT_FOUND'\n`;
    md += `  | 'PARSE_ERROR';\n`;
    md += `\`\`\`\n\n`;
    md += `### ⌨️ CLI Invocation & Exit Code Contract\n`;
    md += `| Flag / Arg | Type | Required | Exit Code on Error |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `| \`<inputPath>\` | \`string\` (file path or \`-\` for stdin) | Yes | \`2\` (Usage Error) |\n`;
    md += `| \`--format\` | \`json \\| text \\| csv\` | No (\`json\`) | \`2\` (Usage Error) |\n`;
    md += `| \`--output\` | \`string\` | No (stdout) | \`1\` (I/O Error) |\n\n`;
  } else if (isCache) {
    md += `// 1. Zod Runtime Cache Layer Config & Entry Schema\n`;
    md += `export const ${pascalCase(slug)}ConfigSchema = z.object({\n`;
    md += `  namespace: z.string().min(1).max(64),\n`;
    md += `  defaultTtlSeconds: z.number().int().positive().default(300),\n`;
    md += `  maxEntries: z.number().int().positive().optional(),\n`;
    md += `  fallbackToOrigin: z.boolean().default(true)\n`;
    md += `});\n\n`;
    md += `export type ${pascalCase(slug)}Config = z.infer<typeof ${pascalCase(slug)}ConfigSchema>;\n\n`;
    md += `// 2. Cache Store Interface for ${title}\n`;
    md += `export interface ${pascalCase(slug)}Store<T> {\n`;
    md += `  get(key: string): Promise<T | null>;\n`;
    md += `  set(key: string, value: T, ttlSeconds?: number): Promise<void>;\n`;
    md += `  invalidate(key: string): Promise<boolean>;\n`;
    md += `}\n\n`;
    md += `// 3. Discriminated Union Lookup Result\n`;
    md += `export type ${pascalCase(slug)}Result<T> =\n`;
    md += `  | { success: true; hit: true; value: T }\n`;
    md += `  | { success: true; hit: false; value: T; populated: boolean }\n`;
    md += `  | { success: false; error: string; code: ${pascalCase(slug)}ErrorCode };\n\n`;
    md += `export type ${pascalCase(slug)}ErrorCode =\n`;
    md += `  | 'CACHE_CONNECTION_ERROR'\n`;
    md += `  | 'SERIALIZATION_ERROR'\n`;
    md += `  | 'INVALID_KEY';\n`;
    md += `\`\`\`\n\n`;
    md += `### ⚡ Cache Operation & Consistency Contract\n`;
    md += `| Operation | Key Scope | TTL Policy | Failure Behavior |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `| \`get(key)\` | \`\${namespace}:\${key}\` | Checks expiry | Degrade gracefully to origin |\n`;
    md += `| \`set(key, val)\` | \`\${namespace}:\${key}\` | \`defaultTtlSeconds\` | Log warning, non-blocking |\n`;
    md += `| \`invalidate(key)\` | \`\${namespace}:\${key}\` | Immediate delete | Retry once on transient error |\n\n`;
  } else if (isPayment) {
    md += `// 1. Zod Runtime Idempotent Transaction Schema\n`;
    md += `export const ${pascalCase(slug)}Schema = z.object({\n`;
    md += `  id: z.string().uuid(),\n`;
    md += `  timestamp: z.number().int().positive(),\n`;
    md += `  idempotencyKey: z.string().min(16).max(128),\n`;
    md += `  amount: z.number().positive().optional(),\n`;
    md += `  currency: z.string().length(3).default('USD'),\n`;
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
  } else if (isAuth) {
    md += `// 1. Zod Runtime Authentication Schema\n`;
    md += `export const ${pascalCase(slug)}Schema = z.object({\n`;
    md += `  email: z.string().email(),\n`;
    md += `  role: z.enum(['admin', 'member', 'guest']).default('member'),\n`;
    md += `  sessionExpirySeconds: z.number().int().positive().default(86400)\n`;
    md += `});\n\n`;
    md += `export type ${pascalCase(slug)}Input = z.infer<typeof ${pascalCase(slug)}Schema>;\n\n`;
    md += `// 2. Target Domain Entity Interface for ${title}\n`;
    md += `export interface ${pascalCase(slug)}Session {\n`;
    md += `  userId: string;\n`;
    md += `  token: string;\n`;
    md += `  expiresAt: number;\n`;
    md += `}\n\n`;
    md += `// 3. Discriminated Union Result & Typed Error Codes\n`;
    md += `export type ${pascalCase(slug)}Result =\n`;
    md += `  | { success: true; status: 'authenticated'; session: ${pascalCase(slug)}Session }\n`;
    md += `  | { success: false; status: 'failed'; error: string; code: ${pascalCase(slug)}ErrorCode };\n\n`;
    md += `export type ${pascalCase(slug)}ErrorCode =\n`;
    md += `  | 'INVALID_CREDENTIALS'\n`;
    md += `  | 'SESSION_EXPIRED'\n`;
    md += `  | 'RATE_LIMITED'\n`;
    md += `  | 'INTERNAL_ERROR';\n`;
    md += `\`\`\`\n\n`;
    md += `### 🌐 Ingress Wire Protocol Contract\n`;
    md += `| Method | Route Path | Required Headers | Success Status |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `| \`POST\` | \`/api/v1/auth/${slug}\` | \`Content-Type: application/json\` | \`200 OK\` |\n\n`;
  } else if (isRestApi) {
    md += `// 1. Zod Runtime REST Resource Schema\n`;
    md += `export const ${pascalCase(slug)}Schema = z.object({\n`;
    md += `  id: z.string().uuid(),\n`;
    md += `  title: z.string().min(1).max(256),\n`;
    md += `  status: z.enum(['draft', 'published', 'archived']).default('draft'),\n`;
    md += `  createdAt: z.string().datetime().optional()\n`;
    md += `});\n\n`;
    md += `export type ${pascalCase(slug)}Resource = z.infer<typeof ${pascalCase(slug)}Schema>;\n\n`;
    md += `// 2. Discriminated Union Result & Typed Error Codes\n`;
    md += `export type ${pascalCase(slug)}Result =\n`;
    md += `  | { success: true; status: 'ok'; data: ${pascalCase(slug)}Resource }\n`;
    md += `  | { success: false; status: 'error'; error: string; code: ${pascalCase(slug)}ErrorCode };\n\n`;
    md += `export type ${pascalCase(slug)}ErrorCode =\n`;
    md += `  | 'VALIDATION_FAILED'\n`;
    md += `  | 'NOT_FOUND'\n`;
    md += `  | 'CONFLICT'\n`;
    md += `  | 'INTERNAL_ERROR';\n`;
    md += `\`\`\`\n\n`;
    md += `### 🌐 REST API Route Contract\n`;
    md += `| Method | Route Path | Content-Type | Success Status |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `| \`GET\` | \`/api/v1/${slug}\` | \`application/json\` | \`200 OK\` |\n`;
    md += `| \`POST\` | \`/api/v1/${slug}\` | \`application/json\` | \`201 Created\` |\n`;
    md += `| \`PATCH\` | \`/api/v1/${slug}/:id\` | \`application/json\` | \`200 OK\` |\n`;
    md += `| \`DELETE\` | \`/api/v1/${slug}/:id\` | \`application/json\` | \`204 No Content\` |\n\n`;
  } else {
    md += `// 1. Zod Runtime Domain Module Schema\n`;
    md += `export const ${pascalCase(slug)}Schema = z.object({\n`;
    md += `  id: z.string().uuid(),\n`;
    md += `  name: z.string().min(1).max(256),\n`;
    md += `  status: z.enum(['active', 'pending', 'archived']).default('active'),\n`;
    md += `  metadata: z.record(z.string(), z.unknown()).default({})\n`;
    md += `});\n\n`;
    md += `export type ${pascalCase(slug)}Input = z.infer<typeof ${pascalCase(slug)}Schema>;\n\n`;
    md += `// 2. Target Domain Module Interface for ${title}\n`;
    md += `export interface ${pascalCase(slug)}Config {\n`;
    md += `  enabled: boolean;\n`;
    md += `  timeoutMs?: number;\n`;
    md += `}\n\n`;
    md += `export interface ${pascalCase(slug)}Payload {\n`;
    md += `  id: string;\n`;
    md += `  name: string;\n`;
    md += `  status: string;\n`;
    md += `}\n\n`;
    md += `// 3. Discriminated Union Result & Typed Error Codes\n`;
    md += `export type ${pascalCase(slug)}Result =\n`;
    md += `  | { success: true; status: 'completed'; data: ${pascalCase(slug)}Payload; latencyMs: number }\n`;
    md += `  | { success: false; status: 'failed'; error: string; code: ${pascalCase(slug)}ErrorCode };\n\n`;
    md += `export type ${pascalCase(slug)}ErrorCode =\n`;
    md += `  | 'VALIDATION_FAILED'\n`;
    md += `  | 'NOT_FOUND'\n`;
    md += `  | 'INTERNAL_ERROR';\n`;
    md += `\`\`\`\n\n`;
    md += `### 📦 Module Interface Contract\n`;
    md += `| Export | Input Type | Return Type | Error Handling |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `| \`execute${pascalCase(slug)}\` | \`${pascalCase(slug)}Input\` | \`Promise<${pascalCase(slug)}Result>\` | Typed discriminated union |\n\n`;
  }

  md += `## 3. 🔄 STATE MACHINE & EVENT TRANSITIONS\n\n`;
  md += `\`\`\`text\n`;
  if (isGraphql) {
    md += `[IDLE] ──(GraphQL Document)──► [PARSE_AND_VALIDATE]\n`;
    md += `                                       │\n`;
    md += `               ┌───────────────────────┴───────────────────────┐\n`;
    md += `               ▼                                               ▼\n`;
    md += `       [BAD_USER_INPUT]                                [RESOLVE_BATCHED]\n`;
    md += `               │                                               │\n`;
    md += `               ▼                                       ┌───────┴───────┐\n`;
    md += `       [TYPED ERROR UNION]                             ▼               ▼\n`;
    md += `                                                [RESOLVER_FAIL]   [DATA_PAYLOAD]\n`;
  } else if (isDatabase) {
    md += `[PENDING] ──(Acquire Migration Lock)──► [BEGIN_TX]\n`;
    md += `                                            │\n`;
    md += `               ┌────────────────────────────┴────────────────────────────┐\n`;
    md += `               ▼                                                         ▼\n`;
    md += `        [LOCK_TIMEOUT]                                             [APPLY_DDL]\n`;
    md += `               │                                                         │\n`;
    md += `               ▼                                                 ┌───────┴───────┐\n`;
    md += `        [ABORT_CLEAN]                                            ▼               ▼\n`;
    md += `                                                         [ROLLBACK_TX]    [COMMIT_VERSION]\n`;
  } else if (isUi) {
    md += `[UNMOUNTED] ──(Mount Component)──► [IDLE]\n`;
    md += `                                      │\n`;
    md += `                        (User Event / Prop Change)\n`;
    md += `                                      ▼\n`;
    md += `                                [VALIDATING]\n`;
    md += `                                      │\n`;
    md += `               ┌──────────────────────┴──────────────────────┐\n`;
    md += `               ▼                                             ▼\n`;
    md += `       [VALIDATION_ERROR]                               [UPDATING]\n`;
    md += `               │                                             │\n`;
    md += `               ▼                                     ┌───────┴───────┐\n`;
    md += `      [INLINE FEEDBACK]                              ▼               ▼\n`;
    md += `                                              [ERROR_BOUNDARY]  [RENDERED]\n`;
  } else if (isCli) {
    md += `[INIT] ──(Parse argv/flags)──► [VALIDATING_ARGS]\n`;
    md += `                                      │\n`;
    md += `               ┌──────────────────────┴──────────────────────┐\n`;
    md += `               ▼                                             ▼\n`;
    md += `        [INVALID_ARGS]                               [STREAMING_INPUT]\n`;
    md += `               │                                             │\n`;
    md += `               ▼                                     ┌───────┴───────┐\n`;
    md += `        [STDERR + EXIT 2]                            ▼               ▼\n`;
    md += `                                              [IO/PARSE FAIL]    [COMPLETE]\n`;
    md += `                                                     │               │\n`;
    md += `                                                     ▼               ▼\n`;
    md += `                                              [STDERR + EXIT 1] [STDOUT + EXIT 0]\n`;
  } else if (isCache) {
    md += `[LOOKUP(key)] ──(Check Store)──► [CACHE_EVAL]\n`;
    md += `                                      │\n`;
    md += `               ┌──────────────────────┴──────────────────────┐\n`;
    md += `               ▼                                             ▼\n`;
    md += `          [CACHE_HIT]                                  [CACHE_MISS]\n`;
    md += `               │                                             │\n`;
    md += `               ▼                                             ▼\n`;
    md += `        [RETURN VALUE]                                [FETCH_ORIGIN]\n`;
    md += `                                                             │\n`;
    md += `                                                     ┌───────┴───────┐\n`;
    md += `                                                     ▼               ▼\n`;
    md += `                                              [STORE_ERROR]    [SET_TTL]\n`;
    md += `                                                     │               │\n`;
    md += `                                                     ▼               ▼\n`;
    md += `                                            [FALLBACK_RETURN]  [RETURN VALUE]\n`;
  } else {
    md += `[IDLE] ──(Receive Input)──► [VALIDATING]\n`;
    md += `                                 │\n`;
    md += `               ┌─────────────────┴─────────────────┐\n`;
    md += `               ▼                                   ▼\n`;
    md += `        [INVALID INPUT]                      [PROCESSING]\n`;
    md += `               │                                   │\n`;
    md += `               ▼                           ┌───────┴───────┐\n`;
    md += `      [VALIDATION_FAILED]                  ▼               ▼\n`;
    md += `                                    [EXECUTION FAILS] [SUCCESS]\n`;
    md += `                                           │               │\n`;
    md += `                                           ▼               ▼\n`;
    md += `                                    [ERROR RECOVERY]  [EMIT RESULT]\n`;
  }
  md += `\`\`\`\n\n`;

  md += `## 4. ⛔ STRICT NEGATIVE CONSTRAINTS (ZERO-SLOP CONTRACT)\n\n`;
  md += `1. **NO LAZY PLACEHOLDERS**: Every function must be fully implemented. TODO or placeholder stubs are strictly forbidden.\n`;
  md += `2. **NO UNTYPED ANY**: TypeScript strict mode must be respected. No casting to \`any\` or suppressing compiler diagnostics with \`@ts-ignore\`.\n`;
  md += `3. **NO TEST CHEATING**: Existing tests must not be modified or skipped to simulate passing builds.\n`;
  md += `4. **FAIL FAST WITH EXPLICIT ERRORS**: Catch and wrap low-level exceptions with contextual messages.\n\n`;

  md += `## 5. 🧪 TDD ACCEPTANCE CRITERIA & TEST MATRIX\n\n`;
  md += `| Test ID | Scenario | Expected Behavior | Verification Command |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  if (isUi) {
    md += `| **TC-01** | Default Prop Render | Mounts cleanly with accessible semantic markup | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-02** | Interactive State Update | State transitions cleanly on user events | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-03** | Keyboard & ARIA Support | Operable via keyboard with valid ARIA attributes | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-04** | Invalid Props / Error State | Renders clear feedback without crashing component tree | \`npx apex-agents test-loop\` |\n\n`;
  } else if (isCli) {
    md += `| **TC-01** | Valid File / Stdin Input | Parses records accurately and exits with code 0 | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-02** | Missing / Invalid Flags | Prints clear usage to stderr and exits with code 2 | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-03** | Non-Existent Input Path | Emits explicit FILE_NOT_FOUND error and exits 1 | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-04** | Malformed Record Line | Handles gracefully without unhandled exception | \`npx apex-agents test-loop\` |\n\n`;
  } else if (isCache) {
    md += `| **TC-01** | Cache Hit | Returns cached value without calling origin | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-02** | Cache Miss & Populate | Fetches origin and writes entry with configured TTL | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-03** | Key Invalidation | Subsequent lookup misses and refreshes from origin | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-04** | Store Outage Fallback | Degrades gracefully to origin without crashing process | \`npx apex-agents test-loop\` |\n\n`;
  } else {
    md += `| **TC-01** | Valid Input Processing | Returns \`{ success: true }\` with expected result | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-02** | Malformed / Empty Input | Rejects with explicit validation error | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-03** | Upstream Service Timeout | Recovers gracefully without crashing process | \`npx apex-agents test-loop\` |\n`;
    md += `| **TC-04** | Boundary / Edge Inputs | Handles extreme inputs cleanly without uncaught errors | \`npx apex-agents test-loop\` |\n\n`;
  }

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
