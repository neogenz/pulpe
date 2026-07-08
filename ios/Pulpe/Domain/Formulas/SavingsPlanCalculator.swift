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
        /// `targetAmount − simulatedFinal` — signed, never clamped.
        let gapToTarget: Decimal
        let isTargetMet: Bool
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
        /// An adjustment targeted a locked or gap month — reveals a UI bug in dev
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

    // MARK: - Simulate

    /// Simulates the plan: each locked month keeps its reality (`confirmedAmount`),
    /// each open month takes `adjustment ?? globalMonthlyAmount ?? plannedAmount`.
    /// Targeting a locked or gap month via `adjustments` throws.
    static func simulate(
        timeline: [SavingsGoalPlanMonth],
        targetAmount: Decimal,
        adjustments: [Adjustment] = [],
        globalMonthlyAmount: Decimal? = nil
    ) throws -> SimulationResult {
        var adjustmentsByKey: [Int: Decimal] = [:]
        for adjustment in adjustments {
            adjustmentsByKey[periodKey(month: adjustment.month, year: adjustment.year)] = adjustment.amount
        }

        let openKeys = Set(
            timeline
                .filter { isOpenPlanMonth($0) }
                .map { periodKey(month: $0.month, year: $0.year) }
        )
        for key in adjustmentsByKey.keys where !openKeys.contains(key) {
            throw SimulationError.adjustmentTargetsLockedOrGapMonth
        }

        var months: [SimulatedMonth] = []
        var simulatedCumulative: Decimal = 0
        var attainedPeriod: BudgetPeriod?

        for month in timeline {
            let key = periodKey(month: month.month, year: month.year)
            let isOpen = isOpenPlanMonth(month)

            let simulatedAmount: Decimal
            var isAdjusted = false
            if !isOpen {
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

            simulatedCumulative += simulatedAmount
            if attainedPeriod == nil, targetAmount > 0, simulatedCumulative >= targetAmount {
                attainedPeriod = month.period
            }

            months.append(SimulatedMonth(
                month: month,
                simulatedAmount: simulatedAmount,
                simulatedCumulative: simulatedCumulative,
                isAdjusted: isAdjusted
            ))
        }

        let simulatedFinal = simulatedCumulative
        return SimulationResult(
            months: months,
            simulatedFinal: simulatedFinal,
            gapToTarget: targetAmount - simulatedFinal,
            isTargetMet: targetAmount > 0 && simulatedFinal >= targetAmount,
            attainedPeriod: attainedPeriod
        )
    }

    // MARK: - Redistribute remaining effort

    /// « Réajuster la suite » — spreads the remaining effort over the open,
    /// non-pinned months cents-exact via `SpreadSplit`. Generalisation of PUL-290
    /// (`remainingToProvision` / `perRemainingMonth`).
    ///
    /// `remaining = max(0, target − Σ confirmed(locked months) − Σ pinned open)`.
    /// `isDistributable = false` when no open, non-pinned month remains (overdue).
    static func redistributeRemainingEffort(
        timeline: [SavingsGoalPlanMonth],
        targetAmount: Decimal,
        pinnedAdjustments: [Adjustment] = []
    ) -> RedistributeResult {
        var pinnedByKey: [Int: Decimal] = [:]
        for pin in pinnedAdjustments {
            pinnedByKey[periodKey(month: pin.month, year: pin.year)] = pin.amount
        }

        let openMonths = timeline.filter { isOpenPlanMonth($0) }
        let openUnpinned = openMonths.filter { pinnedByKey[periodKey(month: $0.month, year: $0.year)] == nil }

        let lockedConfirmedSum = timeline
            .filter { !isOpenPlanMonth($0) }
            .reduce(Decimal(0)) { $0 + $1.confirmedAmount }

        let pinnedSum = openMonths
            .compactMap { pinnedByKey[periodKey(month: $0.month, year: $0.year)] }
            .reduce(Decimal(0), +)

        let remaining = max(0, targetAmount - lockedConfirmedSum - pinnedSum)

        if openUnpinned.isEmpty {
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
    /// Current sum zero → equal split. Amount ≤ 0 → every open line at 0. Checked
    /// lines are untouched (absent from the result).
    static func allocateMonthAmountToLines(
        _ lines: [AllocatableLine],
        newMonthAmount: Decimal
    ) -> [LineAllocation] {
        let openLines = lines.filter { $0.checkedAt == nil }
        guard !openLines.isEmpty else { return [] }

        if newMonthAmount <= 0 {
            return openLines.map { LineAllocation(budgetLineId: $0.budgetLineId, amount: 0) }
        }

        let currentSum = openLines.reduce(Decimal(0)) { $0 + $1.amount }
        if currentSum <= 0 {
            let shares = SpreadSplit.splitTotalPreserving(total: newMonthAmount, partCount: openLines.count)
            return zip(openLines, shares).map { LineAllocation(budgetLineId: $0.budgetLineId, amount: $1) }
        }

        let totalCents = NSDecimalNumber(
            decimal: (newMonthAmount * Decimal(centsPerUnit)).rounded(0, .plain)
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

    // MARK: - Helpers

    private static func periodKey(month: Int, year: Int) -> Int {
        year * 12 + month
    }
}
