import Foundation

/// Step 2 read from the numbers as they stand: the compared figure, the gap, the suggestions and
/// the screen, recomputed on every render from the month the sheet was opened on.
extension ReconcileAccountsFlow {
    var context: ReconciliationContext? {
        if case .loaded(let context) = contextState { return context }
        return nil
    }

    /// One row of the suggestions: an unchecked item of this month or of the two before it.
    struct Suggestion: Identifiable, Equatable {
        enum Target: Equatable {
            case transaction(Transaction)
            case budgetLine(BudgetLine)
            case prior(ReconciliationContext.PriorItem)
        }

        /// The second line: « Prévue ce mois », « Mois dernier », « Il y a 2 mois », or the date.
        enum Origin: Equatable {
            case plannedThisMonth
            case monthsAgo(Int)
            case date(Date)
        }

        let target: Target
        let name: String
        let amount: Decimal
        let origin: Origin
        /// Checking it alone settles the gap, and its amount is the gap to the cent.
        let isExact: Bool

        var id: String {
            switch target {
            case .transaction(let transaction): "tx-\(transaction.id)"
            case .budgetLine(let line): "bl-\(line.id)"
            case .prior(let item): "prior-\(item.id)"
            }
        }
    }
}

extension ReconcileAccountsFlow.Suggestion {
    /// An item of the month's list to check, the way a suggestion shows it. Same id as the item.
    init(_ item: CurrentMonthStore.CheckableItem) {
        switch item {
        case .transaction(let transaction, _):
            self.init(
                target: .transaction(transaction), name: transaction.name, amount: transaction.amount,
                origin: .date(transaction.transactionDate), isExact: false
            )
        case .budgetLine(let line, _):
            self.init(
                target: .budgetLine(line), name: line.name, amount: line.amount,
                origin: .plannedThisMonth, isExact: false
            )
        }
    }
}

extension ReconcileAccountsFlow {
    /// Step 2 as the numbers stand, read again on every render.
    struct Comparison: Equatable {
        let accounts: Decimal
        let compared: Decimal
        /// Accounts minus compared: below 0, my accounts have less than Pulpe.
        let gap: Decimal
        let startingAmount: Decimal
        let suggestions: [Suggestion]
        let screen: AccountReconciliation.Screen
        /// What the checks of this comparison closed, once there is one.
        let found: Decimal?
        /// The day of the month the next period starts: « Reviens comparer le 25 ».
        let nextPayDay: Int
    }

    /// `payDayOfMonth` `nil` is the calendar month, which never says the salary may be early.
    func comparison(
        realizedBalance: Decimal, lines: [BudgetLine], transactions: [Transaction], payDayOfMonth: Int? = nil
    ) -> Comparison? {
        guard let context, let totalCents, let compared = comparedFigure(realizedBalance: realizedBalance) else {
            return nil
        }
        let gap = AccountReconciliation.difference(totalCents: totalCents, realizedBalance: compared)
        let candidates = AccountReconciliation.rankedPointingCandidates(
            gap: gap, lines: lines, transactions: transactions,
            priorItems: context.priorItems.map { .init(id: $0.id, effect: $0.effect, monthsAgo: $0.monthsAgo) }
        )
        let target = gap.absoluteValue.rounded(2)
        let salary = salaryTiming(gap: gap, payDayOfMonth: payDayOfMonth)
        let suggestions = candidates.compactMap { candidate -> Suggestion? in
            // A line already partly consumed can settle the gap with an amount that is not the gap.
            let settles = candidate.remainingGap == 0
            switch candidate.source {
            case .budgetLine:
                return lines.first { $0.id == candidate.id }.map {
                    Suggestion(
                        target: .budgetLine($0), name: $0.name, amount: $0.amount,
                        origin: .plannedThisMonth, isExact: settles && $0.amount.rounded(2) == target
                    )
                }
            case .transaction:
                return transactions.first { $0.id == candidate.id }.map {
                    Suggestion(
                        target: .transaction($0), name: $0.name, amount: $0.amount,
                        origin: .date($0.transactionDate), isExact: settles && $0.amount.rounded(2) == target
                    )
                }
            case .prior:
                return context.priorItems.first { $0.id == candidate.id }.map {
                    Suggestion(
                        target: .prior($0), name: $0.name, amount: $0.amount,
                        origin: .monthsAgo($0.monthsAgo), isExact: settles && $0.amount.rounded(2) == target
                    )
                }
            }
        }
        return Comparison(
            accounts: AccountReconciliation.amount(cents: totalCents),
            compared: compared,
            gap: gap,
            startingAmount: context.startingAmount,
            suggestions: suggestions,
            screen: AccountReconciliation.comparisonScreen(
                gap: gap, candidateCount: candidates.count, dismissed: isDismissed,
                first: !context.hasCompletedComparison && context.startingAmount == 0,
                salaryMaybeEarly: salary.isEarly
            ),
            found: found(compared: compared, totalCents: totalCents),
            nextPayDay: salary.nextPayDay
        )
    }

