# Task: Fix Tutorial Responsive Centering on Mobile

## Problem Analysis

Based on the screenshots provided, the tutorial tooltips are **not properly centered on mobile screens**:

1. **Screenshot 1 (Step 1/4)**: Tooltip "Bienvenue dans Pulpe" is slightly off-center horizontally
2. **Screenshot 2 (Step 2/4)**: Tooltip "Votre progression budgétaire" appears left-aligned, not centered
3. **Screenshot 3 (Step 3/4)**: Tooltip "Vos prévisions mensuelles" is positioned at the top-left, cutting off content
4. **Screenshot 4 (Step 4/4)**: Tooltip "Ajouter une transaction" is positioned correctly at bottom but horizontally misaligned

**Root Cause**: The current CSS uses `margin: 16px` on mobile which offsets the tooltip from true center positioning. Additionally, the Floating UI middleware configuration may need adjustment for mobile screens.

## Codebase Context

### Key Files

| File | Purpose |
|------|---------|
| `projects/webapp/src/app/core/tutorial/tutorial.service.ts` | Main tutorial service using Shepherd.js |
| `projects/webapp/src/app/core/tutorial/tutorial-configs.ts:145-163` | Default step options with Floating UI middleware |
| `projects/webapp/src/app/styles/components/_shepherd-theme.scss:458-504` | Mobile responsive CSS (problematic area) |

### Current Configuration

**Floating UI Middleware** (tutorial-configs.ts:153-158):
```typescript
floatingUIOptions: {
  middleware: [
    offset({ mainAxis: STEP_OFFSET_MAIN_AXIS_PX }),  // 24px
    flip(),
    shift(),
  ],
},
```

**Mobile CSS** (_shepherd-theme.scss:458-504):
```scss
@media (max-width: 767px) {
  .shepherd-element {
    max-width: calc(100vw - 32px);
    margin: 16px;  // ← This causes misalignment
  }
  // ...
}
```

### Tour Steps Structure

The tutorial has 4 tours defined in `tutorial-configs.ts`:
- `dashboard-welcome` (4 steps)
- `templates-intro` (3 steps)
- `budget-management` (2 steps)
- `budget-calendar` (4 steps)

Steps can be:
1. **Centered** (no `attachTo`): Step 1 of each tour - should be fully centered
2. **Attached** (with `attachTo`): Steps 2-4 - positioned relative to target element

## Documentation Insights

### Shepherd.js Centered Tooltips

From Shepherd.js docs, to center a tooltip:
- **Omit `attachTo` property entirely** - tooltip automatically centers on screen
- Shepherd uses `.shepherd-centered` CSS class for centered steps

### Floating UI Middleware Best Practices

1. **Order matters**: `offset()` → `flip()` → `shift()`
2. For mobile: Use `shift({ padding: 12 })` to maintain viewport margins
3. For edge elements: Consider omitting `attachTo` for truly centered positioning

### Mobile-Specific Recommendations

- Use Visual Viewport boundary (default) for iOS keyboard handling
- `shift()` middleware prevents overflow on constrained screens
- `flip({ fallbackAxisSideDirection: 'end' })` positions toward bottom (thumb-friendly)

## Key Findings

### Problem 1: Margin causing horizontal misalignment
The CSS `margin: 16px` on mobile doesn't work well with Floating UI positioning. When Shepherd centers a tooltip, it calculates viewport center, but the margin offsets it.

### Problem 2: No explicit centering CSS for `.shepherd-centered`
Shepherd adds `.shepherd-centered` class to centered steps, but our CSS doesn't handle this explicitly.

### Problem 3: shift() middleware needs viewport padding
Current `shift()` has no padding, causing tooltips to touch screen edges.

## Patterns to Follow

1. **CSS centering for `.shepherd-centered`**: Use Flexbox or CSS positioning instead of margin
2. **Mobile-first approach**: Apply centering styles specifically for centered steps
3. **Viewport padding**: Configure `shift({ padding: 16 })` for consistent spacing

## Dependencies

- **Shepherd.js**: Uses `angular-shepherd` wrapper
- **Floating UI**: `@floating-ui/dom` for positioning middleware
- **Material Design 3**: Theme tokens for styling

## Recommended Solution

### CSS Changes (_shepherd-theme.scss)

1. Replace `margin: 16px` with proper centering for `.shepherd-centered`:
```scss
@media (max-width: 767px) {
  .shepherd-element {
    max-width: calc(100vw - 32px);
    // Remove margin: 16px

    &.shepherd-centered {
      position: fixed !important;
      left: 50% !important;
      top: 50% !important;
      transform: translate(-50%, -50%) !important;
    }
  }
}
```

2. Add padding to shift middleware for attached tooltips

### Middleware Changes (tutorial-configs.ts)

Update `defaultStepOptions`:
```typescript
floatingUIOptions: {
  middleware: [
    offset({ mainAxis: STEP_OFFSET_MAIN_AXIS_PX }),
    flip({ fallbackAxisSideDirection: 'end' }),
    shift({ padding: 16 }),
  ],
},
```

## Next Step

Run `/workflow:epct:plan 01-tutorial-responsive-centering` to create implementation plan.
