import Foundation
import Observation

/// State of one "Comparer avec mes comptes" presentation (PUL-351). Owned by
/// `ReconcileAccountsSheet` through `@State`, so every account typed here dies with the
/// sheet: reopening starts on one empty amount. Foundation-only so its rules run without UIKit.
@Observable @MainActor
final class ReconcileAccountsFlow {
    /// Form input, bound field by field.
    var accounts: [AccountReconciliation.Account]
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

    /// The in-Pulpe asset behind each seeded row. Rows added by hand are not in it.
    @ObservationIgnored private let linkedAssets: [AccountReconciliation.Account.ID: Asset]

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
        linkedAccounts: [Asset] = [],
        now: @escaping () -> Date = Date.init
    ) {
        self.budgetId = budgetId
        let seeded = linkedAccounts.map { (account: AccountReconciliation.Account(label: $0.name), asset: $0) }
        self.accounts = seeded.isEmpty ? [AccountReconciliation.Account()] : seeded.map(\.account)
        self.linkedAssets = Dictionary(uniqueKeysWithValues: seeded.map { ($0.account.id, $0.asset) })
        self.adjustmentLabel = adjustmentLabel
        self.createTransaction = createTransaction
        self.onAdjustmentCreated = onAdjustmentCreated
        self.onCompleted = onCompleted
        self.now = now
    }

    // MARK: - Accounts

    var totalCents: Int? { AccountReconciliation.totalCents(of: accounts) }

    var total: Decimal? { totalCents.map(AccountReconciliation.amount(cents:)) }

    var hasLinkedAccounts: Bool { !linkedAssets.isEmpty }

    /// Last known value of a seeded row, shown as its hint.
    func lastValueHint(id: AccountReconciliation.Account.ID) -> Asset? { linkedAssets[id] }

    /// One snapshot per seeded row the user filled; free rows and empty rows write nothing.
    var linkedSnapshotItems: [AssetSnapshotItem] {
        accounts.compactMap { account in
            guard let asset = linkedAssets[account.id],
                  case .valid(let cents) = account.amount
            else { return nil }
            return AssetSnapshotItem(assetId: asset.id, value: AccountReconciliation.amount(cents: cents))
        }
    }

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

    // MARK: - Verdict

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

    /// The movement that most likely explains the gap: one not pointed yet, going the way the
    /// gap goes (money missing from the checked balance is an income, money too much is an
    /// outflow) and of exactly its size. `nil` when none or several tie: guessing between two
    /// would point the wrong one.
    static func likelyMissedMovement(gap: Decimal, among transactions: [Transaction]) -> Transaction? {
        let size = gap.rounded(2)
        guard size != 0 else { return nil }
        let matches = transactions.filter { transaction in
            !transaction.isChecked
                && transaction.amount.rounded(2) == size.absoluteValue
                && (size > 0 ? transaction.kind == .income : transaction.kind.isOutflow)
        }
        return matches.count == 1 ? matches.first : nil
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
