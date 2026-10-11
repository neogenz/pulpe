import Foundation
import Observation

/// State of one "Rapprocher mes comptes" presentation (PUL-351). Owned by
/// `ReconcileAccountsSheet` through `@State`, so every account typed here dies with the
/// sheet: reopening starts on one empty amount. Kept apart from the view because the
/// three steps outgrow one file; Foundation-only so its rules run without UIKit.
@Observable @MainActor
final class ReconcileAccountsFlow {
    /// Steps pushed after the accounts step, which is the stack's root.
    enum Step: Hashable {
        case summary
        case itemsToCheck
        case verdict
    }

    /// Form input, bound field by field.
    var accounts: [AccountReconciliation.Account]
    /// Bound to the sheet's `NavigationStack`, so the system back pops a step.
    var path: [Step] = []
    /// Pre-filled, editable before the write. The amount is not: it is what makes the
    /// checked balance equal the accounts.
    var adjustmentLabel: String

    /// The create call is in flight: the sheet blocks dismiss, back and a second tap.
    private(set) var isSubmitting = false
    /// The flow reached its end once. Nothing is written or tracked after it, even if the
    /// sheet still shows for a frame while it dismisses.
    private(set) var isCompleted = false

    /// What `submitAdjustment` did. A refusal carries no error: the sheet reports it with
    /// one toast, and the form keeps everything for a retry.
    enum SubmitOutcome: Equatable {
        case created
        case failed
        case ignored
    }

    let budgetId: String

    @ObservationIgnored private let createTransaction: @Sendable (TransactionCreate) async throws -> Transaction
    @ObservationIgnored private let onAdjustmentCreated: @MainActor (Transaction) -> Void
    @ObservationIgnored private let onCompleted: @MainActor (AccountReconciliation.Completion) -> Void
    @ObservationIgnored private let now: () -> Date

    init(
        budgetId: String,
        adjustmentLabel: String,
        createTransaction: @escaping @Sendable (TransactionCreate) async throws -> Transaction,
        onAdjustmentCreated: @escaping @MainActor (Transaction) -> Void,
        onCompleted: @escaping @MainActor (AccountReconciliation.Completion) -> Void,
        now: @escaping () -> Date = Date.init
    ) {
        self.budgetId = budgetId
        self.accounts = [AccountReconciliation.Account()]
        self.adjustmentLabel = adjustmentLabel
        self.createTransaction = createTransaction
        self.onAdjustmentCreated = onAdjustmentCreated
        self.onCompleted = onCompleted
        self.now = now
    }

    // MARK: - Accounts step

    var totalCents: Int? { AccountReconciliation.totalCents(of: accounts) }

    var total: Decimal? { totalCents.map(AccountReconciliation.amount(cents:)) }

    var canContinue: Bool { totalCents != nil }

    /// Returns the new row's id so the sheet can focus its amount.
    @discardableResult
    func addAccount() -> AccountReconciliation.Account.ID {
        let account = AccountReconciliation.Account()
        accounts.append(account)
        return account.id
    }

    /// The first row is the one amount the flow opens on; only added rows go.
    func canRemoveAccount(id: AccountReconciliation.Account.ID) -> Bool {
        accounts.first?.id != id && accounts.contains { $0.id == id }
    }

    func removeAccount(id: AccountReconciliation.Account.ID) {
        guard canRemoveAccount(id: id) else { return }
        accounts.removeAll { $0.id == id }
    }

    func hasInvalidAmount(id: AccountReconciliation.Account.ID) -> Bool {
        accounts.first { $0.id == id }?.amount == .invalid
    }

    func continueFromAccounts() {
        guard canContinue else { return }
        path = [.summary]
    }

    /// Pointing happens inside the flow: leaving for the month's page lost every account.
    func showItemsToCheck() {
        guard path == [.summary] else { return }
        path.append(.itemsToCheck)
    }

    /// From the summary, or from the items just pointed: the verdict replaces them.
    func continueToVerdict() {
        guard canContinue, path == [.summary] || path == [.summary, .itemsToCheck] else { return }
        path = [.summary, .verdict]
    }

    // MARK: - Verdict step

    /// The checked balance is read live from the caller, never copied at presentation.
    func difference(realizedBalance: Decimal) -> Decimal? {
        totalCents.map { AccountReconciliation.difference(totalCents: $0, realizedBalance: realizedBalance) }
    }

    func verdict(realizedBalance: Decimal) -> AccountReconciliation.Verdict? {
        totalCents.map { AccountReconciliation.verdict(totalCents: $0, realizedBalance: realizedBalance) }
    }

    /// The balance must be read from the month this flow opened on: a refresh can load
    /// another one under the sheet, and its balance never meets a draft aimed at this budget.
    func canSubmitAdjustment(realizedBalance: Decimal, of loadedBudgetId: String) -> Bool {
        guard loadedBudgetId == budgetId, !isSubmitting, !isCompleted else { return false }
        return adjustmentPayload(realizedBalance: realizedBalance) != nil
    }

    /// The flow's one write. On success the entry goes to the month's own store before
    /// anything else, so the checked balance moves to the accounts total at once; nothing
    /// after the create can turn it back into a failure and re-open the button.
    func submitAdjustment(realizedBalance: Decimal, of loadedBudgetId: String) async -> SubmitOutcome {
        guard canSubmitAdjustment(realizedBalance: realizedBalance, of: loadedBudgetId),
              let payload = adjustmentPayload(realizedBalance: realizedBalance)
        else { return .ignored }

        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let transaction = try await createTransaction(payload)
            isCompleted = true
            onAdjustmentCreated(transaction)
            onCompleted(payload.kind == .income ? .income : .expense)
            return .created
        } catch {
            return .failed
        }
    }

    /// A write already out ends the flow itself, even if a refresh brings the balance level
    /// meanwhile: "Terminer" waits for it rather than completing a second time.
    func canConfirmUpToDate(realizedBalance: Decimal, of loadedBudgetId: String) -> Bool {
        guard loadedBudgetId == budgetId, !isSubmitting, !isCompleted else { return false }
        return verdict(realizedBalance: realizedBalance) == .upToDate
    }

    /// Ends an up-to-date reconciliation: nothing to write, one completion.
    func confirmUpToDate(realizedBalance: Decimal, of loadedBudgetId: String) -> Bool {
        guard canConfirmUpToDate(realizedBalance: realizedBalance, of: loadedBudgetId) else { return false }
        isCompleted = true
        onCompleted(.upToDate)
        return true
    }

    /// Another loaded month leaves the draft nothing to write against, so the sheet closes —
    /// once no write is in flight: one already out keeps its month and stays the only request.
    func shouldClose(loadedBudgetId: String) -> Bool {
        loadedBudgetId != budgetId && !isSubmitting
    }

    private func adjustmentPayload(realizedBalance: Decimal) -> TransactionCreate? {
        guard let verdict = verdict(realizedBalance: realizedBalance),
              let payload = AccountReconciliation.adjustmentPayload(
                  budgetId: budgetId, label: adjustmentLabel, verdict: verdict, now: now()
              ),
              !payload.name.isEmpty
        else { return nil }
        return payload
    }
}
