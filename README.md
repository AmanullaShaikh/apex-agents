# ⚡ Apex Agents: The Autonomous Engineering Agency

> **The complete, production-grade AI engineering agency at your fingertips. 10 specialized divisions, 34+ expert agent personas, AST context compaction (88.5% token savings), zero-slop PR diff reviewer, context window budget optimizer, native Model Context Protocol (MCP) server, and automated DX tooling for Claude Code, Cursor, Codex, Windsurf, Copilot, and Antigravity.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Version: 1.4.0](https://img.shields.io/badge/version-1.4.0-brightgreen.svg?style=flat-square)](https://www.npmjs.com/package/apex-agents)
[![Eval Score](https://img.shields.io/badge/Evaluation-100%2F100%20(Grade%20A%2B)-success.svg?style=flat-square)](#-agency-evaluation--benchmark-harness)
[![AST Compaction](https://img.shields.io/badge/AST%20Compaction-88.5%25%20Token%20Savings-blueviolet.svg?style=flat-square)](#-ast-context-compactor)
[![MCP Native](https://img.shields.io/badge/MCP-Native%20Server-purple.svg?style=flat-square)](#-native-mcp-server-support)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](https://github.com/AmanullaShaikh/apex-agents/pulls)

---

## 💡 Why Apex Agents?

Generic AI coding prompts output generic, flaky code. They leave lazy `// TODO` placeholders, invent non-existent APIs, introduce N+1 query bottlenecks, leak production API keys into git commits, and hallucinate changes across 15 unrelated files.

**Apex Agents** solves this by converting your AI agent harness into an **enterprise engineering agency**:
* **34+ Specialized Domain Experts**: Need database tuning? Summon `@database-tuner`. Need a security audit? Summon `@appsec-auditor`. Need RAG architecture? Summon `@rag-pipeline-architect`.
* **8 Operational Instincts**: Grounded reflexes derived from real production failure modes: Zero-Slop Contract, Anti-Loop Circuit Breaker, Scope Drift Boundary, and Superpowers Rationalization Breakers.
* **AST Context Compactor (88.5% Savings)**: Compresses raw codebases into structural type and function skeletons, saving tens of thousands of tokens per prompt.
* **Zero-Slop PR Diff Auditor**: Automatically scans pull requests and git diffs for credential leaks, lazy `TODO` comments, and test discipline violations.
* **Context Budget Optimizer**: Detects context killers (lockfiles, source maps, huge JSON) and generates `.cursorignore`, `.claudeignore`, and `.aidevignore`.
* **Universal Multi-IDE Exporter**: 1-click generation of `.cursorrules`, `CLAUDE.md`, `.windsurfrules`, `.github/copilot-instructions.md`, and `.aider.prompt.md`.
* **Isolated Git Worktree Sandboxes**: Safely runs speculative AI features in `.worktrees/` without polluting your working branch.
* **Native Model Context Protocol (MCP)**: Built-in JSON-RPC stdio MCP server for Claude Desktop, Cursor, and Antigravity.
* **Interactive Terminal Studio (TUI)**: Keyboard-navigated terminal dashboard to inspect personas and copy prompts.

---

## 🚀 60-Second Quickstart

```bash
# Run the agency CLI via npx (zero installation required)
npx apex-agents <command>
```

### Essential Commands:

| Command | Action |
| :--- | :--- |
| `npx apex-agents studio` | Launch the interactive keyboard-driven Terminal Studio |
| `npx apex-agents compact` | Run AST Context Compactor to shrink codebase tokens by 85%+ |
| `npx apex-agents review` | Audit staged/committed git diff for secret leaks & AI slop |
| `npx apex-agents budget` | Analyze context window token bloat & generate `.cursorignore` |
| `npx apex-agents eval` | Run the agency verification benchmark suite (100/100 Grade A+) |
| `npx apex-agents export-all`| Export configs for Claude Code, Cursor, Windsurf, Copilot, & Aider |
| `npx apex-agents plan "<goal>"`| Decompose an objective into a multi-agent swarm execution plan |
| `npx apex-agents install-hooks`| Install physical pre-commit safety hooks in `.git/hooks/` |
| `npx apex-agents sandbox start <name>`| Spin up an isolated Git Worktree sandbox |
| `npx apex-agents scope-guard` | Detect unintended file drift across staged git changes |
| `npx apex-agents orphans` | Scan repository for unwired or orphaned source files |
| `npx apex-agents dashboard` | Open the offline dark-mode Agent Explorer in your browser |
| `npx apex-agents mcp` | Start the native Model Context Protocol (MCP) server |

---

## 🗜️ AST Context Compactor

LLM context windows are expensive and easily polluted. When you pass raw files to Claude or Cursor, you pay for thousands of lines of boilerplate implementation details that the model doesn't need for architectural reasoning.

Run the built-in compactor:
```bash
npx apex-agents compact
```

**Real Benchmark Result:**
```
Original Size  : ~12,931 tokens (48.9 KB)
Compacted Size : ~1,490 tokens (5.6 KB)
Token Reduction: 88.5% Saved!
Output File    : APEX_CONTEXT.md
```
Inject `APEX_CONTEXT.md` into your prompt to give the AI full codebase awareness with zero token bloat.

---

## 🛡️ Zero-Slop PR Diff Auditor (`apex-agents review`)

Drop `apex-agents review` into your local git workflow or CI pipeline to physically intercept AI slop before it lands in production.

```bash
# Audit working tree changes
npx apex-agents review

# Audit staged changes strictly
npx apex-agents review --staged --strict

# Generate GitHub PR comment markdown
npx apex-agents review --branch=main --format=markdown
```

### What it checks:
1. **Critical Secret Leaks**: Stripe, OpenAI, Anthropic, AWS, GitHub Personal Tokens, Private Keys.
2. **AI Slop & Stubs**: `// TODO`, `// FIXME`, `/* rest unchanged */`, empty catch blocks `catch(e) {}`.
3. **Debug Remnants**: Residual `console.log`, `debugger`, `print(DEBUG)`.
4. **Test Discipline**: Flags when source code is altered without accompanying test files.
5. **Scope Drift**: Alerts when an agent modifies more than 12 files in a single turn.

---

## 📊 Context Budget Optimizer (`apex-agents budget`)

Diagnose token bloat in your repository:
```bash
npx apex-agents budget
```

To automatically generate `.cursorignore`, `.claudeignore`, and `.aidevignore` to protect your context window:
```bash
npx apex-agents budget --generate-ignores
```

---

## 🧪 Agency Evaluation & Benchmark Harness (`apex-agents eval`)

Every agent and operational subsystem is verified by the automated benchmark runner:

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

Apex Agents comes with a built-in Model Context Protocol (MCP) server! You can connect all 34+ specialists and instincts directly to Claude Desktop, Cursor, or Antigravity via stdio.

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

Once connected, your agent can summon any specialist on demand using the `summon_specialist` tool:
```json
{
  "agent_id": "database-tuner"
}
```

---

## 🏛️ Agency Divisions & Specialists (34 Experts)

### 1. 🛠️ Division: Core Engineering
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **Frontend Architect** | `@frontend-architect` | React 19, Next.js, state machines, accessible UI, 60fps GPU compositing |
| **Backend Systems Lead** | `@backend-systems-lead` | Distributed architectures, idempotency, microservices, rate limiting |
| **Database Tuner** | `@database-tuner` | B-Tree indexing, `EXPLAIN ANALYZE`, connection pooling, query planning |
| **API & Microservices Lead**| `@api-microservices-lead` | Event-driven pipelines, WebSockets, gRPC, decoupled service boundaries |
| **State Machine Architect** | `@state-machine-architect` | XState, finite state machines, eliminating impossible boolean combinations |
| **Fullstack General** | `@fullstack-general` | End-to-end vertical features, shared schemas, optimistic UI updates |

---

### 2. 🤖 Division: AI, LLM & Agentic Systems
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **RAG Pipeline Architect** | `@rag-pipeline-architect` | Hybrid search (BM25 + Dense vector), cross-encoder rerankers, semantic chunking |
| **LLM Eval Benchmarker** | `@eval-benchmarker` | Faithfulness scoring, hallucination benchmarks, synthetic golden datasets |
| **Prompt Injection Shield** | `@prompt-injection-shield` | Direct/indirect jailbreak defense, delimiter hardening, canary tokens |
| **MCP Server Builder** | `@mcp-server-builder` | Model Context Protocol servers, JSON-RPC 2.0, stdio/SSE transports |

---

### 3. 🎬 Division: Media & Video Processing
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **Remotion Motion Engineer**| `@remotion-motion-engineer`| Deterministic 60fps React video, clamped spring physics, kinetic typography |
| **FFmpeg Pipeline Master** | `@ffmpeg-pipeline-master` | Faststart web streaming, silence removal, hardware acceleration (NVENC) |

---

### 4. 🌐 Division: Cloud-Native & Serverless
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **Serverless Edge Lead** | `@serverless-edge-lead` | Cloudflare Workers, Vercel Edge, sub-50ms cold starts, streaming SSR |
| **GraphQL Federation** | `@graphql-federation-architect`| Apollo Federation v2, DataLoader N+1 batching, query depth limits |
| **Event Sourcing Specialist**| `@event-sourcing-specialist` | Append-only event stores, CQRS, Transactional Outbox pattern |

---

### 5. 🔍 Division: Reverse Engineering & Protocol Inspection
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **Binary & AST Inspector** | `@binary-ast-inspector` | Source map reconstruction, AST normalization, control flow deobfuscation |
| **Network Security Auditor**| `@network-security-auditor`| TLS 1.3 audit, WebSocket hijacking (CSWSH) defense, sliding window rate limits |

---

### 6. 🛡️ Division: Security & Red Team
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **AppSec Auditor** | `@appsec-auditor` | OWASP Top 10, SQLi, XSS, SSRF prevention, secure response headers |
| **Secret Leak Sentinel** | `@secret-leak-sentinel` | High-entropy credential scanning, git history leaks, `.env` protection |
| **Auth & Identity Guard** | `@auth-identity-guard` | OAuth2, PKCE, JWT tampering validation, session revocation |
| **Dependency Scanner** | `@dependency-vulnerability-scanner`| npm audit, CVE remediation, typosquatting & supply chain security |

---

### 7. ⚡ Division: Deep Performance
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **CWV & LCP Doctor** | `@cwv-lcp-doctor` | Sub-2.5s LCP, INP main-thread scheduling, zero CLS layout shifts |
| **Memory Leak Hunter** | `@memory-leak-hunter` | V8 heap snapshot analysis, detached DOM nodes, closure leaks |
| **Bundle Dietician** | `@bundle-dietician` | Tree-shaking, code-splitting, dead ghost dependency elimination |
| **SQL Query Optimizer** | `@sql-query-optimizer` | Eliminating nested loops, Keyset pagination, composite index scans |

---

### 8. 🧪 Division: Quality Assurance & Testing
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **TDD Champion** | `@tdd-champion` | Strict Red-Green-Refactor cycles, Vitest/Jest unit & branch coverage |
| **E2E Playwright Tester** | `@e2e-playwright-tester` | Deterministic browser automation, user journey tests, trace debugging |
| **Edge-Case Fuzzer** | `@edge-case-fuzzer` | Extreme inputs, unicode fuzzing, race conditions, concurrency tests |

---

### 9. ☁️ Division: DevOps & Cloud Infrastructure
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **Docker Slimmer** | `@docker-slimmer` | Multi-stage Dockerfiles, non-root users, 70%+ container size reduction |
| **CI/CD Pipeline Master** | `@ci-cd-pipeline-master`| Parallel GitHub Actions, layer caching, automated semantic releases |
| **Kubernetes Architect** | `@k8s-cloud-architect` | Helm, HPA autoscaling, zero-downtime rolling updates, resource limits |

---

### 10. 🚀 Division: Product Launch & DevRel
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **Prompt Architect** | `@prompt-architect` | 6-step hierarchical system prompts for Claude, GPT-4o, and Gemini |
| **PR Artisan** | `@pr-artisan` | Conventional Commits, git diff analysis, high-impact release notes |
| **README Copywriter** | `@readme-copywriter` | Viral open-source READMEs, conversion hooks, documentation architecture |

---

## ⚡ The Operational Instincts (Zero-Slop Reflexes)

1. **Zero-Slop Contract (`instincts/zero-slop-contract.md`)**: Strictly forbids `// TODO: implement later`, empty handler functions, and cosmetic skinning over broken roots.
2. **Verification Before Completion (`instincts/verification-before-completion.md`)**: Mandates running compiler checks, linters, and tests before claiming any task is resolved.
3. **Test-Driven Discipline (`instincts/test-driven-discipline.md`)**: Fixes bugs by writing a reproducing failing test before touching implementation code.
4. **Context Retention (`instincts/context-retention-rules.md`)**: Periodically outputs structured STATE blocks to preserve decision memory across long multi-turn sessions.
5. **Anti-Loop Root Cause (`instincts/anti-loop-root-cause.md`)**: Hard breaker against infinite contractor loops. Forces immediate escalation if 2 consecutive attempts fail.
6. **Anti-Drift Scope Boundary (`instincts/anti-drift-scope-boundary.md`)**: Restricts file modifications strictly to the explicitly approved target boundary.
7. **Rationalization Breaker (`instincts/rationalization-breaker.md`)**: Anti-excuse table identifying red-flag AI rationalizations ("Tests pass so it must work", "I'll clean this up later").
8. **Systematic Investigation (`instincts/systematic-investigation.md`)**: 4-phase iron law: Reproduce -> Isolate -> Hypothesize -> Verify.

---

## 📜 License

Distributed under the **MIT License**. Free for personal and commercial engineering teams worldwide.

---

<div align="center">
  <sub>Engineered with precision by <strong>Amanulla Shaikh</strong> for the global autonomous AI engineering ecosystem.</sub>
</div>
