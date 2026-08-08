import Foundation
@testable import Pulpe
import Testing

/// Locks the PUL-8 iOS ↔ API contract for `GET /savings-goals/:id/progress`:
/// full decode, the null shape (échéance dépassée → `required`/`paceStatus`
/// null, `isOverdue` true), and the derived bar fractions. `targetDate` must
/// stay a `String` (known ISO-datetime decoder trap).
struct SavingsGoalProgressCodableTests {
    @Test("SavingsGoalPlanMonth decodes availability and defaults legacy payloads to unavailable")
    func planMonth_decodesProvisionabilitySafely() throws {
        let available = try JSONDecoder().decode(SavingsGoalPlanMonth.self, from: Data("""
        {
            "month": 8,
            "year": 2026,
            "state": "gap",
            "isLocked": false,
            "hasBudget": true,
            "isProvisionable": true,
            "plannedAmount": 0,
            "confirmedAmount": 0,
            "plannedCumulative": 0,
            "confirmedCumulative": 0,
            "lines": []
        }
        """.utf8))
        let legacy = try JSONDecoder().decode(SavingsGoalPlanMonth.self, from: Data("""
        {
            "month": 9,
            "year": 2026,
            "state": "gap",
            "isLocked": false,
            "plannedAmount": 0,
            "confirmedAmount": 0,
            "plannedCumulative": 0,
            "confirmedCumulative": 0,
            "lines": []
        }
        """.utf8))

        #expect(available.isProvisionable == true)
        #expect(legacy.isProvisionable == false)
        #expect(available.hasBudget == true)
        #expect(legacy.hasBudget == false)
        #expect(available.isContributionEligible == true)
        #expect(legacy.isContributionEligible == true)
    }

    @Test("SavingsGoalPlanMonth decodes an explicitly ineligible pre-start row")
    func planMonth_decodesContributionEligibility() throws {
        let month = try JSONDecoder().decode(SavingsGoalPlanMonth.self, from: Data("""
        {
            "month": 5, "year": 2026, "state": "past", "isLocked": true,
            "isContributionEligible": false, "plannedAmount": 500,
            "confirmedAmount": 500, "plannedCumulative": 0,
            "confirmedCumulative": 0, "lines": []
        }
        """.utf8))

        #expect(month.isContributionEligible == false)
    }

    @Test("SavingsGoalPlanApply encodes missing periods without a template leg")
    func planApply_encodesMissingPeriodsOnly() throws {
        let payload = SavingsGoalPlanApply(
            monthAdjustments: [.init(budgetLineId: "line-1", amount: 1_000)],
            missingMonthAdjustments: [.init(month: 8, year: 2026, amount: 1_000)]
        )

        let object = try #require(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as? [String: Any]
        )
        let missing = try #require(object["missingMonthAdjustments"] as? [[String: Any]])

