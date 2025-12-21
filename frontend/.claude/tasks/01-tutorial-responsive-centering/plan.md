# Plan: Fix Tutorial Responsive Centering on Mobile

## Overview

Fix the tutorial tooltips positioning on mobile screens. The main issues are:
1. Centered tooltips (step 1 of each tour) are offset due to CSS `margin: 16px`
2. Attached tooltips lack proper viewport padding from `shift()` middleware

## Implementation Steps

### Step 1: Fix CSS for Mobile Tooltips

**File**: `projects/webapp/src/app/styles/components/_shepherd-theme.scss`

**Changes**:
1. Remove problematic `margin: 16px` from mobile `.shepherd-element`
2. Shepherd.js already handles centering for `.shepherd-centered` - the margin was interfering

**Why NOT override transform**:
The animation uses `transform: translateY(16px)` → `translateY(0)` for slide-up effect.
Overriding with `translate(-50%, -50%)` would break this animation.

**Code**:
```scss
@media (max-width: 767px) {
  .shepherd-element {
    max-width: calc(100vw - 32px);
    // margin: 16px; ← REMOVED - was causing off-center positioning
    // shift({ padding: 16 }) middleware handles viewport spacing instead
  }
}
```

### Step 2: Update Floating UI Middleware Configuration

**File**: `projects/webapp/src/app/core/tutorial/tutorial-configs.ts`

**Changes**:
1. Add `padding: 16` to `shift()` middleware for viewport margins on attached tooltips
2. Add `fallbackAxisSideDirection: 'end'` to `flip()` for mobile-friendly positioning

**Code**:
```typescript
export const defaultStepOptions: Partial<StepOptions> = {
  // ... existing options
  floatingUIOptions: {
    middleware: [
      offset({ mainAxis: STEP_OFFSET_MAIN_AXIS_PX }),
      flip({ fallbackAxisSideDirection: 'end' }),
      shift({ padding: 16 }),
    ],
  },
  // ... rest
};
```

### Step 3: Test on Mobile Viewports

**Manual Testing**:
1. Run `pnpm dev` and open Chrome DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test at 375px width (iPhone SE/small mobile)
4. Start dashboard-welcome tour
5. Verify each step:
   - Step 1: Centered horizontally and vertically
   - Step 2-4: Properly positioned near target with 16px viewport padding

## Files to Modify

| File | Type | Changes |
|------|------|---------|
| `_shepherd-theme.scss:458-504` | CSS | Fix mobile responsive styles |
| `tutorial-configs.ts:145-163` | TS | Update Floating UI middleware |

## Acceptance Criteria

- [ ] Centered tooltips (step 1) are perfectly centered on mobile
- [ ] Attached tooltips (steps 2-4) maintain 16px distance from screen edges
- [ ] Desktop behavior unchanged
- [ ] No visual regression on tablet sizes (768px+)
- [ ] `pnpm quality` passes

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Attached tooltips too close to edge | Low | `shift({ padding: 16 })` handles viewport spacing |
| Floating UI version compatibility | Low | Using standard middleware options from @floating-ui/dom |
| Animation preserved | None | Removed transform override - animation intact |

## Estimated Complexity

**Low** - CSS fix + middleware config update. No logic changes needed.
