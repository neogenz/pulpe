# Frontend Developer Memory

## Signal Input Testing (Vitest + Zoneless)

`fixture.componentRef.setInput()` silently fails to update signal inputs in this project's Vitest + zoneless setup (Angular issue #54039). Use the project's `setTestInput()` utility from `@app/testing/signal-test-utils` instead.

```typescript
import { setTestInput } from '@app/testing/signal-test-utils';

setTestInput(component.someInput, value);
TestBed.flushEffects(); // flush effects after setting inputs
```

This uses Angular's internal `SIGNAL` primitives to directly write to the underlying signal.

## UI Layer & `feature/*/ui/` Boundaries

- **UI layer** (`ui/`): NEVER inject services. Inputs/outputs only.
- **`feature/*/ui/` subdirectories** are enforced by the linter as UI-like components too -- no `inject()` allowed. Use `input()` and have parent feature components pass values down.
- The `boundaries/element-types` ESLint rule catches violations. If a pipe or component in `ui/` needs data from a core service, the caller must inject the service and pass the value as a parameter/input.
- The linter auto-fixes `feature/*/ui/` violations by converting `inject()` calls to `input()` declarations, which is the correct pattern.

## AmountsVisibilityService Pattern

For hiding sensitive financial amounts:
- `AmountsVisibilityService` lives in `core/amounts-visibility/` (`providedIn: 'root'`)
- `SensitiveAmountPipe` is pure, takes `isHidden` parameter: `| sensitiveAmount: amountsHidden()`
- Feature components inject the service and expose `amountsHidden` signal
- UI components receive `amountsHidden` via `input(false)` from parent
