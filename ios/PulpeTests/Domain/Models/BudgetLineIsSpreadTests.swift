import Foundation
@testable import Pulpe
import Testing

/// PUL-17 Lot B — the `isSpread` indicator derives from `spreadGroupId`.
///
/// The flag is a model-level computed property (never recomputed inline in a
/// view body) so the mixed-row "Lissé" chip and the detail-page affordance read
/// a single source of truth.
@Suite("BudgetLine.isSpread")
struct BudgetLineIsSpreadTests {
    @Test
    func isSpread_isTrue_whenSpreadGroupIdPresent() {
        var line = TestDataFactory.createBudgetLine()
        line.spreadGroupId = UUID()

        #expect(line.isSpread)
    }

    @Test
    func isSpread_isFalse_whenSpreadGroupIdNil() {
        let line = TestDataFactory.createBudgetLine()

        #expect(line.spreadGroupId == nil)
        #expect(line.isSpread == false)
    }

    @Test
    func isSpread_survivesDecodingFromSpreadResponseLine() throws {
        let groupId = UUID()
        let json = """
        {
          "id": "line-1",
          "budgetId": "budget-1",
          "templateLineId": null,
          "savingsGoalId": null,
          "name": "Impôts",
          "amount": 80,
          "kind": "expense",
          "recurrence": "one_off",
          "isManuallyAdjusted": false,
          "checkedAt": null,
          "createdAt": "2026-06-01T00:00:00Z",
          "updatedAt": "2026-06-01T00:00:00Z",
          "spreadGroupId": "\(groupId.uuidString)"
        }
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let line = try decoder.decode(BudgetLine.self, from: Data(json.utf8))

        #expect(line.spreadGroupId == groupId)
        #expect(line.isSpread)
    }
}
