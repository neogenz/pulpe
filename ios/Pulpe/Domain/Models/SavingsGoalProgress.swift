import Foundation

/// Rhythm verdict for a savings goal (PUL-8). Computed server-side from the
/// projection vs the target, with a ±5 % tolerance. `nil` when there is no
/// verdict to give (PAUSED goal, or échéance dépassée — see `docs/SAVINGS.md`
/// §4.2 / §6). Épargne is never an alert, so this drives neutral copy only.
enum SavingsGoalPaceStatus: String, Decodable, Sendable, Equatable {
    case behind
    case onTrack = "on_track"
    case ahead
}

/// One linked saving forecast and the real transactions allocated to it.
/// Mirrors `GET /savings-goals/:id/contributions` (PUL-12).
struct SavingsGoalContribution: Decodable, Sendable, Equatable, Identifiable {
    let lineId: String
    let name: String
    let amount: Decimal
    let checkedAt: Date?
    let budgetMonth: Int
    let budgetYear: Int
    let transactions: [Transaction]

    var id: String { lineId }
    var isChecked: Bool { checkedAt != nil }
}

/// Derived progression of a savings goal (PUL-8, `GET /savings-goals/:id/progress`).
///
/// The backend computes **every** figure — the two layers (`plannedCumulative`
/// prévu / `confirmed` pointé), the achievement %, the pace verdict, and the
/// dérived states D1 (`isOverdue`) / D2 (`suggestCompletion`). The client renders,
/// it never recomputes (see `docs/SAVINGS.md` §4).
///
/// Kept dependency-light (Foundation + `SupportedCurrency` + `SavingsGoalPaceStatus`)
/// because `Domain/Models` is globbed into the `PulpeWidget` target — mirror
/// `SavingsGoal.swift`. `targetDate` stays a `String` for the same reason
/// `SavingsGoal.targetDate` does (bare `YYYY-MM-DD`, not a datetime).
struct SavingsGoalProgress: Decodable, Sendable, Equatable {
    let goalId: String
    let status: SavingsGoalStatus
    let targetAmount: Decimal
    let targetDate: String

    /// Σ `line.amount` of linked Épargne prévisions up to now — the engagement.
    let plannedCumulative: Decimal
    /// Checked-only realised total — the money actually pointé.
    let confirmed: Decimal
    /// 0…100, computed on `confirmed` (never on `plannedCumulative`).
    let achievementPercent: Int

    let monthsElapsed: Int
    /// Can be ≤ 0 once the échéance is reached/passed (current month inclusive).
    let monthsRemaining: Int
    let isOverdue: Bool

    let pace: Decimal
    let confirmedPace: Decimal
    /// Per-month amount needed to hit the target — `nil` when overdue.
    let required: Decimal?
    let projected: Decimal
    /// `nil` for PAUSED or échéance dépassée (no rhythm verdict then).
    let paceStatus: SavingsGoalPaceStatus?
    /// D2 — the backend suggests marking COMPLETED; it never auto-flips.
    let suggestCompletion: Bool
    let linkedLineCount: Int

    // Currency conversion metadata (dormant in v1 — always null).
    let originalTargetAmount: Decimal?
    let originalCurrency: SupportedCurrency?
    let targetCurrency: SupportedCurrency?
    let exchangeRate: Decimal?

    // MARK: - Plan enrichment (PUL-12+, docs/SAVINGS.md §10.2 — additive)

    /// Monthly plan timeline, ancrage → cible inclusive. Empty when the goal has
    /// no linked line (or when the server gates `months` behind `?include=`).
    let months: [SavingsGoalPlanMonth]
    /// `plannedCumulative − confirmed` — signed, never clamped. Neutral info
    /// (RG-002): a positive gap is a pointing lag, not an alert.
    let cumulativeGap: Decimal
    /// Attainment period at the confirmed pace, or `nil` (PAUSED / no pace /
    /// degenerate horizon). PayDay-aware `{month, year}` — format via the period.
    let estimatedCompletion: BudgetPeriod?

    /// `targetDate` parsed for display, or `nil` on a malformed value.
    var targetDateValue: Date? {
        SavingsGoalDateFormatter.parse(targetDate)
    }

    /// Progress fraction (0…1) of the confirmed layer, derived from the
    /// server-computed `achievementPercent` so the bar and the % never diverge.
    var confirmedFraction: Double {
        Double(achievementPercent) / 100
    }

    /// Progress fraction (0…1) of the prévu layer against the target. Guarded
    /// against a zero / undecrypted target (never divide by it — §4.3).
    var plannedFraction: Double {
        guard targetAmount > 0 else { return 0 }
        let ratio = ((plannedCumulative / targetAmount) as NSDecimalNumber).doubleValue
        return min(max(ratio, 0), 1)
    }

    // MARK: - Init

