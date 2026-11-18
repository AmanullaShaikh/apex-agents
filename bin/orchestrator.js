#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  blue: '\x1b[34m'
};

/**
 * Generates an explicit Directed Acyclic Graph (DAG) for multi-agent execution.
 */
export function generateSwarmDag(objective) {
  const lower = (objective || '').toLowerCase();
  const tasks = [];

  // Phase 1: Security & Identity
  if (/\b(auth|authentication|login|jwt|user|users|oauth|session|security)\b/i.test(lower)) {
    tasks.push({
      id: 'task-sec-auth',
      wave: 0,
      phase: 'Phase 1: Security & Identity Foundation',
      agent: '@auth-identity-guard',
      role: 'Design JWT rotation, HttpOnly session cookies, and RBAC middleware.',
      dependsOn: [],
      concurrency: 'parallel',
      tokenBudget: 6000,
      sandboxBranch: 'apex/task-sec-auth'
    });
    tasks.push({
      id: 'task-sec-audit',
      wave: 0,
      phase: 'Phase 1: Security & Identity Foundation',
      agent: '@appsec-auditor',
      role: 'Audit ingress endpoints against OWASP Top 10, SSRF, and injection vulnerabilities.',
      dependsOn: [],
      concurrency: 'parallel',
      tokenBudget: 5000,
      sandboxBranch: 'apex/task-sec-audit'
    });
  }

  // Phase 2: Persistence & Data Modeling
  const secDeps = tasks.filter(t => t.wave === 0).map(t => t.id);
  if (/\b(database|db|postgres|postgresql|sql|prisma|query|schema|index|sqlite|mysql|mongo|mongodb)\b/i.test(lower)) {
    tasks.push({
      id: 'task-db-model',
      wave: 1,
      phase: 'Phase 2: Data Model & Persistence Architecture',
      agent: '@database-tuner',
      role: 'Design normalized schema, B-Tree indexes, and connection pooling strategy.',
      dependsOn: secDeps,
      concurrency: 'sequential',
      tokenBudget: 8000,
      sandboxBranch: 'apex/task-db-model'
    });
  }

  // Phase 3: Distributed Systems & API Protocol
  const dbDeps = tasks.filter(t => t.wave <= 1).map(t => t.id);
  if (/\b(api|apis|backend|websocket|websockets|webrtc|realtime|real-time|stream|streaming|microservice|microservices|rest|graphql|endpoint|endpoints)\b/i.test(lower)) {
    tasks.push({
      id: 'task-backend-api',
      wave: 2,
      phase: 'Phase 3: Backend & Wire Protocol Engineering',
      agent: '@backend-systems-lead',
      role: 'Implement distributed endpoints with Idempotency-Key support and structured error envelopes.',
      dependsOn: dbDeps.length > 0 ? dbDeps : secDeps,
      concurrency: 'parallel',
      tokenBudget: 10000,
      sandboxBranch: 'apex/task-backend-api'
    });
    tasks.push({
      id: 'task-net-audit',
      wave: 2,
      phase: 'Phase 3: Backend & Wire Protocol Engineering',
      agent: '@network-security-auditor',
      role: 'Audit WebSocket upgrade handshake, CSWSH defenses, and sliding-window rate limits.',
      dependsOn: dbDeps.length > 0 ? dbDeps : secDeps,
      concurrency: 'parallel',
      tokenBudget: 6000,
      sandboxBranch: 'apex/task-net-audit'
    });
  }

  // Phase 4: UI & Video / Media Systems
  const apiDeps = tasks.filter(t => t.wave <= 2).map(t => t.id);
  const hasFrontend = /\b(ui|frontend|react|next|nextjs|vue|svelte|component|components|design|css|animation|canvas|form|dashboard)\b/i.test(lower);
  if (hasFrontend) {
    tasks.push({
      id: 'task-frontend-ui',
      wave: 3,
      phase: 'Phase 4: Frontend & User Interface Engineering',
      agent: '@frontend-architect',
      role: 'Build accessible, responsive UI adhering to dark-graphite standards and 60fps GPU compositing.',
      dependsOn: apiDeps,
      concurrency: 'parallel',
      tokenBudget: 9000,
      sandboxBranch: 'apex/task-frontend-ui'
    });
    tasks.push({
      id: 'task-state-machine',
      wave: 3,
      phase: 'Phase 4: Frontend & User Interface Engineering',
      agent: '@state-machine-architect',
      role: 'Model interactive UI flows as deterministic state machines using XState to eliminate impossible states.',
      dependsOn: apiDeps,
      concurrency: 'parallel',
      tokenBudget: 7000,
      sandboxBranch: 'apex/task-state-machine'
    });
  }

  if (/\b(video|media|render|rendering|remotion|ffmpeg|audio|transcode)\b/i.test(lower)) {
    tasks.push({
      id: 'task-media-remotion',
      wave: 3,
      phase: 'Phase 4: Media & Dynamic Video Processing',
      agent: '@remotion-motion-engineer',
      role: 'Construct deterministic 60fps React motion sequences with clamped spring dynamics.',
      dependsOn: apiDeps,
      concurrency: 'parallel',
      tokenBudget: 8000,
      sandboxBranch: 'apex/task-media-remotion'
    });
    tasks.push({
      id: 'task-media-ffmpeg',
      wave: 3,
      phase: 'Phase 4: Media & Dynamic Video Processing',
      agent: '@ffmpeg-pipeline-master',
      role: 'Build headless transcode filtergraph with faststart web streaming and GPU acceleration.',
      dependsOn: apiDeps,
      concurrency: 'parallel',
      tokenBudget: 7000,
      sandboxBranch: 'apex/task-media-ffmpeg'
    });
  }

  if (/\b(rag|llm|llms|ai|vector|vectors|embedding|embeddings|prompt|prompts|eval|evals)\b/i.test(lower)) {
    tasks.push({
      id: 'task-ai-rag',
      wave: 3,
      phase: 'Phase 4: AI & Agentic Intelligence Layer',
      agent: '@rag-pipeline-architect',
      role: 'Implement hybrid search (BM25 + Dense embeddings) with reciprocal rank fusion and rerankers.',
      dependsOn: apiDeps,
      concurrency: 'parallel',
      tokenBudget: 9000,
      sandboxBranch: 'apex/task-ai-rag'
    });
    tasks.push({
      id: 'task-ai-shield',
      wave: 3,
      phase: 'Phase 4: AI & Agentic Intelligence Layer',
      agent: '@prompt-injection-shield',
      role: 'Enforce structural XML input delimiters and secret canary tokens to prevent prompt injection.',
      dependsOn: apiDeps,
      concurrency: 'parallel',
      tokenBudget: 5000,
      sandboxBranch: 'apex/task-ai-shield'
    });
  }

  // Phase 5: Verification & Zero-Slop Gate
  const prevDeps = tasks.map(t => t.id);
  const gateDeps = ['task-gate-tdd'];
  tasks.push({
    id: 'task-gate-tdd',
    wave: 4,
    phase: 'Phase 5: Verification, Testing & Zero-Slop Gate',
    agent: '@tdd-champion',
    role: 'Write failing reproduction unit tests before code, verifying edge-case coverage.',
    dependsOn: prevDeps,
    concurrency: 'sequential',
    tokenBudget: 8000,
    sandboxBranch: 'apex/task-gate-tdd'
  });

  if (hasFrontend) {
    gateDeps.push('task-gate-cwv');
    tasks.push({
      id: 'task-gate-cwv',
      wave: 4,
      phase: 'Phase 5: Verification, Testing & Zero-Slop Gate',
      agent: '@cwv-lcp-doctor',
      role: 'Audit Core Web Vitals (LCP < 2.5s, INP < 200ms, zero CLS) before deployment.',
      dependsOn: prevDeps,
      concurrency: 'parallel',
      tokenBudget: 4000,
      sandboxBranch: 'apex/task-gate-cwv'
    });
  }

  // Phase 6: Release & PR Synthesis
  tasks.push({
    id: 'task-release-pr',
    wave: 5,
    phase: 'Phase 6: Release & Documentation',
    agent: '@pr-artisan',
    role: 'Inspect git diff and synthesize Conventional Commits with evidence-backed PR documentation.',
    dependsOn: gateDeps,
    concurrency: 'sequential',
    tokenBudget: 5000,
    sandboxBranch: 'apex/task-release-pr'
  });

  return tasks;
}

