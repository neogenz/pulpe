# Frontend CLAUDE.md

## Commands

```bash
pnpm start                  # ng serve --open (localhost:4200)
pnpm test:watch             # Vitest watch mode
pnpm test:e2e:ui            # Playwright interactive mode
pnpm lint                   # ESLint
pnpm deps:circular          # Check circular dependencies
```

## 5-Layer Architecture

Located in `projects/webapp/src/app/`:

| Layer | Content | Loading | Can Import From |
|-------|---------|---------|-----------------|
| `core/` | Services, guards, interceptors | Eager | core |
| `layout/` | App shell, navigation | Eager | core, ui, pattern |
| `ui/` | Generic reusable components | Cherry-picked | ui |
| `pattern/` | Stateful components bound to services | Imported | core, ui, pattern |
| `feature/` | Business domains (isolated) | Lazy | core, ui, pattern |

**Key rules**:
- Features CANNOT import from sibling features
- All features lazy-loaded via `loadChildren`
- Group by domain (`core/auth/`), not by type
- ESLint enforces dependency rules

## Angular Patterns

### Signals & State
```typescript
private readonly state = signal<State>(initialState);
readonly data = computed(() => this.state().data);
this.state.update(s => ({ ...s, data: newData }));
```

### Components
- All standalone (no NgModules)
- Use `input()`, `output()`, `computed()` signals
- OnPush change detection everywhere
- No template functions - use `computed()` instead

### Services
- `providedIn: 'root'` only for core services
- Feature-specific services provided in routes config

## File Naming (Angular v20)

- `auth.service.ts` → class `AuthService`
- `main-layout.ts` → class `MainLayout`

## Critical Rules

- **NEVER** use `::ng-deep` in styles
- Use Angular Material v20 button syntax: `matButton="filled"`, `matButton="outlined"`
