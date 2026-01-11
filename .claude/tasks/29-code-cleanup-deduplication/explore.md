# Task: Code Cleanup & Deduplication

## Summary

This task addresses 4 code quality issues:
1. Remove superfluous JSDoc comments (project prefers self-documenting code)
2. Create reusable `ErrorAlert` component (duplicated in 4 files)
3. Create reusable `LoadingButton` component (duplicated in 4 files)
4. Standardize form creation pattern to `FormBuilder` (inconsistent usage)

---

## Codebase Context

### 1. JSDoc Comments to Remove

| File | Lines | Content |
|------|-------|---------|
| `core/auth/has-budget.guard.ts` | 9-15 | Guard explanation comment |
| `core/profile/profile-setup.service.ts` | 18-21, 32-35 | Service and method explanations |
| `core/profile/profile-setup.types.ts` | 1-4, 14-16 | Interface explanations |
| `feature/complete-profile/complete-profile-store.ts` | 45, 68 | Section markers ("// Public selectors", "// Actions") |

### 2. Error Template Duplication (4 files)

**Pattern found** (same across all files):
```html
@if (errorMessage()) {
  <div class="flex items-center gap-2 bg-error-container text-on-error-container p-4 rounded-lg">
    <mat-icon>error_outline</mat-icon>
    <span>{{ errorMessage() }}</span>
  </div>
}
```

**Files with duplicated error template:**
- `feature/welcome/welcome-page.ts:149-156`
- `feature/auth/signup/signup.ts:229-236`
- `feature/auth/login/login.ts:120-127`
- `feature/complete-profile/complete-profile-page.ts:169-176`

**Note:** An `ErrorCard` component already exists at `ui/error-card.ts` but uses `mat-card` styling. The inline pattern uses Tailwind classes.

### 3. Loading Button Duplication (4 files)

**Pattern found:**
```html
<button matButton="filled" [disabled]="isSubmitting()">
  @if (isSubmitting()) {
    <mat-progress-spinner diameter="20" mode="indeterminate" />
    <span>en cours...</span>
  } @else {
    <span>Submit Label</span>
  }
</button>
```

**Files with duplicated loading button:**
- `feature/auth/signup/signup.ts:246-263`
- `feature/auth/login/login.ts:137-154`
- `feature/complete-profile/complete-profile-page.ts:152-164`
- `feature/welcome/welcome-page.ts:130-147` (demo button variant)

**Note:** `GoogleOAuthButton` at `pattern/google-oauth/google-oauth-button.ts:54-64` shows the proper encapsulation pattern.

### 4. Form Creation Inconsistency

**signup.ts (lines 307-330)** - Uses `new FormGroup()` directly:
```typescript
readonly signupForm = new FormGroup({
  email: new FormControl('', {
    validators: [Validators.required, Validators.email],
    nonNullable: true,
  }),
  password: new FormControl('', {
    validators: [Validators.required, Validators.minLength(8)],
    nonNullable: true,
  }),
});
```

**login.ts (lines 196-202)** - Uses `FormBuilder`:
```typescript
private fb = inject(FormBuilder);

readonly loginForm = this.fb.nonNullable.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(8)]],
});
```

---

## Documentation Insights

### Angular 21 Best Practices (from MCP)

1. **Always use standalone components** - No NgModules
2. **Use `input()` and `output()` functions** - Not `@Input/@Output` decorators
3. **Use signals for state management** - `signal()`, `computed()`, `effect()`
4. **Set `changeDetection: ChangeDetectionStrategy.OnPush`** - Always
5. **Prefer Reactive Forms over Template-driven**
6. **Use native control flow** - `@if`, `@for`, `@switch`

### FormBuilder Best Practice (from Context7)

**Recommended pattern:** Use `NonNullableFormBuilder` via `fb.nonNullable.group()`:
```typescript
private fb = inject(FormBuilder);

// Cleaner - all controls are non-nullable by default
readonly form = this.fb.nonNullable.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(8)]],
});
```

**Benefits:**
- Less boilerplate than `new FormGroup()` with `{nonNullable: true}` on each control
- Type-safe with TypeScript strict mode
- Values default to initial value on reset (not null)

### UI Component Conventions (from `ui/README.md`)

**Core characteristics:**
- Stateless and pure
- Generic and presentational
- Standalone (no NgModules)
- Decoupled from business logic

**When to create UI components:**
- 3+ occurrences of same pattern
- Generic presentation logic

**Dependency rules:**
- Can import from `ui/`
- Cannot import from `core/`, `feature/`, `pattern/`, `layout/`

---

## Research Findings

### Loading Button Patterns (2025)

**Directive approach** (recommended for Angular Material):
```typescript
@Directive({
  selector: 'button[matButton][appLoading]',
  standalone: true,
})
export class LoadingButtonDirective {
  appLoading = input(false);
  // ...
}
```

