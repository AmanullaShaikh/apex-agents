# ⚡ Apex Agents

> **The Sovereign AI Engineering Agency & Execution Harness.**  
> A dual-layer framework combining an **executable Node.js AST tooling engine** with **38 verified domain agent protocols** and **13 operational instincts** for Claude Code, Cursor, Codex, Windsurf, Copilot, and Antigravity.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/apex-agents.svg?style=flat-square&color=brightgreen)](https://www.npmjs.com/package/apex-agents)
[![CI & Integrity Suite](https://github.com/AmanullaShaikh/apex-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/AmanullaShaikh/apex-agents/actions/workflows/ci.yml)
[![Babel AST](https://img.shields.io/badge/AST%20Parser-Babel%20Engine-F5DA55.svg?style=flat-square)](https://babeljs.io)
[![Context Reduction](https://img.shields.io/badge/Context%20Reduction-70%25--88.5%25%20Savings-blueviolet.svg?style=flat-square)](#-ast-context-compactor-apex-agents-compact)
[![MCP Protocol](https://img.shields.io/badge/MCP-Native%20Server-purple.svg?style=flat-square)](#-native-model-context-protocol-mcp-server)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](https://github.com/AmanullaShaikh/apex-agents/pulls)

</div>

---

## 🔍 Complete Transparency: How Apex Agents Works

Apex Agents is designed with **100% architectural transparency**. It consists of two distinct, complementary layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        APEX AGENTS ARCHITECTURE                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  LAYER 1: EXECUTABLE TOOLING ENGINE (100% Real Node.js Code)           │
│  ┌───────────────────────┬──────────────────────┬────────────────────┐ │
│  │ Babel AST Compactor   │ Dependency Graph     │ Pre-Commit Auditor │ │
│  │ (70-88% token shrink) │ (Cycle detection)    │ (Secrets & Anti-   │ │
│  │                       │                      │  Cheat Guard)      │ │
│  ├───────────────────────┼──────────────────────┼────────────────────┤ │
│  │ Session Handoff (~85t)│ Persistent Memory    │ Git Worktree       │ │
│  │ (XML context defense) │ (.agents/memory.json)│ Sandboxes          │ │
│  └───────────────────────┴──────────────────────┴────────────────────┘ │
│                                                                        │
│  LAYER 2: AGENTIC SYSTEM INSTRUCTIONS (38 Personas + 13 Instincts)     │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Structured Markdown Manifests (.md) with Strict YAML Metadata,    │ │
│  │ Negative Constraints, Execution Workflows & Verification Gates.   │ │
│  │ Exported directly to .cursor/rules, CLAUDE.md, and Native MCP.    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### What Apex Agents IS vs What it is NOT

| Aspect | What Apex Agents IS | What it is NOT |
| :--- | :--- | :--- |
| **Tooling Layer** | Real, runnable JavaScript tools powered by `@babel/parser`, Git CLI, and Node.js stdio. | Not vaporware or mock scripts; every command runs physically on your filesystem. |
| **Specialist Personas** | Production-hardened **System Instruction Protocols** for LLMs (Claude, GPT, Gemini). | Not standalone C++/Rust software binaries (e.g. not a replacement for Ghidra or PostgreSQL). |
| **Execution** | Dispatches tasks through Claude Code, Cursor Rules, or the built-in MCP server. | Not a closed proprietary LLM; it enhances your existing AI coding harness. |
| **Quality Gate** | Enforces zero-slop discipline, pre-commit secret leak checks, and anti-test-tampering. | Not a black-box auto-coder that pushes untested changes. |

---

## 🚀 Quickstart

Run directly using `npx` — **zero global installation required**:

```bash
# Initialize in your current project (exports rules & installs safety git hooks)
npx apex-agents init
```

### Essential CLI Commands

| Command | Category | Physical Action |
| :--- | :--- | :--- |
| `npx apex-agents init` | Setup | Copies agent rules into `.cursor/rules` and installs pre-commit hooks in `.git/hooks/` |
| `npx apex-agents compact` | Performance | Runs Babel AST engine to compact JS/TS files down to signatures, saving 70-88% tokens |
| `npx apex-agents graph` | Architecture | Traces AST imports/exports and detects circular dependency cycles across your repository |
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

## 🗜️ AST Context Compactor (`apex-agents compact`)

Raw source code floods LLM context windows with implementation details that the model doesn't need to understand architecture. 

The **Babel AST Context Compactor** parses TypeScript, JavaScript, and JSX files, stripping internal function bodies down to `{}` while preserving **100% syntactically valid interfaces, types, exports, and parameter signatures**:

```bash
npx apex-agents compact
```

```
┌────────────────────────────────────────────────────────┐
│               APEX AST CONTEXT COMPACTOR               │
├────────────────────────────────────────────────────────┤
│ Original Token Size : ~12,931 tokens (48.9 KB)         │
│ Compacted Token Size: ~1,490 tokens (5.6 KB)          │
│ Token Reduction     : 88.5% SAVINGS                    │
│ Output Artifact     : APEX_CONTEXT.md                  │
└────────────────────────────────────────────────────────┘
```

---

## 🛡️ Pre-Commit Security & Anti-Cheat Diff Auditor (`apex-agents review`)

Apex Agents installs an automated pre-commit hook that intercepts security vulnerabilities and AI slop before commits are recorded:

```bash
# Audit working tree changes
npx apex-agents review

# Audit staged changes with strict failure flags
npx apex-agents review --staged --strict
```

### What it Intercepts:
1. **Critical Secret Leaks**: High-entropy scans for AWS Access Keys, Stripe Secret Keys, OpenAI Keys, GitHub Tokens, and raw private keys.
2. **AI Slop & Lazy Placeholders**: Detects cosmetic placeholders (lazy TODO stubs, omitted code ellipsis, and unimplemented exception throws).
3. **Anti-Cheat Test Tampering**: Intercepts attempts by AI agents to fake green test runs by modifying test suites (`it.only`, `test.only`, `it.skip`, commenting out `expect()` assertions).

---

## 🔌 Native Model Context Protocol (MCP) Server

Apex Agents includes a native **Model Context Protocol (JSON-RPC 2.0 stdio)** server, allowing tools and agent personas to be summoned directly inside **Claude Desktop**, **Cursor**, and **Antigravity**.

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
* **Frontend Architect** (`@frontend-architect`): Enforces React 19 standards, server components, GPU compositing, and accessibility.
* **TypeScript Pro** (`@typescript-pro`): Enforces zero-`any` policy, discriminated unions, and advanced generic constraints.
* **Backend Systems Lead** (`@backend-systems-lead`): Governs distributed architecture, idempotency keys, and circuit breakers.
* **Database Tuner** (`@database-tuner`): Prevents sequential table sweeps, optimizes composite B-Tree indexes, and audits write overhead.
* **API & Microservices Lead** (`@api-microservices-lead`): Designs REST, gRPC, and WebSocket streaming contracts.
* **State Machine Architect** (`@state-machine-architect`): Prevents boolean state explosion by modeling flows with XState.
* **Fullstack General** (`@fullstack-general`): Implements clean vertical slices with end-to-end schema validation.

### 2. 🤖 AI, LLM & Agentic Systems
* **RAG Pipeline Architect** (`@rag-pipeline-architect`): Designs hybrid retrieval (BM25 + vector) and cross-encoder re-ranking.
* **LLM Eval Benchmarker** (`@eval-benchmarker`): Establishes deterministic hallucination benchmarks and faithfulness scoring.
* **Prompt Injection Shield** (`@prompt-injection-shield`): Guides defense against prompt injection, jailbreaks, and context extraction.
* **MCP Server Builder** (`@mcp-server-builder`): Standards for authoring Model Context Protocol tools and schemas.

### 3. 🎬 Media & Video Processing
* **Remotion Motion Engineer** (`@remotion-motion-engineer`): Guides deterministic React video rendering with clamped spring physics.
* **FFmpeg Pipeline Master** (`@ffmpeg-pipeline-master`): Formulates production FFmpeg encoding flags (H.264/HEVC, web faststart, hardware acceleration).

### 4. 🌐 Cloud-Native & Distributed Scale
* **System Design Architect** (`@system-design-architect`): High-availability sharding, caching strategies, and CAP theorem trade-offs.
* **Serverless Edge Lead** (`@serverless-edge-lead`): Optimizes Cloudflare Workers, sub-50ms cold starts, and edge streaming.
* **GraphQL Federation** (`@graphql-federation-architect`): Subgraph federation and DataLoader N+1 batch resolution.
* **Event Sourcing Specialist** (`@event-sourcing-specialist`): Designs append-only event stores, CQRS models, and transactional outboxes.

### 5. 🔍 Reverse Engineering & Security Analysis
* **Binary & Assembly Inspector** (`@binary-decompiler`): Guides analysis of disassembled code, WASM bytecode, and function prologues without hallucination.
* **AST & Code Inspector** (`@binary-ast-inspector`): Source map reconstruction and AST-level de-obfuscation workflows.
* **Network Protocol Auditor** (`@network-security-auditor`): Audits TLS 1.3 handshakes, WebSocket frames, and binary wire protocols.

### 6. 🛡️ Security & Red Team
* **AppSec Auditor** (`@appsec-auditor`): Systematically assesses OWASP Top 10 vulnerabilities (SQLi, XSS, SSRF, IDOR).
* **Secret Leak Sentinel** (`@secret-leak-sentinel`): Pre-commit high-entropy credential detection and `.env` boundary enforcement.
* **Auth & Identity Guard** (`@auth-identity-guard`): Enforces secure OAuth2, PKCE, token refresh cycles, and session integrity.
* **Dependency Scanner** (`@dependency-vulnerability-scanner`): Audits supply-chain CVEs and transitive dependency risks.

### 7. ⚡ Deep Performance
* **CWV & LCP Doctor** (`@cwv-lcp-doctor`): Optimizes Core Web Vitals (sub-2.5s LCP, zero CLS, main-thread INP scheduling).
* **Memory Leak Hunter** (`@memory-leak-hunter`): Diagnoses V8 heap snapshots, event listener leaks, and detached DOM trees.
* **Bundle Dietician** (`@bundle-dietician`): Eliminates dead code, tree-shakes bundles, and purges phantom dependencies.
* **SQL Query Optimizer** (`@sql-query-optimizer`): Transforms slow relational queries with keyset pagination and covering indexes.

### 8. 🧪 Quality Assurance & Testing
* **TDD Champion** (`@tdd-champion`): Enforces the Red-Green-Refactor cycle and unit/branch coverage standards.
* **E2E Playwright Tester** (`@e2e-playwright-tester`): Authors resilient, deterministic end-to-end tests with trace recording.
* **Edge-Case Fuzzer** (`@edge-case-fuzzer`): Generates extreme input boundary tests (unicode, zero-bytes, race conditions).

### 9. ☁️ DevOps & Infrastructure
* **Docker & Container Architect** (`@docker-slimmer`): Designs secure, minimal multi-stage Dockerfiles with non-root execution.
* **CI/CD Pipeline Master** (`@ci-cd-pipeline-master`): Configures cross-platform GitHub Actions workflows with caching and matrix builds.
* **Kubernetes Architect** (`@k8s-cloud-architect`): Authors Helm charts, resource limits, HPA scaling, and zero-downtime deployments.

### 10. 🚀 Product Launch & DevRel
* **Growth Marketer** (`@growth-marketer`): Conversion Rate Optimization (CRO), technical copywriting, and launch playbooks.
* **Prompt Architect** (`@prompt-architect`): 6-step hierarchical system prompts for Claude, GPT-4o, and Gemini.
* **PR Artisan** (`@pr-artisan`): Creates clean, conventional pull request documentation and changelogs.
* **README Copywriter** (`@readme-copywriter`): Authors clear, authentic, high-converting open-source documentation.

---

## ⚡ The 13 Operational Instincts

These behavioral rules are loaded into the AI agent's memory to govern its autonomous execution:

1. **Zero-Slop Contract**: Strictly forbids lazy placeholder comments, empty handlers, and cosmetic skinning.
2. **Verification Before Completion**: Mandates compiler checks, linters, and test execution before claiming success.
3. **Test-Driven Discipline**: Requires writing reproducing tests before applying bug fixes.
4. **Context Retention**: Injects periodic structured STATE blocks to prevent attention drift across long threads.
5. **Anti-Loop Root Cause**: Circuit breaker that halts infinite retry loops after 2 consecutive failures.
6. **Anti-Drift Scope Boundary**: Restricts file modifications strictly to the targeted task boundary.
7. **Rationalization Breaker**: Eliminates common LLM excuses ("The code looks right so it must work").
8. **Systematic Investigation**: 4-phase rule: Reproduce ➔ Isolate ➔ Hypothesize ➔ Verify.
9. **LLM Hallucination Defense**: Requires verifying package versions and APIs before generating code.
10. **Minimalist Code Discipline**: "The best code is the code you never wrote." Deletes dead code before adding new lines.
11. **Caveman Token Discipline**: Telegraphic brevity mode that eliminates conversational filler to conserve token budgets.
12. **Editorial Diagram Rules**: Clean, self-contained HTML/SVG architecture cards instead of messy graph spaghetti.
13. **Anti-Cheat Test Tampering**: Strictly forbids skipping tests (`it.skip`) or commenting out assertions to fake passing builds.

---

## 📜 License

Distributed under the **MIT License**. Free for personal and commercial engineering teams worldwide.

<div align="center">
  <sub>Authored with precision by <strong>Amanulla Shaikh</strong> for the global autonomous AI engineering ecosystem.</sub>
</div>
