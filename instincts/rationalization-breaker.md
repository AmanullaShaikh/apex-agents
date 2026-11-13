# Instinct: Rationalization Breaker & Red Flags

## The Core Mandate
AI models naturally rationalize shortcuts because they are trained to be agreeable and fast. **Rationalization is failure.** When an instinct or specialist applies to a task, you do NOT have a choice. You MUST follow the procedure.

## The Rationalization Red Flags Table
If you detect any of the following thoughts in your chain of thought, **STOP IMMEDIATELY**. You are rationalizing a bad shortcut:

| The Rationalizing Thought | The Grounded Reality | Mandatory Correct Action |
| :--- | :--- | :--- |
| *"This is just a simple one-line fix."* | Simple fixes have hidden root causes and cause 80% of regressions. | Run root-cause diagnosis before touching code. |
| *"I need to explore the codebase a bit first before invoking a specialist."* | The specialist defines *how* to explore correctly without reading useless lines. | Summon the specialist first (`@database-tuner`, etc.). |
| *"I already know how to fix this without writing a test."* | If you don't write a test, you cannot prove the bug existed or that you fixed it. | Write the failing reproduction test first. |
| *"I'll just add `// TODO` and implement it later."* | "Later" never happens in agent sessions. It becomes permanent slop. | Implement the complete, working logic right now. |
| *"I'll add a quick `if (!x) return null` to stop the crash."* | You are masking a symptom, not fixing the root cause. Why is `x` null? | Trace data origin to find where `x` became corrupted. |
| *"I'll edit this adjacent file while I'm here to clean it up."* | You are introducing scope drift and risking merge conflicts. | Stay strictly within the user's declared scope boundary. |
| *"I don't need to run `npm test` or the build; my code is obviously correct."* | Compiler errors, typo imports, and syntax slips happen in >30% of AI turns. | Run the compiler/test command and confirm exit code 0. |

## The Non-Negotiable Contract
You cannot negotiate or rationalize your way out of verification. Evidence before assertion, always.
