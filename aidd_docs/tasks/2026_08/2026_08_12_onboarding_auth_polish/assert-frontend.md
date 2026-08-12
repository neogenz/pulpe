# Assert frontend: onboarding auth polish

Validate the current onboarding/auth diff against the running frontend at
`http://127.0.0.1:4300`, without restarting it.

## Expected behavior

- [x] Auth entry cards stay horizontally centered on desktop and mobile.
- [x] Signup exposes one password field with `autocomplete="new-password"`.
- [x] Complete-profile uses a compact optional-charges label on mobile.
- [x] Entering step 2 scrolls to the top.
- [x] The sticky step-2 CTA has a subtle top fade.

## Candidate causes

1. **Auth projected route host has no layout width** — high confidence.
   The shell centers its card, but Angular's routed component host previously
   did not span the shell. The shared `.pulpe-entry-shell > router-outlet + *`
   rule now provides a full-width flex host.
2. **Signup still carries confirmation state or DOM** — high confidence.
   Any remaining `confirmPassword` control, validator, signal, or field would
   preserve the old friction and could desynchronise UI/schema behavior.
3. **Step-2 responsive affordances rely on desktop layout** — medium confidence.
   A long disclosure label, unchanged scroll position, or abrupt sticky CTA
   edge would make the mobile charges step difficult to scan.

## Attempts and evidence

### Attempt 1 — auth shell and signup

- [x] Desktop screenshot at 1440×1000: the 448 px entry card is centered
  (`left=496`, `right=944`) with no horizontal overflow
  (`scrollWidth=viewportWidth=1440`).
- [x] Mobile screenshot at 375×812: the card stays inside the viewport
  (`left=16`, `right=344`, document scroll width 360) with no clipping.
- [x] Signup DOM contains exactly two inputs: email and one password.
- [x] Password input exposes `autocomplete="new-password"`; no confirmation
  input is rendered.
- Result: **pass**. No code change required.

### Attempt 2 — complete-profile behavior

- [x] Component assertion covers transition from step 1 to step 2 and verifies
  `ViewportScroller.scrollToPosition([0, 0])`.
- [x] Template uses the compact mobile copy `Masquer les options` /
  `Ajouter des charges`, while preserving the full desktop labels from `sm`.
- [x] Sticky CTA includes a non-interactive 24 px surface gradient above it.
- Result: **pass in component assertions**. End-to-end navigation was blocked
  because the already-running frontend could not reach `localhost:3000` for
  `/api/v1/encryption/salt`; the assert facet does not start/restart servers.

### Final clean sweep

- [x] Signup mobile and desktop screenshots confirm centered, unclipped entry
  shells and a single password field.
- [x] PIN mobile screenshot confirms the shared shell fix on another routed
  auth screen.
- [x] No relevant browser console errors; only the known unavailable local
  backend requests occurred during vault setup.

## Verdict

**PASS** for the requested diff. The running UI validates the auth shell and
signup behavior; the complete-profile interaction is validated by its focused
component assertions, with live traversal unavailable solely because the
existing backend process was down.
