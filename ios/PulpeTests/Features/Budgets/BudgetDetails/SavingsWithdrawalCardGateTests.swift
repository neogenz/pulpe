@testable import Pulpe
import Testing

/// The "mois un peu juste" card rule (PUL-292). Pure so it locks without a
/// view. An existing pioche is deliberately NOT an input: the card returns
/// whenever the current/future month dips back into deficit.
struct SavingsWithdrawalCardGateTests {
    @Test func presentsOnCurrentOrFutureDeficit() {
        #expect(SavingsWithdrawalCardGate.shouldPresent(
            balance: -500,
            isCurrentOrFutureMonth: true,
            isDismissed: false
        ))
    }

    @Test func hiddenWithoutDeficit() {
        #expect(!SavingsWithdrawalCardGate.shouldPresent(
            balance: 0,
            isCurrentOrFutureMonth: true,
            isDismissed: false
        ))
    }

    @Test func deficitGateUsesCentPrecision() {
        #expect(!SavingsWithdrawalCardGate.shouldPresent(
            balance: -0.004,
            isCurrentOrFutureMonth: true,
            isDismissed: false
        ))
        #expect(SavingsWithdrawalCardGate.shouldPresent(
            balance: -0.01,
            isCurrentOrFutureMonth: true,
            isDismissed: false
        ))
    }

    @Test func hiddenOnPastMonth() {
        #expect(!SavingsWithdrawalCardGate.shouldPresent(
            balance: -500,
            isCurrentOrFutureMonth: false,
            isDismissed: false
        ))
    }

    @Test func hiddenOnceDismissed() {
        #expect(!SavingsWithdrawalCardGate.shouldPresent(
            balance: -500,
            isCurrentOrFutureMonth: true,
            isDismissed: true
        ))
    }
}
