# ⚡ Apex Agents: The Industrial-Grade AI Agent Harness

> **The zero-slop autonomous engineering agency and execution harness. 10 specialized divisions, 38+ expert agent personas, Babel AST context compaction (70-88% token reduction), persistent cross-session memory, physical git worktree sandboxes, pre-commit secret leak interceptors, and native Model Context Protocol (MCP) server for Claude Code, Cursor, Codex, Windsurf, Copilot, and Antigravity.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Version: 1.8.0](https://img.shields.io/badge/version-1.8.0-brightgreen.svg?style=flat-square)](https://www.npmjs.com/package/apex-agents)
[![Babel AST](https://img.shields.io/badge/AST%20Parser-Babel%20Engine-F5DA55.svg?style=flat-square)](https://babeljs.io)
[![Eval Score](https://img.shields.io/badge/Evaluation-100%2F100%20(Grade%20A%2B)-success.svg?style=flat-square)](#-agency-evaluation--benchmark-harness)
[![AST Compaction](https://img.shields.io/badge/Context%20Reduction-70%25--88.5%25%20Savings-blueviolet.svg?style=flat-square)](#-babel-ast-context-compactor)
[![MCP Native](https://img.shields.io/badge/MCP-Native%20Server-purple.svg?style=flat-square)](#-native-mcp-server-support)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](https://github.com/AmanullaShaikh/apex-agents/pulls)

---

## 💡 Why Apex Agents?

Generic AI coding prompts output generic, fragile code. They leave lazy `// TODO` placeholders, invent non-existent APIs, introduce N+1 query bottlenecks, leak production API keys into git commits, and hallucinate changes across 15 unrelated files.

**Apex Agents** converts your coding agent harness into an **enterprise-grade engineering agency** backed by physical filesystem and AST tools:
* **True Babel AST Token Compactor**: Uses `@babel/parser` to strip function and method implementation bodies while preserving 100% syntactically valid TypeScript/JSX interfaces, exports, and signatures.
* **Persistent Cross-Session Memory (`apex-agents memory`)**: Records technical decisions, architecture contracts, and known bugs in `.agents/memory.json` and syncs them automatically into `CLAUDE.md` and `.cursorrules`.
* **38+ Specialized Domain Experts**: Need database tuning? Summon `@database-tuner`. Need system scale? Summon `@system-design-architect`. Need type safety? Summon `@typescript-pro`.
* **12 Operational Instincts**: Grounded reflexes derived from real production failure modes: Zero-Slop Contract, Anti-Loop Circuit Breaker, Karpathy Pitfalls Defense, and Ponytail Minimal-Code.
* **Physical Pre-Commit Safety Hooks**: Intercepts credentials (AWS, Stripe, OpenAI) and scope drift at the `.git/hooks/pre-commit` level before files ever hit git.
* **Isolated Git Worktree Sandboxes**: Safely runs speculative AI features in `.worktrees/` without polluting your active working branch.
* **Native Model Context Protocol (MCP)**: Built-in JSON-RPC stdio MCP server for Claude Desktop, Cursor, and Antigravity.

---

## 🚀 60-Second Quickstart

```bash
# Run the agency CLI via npx (zero global install needed)
npx apex-agents <command>
```

### Essential CLI Commands:

| Command | Action |
| :--- | :--- |
| `npx apex-agents studio` | Launch the interactive keyboard-driven Terminal Studio |
| `npx apex-agents compact` | Run Babel AST Context Compactor to shrink codebase tokens by 70-88% |
| `npx apex-agents memory [cmd]` | Manage persistent cross-session memory (`record`, `recall`, `sync`, `clear`) |
| `npx apex-agents review` | Audit staged/committed git diff for secret leaks & AI slop |
| `npx apex-agents budget` | Analyze context window token bloat & generate `.cursorignore` |
| `npx apex-agents design <preset>` | Inject `DESIGN.md` design system tokens (`linear`, `stripe`, `apple`, `raycast`) |
| `npx apex-agents caveman on` | Enable 65% token-drop telegraphic brevity mode |
| `npx apex-agents eval` | Run the agency verification benchmark suite (100/100 Grade A+) |
| `npx apex-agents export-all`| Export configs for Claude Code, Cursor, Windsurf, Copilot, & Aider |
| `npx apex-agents plan "<goal>"`| Decompose an objective into a multi-agent swarm execution plan |
| `npx apex-agents install-hooks`| Install physical pre-commit safety hooks in `.git/hooks/` |
| `npx apex-agents sandbox start <name>`| Spin up an isolated Git Worktree sandbox |
| `npx apex-agents scope-guard` | Detect unintended file drift across staged git changes |
| `npx apex-agents orphans` | Scan repository for unwired or orphaned source files |
| `npx apex-agents graph` | Analyze AST codebase dependencies & detect circular import cycles |
| `npx apex-agents diagram` | Generate responsive dark-mode HTML architecture diagram card |
| `npx apex-agents dashboard` | Open the offline dark-mode Agent Explorer in your browser |
| `npx apex-agents mcp` | Start the native Model Context Protocol (MCP) server |

---

## 🎨 Production Design Systems (`apex-agents design`)

Drop world-class, brand-grade design tokens and micro-interaction rules straight into your project:

```bash
# Linear dark graphite craft (#08090a, 1px subtle borders, snappy spring curves)
npx apex-agents design linear

# Stripe precision (high contrast, tabular numbers, layered elevations)
npx apex-agents design stripe

# Apple Human Interface Guidelines (translucent materials, fluid spring physics)
npx apex-agents design apple

# Raycast density (hyper-dense command palette, zero-latency feedback)
npx apex-agents design raycast
```
Coding agents reading `DESIGN.md` will generate cohesive, pixel-perfect UI without generic Tailwind slop.

---

## 🪨 Caveman 65% Token Reducer (`apex-agents caveman`)

During long multi-agent autonomous iterations or bulk refactor loops, AI pleasantries and conversational filler waste tokens.

```bash
# Enable 65% token drop mode in local CLAUDE.md & .cursorrules
npx apex-agents caveman on

# Disable and restore natural prose
npx apex-agents caveman off
```
Cuts token expenditure by 50-65% by enforcing telegraphic root-cause synthesis while keeping all code blocks 100% complete and compilable.

---

## 🗜️ AST Context Compactor (`apex-agents compact`)

Compresses raw files into structural type, interface, and function skeletons:

```bash
npx apex-agents compact
```

```
Original Size  : ~12,931 tokens (48.9 KB)
Compacted Size : ~1,490 tokens (5.6 KB)
Token Reduction: 88.5% Saved!
Output File    : APEX_CONTEXT.md
```

---

## 🛡️ Zero-Slop PR Diff Auditor (`apex-agents review`)

```bash
# Audit working tree changes
npx apex-agents review

# Audit staged changes strictly
npx apex-agents review --staged --strict

# Generate GitHub PR comment markdown
npx apex-agents review --branch=main --format=markdown
```

---

## 🧪 Agency Evaluation & Benchmark Harness (`apex-agents eval`)

```bash
npx apex-agents eval
```

```
┌─────────────────────────────────────────────────────────────┬──────────────────┬────────┐
│ Evaluation Vector                                           │ Benchmark Result │ Status │
├─────────────────────────────────────────────────────────────┼──────────────────┼────────┤
│ Agent Schema & Frontmatter Completeness                     │ 100.0%           │  PASS  │
│ Zero-Slop Operational Instincts                             │ 100.0%           │  PASS  │
│ AST Context Compactor Compression & Signature Preservation  │ 55.7% savings    │  PASS  │
│ Credential Leak Sentinel Detection Accuracy                 │ 100.0% (3/3 caug │  PASS  │
│ AI Slop & Lazy Placeholder Diff Gate                        │ 100.0% (3/3 caug │  PASS  │
└─────────────────────────────────────────────────────────────┴──────────────────┴────────┘

COMPOSITE EVALUATION SCORE: 100/100 (GRADE: A+)
```

---

## 🔌 Native MCP Server Support

Connect all 38+ specialists and 12 instincts directly to Claude Desktop, Cursor, or Antigravity via stdio.

### Add to Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "apex-agents": {
      "command": "npx",
      "args": ["-y", "apex-agents", "mcp"]
    }
  }
}
```

---

## 🏛️ Agency Divisions & Specialists (38 Experts)

### 1. 🛠️ Core Engineering
- **Frontend Architect** (`@frontend-architect`): React 19, Next.js, state machines, accessible UI, 60fps GPU compositing.
- **TypeScript Pro** (`@typescript-pro`): Matt Pocock-level generics, discriminated unions, template literals, zero-any.
- **Backend Systems Lead** (`@backend-systems-lead`): Distributed architectures, idempotency, rate limiting.
- **Database Tuner** (`@database-tuner`): B-Tree indexing, `EXPLAIN ANALYZE`, connection pooling.
- **API & Microservices Lead** (`@api-microservices-lead`): Event pipelines, WebSockets, gRPC.
- **State Machine Architect** (`@state-machine-architect`): XState, finite state machines.
- **Fullstack General** (`@fullstack-general`): End-to-end vertical features, shared schemas.

### 2. 🤖 AI, LLM & Agentic Systems
- **RAG Pipeline Architect** (`@rag-pipeline-architect`): Hybrid search (BM25 + Dense vector), cross-encoders.
- **LLM Eval Benchmarker** (`@eval-benchmarker`): Faithfulness scoring, hallucination benchmarks.
- **Prompt Injection Shield** (`@prompt-injection-shield`): Jailbreak defense, canary tokens.
- **MCP Server Builder** (`@mcp-server-builder`): Model Context Protocol servers, JSON-RPC 2.0.

### 3. 🎬 Media & Video Processing
- **Remotion Motion Engineer** (`@remotion-motion-engineer`): Deterministic 60fps React video, clamped spring physics.
- **FFmpeg Pipeline Master** (`@ffmpeg-pipeline-master`): Faststart web streaming, NVENC hardware acceleration.

### 4. 🌐 Cloud-Native & Distributed Scale
- **System Design Architect** (`@system-design-architect`): Donne Martin scale patterns, sharding, caching topologies.
- **Serverless Edge Lead** (`@serverless-edge-lead`): Cloudflare Workers, sub-50ms cold starts, streaming SSR.
- **GraphQL Federation** (`@graphql-federation-architect`): Apollo Federation v2, DataLoader N+1 batching.
- **Event Sourcing Specialist** (`@event-sourcing-specialist`): Append-only event stores, CQRS, Outbox pattern.

### 5. 🔍 Reverse Engineering & Protocols
- **Native Binary Decompiler** (`@binary-decompiler`): morluto/rea & craft-anything native ELF/PE/WASM reverse engineering.
- **Binary & AST Inspector** (`@binary-ast-inspector`): Source map reconstruction, AST normalization, JS unminifying.
- **Network Security Auditor** (`@network-security-auditor`): TLS 1.3 audit, WebSocket hijacking defense.

### 6. 🛡️ Security & Red Team
- **AppSec Auditor** (`@appsec-auditor`): OWASP Top 10, SQLi, XSS, SSRF prevention.
- **Secret Leak Sentinel** (`@secret-leak-sentinel`): High-entropy credential scanning, `.env` protection.
- **Auth & Identity Guard** (`@auth-identity-guard`): OAuth2, PKCE, JWT tampering validation.
- **Dependency Scanner** (`@dependency-vulnerability-scanner`): npm audit, CVE remediation, supply chain defense.

### 7. ⚡ Deep Performance
- **CWV & LCP Doctor** (`@cwv-lcp-doctor`): Addy Osmani-level Sub-2.5s LCP, INP main-thread scheduling.
- **Memory Leak Hunter** (`@memory-leak-hunter`): V8 heap snapshot analysis, detached DOM nodes.
- **Bundle Dietician** (`@bundle-dietician`): Tree-shaking, dead ghost dependency elimination.
- **SQL Query Optimizer** (`@sql-query-optimizer`): Keyset pagination, composite index scans.

### 8. 🧪 Quality Assurance & Testing
- **TDD Champion** (`@tdd-champion`): Red-Green-Refactor cycles, Vitest/Jest unit & branch coverage.
- **E2E Playwright Tester** (`@e2e-playwright-tester`): Deterministic browser automation, trace debugging.
- **Edge-Case Fuzzer** (`@edge-case-fuzzer`): Extreme inputs, unicode fuzzing, race conditions.

### 9. ☁️ DevOps & Infrastructure
- **Docker Slimmer** (`@docker-slimmer`): Multi-stage Dockerfiles, non-root users, 70%+ size reduction.
- **CI/CD Pipeline Master** (`@ci-cd-pipeline-master`): Parallel GitHub Actions, layer caching.
- **Kubernetes Architect** (`@k8s-cloud-architect`): Helm, HPA autoscaling, zero-downtime rolling updates.

### 10. 🚀 Product Launch & DevRel
- **Growth Marketer** (`@growth-marketer`): Corey Haines CRO, technical copywriting, viral launch loops.
- **Prompt Architect** (`@prompt-architect`): 6-step hierarchical system prompts for Claude, GPT-4o, and Gemini.
- **PR Artisan** (`@pr-artisan`): Conventional Commits, git diff analysis.
- **README Copywriter** (`@readme-copywriter`): Viral open-source READMEs, conversion hooks.

---

## ⚡ The 12 Operational Instincts

1. **Zero-Slop Contract**: Strictly forbids `// TODO` stubs, empty handlers, and cosmetic skinning.
2. **Verification Before Completion**: Mandates compiler checks, linters, and tests before claiming success.
3. **Test-Driven Discipline**: Bug fixes require reproducing failing tests first.
4. **Context Retention**: Periodic STATE blocks prevent attention drift across long threads.
5. **Anti-Loop Root Cause**: Circuit breaker halts infinite contractor loops after 2 consecutive failures.
6. **Anti-Drift Scope Boundary**: Restricts file modifications strictly to target boundary.
7. **Rationalization Breaker**: Eliminates common LLM excuses ("Tests pass so it must work").
8. **Systematic Investigation**: 4-phase iron law: Reproduce -> Isolate -> Hypothesize -> Verify.
9. **Karpathy Pitfalls Defense**: Andrej Karpathy anti-hallucination, API verification, and premature abstraction guards.
10. **Ponytail Minimal-Code**: "The best code is the code you never wrote." Deletes before adding.
11. **Caveman Token Discipline**: 65% token drop telegraphic brevity mode for long autonomous loops.
12. **Editorial Diagram Rules**: Clean self-contained HTML/SVG cards without messy Mermaid spaghetti.

---

## 📜 License

Distributed under the **MIT License**. Free for personal and commercial engineering teams worldwide.

---

<div align="center">
  <sub>Engineered with precision by <strong>Amanulla Shaikh</strong> for the global autonomous AI engineering ecosystem.</sub>
</div>
