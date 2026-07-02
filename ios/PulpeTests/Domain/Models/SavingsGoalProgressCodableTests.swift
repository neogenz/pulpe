import Foundation
@testable import Pulpe
import Testing

/// Locks the PUL-8 iOS ↔ API contract for `GET /savings-goals/:id/progress`:
/// full decode, the null shape (échéance dépassée → `required`/`paceStatus`
/// null, `isOverdue` true), and the derived bar fractions. `targetDate` must
/// stay a `String` (known ISO-datetime decoder trap).
struct SavingsGoalProgressCodableTests {
    @Test("SavingsGoalProgress decodes the full progress payload")
    func progress_decodesFull() throws {
        let json = Data("""
        {
            "goalId": "11111111-1111-1111-1111-111111111111",
            "status": "ACTIVE",
            "targetAmount": 50000,
            "targetDate": "2027-12-31",
            "plannedCumulative": 12000,
            "confirmed": 9000,
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
        #expect(progress.confirmed == 9000)
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
        // Bar fractions: confirmed from the server %, planned vs target.
        #expect(progress.confirmedFraction == 0.18)
        #expect(progress.plannedFraction == 0.24)
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

    @Test("plannedFraction guards against a zero / undecrypted target")
    func plannedFraction_zeroTargetGuard() throws {
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

        #expect(progress.plannedFraction == 0)
        #expect(progress.confirmedFraction == 0)
    }
}
