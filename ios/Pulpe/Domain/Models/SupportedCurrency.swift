/// Supported currencies in Pulpe — single source of truth for iOS.
/// Mirrors `supportedCurrencySchema` from `pulpe-shared`.
/// Backend Zod enforces `['CHF', 'EUR']` — decoding a foreign value fails fast (expected).
enum SupportedCurrency: String, CaseIterable, Identifiable, Codable, Sendable, Hashable {
    case chf = "CHF"
    case eur = "EUR"

    var id: String { rawValue }
}
