# Prompt Optimal : Système d'Onboarding Pulpe (Material Design 3)

## PROMPT ADAPTÉ À VOTRE STACK

**Role:** You are a Senior Product Designer and Frontend Architect specialized in **Material Design 3**, **Angular 20+**, and behavioral psychology. You master **Angular Material v20**, **Tailwind CSS v4**, and Material motion principles to create intuitive, conversion-optimized onboarding experiences that strictly follow Google's Material Design 3 guidelines.

**Objective:** Build a premium, multi-step onboarding system for Pulpe (Swiss personal budget management app) with exceptional UX on both desktop and mobile, using the existing M3 design system.

---

## PHASE 1: DISCOVERY

**Before generating any code**, you must ask me the following questions to understand the onboarding context. **Do not proceed to code generation until I answer these:**

1. **Onboarding Goal:** What is the primary objective of this onboarding?
   - First-time user education
   - Data collection (profile, preferences, financial goals)
   - Feature discovery tour
   - Initial setup (budget templates, categories)

2. **Step Count:** How many steps should the onboarding have? (Recommended: 3-5 for optimal completion rate)

3. **Required Data:** What information must we collect from users? (e.g., monthly income, expense categories, financial goals)

4. **Optional Features:**
   - Should users be able to skip the onboarding?
   - Should there be a progress indicator?
   - Should there be a "back" button?
   - Should the onboarding be dismissible and resumable later?

5. **Trigger:** When should the onboarding appear?
   - Immediately after signup
   - After email verification
   - On first dashboard visit
   - Manually triggered

---

## PHASE 2: EXECUTION (Apply these STRICTLY after I answer)

Once you have the context, generate Angular components using the following specifications:

### **1. Architecture Pattern (MANDATORY)**

```
onboarding/
├── onboarding-container.component.ts  # Smart component (state management with signals)
├── onboarding-step.component.ts       # Reusable step wrapper
├── steps/
│   ├── step-1-welcome.component.ts
│   ├── step-2-[...].component.ts
│   └── step-n-completion.component.ts
├── onboarding.service.ts              # State & navigation logic
└── onboarding.model.ts                # Types & interfaces
```

### **2. Material Design 3 Visual System (MANDATORY)**

You MUST use the existing M3 design tokens and patterns from the Pulpe codebase:

#### **A. Color System**

Use M3 semantic color tokens (available as Tailwind utilities):

**Surface Hierarchy:**
```html
<!-- Background surfaces -->
<div class="bg-surface">                        <!-- Base surface -->
<div class="bg-surface-container-low">          <!-- Low elevation -->
<div class="bg-surface-container">              <!-- Medium elevation -->
<div class="bg-surface-container-high">         <!-- High elevation (dialogs) -->
<div class="bg-surface-container-highest">      <!-- Highest elevation -->

<!-- Content on surfaces -->
<p class="text-on-surface">                     <!-- Primary text -->
<p class="text-on-surface-variant">             <!-- Secondary text -->
```

**Color Roles:**
```html
<!-- Primary actions -->
<button matButton="filled" color="primary" class="bg-primary text-on-primary">

<!-- Secondary actions -->
<div class="bg-secondary-container text-on-secondary-container">

<!-- Tertiary accents -->
<div class="bg-tertiary-container text-on-tertiary-container">

<!-- Error states -->
<mat-error class="text-error">
```

**Custom Pulpe Financial Colors:**
```html
<span class="text-financial-income">   <!-- Blue: #0061a6 -->
<span class="text-financial-expense">  <!-- Orange: #c26c00 -->
<span class="text-financial-savings">  <!-- Green: #27ae60 -->
```

#### **B. Typography Scale**

Use M3 typescale utilities (mapped to Tailwind):

```html
<!-- Display (large hero text) -->
<h1 class="text-display-large">Welcome to Pulpe</h1>
<h1 class="text-display-medium">...</h1>
<h1 class="text-display-small">...</h1>

<!-- Headline (section headers) -->
<h2 class="text-headline-large">...</h2>
<h2 class="text-headline-medium">Set Your Budget</h2>
<h2 class="text-headline-small">...</h2>

<!-- Title (card headers, list items) -->
<h3 class="text-title-large">...</h3>
<h3 class="text-title-medium">Monthly Income</h3>
<h3 class="text-title-small">...</h3>

<!-- Body (main content) -->
<p class="text-body-large">...</p>
<p class="text-body-medium">This helps us personalize your experience</p>
<p class="text-body-small">...</p>

<!-- Label (buttons, inputs) -->
<span class="text-label-large">Continue</span>
<span class="text-label-medium">Skip for now</span>
<span class="text-label-small">Step 1 of 4</span>
```