    /// Memberwise init kept explicit (a custom `init(from:)` would otherwise
    /// suppress it). New plan fields default to empty so existing callers and
    /// previews stay source-compatible.
    init(
        goalId: String,
        status: SavingsGoalStatus,
        targetAmount: Decimal,
        targetDate: String,
        plannedCumulative: Decimal,
        confirmed: Decimal,
        achievementPercent: Int,
        monthsElapsed: Int,
        monthsRemaining: Int,
        isOverdue: Bool,
        pace: Decimal,
        confirmedPace: Decimal,
        required: Decimal?,
        projected: Decimal,
        paceStatus: SavingsGoalPaceStatus?,
        suggestCompletion: Bool,
        linkedLineCount: Int,
        originalTargetAmount: Decimal?,
        originalCurrency: SupportedCurrency?,
        targetCurrency: SupportedCurrency?,
        exchangeRate: Decimal?,
        months: [SavingsGoalPlanMonth] = [],
        cumulativeGap: Decimal = 0,
        estimatedCompletion: BudgetPeriod? = nil
    ) {
        self.goalId = goalId
        self.status = status
        self.targetAmount = targetAmount
        self.targetDate = targetDate
        self.plannedCumulative = plannedCumulative
        self.confirmed = confirmed
        self.achievementPercent = achievementPercent
        self.monthsElapsed = monthsElapsed
        self.monthsRemaining = monthsRemaining
        self.isOverdue = isOverdue
        self.pace = pace
        self.confirmedPace = confirmedPace
        self.required = required
        self.projected = projected
        self.paceStatus = paceStatus
        self.suggestCompletion = suggestCompletion
        self.linkedLineCount = linkedLineCount
        self.originalTargetAmount = originalTargetAmount
        self.originalCurrency = originalCurrency
        self.targetCurrency = targetCurrency
        self.exchangeRate = exchangeRate
        self.months = months
        self.cumulativeGap = cumulativeGap
        self.estimatedCompletion = estimatedCompletion
    }

    // MARK: - Decoding

    /// Custom decode so the PUL-12+ plan fields stay tolerant of absence: an
    /// older cached payload — or a future `?include=months` gating (§4.2) — decodes
    /// with an empty timeline and a zero gap instead of failing the whole progress.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        goalId = try container.decode(String.self, forKey: .goalId)
        status = try container.decode(SavingsGoalStatus.self, forKey: .status)
        targetAmount = try container.decode(Decimal.self, forKey: .targetAmount)
        targetDate = try container.decode(String.self, forKey: .targetDate)
        plannedCumulative = try container.decode(Decimal.self, forKey: .plannedCumulative)
        confirmed = try container.decode(Decimal.self, forKey: .confirmed)
        achievementPercent = try container.decode(Int.self, forKey: .achievementPercent)
        monthsElapsed = try container.decode(Int.self, forKey: .monthsElapsed)
        monthsRemaining = try container.decode(Int.self, forKey: .monthsRemaining)
        isOverdue = try container.decode(Bool.self, forKey: .isOverdue)
        pace = try container.decode(Decimal.self, forKey: .pace)
        confirmedPace = try container.decode(Decimal.self, forKey: .confirmedPace)
        required = try container.decodeIfPresent(Decimal.self, forKey: .required)
        projected = try container.decode(Decimal.self, forKey: .projected)
        paceStatus = try container.decodeIfPresent(SavingsGoalPaceStatus.self, forKey: .paceStatus)
        suggestCompletion = try container.decode(Bool.self, forKey: .suggestCompletion)
        linkedLineCount = try container.decode(Int.self, forKey: .linkedLineCount)
        originalTargetAmount = try container.decodeIfPresent(Decimal.self, forKey: .originalTargetAmount)
        originalCurrency = try container.decodeIfPresent(SupportedCurrency.self, forKey: .originalCurrency)
        targetCurrency = try container.decodeIfPresent(SupportedCurrency.self, forKey: .targetCurrency)
        exchangeRate = try container.decodeIfPresent(Decimal.self, forKey: .exchangeRate)
        months = try container.decodeIfPresent([SavingsGoalPlanMonth].self, forKey: .months) ?? []
        cumulativeGap = try container.decodeIfPresent(Decimal.self, forKey: .cumulativeGap) ?? 0
        estimatedCompletion = try container.decodeIfPresent(BudgetPeriod.self, forKey: .estimatedCompletion)
    }

    private enum CodingKeys: String, CodingKey {
        case goalId, status, targetAmount, targetDate
        case plannedCumulative, confirmed, achievementPercent
        case monthsElapsed, monthsRemaining, isOverdue
        case pace, confirmedPace, required, projected, paceStatus, suggestCompletion, linkedLineCount
        case originalTargetAmount, originalCurrency, targetCurrency, exchangeRate
        case months, cumulativeGap, estimatedCompletion
    }
}
