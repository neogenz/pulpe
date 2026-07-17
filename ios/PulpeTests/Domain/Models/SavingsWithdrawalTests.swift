import Foundation
@testable import Pulpe
import Testing

/// PUL-292 — the "piocher dans son épargne" model surface: the badge derivation,
/// the pure origin-month arithmetic (with January rollover), and the strict
/// response decode (the two lines + the eventual created budget).
@Suite("Savings withdrawal (PUL-292)")
struct SavingsWithdrawalTests {
    // MARK: - Origin month derivation

    @Test("Origin month is the saving's budget month − 1 (January rolls to December)", arguments: [
        (2, 1),
        (6, 5),
        (12, 11),
        (1, 12),
    ])
    func savingsWithdrawalOriginMonth_derivesPreviousMonth(budgetMonth: Int, expected: Int) {
        #expect(BudgetLine.savingsWithdrawalOriginMonth(forBudgetMonth: budgetMonth) == expected)
    }

    // MARK: - Income badge derivation

    @Test
    func isSavingsWithdrawalIncome_isTrue_forIncomeWithGroupId() {
        var line = TestDataFactory.createBudgetLine(kind: .income)
        line.savingsWithdrawalGroupId = UUID()

        #expect(line.isSavingsWithdrawalIncome)
    }

    @Test
    func isSavingsWithdrawalIncome_isFalse_forSavingHalfOfTheCouple() {
        // The M+1 "Remettre sur ton épargne" line carries the SAME group id but is
        // a saving — the badge is income-only, so it must not light up here.
        var line = TestDataFactory.createBudgetLine(kind: .saving)
        line.savingsWithdrawalGroupId = UUID()

        #expect(line.isSavingsWithdrawalIncome == false)
    }

    @Test
    func isSavingsWithdrawalIncome_isFalse_forOrdinaryIncome() {
        let line = TestDataFactory.createBudgetLine(kind: .income)

        #expect(line.savingsWithdrawalGroupId == nil)
        #expect(line.isSavingsWithdrawalIncome == false)
    }

    // MARK: - Postpone / spread exclusions (CA9)

    @Test
    func isPostponeEligible_excludesSavingsWithdrawalLine() {
        var line = TestDataFactory.createBudgetLine(kind: .expense, recurrence: .oneOff)
        #expect(line.isPostponeEligible(hasAllocatedTransactions: false)) // baseline eligible
        line.savingsWithdrawalGroupId = UUID()
        #expect(line.isPostponeEligible(hasAllocatedTransactions: false) == false) // group id excludes
    }

    // MARK: - Error code localization

    @Test("New savings-withdrawal error codes map to localized copy", arguments: [
        (
            "ERR_SAVINGS_WITHDRAWAL_MONTH_UNPROVISIONABLE",
            "Le mois suivant n'a pas de modèle par défaut — impossible d'y placer le remboursement"
        ),
        (
            "ERR_SAVINGS_WITHDRAWAL_GROUP_NOT_FOUND",
            "Cette pioche est introuvable — elle a peut-être déjà été supprimée"
        ),
        (
            "ERR_SAVINGS_WITHDRAWAL_CONFLICT",
            "Une pioche est déjà en place pour ce mois"
        ),
        (
            "ERR_SAVINGS_WITHDRAWAL_RECALCULATION_FAILED",
            "La pioche a bien été créée, mais les soldes n'ont pas pu être actualisés — "
                + "recharge la page sans relancer la pioche"
        ),
    ])
    func apiError_mapsSavingsWithdrawalCodes(code: String, expected: String) {
        #expect(APIError.from(code: code, message: nil).errorDescription == expected)
    }

    // MARK: - Response decode (strict pair shape)

    @Test
    func response_decodesPair_groupId_andCreatedBudget() throws {
        let groupId = UUID()
        let json = """
        {
          "groupId": "\(groupId.uuidString)",
          "incomeLine": \(Self.lineJSON(id: "income", name: "Mon épargne", kind: "income", groupId: groupId)),
          "savingLine": \(
            Self.lineJSON(id: "saving", name: "Remettre sur ton épargne", kind: "saving", groupId: groupId)
        ),
          "createdBudget": \(Self.budgetJSON(id: "budget-jul", month: 7))
        }
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let response = try decoder.decode(SavingsWithdrawalResponse.self, from: Data(json.utf8))

        #expect(response.groupId == groupId)
        #expect(response.incomeLine.kind == .income)
        #expect(response.incomeLine.savingsWithdrawalGroupId == groupId)
        #expect(response.incomeLine.isSavingsWithdrawalIncome)
        #expect(response.savingLine.kind == .saving)
        #expect(response.savingLine.name == "Remettre sur ton épargne")
        #expect(response.createdBudget?.id == "budget-jul")
    }

    @Test
    func response_decodesNullCreatedBudget_whenMonthAlreadyExisted() throws {
        let groupId = UUID()
        let json = """
        {
          "groupId": "\(groupId.uuidString)",
          "incomeLine": \(Self.lineJSON(id: "income", name: "Impôts", kind: "income", groupId: groupId)),
          "savingLine": \(
            Self.lineJSON(id: "saving", name: "Remettre sur ton épargne", kind: "saving", groupId: groupId)
        ),
          "createdBudget": null
        }
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let response = try decoder.decode(SavingsWithdrawalResponse.self, from: Data(json.utf8))

        #expect(response.createdBudget == nil)
        #expect(response.incomeLine.name == "Impôts")
    }

    // MARK: - Fixtures

    private static func lineJSON(id: String, name: String, kind: String, groupId: UUID) -> String {
        """
        {
          "id": "\(id)",
          "budgetId": "budget-jun",
          "templateLineId": null,
          "savingsGoalId": null,
          "name": "\(name)",
          "amount": 320,
          "kind": "\(kind)",
          "recurrence": "one_off",
          "isManuallyAdjusted": false,
          "checkedAt": null,
          "createdAt": "2026-06-01T00:00:00Z",
          "updatedAt": "2026-06-01T00:00:00Z",
          "savingsWithdrawalGroupId": "\(groupId.uuidString)"
        }
        """
    }

    private static func budgetJSON(id: String, month: Int) -> String {
        """
        {
          "id": "\(id)",
          "month": \(month),
          "year": 2026,
          "description": "Budget",
          "userId": "user-1",
          "templateId": "template-1",
          "endingBalance": null,
          "rollover": null,
          "remaining": null,
          "previousBudgetId": null,
          "createdAt": "2026-06-01T00:00:00Z",
          "updatedAt": "2026-06-01T00:00:00Z"
        }
        """
    }
}