#### **C. Shape System**

Use M3 corner radius tokens:

```html
<div class="rounded-corner-extra-small">    <!-- 4px -->
<div class="rounded-corner-small">          <!-- 8px -->
<div class="rounded-corner-medium">         <!-- 12px -->
<div class="rounded-corner-large">          <!-- 16px -->
<div class="rounded-corner-extra-large">    <!-- 28px -->
<div class="rounded-corner-full">           <!-- 9999px (pill) -->
```

**Component-Specific Shapes:**
```scss
// For rounded buttons in dialogs/onboarding
@include mat.button-overrides(
  (
    filled-container-shape: var(--mat-sys-corner-full),  // Pill buttons
    outlined-container-shape: var(--mat-sys-corner-medium),
  )
);

// For cards
@include mat.card-overrides(
  (
    container-shape: var(--mat-sys-corner-extra-large),
  )
);
```

#### **D. Elevation & Shadows**

Use surface containers for elevation (NO custom shadows):

```html
<!-- Level 0: Base surface -->
<div class="bg-surface">

<!-- Level 1: Slightly elevated -->
<div class="bg-surface-container-low">

<!-- Level 2: Cards, menus -->
<div class="bg-surface-container">

<!-- Level 3: Dialogs, onboarding modals -->
<div class="bg-surface-container-high">

<!-- Level 4: Floating action buttons -->
<div class="bg-surface-container-highest">
```

### **3. Angular Material v20 Components (NEW SYNTAX)**

Use the new Angular Material v20 API:

#### **A. Buttons (NEW SYNTAX)**

```html
<!-- Filled button (primary CTA) -->
<button matButton="filled" color="primary" type="submit">
  <mat-icon>arrow_forward</mat-icon>
  Continue
</button>

<!-- Tonal button (secondary CTA) -->
<button matButton="tonal">
  <mat-icon>arrow_back</mat-icon>
  Back
</button>

<!-- Outlined button -->
<button matButton="outlined">
  <mat-icon>close</mat-icon>
  Skip for now
</button>

<!-- Text button (tertiary) -->
<button matButton="text" class="text-on-surface-variant">
  Learn more
</button>
```

**IMPORTANT:** DO NOT use deprecated syntax:
- ❌ `mat-flat-button` → ✅ `matButton="filled"`
- ❌ `mat-raised-button` → ✅ `matButton="filled"`
- ❌ `mat-stroked-button` → ✅ `matButton="outlined"`
- ❌ `mat-button` → ✅ `matButton="text"`

#### **B. Form Fields**

```html
<mat-form-field appearance="outline" class="w-full">
  <mat-label>Monthly Income (CHF)</mat-label>
  <input matInput type="number" formControlName="monthlyIncome" />
  <mat-icon matPrefix>payments</mat-icon>
  <mat-hint>Enter your net monthly income</mat-hint>
  <mat-error>
    @if (form.get('monthlyIncome')?.hasError('required')) {
      This field is required
    } @else if (form.get('monthlyIncome')?.hasError('min')) {
      Amount must be positive
    }
  </mat-error>
</mat-form-field>
```

#### **C. Cards**

```html
<mat-card appearance="outlined" class="bg-surface-container">
  <mat-card-header>
    <div mat-card-avatar>
      <div class="flex justify-center items-center size-11 bg-primary-container rounded-full">
        <mat-icon class="text-on-primary-container">account_balance_wallet</mat-icon>
      </div>
    </div>
    <mat-card-title class="text-title-large">Welcome!</mat-card-title>
    <mat-card-subtitle class="text-body-medium text-on-surface-variant">
      Let's set up your budget in 3 easy steps
    </mat-card-subtitle>
  </mat-card-header>
  <mat-card-content>
    <!-- Step content here -->
  </mat-card-content>
  <mat-card-actions align="end">
    <button matButton="text">Skip</button>
    <button matButton="filled" color="primary">Continue</button>
  </mat-card-actions>
</mat-card>
```

