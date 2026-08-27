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

- **`colors.error` is amber (`#9A5500`), not red.** MD3 wires `error` into every field
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

## Form modals

Android forms open in the native `Modal`-based `FormModal`: a centered,
height-capped surface whose body scrolls above the keyboard and whose footer
stays pinned. Its header always exposes a translated close button. While a
write is pending, that button, the backdrop and the Android back action all
refuse dismissal so partially applied changes cannot disappear. This is a
modal form, not a bottom sheet: do not add a drag handle, swipe dismissal or a
bottom-sheet dependency.

## Shell

The navigation bar and the top app bar are Paper chrome, configured once in
`core/ui`. `NavigationBar` wraps `BottomNavigation.Bar` for the router's
`tabBar` prop: four labelled destinations, an active pill on
`secondaryContainer`, a filled icon inside the pill and its outlined twin at
rest, no elevation. `TabHeader` puts `Appbar.Content` in the same flat bar on
`background` that every pushed screen wears (`ScreenAppBar`), with a trailing
slot for the account action. Neither is styled per screen: a tab that needs a
different bar is a tab that needs a different design, not a prop.

## Icon and splash

One brand mark, four renderings. `assets/images/brand-mark.png` is byte-for-byte the file iOS
ships as `PulpeIcon.imageset` and the landing site serves as `icon.png`, so the platforms
cannot drift. Everything else is generated — `./scripts/generate-icons.sh`, needs ImageMagick
— and regenerating is the only supported way to change an icon.

Android asks for more shapes than iOS does, and each has a rule the source file cannot satisfy
on its own:

| Asset                                   | Why it is not just the mark                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adaptive-icon.png` + `backgroundColor` | Launchers mask a 108dp layer down to a 66dp circle. The mark is a wide wedge whose widest points sit on the horizontal diameter, so it is placed at 600px on a 1024px canvas — 626px would touch the circle exactly |
| `icon.png`                              | The legacy square icon (API 24-25, store listings) is never masked, so it carries the near-full-bleed weight of the iOS icon instead                                                                                |
| `adaptive-icon-monochrome.png`          | Android 13 themed icons tint every opaque pixel one colour, which would flatten the mark into a blob. The generator splits on luminance so the segments and rind survive as separate shapes                         |
| `notification-icon.png`                 | The status bar tints the icon itself — any colour is flattened to a white block — so it ships as the same knocked-out silhouette, in white                                                                          |

The adaptive background is `#C6F0BA`, the pale green sampled from the iOS icon's gradient.
Android takes a flat colour here and a gradient is invisible at 48dp.

The splash background is the app's own canvas (`#F7F6F3` light, `#141210` dark), not the iOS
launch screen's `#F8FAF9` — the splash hands off to the first rendered frame, and matching the
canvas is what makes that handoff invisible.

The splash also drops the wordmark the iOS launch screen sets under the mark. That is the
platform, not a choice: the Android 12 splash API centres exactly one icon and has no second
slot an app can fill.

## No live-preview sidecar

`/impeccable live` drives a browser, so it cannot open this app — same constraint as
`ios/DESIGN.md`. Visual review happens on an emulator or device via screenshots.
