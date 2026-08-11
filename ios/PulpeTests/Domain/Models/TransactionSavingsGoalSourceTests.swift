import Foundation
@testable import Pulpe
import Testing

/// How a transaction carries the savings goal that funded it (PUL-329): what the
/// wire may or may not send, what survives a toggle, and what the two fields mean
/// once read together.
@MainActor
struct TransactionSavingsGoalSourceTests {
    private func decodeTransaction(sourceFields: String) throws -> Transaction {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let json = Data("""
        {
          "id": "11111111-1111-4111-8111-111111111111",
          "budgetId": "22222222-2222-4222-8222-222222222222",
          "budgetLineId": null,
          "name": "Apport cuisine",
          "amount": 4500,
          "kind": "income",
          "transactionDate": "2026-07-20T10:00:00Z",
          "category": null,
          "checkedAt": null,
          "createdAt": "2026-07-20T10:00:00Z",
          "updatedAt": "2026-07-20T10:00:00Z"\(sourceFields)
        }
        """.utf8)
        return try decoder.decode(Transaction.self, from: json)
    }

    @Test func decoding_withActiveGoalLink_keepsIdentifierAndName() throws {
        let transaction = try decodeTransaction(sourceFields: """
        ,
          "sourceSavingsGoalId": "33333333-3333-4333-8333-333333333333",
          "sourceSavingsGoalName": "Maison"
        """)

        #expect(transaction.sourceSavingsGoalId == "33333333-3333-4333-8333-333333333333")
        #expect(transaction.sourceSavingsGoalName == "Maison")
    }

    @Test func decoding_withDeletedGoal_keepsTheNameWithoutIdentifier() throws {
        let transaction = try decodeTransaction(sourceFields: """
        ,
          "sourceSavingsGoalId": null,
          "sourceSavingsGoalName": "Maison"
        """)

        #expect(transaction.sourceSavingsGoalId == nil)
        #expect(transaction.sourceSavingsGoalName == "Maison")
    }

    @Test func decoding_withoutTheSourceKeys_succeedsWithNoLink() throws {
        let transaction = try decodeTransaction(sourceFields: "")

        #expect(transaction.sourceSavingsGoalId == nil)
        #expect(transaction.sourceSavingsGoalName == nil)
    }

    @Test func toggled_preservesTheGoalOrigin() {
        let transaction = TestDataFactory.createTransaction(
            kind: .income,
            sourceSavingsGoalId: "goal-1",
            sourceSavingsGoalName: "Maison"
        )

        let toggled = transaction.toggled()

        #expect(toggled.sourceSavingsGoalId == "goal-1")
        #expect(toggled.sourceSavingsGoalName == "Maison")
    }

    /// The origin travels on creation only; `TransactionUpdate` has no counterpart,
    /// which the type system enforces. Here we only lock that a plain creation
    /// stays silent rather than sending an explicit null.
    @Test func transactionCreate_sendsTheOriginOnlyWhenOneWasChosen() throws {
        let encodedObject = { (create: TransactionCreate) in
            try JSONSerialization.jsonObject(with: JSONEncoder().encode(create)) as? [String: Any]
        }

        let linked = try encodedObject(TransactionCreate(
            budgetId: "budget-1",
            name: "Apport cuisine",
            amount: 4500,
            kind: .income,
            sourceSavingsGoalId: "goal-1"
        ))
        let plain = try encodedObject(TransactionCreate(
            budgetId: "budget-1",
            name: "Café",
            amount: 4,
            kind: .expense
        ))

        #expect(linked?["sourceSavingsGoalId"] as? String == "goal-1")
        #expect(plain?["sourceSavingsGoalId"] == nil)
    }

    // MARK: - Source of an income (PUL-329)

    @Test("a surviving goal reads as an active source")
    func source_activeWhenTheGoalStillExists() {
        let source = SavingsGoalSource(goalId: "goal-1", name: "Maison")

        #expect(source == .active(goalId: "goal-1", name: "Maison"))
        #expect(source?.isBroken == false)
        #expect(source?.label == "Pris sur Maison")
        #expect(source?.accessibilityLabel == "Revenu pris sur l'objectif Maison")
    }

    /// The deleted goal is history, not a failure: the wording names the goal and
    /// the icon stays out of the warning family.
    @Test("a deleted goal keeps its name and reads as a broken source")
    func source_brokenWhenOnlyTheNameSurvives() {
        let source = SavingsGoalSource(goalId: nil, name: "Maison")

        #expect(source == .broken(name: "Maison"))
        #expect(source?.isBroken == true)
        #expect(source?.label == "Objectif supprimé · Maison")
        #expect(source?.accessibilityLabel == "Revenu pris sur l'objectif supprimé Maison")
        #expect(source?.icon != SavingsGoalSource.active(goalId: "goal-1", name: "Maison").icon)
    }

    @Test("an income with no origin has no source at all")
    func source_absentWithoutAName() {
        #expect(SavingsGoalSource(goalId: nil, name: nil) == nil)
        #expect(SavingsGoalSource(goalId: "goal-1", name: nil) == nil)
    }

    @Test("the source is read straight off the transaction")
    func transaction_exposesItsSource() {
        let linked = TestDataFactory.createTransaction(
            kind: .income,
            sourceSavingsGoalId: "goal-1",
            sourceSavingsGoalName: "Maison"
        )
        let plain = TestDataFactory.createTransaction(kind: .income)

        #expect(linked.savingsGoalSource == .active(goalId: "goal-1", name: "Maison"))
        #expect(plain.savingsGoalSource == nil)
    }
}
