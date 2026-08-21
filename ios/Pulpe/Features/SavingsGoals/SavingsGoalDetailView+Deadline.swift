import SwiftUI

struct SavingsGoalDeadlineDecision {
    var update: SavingsGoalUpdate
    let targetDate: String
    let lines: [SavingsGoalFutureLine]
}

extension SavingsGoalDetailView {
    @MainActor
    static func refreshedDeadlineDecision(
        id: String,
        update: SavingsGoalUpdate,
        targetDate: String,
        store: SavingsGoalStore
    ) async throws -> SavingsGoalDeadlineDecision? {
        let lines = try await store.getFutureLines(id: id, targetDate: targetDate)
        guard !lines.isEmpty else { return nil }
        var update = update
        update.reconciliation = nil
        return SavingsGoalDeadlineDecision(update: update, targetDate: targetDate, lines: lines)
    }

    nonisolated static func deadlinePreviewTarget(
        previous: String?,
        update: String??,
        payDayOfMonth: Int?
    ) -> String? {
        guard let previous,
              case .some(let updatedValue) = update,
              let updated = updatedValue,
              let previousDate = SavingsGoalDateFormatter.parse(previous),
              let updatedDate = SavingsGoalDateFormatter.parse(updated) else { return nil }
        let previousPeriod = BudgetPeriodCalculator.periodForDate(previousDate, payDayOfMonth: payDayOfMonth)
        let updatedPeriod = BudgetPeriodCalculator.periodForDate(updatedDate, payDayOfMonth: payDayOfMonth)
        return BudgetPeriodCalculator.comparePeriods(updatedPeriod, previousPeriod) < 0 ? updated : nil
    }
}
