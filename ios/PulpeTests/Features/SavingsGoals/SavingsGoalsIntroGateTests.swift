@testable import Pulpe
import Testing

/// The "show the Objectifs intro exactly once" rule. Pure so it locks without
/// a view — the `@AppStorage` flag drives `shouldPresentIntro` in the list.
struct SavingsGoalsIntroGateTests {
    @Test func presentsWhenUnseen() {
        #expect(SavingsGoalsIntroGate.shouldPresentIntro(hasSeen: false))
    }

    @Test func hiddenOnceSeen() {
        #expect(!SavingsGoalsIntroGate.shouldPresentIntro(hasSeen: true))
    }
}
