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
}
