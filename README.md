# ⚡ Apex Agents: The Autonomous Engineering Agency

> **A complete, production-grade AI engineering agency at your fingertips. 8 specialized divisions, 27+ expert agent personas, zero-slop operational instincts, native Model Context Protocol (MCP) server, and automated DX tooling for Claude Code, Cursor, Codex, and Antigravity.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-green.svg?style=flat-square)](https://nodejs.org)
[![MCP Native](https://img.shields.io/badge/MCP-Native%20Server-purple.svg?style=flat-square)](#-native-mcp-server-support)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](https://github.com/AmanullaShaikh/apex-agents/pulls)
[![Zero-Slop Certified](https://img.shields.io/badge/Zero--Slop-Enforced-orange.svg?style=flat-square)](#-the-operational-instincts)

---

## 💡 Why Apex Agents?

Generic AI coding prompts output generic, flaky code. They leave lazy `// TODO` placeholders, invent non-existent APIs, introduce N+1 query bottlenecks, leak production API keys into git commits, and drop frames in UI animations.

**Apex Agents** solves this by converting your AI agent harness into an **enterprise engineering agency**:
* **27+ Specialized Domain Experts**: Need database tuning? Summon `@database-tuner`. Need a security audit? Summon `@appsec-auditor`. Need RAG architecture? Summon `@rag-pipeline-architect`.
* **Zero-Slop Instincts**: Strict negative constraints that forbid lazy ellipses, fake fixes, and unverified assertions.
* **Native Model Context Protocol (MCP)**: Run as an MCP server to connect seamlessly to Claude Desktop, Cursor, and Antigravity.
* **Modern Cursor Rules Generator**: Exports `.cursor/rules/*.mdc` files with automated file globs.

---

## 🚀 60-Second Quickstart

### Option 1: Universal 1-Command Global Install
Install the agency globally into your AI harness:

```bash
npx apex-agents install
```

### Option 2: Export Modern Cursor Rules (`.cursor/rules/*.mdc`)
Instantly generate modern `.cursor/rules/` files for your current project:

```bash
npx apex-agents cursor-rules
```

### Option 3: Inject Directives into Current Project
Inject zero-slop operational instincts into `CLAUDE.md` and `.cursorrules`:

```bash
npx apex-agents inject
```

---

## 🔌 Native MCP Server Support

Apex Agents comes with a built-in Model Context Protocol (MCP) server! You can connect all 27+ specialists and instincts directly to Claude Desktop, Cursor, or Antigravity via stdio.

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

## 🏛️ Agency Divisions & Specialists (27 Experts)

### 1. 🛠️ Division: Core Engineering
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **Frontend Architect** | `@frontend-architect` | React 19, Next.js, state machines, accessible UI, 60fps GPU compositing |
| **Backend Systems Lead** | `@backend-systems-lead` | Distributed architectures, idempotency, microservices, rate limiting |
| **Database Tuner** | `@database-tuner` | B-Tree indexing, `EXPLAIN ANALYZE`, connection pooling, query planning |
| **API & Microservices Lead**| `@api-microservices-lead` | Event-driven pipelines, WebSockets, gRPC, decoupled service boundaries |
| **Fullstack General** | `@fullstack-general` | End-to-end vertical features, shared schemas, optimistic UI updates |

---

### 2. 🤖 Division: AI, LLM & Agentic Systems
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **RAG Pipeline Architect** | `@rag-pipeline-architect` | Hybrid search (BM25 + Dense vector), cross-encoder rerankers, semantic chunking |
| **LLM Eval Benchmarker** | `@eval-benchmarker` | Faithfulness scoring, hallucination benchmarks, synthetic golden datasets |
| **MCP Server Builder** | `@mcp-server-builder` | Model Context Protocol servers, JSON-RPC 2.0, stdio/SSE transports |

---

### 3. 🎬 Division: Media & Video Processing
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **Remotion Motion Engineer**| `@remotion-motion-engineer`| Deterministic 60fps React video, clamped spring physics, kinetic typography |
| **FFmpeg Pipeline Master** | `@ffmpeg-pipeline-master` | Faststart web streaming, silence removal, hardware acceleration (NVENC) |

---

### 4. 🛡️ Division: Security & Red Team
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **AppSec Auditor** | `@appsec-auditor` | OWASP Top 10, SQLi, XSS, SSRF prevention, secure response headers |
| **Secret Leak Sentinel** | `@secret-leak-sentinel` | High-entropy credential scanning, git history leaks, `.env` protection |
| **Auth & Identity Guard** | `@auth-identity-guard` | OAuth2, PKCE, JWT tampering validation, session revocation |
| **Dependency Scanner** | `@dependency-vulnerability-scanner`| npm audit, CVE remediation, typosquatting & supply chain security |

---

### 5. ⚡ Division: Deep Performance
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **CWV & LCP Doctor** | `@cwv-lcp-doctor` | Sub-2.5s LCP, INP main-thread scheduling, zero CLS layout shifts |
| **Memory Leak Hunter** | `@memory-leak-hunter` | V8 heap snapshot analysis, detached DOM nodes, closure leaks |
| **Bundle Dietician** | `@bundle-dietician` | Tree-shaking, code-splitting, dead ghost dependency elimination |
| **SQL Query Optimizer** | `@sql-query-optimizer` | Eliminating nested loops, Keyset pagination, composite index scans |

---

### 6. 🧪 Division: Quality Assurance & Testing
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **TDD Champion** | `@tdd-champion` | Strict Red-Green-Refactor cycles, Vitest/Jest unit & branch coverage |
| **E2E Playwright Tester** | `@e2e-playwright-tester` | Deterministic browser automation, user journey tests, trace debugging |
| **Edge-Case Fuzzer** | `@edge-case-fuzzer` | Extreme inputs, unicode fuzzing, race conditions, concurrency tests |

---

### 7. ☁️ Division: DevOps & Cloud Infrastructure
| Agent | Trigger | Focus Area |
| :--- | :--- | :--- |
| **Docker Slimmer** | `@docker-slimmer` | Multi-stage Dockerfiles, non-root users, 70%+ container size reduction |
| **CI/CD Pipeline Master** | `@ci-cd-pipeline-master`| Parallel GitHub Actions, layer caching, automated semantic releases |
| **Kubernetes Architect** | `@k8s-cloud-architect` | Helm, HPA autoscaling, zero-downtime rolling updates, resource limits |

---

### 8. 🚀 Division: Product Launch & DevRel
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

---

## 🧰 Built-in Automation Scripts

```bash
# Scan repository for exposed Stripe, OpenAI, or AWS secrets
node scripts/scan-secrets.js

# Detect unused ghost packages in package.json
node scripts/analyze-bundle.js
```

---

## 🤝 Contributing

We welcome community specialists! To add a new agent persona:
1. Create a new markdown file in the relevant division folder: `agents/<division>/<agent-name>.md`
2. Follow the standardized schema (Identity, Negative Constraints, Execution Workflow, Verification Gate).
3. Open a Pull Request!

---

## 📜 License

Distributed under the **MIT License**. Free for personal and commercial engineering teams worldwide.

---

<div align="center">
  <sub>Engineered with precision by <strong>Amanulla Shaikh</strong> for the global autonomous AI engineering ecosystem.</sub>
</div>
