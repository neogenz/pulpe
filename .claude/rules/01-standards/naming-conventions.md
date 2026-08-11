---
description: Naming conventions for variables, functions, and constants
paths:
  - "**/*.ts"
---

# Naming Conventions

Standard TypeScript naming applies as written. What is worth stating is only what a
reviewer here actually flags:

| Element | Convention | Example |
|---------|------------|---------|
| Functions (actions) | `verbNoun` | `fetchUsers()` |
| Functions (getters) | `noun` | `userName()` |
| Booleans, both functions and signals | `is` / `has` / `should` / `can` prefix | `isLoading`, `hasPermission()` |
| Collections | plural | `users`, `items` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Related constants | one `as const` object, never scattered exports | `HttpStatus.OK` |

The two that get missed most: a signal holding an array is plural
(`#users = signal<User[]>([])`, not `#user`), and a boolean signal keeps its prefix
(`isLoading = signal(false)`, not `loading`) — dropping it reads as the thing itself rather
than a predicate about it.
