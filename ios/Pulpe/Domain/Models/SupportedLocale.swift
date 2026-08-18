/// Interface languages Pulpe ships — single source of truth for iOS.
/// Mirrors `supportedLocaleSchema` from `pulpe-shared`; the arrested translation
/// of each product term lives in `docs/I18N.md`.
///
/// Bare ISO 639-1, never a regional variant: the region already comes from the
/// currency (`CHF` formats through `de_CH`, `EUR` through `fr_FR`), and a second
/// regional axis here could contradict the first.
enum SupportedLocale: String, CaseIterable, Identifiable, Codable, Sendable, Hashable {
    case fr
    case en
    case de
    case it

    var id: String { rawValue }

    /// The language every missing key falls back to, on every platform.
    static let fallback: SupportedLocale = .fr
}
