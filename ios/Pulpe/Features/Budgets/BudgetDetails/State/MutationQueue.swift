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
    case transaction(Transaction, operationId: UUID = UUID())
    case budgetLine(BudgetLine, operationId: UUID = UUID())

    var id: UUID {
        switch self {
        case .transaction(_, let id), .budgetLine(_, let id): id
        }
    }
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

    /// A finished toast confirms its own snapshot, never later undoable items.
    func drain(_ confirmed: [PendingBudgetDetailSoftDeletion]) -> [PendingBudgetDetailSoftDeletion] {
        let ids = Set(confirmed.map(\.id))
        let batch = pendingSoftDeletions.filter { ids.contains($0.id) }
        pendingSoftDeletions.removeAll { ids.contains($0.id) }
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
            ? AppLocale.string("« \(lastName) » · \(detailAmount)")
            : AppLocale.string("Dernière : « \(lastName) » · \(detailAmount)")
        return (title: title, detail: detail)
    }

    static func deletionToastLastItemCopy(
        last: PendingBudgetDetailSoftDeletion,
        presentationCurrency: SupportedCurrency
    ) -> (name: String, detailAmount: String) {
        switch last {
        case .transaction(let transaction, _):
            (
                transaction.name,
                transaction.amount.asSignedCurrency(presentationCurrency, for: transaction.kind)
            )
        case .budgetLine(let budgetLine, _):
            (
                budgetLine.name,
                budgetLine.amount.asSignedCurrency(presentationCurrency, for: budgetLine.kind)
            )
        }
    }

    static func deletionToastSingleTitle(for last: PendingBudgetDetailSoftDeletion) -> String {
        switch last {
        case .transaction:
            AppLocale.string("Supprimé")
        case .budgetLine:
            AppLocale.string("Prévision supprimée")
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
            return AppLocale.string("\(count) mouvements supprimés")
        }
        if allBudgetLines {
            return AppLocale.string("\(count) prévisions supprimées")
        }
        return AppLocale.string("\(count) éléments supprimés")
    }
}
