import Foundation

enum AppURLs {
    static let terms = URL(string: "https://app.pulpe.app/legal/cgu")!
    static let privacy = URL(string: "https://app.pulpe.app/legal/confidentialite")!
    static let support = URL(string: "https://pulpe.app/support")!
    static let changelog = URL(string: "https://pulpe.app/changelog")!
    static let webappBudgetTemplates = URL(string: "https://app.pulpe.app/budget-templates")!

    /// Where the disclosure is shown. The sentence differs by more than a word, so each
    /// one is its own catalog entry rather than a template assembled from fragments —
    /// assembling would pin the French word order on every language.
    enum LegalDisclosureContext {
        case welcome
        case registration
    }

    /// Builds the legal disclosure with markdown links to the ToS and Privacy URLs.
    ///
    /// The two documents carry DIFFERENT verbs on purpose: the ToS are accepted (a
    /// contract), the privacy policy is acknowledged (art. 13 information). Merging them
    /// under one "tu acceptes" is the blended-acceptance shape GDPR art. 7(2) and EDPB
    /// LD 2/2019 §20 warn against — see `docs/CONSENT.md`.
    ///
    /// The URLs stay out of the translated sentence: a translator sees two opaque
    /// arguments and has no markdown link to break.
    static func legalDisclosure(for context: LegalDisclosureContext) -> AttributedString {
        let termsLabel = AppLocale.string("conditions d'utilisation")
        let privacyLabel = AppLocale.string("politique de confidentialité")
        let markdown = disclosureSentence(
            context,
            terms: "[\(termsLabel)](\(terms.absoluteString))",
            privacy: "[\(privacyLabel)](\(privacy.absoluteString))"
        )
        let plain = disclosureSentence(context, terms: termsLabel, privacy: privacyLabel)
        return (try? AttributedString(markdown: markdown)) ?? AttributedString(plain)
    }

    private static func disclosureSentence(
        _ context: LegalDisclosureContext,
        terms: String,
        privacy: String
    ) -> String {
        switch context {
        case .welcome:
            AppLocale.string("""
                En continuant, tu acceptes nos \(terms) et confirmes avoir pris \
                connaissance de notre \(privacy).
                """)
        case .registration:
            AppLocale.string("""
                En créant ton compte, tu acceptes nos \(terms) et confirmes avoir pris \
                connaissance de notre \(privacy).
                """)
        }
    }
}
