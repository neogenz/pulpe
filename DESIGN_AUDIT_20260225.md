# Design Audit — Hero Card Colors (Light & Dark Theme)

**Date**: 2026-02-25
**Scope**: Dashboard Hero (`dashboard-hero.ts`) + Budget Financial Overview (`budget-financial-overview.ts`)
**Focus**: Background colors, text colors, and contrast across light/dark themes

---

## Overall Assessment

The hero cards work well in light mode with clear visual hierarchy and intentional state-based coloring. **Dark mode has significant issues**: the Dashboard Hero's gradient inverts its personality (light-on-dark becomes dark-on-light), a hardcoded `color: white` bypasses the design system, and the two hero cards use fundamentally different visual languages (bold gradients vs. flat M3 containers) creating a personality disconnect as users navigate between screens.

---

## Current State — Token Resolution Map

### Dashboard Hero (`dashboard-hero.ts`)

| State | CSS Property | Token | Light Value | Dark Value |
|-------|-------------|-------|-------------|------------|
| **On-track** | background (start) | `--mat-sys-primary` | `#006E25` (tone 40) | `#7edb83` (tone 80) |
| | background (end) | `color-mix(primary 75%, black)` | ~`#00531a` | ~`#5ea462` |
| | text | `--mat-sys-on-primary` | `#ffffff` (tone 100) | `#00390f` (tone 20) |
| **Warning** | background (start) | `--pulpe-amber` | `#b35800` | `#f0a050` |
| | background (end) | `color-mix(amber 75%, black)` | ~`#864200` | ~`#b4783c` |
| | text | `white` (hardcoded) | `#ffffff` | `#ffffff` |
| **Over-budget** | background (start) | `--mat-sys-error` | `#BA1A1A` (tone 40) | `#ffb4ab` (tone 80) |
| | background (end) | `color-mix(error 75%, black)` | ~`#8c1414` | ~`#bf8780` |
| | text | `--mat-sys-on-error` | `#ffffff` (tone 100) | `#690004` (tone 20) |

### Budget Financial Overview (`budget-financial-overview.ts`)

| State | CSS Property | Token | Light Value | Dark Value |
|-------|-------------|-------|-------------|------------|
| **Comfortable** | background | `--mat-sys-primary-container` | `#99f89d` (tone 90) | `#00531a` (tone 30) |
| | text | `--mat-sys-on-primary-container` | `#002106` (tone 10) | `#99f89d` (tone 90) |
| **Warning** | background | `--pulpe-amber-container` | `#fff3e0` | `#2a1f10` |
| | text | `--pulpe-amber` | `#b35800` | `#f0a050` |
| **Deficit** | background | `--mat-sys-error-container` | `#ffdad5` (tone 90) | `#930009` (tone 30) |
| | text | `--mat-sys-on-error-container` | `#410002` (tone 10) | `#ffdad5` (tone 90) |

---

## Phase 1 — Critical

### 1.1 [Dashboard Hero] Dark mode gradient inversion

**What's wrong**: The gradient uses `--mat-sys-primary` as its base. In M3, `primary` is tone 40 in light mode (deep `#006E25`) but tone 80 in dark mode (pale `#7edb83`). The hero card inverts its entire personality in dark mode: background becomes light green, text becomes dark green (`#00390f`). This breaks the "bold, immersive hero" design intent.

**What it should be**: Introduce dedicated hero gradient tokens that maintain a dark-background-light-text paradigm in both themes. In dark mode, the gradient should use deep tones (20-30 range) with light text, not the M3 `primary` which is designed for small UI elements on dark surfaces.

**Why this matters**: The hero is the emotional anchor of the dashboard. A washed-out pastel gradient with dark text feels timid, not confident. Pillar violated: **Controle** (the hero should project authority) + **Clarte** (visual hierarchy collapses).