export async function planSwarm(objective, options = {}) {
  if (!objective) {
    console.error(`\x1b[31mPlease provide an objective. Example:\x1b[0m`);
    console.error(`  npx apex-agents plan "Build a real-time collaborative video canvas with auth"\n`);
    process.exit(1);
  }

  const shouldExecute = options.execute || process.argv.includes('--execute') || process.argv.includes('-x');

  console.log(`\n${c.cyan}${c.bold}═════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}   APEX AGENTS: SWARM DAG PLANNER & WORKTREE SCAFFOLDER          ${c.reset}`);
  console.log(`${c.cyan}${c.bold}═════════════════════════════════════════════════════════════════${c.reset}\n`);

  console.log(`${c.bold}Target Objective:${c.reset} "${c.yellow}${objective}${c.reset}"\n`);

  const tasks = generateSwarmDag(objective);

  // Group by Wave / Phase
  const waves = new Map();
  for (const t of tasks) {
    if (!waves.has(t.wave)) waves.set(t.wave, []);
    waves.get(t.wave).push(t);
  }

  console.log(`${c.bold}DAG EXECUTION TOPOLOGY & PER-AGENT TOKEN BUDGETS:${c.reset}`);
  console.log(`┌────────────────────────────────────────────────────────────────────────────────────────┐`);

  for (const [waveNum, waveTasks] of waves.entries()) {
    const phaseName = waveTasks[0].phase;
    console.log(`│ ${c.magenta}${c.bold}[Wave ${waveNum}] ${phaseName.padEnd(72)}${c.reset}│`);
    for (const t of waveTasks) {
      const deps = t.dependsOn.length > 0 ? `dependsOn: [${t.dependsOn.join(', ')}]` : 'root';
      const budget = `${t.tokenBudget}t`;
      console.log(`│   ${c.green}• ${t.agent.padEnd(26)}${c.reset} ${c.gray}(${budget}, ${t.concurrency})${c.reset} ${deps.padEnd(30)} │`);
      console.log(`│     ${c.dim}${t.role.slice(0, 80)}${c.reset}`);
    }
    console.log(`├────────────────────────────────────────────────────────────────────────────────────────┤`);
  }
  console.log(`└────────────────────────────────────────────────────────────────────────────────────────┘\n`);

  console.log(`${c.cyan}${c.bold}ISOLATED GIT WORKTREE SANDBOX COMMANDS:${c.reset}`);
  for (const t of tasks.slice(0, 4)) {
    console.log(`  ${c.gray}git worktree add .worktrees/${t.id} -b ${t.sandboxBranch}${c.reset}`);
  }
  console.log();

  if (shouldExecute) {
    console.log(`${c.cyan}${c.bold}⚡ [DAG Execution]: Spawning physical Git Worktree sandboxes...${c.reset}`);
    try {
      const { handleStart } = await import('../scripts/worktree-sandbox.js');
      for (const task of tasks.slice(0, 3)) {
        try {
          handleStart(task.id);
          const worktreeDir = path.join(process.cwd(), '.worktrees', task.id);
          if (fs.existsSync(worktreeDir)) {
            const taskSpec = `# APEX AGENTS: ASSIGNED WORKSPACE TASK\n` +
              `> **Agent**: ${task.agent}\n` +
              `> **Phase**: ${task.phase}\n` +
              `> **Token Budget**: ${task.tokenBudget} tokens\n` +
              `> **Depends On**: ${task.dependsOn.join(', ') || 'None (Root)'}\n\n` +
              `## Objective Directives:\n${task.role}\n\n` +
              `## Execution Rules:\n` +
              `1. Work strictly inside this isolated sandbox branch (\`${task.sandboxBranch}\`).\n` +
              `2. Run 'npx apex-agents test-loop' before recording any commit.\n` +
              `3. Do not modify files outside your assigned domain scope.\n`;
            fs.writeFileSync(path.join(worktreeDir, 'TASK.md'), taskSpec);
            console.log(`  ${c.green}✓${c.reset} Injected ${c.cyan}TASK.md${c.reset} directive into sandbox: ${task.id}`);
          }
        } catch (e) {
          console.log(`  ${c.yellow}!${c.reset} Worktree ${task.id} notice: ${e.message}`);
        }
      }
    } catch (err) {
      console.log(`  ${c.yellow}! Worktree sandbox spawn: ${err.message}${c.reset}`);
    }
    console.log();
  }

  console.log(`${c.cyan}${c.bold}PARALLEL AGENT EXECUTION DIRECTIVE:${c.reset}`);
  console.log(`Apply this contract directive to your agent session (Cursor / Claude Code / Antigravity):`);
  console.log(`\n${c.gray}"""${c.reset}`);
  console.log(`Follow the Apex Agents Parallel DAG Swarm Plan for: "${objective}".`);
  console.log(`Execute sequentially through Wave 0 to Wave 5 according to the DAG dependency edges.`);
  console.log(`Adopt the specific specialist persona and negative constraints at each wave.`);
  console.log(`Verify exit code 0 and zero regressions before declaring done.`);
  console.log(`${c.gray}"""${c.reset}\n`);

  return tasks;
}

// CLI invocation
if (process.argv[1] && process.argv[1].endsWith('orchestrator.js')) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const userObjective = args.join(' ');
  planSwarm(userObjective);
}
