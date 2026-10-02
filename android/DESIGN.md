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

## Pulpe's grammar, Android's idioms

Parity with iOS stops where the platform starts. What the root doc and `ios/DESIGN.md` call
Pulpe — the palette, the two zones, the hero's figure, tiles and verdict, the ledger card and
its discs, the pointing circle, Manrope on figures, the voice — is drawn the same here. How a
screen is _operated_ is Android's, never a copy of UIKit:

| iOS does                                                         | Android does                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| The main act as a button in the content, `+` in a navigation bar | A FAB: extended where the act is the screen's purpose, a plus otherwise                      |
| A chevron at the end of a row that opens something               | Nothing — the row ripples under the finger                                                   |
| Section titles and settings headers in small capitals            | Sentence case: `titleLarge` over a section, `titleSmall` in the primary colour over settings |
| `UIImpactFeedbackGenerator` palette                              | `View.performHapticFeedback` with Android's own constants (`haptics.ts`)                     |
| A leading swipe that reveals a button                            | A swipe that commits past its threshold, as Gmail archives                                   |
| A paginated, looping card deck                                   | A horizontal pager, one page per operation, with its position                                |

When a question is "how does iOS do it", the answer is a reference for _what_ the screen says,
never for _how_ the hand gets there.

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
it is tuned to clear 4.5:1 on the onboarding preview's mint surface, the darkest background it
lands on.

The canvas is the sage `#EFF3EE` (`#121611` dark), the value iOS already paints every screen
with, rather than the root doc's neutral `#F7F6F3`: the two native apps read as one product, and
cards sit on it in `surface` — white — so a list is paper on a calm ground. `Card` forces that fill
on Paper's contained mode, whose `surfaceVariant` vanished into the sage.

## Two zones

