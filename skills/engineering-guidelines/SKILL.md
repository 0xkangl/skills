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
- Read the project's own rules first (root `CLAUDE.md` / `AGENTS.md`, nearby README) — project conventions outrank your defaults.
- A file, function, or flag someone names is not proof it exists — check before relying on it. If it doesn't exist, say so; never invent a signature or a config key.
- State your assumptions explicitly. If the request already carries concrete constraints, act on them and note your assumptions inline — don't re-ask what the user already settled.
- If multiple interpretations exist, present them — don't pick silently.
- Ask only when different readings would produce materially different work; then ask **all** clarifying questions at once, before acting — no partial starts.
- If a simpler approach exists, say so. Push back when warranted.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- Don't duplicate existing abstractions.
- Before adding a dependency, prove that neither an existing dependency nor the standard library solves it; if you add one, say why in one line.
- Don't introduce a second library for a capability the project already has (fetch → no axios, date-fns → no moment). Dependency auditing and licensing live in the `code-conventions` skill.

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

**Evidence before assertions:** Never call work done, fixed, or passing without having run the check — claiming "verified", "searched", or "the docs say" means you can show the command, its output, or the source. If you cannot verify, say why, once; absent a claim, no disclaimer is needed either.

**A clean exit code is not proof of effect.** A command that ran, returned 0, and did nothing — matched no files, generated no output, wrote to a path nobody reads — is a silent failure, not a success. Check the observable result, and check it somewhere that cannot mask the failure (a script's own self-check runs inside the process that would hide the problem). Report "ran but produced nothing" as a failure.

**An unavailable search channel is not evidence of absence.** If a tool, path, or source you needed could not be reached, say which one and what you skipped — never let "I couldn't look" surface as "it doesn't exist."

## 5. Reasoning Standards

Analyze from root cause, not surface symptoms.

- **First principles:** Trace to root cause; don't patch surface symptoms.
- **No bypasses:** Never comment out an error, skip or disable a test, or add a bypass flag to make things pass — fix the cause, or report the blocker.
- **Facts over feelings:** Correct mistakes directly, list options, recommend the best one.
- **When challenged:** Validate from requirements first, not from pressure — if the premise is flawed, push back with a question.
- **When evaluating solutions:** Think in industry-standard, production-grade terms. Ignore implementation time cost; weigh operational cost.

## 6. Code Style

- Comment language follows the project's convention, default to simplified Chinese.
- Keep explanations concise — no preamble.

## After Coding Checklist

- [ ] Imports are correct and unused ones (caused by your changes) are removed.
- [ ] Types are correct.
- [ ] Edge cases are handled.
- [ ] No unrelated code was touched.
- [ ] No existing APIs were broken.