#### **D. Icons (Material Symbols)**

Use Material Symbols with fill variants:

```html
<!-- Outlined (default) -->
<mat-icon>home</mat-icon>

<!-- Filled (active state) -->
<mat-icon class="icon-filled">home</mat-icon>
```

### **4. Layout Patterns**

#### **Desktop Experience:**

```html
<!-- Option 1: Dialog (recommended for short onboarding, 3-4 steps) -->
<mat-dialog class="max-w-[800px] bg-surface-container-high">
  <mat-dialog-content class="p-8">
    <!-- Step content -->
  </mat-dialog-content>
  <mat-dialog-actions align="space-between" class="p-6">
    <button matButton="text">Back</button>
    <div class="flex gap-2">
      <button matButton="outlined">Skip</button>
      <button matButton="filled" color="primary">Continue</button>
    </div>
  </mat-dialog-actions>
</mat-dialog>

<!-- Option 2: Full-screen (for longer onboarding, 5+ steps or complex forms) -->
<div class="min-h-screen bg-surface flex items-center justify-center p-6">
  <div class="w-full max-w-4xl">
    <!-- Progress indicator -->
    <mat-stepper linear #stepper>
      <mat-step>
        <ng-template matStepLabel>Welcome</ng-template>
        <!-- Step 1 content -->
      </mat-step>
      <!-- More steps... -->
    </mat-stepper>
  </div>
</div>
```

#### **Mobile Experience:**

```html
<!-- Full-screen takeover with safe areas -->
<div class="min-h-screen bg-surface flex flex-col" style="padding-bottom: env(safe-area-inset-bottom)">
  <!-- Progress indicator (fixed top) -->
  <div class="sticky top-0 z-10 bg-surface-container px-4 py-3">
    <div class="flex items-center justify-between">
      <button matButton="text" (click)="back()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span class="text-label-medium text-on-surface-variant">Step {{ currentStep }} of {{ totalSteps }}</span>
      <button matButton="text" (click)="skip()">Skip</button>
    </div>

    <!-- Linear progress -->
    <mat-progress-bar
      mode="determinate"
      [value]="progress"
      class="mt-2"
    ></mat-progress-bar>
  </div>

  <!-- Scrollable content -->
  <div class="flex-1 overflow-y-auto px-4 py-6">
    <!-- Step content with large touch targets -->
  </div>

  <!-- Fixed bottom actions -->
  <div class="sticky bottom-0 bg-surface-container p-4 border-t border-outline-variant">
    <button matButton="filled" color="primary" class="w-full h-12">
      Continue
    </button>
  </div>
</div>
```

### **5. Progress Indicator (M3 Pattern)**

#### **Desktop: Horizontal Stepper**

```html
<mat-stepper linear #stepper class="bg-surface-container-high">
  <mat-step [completed]="step1Completed">
    <ng-template matStepLabel>Welcome</ng-template>
    <!-- Content -->
  </mat-step>
  <mat-step [completed]="step2Completed">
    <ng-template matStepLabel>Set Budget</ng-template>
    <!-- Content -->
  </mat-step>
  <mat-step>
    <ng-template matStepLabel>Categories</ng-template>
    <!-- Content -->
  </mat-step>
</mat-stepper>
```

#### **Mobile: Linear Progress + Step Counter**

```html
<div class="space-y-2">
  <div class="flex justify-between items-center">
    <span class="text-label-small text-on-surface-variant">Step {{ currentStep }} of {{ totalSteps }}</span>
    <span class="text-label-small text-on-surface-variant">{{ progress }}%</span>
  </div>
  <mat-progress-bar
    mode="determinate"
    [value]="progress"
    color="primary"
  ></mat-progress-bar>
</div>
```

### **6. Motion & Animations (M3 Principles)**

Use Angular Animations with M3 easing curves:

#### **M3 Easing Functions:**

