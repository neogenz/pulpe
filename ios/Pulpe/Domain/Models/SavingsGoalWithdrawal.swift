import Foundation

/// An eligible source for a linked income (PUL-329). The server already filtered
/// out the goals whose confirmed balance is zero, so every option here can fund
/// something. `availableAmount` is expressed in the account currency: the balance
/// check compares the *converted* amount, never the amount the user typed.
///
/// Not to be confused with PUL-292 (`SavingsWithdrawal*`), which schedules a
/// repayment the following month — here the money leaves the goal for good.
struct SavingsGoalWithdrawalOption: Codable, Identifiable, Hashable, Sendable {
    let goalId: String
    let name: String
    let status: SavingsGoalStatus
    let availableAmount: Decimal
    let currency: SupportedCurrency

    var id: String { goalId }
}

/// One income drawn from a goal, as shown in its history and in the deletion
/// preview. Carried POSITIVE on the wire: the minus sign is a presentation
/// decision each client makes on its own.
struct SavingsGoalWithdrawal: Codable, Identifiable, Hashable, Sendable {
    let transactionId: String
    let budgetId: String
    let name: String
    let transactionDate: Date
    let amount: Decimal

    var id: String { transactionId }
}

/// Where an income's money came from (PUL-329). Two states, never a third: the
/// link is ACTIVE (id + name) or BROKEN (name only, the goal was deleted). The
/// server keeps the name after the deletion, so a missing id next to a surviving
/// name is history, not an anomaly — hence no error wording anywhere here.
enum SavingsGoalSource: Equatable, Hashable, Sendable {
    case active(goalId: String, name: String)
    case broken(name: String)

    /// `nil` when the income was not funded by a goal — the only other shape the
    /// server can send.
    init?(goalId: String?, name: String?) {
        guard let name else { return nil }
        self = goalId.map { .active(goalId: $0, name: name) } ?? .broken(name: name)
    }

    var name: String {
        switch self {
        case .active(_, let name), .broken(let name): name
        }
    }

    var isBroken: Bool {
        if case .broken = self { return true }
        return false
    }

    /// The savings glyph while the goal exists; a neutral "gone" mark once it
    /// doesn't. Never a warning symbol: nothing is wrong with the income.
    var icon: String {
        isBroken ? "minus.circle" : TransactionKind.savingsIcon
    }

    /// One compact line, shown under a transaction's name in the lists and as the
    /// title of its detail context row.
    var label: String {
        "\(isBroken ? "Objectif supprimé" : "Pris sur") · \(name)"
    }

    /// Spelled out for VoiceOver, which gets the whole name even when the visible
    /// line is truncated.
    var accessibilityLabel: String {
        isBroken
            ? "Revenu pris sur l'objectif supprimé \(name)"
            : "Revenu pris sur l'objectif \(name)"
    }

    /// Why the row leads nowhere. Shown as visible text, not a tooltip: on iOS
    /// there is nothing to hover.
    static let brokenExplanation = "Cet objectif a été supprimé. Le revenu reste dans ton budget."
}
