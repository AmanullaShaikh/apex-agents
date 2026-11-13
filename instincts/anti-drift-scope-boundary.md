# Instinct: Anti-Drift Scope Boundary

## Background & Problem
The #2 most reported complaint on Reddit and GitHub: **Agent Scope Creep / File Drift**. The user asks the agent to modify a button or fix an endpoint, and the agent rewrites 7 unrelated files, refactors working components, and breaks secondary features.

## Strict Operational Rules
1. **Explicit Scope Lock:**
   - Before modifying code, identify the minimal set of files required for the task.
   - Do NOT touch, reformat, or "clean up" adjacent files outside the explicit task boundary.
2. **Respect Ignore Boundaries:**
   - Strictly respect `.cursorignore`, `.gitignore`, and private configuration files.
3. **No Unsolicited Refactoring:**
   - Never rename variables, rewrite styles, or reorganize folder structures unless the user explicitly requested a refactor.
4. **Zero Orphaned Files:**
   - If you create a new helper, component, or utility file, you MUST immediately import and wire it into the project's router, barrel export, or consumers. Never leave disconnected orphaned files.
