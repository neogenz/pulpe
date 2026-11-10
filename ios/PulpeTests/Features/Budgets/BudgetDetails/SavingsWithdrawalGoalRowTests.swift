import Foundation
@testable import Pulpe
import Testing

@MainActor
struct SavingsWithdrawalGoalRowTests {
    private func option(available: Decimal) -> SavingsGoalWithdrawalOption {
        SavingsGoalWithdrawalOption(
            goalId: "goal-1", name: "Maison", status: .active, availableAmount: available, currency: .chf
        )
    }

    @Test func offersTheRowWhenAGoalHasMoney() {
        let options = [option(available: 0), option(available: 50)]
        #expect(SavingsWithdrawalSheet.offersGoalWithdrawal(options: options, isFromForecast: false))
    }

    @Test func hidesTheRowWithoutFundedGoal() {
        #expect(!SavingsWithdrawalSheet.offersGoalWithdrawal(options: [option(available: 0)], isFromForecast: false))
        #expect(!SavingsWithdrawalSheet.offersGoalWithdrawal(options: [], isFromForecast: false))
    }

    @Test func hidesTheRowFromAForecast() {
        #expect(!SavingsWithdrawalSheet.offersGoalWithdrawal(options: [option(available: 50)], isFromForecast: true))
    }
}
