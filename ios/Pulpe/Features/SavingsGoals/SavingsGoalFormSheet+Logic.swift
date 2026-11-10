import Foundation

/// Pure rules of the goal form: date ranges, PATCH diffing, submit gates.
extension SavingsGoalFormSheet {
    nonisolated static func targetDateRange(
        goal: SavingsGoal?,
        now: Date,
        calendar: Calendar
    ) -> ClosedRange<Date> {
        let today = calendar.startOfDay(for: now)
        let monthComponents = calendar.dateComponents([.year, .month], from: today)
        let currentMonth = calendar.date(from: monthComponents) ?? today
        let lastPeriodStart = calendar.date(byAdding: .month, value: 119, to: currentMonth) ?? currentMonth
        let nextPeriodStart = calendar.date(byAdding: .month, value: 1, to: lastPeriodStart) ?? lastPeriodStart
        let planningMaximum = calendar.date(byAdding: .day, value: -1, to: nextPeriodStart) ?? lastPeriodStart
        let existingTarget = goal?.targetDate.flatMap {
            SavingsGoalDateFormatter.parse($0, timeZone: calendar.timeZone)
        }

        return min(today, existingTarget ?? today)...max(planningMaximum, existingTarget ?? planningMaximum)
    }

    nonisolated static func targetDateUpdate(
        for date: Date,
        isEnabled: Bool = true,
        original goal: SavingsGoal,
        timeZone: TimeZone = .autoupdatingCurrent
    ) -> String?? {
        let value = isEnabled
            ? SavingsGoalDateFormatter.string(from: date, timeZone: timeZone)
            : nil
        return value == goal.targetDate ? nil : .some(value)
    }

    nonisolated static func startDateUpdate(
        for date: Date,
        isEnabled: Bool,
        original goal: SavingsGoal,
        timeZone: TimeZone = .autoupdatingCurrent
    ) -> String?? {
        let value = isEnabled
            ? SavingsGoalDateFormatter.string(from: date, timeZone: timeZone)
            : nil
        return value == goal.startDate ? nil : .some(value)
    }

    nonisolated static func targetAmountUpdate(
        for value: Decimal?,
        original goal: SavingsGoal
    ) -> Decimal?? {
        value == goal.targetAmount ? nil : .some(value)
    }

    /// Diffs the edited initial amount against the goal's current one (both
    /// normalized to 0 for `nil`) so an untouched field omits the PATCH key
    /// (unchanged) while a cleared field sends explicit `0` (erasure).
    nonisolated static func initialAmountUpdate(for value: Decimal?, original goal: SavingsGoal) -> Decimal? {
        let normalized = value ?? 0
        return normalized == (goal.initialAmount ?? 0) ? nil : normalized
    }

    // Kept explicit so a deadline reconciliation reuses the complete form PATCH.
    // swiftlint:disable:next function_parameter_count
    nonisolated static func editPayload(
        name: String,
        targetAmount: Decimal?,
        initialAmount: Decimal?,
        startDate: Date,
        hasStartDate: Bool,
        targetDate: Date,
        hasTargetDate: Bool,
        original goal: SavingsGoal
    ) -> SavingsGoalUpdate {
        SavingsGoalUpdate(
            name: name.trimmingCharacters(in: .whitespaces),
            targetAmount: targetAmountUpdate(for: targetAmount, original: goal),
            targetDate: targetDateUpdate(for: targetDate, isEnabled: hasTargetDate, original: goal),
            initialAmount: initialAmountUpdate(for: initialAmount, original: goal),
            startDate: startDateUpdate(for: startDate, isEnabled: hasStartDate, original: goal)
        )
    }

    nonisolated static func isTargetDateSubmittable(
        _ date: Date,
        original goal: SavingsGoal?,
        planningRange: ClosedRange<Date>,
        calendar: Calendar
    ) -> Bool {
        if planningRange.contains(date) { return true }
        guard let existingTarget = goal?.targetDate.flatMap({
            SavingsGoalDateFormatter.parse($0, timeZone: calendar.timeZone)
        }) else { return false }
        return calendar.isDate(date, inSameDayAs: existingTarget)
    }

    nonisolated static func isFormSubmittable(
        name: String,
        targetAmount: Decimal?,
        startDate: Date?,
        targetDate: Date?,
        calendar: Calendar = .current
    ) -> Bool {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        if let targetAmount, targetAmount <= 0 { return false }
        guard let startDate, let targetDate else { return true }
        return calendar.startOfDay(for: startDate) <= calendar.startOfDay(for: targetDate)
    }

    nonisolated static func isMonthlyContributionSubmittable(
        isEditing: Bool,
        decomposeEnabled: Bool,
        hasRemainingToSave: Bool,
        contribution: Decimal?
    ) -> Bool {
        isEditing || !decomposeEnabled || !hasRemainingToSave || (contribution ?? 0) > 0
    }

    nonisolated static func showsManualMonthlyContribution(
        isEditing: Bool,
        hasTargetDate: Bool,
        targetAmount: Decimal?
    ) -> Bool {
        !isEditing && (!hasTargetDate || targetAmount == nil)
    }

    nonisolated static func manualMonthlyContributionHint(hasTargetDate: Bool) -> String {
        hasTargetDate
            ? AppLocale.string("Ce montant sera prévu chaque mois, jusqu'à l'échéance.")
            : AppLocale.string("Ce montant alimentera ton pot chaque mois, sans échéance imposée.")
    }

    /// Two complete sentences, keyed separately: neither is a fragment a
    /// translator has to reassemble, and each fits the line budget.
    static var decomposeContributionHint: String {
        AppLocale.string("Pré-rempli avec cible ÷ mois restants.")
            + " " + AppLocale.string("Ce montant sera prévu sur chacun de tes budgets, jusqu'à l'échéance.")
    }
}

extension SavingsGoalFormSheet {
    /// « Décembre à juin n'ont pas encore de budget : tu les prévois depuis l'objectif. » for the
    /// months after this one, up to the échéance, that have no budget yet. Calendar months: the
    /// pay-day shift does not change which months exist.
    static func monthsWithoutBudgetNote(
        until targetDate: Date,
        budgets: [BudgetSparse],
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> String? {
        let missing = (1...120).lazy
            .compactMap { calendar.date(byAdding: .month, value: $0, to: now) }
            .prefix { calendar.compare($0, to: targetDate, toGranularity: .month) != .orderedDescending }
            .map { calendar.dateComponents([.month, .year], from: $0) }
            .filter { date in !budgets.contains { $0.month == date.month && $0.year == date.year } }
            .compactMap(\.month)
        guard let first = missing.first, let last = Array(missing).last else { return nil }
        let from = Formatters.monthName(for: first)
        guard missing.count > 1 else {
            return AppLocale.string("\(from) n'a pas encore de budget : tu le prévois depuis l'objectif.")
        }
        let to = Formatters.monthNameInText(for: last)
        return AppLocale.string("\(from) à \(to) n'ont pas encore de budget : tu les prévois depuis l'objectif.")
    }
}
