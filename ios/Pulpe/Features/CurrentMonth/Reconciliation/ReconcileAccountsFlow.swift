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

    /// One of my accounts of « Mon patrimoine », or a line typed for this time.
    enum RowAccount: Equatable, Sendable {
        case asset(id: String)
        case other(addToNetWorth: Bool)
    }

    /// What finishing writes to « Mon patrimoine »: the accounts I finish with are the ones
    /// followed. The twin of the web `planAccountLinks`.
    struct LinkPlan: Equatable {
        struct Create: Equatable {
            let name: String
            let value: Decimal
        }

        var creates: [Create] = []
        /// Accounts picked here that were not followed yet.
        var links: [String] = []
        /// Followed accounts that no row holds any more.
        var unlinks: [String] = []
        var snapshots: [AssetSnapshotItem] = []

        var isEmpty: Bool { creates.isEmpty && links.isEmpty && unlinks.isEmpty && snapshots.isEmpty }
    }

    /// My accounts of the user's currency, followed or not. `nil` when « Mon patrimoine » is
    /// off or unread: rows are plain lines and finishing writes nothing there.
    @ObservationIgnored private let ownAccounts: [Asset]?
    /// A row missing here is a typed line that stays out of « Mon patrimoine ».
    private(set) var rowAccounts: [AccountReconciliation.Account.ID: RowAccount]

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
        netWorthAccounts: [Asset]? = nil,
        now: @escaping () -> Date = Date.init
    ) {
        self.budgetId = budgetId
        // The accounts followed so far open the sheet, one row each.
        let seeded = (netWorthAccounts ?? []).filter(\.inPulpe)
            .map { (account: AccountReconciliation.Account(label: $0.name), asset: $0) }
        self.accounts = seeded.isEmpty ? [AccountReconciliation.Account()] : seeded.map(\.account)
        self.ownAccounts = netWorthAccounts
        self.rowAccounts = Dictionary(uniqueKeysWithValues: seeded.map { ($0.account.id, .asset(id: $0.asset.id)) })
        self.adjustmentLabel = adjustmentLabel
        self.createTransaction = createTransaction
        self.onAdjustmentCreated = onAdjustmentCreated
        self.onCompleted = onCompleted
        self.now = now
    }

    // MARK: - Accounts

    var totalCents: Int? { AccountReconciliation.totalCents(of: accounts) }

    var total: Decimal? { totalCents.map(AccountReconciliation.amount(cents:)) }

    // MARK: - Mon patrimoine

    var linksToNetWorth: Bool { ownAccounts != nil }

    func rowAccount(id: AccountReconciliation.Account.ID) -> RowAccount {
        rowAccounts[id] ?? .other(addToNetWorth: false)
    }

    /// The account behind a row, whose last value is shown as its hint.
    func asset(id: AccountReconciliation.Account.ID) -> Asset? {
        guard case .asset(let assetId) = rowAccount(id: id) else { return nil }
        return ownAccounts?.first { $0.id == assetId }
    }

    /// My accounts no other row holds: an account is never counted twice.
    func choices(for id: AccountReconciliation.Account.ID) -> [Asset] {
        let taken = Set(rowAccounts.filter { $0.key != id }.values.compactMap { row -> String? in
            if case .asset(let assetId) = row { return assetId }
            return nil
        })
        return (ownAccounts ?? []).filter { !taken.contains($0.id) }
    }

    /// `nil` turns the row into a typed line; the amount already typed stays.
    func selectAccount(id: AccountReconciliation.Account.ID, _ asset: Asset?) {
        guard let index = accounts.firstIndex(where: { $0.id == id }) else { return }
        accounts[index].label = asset?.name ?? ""
        rowAccounts[id] = asset.map { .asset(id: $0.id) }
    }

    func setAddToNetWorth(id: AccountReconciliation.Account.ID, _ isOn: Bool) {
        guard asset(id: id) == nil else { return }
        rowAccounts[id] = .other(addToNetWorth: isOn)
    }

    /// An account kept in « Mon patrimoine » needs a name to be found again.
    func isNameMissing(id: AccountReconciliation.Account.ID) -> Bool {
        guard rowAccount(id: id) == .other(addToNetWorth: true) else { return false }
        return accounts.first { $0.id == id }?.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? false
    }

    /// ...and a balance to start from: the plan creates nothing without one.
    func isBalanceMissing(id: AccountReconciliation.Account.ID) -> Bool {
        guard rowAccount(id: id) == .other(addToNetWorth: true) else { return false }
        return accounts.first { $0.id == id }?.amount == .blank
    }

    private var hasIncompleteNewAccount: Bool {
        accounts.contains { isNameMissing(id: $0.id) || isBalanceMissing(id: $0.id) }
    }

    var linkPlan: LinkPlan {
        guard let ownAccounts else { return LinkPlan() }
        var plan = LinkPlan()
        var picked: [String] = []
        for account in accounts {
            var value: Decimal?
            if case .valid(let cents) = account.amount { value = AccountReconciliation.amount(cents: cents) }
            switch rowAccount(id: account.id) {
            case .asset(let id):
                guard !picked.contains(id) else { continue }
                picked.append(id)
                if let value { plan.snapshots.append(AssetSnapshotItem(assetId: id, value: value)) }
            case .other(let addToNetWorth):
                let name = account.label.trimmingCharacters(in: .whitespacesAndNewlines)
                if addToNetWorth, let value, !name.isEmpty { plan.creates.append(.init(name: name, value: value)) }
            }
        }
        let followed = ownAccounts.filter(\.inPulpe).map(\.id)
        plan.links = picked.filter { !followed.contains($0) }
        plan.unlinks = followed.filter { !picked.contains($0) }
        return plan
    }

    /// Returns the new row's id so the sheet can focus its amount.
    @discardableResult
    func addAccount() -> AccountReconciliation.Account.ID {
        let account = AccountReconciliation.Account()
        accounts.append(account)
        return account.id
    }

    /// Any row goes while another remains: a followed account I closed leaves like the others.
    func canRemoveAccount(id: AccountReconciliation.Account.ID) -> Bool {
        accounts.count > 1 && accounts.contains { $0.id == id }
    }

    func removeAccount(id: AccountReconciliation.Account.ID) {
        guard canRemoveAccount(id: id) else { return }
        accounts.removeAll { $0.id == id }
        rowAccounts[id] = nil
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
        guard loadedBudgetId == budgetId, !isSubmitting, !isCompleted, !hasIncompleteNewAccount else { return false }
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
        guard loadedBudgetId == budgetId, !isSubmitting, !isCompleted, !hasIncompleteNewAccount else { return false }
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

    /// The movement that most likely explains the gap: one not pointed yet, of exactly its size,
    /// whose pointing moves the pointed balance by exactly the gap. Under a pointée prévision a
    /// dépense can move it by less, or not at all (`calculateRealizedExpenses` counts the
    /// prévision's whole amount), so the size alone would promise a pointing that settles nothing.
    /// `nil` when none or several tie: guessing between two would point the wrong one.
    static func likelyMissedMovement(
        gap: Decimal, among transactions: [Transaction], lines: [BudgetLine]
    ) -> Transaction? {
        let size = gap.rounded(2)
        guard size != 0 else { return nil }
        let balance = BudgetFormulas.calculateRealizedBalance(budgetLines: lines, transactions: transactions)
        let matches = transactions.filter { transaction in
            guard !transaction.isChecked, transaction.amount.rounded(2) == size.absoluteValue else { return false }
            let pointed = transactions.map { $0.id == transaction.id ? $0.toggled() : $0 }
            let after = BudgetFormulas.calculateRealizedBalance(budgetLines: lines, transactions: pointed)
            return (after - balance).rounded(2) == size
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
