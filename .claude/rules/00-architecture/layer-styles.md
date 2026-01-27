---
description: "Styles layer - Design system foundation"
paths: "frontend/**/styles/**/*"
---

# Styles Layer

**Scope**: Styles layer - Design system foundation

**Note**: This is an **optional layer** for projects implementing centralized design systems. Not all projects require a `styles/` dependency layer—use it only if your project centralizes design tokens, theming, or shared CSS utilities across multiple layers.

## Quick Rules

- Single source of truth for design tokens
- Angular Material + Tailwind architecture
- CSS layers order: `theme → base → utilities`
- **Can be imported by**: `core/`, `layout/`, `pattern/`, `feature/`

## Dependency Rules

```
core/    ──✅──> styles/
layout/  ──✅──> styles/
pattern/ ──✅──> styles/
feature/ ──✅──> styles/
ui/      ──❌──> styles/  (UI is self-styled)

styles/  ──✅──> (nothing - base layer)
```

## Architecture

```
styles/
├── design-tokens.ts         → Token definitions
├── main.scss                → Entry point
└── _tailwind-*.scss         → Tailwind utilities
```

## Design Tokens

All tokens defined centrally:
- Colors (semantic: primary, surface, etc.)
- Spacing, sizing
- Typography
- Border radius, shadows

## When to Use `styles/` as a Dependency Layer

Use when your project has:
- **Centralized design system**
- **Global design tokens** (project brand)
- **Tailwind utilities** (shared CSS classes)
- **Theme configuration** (runtime theming)

Therefore, `styles/` acts as a **foundation layer** that can be imported by all other layers (except `ui/` which is self-contained).

## Detailed Documentation

**For complete guide**: See `06-templates-and-models/design-system.md`

**Layer notes**: Implement according to your project's design system requirements
