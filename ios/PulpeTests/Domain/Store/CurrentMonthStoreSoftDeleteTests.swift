import Foundation
@testable import Pulpe
import Testing

/// The home's deletion grace period. A row leaves the screen the moment the swipe
/// action is tapped, but its server DELETE waits for the undo toast to dismiss — so
/// everything between those two points has to survive an undo, a second deletion, and
/// a refresh landing inside the window.
@MainActor
struct CurrentMonthStoreSoftDeleteTests {
    private static func store(with transactions: [Transaction]) -> CurrentMonthStore {
        let store = CurrentMonthStore()
        store.populateForTesting(
            budget: TestDataFactory.createBudget(),
            transactions: transactions
        )
        return store
    }

    private static let bonus = TestDataFactory.createTransaction(id: "a", name: "Bonus", amount: 350, kind: .income)
    private static let vente = TestDataFactory.createTransaction(id: "b", name: "Vente", amount: 250, kind: .income)

    @Test("A soft-deleted row leaves the screen and is held, not sent")
    func softDeleteRemovesLocallyAndHolds() {
        let store = Self.store(with: [Self.bonus, Self.vente])

        store.softDeleteTransaction(Self.bonus)

        #expect(store.transactions.map(\.id) == ["b"])
        #expect(store.pendingDeletionCount == 1)
    }

    @Test("One undo puts back every row the toast counted")
    func undoRestoresTheWholeBatch() {
        let store = Self.store(with: [Self.bonus, Self.vente])
        store.softDeleteTransaction(Self.bonus)
        store.softDeleteTransaction(Self.vente)
        #expect(store.transactions.isEmpty)

        // The two deletions are fronted by a single toast reading "2 opérations
        // supprimées". Its one "Annuler" has to answer for both.
        let restored = store.undoPendingDeletions()

        #expect(Set(restored.map(\.id)) == ["a", "b"])
        #expect(Set(store.transactions.map(\.id)) == ["a", "b"])
        #expect(store.pendingDeletionCount == 0)
    }

    @Test("Undo with nothing held is a no-op")
    func undoOnAnEmptyQueueRestoresNothing() {
        let store = Self.store(with: [Self.bonus])
        store.softDeleteTransaction(Self.bonus)
        store.undoPendingDeletions()

        #expect(store.undoPendingDeletions().isEmpty, "nothing left to put back")
        #expect(store.transactions.map(\.id) == ["a"])
    }

    @Test("A row put back by undo is not deleted when the window closes")
    func undoneRowIsNotCommitted() async {
        let store = Self.store(with: [Self.bonus])
        store.softDeleteTransaction(Self.bonus)
        store.undoPendingDeletions()

        // Nothing is held, so the commit has no server call to make and cannot fail —
        // which is exactly what distinguishes an undone deletion from a confirmed one.
        let refused = await store.commitPendingDeletions()

        #expect(refused.isEmpty)
        #expect(store.transactions.map(\.id) == ["a"])
        #expect(store.pendingDeletionCount == 0)
    }

    @Test("The toast names one deletion and counts the rest")
    func toastCopyFollowsTheBatchSize() {
        #expect(HomeDeletion.toastMessage(latest: Self.bonus, held: 1) == "Bonus supprimé")
        #expect(HomeDeletion.toastMessage(latest: Self.vente, held: 3) == "3 opérations supprimées")
        #expect(HomeDeletion.failureMessage([Self.bonus]) == "Bonus n'a pas pu être supprimé")
        #expect(
            HomeDeletion.failureMessage([Self.bonus, Self.vente])
                == "2 opérations n'ont pas pu être supprimées"
        )
    }
}
