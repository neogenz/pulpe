import Foundation
@testable import Pulpe
import Testing

@Suite("Reconciliation wire contract")
struct ReconciliationContextCodableTests {
    @Test
    func context_decodesEveryField_fromTheSuccessEnvelope() throws {
        let json = """
        {
          "success": true,
          "data": {
            "startingAmount": 3100.5,
            "hasCompletedComparison": false,
            "priorCorrection": -40,
            "priorItems": [
              {
                "id": "p1", "source": "transaction", "budgetId": "b0", "name": "Pharmacie",
                "amount": 40, "kind": "expense", "monthsAgo": 1, "effect": -40
              },
              {
                "id": "p2", "source": "budgetLine", "budgetId": "b-1", "name": "Prime",
                "amount": 200, "kind": "income", "monthsAgo": 2, "effect": 200
              }
            ]
          }
        }
        """

        let response = try JSONDecoder().decode(APIResponse<ReconciliationContext>.self, from: Data(json.utf8))
        let context = try #require(response.data)

        #expect(context.startingAmount == Decimal(string: "3100.5"))
        #expect(!context.hasCompletedComparison)
        #expect(context.priorCorrection == -40)
        #expect(context.priorItems.map(\.source) == [.transaction, .budgetLine])
        #expect(context.priorItems.map(\.kind) == [.expense, .income])
        #expect(context.priorItems.map(\.monthsAgo) == [1, 2])
        #expect(context.priorItems.map(\.effect) == [-40, 200])
    }

    @Test
    func context_decodesANewAccount_withNothingBefore() throws {
        let json = """
        {
          "success": true,
          "data": { "startingAmount": 0, "hasCompletedComparison": false, "priorCorrection": 0, "priorItems": [] }
        }
        """

        let response = try JSONDecoder().decode(APIResponse<ReconciliationContext>.self, from: Data(json.utf8))
        let context = try #require(response.data)

        #expect(context.startingAmount == 0)
        #expect(!context.hasCompletedComparison)
        #expect(context.priorCorrection == 0)
        #expect(context.priorItems.isEmpty)
    }

    @Test
    func stateUpdate_sendsOnlyTheFieldsSet() throws {
        let completed = try JSONEncoder().encode(ReconciliationStateUpdate(completed: true))
        let object = try JSONSerialization.jsonObject(with: completed) as? [String: Any]

        #expect(object?.keys.sorted() == ["completed"])
        #expect(object?["completed"] as? Bool == true)
    }
}
