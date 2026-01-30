---
description: "Guidelines for documenting technical decisions"
paths: "memory-bank/techContext.md"
---

# Tech Context Guidelines

## Structure

- Most recent entries at top (descending chronological order)
- Each entry starts with `## YYYY-MM-DD: Title`

## Content Focus

- Document **why** decisions were made, not how to implement
- Include technical validation sources (links)
- Use tables for compact decision summaries
- Avoid implementation details (those belong in plan files or code comments)

## Code Cross-References

When a Decision Record impacts code, add a short comment referencing the DR in the impacted file(s):

```typescript
// Imperative signal chosen over linkedSignal/computed — see DR-008 in memory-bank/techContext.md
readonly #staleData = signal<T | null>(null);
```

- One comment per DR per file (at the most relevant location)
- Format: `— see DR-XXX in memory-bank/techContext.md`
- Keep it minimal — the comment should explain **what** pattern, the DR explains **why**

## Entry Template

```markdown
## YYYY-MM-DD: Decision Title

### Context
One-liner explaining what triggered this decision.

### Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|

### Sources (if applicable)
- [Link](url)
```
