import Foundation

/// SAVINGS GOAL PLAN — client-side monthly simulation (PUL-12+).
///
/// iOS mirror of `shared/src/calculators/savings-goal-plan.ts`. All pure.
///
/// `buildSavingsGoalTimeline` is deliberately NOT mirrored: the server sends
/// `months[]` on `GET /savings-goals/:id/progress`, so the client reads
/// `[SavingsGoalPlanMonth]` directly and never rebuilds the timeline. The three
/// simulator functions ARE mirrored 1:1 with the TS so the live preview equals
/// what the server persists — the server stays authoritative at write time (it
/// recomputes progression after apply). Same doctrine as `SpreadSplit` / PUL-17.
///
/// Amounts run in `Decimal` (never `Double`) except the proportional
/// largest-remainder split in `allocateMonthAmountToLines`, which mirrors the TS
/// float ratios exactly so the two implementations can never drift.
enum SavingsPlanCalculator {
    private static let centsPerUnit = 100

    // MARK: - Types

    /// A per-month override targeting an open plan month.
    struct Adjustment: Sendable, Equatable {
        let month: Int
        let year: Int
        let amount: Decimal
    }

    /// A timeline month enriched with its simulated figures.
    struct SimulatedMonth: Sendable, Equatable, Identifiable {
        let month: SavingsGoalPlanMonth
        let simulatedAmount: Decimal
        let simulatedCumulative: Decimal
        let isAdjusted: Bool

        var id: Int { month.id }
    }

    struct SimulationResult: Sendable, Equatable {
        let months: [SimulatedMonth]
        /// Cumulé final : reality (locked months) + simulated plan (open months).
        let simulatedFinal: Decimal
        /// `targetAmount − simulatedFinal` — signed, nil without a target.
        let gapToTarget: Decimal?
        let isTargetMet: Bool?
        /// First month whose simulated cumulative reaches the target.
        let attainedPeriod: BudgetPeriod?
    }

    struct RedistributeResult: Sendable, Equatable {
        let adjustments: [Adjustment]
        let remainingEffort: Decimal
        let perRemainingMonth: Decimal
        let isDistributable: Bool
    }

    struct AllocatableLine: Sendable, Equatable {
        let budgetLineId: String
        let amount: Decimal
        let checkedAt: String?
    }

    struct LineAllocation: Sendable, Equatable {
        let budgetLineId: String
        let amount: Decimal
    }

    enum SimulationError: Error, Equatable {
        /// An adjustment targeted a locked, gap, or pre-start month — reveals a UI bug in dev
        /// (same doctrine as `splitTotalPreserving` throwing on a non-positive total).
        case adjustmentTargetsLockedOrGapMonth
    }

    // MARK: - Open-month test

    /// A month is editable when it carries at least one unchecked line and is not
    /// locked (past cycle / everything pointé). Gap months (no lines) are never open.
    static func isOpenPlanMonth(_ month: SavingsGoalPlanMonth) -> Bool {
        let hasUncheckedLine = month.lines.contains { $0.checkedAt == nil }
        return !month.isLocked && hasUncheckedLine
    }

    /// A month participates in global simulation and redistribution when it is
    /// editable now or can be created from the linked default template.
    static func isContributivePlanMonth(_ month: SavingsGoalPlanMonth) -> Bool {
        month.isContributionEligible && (isOpenPlanMonth(month) || month.isProvisionable)
    }

    // MARK: - Simulate

    /// Simulates the plan: each locked month keeps its reality (`confirmedAmount`),
    /// each open month takes `adjustment ?? globalMonthlyAmount ?? plannedAmount`.
    /// Its cumulative value can never fall below the amount already confirmed that month.
    /// Targeting a locked or gap month via `adjustments` throws.
    /// `initialAmount` (PUL-293 stock de départ) seeds `simulatedCumulative`.
    static func simulate(
        timeline: [SavingsGoalPlanMonth],
        targetAmount: Decimal?,
        adjustments: [Adjustment] = [],
        globalMonthlyAmount: Decimal? = nil,
        initialAmount: Decimal = 0
    ) throws -> SimulationResult {
        let adjustmentsByKey = try validatedAdjustmentsByPeriod(
            adjustments,
            timeline: timeline
        )

        var months: [SimulatedMonth] = []
        var simulatedCumulative: Decimal = initialAmount
        var attainedPeriod: BudgetPeriod?

        for month in timeline {
            let key = periodKey(month: month.month, year: month.year)
            let isContributive = isContributivePlanMonth(month)

            let simulatedAmount: Decimal
            var isAdjusted = false
            if !month.isContributionEligible {
                simulatedAmount = 0
            } else if !isContributive {
                simulatedAmount = month.confirmedAmount
            } else if let override = adjustmentsByKey[key] {
                simulatedAmount = override
                isAdjusted = true
            } else if let global = globalMonthlyAmount {
                simulatedAmount = global
                isAdjusted = global != month.plannedAmount
            } else {
                simulatedAmount = month.plannedAmount
            }

            if month.isContributionEligible {
                simulatedCumulative += max(simulatedAmount, month.confirmedAmount)
            }

            // Outside the guard, and AFTER the max: a retrait is a stock outflow.
            // It never competes with the month's contribution, and it does not
            // depend on the contribution window — a goal opened with a starting
            // stock can be drawn on before its first planned line.
            //
            // A retrait ANNONCÉ weighs only for the part not yet taken, which the
            // server already deducted per month: adding the full announced amount
            // would count the realized part twice.
            simulatedCumulative -= month.withdrawnAmount + month.remainingPlannedWithdrawalAmount
            if let targetAmount,
               attainedPeriod == nil,
               month.isContributionEligible,
               targetAmount > 0,
               simulatedCumulative >= targetAmount {
                attainedPeriod = month.period
            }

            months.append(SimulatedMonth(
                month: month, simulatedAmount: simulatedAmount,
                simulatedCumulative: simulatedCumulative, isAdjusted: isAdjusted
            ))
        }

        let simulatedFinal = simulatedCumulative
        let isTargetMet = targetAmount.map { $0 > 0 && simulatedFinal >= $0 }
        return SimulationResult(
            months: months, simulatedFinal: simulatedFinal,
            gapToTarget: targetAmount.map { $0 - simulatedFinal },
            isTargetMet: isTargetMet,
            // A retrait makes the curve non-monotonic: a cumulative can cross the
            // target and then fall back under it. Announcing « atteint en mars »
            // under a final below the target would make the verdict lie.
            attainedPeriod: isTargetMet == false ? nil : attainedPeriod
        )
    }