**Component approach** (simpler, recommended for this project):
```typescript
@Component({
  selector: 'pulpe-loading-button',
  template: `
    <button [matButton]="variant()" [disabled]="loading() || disabled()">
      @if (loading()) {
        <mat-progress-spinner diameter="20" mode="indeterminate" />
        <span>{{ loadingText() }}</span>
      } @else {
        <ng-content />
      }
    </button>
  `,
})
export class LoadingButton {
  loading = input(false);
  disabled = input(false);
  variant = input<'filled' | 'outlined' | ''>('filled');
  loadingText = input('en cours...');
}
```

### Error Alert Patterns (2025)

**Simple inline component** (matches existing Tailwind pattern):
```typescript
@Component({
  selector: 'pulpe-error-alert',
  template: `
    @if (message()) {
      <div class="flex items-center gap-2 bg-error-container text-on-error-container p-4 rounded-lg" role="alert">
        <mat-icon>error_outline</mat-icon>
        <span>{{ message() }}</span>
      </div>
    }
  `,
})
export class ErrorAlert {
  message = input<string | null>(null);
}
```

---

## Key Files

### Files to Modify (JSDoc removal)
- `frontend/projects/webapp/src/app/core/auth/has-budget.guard.ts:9-15`
- `frontend/projects/webapp/src/app/core/profile/profile-setup.service.ts:18-21,32-35`
- `frontend/projects/webapp/src/app/core/profile/profile-setup.types.ts:1-4,14-16`
- `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts:45,68`

### Files to Modify (Error template → ErrorAlert)
- `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts:149-156`
- `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts:229-236`
- `frontend/projects/webapp/src/app/feature/auth/login/login.ts:120-127`
- `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts:169-176`

### Files to Modify (Loading button → LoadingButton)
- `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts:246-263`
- `frontend/projects/webapp/src/app/feature/auth/login/login.ts:137-154`
- `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts:152-164`
- `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts:130-147`

### Files to Modify (FormBuilder standardization)
- `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts:307-330`

### New Files to Create
- `frontend/projects/webapp/src/app/ui/error-alert/error-alert.ts`
- `frontend/projects/webapp/src/app/ui/error-alert/error-alert.spec.ts`
- `frontend/projects/webapp/src/app/ui/error-alert/index.ts`
- `frontend/projects/webapp/src/app/ui/loading-button/loading-button.ts`
- `frontend/projects/webapp/src/app/ui/loading-button/loading-button.spec.ts`
- `frontend/projects/webapp/src/app/ui/loading-button/index.ts`

### Reference Files (existing patterns)
- `frontend/projects/webapp/src/app/ui/currency-input/currency-input.ts` - UI component conventions
- `frontend/projects/webapp/src/app/ui/error-card.ts` - Existing error component (mat-card variant)
- `frontend/projects/webapp/src/app/pattern/google-oauth/google-oauth-button.ts` - Loading button pattern reference

---

## Patterns to Follow

### UI Component Structure
```
ui/
├── error-alert/
│   ├── error-alert.ts          # Component
│   ├── error-alert.spec.ts     # Tests
│   └── index.ts                # Public API
├── loading-button/
│   ├── loading-button.ts
│   ├── loading-button.spec.ts
│   └── index.ts
```

### Component Naming
- Selector: `pulpe-<component-name>` (e.g., `pulpe-error-alert`)
- Class: PascalCase (e.g., `ErrorAlert`)
- File: kebab-case (e.g., `error-alert.ts`)

### Signal-Based Inputs
```typescript
message = input<string | null>(null);    // Optional with default
loading = input.required<boolean>();      // Required
variant = input<'filled' | 'outlined'>('filled'); // With default
```

### Testing Pattern (Vitest)
```typescript
describe('ErrorAlert', () => {
  let fixture: ComponentFixture<ErrorAlert>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorAlert],
    }).compileComponents();
    fixture = TestBed.createComponent(ErrorAlert);
  });

  it('should display error message when provided', () => {
    fixture.componentRef.setInput('message', 'Test error');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Test error');
  });

  it('should not render when message is null', () => {
    fixture.componentRef.setInput('message', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});
```

---

## Dependencies

### Required Imports for New Components

**ErrorAlert:**
- `@angular/core` (Component, ChangeDetectionStrategy, input)
- `@angular/material/icon` (MatIcon)

**LoadingButton:**
- `@angular/core` (Component, ChangeDetectionStrategy, input)
- `@angular/material/button` (MatButton)
- `@angular/material/progress-spinner` (MatProgressSpinner)

### No New Dependencies Required
All required packages are already installed in the project.

---

## Concerns & Blockers

### None Identified

The task is straightforward refactoring with clear patterns to follow.

### Decisions Made
1. **ErrorAlert vs ErrorCard**: Create new `ErrorAlert` component using Tailwind inline pattern (not mat-card)
2. **LoadingButton approach**: Create component (not directive) for simplicity
3. **Form standardization**: Use `FormBuilder.nonNullable.group()` pattern

---

## Next Step

Run `/epct:plan 29-code-cleanup-deduplication` to create the implementation plan.
