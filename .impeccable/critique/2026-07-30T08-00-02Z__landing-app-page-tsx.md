---
target: landing prod vs refonte codex/landing-redesign
total_score: 28
p0_count: 2
p1_count: 3
timestamp: 2026-07-30T08-00-02Z
slug: landing-app-page-tsx
---
Method: dual-agent comparative critique (A: prod review · A': redesign review · B: detector + measured a11y evidence). Targets: `landing/app/page.tsx` @ `preview` (live pulpe.app) vs branch `codex/landing-redesign` (worktree `.codex/worktrees/5897`).

## Design Health Score

| # | Heuristic | prod | refonte | Key issue |
|---|-----------|------|---------|-----------|
| 1 | Visibility of system status | 2 | 2 | No active-section state on a 7000px+ page, either side |
| 2 | Match system / real world | 4 | 3 | Refonte leaks `AES-256-GCM` / `JSON` with no gloss; prod glosses them |
| 3 | User control and freedom | 3 | 3 | No back-to-top either side |
| 4 | Consistency and standards | 3 | 2 | Refonte: h2 = h3 = 89.6px, two labels for one URL |
| 5 | Error prevention | 3 | 3 | No forms on either page |
| 6 | Recognition rather than recall | 3 | 3 | Refonte nav label "Confiance" does not match its destination |
| 7 | Flexibility and efficiency | 3 | 2 | Refonte: single path, App Store link 4000px down, no persistent CTA |
| 8 | Aesthetic and minimalist | 2 | 2 | Prod: 18% of height on a product-free hero. Refonte: 6 eyebrows, ~500px void |
| 9 | Error recovery | 2 | 2 | Refonte ships 3 broken visual states |
| 10 | Help and documentation | 3 | 1 | Refonte deleted the FAQ; only path is a footer link absent from nav |
| **Total** | | **28/40** | **23/40** | Good (bottom edge) vs Acceptable |

## Anti-Patterns Verdict

**prod: not AI slop.** Hand-drawn marker system used as argument, a real named founder with portrait and first-person note, copy naming a specific Swiss month. Grain hooks deliberately neutered (`globals.css:446-463`). Exactly one kicker on the whole page. Zero detector findings (exit 0).

**refonte: not slop, but template.** 43 detector findings (exit 2), all `design-system-color`, 41 in a committed-minified `globals.css`. Absolute bans violated: identical 4-card grid with rounded-square tinted icons above each heading (`WhyFree.tsx:52-76`); 6 uppercase tracked eyebrows across 5 section files at 3 different tracking values (0.14 / 0.16 / 0.18em); hero clamp max 121.6px over the 96px ceiling; display tracking -0.06em under the -0.04em floor. Glass inverted: the page's only `backdrop-filter` sits on a content card while the navbar is opaque, reversing its own Navigation Glass Rule.

## Overall Impression

Prod does the job; the refonte does the poster. Prod converts and answers objections, and its ambient green field is its biggest liability. The refonte fixes the canvas, ships a better hero composition and real iOS proof, then deletes the machinery that made the page work: FAQ, testimonials, pain framing, the 3-step explainer, the sticky CTA, and the entire mobile nav.

## What's Working

**prod:** the felt-tip marker system as progressive enhancement (text in server HTML, only decoration gated); copy that names the reader's month ("Les impôts tombent en juillet"); native-element engineering that survives a measured 3.2s hydration delay.

**refonte:** motion correctly engineered (reduced-motion short-circuit + CSS that only hides a JS-stamped state, 0/270 elements stuck); semantic color mapping matching the screenshots; a near-white canvas instead of a full-page green drench.

## Priority Issues

**[P0] Refonte hero CTA below the fold.** Measured: 1440x900 bottom=910 (clipped); 1280x720 top=786 (entirely invisible). Prod: fully visible at all three viewports. Fix: cut hero `min-height` to ~820px and top padding to ~96px.

**[P0] Refonte deleted conversion machinery.** FAQ (6 objections), testimonials, pain-points, 3-step explainer, StickyCTA, mobile nav. On a 9707px mobile page: no conversion point between hero CTA (~y520) and the final CTA. Section `#why-free` never says why it is free. Fix: restore sticky mobile CTA, one proof unit above 2000px, one paragraph answering the free question, `/support` in the nav.

**[P1] Refonte has no mobile navigation.** `Header.tsx:38` `hidden … min-[721px]:flex`, no disclosure replacement. Prod ships a `<details>` menu driven by an inline head script.

**[P1] Prod sticky CTA disappears into the Platforms card.** `bg-primary` button over `bg-primary` card below 1024px: fill, border and shadow all vanish. Plus no `padding-bottom` on `<main>`, so it permanently occludes ~100px (12% of a 854px viewport) mid-page.

**[P1] Prod hero spends 790px on stacked text.** The dashboard, called "the one memorable visual moment" in DESIGN.md, is a 40px sliver at 1440x900. The hero blockquote is served verbatim again 3000px later.

**[P2] Prod ambient field is two different brands.** Desktop: 7 radial gradients at full chroma over the whole 7215px. Mobile: `background-image: none` + halos at `opacity: 0.07`. Contradicts PRODUCT.md principle 3 and its own two-zone rule.

**[P2] Refonte brand tokens drifted cool.** `--color-background: #fff`, `--color-surface: #fff` (raw white), `--color-text-secondary: #626773` (hue ~220 deg), against a root DESIGN.md rule it chose to keep ("every neutral is tinted toward the warm canvas") and PRODUCT.md ("never cold grays"). Its dark palette is warm-tinted; its light palette is not.

## Measured Evidence (Assessment B)

| Check | prod | refonte |
|---|---|---|
| Detector | exit 0, 0 findings | exit 2, 43 findings |
| axe-core violations (1440 + 390) | 0 | 0 |
| Text nodes below AA | 0 | 0 |
| Tightest contrast | 4.70:1 (+0.20 margin) | 4.50:1 (+0.00 margin) |
| h1 count / levels skipped | 1 / 0 | 1 / 0 |
| Images missing alt | 0 | 0 |
| Touch targets under 44px (effective) | 0 | 0 |
| Focus ring visible, first 15 tabs | 15/15 | 15/15 |
| Reduced-motion content hidden | 0 | 0 |
| 320px horizontal overflow | no | no |
| Mobile nav affordance | `<details>` menu | none |
| Payload (production builds) | 411KB / 25 req, incl. 40KB Poppins | ~415KB, 0 webfont |

## Persona Red Flags

**Jordan (first-timer), refonte:** H1 is three verbless fragments; "budget" first appears in the paragraph below. Clicks "Confiance", lands on unexplained `AES-256-GCM`. No FAQ, no tooltip, support link only in the footer. Three CTA labels, two of which are the same URL.

**Casey (mobile), refonte:** the positioning kicker is `display:none` below 620px. Only fixed element holds "Essayer" at the top of a 9707px page. Screenshots are `object-cover` crops, so app rows are sliced mid-line.

**Casey (mobile), prod:** sticky CTA stops looking tappable over the green Platforms card, and hides the second line of the Solution h2. Final hand-drawn arrow collapses to a speck pointing at nothing.

**Lea (Swiss ex-Excel), prod:** "gratuit aujourd'hui" appears twice with no follow-up, which reads as a pre-announced paywall. `maxime.desogus@gmail.com` is baked into a marketing screenshot.

**Lea, refonte:** the page never names her pain. "Tableur" appears in one clause and never returns. Zero social proof for a free app that wants her salary figures.

## Minor Observations

- prod `Platforms.tsx:37` `bg-lime/15` is a dead class: no `--color-lime` token, 0 matches in the compiled CSS. The intended glow never renders.
- prod `HeroDashboard.tsx:52` has `aria-label` on a `div` with no role (axe: serious, needs review).
- prod FAQ answers run ~91ch, over the 65-75ch target; founder prose ~86ch.
- refonte trust-card body runs ~28ch, causing 3-word ragged lines.
- refonte `FinalCTA.tsx:10` declares `bg-primary text-white`; `globals.css:83` overrides it `!important` to pale mint, leaving a `bg-black/10` decorative circle as a gray smudge behind the primary button.
- refonte focus ring `#006e25` on `#090a0d` = 3.07:1; `.focus-on-dark` exists and is referenced by nothing.
- refonte `globals.css` is committed minified (203 lines, longest 627 chars), and 33 `!important` overrides silently invalidate the Tailwind classes in the `.tsx` files.
- refonte edited root `PRODUCT.md` and `DESIGN.md`, not just the landing: the brand book now says Landing = SF Pro / system.
