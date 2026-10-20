@testable import Pulpe
import Testing

/// The origin of an income is one choice among three (PUL-329 v2). Before, a goal
/// picker and a "je remets le mois prochain" toggle could be armed together and
/// meant two contradictory things — these lock that this can no longer be said.
struct AddBudgetLineIncomeOriginTests {
    private struct Combination {
        let kind: TransactionKind
        let origin: IncomeOrigin
    }

    private static let combinations: [Combination] = TransactionKind.allCases.flatMap { kind in
        IncomeOrigin.allCases.map { Combination(kind: kind, origin: $0) }
    }

    @Test("No combination puts the sheet in both withdrawal modes at once")
    func origins_areMutuallyExclusive() {
        let overlapping = Self.combinations.filter {
            AddBudgetLineSheet.isSavingsWithdrawal(kind: $0.kind, origin: $0.origin)
                && AddBudgetLineSheet.isPlannedWithdrawal(kind: $0.kind, origin: $0.origin)
        }

        #expect(overlapping.isEmpty)
    }

    @Test("Each withdrawal mode answers to exactly one origin, and only on an income")
    func origins_mapToTheirOwnMode() {
        let planned = Self.combinations.filter {
            AddBudgetLineSheet.isPlannedWithdrawal(kind: $0.kind, origin: $0.origin)
        }
        let advance = Self.combinations.filter {
            AddBudgetLineSheet.isSavingsWithdrawal(kind: $0.kind, origin: $0.origin)
        }

        #expect(planned.map(\.origin) == [.savingsGoal])
        #expect(planned.map(\.kind) == [.income])
        #expect(advance.map(\.origin) == [.repayNextMonth])
        #expect(advance.map(\.kind) == [.income])
    }

    /// An announced withdrawal is realized by creating the real income, so it can
    /// never start pointed; the PUL-292 advance routes away before a line exists.
    /// Everything else keeps its toggle.
    @Test("Both withdrawal origins forbid pointing, an ordinary income does not")
    func forbidsChecked_coversBothWithdrawalOriginsOnly() {
        let forbidding = Self.combinations.filter {
            AddBudgetLineSheet.forbidsChecked(kind: $0.kind, origin: $0.origin)
        }
        let forbiddenOrigins = Set(forbidding.map(\.origin))

        #expect(forbiddenOrigins == [.savingsGoal, .repayNextMonth])
        #expect(forbidding.count == forbiddenOrigins.count, "income only — one row per origin")
        #expect(!AddBudgetLineSheet.forbidsChecked(kind: .income, origin: .regular))
    }

    // The sheet asks "from my savings?" then "which?" — two controls over one origin.
    @Test("The savings toggle off is an ordinary income, whatever the segment")
    func toggleOff_isRegular() {
        for savings in SavingsOrigin.allCases {
            #expect(IncomeOrigin(isFromSavings: false, savingsOrigin: savings) == .regular)
        }
        #expect(!IncomeOrigin.regular.isFromSavings)
    }

    @Test("Each segment maps to its own origin and back")
    func segment_roundTrips() {
        #expect(IncomeOrigin(isFromSavings: true, savingsOrigin: .goal) == .savingsGoal)
        #expect(IncomeOrigin(isFromSavings: true, savingsOrigin: .repay) == .repayNextMonth)
        for origin in IncomeOrigin.allCases where origin.isFromSavings {
            #expect(IncomeOrigin(isFromSavings: true, savingsOrigin: origin.savingsOrigin) == origin)
        }
    }

    @Test("Turning the toggle on starts on « D'un objectif »")
    func toggleOn_defaultsToGoal() {
        let turnedOn = IncomeOrigin(isFromSavings: true, savingsOrigin: IncomeOrigin.regular.savingsOrigin)
        #expect(turnedOn == .savingsGoal)
    }
}
