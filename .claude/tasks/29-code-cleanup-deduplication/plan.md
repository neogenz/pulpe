# Implementation Plan: Code Cleanup & Deduplication

## Overview

This plan addresses 4 code quality issues in the authentication flow:
1. Remove superfluous JSDoc comments (4 files)
2. Create `ErrorAlert` UI component to replace duplicated error templates (4 files)
3. Create `LoadingButton` UI component to replace duplicated button patterns (4 files)
4. Standardize form creation to `FormBuilder.nonNullable.group()` (1 file)

**Approach:** Create new UI components first, then update feature files to use them.

---

## Dependencies

**Execution Order:**
1. Phase 1: Create new UI components (no dependencies)
2. Phase 2: Update feature files (depends on Phase 1)
3. Phase 3: Remove JSDoc comments (independent)

**No new npm packages required** - all imports already available.

---

## Phase 1: Create UI Components

### `frontend/projects/webapp/src/app/ui/error-alert/error-alert.ts`

**Create new file** with:
- Component selector: `pulpe-error-alert`
- ChangeDetection: OnPush
- Single input: `message = input<string | null>(null)`
- Template: Tailwind-styled error box with mat-icon (follow pattern from `signup.ts:229-236`)
- Include `role="alert"` for accessibility
- Styling: `bg-error-container text-on-error-container p-3 rounded-lg flex items-center gap-2`
- Import: `MatIcon` from `@angular/material/icon`

### `frontend/projects/webapp/src/app/ui/error-alert/error-alert.spec.ts`

**Create new file** with tests for:
- Should display message when provided
- Should not render when message is null
- Should not render when message is empty string
- Should have role="alert" for accessibility
- Follow testing pattern from `ui/currency-input/currency-input.spec.ts`

### `frontend/projects/webapp/src/app/ui/error-alert/index.ts`

**Create new file** exporting:
- `ErrorAlert` component

---

### `frontend/projects/webapp/src/app/ui/loading-button/loading-button.ts`

**Create new file** with:
- Component selector: `pulpe-loading-button`
- ChangeDetection: OnPush
- Inputs:
  - `loading = input(false)` - Shows spinner when true
  - `disabled = input(false)` - Additional disabled state
  - `variant = input<'filled' | 'outlined' | ''>('filled')` - Button style
  - `color = input<'primary' | 'accent' | 'warn'>('primary')` - Material color
  - `type = input<'button' | 'submit'>('submit')` - Button type
  - `loadingText = input('en cours...')` - Text during loading
  - `icon = input<string>()` - Optional icon name
  - `testId = input<string>()` - data-testid attribute
  - `fullWidth = input(true)` - Apply w-full class
- Template:
  - Button with `[matButton]="variant()"` and `[color]="color()"`
  - Loading state: spinner + loadingText
  - Normal state: optional icon + `<ng-content />` for label
- Follow pattern from `signup.ts:238-263` but make configurable
- Imports: `MatButtonModule`, `MatProgressSpinnerModule`, `MatIconModule`

### `frontend/projects/webapp/src/app/ui/loading-button/loading-button.spec.ts`

**Create new file** with tests for:
- Should render normal content when not loading
- Should render spinner and loading text when loading
- Should be disabled when loading
- Should be disabled when disabled input is true
- Should render icon when provided
- Should apply correct variant class
- Should apply correct color
- Should have correct type attribute
- Should have data-testid when provided

### `frontend/projects/webapp/src/app/ui/loading-button/index.ts`

**Create new file** exporting:
- `LoadingButton` component

---

## Phase 2: Update Feature Files

### `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts`

**Modifications:**

1. **Add imports:**
   - Add `ErrorAlert` from `@ui/error-alert`
   - Add `LoadingButton` from `@ui/loading-button`
   - Add `FormBuilder` from `@angular/forms`
   - Remove `FormControl`, `FormGroup` imports (no longer needed directly)
   - Remove `MatProgressSpinnerModule` from imports array (now in LoadingButton)

2. **Update imports array:**
   - Add `ErrorAlert`
   - Add `LoadingButton`
   - Remove `MatProgressSpinnerModule`

3. **Replace error template (lines 229-236):**
   - Replace inline error div with `<pulpe-error-alert [message]="errorMessage()" />`

4. **Replace loading button (lines 238-263):**
   - Replace inline button with:
   ```html
   <pulpe-loading-button
     [loading]="isSubmitting()"
     [disabled]="!canSubmit()"
     loadingText="Création en cours..."
     icon="person_add"
     testId="signup-submit-button"
   >
     <span class="ml-2">Créer mon compte</span>
   </pulpe-loading-button>
   ```

5. **Refactor form to FormBuilder (lines 307-330):**
   - Inject FormBuilder: `readonly #formBuilder = inject(FormBuilder);`
   - Replace `new FormGroup({ ... })` with `this.#formBuilder.nonNullable.group({ ... })`
   - Simplify control definitions to array syntax
   - Keep `passwordsMatchValidator` as group validator

---

### `frontend/projects/webapp/src/app/feature/auth/login/login.ts`