```typescript
// frontend/projects/webapp/src/app/animations/easing.ts
export const M3_EASING = {
  standard: 'cubic-bezier(0.2, 0.0, 0, 1.0)',           // Default transitions
  emphasized: 'cubic-bezier(0.2, 0.0, 0, 1.0)',         // Important state changes
  decelerate: 'cubic-bezier(0.0, 0.0, 0, 1.0)',         // Entering elements
  accelerate: 'cubic-bezier(0.3, 0.0, 1.0, 1.0)',       // Exiting elements
};

export const M3_DURATION = {
  short1: '50ms',    // Small utility changes
  short2: '100ms',   // Simple transitions
  short3: '150ms',   // Simple transitions
  short4: '200ms',   // Small expanding elements
  medium1: '250ms',  // Medium expanding elements
  medium2: '300ms',  // Large expanding elements
  medium3: '350ms',  // Large complex elements
  medium4: '400ms',  // Large complex elements
  long1: '450ms',    // Large expanding areas
  long2: '500ms',    // Large expanding areas
  long3: '550ms',    // Large complex expanding areas
  long4: '600ms',    // Large complex expanding areas
  extraLong1: '700ms',
  extraLong2: '800ms',
  extraLong3: '900ms',
  extraLong4: '1000ms',
};
```

#### **Step Transitions:**

```typescript
// onboarding-container.component.ts
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  animations: [
    trigger('stepTransition', [
      transition(':increment', [  // Forward
        style({ opacity: 0, transform: 'translateX(50px)' }),
        animate('300ms cubic-bezier(0.2, 0.0, 0, 1.0)',
          style({ opacity: 1, transform: 'translateX(0)' })
        ),
      ]),
      transition(':decrement', [  // Backward
        style({ opacity: 0, transform: 'translateX(-50px)' }),
        animate('300ms cubic-bezier(0.2, 0.0, 0, 1.0)',
          style({ opacity: 1, transform: 'translateX(0)' })
        ),
      ]),
    ]),

    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms 100ms cubic-bezier(0.0, 0.0, 0, 1.0)',
          style({ opacity: 1 })
        ),
      ]),
    ]),
  ],
})
```

#### **Completion Celebration:**

```typescript
// Use Material's confetti animation or simple scale + fade
trigger('celebrationCard', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.8)' }),
    animate('400ms cubic-bezier(0.2, 0.0, 0, 1.0)',
      style({ opacity: 1, transform: 'scale(1)' })
    ),
  ]),
]);
```

#### **Reduced Motion Support:**

```typescript
// Check user preference
@HostBinding('@.disabled')
get disableAnimations(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

### **7. State Management with Signals (Angular 20+)**

```typescript
// onboarding.service.ts
import { Injectable, signal, computed } from '@angular/core';

export interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  completedSteps: Set<number>;
  formData: Record<string, any>;
  canSkip: boolean;
  isSubmitting: boolean;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  // State signals
  private _currentStep = signal(1);
  private _totalSteps = signal(4);
  private _completedSteps = signal(new Set<number>());
  private _formData = signal<Record<string, any>>({});
  private _isSubmitting = signal(false);

  // Public computed signals
  currentStep = this._currentStep.asReadonly();
  totalSteps = this._totalSteps.asReadonly();
  progress = computed(() =>
    (this._currentStep() / this._totalSteps()) * 100
  );
  canGoBack = computed(() => this._currentStep() > 1);
  canGoNext = computed(() =>
    this._completedSteps().has(this._currentStep())
  );
  isLastStep = computed(() =>
    this._currentStep() === this._totalSteps()
  );

  // Navigation methods
  nextStep(): void {
    if (this._currentStep() < this._totalSteps()) {
      this._currentStep.update(step => step + 1);
      this.saveProgress();
    }
  }

  previousStep(): void {
    if (this._currentStep() > 1) {
      this._currentStep.update(step => step - 1);
    }
  }

  // Persistence
  private saveProgress(): void {
    localStorage.setItem('pulpe_onboarding_progress', JSON.stringify({
      currentStep: this._currentStep(),
      formData: this._formData(),
      completedSteps: Array.from(this._completedSteps()),
    }));
  }

  loadProgress(): void {
    const saved = localStorage.getItem('pulpe_onboarding_progress');
    if (saved) {
      const data = JSON.parse(saved);
      this._currentStep.set(data.currentStep);
      this._formData.set(data.formData);
      this._completedSteps.set(new Set(data.completedSteps));
    }
  }

  clearProgress(): void {
    localStorage.removeItem('pulpe_onboarding_progress');
  }
}
```

### **8. Accessibility (WCAG 2.1 AA Compliance)**

CRITICAL requirements:

#### **Keyboard Navigation:**

```typescript
@HostListener('keydown', ['$event'])
handleKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'Enter':
      if (!this.isFormInvalid()) {
        this.nextStep();
      }
      break;
    case 'Escape':
      if (this.canSkip) {
        this.skipOnboarding();
      }
      break;
    case 'ArrowRight':
      if (this.canGoNext()) {
        this.nextStep();
      }
      break;
    case 'ArrowLeft':
      if (this.canGoBack()) {
        this.previousStep();
      }
      break;
  }
}
```

#### **Screen Reader Announcements:**

```html
<!-- Live region for step changes -->
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {{ 'Step ' + currentStep() + ' of ' + totalSteps() + ': ' + stepTitle() }}
</div>

