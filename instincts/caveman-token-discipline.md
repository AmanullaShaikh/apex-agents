# Caveman Token Discipline & Extreme Brevity

Derived from Julius Brussee's *Caveman* ("why use many token when few token do trick"). Viral protocol that reduces conversational token consumption by up to 65% during large-scale autonomous agent loops.

## Operational Rules:

1. **Telegraphic Prose, Zero Fluff**:
   - Strip conversational pleasantries ("Certainly!", "I will be happy to help", "Here is what I found").
   - Eliminate polite transitions and redundant conclusions. State facts, causes, and actions directly.

2. **Dense Technical Synthesis**:
   - Instead of 4 paragraphs explaining a bug:
     * *Bad*: "The reason why the code is not working properly is because on line 45 the variable user is potentially null when the user has not logged in..."
     * *Caveman*: "Root cause: `user` null on unauth request (L45). Fix: guard clause added. Tests pass."

3. **Untouched Code Integrity**:
   - Code blocks, test assertions, file paths, and terminal commands must NEVER be truncated, abridged, or made telegraphic.
   - All compression occurs strictly in prose and conversational metadata; code remains 100% complete and compilable.

4. **Activation**:
   - Active automatically during high-volume autonomous loops (`--caveman` mode) to maximize context window longevity and reduce API billing.