        #expect(missing.count == 1)
        #expect(object["templateAdjustments"] == nil)
    }

    @Test("SavingsGoalPlanApply keeps a withdrawal signed and encodes its destination")
    func planApply_encodesLinkedWithdrawalDestination() throws {
        let payload = SavingsGoalPlanApply(
            monthAdjustments: [],
            missingMonthAdjustments: [],
            planWithdrawalAdjustments: [
                .init(month: 9, year: 2026, amount: -4_500, destination: .linkedIncome),
            ]
        )

        let object = try #require(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as? [String: Any]
        )
        let withdrawals = try #require(object["planWithdrawalAdjustments"] as? [[String: Any]])

        #expect(withdrawals.first?["amount"] as? Int == -4_500)
        #expect(withdrawals.first?["destination"] as? String == "linked_income")
    }

    @Test("SavingsGoalProgress decodes the full progress payload")
    func progress_decodesFull() throws {
        let json = Data("""
        {
            "goalId": "11111111-1111-1111-1111-111111111111",
            "status": "ACTIVE",
            "targetAmount": 50000,
            "targetDate": "2027-12-31",
            "plannedCumulative": 12000,
            "plannedProjection": 36000,
            "confirmed": 9000,
            "initialAmount": 3000,
            "achievementPercent": 18,
            "monthsElapsed": 6,
            "monthsRemaining": 18,
            "isOverdue": false,
            "pace": 2000,
            "confirmedPace": 1500,
            "required": 2277.78,
            "projected": 36000,
            "paceStatus": "behind",
            "suggestCompletion": false,
            "linkedLineCount": 2,
            "originalTargetAmount": null,
            "originalCurrency": null,
            "targetCurrency": null,
            "exchangeRate": null
        }
        """.utf8)

        let progress = try JSONDecoder().decode(SavingsGoalProgress.self, from: json)

        #expect(progress.goalId == "11111111-1111-1111-1111-111111111111")
        #expect(progress.status == .active)
        #expect(progress.targetAmount == 50000)
        #expect(progress.targetDate == "2027-12-31")
        #expect(progress.plannedCumulative == 12000)
        #expect(progress.plannedProjection == 36000)
        #expect(progress.confirmed == 9000)
        #expect(progress.initialAmount == 3000)
        #expect(progress.achievementPercent == 18)
        #expect(progress.monthsRemaining == 18)
        #expect(progress.isOverdue == false)
        // JSONDecoder routes Decimal through Double, and so does a Swift Decimal
        // float literal — so compare the rounded value against an exact Decimal
        // (string-parsed) at the 2-decimal precision the UI shows.
        #expect(progress.required?.rounded(2) == Decimal(string: "2277.78"))
        #expect(progress.paceStatus == .behind)
        #expect(progress.suggestCompletion == false)
        #expect(progress.linkedLineCount == 2)
        #expect(progress.originalTargetAmount == nil)
        #expect(progress.targetDateValue == SavingsGoalDateFormatter.parse("2027-12-31"))
        // Bar fractions: confirmed from the server %, projected vs target.
        #expect(progress.confirmedFraction == 0.18)
        #expect(progress.projectedFraction == 0.72)
    }

    @Test("SavingsGoalProgress decodes a targetless open pot without fictitious metrics")
    func progress_decodesTargetlessOpenPot() throws {
        let json = Data("""
        {
            "goalId": "open",
            "status": "ACTIVE",
            "startDate": null,
            "targetAmount": null,
            "targetDate": null,
            "plannedCumulative": 200,
            "plannedProjection": 600,
            "confirmed": 100,
            "initialAmount": 100,
            "achievementPercent": null,
            "monthsElapsed": 1,
            "monthsRemaining": null,
            "isOverdue": false,
            "pace": 200,
            "confirmedPace": 100,
            "required": null,
            "projected": null,
            "paceStatus": null,
            "suggestCompletion": null,
            "linkedLineCount": 1
        }
        """.utf8)

        let progress = try JSONDecoder().decode(SavingsGoalProgress.self, from: json)

        #expect(progress.startDate == nil)
        #expect(progress.targetAmount == nil)
        #expect(progress.targetDate == nil)
        #expect(progress.plannedProjection == 600)
        #expect(progress.achievementPercent == nil)
        #expect(progress.monthsRemaining == nil)
        #expect(progress.projected == nil)
        #expect(progress.suggestCompletion == nil)
        #expect(progress.confirmedFraction == nil)
        #expect(progress.plannedFraction == nil)
    }

    @Test("SavingsGoalProgress decodes the overdue null shape (required/paceStatus null)")
    func progress_decodesOverdueNulls() throws {
        let json = Data("""
        {
            "goalId": "22222222-2222-2222-2222-222222222222",
            "status": "ACTIVE",
            "targetAmount": 10000,
            "targetDate": "2025-01-01",
            "plannedCumulative": 8000,
            "confirmed": 6000,
            "achievementPercent": 60,
            "monthsElapsed": 12,
            "monthsRemaining": -2,
            "isOverdue": true,
            "pace": 666.67,
            "confirmedPace": 500,
            "required": null,
            "projected": 6000,
            "paceStatus": null,
            "suggestCompletion": false,
            "linkedLineCount": 1,
            "originalTargetAmount": null,
            "originalCurrency": null,
            "targetCurrency": null,
            "exchangeRate": null
        }
        """.utf8)

        let progress = try JSONDecoder().decode(SavingsGoalProgress.self, from: json)

        #expect(progress.isOverdue == true)
        #expect(progress.monthsRemaining == -2)
        #expect(progress.initialAmount == 0, "legacy payload without the field defaults to 0")
        #expect(progress.required == nil)
        #expect(progress.paceStatus == nil)
        #expect(progress.targetDate == "2025-01-01")
    }

    @Test("SavingsGoalPaceStatus maps the snake_case on_track raw value")
    func paceStatus_rawValues() {
        #expect(SavingsGoalPaceStatus(rawValue: "behind") == .behind)
        #expect(SavingsGoalPaceStatus(rawValue: "on_track") == .onTrack)
        #expect(SavingsGoalPaceStatus(rawValue: "ahead") == .ahead)
    }

    @Test("projectedFraction guards against a zero / undecrypted target")
    func projectedFraction_zeroTargetGuard() throws {
        let json = Data("""
        {
            "goalId": "33333333-3333-3333-3333-333333333333",
            "status": "ACTIVE",
            "targetAmount": 0,
            "targetDate": "2027-01-01",
            "plannedCumulative": 500,
            "confirmed": 0,
            "achievementPercent": 0,
            "monthsElapsed": 1,
            "monthsRemaining": 12,
            "isOverdue": false,
            "pace": 0,
            "confirmedPace": 0,
            "required": 0,
            "projected": 0,
            "paceStatus": "on_track",
            "suggestCompletion": false,
            "linkedLineCount": 1,
            "originalTargetAmount": null,
            "originalCurrency": null,
            "targetCurrency": null,
            "exchangeRate": null
        }
        """.utf8)

        let progress = try JSONDecoder().decode(SavingsGoalProgress.self, from: json)

        #expect(progress.projectedFraction == 0)
        #expect(progress.confirmedFraction == 0)
    }

    @Test("SavingsGoalContribution decodes its linked transactions")
    func contribution_decodesTransactions() throws {
        let json = Data("""
        {
            "lineId": "11111111-1111-1111-1111-111111111111",
            "name": "Épargne maison",
            "amount": 500,
            "checkedAt": null,
            "budgetMonth": 7,
            "budgetYear": 2026,
            "transactions": [{
                "id": "22222222-2222-2222-2222-222222222222",
                "budgetId": "33333333-3333-3333-3333-333333333333",
                "budgetLineId": "11111111-1111-1111-1111-111111111111",
                "name": "Virement épargne",
                "amount": 500,
                "kind": "saving",
                "transactionDate": "2026-07-10T00:00:00Z",
                "category": null,
                "checkedAt": "2026-07-10T00:00:00Z",
                "createdAt": "2026-07-10T00:00:00Z",
                "updatedAt": "2026-07-10T00:00:00Z",
                "originalAmount": null,
                "originalCurrency": null,
                "targetCurrency": null,
                "exchangeRate": null
            }]
        }
        """.utf8)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let contribution = try decoder.decode(SavingsGoalContribution.self, from: json)

        #expect(contribution.lineId == "11111111-1111-1111-1111-111111111111")
        #expect(contribution.transactions.first?.kind == .saving)
        #expect(contribution.transactions.first?.isChecked == true)
    }
}