The Two-Zone Rule is `core/ui/hero.tsx`. Home, the budget list, budget detail and a savings goal
open on the constant forest (`HERO_COLORS`, iOS's `hero*` tokens): `HeroAppBar` is forest too and
holds still while the `HeroZone` gradient scrolls under it — a Material top app bar holding its
colour — and the `ContentZone` rises over the hero on the canvas, its upper corners at
`RADIUS.zone` (28, Material's extra-large shape; iOS's 44 continuous corner reads as a bubble when
drawn circular). Templates, the goal list and settings have no dominant state and stay on the
canvas with `ScreenAppBar` / `TabHeader`.

A hero is composed, never drawn: `HeroFigure` (eyebrow, Manrope figure, smaller currency on the
same line), `HeroTile` (a translucent tile, never a chip), `HeroProgress`, `HeroVerdict` (one
sentence, its accent the only place the state shows, optionally ending in a named link). The status
bar turns light on exactly those routes, decided once from the path (`RouteStatusBar`,
`hero-routes.ts`) because the tabs keep every visited screen mounted.

## Ledger

Every list is one `LedgerCard`: rows separated by hairlines that start under the text column, each
row opening on a 36dp disc (`IconDisc`) in the colour of its nature. A virtualized list draws the
same card in `LedgerSegment`s. A section names itself above its card with `SectionHeader` — Manrope
title, a quiet count, an optional summary amount and a _named_ link (`Tout voir`, `Ajuster`).

On a budget, the disc is the pointing control (`PointCircle`): to point, the row's own disc ringed
in dashes of its colour; pointed, filled with a check, and the name struck through. The disc is 36,
the target Material's 48.

Dragging a row to the right is the second path to the same toggle (`SwipeToPoint`): past its
threshold, letting go points the row — or takes the pointing back — and it springs home, nothing
left uncovered to tap. The circle is never disabled while a pointing is in flight, since the server
flips whatever it holds; only a bounce under 300 ms is dropped.

A row that opens something carries no chevron: the disclosure mark is UIKit's table-view idiom,
and a Material list says "tap me" with its ripple. A section's link is a Material text button.

## Primary actions

A screen's main act is a floating action button, where an Android hand looks for it. The
extended form — icon and label — is spent only where the act is what the screen is for:
`Ajouter` on the home, `Noter un montant` on a line's page. Writing a budget, a goal or a
model happens rarely and each empty state already names it, so those lists carry a plain
plus. A budget's two ways to grow — a forecast or a loose operation — sit behind one
`FAB.Group`. `fab-clearance.spec.ts` holds both rules: a screen with a FAB leaves
`FAB_CLEARANCE` under its content, and only those two screens label theirs.

One notice slot per screen: the most pressing news wins, so a failure never hides under an undo.
On a screen with a FAB the notice rises above it (`clearsFab`), where M3 puts a snackbar.

## Type

Two families, per the Two-Family Rule:

- **Manrope 800** on `display*` and `headline*` only — hero amounts, brand titles, headline
  numbers. Shipped as the variable TTF in `assets/fonts/`, loaded by `useFonts`.
- **The Android system font (Roboto)** on everything else: titles, body, labels, buttons —
  section titles included, which are chrome (`SectionHeader` sets them in `titleLarge`).
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
tint of light: the canvas is `#121611`, a forest-tinted black rather than a neutral one, and the financial
accents lighten so they still clear contrast on it. Anything that reads a color must read it
through the theme or through the scheme-keyed export — a hard-coded hex is a dark-mode bug
that only shows up on someone else's phone.

## Form modals

Android forms open in the native `Modal`-based `FormModal`: a full-width
surface on the warm `SHEET_COLORS` background, anchored to the bottom edge, that
slides up, rounds its top corners (`RADIUS.zone`) and caps its height at 88 percent of the room the keyboard
leaves. The body scrolls, the footer stays pinned: above the keyboard while it
is up, above the navigation bar inset (padded inside the surface, so its colour
runs edge to edge) while it is down. Its header always exposes a translated
close button. While a write is pending, that button, the scrim and the Android
back action all refuse dismissal so partially applied changes cannot disappear.

A form that adds an operation or a forecast leads with what it asks for: the amount, in the same
outlined Material field with its figure set large in Manrope (`AmountField isProminent`), then
four suggestion chips (`QuickAmountChips`, the same 10 / 15 / 20 / 30 iOS offers) through the
chip atom. The order below it is the platform-neutral one — what it is, then the details.

It looks like a bottom sheet and is deliberately not one: no drag handle, no
swipe dismissal, no `@gorhom/bottom-sheet`. A form with a pinned submit button
must not be flicked away mid-entry, the gesture would compete with the body's
scroll and the date pickers inside it, and the native `Modal` already gives the
accessibility focus trap and the back action for free.

## Shell

The navigation bar and the top app bars are Paper chrome, configured once in
`core/ui`. `NavigationBar` wraps `BottomNavigation.Bar` for the router's
`tabBar` prop: four labelled destinations, an active pill on
`secondaryContainer`, a filled icon inside the pill and its outlined twin at
rest, no elevation. `TabHeader` puts `Appbar.Content` in the same flat bar on
`background` that every canvas screen wears (`ScreenAppBar`), with a trailing
slot for the screen's action; hero screens wear `HeroAppBar` instead. None is
styled per screen: a screen that needs a different bar is a screen that needs a
different design, not a prop.

Settings read like Android's own Settings app: each group titled in sentence case in the
primary colour (`SettingsSectionTitle`), rows that open a screen marked by nothing but their
ripple, and only a link that leaves the app carrying `open-in-new`.

Haptics go through `View.performHapticFeedback` with Android's constants — `SEGMENT_TICK` for a
choice, `VIRTUAL_KEY` for a commit, `CONFIRM` and `REJECT` for an outcome — never through the
`Vibrator` waveforms Expo plays for its iOS-named styles. They are the feel of the rest of the
phone, and they stay silent when the user turned touch feedback off.

The account is reachable from the home's bar in every state — loading, empty
and failed included — since it is the only way to the settings.

Hiding amounts remounts the screens (`AmountMaskBoundary`, each navigator's
`screenLayout`): the React Compiler memoizes every formatted amount on its value
and currency, and a re-render alone kept printing the cached figures.

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

The splash background is the app's own canvas (`#EFF3EE` light, `#121611` dark), not the iOS
launch screen's `#F8FAF9` — the splash hands off to the first rendered frame, and matching the
canvas is what makes that handoff invisible.

The splash also drops the wordmark the iOS launch screen sets under the mark. That is the
platform, not a choice: the Android 12 splash API centres exactly one icon and has no second
slot an app can fill.

## No live-preview sidecar

`/impeccable live` drives a browser, so it cannot open this app — same constraint as
`ios/DESIGN.md`. Visual review happens on an emulator or device via screenshots.
