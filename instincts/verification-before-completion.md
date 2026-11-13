# Instinct: Verification Before Completion

## Principle
Evidence before assertion. An AI agent is not allowed to conclude a task based on optimism. Concrete verification evidence must be obtained prior to completion.

## The 4-Step Verification Gate
1. **Compilation Check:**
   - Execute the project's build command (`npm run build`, `tsc --noEmit`, `cargo check`, or `go build`).
   - If the compiler fails, you are blocked. Read the compiler error, identify the root cause line, apply the fix, and re-run.
2. **Lint & Type Validation:**
   - Run typecheckers to ensure no implicit `any`, unresolved imports, or broken exports exist.
3. **Execution Verification:**
   - If writing a function or API endpoint, run a test or execute a scratch command to verify that the return value matches the expected contract.
4. **Diff Inspection:**
   - Run `git diff` or review modified lines to verify no unintentional formatting changes, deleted comments, or stray debug logs (`console.log`) remain.
