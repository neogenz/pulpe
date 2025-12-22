# Task: Add "Skip" Feature to Product Tour

## Summary

Add a "Skip" button to the Driver.js product tour, allowing users to exit the tour at any step. The implementation uses the `onPopoverRender` callback to inject a custom button into the popover footer.

---

## Codebase Context

### Current Implementation

**Library:** Driver.js v1.4.0
**Architecture:** Singleton service (`ProductTourService`) with page-specific step definitions

### Key Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `frontend/.../product-tour/product-tour.service.ts` | Main tour service | 94-119 (config) |
| `frontend/.../product-tour/product-tour.css` | M3 themed styles | 88-185 (buttons) |
| `frontend/.../product-tour/product-tour.service.spec.ts` | Unit tests | All |

### Current Driver.js Configuration (lines 94-119)

```typescript
const driverConfig: Config = {
  showProgress: true,
  showButtons: ['next', 'previous'],  // No 'close' in button row
  progressText: 'Étape {{current}} sur {{total}}',
  nextBtnText: 'Suivant',
  prevBtnText: 'Précédent',
  doneBtnText: 'Terminer',
  allowClose: true,  // X button is shown
  overlayColor: '#000',
  overlayOpacity: 0.75,
  // ... other options
  onDestroyed: () => {
    if (includeIntro) this.#markIntroCompleted();
    this.#markPageTourCompleted(pageId);
  },
};
```

### Tour Completion Tracking

- **Storage keys:** `pulpe_tour_intro`, `pulpe_tour_{pageId}`
- **Values:** `'true'` when completed
- **Location:** localStorage
- **Trigger:** `onDestroyed` callback marks completion regardless of how tour ends

### Pages Using Tour (all follow same pattern)

1. `current-month.ts:240-248` - Auto-triggers after 500ms if not seen
2. `budget-list-page.ts:140-148`
3. `budget-details-page.ts:220-228`
4. `template-list-page.ts:153-161`

---

## Documentation Insights

### Driver.js Button Configuration

**Built-in buttons:** `'next'`, `'previous'`, `'close'`

**No native skip button** - must use `onPopoverRender` callback:

```typescript
onPopoverRender: (popover, { driver: driverInstance }) => {
  const skipButton = document.createElement('button');
  skipButton.innerText = 'Passer le tour';
  skipButton.className = 'driver-popover-skip-btn';
  skipButton.addEventListener('click', () => driverInstance.destroy());
  popover.footerButtons.appendChild(skipButton);
},
```

### PopoverDOM Structure

```typescript
type PopoverDOM = {
  wrapper: HTMLElement;
  arrow: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  footer: HTMLElement;
  progress: HTMLElement;
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  footerButtons: HTMLElement;  // <-- Append custom buttons here
};
```

### Key API Methods

- `driver.destroy()` - Close tour and trigger `onDestroyed`
- `driver.getActiveIndex()` - Get current step index
- `driver.isFirstStep()` / `driver.isLastStep()` - Check position

---

## Research Findings

### UX Best Practices

| Aspect | Recommendation |
|--------|----------------|
| **Position** | Bottom-right of popover footer (after primary buttons) |
| **Style** | Secondary/text button (less prominent than "Suivant") |
| **Text** | 1-3 words: "Passer", "Ignorer", or "Passer le tour" |
| **Visibility** | Show on ALL steps (users expect escape route anytime) |
| **Behavior** | Same as completing tour (mark as seen in localStorage) |

### Statistics

- ~40% of users skip tours on first step
- Users skip when focused on productivity - don't force completion
- Always provide restart option (already exists via help button)

---

## Patterns to Follow

### Material Design 3 Button Styles (from product-tour.css)

**Previous button (Text Button)** - Use this style for Skip:
```css
.driver-popover-prev-btn {
  background-color: transparent !important;
  color: var(--mat-sys-primary) !important;
  border: none !important;
  border-radius: var(--mat-sys-corner-full) !important;
  padding: 10px 16px !important;
  min-height: 40px !important;
  font-family: var(--mat-sys-label-large-font) !important;
  font-size: var(--mat-sys-label-large-size) !important;
  font-weight: 500 !important;
  letter-spacing: 0.1px !important;
}
```

### Footer Layout

```css
.driver-popover-footer {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
}

.driver-popover-navigation-btns {
  display: flex !important;
  gap: 12px !important;
}
```

---

## Dependencies

- **Driver.js:** v1.4.0 (confirmed in `frontend/package.json:57`)
- **CSS Variables:** Material Design 3 tokens (`--mat-sys-*`)
- **Storage:** localStorage for completion tracking

---

## Implementation Approach

### Files to Modify

1. **`product-tour.service.ts`**
   - Add `onPopoverRender` callback to create skip button
   - Skip button calls `tourDriver.destroy()` (triggers existing `onDestroyed`)

2. **`product-tour.css`**
   - Add `.driver-popover-skip-btn` styles matching M3 text button

3. **`product-tour.service.spec.ts`** (optional)
   - Add tests for skip button creation if needed

### Skip Button Behavior

- **Click action:** Call `tourDriver.destroy()`
- **Completion tracking:** Uses existing `onDestroyed` callback (marks tour as completed)
- **No separate "skipped" state** - keeps implementation simple

### Suggested Button Text

- **French:** "Passer" (Skip) - concise, 1 word
- **Alternative:** "Passer le tour" (Skip the tour) - clearer but longer

### Button Position

Option A: **Append to footerButtons** (after Next)
```
[Précédent] [Suivant] [Passer]
```

Option B: **Prepend to footerButtons** (before Previous)
```
[Passer] [Précédent] [Suivant]
```

**Recommendation:** Option A - Skip is secondary to navigation, should be last

---

## Questions Resolved

| Question | Answer |
|----------|--------|
| Mark as completed or skipped? | **Completed** (uses existing `onDestroyed` hook) |
| Show on all steps? | **Yes** (UX best practice) |
| Button style? | **Text button** (like "Précédent") |
| Button text? | **"Passer"** (concise French) |

---

## Next Step

Run `/epct:plan .claude/tasks/09-add-product-tour-skip-feature` to create the implementation plan.
