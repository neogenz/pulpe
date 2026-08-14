# Frontend Developer Memory

## Signal Input Testing (Vitest + Zoneless)

`fixture.componentRef.setInput()` silently fails to update signal inputs in this project's Vitest + zoneless setup (Angular issue #54039). Use the project's `setTestInput()` utility from `@app/testing/signal-test-utils` instead.

```typescript
import { setTestInput } from '@app/testing/signal-test-utils';

setTestInput(component.someInput, value);
TestBed.flushEffects(); // flush effects after setting inputs
```

This uses Angular's internal `SIGNAL` primitives to directly write to the underlying signal.

## Reactive Forms: valueChanges Timing with Form Group Validity

When subscribing to a **control's** `valueChanges` and then checking the **parent form group's** `valid` property inside the subscription, the form group status may not yet be recalculated. Angular updates control validity first, then emits `valueChanges`, then recalculates parent form group validity.

**Fix:** Call `this.form.updateValueAndValidity({ emitEvent: false })` before checking `this.form.valid` in the subscription callback. The `emitEvent: false` prevents infinite loops from re-triggering `valueChanges`.

This was encountered in the auto-submit pattern on `enter-vault-code.ts`.

## Signal Forms: `FieldTree` leaf access is `control()().value()`, not `control().value()`

A reusable component that takes a signal-forms field as `readonly control = input.required<FieldTree<T>>()` (the pattern `pulpe-amount-input` and `pulpe-tag-picker` use, bound with `[control]="form.someField"`) must **invoke the field to get its `FieldState` before reading `.value`**:

```typescript
// read  — control() is the FieldTree; call it to get FieldState, then value()
this.control()().value();          // ✅ leaf field
this.control().child().value();    // ✅ nested field (amount-input does this)
// write
this.control()().value.set(next);
```

**Gotcha:** `tsc --noEmit` accepts `this.control().value()` (the `FieldTree<T>` type surface exposes `.value`), but at **runtime** the proxy only exposes `.value` on the invoked `FieldState`, so `this.control().value()` throws `TypeError: ...value is not a function`. Types will NOT catch this — only a rendered unit test will.

Also: reading a **required** `control` input inside a `computed` that runs during view init throws NG0950. Wrap it in a `#safeControl` computed with a `try/catch` that returns `null` on `NG0950` (copied from `amount-input`), and derive `selectedIds`/etc. from `#safeControl()`.

To test such a component, build the field via `TestBed.runInInjectionContext(() => form(model))` (signal-forms `form()` calls `inject()`), then `setTestInput(component.control, testForm.someField)`.