**Modifications:**

1. **Add imports:**
   - Add `ErrorAlert` from `@ui/error-alert`
   - Add `LoadingButton` from `@ui/loading-button`
   - Remove `MatProgressSpinnerModule` from imports array

2. **Update imports array:**
   - Add `ErrorAlert`
   - Add `LoadingButton`
   - Remove `MatProgressSpinnerModule`

3. **Replace error template (lines 120-127):**
   - Replace inline error div with `<pulpe-error-alert [message]="errorMessage()" />`

4. **Replace loading button (lines 129-154):**
   - Replace inline button with:
   ```html
   <pulpe-loading-button
     [loading]="isSubmitting()"
     [disabled]="!canSubmit()"
     loadingText="Connexion en cours..."
     icon="login"
     testId="login-submit-button"
   >
     <span class="ml-2">Se connecter</span>
   </pulpe-loading-button>
   ```

5. **Standardize form to nonNullable (line 196-202):**
   - Change `this.#formBuilder.group({...})` to `this.#formBuilder.nonNullable.group({...})`
   - This ensures type-safe non-nullable form values

---

### `frontend/projects/webapp/src/app/feature/welcome/welcome-page.ts`

**Modifications:**

1. **Add imports:**
   - Add `ErrorAlert` from `@ui/error-alert`
   - Add `LoadingButton` from `@ui/loading-button` (if demo button uses same pattern)

2. **Update imports array:**
   - Add `ErrorAlert`
   - Add `LoadingButton` (if applicable)
   - Remove `MatProgressSpinnerModule` if no longer needed

3. **Replace error template (lines 149-156):**
   - Replace inline error div with `<pulpe-error-alert [message]="errorMessage()" />`

4. **Replace loading button (lines 130-147):**
   - If demo button follows same pattern, replace with LoadingButton
   - Customize inputs for demo mode label and loading text

---

### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts`

**Modifications:**

1. **Add imports:**
   - Add `ErrorAlert` from `@ui/error-alert`
   - Add `LoadingButton` from `@ui/loading-button`

2. **Update imports array:**
   - Add `ErrorAlert`
   - Add `LoadingButton`
   - Remove `MatProgressSpinnerModule` if no longer needed

3. **Replace error template (lines 169-176):**
   - Replace inline error div with `<pulpe-error-alert [message]="store.errorMessage()" />`
   - Note: This uses store.errorMessage() instead of errorMessage()

4. **Replace loading button (lines 152-164):**
   - Replace inline button with LoadingButton component
   - Use store's loading state

---

## Phase 3: Remove JSDoc Comments

### `frontend/projects/webapp/src/app/core/auth/has-budget.guard.ts`

**Remove lines 9-15:**
- Delete the JSDoc comment block explaining the guard
- The code is self-explanatory with good naming

---

### `frontend/projects/webapp/src/app/core/profile/profile-setup.service.ts`

**Remove:**
- Lines 18-21: JSDoc comment for service class
- Lines 32-35: JSDoc comment for createInitialBudget method
- The code and naming are self-documenting

---

### `frontend/projects/webapp/src/app/core/profile/profile-setup.types.ts`

**Remove:**
- Lines 1-4: JSDoc comment for ProfileData interface
- Lines 14-16: JSDoc comment for ProfileSetupResult interface
- Interface names and properties are self-explanatory

---

### `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-store.ts`

**Remove:**
- Line 45: `// Public selectors` section comment
- Line 68: `// Actions` section comment
- These are organizational comments that add no value

---

## Testing Strategy

### New Tests to Create

1. `ui/error-alert/error-alert.spec.ts` - Component tests
2. `ui/loading-button/loading-button.spec.ts` - Component tests

### Existing Tests to Verify

After changes, run:
```bash
cd frontend && pnpm test
```

Verify these test files still pass:
- `feature/auth/signup/signup.spec.ts` (if exists)
- `feature/auth/login/login.spec.ts` (if exists)
- `feature/welcome/welcome-page.spec.ts`
- `feature/complete-profile/complete-profile-page.spec.ts` (if exists)

### Manual Verification

1. Navigate to `/welcome` - verify error display and button loading work
2. Navigate to `/signup` - test form validation, error display, submit loading
3. Navigate to `/login` - test form validation, error display, submit loading
4. Navigate to `/complete-profile` - verify error and loading states

---

## Documentation

No documentation updates required. The new components follow existing UI conventions.

---

## Rollout Considerations

**No breaking changes** - This is an internal refactor.

**No feature flags needed** - Changes are purely structural.

**No migration steps** - Direct replacement of inline code with components.

---

## Quality Checklist

Before marking complete:
- [ ] `pnpm quality` passes (type-check + lint + format)
- [ ] `pnpm test` passes (all unit tests)
- [ ] Manual testing of all 4 pages
- [ ] New components have comprehensive tests
- [ ] No TypeScript errors
- [ ] No console errors in browser

---

## Next Step

Run `/epct:code 29-code-cleanup-deduplication` to execute this plan.
