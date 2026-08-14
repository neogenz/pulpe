---
name: xcstrings-probe-decides-autolocalization
description: Probe Localizable.xcstrings to know whether a Swift construct auto-localizes instead of guessing at overload resolution
metadata:
  type: reference
---

`Pulpe/Resources/Localizable.xcstrings` is build-time extracted, so its key set is
the authoritative answer to "does this call site auto-localize?". If the French text
is already a key in the catalog, the compiler resolved that argument as
`LocalizedStringKey` and the site needs no `AppLocale.string` wrap.

Settled empirically during the i18n pass: a **ternary of two string literals** passed
to `.alert(_:isPresented:)`, `Text(_:)`, `.accessibilityValue`, `.accessibilityHint`
and `.accessibilityLabel` still resolves to `LocalizedStringKey` — keys like
`désactivé`, `réduit`, `Recommencer l'inscription ?` and `%@ : montant masqué` are all
in the catalog. Leave those alone.

The mechanism behind that: SwiftUI marks every `StringProtocol` overload
`@_disfavoredOverload`, so any _literal_ expression — including a ternary of two
literals — wins for `LocalizedStringKey`. The corollary bites: `"a " + "b"` is not a
literal, drops to the disfavored `String` overload and silently ships untranslated.
Two multi-line `Text(… + …)` sites in `Features/Auth` were exactly that.

`optional.map { … } ?? "littéral"` splits on what the closure returns: a _literal_
interpolation (`{ "\($0.asCurrency(c))" }`) keeps the whole expression
`LocalizedStringKey` and both halves get extracted; a call returning `String`
(`{ $0.asCompactCurrency(c) }`) pins `T = String` and the `??` default ships
untranslated. The two `.accessibilityValue` sites in `YearOverviewWidgetView` are one
of each with the same `Pas de données` default.

Probe refinement: a key present with an **empty** `localizations` dict is
compiler-extracted but never translated — that is how to tell which of two identical
literals was the extraction source.

Wrapping is only for arguments typed `String` (most Pulpe component params:
`OnboardingSectionHeader.title`, `CurrencyField.label`, `AuthTextField.prompt`,
`SheetFormContainer.title`, `ToastManager.show`, `APIError.serverError(message:)`,
`LoadingView(message:)`), since `Text(String)` does not localize.

Two Apple APIs split the same way and are easy to get wrong together:
`SwiftUI.Tab(_:systemImage:value:)` and `TipKit`'s `Tips.Action(id:title:)` both take
`some StringProtocol`, so any `String` fed to them ships untranslated — while a TipKit
tip's own `title`/`message` are `Text` properties and _do_ auto-localize. Confirm an
Apple overload against the SDK before deciding:
`grep -n 'struct Action' -A 20 "$(xcrun --show-sdk-path --sdk iphonesimulator)/System/Library/Frameworks/TipKit.framework/Modules/TipKit.swiftmodule/arm64-apple-ios-simulator.swiftinterface"`

Merging a `"a " + "b"` site: a bare multi-line literal with a trailing `\` continuation
(`Text("""…\ …""")`) extracts as one flattened single-line key — verified against
`LanguageSettingView`'s footer, which is in the catalog with no newline. So the merge
does not need an `AppLocale.string` wrap inside SwiftUI; both spellings exist in the
tree, and the bare one is the smaller diff.

Probe with:
`python3 -c "import json;s=json.load(open('Pulpe/Resources/Localizable.xcstrings'))['strings'];print('clé' in s)"`

Related: [[applocale-not-string-localized]]
