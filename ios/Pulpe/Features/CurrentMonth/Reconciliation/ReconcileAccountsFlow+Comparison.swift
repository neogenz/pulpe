import Foundation

/// Step 2 read from the numbers as they stand: the compared figure, the gap, the suggestions and
/// the screen, recomputed on every render from the month the sheet was opened on.
extension ReconcileAccountsFlow {
    /// One row of the suggestions: an unchecked item of this month.
    struct Suggestion: Identifiable, Equatable {
        enum Target: Equatable {
            case transaction(Transaction)
            case budgetLine(BudgetLine)
        }

        /// The second line: « Prévue ce mois » or the date.
        enum Origin: Equatable {
            case plannedThisMonth
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
            }
        }

        /// What it is as money, whatever list it comes from: a saving shown widens the wording to savings.
        var kind: TransactionKind {
            switch target {
            case .transaction(let transaction): transaction.kind
            case .budgetLine(let line): line.kind
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
        /// The figure « Dans Pulpe, déjà coché » shows: the Accueil's « Solde pointé ».
        let realized: Decimal
        /// The checked balance before this comparison's first check, once a check moved it: struck through.
        let realizedBefore: Decimal?
        /// What the gap reads: the realized balance alone.
        let compared: Decimal
        /// Accounts minus compared: below 0, my accounts have less than Pulpe.
        let gap: Decimal
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
        guard let totalCents else { return nil }
        let compared = realizedBalance
        let gap = AccountReconciliation.difference(totalCents: totalCents, realizedBalance: compared)
        let candidates = AccountReconciliation.rankedPointingCandidates(
            gap: gap, lines: lines, transactions: transactions
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
            }
        }
        return Comparison(
            accounts: AccountReconciliation.amount(cents: totalCents), realized: realizedBalance,
            realizedBefore: realizedBefore(realizedBalance),
            compared: compared, gap: gap,
            suggestions: suggestions,
            screen: AccountReconciliation.comparisonScreen(
                gap: gap, candidateCount: candidates.count, dismissed: isDismissed, salaryMaybeEarly: salary.isEarly
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

    /// « Noter un revenu » from the reasons sheet answers what the sheet was opened on: the same gap on the same
    /// screen. A matching item synced meanwhile keeps the gap but brings the suggestions back; then nothing is
    /// written and the updated step shows.
    func submitReasonIncome(
        gap: Decimal, screen: AccountReconciliation.Screen, current: Comparison?,
        realizedBalance: Decimal, of loadedBudgetId: String
    ) async -> SubmitOutcome {
        guard gap > 0, let current, current.gap == gap, current.screen == screen else { return .ignored }
        return await submitAdjustment(realizedBalance: realizedBalance, of: loadedBudgetId)
    }

    /// Struck through only when it moved by a cent or more, as web and Android compare.
    private func realizedBefore(_ realizedBalance: Decimal) -> Decimal? {
        beforeChecks.flatMap { $0.realized.rounded(2) != realizedBalance.rounded(2) ? $0.realized : nil }
    }

    private func found(compared: Decimal, totalCents: Int) -> Decimal? {
        beforeChecks?.compared.map {
            AccountReconciliation.gapClosedByChecks(
                onAccounts: AccountReconciliation.amount(cents: totalCents),
                comparedBefore: $0, compared: compared
            )
        }
    }

    /// The « Voir les autres » list hands back to step 2 once the figures match. Never while a check is out:
    /// the store shows it checked before the server confirms, and a refusal brings the gap back.
    /// Read on every render, so it compares the two figures instead of ranking the suggestions.
    func closesToCheckList(realizedBalance: Decimal) -> Bool {
        guard !isChecking else { return false }
        guard let totalCents else { return false }
        return AccountReconciliation.difference(totalCents: totalCents, realizedBalance: realizedBalance) == 0
    }

    /// The gap reads the month's « Solde pointé » alone.
    func verdict(realizedBalance: Decimal) -> AccountReconciliation.Verdict? {
        totalCents.map { AccountReconciliation.verdict(totalCents: $0, realizedBalance: realizedBalance) }
    }
}
