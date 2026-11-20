# 🤝 Contributing to Apex Agents

Thank you for your interest in contributing to **Apex Agents**. Contributions to the local AST tooling, security auditors, tests, and specialist prompts are welcome.

---

## 🏛️ Guiding Philosophy: Zero-Slop Standard

Apex Agents enforces strict, principal-engineering standards across both executable code and agent manifests:
1. **Physical Evidence Over Assertions**: Never claim code works without running verification tools and proving zero exit codes.
2. **Zero Incomplete Stubs**: Never submit `TODO` comments, empty handlers, or dummy return values. Every implementation must be production-ready.
3. **Zero Test Tampering**: Never skip failing tests (`test.skip`, `it.only`) or comment out assertions to fake green builds.

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (Node 22 LTS recommended)
- **Git**: Installed and configured
- **Package Manager**: `npm`, `pnpm`, or `bun`

### 2. Clone & Install
```bash
git clone https://github.com/AmanullaShaikh/apex-agents.git
cd apex-agents
npm install
```

### 3. Run the Test Suite
Apex Agents includes an automated test suite verifying AST compaction, bug hunting, diff auditing, git checkpoints, symbol tracing, MCP tooling, and adversarial stress cases:

```bash
# Run full suite (Agent schema validator + Unit/Integration/Fuzz tests)
npm test

# Run unit tests only
npm run test:unit

# Run agent schema validation
npm run test:agents
```

---

## 📁 Repository Structure

```text
├── agents/             # 32 Domain-Expert System Instruction Manifests (.md)
│   ├── engineering/    # Core fullstack, backend, frontend, database leads
│   ├── ai-systems/     # RAG, MCP, prompt injection, and eval leads
│   ├── security/       # AppSec, auth, secrets, dependency auditors
│   └── ...             # DevOps, media, reverse-engineering, performance
├── instincts/          # 12 Operational behavioral rules (Zero-Slop, TDD, Anti-Loop)
├── scripts/            # Executable Node.js engines (Babel AST, checkpoint, audit, trace, bugs)
├── bin/                # CLI entrypoints (apex.js, mcp-server.js, tui.js)
├── tests/              # Adversarial, unit, and integration test suites
└── .cursor/rules/      # Auto-exported .mdc rules for Cursor
```

---

## 📝 Contribution Workflows

### Adding a New Agent Specialist
1. Create a markdown file under `agents/<division>/<name>.md`.
2. Include mandatory YAML frontmatter (`name`, `division`, `role`, `capabilities`, `triggers`).
3. Include all 4 required sections:
   - `## Identity & Role`
   - `## Strict Negative Constraints`
   - `## Execution Workflow`
   - `## Verification Gate`
4. Run `npm test` to verify schema validation.

### Adding or Enhancing Tooling Engines
1. Implement the engine under `scripts/<engine-name>.js` as an ES module (`export function ...`).
2. Add a dedicated test file under `tests/<engine-name>.test.js`.
3. Wire the command into `bin/apex.js` and `package.json`.
4. Ensure cross-platform support (Windows, macOS, Linux).

---

## 📜 Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat:` A new feature or specialist
- `fix:` A bug fix or false-positive correction
- `docs:` Documentation improvements
- `test:` Adding or updating test suites
- `refactor:` Code cleanup without changing external behavior
- `chore:` Dependency or build tool updates

---

## 🔒 Security Vulnerabilities

Please do **NOT** open public issues for security vulnerabilities. Review our [SECURITY.md](SECURITY.md) for instructions on confidential disclosure.
