import Foundation

/// First-run gate for the Objectifs intro cover (PUL-12). The decision is
/// extracted from SwiftUI so the "show exactly once" rule is unit-tested
/// without a view. The `@AppStorage` key lives here so the view and any QA
/// reset share one string.
enum SavingsGoalsIntroGate {
    static let storageKey = "hasSeenSavingsGoalsIntro"

    static func shouldPresentIntro(hasSeen: Bool) -> Bool {
        !hasSeen
    }
}
