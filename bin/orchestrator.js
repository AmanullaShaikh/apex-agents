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
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function planSwarm(objective) {
  if (!objective) {
    console.error(`\x1b[31mPlease provide an objective. Example:\x1b[0m`);
    console.error(`  npx apex-agents plan "Build a real-time collaborative video canvas with auth"\n`);
    process.exit(1);
  }

  console.log(`\n${c.cyan}${c.bold}═════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}   APEX AGENTS: MULTI-AGENT SWARM ORCHESTRATION PLANNER          ${c.reset}`);
  console.log(`${c.cyan}${c.bold}═════════════════════════════════════════════════════════════════${c.reset}\n`);

  console.log(`${c.bold}Target Objective:${c.reset} "${c.yellow}${objective}${c.reset}"\n`);

  const lower = objective.toLowerCase();
  const assignments = [];

  // Keyword to Agent Matrix
  if (/auth|login|jwt|user|oauth|session|security/i.test(lower)) {
    assignments.push({
      phase: 'Phase 1: Security & Identity Foundation',
      agent: '@auth-identity-guard',
      role: 'Design JWT rotation, HttpOnly session cookies, and RBAC middleware.'
    });
    assignments.push({
      phase: 'Phase 1: Security & Identity Foundation',
      agent: '@appsec-auditor',
      role: 'Audit ingress endpoints against OWASP Top 10, SSRF, and injection vulnerabilities.'
    });
  }

  if (/database|db|postgres|sql|prisma|query|schema|index/i.test(lower)) {
    assignments.push({
      phase: 'Phase 2: Data Model & Persistence Architecture',
      agent: '@database-tuner',
      role: 'Design normalized schema, B-Tree indexes, and connection pooling strategy.'
    });
  }

  if (/api|backend|websocket|webrtc|realtime|stream|microservice/i.test(lower)) {
    assignments.push({
      phase: 'Phase 3: Backend & Wire Protocol Engineering',
      agent: '@backend-systems-lead',
      role: 'Implement distributed endpoints with Idempotency-Key support and structured error envelopes.'
    });
    assignments.push({
      phase: 'Phase 3: Backend & Wire Protocol Engineering',
      agent: '@network-security-auditor',
      role: 'Audit WebSocket upgrade handshake, CSWSH defenses, and sliding-window rate limits.'
    });
  }

  if (/ui|frontend|react|next|component|design|css|animation|canvas/i.test(lower)) {
    assignments.push({
      phase: 'Phase 4: Frontend & User Interface Engineering',
      agent: '@frontend-architect',
      role: 'Build accessible, responsive UI adhering to Frame.io dark-graphite standards and 60fps GPU compositing.'
    });
    assignments.push({
      phase: 'Phase 4: Frontend & User Interface Engineering',
      agent: '@state-machine-architect',
      role: 'Model interactive UI flows as deterministic state machines using XState to eliminate impossible states.'
    });
  }

  if (/video|media|render|remotion|ffmpeg|audio/i.test(lower)) {
    assignments.push({
      phase: 'Phase 4: Media & Dynamic Video Processing',
      agent: '@remotion-motion-engineer',
      role: 'Construct deterministic 60fps React motion sequences with clamped spring dynamics.'
    });
    assignments.push({
      phase: 'Phase 4: Media & Dynamic Video Processing',
      agent: '@ffmpeg-pipeline-master',
      role: 'Build headless transcode filtergraph with faststart web streaming and GPU acceleration.'
    });
  }

  if (/rag|llm|ai|vector|embedding|prompt|eval/i.test(lower)) {
    assignments.push({
      phase: 'Phase 4: AI & Agentic Intelligence Layer',
      agent: '@rag-pipeline-architect',
      role: 'Implement hybrid search (BM25 + Dense embeddings) with reciprocal rank fusion and rerankers.'
    });
    assignments.push({
      phase: 'Phase 4: AI & Agentic Intelligence Layer',
      agent: '@prompt-injection-shield',
      role: 'Enforce structural XML input delimiters and secret canary tokens to prevent prompt injection.'
    });
  }

  // Mandatory Quality & Release Phase
  assignments.push({
    phase: 'Phase 5: Verification, Testing & Zero-Slop Gate',
    agent: '@tdd-champion',
    role: 'Write failing reproduction unit tests before code, verifying edge-case coverage.'
  });
  assignments.push({
    phase: 'Phase 5: Verification, Testing & Zero-Slop Gate',
    agent: '@cwv-lcp-doctor',
    role: 'Audit Core Web Vitals (LCP < 2.5s, INP < 200ms, zero CLS) before deployment.'
  });
  assignments.push({
    phase: 'Phase 6: Release & Documentation',
    agent: '@pr-artisan',
    role: 'Inspect git diff and synthesize Conventional Commits with evidence-backed PR documentation.'
  });

  // Group by Phase
  const phases = {};
  for (const item of assignments) {
    if (!phases[item.phase]) phases[item.phase] = [];
    phases[item.phase].push(item);
  }

  for (const [phaseName, items] of Object.entries(phases)) {
    console.log(`${c.magenta}${c.bold}▶ [${phaseName}]${c.reset}`);
    for (const item of items) {
      console.log(`  ${c.green}• ${item.agent.padEnd(28)}${c.reset} ${item.role}`);
    }
    console.log();
  }

  console.log(`${c.cyan}${c.bold}EXECUTION DIRECTIVE FOR AI AGENT:${c.reset}`);
  console.log(`Copy and paste this instruction into your AI agent:`);
  console.log(`\n${c.gray}"""${c.reset}`);
  console.log(`Follow the Apex Agents Swarm Plan for: "${objective}".`);
  console.log(`Execute sequentially through Phase 1 to Phase 6.`);
  console.log(`Adopt the specific specialist persona and negative constraints at each phase.`);
  console.log(`Verify exit code 0 and zero regressions before declaring done.`);
  console.log(`${c.gray}"""${c.reset}\n`);
}

const userObjective = process.argv.slice(2).join(' ');
planSwarm(userObjective);