**Proposed token**:
```scss
:root {
  --pulpe-hero-primary: var(--mat-sys-primary);          // #006E25
  --pulpe-hero-primary-text: var(--mat-sys-on-primary);  // #ffffff
}
.dark-theme {
  --pulpe-hero-primary: #00390f;          // primary tone 20 — rich dark green
  --pulpe-hero-primary-text: #99f89d;     // primary tone 90 — bright green text
}
```

**Files**: `_financial-colors.scss` (add tokens), `dashboard-hero.ts` (consume tokens)

---

### 1.2 [Dashboard Hero] Over-budget state same inversion in dark mode

**What's wrong**: Same problem as 1.1 but with `--mat-sys-error`. In dark mode, error is tone 80 (`#ffb4ab` — salmon pink) with `on-error` tone 20 (`#690004` — dark maroon) as text. The result is a **pastel pink hero card** with dark red text instead of the intense red gradient of light mode.

**What it should be**: Maintain the alarming, saturated red gradient in dark mode. A pastel pink hero doesn't communicate "deficit" with the right urgency.

**Why this matters**: The DA specifies "le hero est le seul endroit ou l'emotion doit frapper" — the hero is the one place where emotion must hit. A pastel pink card fails this mandate. Pillar: **Clarte** (deficit state must be unmistakable).

**Proposed token**:
```scss
:root {
  --pulpe-hero-error: var(--mat-sys-error);              // #BA1A1A
  --pulpe-hero-error-text: var(--mat-sys-on-error);      // #ffffff
}
.dark-theme {
  --pulpe-hero-error: #930009;             // error tone 30 — deep saturated red
  --pulpe-hero-error-text: #ffdad5;        // error tone 90 — light pink text
}
```

**Files**: `_financial-colors.scss` (add tokens), `dashboard-hero.ts` (consume tokens)

---

### 1.3 [Dashboard Hero] Warning state hardcodes `color: white`

**What's wrong**: `.hero-container.budget-warning` sets `color: white` — a raw value outside the design system. In dark mode, `--pulpe-amber` becomes `#f0a050` (lighter amber). The gradient from `#f0a050` mixed with black yields a medium-dark amber. White text on this may have acceptable contrast, but the hardcoded value is a design system violation and doesn't adapt to potential future amber palette changes.

**What it should be**: Use a token. Either `var(--pulpe-hero-warning-text)` (new) or at minimum `var(--pulpe-amber-on-container)`.

**Why this matters**: Consistency with the design system. Every other hero state uses tokens. This one doesn't.

**Proposed token**:
```scss
:root {
  --pulpe-hero-warning: var(--pulpe-amber);
  --pulpe-hero-warning-text: #ffffff;  // white works on dark amber
}
.dark-theme {
  --pulpe-hero-warning: #3e2723;            // dark warm brown
  --pulpe-hero-warning-text: #fff3e0;       // light amber text
}
```

**Files**: `_financial-colors.scss` (add token), `dashboard-hero.ts` (replace `color: white`)

---

## Phase 2 — Refinement

### 2.1 [Dashboard Hero] Decorative blurs degrade in dark mode

**What's wrong**: Three decorative `bg-white/15`, `bg-white/10`, `bg-white/5` blurred circles assume a dark background. In dark mode (with light gradient from issue 1.1), white-on-light creates faint, barely visible artifacts rather than the atmospheric depth visible in light mode.

**What it should be**: If Phase 1 tokens are implemented (keeping dark backgrounds in dark mode), this resolves automatically. If not, the blurs should use `bg-black/10` etc. in dark mode via `dark:` variant.

**Why this matters**: These blurs create the premium "glowing" feel. Without them, the hero loses its tactile depth.

**Files**: `dashboard-hero.ts` template

---

### 2.2 [Dashboard Hero] Progress bar uses `currentColor` — inverts in dark mode

**What's wrong**: `.progress-fill`, `.pace-marker`, and `.indicator-dot` all use `background-color: currentColor`, which inherits from the parent's `color` property (i.e., `--mat-sys-on-primary`). In dark mode, this is `#00390f` (dark green) — the progress bar fill becomes a dark bar on a lighter background, losing visual weight and impact.