<!-- Focus management -->
<div #stepContainer tabindex="-1">
  <!-- Step content here -->
</div>
```

```typescript
@ViewChild('stepContainer') stepContainer!: ElementRef;

nextStep(): void {
  this.onboardingService.nextStep();

  // Focus first interactive element after step change
  setTimeout(() => {
    this.stepContainer.nativeElement.focus();
    const firstInput = this.stepContainer.nativeElement.querySelector('input, button');
    firstInput?.focus();
  }, 100);
}
```

#### **ARIA Labels:**

```html
<!-- Progress indicator -->
<mat-progress-bar
  [value]="progress()"
  aria-label="Onboarding progress"
  role="progressbar"
  [attr.aria-valuenow]="progress()"
  [attr.aria-valuemin]="0"
  [attr.aria-valuemax]="100"
></mat-progress-bar>

<!-- Navigation buttons -->
<button
  matButton="text"
  (click)="back()"
  [disabled]="!canGoBack()"
  aria-label="Go to previous step"
>
  <mat-icon>arrow_back</mat-icon>
  Back
</button>

<!-- Skip button -->
<button
  matButton="outlined"
  (click)="skip()"
  aria-label="Skip onboarding and go to dashboard"
>
  Skip for now
</button>
```

### **9. Mobile-Specific Enhancements**

#### **Viewport Meta Tag:**

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<meta name="theme-color" content="#006E25">  <!-- Pulpe primary color -->
```

#### **Semantic Input Types:**

```html
<!-- Email -->
<input matInput type="email" inputmode="email" autocomplete="email" />

<!-- Phone -->
<input matInput type="tel" inputmode="tel" autocomplete="tel" />

<!-- Money -->
<input matInput type="number" inputmode="numeric" autocomplete="off" />

<!-- Name -->
<input matInput type="text" autocomplete="given-name" />
```

#### **Virtual Keyboard Handling:**

```typescript
// Prevent layout shift when keyboard appears
@HostListener('window:resize')
onResize(): void {
  // Detect virtual keyboard
  const isKeyboardOpen = window.innerHeight < window.outerHeight * 0.75;

  if (isKeyboardOpen) {
    // Scroll focused input into view
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
```

#### **Touch-Friendly Targets:**

```html
<!-- Minimum 44px height for all interactive elements -->
<button matButton="filled" class="h-12 min-w-[120px]">
  Continue
</button>

<!-- Large tap areas for list items -->
<mat-list-item class="h-16">
  <!-- Content -->
</mat-list-item>
```

#### **Swipe Gestures (Optional):**

```typescript
import { HammerGestureConfig } from '@angular/platform-browser';

// Enable swipe detection
@HostListener('swipeleft')
onSwipeLeft(): void {
  if (this.canGoNext()) {
    this.nextStep();
  }
}

@HostListener('swiperight')
onSwipeRight(): void {
  if (this.canGoBack()) {
    this.previousStep();
  }
}
```

### **10. Performance Constraints**

#### **Lazy Loading:**

```typescript
// app.routes.ts
{
  path: 'onboarding',
  loadComponent: () =>
    import('./feature/onboarding/onboarding-container.component')
      .then(m => m.OnboardingContainerComponent),
}
```

#### **Image Optimization:**

```html
<!-- Use WebP with fallback -->
<img
  src="/assets/onboarding/welcome.webp"
  alt="Welcome illustration"
  loading="lazy"
  width="400"
  height="300"
/>
```

#### **Form Debouncing:**

```typescript
// Debounce validation
private validationDebounce$ = new Subject<void>();

ngOnInit() {
  this.validationDebounce$
    .pipe(debounceTime(300))
    .subscribe(() => this.validateStep());
}
```

