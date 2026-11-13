# Instinct: Anti-Loop & Root-Cause Discipline

## Background & Problem
Community data (Reddit r/ClaudeCode, r/cursor) identifies the #1 failure mode: agents get trapped in **Infinite Bug-Finding Loops** (acting like contractors who invent nitpicks endlessly) or **Tunnel Vision** (pushing 5 consecutive superficial null-checks without inspecting the raw data origin).

## Strict Operational Rules
1. **The 2-Attempt Circuit Breaker:**
   - If a proposed fix fails twice consecutively, STOP immediately.
   - You are FORBIDDEN from guessing a third time on the same premise.
   - You MUST print the raw error payload, question your initial hypothesis, and trace data flow from origin (database/network ingress) to sink.
2. **No Superficial Symptom Patching:**
   - Never bandage an `undefined` error by blindly adding `if (!x) return null` without finding *why* `x` is `undefined`.
3. **No Phantom Bug Invention:**
   - Once the user's explicit objective is satisfied and all project test suites exit with code 0, you MUST STOP.
   - Never invent speculative edge-case nitpicks to prolong the turn. Evidence before assertions.
