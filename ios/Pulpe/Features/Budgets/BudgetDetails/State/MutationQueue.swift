import Foundation
import SwiftUI

/// LIFO queue of pending soft-deletions on the BudgetDetails screen — a single
/// stack shared by transactions and budget lines, undone latest-first.
///
/// Tightly coupled to the toast lifecycle: undo pops the top of the stack;
/// commit drains the whole stack. Toast copy assembly lives here because it
/// is a pure derivation of the queue contents (single vs plural, all-tx vs
/// all-line vs mixed, last-item label).
enum PendingBudgetDetailSoftDeletion {
    case transaction(Transaction)
    case budgetLine(BudgetLine)
}

@Observable @MainActor
final class MutationQueue {
    private(set) var pendingSoftDeletions: [PendingBudgetDetailSoftDeletion] = []

    var count: Int { pendingSoftDeletions.count }
    var isEmpty: Bool { pendingSoftDeletions.isEmpty }

    func push(_ pending: PendingBudgetDetailSoftDeletion) {
        pendingSoftDeletions.append(pending)
    }

    @discardableResult
    func popLast() -> PendingBudgetDetailSoftDeletion? {
        pendingSoftDeletions.popLast()
    }

    /// Returns the full pending list and clears the queue.
    func drainAll() -> [PendingBudgetDetailSoftDeletion] {
        let batch = pendingSoftDeletions
        pendingSoftDeletions = []
        return batch
    }

    // MARK: - Toast copy

    /// Builds the (title, detail) pair shown on the deletion toast based on
    /// the current queue contents. Returns ("", "") when the queue is empty.
    func deletionToastCopy(presentationCurrency: SupportedCurrency) -> (title: String, detail: String) {
        Self.deletionToastCopy(
            pendingSoftDeletions: pendingSoftDeletions,
            presentationCurrency: presentationCurrency
        )
    }

    static func deletionToastCopy(
        pendingSoftDeletions: [PendingBudgetDetailSoftDeletion],
        presentationCurrency: SupportedCurrency
    ) -> (title: String, detail: String) {
        let count = pendingSoftDeletions.count
        guard let last = pendingSoftDeletions.last else { return ("", "") }

        let (lastName, detailAmount) = deletionToastLastItemCopy(
            last: last,
            presentationCurrency: presentationCurrency
        )
        let title = count == 1
            ? deletionToastSingleTitle(for: last)
            : deletionToastPluralTitle(count: count, pendingSoftDeletions: pendingSoftDeletions)
        let detail = count == 1
            ? "« \(lastName) » · \(detailAmount)"
            : "Dernière : « \(lastName) » · \(detailAmount)"
        return (title: title, detail: detail)
    }

    static func deletionToastLastItemCopy(
        last: PendingBudgetDetailSoftDeletion,
        presentationCurrency: SupportedCurrency
    ) -> (name: String, detailAmount: String) {
        switch last {
        case .transaction(let transaction):
            (
                transaction.name,
                transaction.amount.asSignedCurrency(presentationCurrency, for: transaction.kind)
            )
        case .budgetLine(let budgetLine):
            (
                budgetLine.name,
                budgetLine.amount.asSignedCurrency(presentationCurrency, for: budgetLine.kind)
            )
        }
    }

    static func deletionToastSingleTitle(for last: PendingBudgetDetailSoftDeletion) -> String {
        switch last {
        case .transaction:
            "Transaction supprimée"
        case .budgetLine:
            "Prévision supprimée"
        }
    }

    static func deletionToastPluralTitle(
        count: Int,
        pendingSoftDeletions: [PendingBudgetDetailSoftDeletion]
    ) -> String {
        let allTransactions = pendingSoftDeletions.allSatisfy {
            if case .transaction = $0 { return true }
            return false
        }
        let allBudgetLines = pendingSoftDeletions.allSatisfy {
            if case .budgetLine = $0 { return true }
            return false
        }
        if allTransactions {
            return "\(count) transactions supprimées"
        }
        if allBudgetLines {
            return "\(count) prévisions supprimées"
        }
        return "\(count) éléments supprimés"
    }
}