    private static func validatedAdjustmentsByPeriod(
        _ adjustments: [Adjustment],
        timeline: [SavingsGoalPlanMonth]
    ) throws -> [Int: Decimal] {
        let adjustmentsByKey = Dictionary(
            adjustments.map { (periodKey(month: $0.month, year: $0.year), $0.amount) },
            uniquingKeysWith: { _, latest in latest }
        )
        let contributiveKeys = Set(timeline
            .filter(isContributivePlanMonth)
            .map { periodKey(month: $0.month, year: $0.year) })
        guard adjustmentsByKey.keys.allSatisfy(contributiveKeys.contains) else {
            throw SimulationError.adjustmentTargetsLockedOrGapMonth
        }
        return adjustmentsByKey
    }

    // MARK: - Redistribute remaining effort

    /// « Réajuster la suite » — spreads the remaining effort over the open,
    /// non-pinned months cents-exact via `SpreadSplit`. Generalisation of PUL-290
    /// (`remainingToProvision` / `perRemainingMonth`).
    ///
    /// `remaining = max(0, target − initialAmount − Σ confirmed(locked months)
    /// + Σ (withdrawn + remainingPlannedWithdrawal)(every month) − Σ pinned
    /// open)`. A retrait enters with a plus — money taken back is effort to
    /// redo, announced or already gone. It is summed over EVERY month of the
    /// timeline, unconditionally: that is exactly the set `simulate` subtracts,
    /// and the equality is what makes the simulation land back on the target.
    /// `isDistributable = false` when no open, non-pinned month remains (overdue).
    /// `initialAmount` (PUL-293 stock de départ) is deducted before distributing.
    static func redistributeRemainingEffort(
        timeline: [SavingsGoalPlanMonth],
        targetAmount: Decimal?,
        pinnedAdjustments: [Adjustment] = [],
        initialAmount: Decimal = 0
    ) -> RedistributeResult {
        guard let targetAmount else {
            return RedistributeResult(
                adjustments: [],
                remainingEffort: 0,
                perRemainingMonth: 0,
                isDistributable: false
            )
        }

        var pinnedByKey: [Int: Decimal] = [:]
        for pin in pinnedAdjustments {
            pinnedByKey[periodKey(month: pin.month, year: pin.year)] = pin.amount
        }

        let openMonths = timeline.filter { isContributivePlanMonth($0) }
        let openUnpinned = openMonths.filter { pinnedByKey[periodKey(month: $0.month, year: $0.year)] == nil }

        let lockedConfirmedSum = timeline
            .filter { $0.isContributionEligible && $0.isLocked }
            .reduce(Decimal(0)) { $0 + $1.confirmedAmount }

        let withdrawnSum = timeline
            .reduce(Decimal(0)) { $0 + $1.withdrawnAmount + $1.remainingPlannedWithdrawalAmount }

        let pinnedSum = openMonths
            .compactMap { pinnedByKey[periodKey(month: $0.month, year: $0.year)] }
            .reduce(Decimal(0), +)

        let remaining = max(
            0,
            targetAmount - initialAmount - lockedConfirmedSum + withdrawnSum - pinnedSum
        )

        let hasUnavailablePeriod = timeline.contains {
            $0.isContributionEligible && !$0.isLocked && !isContributivePlanMonth($0)
        }

        if hasUnavailablePeriod || openUnpinned.isEmpty {
            return RedistributeResult(
                adjustments: [],
                remainingEffort: remaining,
                perRemainingMonth: 0,
                isDistributable: false
            )
        }

        let shares: [Decimal] = remaining == 0
            ? Array(repeating: 0, count: openUnpinned.count)
            : SpreadSplit.splitTotalPreserving(total: remaining, partCount: openUnpinned.count)

        let adjustments = zip(openUnpinned, shares).map { month, share in
            Adjustment(month: month.month, year: month.year, amount: share)
        }

        return RedistributeResult(
            adjustments: adjustments,
            remainingEffort: remaining,
            perRemainingMonth: shares.first ?? 0,
            isDistributable: true
        )
    }

