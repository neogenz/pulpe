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

    var compactLabel: String {
        "\(flag) \(rawValue)"
    }

    var fullLabel: String {
        "\(flag) \(rawValue) · \(nativeName)"
    }
}