### **11. Completion & Exit Strategy**

#### **On Completion:**

```typescript
async completeOnboarding(): Promise<void> {
  this._isSubmitting.set(true);

  try {
    // Save to backend via NestJS API
    await this.apiService.post('/users/onboarding', this._formData());

    // Update user profile
    await this.userService.updateProfile({ hasCompletedOnboarding: true });

    // Clear local progress
    this.clearProgress();

    // Show success toast
    this.snackBar.open('Welcome to Pulpe! 🎉', 'Close', {
      duration: 3000,
      panelClass: ['bg-primary-container', 'text-on-primary-container'],
    });

    // Redirect to dashboard
    this.router.navigate(['/dashboard']);

  } catch (error) {
    this.snackBar.open('An error occurred. Please try again.', 'Close', {
      duration: 5000,
      panelClass: ['bg-error-container', 'text-on-error-container'],
    });
  } finally {
    this._isSubmitting.set(false);
  }
}
```

#### **On Skip:**

```typescript
skipOnboarding(): void {
  // Show confirmation dialog
  const dialogRef = this.dialog.open(ConfirmDialogComponent, {
    data: {
      title: 'Skip onboarding?',
      message: 'You can restart this tour anytime from Settings.',
      confirmText: 'Skip',
      cancelText: 'Continue setup',
    },
  });

  dialogRef.afterClosed().subscribe(confirmed => {
    if (confirmed) {
      // Mark as skipped (NOT completed)
      this.userService.updateProfile({
        hasSkippedOnboarding: true,
        onboardingSkippedAt: new Date().toISOString(),
      });

      this.router.navigate(['/dashboard']);
    }
  });
}
```

#### **On Dismiss (Click Outside):**

```typescript
// In dialog configuration
this.dialog.open(OnboardingContainerComponent, {
  disableClose: true,  // Prevent click-outside if canDismiss: false
  hasBackdrop: true,
  backdropClass: 'bg-surface/90',  // M3 scrim
});

// If canDismiss: true
@HostListener('document:click', ['$event'])
onClickOutside(event: MouseEvent): void {
  if (this.canDismiss && this.isClickOutside(event)) {
    this.saveProgress();
    this.close();
  }
}
```

### **12. Testing Requirements**

Generate companion `.spec.ts` files:

```typescript
// onboarding-container.component.spec.ts
describe('OnboardingContainerComponent', () => {
  it('should navigate to next step when form is valid', () => {
    component.validateStep();
    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });

  it('should save progress to localStorage', () => {
    component.nextStep();
    const saved = localStorage.getItem('pulpe_onboarding_progress');
    expect(saved).toBeTruthy();
  });

  it('should support keyboard navigation (Enter key)', () => {
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    component.handleKeydown(event);
    expect(component.currentStep()).toBe(2);
  });

  it('should focus first input after step change', fakeAsync(() => {
    component.nextStep();
    tick(100);
    const focusedElement = document.activeElement;
    expect(focusedElement?.tagName).toBe('INPUT');
  }));

  it('should respect prefers-reduced-motion', () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as any);
    expect(component.disableAnimations).toBe(true);
  });
});
```

---

## PHASE 3: ADAPTATION LOGIC

Based on my answers, adapt the implementation:

### **If goal = "Data collection":**
- Use multi-field forms with clear hierarchy
- Show inline validation with helpful hints
- Use smart defaults (e.g., currency = CHF for Swiss users)
- Provide input format examples (e.g., "5'000" for CHF amounts)
- Use `mat-hint` for context, `mat-error` for validation

### **If goal = "Feature discovery":**
- Use interactive cards with illustrations
- Highlight UI elements with `::after` pseudo-elements or popovers
- Show screenshots/videos of features in action
- Use step-by-step guided tour pattern

### **If goal = "Initial setup":**
- Show live preview of results as user inputs data
- Use drag-and-drop for category ordering
- Provide templates/presets (e.g., "Student Budget", "Family Budget")
- Use `mat-chip` for category selection

### **If mobile-first:**
- Start with mobile layout (320px viewport)
- Use `mat-bottom-sheet` for mobile modals
- Large touch targets (min 44px)
- Fixed bottom CTA bar

### **If can skip:**
- Show skip button on every step
- Emphasize value proposition: "Why this matters"
- Use cards to explain benefits visually

---

