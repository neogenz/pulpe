import Foundation
@testable import Pulpe
import Testing

struct SavingsGoalFormSheetTests {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return calendar
    }

    @Test("the target date range covers at most 120 monthly periods")
    func targetDateRange_limitsNewGoalsTo120Periods() throws {
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 7, day: 13)))
        let expectedMaximum = try #require(calendar.date(from: DateComponents(year: 2036, month: 6, day: 30)))

        let range = SavingsGoalFormSheet.targetDateRange(
            goal: nil,
            now: now,
            calendar: calendar
        )

        #expect(range.lowerBound == now)
        #expect(range.upperBound == expectedMaximum)
    }

    @Test("editing preserves an existing target date outside the current range")
    func targetDateRange_preservesExistingTarget() throws {
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 7, day: 13)))
        let existingTarget = try #require(calendar.date(from: DateComponents(year: 2037, month: 1, day: 15)))
        let goal = SavingsGoal(
            id: "goal-1",
            userId: "user-1",
            name: "Maison",
            targetAmount: 100_000,
            targetDate: "2037-01-15",
            status: .active,
            createdAt: now,
            updatedAt: now
        )

        let range = SavingsGoalFormSheet.targetDateRange(
            goal: goal,
            now: now,
            calendar: calendar
        )

        #expect(range.upperBound == existingTarget)
        #expect(
            SavingsGoalFormSheet.targetDateUpdate(
                for: existingTarget,
                original: goal,
                timeZone: calendar.timeZone
            ) == nil
        )
    }
}
