import Foundation

enum AppURLs {
    // swiftlint:disable force_unwrapping
    static let terms = URL(string: "https://app.pulpe.app/legal/cgu")!
    static let privacy = URL(string: "https://app.pulpe.app/legal/confidentialite")!
    static let support = URL(string: "https://pulpe.app/support")!
    static let changelog = URL(string: "https://pulpe.app/changelog")!
    // swiftlint:enable force_unwrapping

    /// Builds a French legal disclosure with markdown links to the ToS and Privacy URLs.
    static func legalDisclosure(prefix: String, connector: String, suffix: String = "") -> AttributedString {
        let md = "\(prefix) [conditions d'utilisation](\(terms.absoluteString))"
            + " et \(connector) [politique de confidentialité](\(privacy.absoluteString))\(suffix)"
        let fallback = "\(prefix) conditions d'utilisation et \(connector) politique de confidentialité\(suffix)"
        return (try? AttributedString(markdown: md)) ?? AttributedString(fallback)
    }
}
