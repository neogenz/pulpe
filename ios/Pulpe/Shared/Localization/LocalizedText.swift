import SwiftUI

/// `.navigationTitle` is the one SwiftUI surface that ignores `\.locale`: measured on
/// iOS 26.5, neither `.navigationTitle("clé")` nor `.navigationTitle(Text("clé"))`
/// re-resolves when the environment locale changes (FB16124687). Everything else —
/// body text, plural variants, toolbar items, alert titles — follows it.
///
/// Resolving the key against the environment locale and handing the result over as
/// `Text(verbatim:)` is what works. Verbatim is required: a plain `Text(resolved)`
/// would look the resolved string up as a key all over again.
private struct LocalizedNavigationTitle: ViewModifier {
    @Environment(\.locale) private var locale
    let key: String.LocalizationValue

    func body(content: Content) -> some View {
        content.navigationTitle(Text(verbatim: AppLocale.string(key, locale: locale)))
    }
}

extension View {
    /// Use instead of `.navigationTitle` everywhere. See `LocalizedNavigationTitle`.
    func localizedNavigationTitle(_ key: String.LocalizationValue) -> some View {
        modifier(LocalizedNavigationTitle(key: key))
    }
}
