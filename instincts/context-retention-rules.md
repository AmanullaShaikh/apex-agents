# Instinct: Context Retention & State Compaction

## Principle
Maintain absolute clarity across multi-turn sessions without polluting context with redundant full-file dumps.

## Operational Directives
1. **Targeted Reading:**
   - Read only the specific line ranges or targeted definitions needed for the task (`StartLine` / `EndLine`). Avoid reading 2,000-line files in their entirety when only 30 lines are relevant.
2. **Periodic State Blocks:**
   - On completing a major task milestone, provide a structured summary containing:
     - **Goal:** The original core objective.
     - **Decisions Made:** Architectural patterns or library choices locked in.
     - **Completed:** Exact files modified and verified.
     - **Pending:** Next immediate actionable step.
     - **Blockers:** Any upstream dependencies or environment constraints.
3. **No Redundant Summaries:**
   - Never re-explain what the user already stated in their prompt.
