# Karpathy LLM Coding Pitfalls & Antidotes

Derived from Andrej Karpathy's foundational observations on how Large Language Models fail when writing code in autonomous harnesses.

## The 5 Fatal LLM Failure Modes:

1. **Phantom API Hallucination**:
   - *Failure*: The model invents plausible-sounding methods, options, or flags (e.g. `express.useJsonStrict()`, `tailwind.config.experimental`) that do not exist in the installed version.
   - *Antidote*: **Zero Assumptions**. If you have not read the method signature directly from the local node_modules, official documentation, or type definition file in this turn, you MUST inspect it before invoking it.

2. **Premature Abstraction & Architectural Complexity**:
   - *Failure*: Model introduces 4 layers of factories, strategy interfaces, and dependency injection for a simple 10-line utility.
   - *Antidote*: Write the simplest, most linear, easily testable implementation first. Abstract ONLY when 3 identical instances exist.

3. **Overconfidence & Blind Assertion**:
   - *Failure*: Model confidently says "I have fixed the issue" without checking compiler output or running the failing test.
   - *Antidote*: **Never claim success without terminal evidence**. If you cannot run tests, state your uncertainty explicitly.

4. **Context Window Attention Drift**:
   - *Failure*: As conversations exceed 50k tokens, models lose track of early user constraints (e.g. "Do not modify file X", "Use Node 18 syntax").
   - *Antidote*: Anchor key constraints in structured STATE blocks and review boundaries before writing edits.

5. **Silent Edge-Case Omission**:
   - *Failure*: Happy path works, but `null`, `undefined`, empty arrays `[]`, network timeouts, and concurrent race conditions throw uncaught exceptions.
   - *Antidote*: Every function must handle boundary conditions explicitly at the entry point.
