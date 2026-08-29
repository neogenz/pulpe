import Foundation
@testable import Pulpe
import Testing

/// `history` on the details payload is the backend's reading of the user's closed months.
/// It is optional on the wire: `null` until a month closes, absent on older backends.
struct DriftHistoryCodableTests {
    private static let budget = """
    {"id":"b-1","month":8,"year":2026,"description":"Août","templateId":"t-1",
     "createdAt":"2026-08-01T00:00:00Z","updatedAt":"2026-08-01T00:00:00Z"}
    """

    private func decode(_ historyField: String) throws -> BudgetDetails {
        let json = """
        {"budget":\(Self.budget),"transactions":[],"budgetLines":[]\(historyField)}
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(BudgetDetails.self, from: Data(json.utf8))
    }

    @Test func decodesTheFiveFields() throws {
        let details = try decode("""
        ,"history":{"usualOutflowDrift":-0.08,"closedMonths":6,"priorStrength":9,
         "driftMad":312.5,"driftProfile":[0.2,0.5,0.8,1]}
        """)
        let history = try #require(details.history)
        #expect(history.usualOutflowDrift == (try #require(Decimal(string: "-0.08"))))
        #expect(history.closedMonths == 6)
        #expect(history.priorStrength == 9)
        #expect(history.driftMad == (try #require(Decimal(string: "312.5"))))
        #expect(history.driftProfile.count == 4)
        #expect(history.driftProfile.last == 1)
    }

    @Test func nullAndAbsentBothMeanNoPrior() throws {
        #expect(try decode(",\"history\":null").history == nil)
        #expect(try decode("").history == nil)
    }

    @MainActor
    @Test func storeHandsTheHistoryToTheTrajectory() throws {
        let store = CurrentMonthStore()
        let history = DriftHistory(
            usualOutflowDrift: -0.08, closedMonths: 6, priorStrength: 9, driftMad: 300,
            driftProfile: [0.25, 0.5, 0.75, 1]
        )
        let now = Date()
        store.populateForTesting(
            budget: TestDataFactory.createBudget(
                month: Calendar.current.component(.month, from: now),
                year: Calendar.current.component(.year, from: now)
            ),
            history: history
        )
        #expect(store.history == history)
        #expect(store.balanceTrajectory?.history == history)
    }

    /// An entry added from the home lands in the store the server already settled it into:
    /// the projection's end moves with it, which is what the chart springs to.
    @MainActor
    @Test func anEntryAddedFromTheHomeMovesTheProjectionEnd() throws {
        let store = CurrentMonthStore()
        let now = Date()
        let budget = TestDataFactory.createBudget(
            month: Calendar.current.component(.month, from: now),
            year: Calendar.current.component(.year, from: now)
        )
        store.populateForTesting(
            budget: budget,
            budgetLines: [
                TestDataFactory.createBudgetLine(id: "pay", budgetId: budget.id, amount: 5_000, kind: .income),
                TestDataFactory.createBudgetLine(id: "rent", budgetId: budget.id, amount: 2_000, kind: .expense),
            ],
            history: DriftHistory(
                usualOutflowDrift: -0.08, closedMonths: 6, priorStrength: 9, driftMad: 300,
                driftProfile: [0.25, 0.5, 0.75, 1]
            )
        )
        let before = try #require(store.balanceTrajectory)
        #expect(!store.isSettling)

        store.addTransaction(TestDataFactory.createTransaction(
            id: "impulse", budgetId: budget.id, amount: 600, kind: .expense
        ))

        let after = try #require(store.balanceTrajectory)
        #expect(after.estimatedBalance == before.estimatedBalance - 600)
        #expect(HomeHeroCard.trend(for: after) < HomeHeroCard.trend(for: before))
    }
}
