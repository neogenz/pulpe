import Foundation

enum AppURLs {
    // swiftlint:disable force_unwrapping
    static let terms = URL(string: "https://app.pulpe.app/legal/cgu")!
    static let privacy = URL(string: "https://app.pulpe.app/legal/confidentialite")!
    static let support = URL(string: "https://pulpe.app/support")!
    static let changelog = URL(string: "https://pulpe.app/changelog")!
    static let webappBudgetTemplates = URL(string: "https://app.pulpe.app/budget-templates")!
    // swiftlint:enable force_unwrapping

    /// Builds a French legal disclosure with markdown links to the ToS and Privacy URLs.
    ///
    /// The two documents carry DIFFERENT verbs on purpose: the ToS are accepted (a
    /// contract), the privacy policy is acknowledged (art. 13 information). Merging them
    /// under one "tu acceptes" is the blended-acceptance shape GDPR art. 7(2) and EDPB
    /// LD 2/2019 §20 warn against — see `docs/CONSENT.md`.
    static func legalDisclosure(prefix: String, connector: String, suffix: String = "") -> AttributedString {
        let md = "\(prefix) [conditions d'utilisation](\(terms.absoluteString))"
            + " et confirmes avoir pris connaissance de \(connector)"
            + " [politique de confidentialité](\(privacy.absoluteString))\(suffix)"
        let fallback = "\(prefix) conditions d'utilisation et confirmes avoir pris connaissance de"
            + " \(connector) politique de confidentialité\(suffix)"
        return (try? AttributedString(markdown: md)) ?? AttributedString(fallback)
    }
}
