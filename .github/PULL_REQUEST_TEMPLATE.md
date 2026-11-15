## 📌 Description
<!-- Provide a clear, concise summary of the changes introduced in this pull request. -->

Closes #<!-- issue number if applicable -->

## 🛠️ Type of Change
- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] ⚡ Performance optimization (AST compaction, token savings, speed)
- [ ] 🛡️ Security / Zero-slop rule improvement
- [ ] 📚 Documentation update

## ✅ Verification & Zero-Slop Checklist
Before submitting this pull request, please verify:
- [ ] My code strictly adheres to the project's zero-slop standards (no `// TODO` stubs, no fake claims, no unhandled promises).
- [ ] I have written accompanying tests verifying both happy paths and error boundaries.
- [ ] All tests pass locally: `npm test` runs with **exit code 0** (0 failures, 0 skipped).
- [ ] Pre-commit hooks executed cleanly: `node ./scripts/audit-diff.js` passed with 0 critical secrets or test-tampering violations.
- [ ] Code is formatted with clean modern syntax (Node 20+, ESM, strict typing).
