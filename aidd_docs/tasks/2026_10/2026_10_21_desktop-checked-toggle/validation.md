# Validation

The wide host placed the checked row across both columns. The fix keeps the date across both columns and assigns the checked row to the details column from 768px. Below that width, the full form uses one column so quick amounts and both switches have enough room. Both switch rows reuse the Settings label/hint pattern, aligned with a 16px gap. Handset selection, scroll ownership, bindings and persistence remain unchanged.

## Checks

- 32 unit tests passed across the entry form, bottom sheet and dialog service on the initial alignment candidate, exit code 0. Vitest reported a worker termination timeout after successful results; final template changes are covered by compilation and browser checks.
- Final Angular development compilation passed with `strictTemplates` enabled.
- Targeted ESLint passed on the initial candidate; final formatting and whitespace checks passed. Repository quality and hosted CI are tracked by the delivery owner.
- Architecture: no macro or micro violations; feature boundary, imports, form model, accessibility bindings and persistence remain unchanged.
- Final Chrome journey passed at 600, 767, 768, 1440 and 390px in 15.8 seconds, exit code 0. It covers expense/income, both switches, alignment, horizontal bounds, keyboard Tab/Space, visible actions and the 767/768px density boundary.
- Actual scroll owners have equal scroll/client widths: 552, 719, 720, 720 and 390px respectively. Keyboard focus decoration extends 4px beyond the inner form into existing padding without horizontal scrolling. The assertion checks the scroll owner and preserves the focus ring.
- Final local screenshots are in `/tmp/pulpe-checked-evidence/checked-layout-{600,767,768,1440,390}.png`, with additional top views at 600, 767 and 390px. Screenshot collection is excluded from the committed test.

## Local environment and limits

The Homebrew Node alias was broken; validation used installed Node 24.16.0 through nvm. The shared package was built before validation. Browser startup required local process permission and installed Chrome because the Playwright Chromium binary was absent. Temporary extended startup/navigation deadlines and disabled trace/video recording avoided local startup and artifact finalization delays; the temporary configuration was removed.

No claim of a reproduced failing pre-fix regression test is made. No separate production build or real-account write was performed locally; hosted CI owns the production build gate. Implementation and local verification are complete; independent review and publication remain with the delivery owner.
