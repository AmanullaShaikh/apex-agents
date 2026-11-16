# ⚡ Apex Agents

> **The Sovereign AI Engineering Harness & Developer Tooling Engine.**  
> A dual-layer framework combining a **real-time Node.js Babel AST tooling suite** with **38 specialized domain-expert directives** and **native Model Context Protocol (MCP)** integration for **Cursor, Claude Code, Windsurf, Copilot, Codex, and Antigravity**.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/apex-agents.svg?style=flat-square&color=38bdf8)](https://www.npmjs.com/package/apex-agents)
[![CI & Integrity Suite](https://github.com/AmanullaShaikh/apex-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/AmanullaShaikh/apex-agents/actions/workflows/ci.yml)
[![Babel AST Engine](https://img.shields.io/badge/AST%20Parser-Babel%20Engine-F5DA55.svg?style=flat-square)](https://babeljs.io)
[![Context Reduction](https://img.shields.io/badge/Context%20Reduction-85%25--88.5%25-6366f1.svg?style=flat-square)](#-ast-context-compactor-apex-agents-compact)
[![Engine Benchmark](https://img.shields.io/badge/Engine%20Benchmark-Grade%20A%2B%20Verified-10b981.svg?style=flat-square)](#-7-architectural--ast-engine-benchmark-apex-agents-swe-eval)
[![MCP Protocol](https://img.shields.io/badge/MCP-Native%20Server-8b5cf6.svg?style=flat-square)](#-native-model-context-protocol-mcp-server)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](https://github.com/AmanullaShaikh/apex-agents/pulls)

</div>

---

## 💡 The Core Problem: Why Autonomous Coding Agents Fail

Leading AI coding models (Claude 3.7 Sonnet, GPT-4o, Gemini 2.0 Flash, DeepSeek-R1) possess formidable raw intelligence, but suffer from three fatal runtime failure modes when dropped into large codebases:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE 3 FATAL AI CODING TRAPS                     │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Context Window Tax          │ Dumping raw source files floods the   │
│    (80k-150k token blowup)     │ window, degrading reasoning and       │
│                                │ burning $2-$5 per multi-turn loop.    │
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. Spec Hallucination & Drift  │ Agents begin writing implementation   │
│    (Breaking remote callers)   │ prematurely without contracts,        │
│                                │ breaking distant call sites.          │
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Silent Test Tampering       │ When unit tests fail, agents secretly │
│    (Faking green test runs)    │ add `test.skip`, `it.only`, or        │
│                                │ comment out assertions to fake passes.│
└────────────────────────────────┴───────────────────────────────────────┘
```

**Apex Agents solves this with a physical, executable tooling layer and sovereign agent protocols.**

---

## 🏛️ Sovereign Architecture: Executable Tooling + Agentic Intelligence

Apex Agents is engineered with **100% architectural transparency**. It separates physical AST computation from probabilistic LLM reasoning:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   APEX AGENTS v2.1.0 ARCHITECTURE                      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  LAYER 1: EXECUTABLE TOOLING ENGINE (100% Physical Node.js Code)       │
│  ┌───────────────────────┬──────────────────────┬────────────────────┐ │
│  │ AST Context Compactor │ Checkpoint & Rollback│ Spec Compiler      │ │
│  │ (PageRank & Callers)  │ (Git-native sub-100ms│ (5-Phase Zero-Slop │ │
│  │  85%+ Token Drop)     │  Instant Recovery)   │  SPEC.md Contracts)│ │
│  ├───────────────────────┼──────────────────────┼────────────────────┤ │
│  │ Symbol Tracer Dossier │ Production Bug Hunter│ Multi-Model Costs  │ │
│  │ (Cross-file AST graph │ (SQLi, hook leaks,   │ (Claude, GPT,      │ │
│  │  ~100t Call-Sites)    │  floating promises)  │  DeepSeek, Gemini) │ │
│  ├───────────────────────┼──────────────────────┼────────────────────┤ │
│  │ Self-Healing TestLoop │ Pre-Commit Auditor   │ Dependency Graph   │ │
│  │ (Autonomous APEX_FIX) │ (Secrets & AntiCheat)│ (Cycles & PageRank)│ │
│  ├───────────────────────┼──────────────────────┼────────────────────┤ │
│  │ Session Handoff (~85t)│ Persistent Memory    │ Git Worktree       │ │
│  │ (XML Context Defense) │ (.agents/memory.json)│ Sandboxes          │ │
│  └───────────────────────┴──────────────────────┴────────────────────┘ │
│                                                                        │
│  LAYER 2: AGENTIC SYSTEM PROTOCOLS (38 Specialists + 13 Instincts)     │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Structured Markdown Manifests (.md) with Strict YAML Metadata,    │ │
│  │ Negative Constraints, Execution Workflows & Verification Gates.   │ │
│  │ Exported directly to .cursor/rules, CLAUDE.md, and Native MCP.    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 🔬 What Apex Agents IS vs What it is NOT

| Aspect | What Apex Agents IS | What it is NOT |
| :--- | :--- | :--- |
| **Tooling Layer** | Real, runnable JavaScript tools powered by `@babel/parser`, Git CLI, and Node.js stdio. | Not vaporware or mock scripts; every command runs physically on your filesystem. |
| **Specialist Personas** | Production-hardened **System Instruction Protocols** for LLMs (Claude, GPT, Gemini). | Not standalone C++/Rust software binaries (e.g. not a replacement for Ghidra or PostgreSQL). |
| **Execution** | Dispatches tasks through Claude Code, Cursor Rules, or the built-in MCP server. | Not a closed proprietary LLM; it enhances your existing AI coding harness. |
| **Quality Gate** | Enforces zero-slop discipline, pre-commit secret leak checks, and anti-test-tampering. | Not a black-box auto-coder that pushes untested changes. |

> [!IMPORTANT]
> **Engineering Transparency & Security Boundaries**:
> Static analysis and AST inspection operate as a **Layer-1 heuristic gate** catching variable-based SQL injection, hook memory leaks, credential leaks, and test tampering within local developer workflows. For untrusted, autonomous external agents running arbitrary shell binaries, full sandbox containment requires containerized environments (Docker / microVMs) or Git Worktree isolation (`npx apex-agents sandbox`).

---

## 🚀 Quickstart

Run directly using `npx` — **zero global installation required**:

```bash
# Initialize in your current project (exports rules & installs pre-commit hooks)
npx apex-agents init
```

### ⚡ Essential Command Arsenal (v2.1.0)

| Command | Category | What it Physically Does |
| :--- | :--- | :--- |
| `npx apex-agents init` | Setup | Copies agent rules into `.cursor/rules` and installs pre-commit hooks in `.git/hooks/` |
| `npx apex-agents compact` | Performance | Runs Babel AST engine to compact JS/TS/Py/Go/Rust files down to signatures with PageRank & Callers |
| `npx apex-agents test-loop` | Self-Healing | Executes test suite and synthesizes failure traces into zero-slop `APEX_FIX_PROMPT.md` |
| `npx apex-agents checkpoint` | Safe State | Creates atomic git-native snapshot of working tree (`save <label>`, `list`, `rollback`) |
| `npx apex-agents rollback` | Safe State | Restores codebase in 100ms if an AI coding agent corrupts files or breaks tests |
| `npx apex-agents spec <feat>` | Architecture | Compiles 5-phase zero-slop architectural `SPEC.md` and contracts before coding |
| `npx apex-agents trace <sym>` | Code Intel | Traces symbol declaration and cross-file callers into a compact ~100 token LLM dossier |
| `npx apex-agents audit-bugs` | Security | Scans AST for production runtime bugs (SQL injection, hook memory leaks, floating promises) |
| `npx apex-agents cost` | Economics | Analyzes repository tokens and predicts costs across Claude 3.7, GPT-4o, Gemini 2.0, & DeepSeek V3/R1 |
| `npx apex-agents swe-eval` | Benchmark | Runs 5-vector AST & architectural engine benchmark suite (Grade A+ Verified) |
| `npx apex-agents graph` | Architecture | Traces AST imports/exports, computes PageRank centrality, and detects circular dependency cycles |
| `npx apex-agents review` | Security | Scans git diff for leaked credentials (AWS, Stripe, OpenAI), `TODO` stubs, and test tampering |
| `npx apex-agents handoff` | Context | Serializes active git state and blockers into a clean ~85 token `<session_handoff>` XML block |
| `npx apex-agents memory [cmd]` | State | Stores technical architecture decisions in `.agents/memory.json` and syncs to `CLAUDE.md` |
| `npx apex-agents studio` | Interface | Launches the keyboard-driven interactive Terminal Studio |
| `npx apex-agents design <preset>` | UI/UX | Injects design token guidelines (`linear`, `stripe`, `apple`, `raycast`) into `DESIGN.md` |
| `npx apex-agents caveman on` | Token Saver | Enables telegraphic brevity mode (cuts response tokens by 50-65% during heavy loops) |
| `npx apex-agents budget` | Token Saver | Analyzes context window bloat and generates optimal `.cursorignore` files |
| `npx apex-agents sandbox <cmd>` | Isolation | Creates and manages isolated Git Worktrees (`.worktrees/`) for safe AI experimentation |
| `npx apex-agents mcp` | Protocol | Starts the native Model Context Protocol (MCP) server for Claude Desktop & Cursor |
| `npx apex-agents doctor` | Diagnostics | Verifies your local environment, Node.js runtime, and hook integrity |
| `npx apex-agents eval` | Integrity | Executes the 5-vector verification test suite across all agents and engines (Grade A+) |

---

## 🗜️ 1. AST Context Compactor (`apex-agents compact`)

Raw source code floods LLM context windows with internal implementation details that the model doesn't need to understand architecture.

The Babel AST Context Compactor parses **TypeScript, JavaScript, JSX, Python (`.py`), Go (`.go`), and Rust (`.rs`)** files, stripping internal function bodies down to signatures (`{}` or `pass`) while preserving 100% syntactically valid interfaces, types, exports, and parameter signatures:

```bash
# Basic compaction across repository -> APEX_CONTEXT.md
npx apex-agents compact

# Pack as structured XML (optimized for Claude & Gemini prompt boundaries)
npx apex-agents compact --xml

# Filter to top 10 architectural hubs by PageRank centrality
npx apex-agents compact --top=10

# Limit compacted context to a strict token budget (e.g. 8,000 tokens)
npx apex-agents compact --budget=8000
```

```
┌────────────────────────────────────────────────────────┐
│               APEX AST CONTEXT COMPACTOR               │
├────────────────────────────────────────────────────────┤
│ Original Token Size : ~12,931 tokens (48.9 KB)         │
│ Compacted Token Size: ~1,490 tokens (5.6 KB)          │
│ Token Reduction     : 88.5% SAVINGS                    │
│ Output Artifact     : APEX_CONTEXT.md / XML / JSON     │
└────────────────────────────────────────────────────────┘
```

### 🔗 Advanced AST Engineering Features
- **Reverse Caller Annotation**: Injects cross-file callers directly above signatures:
  ```typescript
  // 🔗 Callers (2): src/controllers/user.ts:45, src/routes/auth.ts:12
  export function authenticateUser(token: string): Promise<Session>;
  ```
- **PageRank Graph Centrality**: Prioritizes high-degree architectural hubs (`schema.ts`, `types.ts`, `auth.ts`) when packing context budgets.
- **Multi-Format Context Packing**: Outputs clean Markdown (`APEX_CONTEXT.md`), XML (`APEX_CONTEXT.xml` with CDATA blocks for Claude), or JSON (`APEX_CONTEXT.json`).
- **Multi-Language Skeletons**: Supports TypeScript/JS, Python (`def foo(): pass`), Go (`func Foo() {}`), and Rust (`fn foo() {}`).

---

## 💾 2. Git-Native Checkpoint & Instant Rollback (`apex-agents checkpoint`)

Autonomous AI coding agents frequently corrupt files, hallucinate non-existent libraries, or break working state. Git stash or commit workflows are clunky and risk polluting your commit tree.

`apex-agents checkpoint` captures an atomic working tree snapshot into `.agents/checkpoints/` in under 100ms:

```bash
# Save an atomic checkpoint before letting an agent refactor code
npx apex-agents checkpoint "before auth refactor"

# View all saved checkpoints with timestamp and modified file counts
npx apex-agents checkpoints list

# Instant rollback to previous checkpoint if the agent broke code
npx apex-agents rollback
```

---

## 📐 3. Spec-First Architectural Compiler (`apex-agents spec`)

When developers ask an AI agent to build a feature, the agent often writes premature code based on flawed assumptions.

`apex-agents spec` translates any feature intent into a rigorous, zero-slop `SPEC.md` using the 5-phase gstack architectural standard:

```bash
npx apex-agents spec "Stripe Webhook Subscription Sync with PostgreSQL"
```

### What `SPEC.md` Enforces Before Any Code is Written:
1. **Intent & Scope Boundaries**: Explicitly locks in-scope items and forbids scope creep.
2. **TypeScript & DB Contracts**: Concrete domain interfaces, payload shapes, and migration schemas.
3. **State Machine & Failure Transitions**: ASCII state diagrams with retry limits and idempotency keys.
4. **Strict Negative Constraints**: Forbids `TODO` and `FIXME` stubs, untyped `any`, and test-cheating shortcuts.
5. **TDD Acceptance Matrix**: Table of concrete test cases verifying happy paths and network failure recovery.
6. **Sequential Execution Protocol**: Red-Green-Refactor checklist with verification gates.

---

## 🔍 4. Semantic Symbol Tracer & Call-Graph (`apex-agents trace`)

Feeding entire files into LLMs just to refactor a single function burns thousands of unnecessary tokens.

`apex-agents trace` uses AST parsing to instantly locate any function, interface, or class, map its parameters, and find all downstream callers across the codebase into a compact ~100-token LLM dossier:

```bash
npx apex-agents trace authenticateUser
```

```markdown
### 🔗 SYMBOL TRACE DOSSIER: `authenticateUser`
- Declarations:
  • src/auth/service.ts:42 ➔ function authenticateUser(token: string) [EXPORTED]
- Call Sites & Dependents (3):
  • src/routes/login.ts:18: authenticateUser(req.headers.authorization)
  • src/middleware/guard.ts:55: await authenticateUser(jwt)
  • tests/auth.test.ts:91: authenticateUser('mock-token')
```

---

## 🪲 5. Production AST Bug Hunter (`apex-agents audit-bugs`)

AI code often looks syntactically valid and passes basic linters, yet harbors critical runtime flaws.

`apex-agents audit-bugs` parses your AST to catch deep production bugs before deployment:

```bash
npx apex-agents audit-bugs
```

- **Raw SQL Injection**: Catches string concatenations (`"SELECT * FROM " + input`) and template literal interpolations in database query calls.
- **React Hook Timer & Memory Leaks**: Detects `useEffect` setups (`setInterval`, `addEventListener`) missing cleanup return functions.
- **Floating Unhandled Promises**: Detects un-awaited async calls (`.save()`, `.fetch()`, `.delete()`) that risk unhandled rejection crashes.

---

## 💰 6. Multi-Model Token Cost Predictor (`apex-agents cost`)

Gain full visibility into token volume and pricing projections before loading codebases into LLMs:

```bash
npx apex-agents cost
```

```
═════ APEX AGENTS: MULTI-MODEL TOKEN COST AUDITOR ═════
Scanned Files    : 45
Raw Token Volume : ~101,691 tokens (382.8 KB)
With AST Compact : ~18,305 tokens (82% reduction)

MODEL CONTEXT & COST PROJECTIONS (Per Single Context Load):
┌─────────────────────┬──────────────────┬──────────────┬──────────────┐
│ Model               │ Context Window   │ Window Used  │ Single Cost  │
├─────────────────────┼──────────────────┼──────────────┼──────────────┤
│ Claude 3.7 Sonnet   │ 200k             │ 15.25%       │ $0.0915      │
│ Claude 3.5 Haiku    │ 200k             │ 15.25%       │ $0.0244      │
│ GPT-4o              │ 128k             │ 23.82%       │ $0.0762      │
│ GPT-4o-mini         │ 128k             │ 23.82%       │ $0.0046      │
│ Gemini 2.0 Flash    │ 1000k            │ 3.05%        │ $0.0031      │
│ DeepSeek-V3         │ 128k             │ 23.82%       │ $0.0043      │
│ DeepSeek-R1         │ 128k             │ 23.82%       │ $0.0168      │
└─────────────────────┴──────────────────┴──────────────┴──────────────┘

💡 Apex Savings: Running npx apex-agents compact saves ~$2.50 every 10 turns on Claude 3.7 Sonnet!
```

---

## 🏆 7. Architectural & AST Engine Benchmark (`apex-agents swe-eval`)

Benchmark your local AI engineering harness across 5 standardized software engineering vectors verifying AST skeleton fidelity, cross-file caller resolution, graph PageRank convergence, anti-cheat test tampering defense, and autonomous trace diagnosis:

```bash
npx apex-agents swe-eval
```

```
  ✓ PASS [SWE-1: AST Skeleton Fidelity] - Preserved signatures, stripped internal bodies cleanly
  ✓ PASS [SWE-2: Cross-File Reverse Caller Resolution] - Resolved cross-file call site(s) for auth()
  ✓ PASS [SWE-3: Graph PageRank Centrality Convergence] - Hub ranked #1 with score 13.3%
  ✓ PASS [SWE-4: Anti-Cheat Test Tampering Defense] - Detected 2 test weakening issue(s) via AST diff engine
  ✓ PASS [SWE-5: Autonomous Self-Healing Trace Diagnosis] - Extracted failing trace for UserService test at tests/user.test.ts:33

═════ BENCHMARK FINAL EVALUATION ═════
  Total Vectors Passed: 5/5
  Composite Score     : 100/100
  Composite Grade     : A+ (Sovereign Tier)
```

---

## 🔁 8. Autonomous Self-Healing Test Loop (`apex-agents test-loop`)

When AI coding agents write code that breaks unit tests, manual copy-pasting of error traces wastes developer time and causes hallucination loops.

`apex-agents test-loop` executes your project's test suite, detects failures, and automatically synthesizes failure traces into a zero-slop `APEX_FIX_PROMPT.md`:

```bash
# Auto-detects test runner (Node, pnpm, bun, yarn, cargo, pytest, go test)
npx apex-agents test-loop

# Or specify a custom test command
npx apex-agents test-loop "npm run test:e2e"
```

```
┌─────────────────┐       Pass (Exit 0)       ┌────────────────────────┐
│  Run Test Suite ├──────────────────────────►│ Clean verification     │
└────────┬────────┘                           │ (Removes fix prompt)   │
         │ Fail (Exit > 0)                    └────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Parse failures: extracts failing test names, file paths, lines,     │
│  and AssertionError stack traces                                     │
└────────┬─────────────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Synthesize APEX_FIX_PROMPT.md with STRICT NEGATIVE CONSTRAINTS:     │
│  • FORBIDDEN: Deleting or disabling tests (it.skip, test.only)       │
│  • FORBIDDEN: Commenting out assertions or modifying test bounds     │
│  • REQUIRED: Repairing implementation code in the target module      │
└────────┬─────────────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Feed APEX_FIX_PROMPT.md to Cursor / Claude Code for instant repair  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ 9. Pre-Commit Security & Anti-Cheat Diff Auditor (`apex-agents review`)

Apex Agents installs an automated pre-commit hook that intercepts security vulnerabilities and AI slop before commits are recorded:

```bash
# Audit working tree changes
npx apex-agents review

# Audit staged changes with strict failure flags
npx apex-agents review --staged --strict
```

### What it Intercepts:
- **Critical Secret Leaks**: High-entropy scans for AWS Access Keys, Stripe Secret Keys, OpenAI Keys, GitHub Tokens, and raw private keys.
- **AI Slop & Lazy Placeholders**: Detects cosmetic placeholders (lazy `TODO` stubs, omitted code ellipsis, and unimplemented exception throws).
- **Anti-Cheat Test Tampering**: Intercepts attempts by AI agents to fake green test runs by modifying test suites (`it.only`, `test.only`, `it.skip`, commenting out assertions).

---

## 🔌 10. Native Model Context Protocol (MCP) Server

Apex Agents includes a native Model Context Protocol (JSON-RPC 2.0 stdio) server, exposing both physical AST engineering tools and agent personas directly inside **Claude Desktop**, **Cursor**, **Windsurf**, and **Antigravity**.

### Physical MCP Tools Exposed:
- `apex_compact_code`: Token-reducing Babel AST compactor (80-90% token reduction while preserving types and signatures).
- `apex_audit_code_bugs`: Static AST vulnerability & bug hunter (SQLi, unhandled timer leaks, floating promises).
- `apex_checkpoint`: Git-native working tree snapshot including untracked files, `.env`, and git hooks.
- `apex_rollback`: Instant atomic rollback to previous checkpoint.
- `apex_trace_symbol`: Cross-file symbol definition and caller site tracing.
- `apex_audit_diff`: Diff auditor intercepting credential leaks and test tampering (`.skip`, commented assertions).
- `list_specialists` / `summon_specialist`: Direct access to all 38 specialist instructions and operational instincts.

### Configuration (`claude_desktop_config.json`):
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

## 🏛️ Agency Divisions & Specialists (38 Expert Personas)

> **Architectural Note**: Each specialist below is a domain-specific **System Instruction Protocol** (`agents/<division>/<name>.md`). When summoned, it injects strict negative constraints, execution workflows, and verification gates into your AI coding session.

### 1. 🛠️ Core Engineering
- **Frontend Architect** (`@frontend-architect`): Enforces React 19 standards, server components, GPU compositing, and accessibility.
- **TypeScript Pro** (`@typescript-pro`): Enforces zero-any policy, discriminated unions, and advanced generic constraints.
- **Backend Systems Lead** (`@backend-systems-lead`): Governs distributed architecture, idempotency keys, and circuit breakers.
- **Database Tuner** (`@database-tuner`): Prevents sequential table sweeps, optimizes composite B-Tree indexes, and audits write overhead.
- **API & Microservices Lead** (`@api-microservices-lead`): Designs REST, gRPC, and WebSocket streaming contracts.
- **State Machine Architect** (`@state-machine-architect`): Prevents boolean state explosion by modeling flows with XState.
- **Fullstack General** (`@fullstack-general`): Implements clean vertical slices with end-to-end schema validation.

### 2. 🤖 AI, LLM & Agentic Systems
- **RAG Pipeline Architect** (`@rag-pipeline-architect`): Designs hybrid retrieval (BM25 + vector) and cross-encoder re-ranking.
- **LLM Eval Benchmarker** (`@eval-benchmarker`): Establishes deterministic hallucination benchmarks and faithfulness scoring.
- **Prompt Injection Shield** (`@prompt-injection-shield`): Guides defense against prompt injection, jailbreaks, and context extraction.
- **MCP Server Builder** (`@mcp-server-builder`): Standards for authoring Model Context Protocol tools and schemas.

### 3. 🎬 Media & Video Processing
- **Remotion Motion Engineer** (`@remotion-motion-engineer`): Guides deterministic React video rendering with clamped spring physics.
- **FFmpeg Pipeline Master** (`@ffmpeg-pipeline-master`): Formulates production FFmpeg encoding flags (H.264/HEVC, web faststart, hardware acceleration).

### 4. 🌐 Cloud-Native & Distributed Scale
- **System Design Architect** (`@system-design-architect`): High-availability sharding, caching strategies, and CAP theorem trade-offs.
- **Serverless Edge Lead** (`@serverless-edge-lead`): Optimizes Cloudflare Workers, sub-50ms cold starts, and edge streaming.
- **GraphQL Federation** (`@graphql-federation-architect`): Subgraph federation and DataLoader N+1 batch resolution.
- **Event Sourcing Specialist** (`@event-sourcing-specialist`): Designs append-only event stores, CQRS models, and transactional outboxes.

### 5. 🔍 Reverse Engineering & Security Analysis
- **Binary & Assembly Inspector** (`@binary-decompiler`): Guides analysis of disassembled code, WASM bytecode, and function prologues without hallucination.
- **AST & Code Inspector** (`@binary-ast-inspector`): Source map reconstruction and AST-level de-obfuscation workflows.
- **Network Protocol Auditor** (`@network-security-auditor`): Audits TLS 1.3 handshakes, WebSocket frames, and binary wire protocols.

### 6. 🛡️ Security & Red Team
- **AppSec Auditor** (`@appsec-auditor`): Systematically assesses OWASP Top 10 vulnerabilities (SQLi, XSS, SSRF, IDOR).
- **Secret Leak Sentinel** (`@secret-leak-sentinel`): Pre-commit high-entropy credential detection and `.env` boundary enforcement.
- **Auth & Identity Guard** (`@auth-identity-guard`): Enforces secure OAuth2, PKCE, token refresh cycles, and session integrity.
- **Dependency Scanner** (`@dependency-vulnerability-scanner`): Audits supply-chain CVEs and transitive dependency risks.

### 7. ⚡ Deep Performance
- **CWV & LCP Doctor** (`@cwv-lcp-doctor`): Optimizes Core Web Vitals (sub-2.5s LCP, zero CLS, main-thread INP scheduling).
- **Memory Leak Hunter** (`@memory-leak-hunter`): Diagnoses V8 heap snapshots, event listener leaks, and detached DOM trees.
- **Bundle Dietician** (`@bundle-dietician`): Eliminates dead code, tree-shakes bundles, and purges phantom dependencies.
- **SQL Query Optimizer** (`@sql-query-optimizer`): Transforms slow relational queries with keyset pagination and covering indexes.

### 8. 🧪 Quality Assurance & Testing
- **TDD Champion** (`@tdd-champion`): Enforces the Red-Green-Refactor cycle and unit/branch coverage standards.
- **E2E Playwright Tester** (`@e2e-playwright-tester`): Authors resilient, deterministic end-to-end tests with trace recording.
- **Edge-Case Fuzzer** (`@edge-case-fuzzer`): Generates extreme input boundary tests (unicode, zero-bytes, race conditions).

### 9. ☁️ DevOps & Infrastructure
- **Docker & Container Architect** (`@docker-slimmer`): Designs secure, minimal multi-stage Dockerfiles with non-root execution.
- **CI/CD Pipeline Master** (`@ci-cd-pipeline-master`): Configures cross-platform GitHub Actions workflows with caching and matrix builds.
- **Kubernetes Architect** (`@k8s-cloud-architect`): Authors Helm charts, resource limits, HPA scaling, and zero-downtime deployments.

### 10. 🚀 Product Launch & DevRel
- **Growth Marketer** (`@growth-marketer`): Conversion Rate Optimization (CRO), technical copywriting, and launch playbooks.
- **Prompt Architect** (`@prompt-architect`): 6-step hierarchical system prompts for Claude Sonnet 5.5, GPT-6, and Gemini 4.
- **PR Artisan** (`@pr-artisan`): Creates clean, conventional pull request documentation and changelogs.
- **README Copywriter** (`@readme-copywriter`): Authors clear, authentic, high-converting open-source documentation.

---

## ⚡ The 13 Operational Instincts

These behavioral rules are loaded into the AI agent's memory to govern its autonomous execution:

1. **Zero-Slop Contract**: Strictly forbids lazy placeholder comments, empty handlers, and cosmetic skinning.
2. **Verification Before Completion**: Mandates compiler checks, linters, and test execution before claiming success.
3. **Test-Driven Discipline**: Requires writing reproducing tests before applying bug fixes.
4. **Context Retention**: Injects periodic structured `STATE` blocks to prevent attention drift across long threads.
5. **Anti-Loop Root Cause**: Circuit breaker that halts infinite retry loops after 2 consecutive failures.
6. **Anti-Drift Scope Boundary**: Restricts file modifications strictly to the targeted task boundary.
7. **Rationalization Breaker**: Eliminates common LLM excuses (*"The code looks right so it must work"*).
8. **Systematic Investigation**: 4-phase rule: `Reproduce` ➔ `Isolate` ➔ `Hypothesize` ➔ `Verify`.
9. **LLM Hallucination Defense**: Requires verifying package versions and APIs before generating code.
10. **Minimalist Code Discipline**: *"The best code is the code you never wrote."* Deletes dead code before adding new lines.
11. **Caveman Token Discipline**: Telegraphic brevity mode that eliminates conversational filler to conserve token budgets.
12. **Editorial Diagram Rules**: Clean, self-contained HTML/SVG architecture cards instead of messy graph spaghetti.
13. **Anti-Cheat Test Tampering**: Strictly forbids skipping tests (`it.skip`) or commenting out assertions to fake passing builds.

---

## 📜 License

Distributed under the **MIT License**. Free for personal and commercial engineering teams worldwide.

Authored with precision by **Amanulla Shaikh** for the global autonomous AI engineering ecosystem.
