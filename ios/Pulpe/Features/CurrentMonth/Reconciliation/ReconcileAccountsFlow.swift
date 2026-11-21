import Foundation
import Observation

/// State of one "Comparer avec mes comptes" presentation (PUL-351). Owned by
/// `ReconcileAccountsSheet` through `@State`: closing it by hand discards every account typed
/// here, only a sheet lost to a lock hands its `draft` to the next one. Foundation-only so
/// its rules run without UIKit.
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

    /// The two screens of the comparison: the balances typed, then what they say about the month.
    enum Step: Equatable {
        case accounts
        case comparison
    }

    private(set) var step = Step.accounts

    /// What finishing writes to « Mon patrimoine »: the accounts I finish with are the ones
    /// followed. The twin of the web `planAccountLinks`.
    struct LinkPlan: Equatable {
        /// Accounts picked here that were not followed yet.
        var links: [String] = []
        /// Followed accounts that no row holds any more.
        var unlinks: [String] = []
        var snapshots: [AssetSnapshotItem] = []

        var isEmpty: Bool { links.isEmpty && unlinks.isEmpty && snapshots.isEmpty }
    }

    /// My accounts and what I owe in the user's currency, followed or not. `nil` when
    /// « Mon patrimoine » is off or unread: every row is a free one and finishing writes nothing there.
    @ObservationIgnored private let ownAccounts: [Asset]?
    /// The « Mon patrimoine » item behind a row; a row missing here is a free one.
    private(set) var assetIds: [AccountReconciliation.Account.ID: String]

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
        freeAccounts: [ReconcileFreeAccountsStore.Entry] = [],
        restoring draft: Draft? = nil,
        now: @escaping () -> Date = Date.init
    ) {
        self.budgetId = budgetId
        // The accounts followed so far open the sheet, one row each, then the free rows of last time.
        let seeded = (netWorthAccounts ?? []).filter(\.inPulpe).map {
            (account: AccountReconciliation.Account(label: $0.name, isNegative: $0.direction == .owe), asset: $0)
        }
        let remembered = freeAccounts.map { AccountReconciliation.Account(label: $0.name, isNegative: $0.isOwed) }
        self.ownAccounts = netWorthAccounts
        if let draft, draft.budgetId == budgetId {
            self.accounts = draft.accounts
            // An item deleted or archived during the lock comes back as a free row with its name,
            // side and amount, so the save never names a gone item. Unread, nothing is known gone.
            let offered = netWorthAccounts.map { Set($0.map(\.id)) }
            self.assetIds = draft.assetIds.filter { offered?.contains($0.value) ?? true }
            self.adjustmentLabel = draft.adjustmentLabel
        } else {
            let rows = seeded.map(\.account) + remembered
            self.accounts = rows.isEmpty ? [AccountReconciliation.Account()] : rows
            self.assetIds = Dictionary(uniqueKeysWithValues: seeded.map { ($0.account.id, $0.asset.id) })
            self.adjustmentLabel = adjustmentLabel
        }
        self.createTransaction = createTransaction
        self.onAdjustmentCreated = onAdjustmentCreated
        self.onCompleted = onCompleted
        self.now = now
    }

    // MARK: - Draft

    /// Everything typed so far, to reopen on after a lock rebuilt the screen.
    struct Draft: Equatable {
        let budgetId: String
        let accounts: [AccountReconciliation.Account]
        let assetIds: [AccountReconciliation.Account.ID: String]
        let adjustmentLabel: String
    }

    /// `nil` once finished: a completed reconciliation leaves nothing to reopen.
    var draft: Draft? {
        guard !isCompleted else { return nil }
        return Draft(budgetId: budgetId, accounts: accounts, assetIds: assetIds, adjustmentLabel: adjustmentLabel)
    }

    // MARK: - Accounts

    var totalCents: Int? { AccountReconciliation.totalCents(of: accounts) }

    var total: Decimal? { totalCents.map(AccountReconciliation.amount(cents:)) }

    /// What I have and what I owe, each as a positive figure; the total is the first minus the second.
    var haveCents: Int { cents(owed: false) }
    var oweCents: Int { cents(owed: true) }
    var hasOwedRow: Bool { accounts.contains(where: \.isNegative) }

    private func cents(owed: Bool) -> Int {
        accounts.filter { $0.isNegative == owed }.reduce(0) { sum, account in
            guard case .valid(let cents) = account.amount else { return sum }
            return owed ? sum - cents : sum + cents
        }
    }

    // MARK: - Steps

    /// Compare waits for a total: an unreadable amount or nothing typed keeps step 1.
    func compare() {
        if totalCents != nil { step = .comparison }
    }

    func editAccounts() {
        step = .accounts
    }

    // MARK: - Mon patrimoine

    var linksToNetWorth: Bool { ownAccounts != nil }

    /// The item behind a row, whose side is fixed and whose last value is shown as its hint.
    func asset(id: AccountReconciliation.Account.ID) -> Asset? {
        guard let assetId = assetIds[id] else { return nil }
        return ownAccounts?.first { $0.id == assetId }
    }

    /// What the add sheet offers: never one already in the list, nor one a saving prévision of
    /// the month feeds (its balance follows from the month, not from what I type).
    func addableAssets(excluding fedAssetIds: Set<String>) -> [Asset] {
        let taken = Set(assetIds.values).union(fedAssetIds)
        return (ownAccounts ?? []).filter { !taken.contains($0.id) }
    }

    /// The free rows to remember for next time: names and sides.
    var freeAccountEntries: [ReconcileFreeAccountsStore.Entry] {
        accounts.filter { assetIds[$0.id] == nil }.compactMap {
            let name = String($0.label.trimmingCharacters(in: .whitespacesAndNewlines).prefix(100))
            return name.isEmpty ? nil : .init(name: name, isOwed: $0.isNegative)
        }
    }

    var linkPlan: LinkPlan {
        guard let ownAccounts else { return LinkPlan() }
        var plan = LinkPlan()
        let picked = accounts.compactMap { assetIds[$0.id] }
        for account in accounts {
            guard let id = assetIds[account.id], case .valid(let cents) = account.amount else { continue }
            // Mon patrimoine values what I owe by the remaining balance: a positive figure.
            let isOwed = ownAccounts.first { $0.id == id }?.direction == .owe
            let value = AccountReconciliation.amount(cents: isOwed ? abs(cents) : cents)
            plan.snapshots.append(AssetSnapshotItem(assetId: id, value: value))
        }
        let followed = ownAccounts.filter(\.inPulpe).map(\.id)
        plan.links = picked.filter { !followed.contains($0) }
        plan.unlinks = followed.filter { !picked.contains($0) }
        return plan
    }

    /// Both adds return the new row's id so the step can focus it.
    @discardableResult
    func addAsset(_ asset: Asset) -> AccountReconciliation.Account.ID {
        let account = AccountReconciliation.Account(label: asset.name, isNegative: asset.direction == .owe)
        accounts.append(account)
        assetIds[account.id] = asset.id
        return account.id
    }

    @discardableResult
    func addFreeAccount(isOwed: Bool) -> AccountReconciliation.Account.ID {
        let account = AccountReconciliation.Account(isNegative: isOwed)
        accounts.append(account)
        return account.id
    }

    /// Removing only takes the row out of this comparison; a followed item stops being followed
    /// when I finish, as it always did, and is never archived or edited.
    func removeAccount(id: AccountReconciliation.Account.ID) {
        accounts.removeAll { $0.id == id }
        assetIds[id] = nil
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