**What it should be**: Resolves automatically if Phase 1 tokens are applied (text remains light in dark mode). Otherwise, these elements need explicit dark-mode color overrides.

**Why this matters**: The progress bar is the secondary data point on the hero. Low-contrast fill makes it unreadable. Pillar: **Clarte**.

**Files**: `dashboard-hero.ts` styles

---

### 2.3 [Both Screens] Visual language inconsistency between the two heroes

**What's wrong**: The Dashboard Hero uses bold gradients with atmospheric blurs (expressive, premium). The Budget Financial Overview uses flat M3 container colors (`bg-primary-container`, `bg-error-container`) — standard Material, understated. Same user, same app, two hero sections with fundamentally different visual registers.

**What it should be**: This is a design direction question. Two options:
1. **Unify as gradient** — Apply the dashboard-style gradient to the budget overview hero for visual consistency. This is the bolder, more branded approach.
2. **Accept the difference** — The dashboard hero is "the emotional anchor" (daily view), the budget detail hero is "informational" (drill-down view). Different contexts warrant different intensities.

**Why this matters**: If unintentional, it reads as inconsistency. If intentional, it should be documented as a deliberate design decision.

**Recommendation**: Option 2 (accept the difference) is probably right — the dashboard hero needs to "hit" emotionally on first open, while the budget detail is a working surface. But document this decision.

---

### 2.4 [Budget Financial Overview] Warning state text contrast

**What's wrong**: In warning state, the text class is `.text-warning` which maps to `color: var(--pulpe-amber)`. In light mode: `#b35800` text on `#fff3e0` background. The contrast ratio is approximately **4.4:1** — passes AA for large text but fails AA for the small `text-body-medium` subtitle and `text-body-large` label.

**What it should be**: Use `--pulpe-amber-on-container` (`#3e2723` in light mode) for body text, reserve `--pulpe-amber` for the large display number only. Contrast of `#3e2723` on `#fff3e0` is approximately **10.5:1** (passes AAA).

**Why this matters**: WCAG AA compliance for body text (4.5:1 minimum). The large number passes, the supporting text might not.

**Files**: `budget-financial-overview.ts` template — split text classes for headline vs. body text in warning state

---

## Phase 3 — Polish

### 3.1 [Dashboard Hero] Progress bar backdrop opacity in dark mode

**What's wrong**: The progress section uses `bg-white/15 backdrop-blur-sm border-white/15`. This is calibrated for a dark (light mode) background. In dark mode (after Phase 1 fix), the backdrop should remain appropriate, but could benefit from slightly adjusted opacity (`bg-white/20`) for better definition on the dark gradient.

**What it should be**: Add `dark:bg-white/20 dark:border-white/20` for subtle reinforcement.

**Files**: `dashboard-hero.ts` template, progress container div

---

### 3.2 [Dashboard Hero] `box-shadow: var(--mat-sys-level2)` in dark mode

**What's wrong**: M3 `level2` shadow may be imperceptible on dark backgrounds. Not broken, but the hero could benefit from a subtle `border` or outline to define its edges in dark mode.

**What it should be**: Consider `dark:border dark:border-white/5` as a supplementary edge definition.

**Files**: `dashboard-hero.ts` template, `.hero-container` div

---

## Token Updates Required

Add the following to `_financial-colors.scss`:

