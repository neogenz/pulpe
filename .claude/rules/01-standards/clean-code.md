---
description: Project-specific simplicity rules not enforced by tooling
paths:
  - "**/*.ts"
---

# Simplicity

- Prefer the smallest change that preserves the existing architecture.
- Extract duplicated code only when it contains branching or computation, or is likely to diverge. Repeated trivial expressions are cheaper than a premature helper.
- Comments explain non-obvious intent, constraints, or trade-offs. Do not ban useful comments or narrate obvious code.
- Split a boolean flag into separate operations only when the flag hides genuinely different behaviours.
- ESLint owns backend length limits. Do not invent file or folder thresholds that no tool enforces.
