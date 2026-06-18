import Foundation

extension SupportedCurrency {
    var flag: String {
        switch self {
        case .chf: "🇨🇭"
        case .eur: "🇪🇺"
        }
    }

    var nativeName: String {
        switch self {
        case .chf: "Franc suisse"
        case .eur: "Euro"
        }
    }

    /// Display symbol used as suffix on amounts — mirrors `CURRENCY_METADATA` in
    /// `shared/src/currency.ts`. CHF keeps the three-letter code (Swiss banking
    /// convention), EUR uses the euro sign for naturalness in fr-CH and fr-FR.
    var symbol: String {
        switch self {
        case .chf: "CHF"
        case .eur: "€"
        }
    }

    /// Separator for NUMERIC month/year & date badges, mirroring the webapp's
    /// `getDateDisplayFormats(currency)` (`date-display-formats.ts`): CHF (fr-CH)
    /// uses a dot, EUR (fr-FR) a slash. Named-month displays don't need this.
    var dateSeparator: String {
        switch self {
        case .chf: "."
        case .eur: "/"
        }
    }

    var compactLabel: String {
        "\(flag) \(rawValue)"
    }

    var fullLabel: String {
        "\(flag) \(rawValue) · \(nativeName)"
    }
}
