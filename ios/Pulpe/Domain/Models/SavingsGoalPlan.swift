import Foundation

/// Temporal/structural state of one plan month (PUL-12+, `docs/SAVINGS.md`
/// §10.2). `gap` = no linked line that month (budget not generated / line
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
/// `GET /savings-goals/:id/progress` (`docs/SAVINGS.md` §10.2).
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
    /// False for rows retained before the effective contribution start.
    let isContributionEligible: Bool
    /// Whether the server found a materialized budget for this period.
    let hasBudget: Bool
    /// Missing linked forecast that the apply endpoint can create.
    let isProvisionable: Bool
    /// Σ `line.amount` of the linked Épargne prévisions this month.
    let plannedAmount: Decimal
    /// Checked-only realised envelope for this month.
    let confirmedAmount: Decimal
    let plannedCumulative: Decimal
    let confirmedCumulative: Decimal
    let lines: [SavingsGoalPlanLine]

    init(
        month: Int,
        year: Int,
        state: SavingsPlanMonthState,
        isLocked: Bool,
        isContributionEligible: Bool = true,
        hasBudget: Bool = false,
        isProvisionable: Bool = false,
        plannedAmount: Decimal,
        confirmedAmount: Decimal,
        plannedCumulative: Decimal,
        confirmedCumulative: Decimal,
        lines: [SavingsGoalPlanLine]
    ) {
        self.month = month
        self.year = year
        self.state = state
        self.isLocked = isLocked
        self.isContributionEligible = isContributionEligible
        self.hasBudget = hasBudget
        self.isProvisionable = isProvisionable
        self.plannedAmount = plannedAmount
        self.confirmedAmount = confirmedAmount
        self.plannedCumulative = plannedCumulative
        self.confirmedCumulative = confirmedCumulative
        self.lines = lines
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        month = try container.decode(Int.self, forKey: .month)
        year = try container.decode(Int.self, forKey: .year)
        state = try container.decode(SavingsPlanMonthState.self, forKey: .state)
        isLocked = try container.decode(Bool.self, forKey: .isLocked)
        isContributionEligible = try container.decodeIfPresent(
            Bool.self,
            forKey: .isContributionEligible
        ) ?? true
        hasBudget = try container.decodeIfPresent(Bool.self, forKey: .hasBudget) ?? false
        isProvisionable = try container.decodeIfPresent(Bool.self, forKey: .isProvisionable) ?? false
        plannedAmount = try container.decode(Decimal.self, forKey: .plannedAmount)
        confirmedAmount = try container.decode(Decimal.self, forKey: .confirmedAmount)
        plannedCumulative = try container.decode(Decimal.self, forKey: .plannedCumulative)
        confirmedCumulative = try container.decode(Decimal.self, forKey: .confirmedCumulative)
        lines = try container.decode([SavingsGoalPlanLine].self, forKey: .lines)
    }

    private enum CodingKeys: String, CodingKey {
        case month, year, state, isLocked, isContributionEligible, hasBudget, isProvisionable
        case plannedAmount, confirmedAmount, plannedCumulative, confirmedCumulative, lines
    }

    /// Stable period key (`year * 12 + month`) — also the `ForEach` identity.
    var id: Int { year * 12 + month }

    var period: BudgetPeriod { BudgetPeriod(month: month, year: year) }

    /// Mirrors the web timeline's `isRepairable` (2 terms, not 5). The
    /// producer (`shared/src/calculators/savings-goal-plan.ts:184-195`, mirrored
    /// here) sets `isProvisionable` only when lines are empty, the month isn't
    /// locked, AND it's contribution-eligible — re-testing those here would
    /// duplicate a guarantee the server already gives every client. `hasBudget`
    /// is NOT implied (`isProvisionable`'s `||` lets `canProvisionMissingPeriods`
    /// substitute for it), so it stays explicit.
    var isRepairable: Bool {
        hasBudget && isProvisionable
    }
}

// MARK: - Apply DTO (write path — POST /savings-goals/:id/plan)

/// Line-scoped plan apply payload (`docs/SAVINGS.md` §10.4). 1:1 the strict
/// Zod `savingsGoalPlanApplySchema`; Swift's synthesised `Encodable` omits nil so
/// nothing extra leaks. `monthAdjustments` patch materialised `budget_line`s;
/// `missingMonthAdjustments` create a linked forecast in an absent or materialised
/// budget period.
struct SavingsGoalPlanApply: Encodable, Sendable {
    let monthAdjustments: [MonthAdjustment]
    let missingMonthAdjustments: [MissingMonthAdjustment]

    struct MonthAdjustment: Encodable, Sendable {
        let budgetLineId: String
        let amount: Decimal
    }

    struct MissingMonthAdjustment: Encodable, Sendable {
        let month: Int
        let year: Int
        let amount: Decimal
    }
}

/// Response of the apply endpoint — the decrypted lines the server rewrote.
struct SavingsGoalPlanApplyResult: Decodable, Sendable {
    let updatedLines: [BudgetLine]
}
