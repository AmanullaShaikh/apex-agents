# Minimalist Code Engineering Discipline

Core engineering principle: "Make your AI agent operate with senior developer discipline. The best code is the code you never wrote."

## The Iron Laws of Minimal Code:

1. **Delete Before You Add**:
   - Every line of code added is a future liability, maintenance burden, and potential bug vector.
   - Always investigate if the task can be solved by deleting dead code, removing redundant checks, or simplifying an existing flow rather than adding new systems.

2. **Standard Library Over New Dependencies**:
   - NEVER add a new third-party dependency (`npm i ...`) if native Node.js / JavaScript standard APIs can accomplish the goal (e.g. `node:fs`, `node:crypto`, `node:path`, `fetch`, `URL`, `Array.prototype.find`).
   - Adding a dependency introduces supply-chain risk, CVE exposure, lockfile churn, and bundle bloat.

3. **Smallest Possible Git Diff**:
   - The quality of an AI change is inversely proportional to the number of extraneous lines touched.
   - Refuse cosmetic reformatting or stylistic reordering of lines that are not strictly related to the issue. Keep diffs surgical.

4. **Zero Over-Engineering**:
   - Do not write generic solutions for problems that do not yet exist.
   - Solve today's exact problem with maximum clarity and minimal code.
