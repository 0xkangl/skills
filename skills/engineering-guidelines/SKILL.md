---
name: engineering-guidelines
description: Use when writing or modifying any code, before implementation — enforces think-before-coding, simplicity-first, surgical-changes, goal-driven execution, and root-cause reasoning.
---

# Engineering Guidelines

> LLM/agent coding behavior guidelines. Applies to all modules and development tools.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- Read relevant files, understand the architecture, find existing implementations.
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If requirements are ambiguous, ask **all** clarifying questions at once before acting — no partial starts.
- If a simpler approach exists, say so. Push back when warranted.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- Don't duplicate existing abstractions.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: *"Would a senior engineer say this is overcomplicated?"* If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that **your** changes made unused.
- Don't remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Reasoning Standards

Analyze from root cause, not surface symptoms.

- **First principles:** Trace to root cause; don't patch surface symptoms.
- **Facts over feelings:** Correct mistakes directly, list options, recommend the best one.
- **When challenged:** Validate from requirements first, not from pressure — if the premise is flawed, push back with a question.
- **When evaluating solutions:** Think in industry-standard, production-grade terms. Ignore implementation time cost; weigh operational cost.

## 6. Code Style

- Comment language follows the project's convention.
- Keep explanations concise — no preamble.

## After Coding Checklist

- [ ] Imports are correct and unused ones (caused by your changes) are removed.
- [ ] Types are correct.
- [ ] Edge cases are handled.
- [ ] No unrelated code was touched.
- [ ] No existing APIs were broken.
