# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
pnpm start                  # ng serve --open (localhost:4200)
pnpm dev                    # ng serve with 0.0.0.0 host
```

### Testing
```bash
pnpm test                   # Vitest run
pnpm test:watch             # Vitest watch mode
pnpm test:e2e               # Playwright tests
pnpm test:e2e:ui            # Playwright interactive mode
pnpm test:e2e:debug         # Playwright debug mode
```

### Quality
```bash
pnpm lint                   # ESLint
pnpm format                 # Prettier
pnpm deps:circular          # Check circular dependencies (madge)
```

### Analysis
```bash
pnpm analyze                # Bundle analyzer
pnpm analyze:deps           # Dependency graph visualization
```

## Architecture

### 5-Layer Structure

Located in `projects/webapp/src/app/`:

| Layer | Content | Loading | Can Import From |
|-------|---------|---------|-----------------|
| `core/` | Services, guards, interceptors (headless only) | Eager | core, shared |
| `layout/` | App shell, navigation components | Eager | core, ui, pattern |
| `ui/` | Generic reusable components (inputs/outputs only) | Cherry-picked | ui, shared |
| `pattern/` | Stateful reusable components bound to services | Imported | core, ui, pattern |
| `feature/` | Business domains (complete isolation) | Lazy | core, ui, pattern, own sub-features |

### Key Rules

**Features are isolated "black boxes"**:
- Features CANNOT import from sibling features
- All features must be lazy-loaded via `loadChildren`
- Provide services at feature level in routes config (not in root)

**Extraction rule**: When logic needs sharing between features, extract to `core/` (services), `ui/` (generic components), or `pattern/` (stateful components). Wait for 3+ occurrences before abstracting.

**Domain-based organization**: Group by domain (`core/auth/`, `core/budget/`), not by type (avoid `core/services/`).

### Architecture Enforcement

ESLint with `eslint-plugin-boundaries` enforces dependency rules. Run `pnpm lint` to verify.

## Angular Patterns

### Signals & State
```typescript
// Single private signal for state
private readonly state = signal<State>(initialState);

// Public read-only computed selectors
readonly data = computed(() => this.state().data);

// Immutable updates only
this.state.update(s => ({ ...s, data: newData }));
```

### Components
- All components are standalone (no NgModules)
- Use `input()`, `output()`, `computed()` signals
- OnPush change detection everywhere
- Inline templates/styles for small components
- No template functions - use `computed()` instead

### Services
- `providedIn: 'root'` only for core services
- Feature-specific services provided in routes config

## File Naming

Angular v20 style - no class suffixes required:
- `auth.service.ts` with class `AuthService`
- `main-layout.ts` with class `MainLayout`
- `budget.routes.ts` for routing

## Critical Rules
- **NEVER** use `::ng-deep` in styles
- Use Angular Material v20 button syntax: `matButton="filled"`, `matButton="outlined"`, etc.
