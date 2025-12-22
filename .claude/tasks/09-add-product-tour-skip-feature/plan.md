# Implementation Plan: Add "Skip" Feature to Product Tour

## Overview

Add a "Passer" (Skip) button to the Driver.js product tour popover footer. The button uses the `onPopoverRender` callback to inject a custom text button styled like the "Précédent" button. Clicking Skip calls `tourDriver.destroy()`, triggering the existing `onDestroyed` callback which marks the tour as completed.

## Dependencies

- No external dependencies to add
- Driver.js v1.4.0 already supports `onPopoverRender` callback

## File Changes

### `frontend/projects/webapp/src/app/core/product-tour/product-tour.service.ts`

- **Add `onPopoverRender` callback** to the `driverConfig` object (after line 109, before `onDestroyStarted`)
  - Callback receives `(popover, { driver: driverInstance })` parameters
  - Create a `<button>` element with text "Passer"
  - Add class `driver-popover-skip-btn` for styling
  - Add click listener that calls `driverInstance.destroy()`
  - Append button to `popover.footerButtons` element (places it after "Suivant")

### `frontend/projects/webapp/src/app/core/product-tour/product-tour.css`

- **Add `.driver-popover-skip-btn` styles** (after line 185, near the other button styles)
  - Copy the text button pattern from `.driver-popover-prev-btn` (lines 149-166)
  - Use M3 text button styles: transparent background, primary color text
  - Add hover state with subtle background highlight
  - Consider: Use `--mat-sys-on-surface-variant` for a more subdued appearance (optional)

## Testing Strategy

- **Manual verification steps:**
  1. Start tour on any page → Skip button appears in footer
  2. Click "Passer" → Tour closes immediately
  3. Refresh page → Tour does not restart (marked as completed)
  4. Reset tours → Tour shows again with Skip button

- **Unit tests (optional):**
  - The `onPopoverRender` callback is a DOM manipulation that's difficult to unit test
  - E2E tests would be more appropriate for verifying skip behavior

## Documentation

- No documentation updates needed (internal feature)

## Rollout Considerations

- **No breaking changes** - Skip button is purely additive
- **Backwards compatible** - Uses existing `onDestroyed` completion tracking
- **No migration needed** - Works with existing localStorage keys
