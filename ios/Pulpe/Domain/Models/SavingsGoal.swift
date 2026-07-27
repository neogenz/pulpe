import Foundation

/// Status of a savings goal. In v1 the status is purely a label — it never
/// touches the linked prévisions (see `docs/SAVINGS.md` §6). COMPLETED is
/// reversible.
enum SavingsGoalStatus: String, Codable, Sendable, CaseIterable {
    case active = "ACTIVE"
    case completed = "COMPLETED"
    case paused = "PAUSED"

    var label: String {
        switch self {
        case .active: "Actif"
        case .completed: "Atteint"
        case .paused: "En pause"
        }
    }
}

/// A long-term savings goal (PUL-12).
///
/// `targetAmount` is encrypted at rest on the backend and returned decrypted.
/// Interval dates are bare ISO dates (`YYYY-MM-DD`), not datetimes — they stay
/// strings to match the API and avoid the ISO8601 *datetime* decoder.
struct SavingsGoal: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userId: String?
    let name: String
    var targetAmount: Decimal?
    var targetDate: String?
    let status: SavingsGoalStatus
    let createdAt: Date
    let updatedAt: Date

    /// Optional beginning of the contribution interval.
    var startDate: String?
    /// Stock already saved before tracking started (PUL-293), encrypted at
    /// rest. `nil` when unset — a synthesized memberwise default keeps every
    /// existing call site compilable.
    var initialAmount: Decimal?

    // Currency conversion metadata (dormant in v1 — always null)
    var originalTargetAmount: Decimal?
    var originalCurrency: SupportedCurrency?
    var targetCurrency: SupportedCurrency?
    var exchangeRate: Decimal?

    /// The `targetDate` parsed into a `Date` for display / editing, or `nil` if
    /// the API ever returns a malformed value.
    var targetDateValue: Date? {
        targetDate.flatMap { SavingsGoalDateFormatter.parse($0) }
    }

    var startDateValue: Date? {
        startDate.flatMap { SavingsGoalDateFormatter.parse($0) }
    }
}

// MARK: - Create/Update DTOs

struct SavingsGoalCreate: Encodable {
    let name: String
    var targetAmount: Decimal?
    var targetDate: String?
    let status: SavingsGoalStatus
    /// Opt-in auto-décomposition (PUL-285 CA1/CA6) : montant mensuel choisi —
    /// présence = le serveur crée des prévisions Épargne `one_off` liées dans
    /// les budgets existants jusqu'à l'échéance. `nil` est omis du body.
    var monthlyContribution: Decimal?
    /// Stock déjà épargné avant le suivi (PUL-293). Omis = 0 (défaut serveur).
    var initialAmount: Decimal?
    /// Début explicite facultatif de l'intervalle de contribution.
    var startDate: String?
}

/// Partial update. Double optionals preserve PATCH's three states:
/// outer nil = omitted, `.some(nil)` = JSON null, `.some(value)` = value.
struct SavingsGoalUpdate: Encodable {
    var name: String?
    var targetAmount: Decimal??
    var targetDate: String??
    var status: SavingsGoalStatus?
    /// Omis = inchangé ; `0` efface le montant de départ (miroir serveur).
    var initialAmount: Decimal?
    var startDate: String??
    /// Atomic decision required when an earlier deadline excludes linked
    /// prévisions. Omitted for every ordinary metadata/status update.
    var reconciliation: SavingsGoalGenerationStop?
}

// MARK: - Kind guard

extension TransactionKind {
    /// Only a `saving` prévision may carry a savings-goal link. Mirrors the
    /// backend kind-guard (`kind ≠ saving ⇒ savingsGoalId = null`), so a line
    /// whose kind moved away from `saving` is untagged.
    func savingsGoalLink(_ selection: String?) -> String? {
        self == .saving ? selection : nil
    }
}

// MARK: - ISO date helper

/// Converts between the API's `YYYY-MM-DD` `targetDate` strings and `Date`.
/// Fixed Gregorian/POSIX format, using the device time zone so a date selected
/// at local midnight keeps the same calendar day on the wire.
enum SavingsGoalDateFormatter {
    private static func formatter(timeZone: TimeZone) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }

    static func parse(
        _ string: String,
        timeZone: TimeZone = .autoupdatingCurrent
    ) -> Date? {
        formatter(timeZone: timeZone).date(from: string)
    }

    static func string(
        from date: Date,
        timeZone: TimeZone = .autoupdatingCurrent
    ) -> String {
        formatter(timeZone: timeZone).string(from: date)
    }
}