    // MARK: - Allocate a month total across its lines

    /// Distributes a monthly total across the UNCHECKED lines of a month,
    /// cents-exact (largest-remainder), proportional to the current amounts.
    /// The requested amount is the complete month total, so checked amounts are
    /// deducted before distributing the remainder. Current open sum zero → equal
    /// split. No remainder → every open line at 0. Checked lines are untouched.
    static func allocateMonthAmountToLines(
        _ lines: [AllocatableLine],
        newMonthAmount: Decimal
    ) -> [LineAllocation] {
        let openLines = lines.filter { $0.checkedAt == nil }
        guard !openLines.isEmpty else { return [] }

        let checkedSum = lines
            .filter { $0.checkedAt != nil }
            .reduce(Decimal(0)) { $0 + $1.amount }
        let openTarget = max(0, newMonthAmount - checkedSum)

        if openTarget <= 0 {
            return openLines.map { LineAllocation(budgetLineId: $0.budgetLineId, amount: 0) }
        }

        let currentSum = openLines.reduce(Decimal(0)) { $0 + $1.amount }
        if currentSum <= 0 {
            let shares = SpreadSplit.splitTotalPreserving(total: openTarget, partCount: openLines.count)
            return zip(openLines, shares).map { LineAllocation(budgetLineId: $0.budgetLineId, amount: $1) }
        }

        let totalCents = NSDecimalNumber(
            decimal: (openTarget * Decimal(centsPerUnit)).rounded(0, .plain)
        ).intValue
        let currentSumDouble = NSDecimalNumber(decimal: currentSum).doubleValue

        let raw = openLines.map { line -> Double in
            let amount = NSDecimalNumber(decimal: line.amount).doubleValue
            return (amount / currentSumDouble) * Double(totalCents)
        }
        let floors = raw.map { Int($0.rounded(.down)) }
        var remainderCents = totalCents - floors.reduce(0, +)

        let order = raw.enumerated()
            .map { (index: $0.offset, frac: $0.element - $0.element.rounded(.down)) }
            .sorted { $0.frac > $1.frac }

        var cents = floors
        for entry in order {
            if remainderCents <= 0 { break }
            cents[entry.index] += 1
            remainderCents -= 1
        }

        return zip(openLines, cents).map { line, value in
            LineAllocation(budgetLineId: line.budgetLineId, amount: Decimal(value) / Decimal(centsPerUnit))
        }
    }

    // MARK: - Suggested monthly contribution (PUL-285 CA1/CA6)

    /// Mirror of shared `suggestedMonthlyContribution`: amount left to save ÷
    /// months remaining (payDay-aware, current AND deadline months inclusive —
    /// same base as formula 5 `required = max(0, target − confirmed) / months`,
    /// where confirmed at creation reduces to the initial amount), rounded UP
    /// to the cent so `suggestion × months ≥ remaining`. `nil` when the
    /// deadline is already past, the target is not positive, or the initial
    /// amount already covers the target (nothing left to decompose).
    static func suggestedMonthlyContribution(
        targetAmount: Decimal,
        targetDate: Date,
        payDayOfMonth: Int?,
        startDate: Date? = nil,
        initialAmount: Decimal = 0,
        now: Date = Date()
    ) -> Decimal? {
        let current = BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: payDayOfMonth)
        let start = startDate.map {
            BudgetPeriodCalculator.periodForDate($0, payDayOfMonth: payDayOfMonth)
        }
        let target = BudgetPeriodCalculator.periodForDate(targetDate, payDayOfMonth: payDayOfMonth)
        let currentIndex = periodKey(month: current.month, year: current.year)
        let startIndex = start.map { periodKey(month: $0.month, year: $0.year) } ?? currentIndex
        let effectiveStartIndex = max(currentIndex, startIndex)
        let monthsRemaining = periodKey(month: target.month, year: target.year)
            - effectiveStartIndex + 1
        guard monthsRemaining > 0, targetAmount > 0 else { return nil }
        let remaining = targetAmount - initialAmount
        guard remaining > 0 else { return nil }

        var rawCents = remaining / Decimal(monthsRemaining) * Decimal(centsPerUnit)
        var roundedCents = Decimal()
        NSDecimalRound(&roundedCents, &rawCents, 0, .up)
        return roundedCents / Decimal(centsPerUnit)
    }

    // MARK: - Helpers

    private static func periodKey(month: Int, year: Int) -> Int {
        year * 12 + month
    }
}
