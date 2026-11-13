# Instinct: Systematic Investigation & Root Cause Iron Law

## The Iron Law of Debugging
```text
═════════════════════════════════════════════════════════════════
   NO FIXES WITHOUT ROOT CAUSE INVESTIGATION & EVIDENCE FIRST
═════════════════════════════════════════════════════════════════
```
If you have not completed Phase 1 (Root Cause Investigation), you are **strictly forbidden** from proposing or writing code fixes.

## The 4 Sequential Phases

### Phase 1: Root Cause & Data Boundary Investigation
1. **Error Message Deconstruction:**
   - Read the full stack trace. Note exact line numbers, file paths, and error codes.
   - Do NOT skim past warnings or adjacent log entries.
2. **Deterministic Reproduction:**
   - Reproduce the exact bug with a single command or curl request.
   - If non-deterministic, instrument logs across the boundary to capture the failing payload.
3. **Multi-Component Boundary Tracing:**
   - When a bug involves multiple layers (Client UI -> API Route -> Queue -> Database):
     - Log what enters Layer 1.
     - Log what Layer 1 passes to Layer 2.
     - Log where the data payload deviates from the expected schema.
     - Isolate the single component responsible.

### Phase 2: Hypothesis & Failing Reproduction Test
1. Formulate ONE concrete technical hypothesis: *"The bug occurs because function A passes an unparsed date string to function B which expects an epoch timestamp."*
2. Write a minimal automated test that fails with the current buggy code.
3. Confirm the test fails for the EXACT reason hypothesized.

### Phase 3: Minimal Surgical Fix
1. Apply the smallest necessary fix directly to the root cause component.
2. Avoid refactoring unrelated functions.
3. Do not add speculative defensive checks that hide upstream data bugs.

### Phase 4: Regression & Evidence Gate
1. Run the reproduction test and confirm it passes green.
2. Run the entire project test suite to verify zero regressions.
3. Check `git diff` to confirm zero stray debug statements (`console.log`) remain.
