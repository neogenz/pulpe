# Frontend Developer Memory

## Signal Input Testing (Vitest + Zoneless)

`fixture.componentRef.setInput()` silently fails to update signal inputs in this project's Vitest + zoneless setup (Angular issue #54039). Use the project's `setTestInput()` utility from `@app/testing/signal-test-utils` instead.

```typescript
import { setTestInput } from '@app/testing/signal-test-utils';

setTestInput(component.someInput, value);
TestBed.flushEffects(); // flush effects after setting inputs
```

This uses Angular's internal `SIGNAL` primitives to directly write to the underlying signal.
