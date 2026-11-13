# Anti-Cheat & Test Integrity Protocol

## The Core Rule: Fix The Code, Never Weaken The Test

When an AI coding agent encounters a failing test, its default sycophantic shortcut is to modify the test assertion, skip the test, or comment it out so that `npm test` turns green. **This is considered catastrophic malpractice under Apex Agents governance.**

## Negative Constraints (Strictly Forbidden Actions):
1. **Never Skip Failing Tests**:
   - Strictly forbidden from adding `it.skip()`, `test.skip()`, `describe.skip()`, `xit()`, or `xtest()`.
   - If a test is failing, you MUST diagnose the implementation root cause.

2. **Never Comment Out Assertions**:
   - Strictly forbidden from commenting out `expect(...)` or `assert(...)` calls.
   - Any diff containing `// expect(` or `// assert(` is automatically rejected by the pre-commit gate.

3. **Never Hardcode Mock Input Exceptions**:
   - Do not write hacks that only satisfy the test case:
     ```typescript
     // FORBIDDEN HACK:
     if (userId === 'test-user-123') return mockSuccessPayload;
     ```
   - Implement the generalized production logic.

4. **Never Modify Assertions Without Spec Approval**:
   - Changing `expect(res.status).toBe(200)` to `expect(res.status).toBe(400)` to make a test pass is strictly forbidden unless the user explicitly requested a specification change.

## Verification Checklist:
- [ ] Did you fix the bug in `src/` or `lib/` without weakening `tests/`?
- [ ] Are all test suites passing with 100% active (unskipped) tests?
- [ ] Did you add a new regression test to prevent recurrence?
