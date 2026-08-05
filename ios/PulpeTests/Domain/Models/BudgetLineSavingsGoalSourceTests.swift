import Foundation
@testable import Pulpe
import Testing

/// How an income FORECAST carries the goal it announces a withdrawal from
/// (PUL-329 v2). The mirror of `TransactionSavingsGoalSourceTests`, one level up:
/// there the money has moved, here it is only announced.
struct BudgetLineSavingsGoalSourceTests {
    private func decodeLine(sourceFields: String) throws -> BudgetLine {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let json = Data("""
        {
          "id": "11111111-1111-4111-8111-111111111111",
          "budgetId": "22222222-2222-4222-8222-222222222222",
          "templateLineId": null,
          "savingsGoalId": null,
          "name": "Apport cuisine",
          "amount": 500,
          "kind": "income",
          "recurrence": "one_off",
          "isManuallyAdjusted": false,
          "checkedAt": null,
          "createdAt": "2026-08-01T10:00:00Z",
          "updatedAt": "2026-08-01T10:00:00Z"\(sourceFields)
        }
        """.utf8)
        return try decoder.decode(BudgetLine.self, from: json)
    }

    /// The release is staggered: an app shipped with this feature reads budgets
    /// from a server that may not send the keys yet.
    @Test func decoding_withoutTheSourceKeys_succeedsWithNoSource() throws {
        let line = try decodeLine(sourceFields: "")

        #expect(line.sourceSavingsGoalId == nil)
        #expect(line.savingsGoalSource == nil)
        #expect(!line.isPlannedSavingsWithdrawal)
    }

    @Test func decoding_withAnActiveGoal_readsAsAnAnnouncedWithdrawal() throws {
        let line = try decodeLine(sourceFields: """
        ,
          "sourceSavingsGoalId": "33333333-3333-4333-8333-333333333333",
          "sourceSavingsGoalName": "Fonds d'urgence"
        """)

        #expect(line.isPlannedSavingsWithdrawal)
        #expect(line.savingsGoalSource == .active(
            goalId: "33333333-3333-4333-8333-333333333333",
            name: "Fonds d'urgence"
        ))
    }

    /// The goal is gone: its name still tells where the money was meant to come
    /// from, but nothing can be debited any more — so the line stops offering to
    /// be realized and goes back to being an ordinary forecast.
    @Test func decoding_withADeletedGoal_keepsTheProvenanceButStopsBeingRealizable() throws {
        let line = try decodeLine(sourceFields: """
        ,
          "sourceSavingsGoalId": null,
          "sourceSavingsGoalName": "Fonds d'urgence"
        """)

        #expect(line.savingsGoalSource == .broken(name: "Fonds d'urgence"))
        #expect(!line.isPlannedSavingsWithdrawal)
    }

    @Test func toggled_preservesTheAnnouncedOrigin() throws {
        let line = try decodeLine(sourceFields: """
        ,
          "sourceSavingsGoalId": "goal-1",
          "sourceSavingsGoalName": "Fonds d'urgence"
        """)

        let toggled = line.toggled()

        #expect(toggled.sourceSavingsGoalId == "goal-1")
        #expect(toggled.sourceSavingsGoalName == "Fonds d'urgence")
    }

    /// Only the id travels, and only on creation: the name is the server's
    /// snapshot, and the origin is immutable afterwards — which is why
    /// `BudgetLineUpdate` has no counterpart at all (enforced by the type system).
    @Test func budgetLineCreate_sendsTheGoalIdAloneAndOnlyWhenOneWasChosen() throws {
        let encodedObject = { (create: BudgetLineCreate) in
            try JSONSerialization.jsonObject(with: JSONEncoder().encode(create)) as? [String: Any]
        }

        let announced = try encodedObject(BudgetLineCreate(
            budgetId: "budget-1",
            name: "Apport cuisine",
            amount: 500,
            kind: .income,
            recurrence: .oneOff,
            sourceSavingsGoalId: "goal-1"
        ))
        let plain = try encodedObject(BudgetLineCreate(
            budgetId: "budget-1",
            name: "Salaire",
            amount: 5000,
            kind: .income,
            recurrence: .fixed
        ))

        #expect(announced?["sourceSavingsGoalId"] as? String == "goal-1")
        #expect(announced?["sourceSavingsGoalName"] == nil)
        #expect(plain?["sourceSavingsGoalId"] == nil)
    }
}