```scss
// ─── Layer 3: Hero gradient tokens ───────────────────────────────────
// Hero cards use bold gradients that need dark backgrounds in BOTH themes.
// M3 `primary`/`error` are tone 80 in dark mode (too light for gradients).
// These tokens enforce the correct tone mapping for immersive hero surfaces.

:root {
  --pulpe-hero-primary: var(--mat-sys-primary);
  --pulpe-hero-primary-text: var(--mat-sys-on-primary);
  --pulpe-hero-warning: var(--pulpe-amber);
  --pulpe-hero-warning-text: #ffffff;
  --pulpe-hero-error: var(--mat-sys-error);
  --pulpe-hero-error-text: var(--mat-sys-on-error);
}

.dark-theme {
  --pulpe-hero-primary: #00390f;       // primary tone 20
  --pulpe-hero-primary-text: #99f89d;  // primary tone 90
  --pulpe-hero-warning: #3e2723;       // warm dark brown
  --pulpe-hero-warning-text: #fff3e0;  // light amber
  --pulpe-hero-error: #930009;         // error tone 30
  --pulpe-hero-error-text: #ffdad5;    // error tone 90
}

@media (prefers-color-scheme: dark) {
  :root {
    --pulpe-hero-primary: #00390f;
    --pulpe-hero-primary-text: #99f89d;
    --pulpe-hero-warning: #3e2723;
    --pulpe-hero-warning-text: #fff3e0;
    --pulpe-hero-error: #930009;
    --pulpe-hero-error-text: #ffdad5;
  }
}
```

---

## Implementation Notes

### Phase 1 — Critical (3 changes)

**1. `_financial-colors.scss`** — Add hero gradient tokens (see "Token Updates Required" above)

**2. `dashboard-hero.ts` lines 143-168** — Replace raw Material tokens with hero tokens:

```scss
// BEFORE
.hero-container {
  background: linear-gradient(145deg, var(--mat-sys-primary) 0%, color-mix(in srgb, var(--mat-sys-primary) 75%, black) 100%);
  color: var(--mat-sys-on-primary);
}
.hero-container.budget-warning {
  background: linear-gradient(145deg, var(--pulpe-amber) 0%, color-mix(in srgb, var(--pulpe-amber) 75%, black) 100%);
  color: white;
}
.hero-container.budget-over {
  background: linear-gradient(145deg, var(--mat-sys-error) 0%, color-mix(in srgb, var(--mat-sys-error) 75%, black) 100%);
  color: var(--mat-sys-on-error);
}

// AFTER
.hero-container {
  background: linear-gradient(145deg, var(--pulpe-hero-primary) 0%, color-mix(in srgb, var(--pulpe-hero-primary) 75%, black) 100%);
  color: var(--pulpe-hero-primary-text);
}
.hero-container.budget-warning {
  background: linear-gradient(145deg, var(--pulpe-hero-warning) 0%, color-mix(in srgb, var(--pulpe-hero-warning) 75%, black) 100%);
  color: var(--pulpe-hero-warning-text);
}
.hero-container.budget-over {
  background: linear-gradient(145deg, var(--pulpe-hero-error) 0%, color-mix(in srgb, var(--pulpe-hero-error) 75%, black) 100%);
  color: var(--pulpe-hero-error-text);
}
```

**3. No additional change needed for Financial Overview** — It already uses M3 container tokens which handle light/dark correctly. The warning contrast issue (2.4) is Phase 2.

### Phase 2 — Refinement (2 changes)

**4. `budget-financial-overview.ts` lines 44-72** — Split warning text colors by text size:
- Large display number: keep `text-warning` (amber — meets contrast for large text)
- Body/label text: use new `text-warning-on-container` class → `var(--pulpe-amber-on-container)`

**5. Add Tailwind utility** in `_tailwind.css`:
```css
@utility text-warning-on-container {
  color: var(--pulpe-amber-on-container) !important;
}
```

### Phase 3 — Polish (2 changes)

**6. `dashboard-hero.ts` template** — Add dark mode reinforcement classes to progress container:
- `bg-white/15` → `bg-white/15 dark:bg-white/20`
- `border-white/15` → `border-white/15 dark:border-white/20`

**7. `dashboard-hero.ts` template** — Add subtle dark mode border to hero container:
- Add `dark:border dark:border-white/5` to `.hero-container` div

---

## Decision Required

**2.3 — Visual language consistency**: Should both hero cards use the same visual language (gradients vs. flat containers), or is the intentional difference between "emotional daily dashboard" and "informational budget drill-down" the right design decision? No implementation until confirmed.
