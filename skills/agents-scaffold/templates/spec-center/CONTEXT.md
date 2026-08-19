# Context — {{PROJECT}}

The **ubiquitous language** of this project. Every module MUST use these terms consistently in specs, code, comments, and conversation. When a module needs a term that only exists inside its own bounded context, define it in that module's `docs/`, not here.

**This file is a glossary and nothing else.** No implementation details, no specifications, no scratch notes — those belong in `specs/`, `api/`, `errors/`, `events/`, or a module's `docs/`. A glossary that accumulates implementation detail drifts with the code and stops being usable as a reference.

## Rules

- Define what a term **is**, in one or two sentences. Not what it does.
- When several words exist for one concept, **pick one** and list the rest under `_Avoid_`.
- Only terms specific to this project's domain. General programming concepts (timeout, retry, DTO, pagination) do not belong here, however heavily they are used.
- Add a term once it is settled, not before. An empty `Language` section is the correct state for a new project.
- Group terms under sub-headings once natural clusters emerge; a flat list is fine until then.

## Language

<!--
Replace with this project's actual terms. Example of the expected shape:

**Order**:
A purchase request submitted by a customer; the shared upstream of fulfillment and billing.
_Avoid_: Purchase, Transaction
-->
