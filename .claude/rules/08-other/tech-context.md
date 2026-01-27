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
