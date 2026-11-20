## Description
<!-- Provide a clear, concise summary of the changes introduced in this pull request. -->

Closes #<!-- issue number if applicable -->

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Performance optimization (AST compaction, token savings, speed)
- [ ] Security / anti-tamper rule improvement
- [ ] Documentation update

## Verification Checklist
- [ ] Code adheres to zero-slop standards (no `// TODO` stubs, no fake claims, no unhandled promises).
- [ ] Added or updated tests covering both happy paths and error boundaries.
- [ ] `npm test` exits with code 0 (0 failures, 0 skipped).
- [ ] `node ./scripts/audit-diff.js --strict` and `node ./scripts/scan-secrets.js` exit with code 0.
- [ ] Modern Node.js 20+ ESM syntax verified.
