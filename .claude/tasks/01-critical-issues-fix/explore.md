# Task: Critical Issues to Fix Before Merge

## Summary
4 critical issues identified requiring fixes before merge:
1. **Missing tests for Signup component** (412 lines, zero coverage)
2. **Missing tests for CurrencyInput component** (ui/ component, reused in budget flow)
3. **Magic number for password validation** (hardcoded `8` at line 320)
4. **Google OAuth code duplication** (3 identical implementations)

---

## Codebase Context

### Issue 1: Signup Component Tests

**File:** `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts`

#### Key Code to Test:

**passwordsMatchValidator (lines 29-45):**
```typescript
export function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const formGroup = control as FormGroup;
  const password = formGroup.get('password')?.value;
  const confirmPassword = formGroup.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null; // Validator inactive if fields empty
  }

  if (password !== confirmPassword) {
    formGroup.get('confirmPassword')?.setErrors({ passwordsMismatch: true });
    return { passwordsMismatch: true };
  }
  return null;
}
```

**signUp() method (lines 357-389):**
- Validates form before submission
- Sets `isSubmitting` signal to true
- Calls `authService.signUpWithEmail(email, password)`
- Handles success (navigates to app) and error (displays message)

**signUpWithGoogle() method (lines 391-411):**
- Sets `isSubmitting` signal to true
- Calls `authService.signInWithGoogle()`
- Handles success/failure with error display

#### Component State (Signal-based):
- `hidePassword = signal<boolean>(true)`
- `isSubmitting = signal<boolean>(false)`
- `errorMessage = signal<string>('')`
- `canSubmit = computed(() => formStatus() === 'VALID' && !isSubmitting())`

---

### Issue 2: CurrencyInput Component Tests

**File:** `frontend/projects/webapp/src/app/ui/currency-input/currency-input.ts`

#### Component API (lines 49-56):
```typescript
label = input.required<string>();          // Required label
value = model<number | null>(null);        // Two-way bindable value
placeholder = input<string>('0.00');       // Optional placeholder
required = input<boolean>(false);          // Required field indicator
testId = input<string>('currency-input');  // Test ID for testing
currency = input<string>('CHF');           // Currency code display
autoFocus = input<boolean>(true);          // Auto-focus behavior
```

#### Key Method (lines 66-70):
```typescript
onInput(event: Event): void {
  const value = parseFloat((event.target as HTMLInputElement).value);
  this.value.set(isNaN(value) ? null : value);
}
```

**Component characteristics:**
- Standalone component with OnPush change detection
- Uses `model()` for two-way binding (NOT ControlValueAccessor)
- Imports: FormsModule, MatFormFieldModule, MatInputModule

---

### Issue 3: Magic Number (Password Validation)

**File:** `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts:320`

**Current code:**
```typescript
validators: [Validators.required, Validators.minLength(8)],
```

**Fix:** Extract constant
```typescript
const PASSWORD_MIN_LENGTH = 8;
validators: [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
```

**Also found in:** `login.ts:204` - same magic number pattern

---

### Issue 4: Google OAuth Duplication

**Three identical implementations found:**

| File | Lines | Signal Name | Pattern |
|------|-------|-------------|---------|
| `welcome-page.ts` | 248-266 | `isGoogleLoading` | Set loading → call API → handle error → reset |
| `signup.ts` | 391-411 | `isSubmitting` | Set loading → call API → handle error → reset |
| `login.ts` | 270-290 | `isSubmitting` | Set loading → call API → handle error → reset |

**Common pattern (duplicated):**
```typescript
async signInWithGoogle() {
  this.loadingSignal.set(true);
  this.errorMessage.set('');
  try {
    const { success, error } = await this.#authService.signInWithGoogle();
    if (!success) {
      this.errorMessage.set(error ?? DEFAULT_ERROR);
      this.loadingSignal.set(false);
    }
  } catch (err) {
    this.#logger.error('Google OAuth error', err);
    this.errorMessage.set(DEFAULT_ERROR);
    this.loadingSignal.set(false);
  }
}
```

**Recommendation:** Extract to AuthApi service or create shared utility

---

## Documentation Insights

### Angular Testing with Vitest (Project Pattern)

From existing tests in the codebase:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';

describe('ComponentName', () => {
  let fixture: ComponentFixture<Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Component],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(Component);
  });
});
```

### Signal Testing Pattern

```typescript
// Test signal values
expect(component.count()).toBe(0);

