import Foundation

// MARK: - Suggestions + Analytics

extension OnboardingState {
    // Stable UUIDs so a suggestion toggled ON keeps the same identity across
    // amount edits, cold-start persistence restores, and the "was this row
    // sourced from a chip?" check. Manually-added transactions use `UUID()`
    // and never collide with a suggestion, even when the user types the exact
    // same name and type.
    static let chargeSuggestions: [OnboardingTransaction] = [
        makeStaticSuggestion(
            "F1A1E501-C0A5-4000-A000-000000000001",
            amount: 600, type: .expense, name: "Courses / alimentation"
        ),
        makeStaticSuggestion(
            "F1A1E501-C0A5-4000-A000-000000000002",
            amount: 150, type: .expense, name: "Restaurants & sorties"
        ),
        makeStaticSuggestion(
            "F1A1E501-C0A5-4000-A000-000000000003",
            amount: 100, type: .expense, name: "Loisirs & sport"
        )
    ]

    static let savingSuggestions: [OnboardingTransaction] = [
        makeStaticSuggestion(
            "F1A1E501-C0A5-4000-A000-000000000004",
            amount: 500, type: .saving, name: "Épargne"
        ),
        makeStaticSuggestion(
            "F1A1E501-C0A5-4000-A000-000000000005",
            amount: 587, type: .saving, name: "3ème pilier"
        )
    ]

    static let suggestions: [OnboardingTransaction] = chargeSuggestions + savingSuggestions

    /// Builds a suggestion with a compile-time UUID literal. The `?? UUID()` fallback
    /// keeps app boot safe if a literal is ever malformed — unit tests assert all
    /// suggestion UUIDs parse so that fallback path is unreachable in practice.
    private static func makeStaticSuggestion(
        _ id: String,
        amount: Decimal,
        type: TransactionKind,
        name: String
    ) -> OnboardingTransaction {
        OnboardingTransaction(
            id: UUID(uuidString: id) ?? UUID(),
            amount: amount,
            type: type,
            name: name
        )
    }

    /// Maps a transaction's `type` to the analytics `step` bucket so funnels can
    /// slice by where in the onboarding the event happened.
    static func analyticsStep(for kind: TransactionKind) -> String {
        switch kind {
        case .expense: return "charges"
        case .saving:  return "savings"
        case .income:  return "income"
        }
    }

    func captureSuggestionToggled(
        _ suggestion: OnboardingTransaction,
        selected: Bool
    ) {
        AnalyticsService.shared.capture(
            .onboardingSuggestionToggled,
            properties: [
                "step": Self.analyticsStep(for: suggestion.type),
                "suggestion_name": suggestion.name,
                "selected": selected
            ]
        )
    }

    func captureCustomTransactionAdded(_ tx: OnboardingTransaction) {
        // `source` distinguishes manual additions (user typed it in the sheet)
        // from suggestion chips that also land in `addCustomTransaction` later.
        // Today only the manual path calls `addCustomTransaction`, but tagging
        // the source keeps the dashboard honest if call sites change.
        AnalyticsService.shared.capture(
            .customTransactionAdded,
            properties: [
                "step": Self.analyticsStep(for: tx.type),
                "kind": tx.type.rawValue,
                "source": Self.isKnownSuggestion(tx) ? "suggestion" : "manual"
            ]
        )
    }

    func captureCustomTransactionRemoved(_ tx: OnboardingTransaction) {
        AnalyticsService.shared.capture(
            .customTransactionRemoved,
            properties: [
                "step": Self.analyticsStep(for: tx.type),
                "kind": tx.type.rawValue,
                "source": Self.isKnownSuggestion(tx) ? "suggestion" : "manual"
            ]
        )
    }

    static func isKnownSuggestion(_ tx: OnboardingTransaction) -> Bool {
        suggestions.contains { $0.id == tx.id }
    }
}
