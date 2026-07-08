import Foundation

/// Temporal/structural state of one plan month (PUL-12+, `docs/SAVINGS_PLAN.md`
/// §2 pilier B). `gap` = no linked line that month (budget not generated / line
/// not tagged) — the row still exists so the cumulative stays continuous.
enum SavingsPlanMonthState: String, Decodable, Sendable, Equatable {
    case past
    case current
    case future
    case gap
}

/// One linked Épargne prévision inside a plan month.
///
/// `checkedAt` stays a `String` for the same reason `SavingsGoal.targetDate` /
/// `SavingsGoalProgress.targetDate` do: the simulator only needs to know whether
/// the line is pointé (`checkedAt != nil`), and decoding a datetime here would
/// drag the ISO8601 decoder into the widget-globbed `Domain/Models`.
struct SavingsGoalPlanLine: Decodable, Sendable, Equatable, Identifiable {
    let budgetLineId: String
    let amount: Decimal
    let checkedAt: String?
    let isManuallyAdjusted: Bool

    var id: String { budgetLineId }
    var isChecked: Bool { checkedAt != nil }
}

/// One month of a savings-goal plan timeline, server-computed and sent on
/// `GET /savings-goals/:id/progress` (`docs/SAVINGS_PLAN.md` §4.2).
///
/// The Swift mirror of `SavingsPlanTimelineMonth` from
/// `shared/src/calculators/savings-goal-plan.ts` — same shape, so
/// `SavingsPlanCalculator` reads it directly (the client never rebuilds the
/// timeline; the server is authoritative). Kept Foundation-only because
/// `Domain/Models` is globbed into `PulpeWidget`.
struct SavingsGoalPlanMonth: Decodable, Sendable, Equatable, Identifiable {
    let month: Int
    let year: Int
    let state: SavingsPlanMonthState
    /// Non-editable: strictly-past cycle OR every linked line pointé.
    let isLocked: Bool
    /// Σ `line.amount` of the linked Épargne prévisions this month.
    let plannedAmount: Decimal
    /// Checked-only realised envelope for this month.
    let confirmedAmount: Decimal
    let plannedCumulative: Decimal
    let confirmedCumulative: Decimal
    let lines: [SavingsGoalPlanLine]

    /// Stable period key (`year * 12 + month`) — also the `ForEach` identity.
    var id: Int { year * 12 + month }

    var period: BudgetPeriod { BudgetPeriod(month: month, year: year) }
}

// MARK: - Apply DTO (write path — POST /savings-goals/:id/plan)

/// Line-scoped plan apply payload (`docs/SAVINGS_PLAN.md` §4.3). 1:1 the strict
/// Zod `savingsGoalPlanApplySchema`; Swift's synthesised `Encodable` omits nil so
/// nothing extra leaks. `monthAdjustments` patch materialised `budget_line`s,
/// `templateAdjustments` patch the Mois Type lines behind horizon months.
struct SavingsGoalPlanApply: Encodable, Sendable {
    let monthAdjustments: [MonthAdjustment]
    let templateAdjustments: [TemplateAdjustment]

    struct MonthAdjustment: Encodable, Sendable {
        let budgetLineId: String
        let amount: Decimal
    }

    struct TemplateAdjustment: Encodable, Sendable {
        let templateLineId: String
        let amount: Decimal
    }
}

/// Response of the apply endpoint — the decrypted lines the server rewrote plus
/// the template line ids it touched (drives the recap + cache invalidation).
struct SavingsGoalPlanApplyResult: Decodable, Sendable {
    let updatedLines: [BudgetLine]
    let updatedTemplateLineIds: [String]
}
