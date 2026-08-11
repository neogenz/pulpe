# Design System: Pulpe Android (platform extension)

> Read [DESIGN.md](../DESIGN.md) first — it owns the seeds, the voice, and every rule that
> holds on all four platforms. This file only carries what is true of Android and nowhere
> else. A rule that would apply equally to iOS belongs upstream, not here.

Stack: Expo + React Native, [react-native-paper](https://callstack.github.io/react-native-paper/)
5.x on Material 3. Tokens live in [`src/core/ui/theme.ts`](./src/core/ui/theme.ts).

## Material 3 is the kit, not the direction

The palette is already expressed in MD3 roles — the root doc names primary, secondary and
tertiary, and the webapp runs on Angular Material — so an MD3 kit carries the direction
artistique rather than fighting it.

The split is deliberate, and it is where most of the design judgment lives:

|          | Comes from Paper                                                                                                                                       | Built in `src/ui/`                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **What** | Buttons, text fields, dialogs, snackbars, switches, list rows, the tab bar                                                                             | The hero, amount displays, kind tags, chips, budget line rows, the numpad                       |
| **Why**  | Neutral chrome. Android users already know these; a hand-rolled text field only ever loses to the platform one on focus states, a11y and IME behaviour | Pulpe's signatures. These are what makes the app read as Pulpe rather than as a Material sample |

The failure mode to avoid is the inverse of the usual one: not "we reinvented a button", but
"we let a Material Card render a budget line and the screen stopped looking like Pulpe".

**Never restyle a Paper component into a signature.** A `Card` with a gradient and a custom
corner radius is a hero written the hard way. Signatures are their own components, composing
Paper's primitives where useful.

## Color

`theme.ts` resolves every MD3 role for light and dark. Seeds named in the root doc win; roles
it leaves to the platforms take the values `ios/Pulpe/Shared/Extensions/Color+Pulpe.swift`
already resolved, so the two native apps render the same surface ladder.

Two Android-specific consequences:

- **`colors.error` is amber (`#D4760A`), not red.** MD3 wires `error` into every field
  validation state, and a form error is not a punishment. True red is `FINANCIAL_COLORS
.destructive`, reserved for irreversible actions, and it is deliberately not an MD3 role so
  a component cannot reach it by accident.
- **`FINANCIAL_COLORS` sits outside the theme.** MD3 has no vocabulary for "this amount is
  income", and mapping income onto `tertiary` would make the palette lie about meaning. Read
  them from the export, keyed by color scheme.

`FINANCIAL_COLORS.light.overBudget` is `#905800` rather than the root doc's `#A86800` seed —
it is tuned to clear 4.5:1 on the hero's mint surface, the darkest background it lands on.

## Type

Two families, per the Two-Family Rule:

- **Manrope 800** on `display*` and `headline*` only — hero amounts, brand titles, headline
  numbers. Shipped as the variable TTF in `assets/fonts/`, loaded by `useFonts`.
- **The Android system font (Roboto)** on everything else: titles, body, labels, buttons.
  It is what SF Pro is to iOS — the platform speaking, not a font choice — and it brings the
  user's own font-scale setting with it for free.

A font that fails to load must not hold the splash forever; `_layout.tsx` treats a load error
as ready and falls back to the system face.

Amounts take `TABULAR_DIGITS` (`fontVariant: ["tabular-nums"]`), applied as a style rather
than a component so it composes with whatever renders the amount.

## Spacing, radius, shape

`SPACING` and `RADIUS` mirror `DesignTokens` on iOS so both apps share one rhythm. Use the
tokens, never a raw number.

Paper's `roundness` is set to `RADIUS.sm` (8) — it is a _multiplier base_ for Paper's own
components, not the card radius. Cards use `RADIUS.card` (18) explicitly.

## Dark mode

Both themes are resolved, and `_layout.tsx` picks from `useColorScheme()`. Dark is not a
tint of light: the canvas is `#141210`, warm-black rather than neutral, and the financial
accents lighten so they still clear contrast on it. Anything that reads a color must read it
through the theme or through the scheme-keyed export — a hard-coded hex is a dark-mode bug
that only shows up on someone else's phone.

## No live-preview sidecar

`/impeccable live` drives a browser, so it cannot open this app — same constraint as
`ios/DESIGN.md`. Visual review happens on an emulator or device via screenshots.