    /// Whether the salary may be early, and the day the next budget month starts as the period rules date
    /// it. Not « end + 1 »: with a pay day of 31, February ends on the 28th and March starts on the 28th too.
    /// A start already reached (that 28th) is today's pay day: the one to come is the month after.
    private func salaryTiming(gap: Decimal, payDayOfMonth: Int?) -> (isEarly: Bool, nextPayDay: Int) {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now())
        let periods = BudgetPeriodCalculator.self
        let current = periods.periodIndex(periods.periodForDate(today, payDayOfMonth: payDayOfMonth))
        let startOf = { (index: Int) -> Date in
            let period = periods.periodFromIndex(index)
            return periods.periodDates(month: period.month, year: period.year, payDayOfMonth: payDayOfMonth).startDate
        }
        let next = startOf(current + 1)
        let start = next > today ? next : startOf(current + 2)
        let daysAway = calendar.dateComponents([.day], from: today, to: start).day ?? 0
        let isEarly = AccountReconciliation.isSalaryMaybeEarly(
            gap: gap, payDayOfMonth: payDayOfMonth, daysUntilNextPeriod: daysAway
        )
        return (isEarly, calendar.component(.day, from: start))
    }

    private func found(compared: Decimal, totalCents: Int) -> Decimal? {
        comparedBeforeChecks.map {
            AccountReconciliation.gapClosedByChecks(
                onAccounts: AccountReconciliation.amount(cents: totalCents), comparedBefore: $0, compared: compared
            )
        }
    }

    /// The « Voir les autres » list hands back to step 2 once nothing is left to do there: the figures
    /// match, or the context read failed and « Réessayer » lives on step 2. Never while a check is out:
    /// the store shows it checked before the server confirms, and a refusal brings the gap back.
    /// Read on every render, so it compares the two figures instead of ranking the suggestions.
    func closesToCheckList(realizedBalance: Decimal) -> Bool {
        guard !isChecking else { return false }
        if contextState == .failed { return true }
        guard let totalCents, let compared = comparedFigure(realizedBalance: realizedBalance) else { return false }
        return AccountReconciliation.difference(totalCents: totalCents, realizedBalance: compared) == 0
    }

    /// « Dans Pulpe, déjà coché »: the checked balance, the previous months' correction and the
    /// starting amount. `nil` until the context is read.
    func comparedFigure(realizedBalance: Decimal) -> Decimal? {
        context.map {
            AccountReconciliation.comparedFigure(
                realizedBalance: realizedBalance, priorCorrection: $0.priorCorrection, startingAmount: $0.startingAmount
            )
        }
    }

    func verdict(realizedBalance: Decimal) -> AccountReconciliation.Verdict? {
        guard let totalCents, let compared = comparedFigure(realizedBalance: realizedBalance) else { return nil }
        return AccountReconciliation.verdict(totalCents: totalCents, realizedBalance: compared)
    }
}
