<div align="center">

<img src="assets/aveyx-banner.png" alt="Aveyx Banner" width="720" />

# Aveyx

**Offline-First Babel AST Compactor, Blast-Radius Analyzer, Git Rollback Vault & Security MCP Server for AI Coding Assistants.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/aveyx.svg?style=flat-square&color=38bdf8)](https://www.npmjs.com/package/aveyx)
[![CI & Integrity Suite](https://github.com/AmanullaShaikh/aveyx/actions/workflows/ci.yml/badge.svg)](https://github.com/AmanullaShaikh/aveyx/actions/workflows/ci.yml)
[![Node.js >=20](https://img.shields.io/badge/Node.js-%3E%3D20-339933.svg?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-Tools%20%26%20Prompts-8b5cf6.svg?style=flat-square)](#7-native-model-context-protocol-mcp-server)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](https://github.com/AmanullaShaikh/aveyx/pulls)

</div>

---

## Why Aveyx

AI coding assistants (**Cursor, Claude Code, Windsurf, Copilot, Antigravity**) work well on isolated edits, but hit four recurring failure modes in real repositories:

| Failure Mode | What Goes Wrong | How Aveyx Fixes It |
| :--- | :--- | :--- |
| **Context Window Bloat** | Dumping full files floods context and degrades precision. | `aveyx compact` strips function bodies via Babel/multi-lang AST while keeping types, signatures, and PageRank callers. |
| **Blind Change Blast Radius** | Editing a shared module silently breaks downstream callers and tests. | `aveyx impact` computes the transitive reverse-dependency graph and lists every affected test suite. |
| **Silent Test Tampering & Leaks** | Models insert `it.skip`, swallow assertions in `try/catch`, or hardcode API keys. | `aveyx review` runs a Babel AST anti-tamper + secret scanner at commit/push time with SARIF 2.1.0 output. |
| **Destructive Refactors** | Broken edits leave dirty working trees, corrupt `.env`, or poisoned git hooks. | `aveyx checkpoint` / `rollback` atomically snapshots and restores working state without detaching `HEAD`. |

### What Aveyx IS vs What It Is NOT

| Aspect | What Aveyx IS | What Aveyx Is NOT |
| :--- | :--- | :--- |
| **Runtime** | Local Node.js 20+ CLI using `@babel/parser`, Git CLI, and JSON-RPC 2.0 stdio. | Not a hosted SaaS or paid API wrapper; runs 100% offline with zero API keys. |
| **Specialists** | 32 curated Markdown system-prompt packs (`agents/`) & 12 instincts (`instincts/`). | Not background autonomous daemons or cloud agent runners. |
| **Security Gates** | Static AST bug checks, credential scanning, and anti-test-tampering diff audits. | Not an OS container sandbox; untrusted binaries still require Docker/VMs. |

---

## Quickstart

Run directly with `npx` — zero global install or API keys required:

```bash
npx aveyx init
```

### Command Reference (`v3.0.2`)

| Command | Category | What It Does |
| :--- | :--- | :--- |
| `npx aveyx init` | Setup | Injects directives into `CLAUDE.md`/`.cursorrules`, exports `.cursor/rules/*.mdc`, installs pre-commit hook |
| `npx aveyx compact` | Context | AST compactor for JS/TS/Py/Go/Rust with PageRank & reverse callers (`--xml`, `--json`, `--top`, `--budget`) |
| `npx aveyx impact [files]` | Architecture | Computes transitive AST blast radius, affected test suites, and risk level (`--diff`, `--json`) |
| `npx aveyx graph` | Architecture | Builds AST import/export dependency graph, PageRank centrality, and detects import cycles |
| `npx aveyx trace <symbol>` | Code Intel | Traces symbol declarations and cross-file call sites into a compact dossier |
| `npx aveyx audit-bugs` | Static Scan | Babel AST scanner for SQL injection, React `useEffect` leaks, and floating promises (`--format=sarif`) |
| `npx aveyx review` | Security | Babel AST + regex git diff auditor for secrets, protected configs, and test tampering (`--staged`, `--strict`, `--format=sarif`) |
| `npx aveyx scan-secrets` | Security | Full-workspace credential scanner supporting cross-line splits and obfuscation |
| `npx aveyx install-hooks` | Security | Installs worktree-aware `pre-commit` (and optional `--pre-push`) git safety hooks |
| `npx aveyx test-loop` | Testing | Runs project test suite and generates structured `AVEYX_FIX_PROMPT.md` on failure |
| `npx aveyx checkpoint` | Safe State | Saves atomic git snapshot including untracked files, `.env`, and `.git/hooks` |
| `npx aveyx rollback` | Safe State | Restores working tree, wipes rogue untracked files, and restores `.env` & hooks (preserves branch) |
| `npx aveyx sandbox <cmd>` | Isolation | Manages isolated Git Worktrees (`.worktrees/`, branch `aveyx/<name>`) |
| `npx aveyx cost` | Metrics | Measures repo token volume, actual AST compaction reduction, and optional `--price-in=<$/1M>` |
| `npx aveyx budget` | Metrics | Scans context bloat and generates `.cursorignore` / `.claudeignore` rules (`-g`) |
| `npx aveyx memory [cmd]` | State | Records architectural decisions in `.agents/memory.json` and syncs to `CLAUDE.md` |
| `npx aveyx handoff` | State | Serializes git status, memory, and branch into a compact `<session_handoff>` XML block (`AVEYX_HANDOFF.md`) |
| `npx aveyx cursor-rules` | Export | Exports `.cursor/rules/aveyx-*.mdc` specialist rule files |
| `npx aveyx inject` | Setup | Idempotently injects Aveyx directives into `CLAUDE.md` and `.cursorrules` |
| `npx aveyx export-all` | Export | Writes unified rules for Claude Code, Cursor, Windsurf, Copilot, and Aider |
| `npx aveyx mcp` | Protocol | Starts the native stdio Model Context Protocol (MCP) server |
| `npx aveyx doctor` | Diagnostics | Verifies Node.js runtime, git common dir (worktree-aware), hooks, and `.cursor/rules` |

---

## 1. AST Context Compactor (`aveyx compact`)

Parses **TypeScript, JavaScript, JSX/TSX, Python, Go, and Rust**, replacing function bodies with `{}` / `pass` while keeping interfaces, types, exports, parameter signatures, and cross-file reverse callers:

```bash
npx aveyx compact
npx aveyx compact --xml
npx aveyx compact --json --top 10 --budget 8000
```

---

## 2. Blast-Radius & Impact Analyzer (`aveyx impact`)

Before or after editing a shared module, compute every direct and transitive dependent plus the exact test files to re-run:

```bash
# Analyze specific modified files
npx aveyx impact src/auth/service.ts

# Analyze uncommitted git changes as JSON
npx aveyx impact --diff --json
```

---

## 3. Static AST Bug Hunter (`aveyx audit-bugs`)

Traverses JS/TS ASTs with Babel and exports **OASIS SARIF 2.1.0** for GitHub Code Scanning:

```bash
npx aveyx audit-bugs
npx aveyx audit-bugs --format=sarif > audit-bugs.sarif
```

- **SQL Injection**: Template literals, concatenation, multi-hop aliases, ternary/logical expressions, `Array.join()`, computed member calls (`db['query']`), `.call`/`.apply`/`.bind`, `Reflect.get`, and `Proxy`.
- **React Hook Timer Leaks**: `useEffect` calls registering `setInterval`/`addEventListener` without a valid cleanup return.
- **Floating Promises**: Un-awaited async persistence/network calls with zero false positives on local synchronous methods.

---

## 4. Security Diff & Anti-Cheat Gate (`aveyx review`)

Combines regex folding with a **Babel AST anti-tamper pass** and **protected-config guard**:

```bash
npx aveyx review --staged --strict
npx aveyx review --staged --format=sarif > review.sarif
```

- **Secret Leak Detection** (shared with `aveyx scan-secrets`): AWS (`AKIA`/`ASIA`), Stripe, OpenAI, Anthropic, GitHub (`ghp_`/`github_pat_`), Google (`AIza`), Slack, JWTs, PEM/PKCS#8/PGP keys, hex/unicode/zero-width/bidi escapes, byte arrays, base64 payloads, and cross-line splits.
- **Anti-Cheat Test Tampering**: Intercepts `.skip`/`.only`/`.todo`, commented/deleted `node:assert`/`expect` calls, aliased/destructured `process.exit`/`abort`/`kill`, empty test bodies, swallowed assertions in non-throwing `try/catch`, dead branches, and tautologies.
- **Protected-Config Guard**: Flags unauthorized modifications to `.git/hooks/`, `.claude/settings.json`, or `package.json` `"test"` script weakening.

---

## 5. Git-Native Checkpoint, Rollback & Hooks

```bash
# Snapshot working tree, untracked files, .env, and .git/hooks
npx aveyx checkpoint "before auth refactor"

# Roll back cleanly (stays on current branch, never detaches HEAD)
npx aveyx rollback

# Install pre-commit + pre-push safety hooks
npx aveyx install-hooks --pre-push
```

---

## 6. Deterministic Test-Loop Runner (`aveyx test-loop`)

Detects `npm`, `pnpm`, `yarn`, `bun`, `vitest`, `jest`, `pytest`, `cargo test`, `go test`, or runs any custom command, writing `AVEYX_FIX_PROMPT.md` on failure and cleaning it automatically on pass:

```bash
npx aveyx test-loop
npx aveyx test-loop node --test tests/auth.test.js
```

---

## 7. Native Model Context Protocol (MCP) Server

Exposes **10 AST/Git/Security tools** and **44 native MCP prompts** (`prompts/list` & `prompts/get`) over stdio JSON-RPC 2.0:

- **Tools**: `aveyx_compact_code`, `aveyx_impact_radius`, `aveyx_audit_code_bugs`, `aveyx_audit_diff`, `aveyx_trace_symbol`, `aveyx_checkpoint`, `aveyx_rollback`, `list_specialists`, `summon_specialist`, `get_operational_instinct`.
- **Prompts**: 32 `specialist:<id>` + 12 `instinct:<id>` directives exposed natively via `prompts/list` and `prompts/get`.

```json
{
  "mcpServers": {
    "aveyx": {
      "command": "npx",
      "args": ["-y", "aveyx", "mcp"]
    }
  }
}
```

---

## Specialist Prompt Packs (32 Directives across 8 Divisions)

1. **Core Engineering**: `@frontend-architect`, `@typescript-pro`, `@backend-systems-lead`, `@database-tuner`, `@api-microservices-lead`, `@state-machine-architect`, `@fullstack-general`
2. **AI, LLM & Agentic Systems**: `@rag-pipeline-architect`, `@eval-benchmarker`, `@prompt-injection-shield`, `@mcp-server-builder`
3. **Cloud-Native & Distributed Scale**: `@system-design-architect`, `@serverless-edge-lead`, `@graphql-federation-architect`, `@event-sourcing-specialist`
4. **Reverse Engineering & Analysis**: `@binary-decompiler`, `@binary-ast-inspector`, `@network-security-auditor`
5. **Security & Red Team**: `@appsec-auditor`, `@secret-leak-sentinel`, `@auth-identity-guard`, `@dependency-vulnerability-scanner`
6. **Performance**: `@cwv-lcp-doctor`, `@memory-leak-hunter`, `@bundle-dietician`, `@sql-query-optimizer`
7. **Quality Assurance & Testing**: `@tdd-champion`, `@e2e-playwright-tester`, `@edge-case-fuzzer`
8. **DevOps & Infrastructure**: `@docker-slimmer`, `@ci-cd-pipeline-master`, `@k8s-cloud-architect`

## 12 Operational Instincts (`instincts/`)

1. Zero-Slop Contract
2. Verification Before Completion
3. Test-Driven Discipline
4. Context Retention (`STATE` blocks)
5. Anti-Loop Root Cause Circuit Breaker
6. Anti-Drift Scope Boundary
7. Rationalization Breaker
8. Systematic Investigation
9. Hallucination Defense
10. Minimalist Code Discipline
11. Concise Token Discipline
12. Anti-Cheat Test Tampering

---

## License

Distributed under the **MIT License**. Authored by **Amanulla Shaikh**.
