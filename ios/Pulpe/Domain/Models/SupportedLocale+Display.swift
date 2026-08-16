extension SupportedLocale {
    /// The language written in itself. Never translated, and deliberately not a
    /// catalog key: someone hunting for their language scans the list for
    /// `Italiano`, not for `Italien` or `Italienisch`. Mirrors
    /// `LOCALE_METADATA[…].nativeName` in `shared/src/locale.ts`.
    var nativeName: String {
        switch self {
        case .fr: "Français"
        case .en: "English"
        case .de: "Deutsch"
        case .it: "Italiano"
        }
    }
}
