import Foundation
import Observation

/// What « Comparer avec mes comptes » keeps when the sheet goes away unfinished. Checking a
/// balance means leaving for the bank app, and past the background grace period the lock
/// rebuilds the main screen: without this, the balances typed so far die with the sheet.
/// In memory only, so a cold start still opens on an empty sheet.
@Observable @MainActor
final class ReconcileDraftStore {
    static let shared = ReconcileDraftStore()

    private(set) var draft: ReconcileAccountsFlow.Draft?
    /// The sheet went away under a lock, not by the user's hand: the Accueil opens it again.
    private(set) var isResumePending = false

    func draft(for budgetId: String) -> ReconcileAccountsFlow.Draft? {
        draft?.budgetId == budgetId ? draft : nil
    }

    /// `nil` once the sheet is closed by hand or finished: the next one opens empty.
    func keep(_ draft: ReconcileAccountsFlow.Draft?, resume: Bool) {
        self.draft = draft
        isResumePending = draft != nil && resume
    }

    /// True once per lock: the first screen that reopens the sheet takes it.
    func takeResume() -> Bool {
        defer { isResumePending = false }
        return isResumePending
    }
}