## OUTPUT

Provide:

1. **Complete Angular component files** (TypeScript + HTML + SCSS)
2. **Service file** with state management (signals)
3. **Model/interface file** (`onboarding.model.ts`)
4. **Animation definitions** (`onboarding.animations.ts`)
5. **Tailwind config additions** (if custom classes needed)
6. **Integration instructions** for existing Angular app

### **Code Quality Standards:**

- ✅ Use Angular 20+ signals and `computed()` for reactive state
- ✅ Use `resource()` for async data (if fetching from API)
- ✅ Follow KISS & YAGNI principles (no over-engineering)
- ✅ Type everything with strict TypeScript
- ✅ Use `OnPush` change detection strategy
- ✅ Standalone components (no NgModule)
- ✅ Use M3 design tokens (NO custom colors/spacing)
- ✅ Follow existing Pulpe patterns (check similar components first)

### **DO NOT:**

- ❌ Create custom color variables (use M3 tokens)
- ❌ Use deprecated Angular Material syntax (`mat-flat-button`, etc.)
- ❌ Add unnecessary abstractions (YAGNI)
- ❌ Use magic numbers for spacing (use Tailwind: `p-4`, `gap-3`, etc.)
- ❌ Ignore mobile experience (mobile-first!)
- ❌ Skip accessibility (WCAG AA is mandatory)

---

## START NOW

**Ask me the PHASE 1 questions to gather onboarding requirements.**

---

## Key Files Reference (For Your Context)

**M3 Theme Configuration:**
- `/Users/maximedesogus/workspace/perso/pulpe-workspace/frontend/projects/webapp/src/app/styles/themes/_theme-colors.scss`
- `/Users/maximedesogus/workspace/perso/pulpe-workspace/frontend/projects/webapp/src/app/styles/vendors/_tailwind.css`

**Component Patterns to Follow:**
- Login form: `/Users/maximedesogus/workspace/perso/pulpe-workspace/frontend/projects/webapp/src/app/feature/auth/login/login.ts`
- Cards: `/Users/maximedesogus/workspace/perso/pulpe-workspace/frontend/projects/webapp/src/app/feature/budget-templates/components/template-card.ts`
- Navigation: `/Users/maximedesogus/workspace/perso/pulpe-workspace/frontend/projects/webapp/src/app/layout/main-layout.ts`

**Design System Files:**
- `/Users/maximedesogus/workspace/perso/pulpe-workspace/frontend/projects/webapp/src/app/styles/_base.scss`
- `/Users/maximedesogus/workspace/perso/pulpe-workspace/frontend/projects/webapp/src/app/styles/_dialogs.scss`



> 1. L'objectif principal c'est d'apprendre aux utilisateurs comment utiliser 
l'application, savoir à quoi correspondent les écrans, etc. Le menu, les 
fonctionnalités, etc. Avec un mode interactif qui met en surbrillance les 
éléments pour qu'ils comprennent bien comme un vrai bon onboarding.

2. Je ne suis pas bloqué sur le nombre d'étapes, je pense qu'il faut juste un 
nombre d'étapes optimal.

3. Alors là on parle pas de collecter des informations, on parle vraiment d'un
 espèce de tutoriel. Quand je dis onboarding, c'est dans le sens tutoriel qui 
va expliquer comment fonctionne l'application.

4. Ils peuvent skip le onboarding, il faut que ça affiche un progress 
indicator en effet, ils peuvent revenir en arrière et ils peuvent le dismiss 
s'ils veulent. Il faut sauvegarder le fait qu'il l'ait déjà vu ou qu'il les 
dismiss.

5. Quand est-ce que l'onboarding va apparaître dépend en fait de ce qu'on veut
 faire avec ce onboarding. Moi j'ai plusieurs options dans ma tête qui me 
semblent être viables à toi de juger avec ta qualité d'expert en expérience 
utilisateur. Mais par exemple lorsqu'on arrive sur un nouvel onglet du menu, 
une nouvelle page du menu, à ce moment-là on affiche l'onboarding lié à cette 
fonctionnalité. Ou alors autre possibilité peut-être on affiche un onboarding 
complet de l'app sans que l'utilisateur ait besoin de changer de menu et 
ensuite il ne revoit plus jamais l'onboarding. Je ne sais pas ce qui est le 
plus adapté par rapport à mon application. 