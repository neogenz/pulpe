/// Supported currencies in Pulpe — single source of truth for iOS.
/// Mirrors `supportedCurrencySchema` from `pulpe-shared`.
enum SupportedCurrency: String, CaseIterable, Identifiable {
    case chf = "CHF"
    case eur = "EUR"

    var id: String { rawValue }
}
