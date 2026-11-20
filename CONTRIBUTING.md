# Contributing to Aveyx

Contributions to Aveyx's AST tooling, security auditors, MCP server, tests, and specialist prompts are welcome.

---

## Core Engineering Standard

1. **Physical Evidence Over Claims:** Run `npm test` and `node ./scripts/audit-diff.js --strict` before opening a PR.
2. **Zero Incomplete Stubs:** No `TODO`/`FIXME` placeholders, empty `catch {}` blocks, or dummy handlers.
3. **Zero Test Tampering:** Never skip failing tests (`it.skip`, `test.only`) or weaken assertions to make CI pass.

---

## Development Setup

### Prerequisites
- **Node.js:** `v20.0.0` or higher (Node 22 LTS recommended)
- **Git:** Installed and configured

### Clone & Verify
```bash
git clone https://github.com/AmanullaShaikh/aveyx.git
cd aveyx
npm install
npm test
```

### Useful Verification Commands
```bash
npm run test:unit                     # Run all unit/integration/fuzz suites
npm run test:agents                   # Validate 32 specialists & zero-slop schema
node ./scripts/audit-diff.js --strict # Run Babel AST anti-tamper & secret diff gate
node ./scripts/scan-secrets.js        # Scan full workspace for credential leaks
npm pack --dry-run                    # Verify npm tarball contents
```

---

## Repository Structure

```text
├── agents/             # 32 Domain-Expert System Instruction Manifests (.md across 8 divisions)
├── instincts/          # 12 Operational Behavioral Rules (Zero-Slop, TDD, Anti-Loop)
├── scripts/            # Executable Node.js AST, Git, SARIF, and Security engines
├── bin/                # CLI entrypoints (aveyx.js, mcp-server.js)
├── tests/              # Unit, integration, adversarial, and fuzzing suites
├── assets/             # Brand assets (aveyx-logo.png)
└── .cursor/rules/      # Exported .mdc rules for Cursor
```

---

## Conventional Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New capability, specialist, or MCP tool
- `fix:` Bug fix, parser hardening, or false-positive reduction
- `docs:` Documentation updates
- `test:` Test suite additions or regressions
- `refactor:` Code cleanup without changing external behavior
- `chore:` Dependency or build updates

---

## Security Disclosures

Do **NOT** report security vulnerabilities in public issues. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.