// Update signals
component.count.set(5);
fixture.detectChanges();

// Flush effects if needed
TestBed.flushEffects();
```

### Custom Validator Testing

```typescript
describe('passwordsMatchValidator', () => {
  it('should return null when passwords match', () => {
    const form = new FormGroup({
      password: new FormControl('password123'),
      confirmPassword: new FormControl('password123'),
    }, { validators: passwordsMatchValidator });

    expect(form.hasError('passwordsMismatch')).toBe(false);
  });

  it('should return error when passwords do not match', () => {
    const form = new FormGroup({
      password: new FormControl('password123'),
      confirmPassword: new FormControl('different'),
    }, { validators: passwordsMatchValidator });

    expect(form.hasError('passwordsMismatch')).toBe(true);
  });
});
```

### Mocking Services

```typescript
const mockAuthService: Partial<AuthApi> = {
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
};

TestBed.configureTestingModule({
  providers: [{ provide: AuthApi, useValue: mockAuthService }],
});
```

---

## Research Findings

### OAuth Abstraction Best Practice

**Centralized Service Pattern (Recommended):**
- All OAuth logic lives in single AuthApi service (already exists!)
- Components should NOT duplicate OAuth flow logic
- Service returns `{ success: boolean; error?: string }`

**Signal-Based State (Current pattern):**
```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private isLoadingSignal = signal(false);
  isLoading = this.isLoadingSignal.asReadonly();

  async signInWithGoogle() {
    this.isLoadingSignal.set(true);
    // ... OAuth flow
  }
}
```

**Recommendation for DRY:**
Option A: Move loading state to AuthApi service
Option B: Create reusable OAuth button component
Option C: Create utility function for error handling

---

## Key Files

| Purpose | Path | Lines |
|---------|------|-------|
| Signup component | `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts` | 412 |
| CurrencyInput | `frontend/projects/webapp/src/app/ui/currency-input/currency-input.ts` | 71 |
| Login component | `frontend/projects/webapp/src/app/feature/auth/login/login.ts` | 290+ |
| Welcome page | `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts` | 266+ |
| Auth service | `frontend/projects/webapp/src/app/core/auth/auth-api.ts` | 269+ |
| Test utilities | `frontend/projects/webapp/src/app/core/testing/test-utils.ts` | 32 |

### Example Test Files (Reference)
- `auth-error-localizer.spec.ts` - Simple service test
- `has-budget.guard.spec.ts` - Guard test with mocking
- `demo-mode.service.spec.ts` - Signal-based service test
- `breadcrumb.spec.ts` - Component test with signal inputs
- `edit-transaction-form.spec.ts` - Form validation tests
- `recurrence-label.pipe.spec.ts` - Pipe test (no TestBed)

---

## Patterns to Follow

### Test File Naming
- `{component-name}.spec.ts` in same directory

### Test Structure (AAA Pattern)
```typescript
it('should do something', () => {
  // Arrange
  const input = 'test';

  // Act
  const result = service.method(input);

  // Assert
  expect(result).toBe('expected');
});
```

### Mocking Pattern
```typescript
const mockService = {
  method: vi.fn().mockResolvedValue({ success: true }),
};
```

### Signal Testing
- Use `provideZonelessChangeDetection()` in providers
- Call `TestBed.flushEffects()` for effect testing
- Access signal values with `component.signalName()`

---

## Dependencies

### For Signup Tests
- `@angular/core/testing` (TestBed)
- `vitest` (describe, it, expect, vi)
- `@angular/forms` (FormGroup, FormControl)
- Mock: AuthApi, Router, Logger

### For CurrencyInput Tests
- `@angular/core/testing` (TestBed)
- `vitest` (describe, it, expect)
- `@angular/material/input` (optional if testing DOM)

---

## Implementation Notes

### Magic Number Fix
Simple extraction - create constant at top of file or in shared constants file.

### OAuth Duplication Fix Options
1. **Service Enhancement**: Add loading state to AuthApi service
2. **Shared Utility**: Create `handleGoogleOAuth(service, loadingSignal, errorSignal)` utility
3. **Component**: Create `<app-google-oauth-button>` reusable component

### Test Coverage Goals
- `passwordsMatchValidator`: 3+ test cases
- `signUp()`: success path, error path, validation failure
- `signUpWithGoogle()`: success path, error path
- `CurrencyInput`: input parsing, value binding, required validation

---

## Next Step

Run `/epct:plan .claude/tasks/01-critical-issues-fix` to create implementation plan.
