import Foundation

/// Status of a savings goal. In v1 the status is purely a label — it never
/// touches the linked prévisions (see `docs/SAVINGS.md` §6). COMPLETED is
/// reversible.
enum SavingsGoalStatus: String, Codable, Sendable, CaseIterable {
    case active = "ACTIVE"
    case completed = "COMPLETED"
    case paused = "PAUSED"
}

/// A long-term savings goal (PUL-12).
///
/// `targetAmount` is encrypted at rest on the backend and returned decrypted.
/// `targetDate` is a bare ISO date (`YYYY-MM-DD`), not a datetime — it is kept as
/// a `String` to match the API exactly and avoid the ISO8601 *datetime* decoder
/// (which would reject `2027-01-01`). FX fields are dormant in v1 (account
/// currency only) and come back `null`.
struct SavingsGoal: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let userId: String?
    let name: String
    let targetAmount: Decimal
    let targetDate: String
    let status: SavingsGoalStatus
    let createdAt: Date
    let updatedAt: Date

    // Currency conversion metadata (dormant in v1 — always null)
    var originalTargetAmount: Decimal?
    var originalCurrency: SupportedCurrency?
    var targetCurrency: SupportedCurrency?
    var exchangeRate: Decimal?

    /// The `targetDate` parsed into a `Date` for display / editing, or `nil` if
    /// the API ever returns a malformed value.
    var targetDateValue: Date? {
        SavingsGoalDateFormatter.parse(targetDate)
    }
}

// MARK: - Create/Update DTOs

struct SavingsGoalCreate: Encodable {
    let name: String
    let targetAmount: Decimal
    let targetDate: String
    let status: SavingsGoalStatus
}

/// Partial update — only the set fields are sent (Swift synthesises
/// `encodeIfPresent` for optionals, so `nil` fields are omitted from the body).
struct SavingsGoalUpdate: Encodable {
    var name: String?
    var targetAmount: Decimal?
    var targetDate: String?
    var status: SavingsGoalStatus?
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
/// Fixed Gregorian/UTC/POSIX so it never drifts with the device locale.
enum SavingsGoalDateFormatter {
    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func parse(_ string: String) -> Date? {
        formatter.date(from: string)
    }

    static func string(from date: Date) -> String {
        formatter.string(from: date)
    }
}
