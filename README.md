# ⚡ Apex Agents

> **Local AST Context Compactor, Git Rollback Vault & Developer Tooling Suite for AI Coding Assistants.**  
> A focused Node.js CLI combining a **Babel AST tooling engine**, **git-native checkpoint/rollback**, **static bug & anti-tamper diff guards**, **native MCP server**, and **38 curated system-prompt packs** for **Cursor, Claude Code, Windsurf, Copilot, and Antigravity**.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/apex-agents.svg?style=flat-square&color=38bdf8)](https://www.npmjs.com/package/apex-agents)
[![CI & Integrity Suite](https://github.com/AmanullaShaikh/apex-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/AmanullaShaikh/apex-agents/actions/workflows/ci.yml)
[![Babel AST Engine](https://img.shields.io/badge/AST%20Parser-Babel%20Engine-F5DA55.svg?style=flat-square)](https://babeljs.io)
[![MCP Protocol](https://img.shields.io/badge/MCP-Native%20Server-8b5cf6.svg?style=flat-square)](#8-native-model-context-protocol-mcp-server)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](https://github.com/AmanullaShaikh/apex-agents/pulls)

</div>

---

## 💡 Why This Toolkit Exists

AI coding assistants (Cursor, Claude Code, Windsurf) perform well on isolated edits, but repeatedly hit three practical failure modes in larger repositories:

```
┌────────────────────────────────────────────────────────────────────────┐
│                       THE 3 AI CODING FAILURE MODES                    │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Context Window Bloat        │ Dumping raw implementation files      │
│                                │ floods context and hurts precision.   │
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. Silent Test Tampering       │ When tests fail, models sometimes     │
│                                │ insert `it.skip` or delete assertions.│
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Destructive Multi-File Edits│ Broken refactors leave dirty working  │
│                                │ trees, untracked junk, or broken .env.│
└────────────────────────────────┴───────────────────────────────────────┘
```

### 🔬 What Apex Agents IS vs What It Is NOT

| Aspect | What Apex Agents IS | What It Is NOT |
| :--- | :--- | :--- |
| **Tooling Layer** | Local Node.js CLI powered by `@babel/parser`, Git CLI, and JSON-RPC stdio. | Not a hosted SaaS or proprietary model wrapper; runs 100% offline with zero paid API keys. |
| **Specialist Personas** | Structured **Markdown System Prompt Packs** (`agents/` and `instincts/`). | Not standalone compilers, runtimes, or background multi-agent daemons. |
| **Safety Gates** | Static AST bug checks, secret leak scanning, and anti-test-tampering diff audits. | Not a container sandbox; untrusted binary execution still requires Docker/VMs or Git Worktrees. |

---

## 🚀 Quickstart

Run directly with `npx` — **zero global installation or API keys required**:

```bash
# Initialize in your current project (injects rules, exports .cursor/rules & installs pre-commit hook)
npx apex-agents init
```

### ⚡ Command Reference (v2.1.0)

| Command | Category | What It Physically Does |
| :--- | :--- | :--- |
| `npx apex-agents init` | Setup | Injects directives into `CLAUDE.md`/`.cursorrules`, exports `.cursor/rules/*.mdc`, installs pre-commit hook |
| `npx apex-agents compact` | Context | Babel AST compactor stripping JS/TS/Py/Go/Rust bodies to signatures with PageRank & reverse callers |
| `npx apex-agents graph` | Architecture | Builds AST import/export dependency graph, computes PageRank centrality, and detects import cycles |
| `npx apex-agents diagram` | Architecture | Generates a standalone dark-mode HTML dependency diagram |
| `npx apex-agents trace <sym>` | Code Intel | Traces symbol declaration and cross-file call sites into a compact LLM dossier |
| `npx apex-agents checkpoint` | Safe State | Saves atomic git working-tree snapshot including untracked files, `.env`, and `.git/hooks` |
| `npx apex-agents rollback` | Safe State | Restores working tree, deletes rogue untracked files, and restores `.env` & git hooks |
| `npx apex-agents audit-bugs` | Static Scan | Babel AST scanner for raw SQL injection, React `useEffect` timer leaks, and floating promises |
| `npx apex-agents review` | Security | Git diff auditor blocking credential leaks, lazy `TODO` stubs, and test tampering (`it.skip`, etc.) |
| `npx apex-agents test-loop` | Testing | Detects test runner, runs suite, and writes structured `APEX_FIX_PROMPT.md` on failure |
| `npx apex-agents cost` | Metrics | Measures repo token volume (subword regex), actual AST compaction savings, and optional `--price-in=<$/1M>` |
| `npx apex-agents budget` | Metrics | Inspects context bloat and generates recommended `.cursorignore` rules |
| `npx apex-agents sandbox <cmd>` | Isolation | Creates and cleans isolated Git Worktrees (`.worktrees/`, branch `apex/<name>`) |
| `npx apex-agents handoff` | State | Serializes git status and recent commits into a compact `<session_handoff>` XML block |
| `npx apex-agents memory [cmd]` | State | Records project architecture decisions in `.agents/memory.json` and syncs to `CLAUDE.md` |
| `npx apex-agents mcp` | Protocol | Starts the native stdio Model Context Protocol (MCP) server for Claude Desktop & Cursor |
| `npx apex-agents scan-secrets` | Security | Scans workspace files for leaked credentials and split/obfuscated keys |
| `npx apex-agents export-all` | Export | Writes rule configs for Claude Code, Cursor, Windsurf, Copilot, and Aider |
| `npx apex-agents cursor-rules` | Export | Exports `.cursor/rules/*.mdc` specialist rule files into the current project |
| `npx apex-agents inject` | Setup | Idempotently injects Apex directives into `CLAUDE.md` and `.cursorrules` |
| `npx apex-agents install-hooks` | Security | Installs pre-commit secret-scan & anti-tamper git hooks (worktree-aware) |
| `npx apex-agents studio` | Interface | Interactive keyboard-driven terminal explorer for browsing specialist prompt packs |
| `npx apex-agents dashboard` | Interface | Opens local HTML explorer (`dashboard.html`) in your browser |
| `npx apex-agents doctor` | Diagnostics | Checks Node.js runtime, git common dir (worktree-aware), hooks, and `.cursor/rules` |

---

## 🗜️ 1. AST Context Compactor (`apex-agents compact`)

Instead of dumping full source files into an AI chat, `apex-agents compact` parses **TypeScript, JavaScript, JSX, Python (`.py`), Go (`.go`), and Rust (`.rs`)**, replacing internal function bodies with `{}` or `pass` while keeping interfaces, types, exports, parameter signatures, and cross-file callers:

```bash
# Compact repository -> APEX_CONTEXT.md
npx apex-agents compact

# Output structured XML or JSON
npx apex-agents compact --xml
npx apex-agents compact --json

# Prioritize top 10 hubs by PageRank or enforce a token cap
npx apex-agents compact --top=10
npx apex-agents compact --budget=8000
```

- **Reverse Caller Annotation**:
  ```typescript
  // 🔗 Callers (2): src/controllers/user.ts:45, src/routes/auth.ts:12
  export function authenticateUser(token: string): Promise<Session>;
  ```
- **PageRank Centrality**: Ranks core hub modules (`types.ts`, `auth.ts`, `db.ts`) first when fitting inside a `--budget`.

---

## 💾 2. Git-Native Checkpoint & Rollback (`apex-agents checkpoint`)

Before letting an AI assistant run a large refactor, snapshot your exact working state (tracked diffs, untracked files including unicode paths, gitignored `.env` files, and `.git/hooks`):

```bash
# Save an atomic snapshot
npx apex-agents checkpoint "before auth refactor"

# List saved checkpoints
npx apex-agents checkpoints list

# Roll back working tree, delete rogue untracked files, and restore .env & hooks
npx apex-agents rollback
```

---

## 🔍 3. Semantic Symbol Tracer (`apex-agents trace`)

Locate any symbol's declaration and every cross-file call site without loading entire files:

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

## 🪲 4. Static AST Bug Hunter (`apex-agents audit-bugs`)

Traverses JS/TS ASTs with Babel to flag common runtime bugs:

```bash
npx apex-agents audit-bugs
```

- **SQL Injection**: String concatenation, template literals, multi-hop variable aliases, computed member calls (`db['query']`), `.call`/`.apply`/`.bind`, and `Reflect.get` sinks.
- **React Hook Timer Leaks**: `useEffect` calls registering `setInterval` or `addEventListener` without a cleanup return function.
- **Floating Promises**: Un-awaited async persistence/network calls risking unhandled rejections.

---

## 📊 5. Token Volume & AST Compaction Auditor (`apex-agents cost`)

Measures repository token volume (using a fast local subword regex approximation) and calculates **actual measured AST compaction savings** across your codebase. Pass `--price-in` to compute cost for your own model's live input rate without relying on stale hardcoded vendor tables:

```bash
# Measure token volume and real AST compaction savings
npx apex-agents cost

# Optional: calculate dollar cost using your model's current $/1M input token rate
npx apex-agents cost --price-in=2.00
```

---

## 🔁 6. Deterministic Test-Loop Runner (`apex-agents test-loop`)

Runs your project's test runner (auto-detecting `npm`, `pnpm`, `yarn`, `bun`, `vitest`, `jest`, `pytest`, `cargo test`, `go test`, or any custom command) and writes a structured `APEX_FIX_PROMPT.md` on failure for your IDE agent:

```bash
# Auto-detect project test runner
npx apex-agents test-loop

# Or pass a custom command (quoted or unquoted)
npx apex-agents test-loop node --test tests/auth.test.js
```

```
┌─────────────────┐       Pass (Exit 0)       ┌────────────────────────┐
│  Run Test Suite ├──────────────────────────►│ Removes stale prompt   │
└────────┬────────┘                           └────────────────────────┘
         │ Fail (Exit > 0)
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Parse failures (file, line, expected vs actual, stack trace)        │
│  Emit APEX_FIX_PROMPT.md with anti-test-tampering constraints        │
│  Hand off directly to Cursor, Claude Code, or Windsurf               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ 7. Pre-Commit Security & Anti-Cheat Diff Auditor (`apex-agents review`)

```bash
# Audit working tree diff
npx apex-agents review

# Audit staged diff with strict exit code on violations
npx apex-agents review --staged --strict
```

- **Secret Leak Detection** (shared with `scripts/scan-secrets.js`): Detects AWS keys, Stripe keys, OpenAI/Anthropic keys, GitHub tokens, Slack tokens, private keys, base64 payloads, split/concatenated strings, hex/unicode escapes, zero-width characters, and bitwise `String.fromCharCode` obfuscation.
- **Anti-Cheat Test Tampering**: Intercepts `it.skip`, `it.only`, commented assertions, early returns, `process.exit`, assertion shadowing, dead branches, and tautological assertions in test diffs.
- **Placeholder Detection**: Flags `TODO`/`FIXME` placeholders, empty `catch {}` blocks, and unimplemented stubs in source diffs.

---

## 🔌 8. Native Model Context Protocol (MCP) Server

Exposes the local AST, Git, and diff-audit engines directly over JSON-RPC 2.0 stdio to **Claude Desktop**, **Cursor**, **Windsurf**, and **Antigravity**:

### MCP Tools Exposed
- `apex_compact_code`: Babel AST compactor preserving signatures and types.
- `apex_audit_code_bugs`: Static AST scanner for SQLi, hook leaks, and floating promises.
- `apex_checkpoint`: Git-native working tree snapshot (including untracked files, `.env`, hooks).
- `apex_rollback`: Atomic rollback to a saved checkpoint.
- `apex_trace_symbol`: Cross-file symbol declaration and caller lookup.
- `apex_audit_diff`: Security and anti-test-tampering diff auditor.
- `list_specialists` / `summon_specialist` / `get_operational_instinct`: Browse and load the 38 specialist prompt packs and 13 operational instincts.

### Configuration (`claude_desktop_config.json`)
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

## 🏛️ Specialist Prompt Packs (38 Domain Directives across 10 Divisions)

> **Note**: Each specialist is a structured Markdown system-instruction file (`agents/<division>/<name>.md`) containing role boundaries, negative constraints, workflows, and verification gates.

1. **Core Engineering**: `@frontend-architect`, `@typescript-pro`, `@backend-systems-lead`, `@database-tuner`, `@api-microservices-lead`, `@state-machine-architect`, `@fullstack-general`
2. **AI, LLM & Agentic Systems**: `@rag-pipeline-architect`, `@eval-benchmarker`, `@prompt-injection-shield`, `@mcp-server-builder`
3. **Media & Video Processing**: `@remotion-motion-engineer`, `@ffmpeg-pipeline-master`
4. **Cloud-Native & Distributed Scale**: `@system-design-architect`, `@serverless-edge-lead`, `@graphql-federation-architect`, `@event-sourcing-specialist`
5. **Reverse Engineering & Analysis**: `@binary-decompiler`, `@binary-ast-inspector`, `@network-security-auditor`
6. **Security & Red Team**: `@appsec-auditor`, `@secret-leak-sentinel`, `@auth-identity-guard`, `@dependency-vulnerability-scanner`
7. **Performance**: `@cwv-lcp-doctor`, `@memory-leak-hunter`, `@bundle-dietician`, `@sql-query-optimizer`
8. **Quality Assurance & Testing**: `@tdd-champion`, `@e2e-playwright-tester`, `@edge-case-fuzzer`
9. **DevOps & Infrastructure**: `@docker-slimmer`, `@ci-cd-pipeline-master`, `@k8s-cloud-architect`
10. **Product & DevRel**: `@growth-marketer`, `@prompt-architect`, `@pr-artisan`, `@readme-copywriter`

---

## ⚡ 13 Operational Instincts (`instincts/`)

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
12. Clean Diagram Rules
13. Anti-Cheat Test Tampering

---

## 📜 License

Distributed under the **MIT License**. Authored by **Amanulla Shaikh**.
