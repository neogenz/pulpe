import Foundation
@testable import Pulpe
import Testing

/// The state of one "Rapprocher mes comptes" presentation (PUL-351): rows, the gap, and
/// the single write at the end. The create call is the only I/O, faked at its seam.
@MainActor
struct ReconcileAccountsFlowTests {
    // MARK: - Accounts step

    @Test("a fresh flow opens on one empty amount, with no total yet")
    func init_startsWithOneEmptyAccount() {
        let flow = makeFlow()

        #expect(flow.accounts.count == 1)
        #expect(flow.accounts.first?.amountText.isEmpty == true)
        #expect(flow.totalCents == nil)
    }

    @Test("any row can be removed, the last one too, and a removed one never comes back")
    func removeAccount_removesAnyRow() throws {
        let flow = makeFlow()
        let first = try #require(flow.accounts.first?.id)
        let added = flow.addFreeAccount(isOwed: false)

        flow.removeAccount(id: first)
        #expect(flow.accounts.map(\.id) == [added])

        flow.removeAccount(id: added)
        #expect(flow.accounts.isEmpty)
        #expect(flow.totalCents == nil)
    }

    @Test("the total is what I have minus what I owe, each side shown as a positive figure")
    func totals_haveMinusOwe() {
        let flow = makeFlow()
        flow.accounts[0].amountText = "3000"
        flow.accounts[0].isNegative = false
        flow.accounts[0].label = "Compte courant"
        flow.accounts.append(.init(label: "Revolut", amountText: "1000.50"))
        flow.accounts.append(.init(label: "Carte", amountText: "800", isNegative: true))

        #expect(flow.haveCents == 400_050)
        #expect(flow.oweCents == 80_000)
        #expect(flow.totalCents == 320_050)
        #expect(flow.hasOwedRow)
    }

    @Test("Comparer waits for a total, and the back arrow keeps what was typed")
    func compare_needsATotal_andEditKeepsRows() {
        let flow = makeFlow()
        flow.compare()
        #expect(flow.step == .accounts)

        flow.accounts[0].amountText = "12."
        flow.compare()
        #expect(flow.step == .accounts)

        flow.accounts[0].amountText = "12.5"
        flow.compare()
        #expect(flow.step == .comparison)

        flow.editAccounts()
        #expect(flow.step == .accounts)
        #expect(flow.accounts[0].amountText == "12.5")
    }

    @Test("free rows come back by name and side, with no amount")
    func freeAccounts_restoredWithoutAmounts() {
        let flow = makeFlow(freeAccounts: [.init(name: "Revolut", isOwed: false), .init(name: "Klarna", isOwed: true)])

        #expect(flow.accounts.map(\.label) == ["Revolut", "Klarna"])
        #expect(flow.accounts.map(\.isNegative) == [false, true])
        #expect(flow.accounts.allSatisfy { $0.amountText.isEmpty })
        #expect(flow.freeAccountEntries == [.init(name: "Revolut", isOwed: false), .init(name: "Klarna", isOwed: true)])
    }

    @Test("the total follows every typed amount live, negative account included")
    func totalCents_followsTypedAmounts() {
        let flow = makeFlow()
        flow.accounts[0].amountText = "10.10"
        _ = flow.addFreeAccount(isOwed: false)
        flow.accounts[1].amountText = "5"
        flow.accounts[1].isNegative = true

        #expect(flow.totalCents == 510)
        #expect(flow.total == Decimal(string: "5.10"))
    }

    @Test("a refused amount blocks the total until it reads")
    func totalCents_refusedAmount_blocksTotal() {
        let flow = makeFlow()
        flow.accounts[0].amountText = "12."
        #expect(flow.totalCents == nil)
        #expect(flow.hasInvalidAmount(id: flow.accounts[0].id))

        flow.accounts[0].amountText = "12.5"
        #expect(flow.totalCents == 1250)
    }

    // MARK: - Adjustment

    @Test("a gap is written once, as the edited label, and completes once")
    func submitAdjustment_success_createsOnceAndCompletesOnce() async throws {
        let recorder = Recorder()
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "1300.50"
        flow.adjustmentLabel = "  Écart banque  "
        let realized = try #require(Decimal(string: "1250.40"))

        #expect(flow.adjustmentLabel == "  Écart banque  ")
        #expect(await flow.submitAdjustment(realizedBalance: realized, of: "budget-current") == .created)
        #expect(await flow.submitAdjustment(realizedBalance: realized, of: "budget-current") == .ignored)

        let payloads = await recorder.payloads
        let payload = try #require(payloads.first)
        #expect(payloads.count == 1)
        #expect(payload.budgetId == "budget-current")
        #expect(payload.budgetLineId == nil)
        #expect(payload.name == "Écart banque")
        #expect(payload.kind == .income)
        #expect(payload.amount == Decimal(string: "50.10"))
        #expect(payload.checkedAt == Self.now)
        #expect(recorder.created.map(\.id) == ["adjustment-1"])
        #expect(recorder.completions == [.income])
        #expect(flow.isCompleted)
    }

    @Test("a refused write keeps every input, then can be retried")
    func submitAdjustment_failure_keepsInputsAndAllowsRetry() async throws {
        let recorder = Recorder(failuresBeforeSuccess: 1)
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "200"
        flow.adjustmentLabel = "Écart"
        let accountsBefore = flow.accounts

        #expect(await flow.submitAdjustment(realizedBalance: 250, of: "budget-current") == .failed)
        #expect(flow.accounts == accountsBefore)
        #expect(flow.adjustmentLabel == "Écart")
        #expect(!flow.isSubmitting)
        #expect(!flow.isCompleted)
        #expect(recorder.created.isEmpty)
        #expect(recorder.completions.isEmpty)

        #expect(await flow.submitAdjustment(realizedBalance: 250, of: "budget-current") == .created)
        #expect(await recorder.payloads.count == 2)
        #expect(recorder.created.count == 1)
        #expect(recorder.completions == [.expense])
    }

    @Test("a second tap while the write is pending sends nothing")
    func submitAdjustment_whilePending_isIgnored() async {
        let gate = Gate()
        let recorder = Recorder(gate: gate)
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "10"

        let first = Task { await flow.submitAdjustment(realizedBalance: 0, of: "budget-current") }
        await waitForCondition("the first write never started") { flow.isSubmitting }
        #expect(await flow.submitAdjustment(realizedBalance: 0, of: "budget-current") == .ignored)

        await gate.open()
        #expect(await first.value == .created)
        #expect(await recorder.payloads.count == 1)
        #expect(!flow.isSubmitting)
    }

    @Test("a blank label cannot be written")
    func submitAdjustment_blankLabel_isIgnored() async {
        let recorder = Recorder()
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "10"
        flow.adjustmentLabel = "   "

        #expect(!flow.canSubmitAdjustment(realizedBalance: 0, of: "budget-current"))
        #expect(await flow.submitAdjustment(realizedBalance: 0, of: "budget-current") == .ignored)
        #expect(await recorder.payloads.isEmpty)
    }

    // MARK: - Up to date

    @Test("accounts matching to the cent write nothing and complete once on confirmation")
    func confirmUpToDate_writesNothingAndCompletesOnce() async throws {
        let recorder = Recorder()
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "1250,40"
        let realized = try #require(Decimal(string: "1250.40"))

        #expect(flow.verdict(realizedBalance: realized) == .upToDate)
        #expect(!flow.canSubmitAdjustment(realizedBalance: realized, of: "budget-current"))
        #expect(await flow.submitAdjustment(realizedBalance: realized, of: "budget-current") == .ignored)
        #expect(flow.confirmUpToDate(realizedBalance: realized, of: "budget-current"))
        #expect(!flow.confirmUpToDate(realizedBalance: realized, of: "budget-current"))

        #expect(await recorder.payloads.isEmpty)
        #expect(recorder.completions == [.upToDate])
    }

    @Test("a gap is never confirmed as up to date")
    func confirmUpToDate_withGap_isRefused() {
        let recorder = Recorder()
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "10"

        #expect(!flow.confirmUpToDate(realizedBalance: Decimal(string: "9.99") ?? 0, of: "budget-current"))
        #expect(recorder.completions.isEmpty)
    }

    @Test("a balance coming level while the write is out confirms nothing")
    func confirmUpToDate_whilePending_isRefused() async {
        let gate = Gate()
        let recorder = Recorder(gate: gate)
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "10"

        let write = Task { await flow.submitAdjustment(realizedBalance: 0, of: "budget-current") }
        await waitForCondition("the write never started") { flow.isSubmitting }
        #expect(!flow.canConfirmUpToDate(realizedBalance: 10, of: "budget-current"))
        #expect(!flow.confirmUpToDate(realizedBalance: 10, of: "budget-current"))

        await gate.open()
        #expect(await write.value == .created)
        #expect(!flow.canConfirmUpToDate(realizedBalance: 10, of: "budget-current"))
        #expect(recorder.completions == [.income])
    }

    // MARK: - Loaded month

    @Test("another month loaded under the flow gets no write and no confirmation, and closes it")
    func loadedMonthChange_refusesWriteAndConfirmation() async {
        let recorder = Recorder()
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "10"

        #expect(flow.canSubmitAdjustment(realizedBalance: 0, of: "budget-current"))
        #expect(!flow.canSubmitAdjustment(realizedBalance: 0, of: "budget-next"))
        #expect(await flow.submitAdjustment(realizedBalance: 0, of: "budget-next") == .ignored)
        #expect(!flow.canConfirmUpToDate(realizedBalance: 10, of: "budget-next"))
        #expect(!flow.confirmUpToDate(realizedBalance: 10, of: "budget-next"))
        #expect(flow.shouldClose(loadedBudgetId: "budget-next"))
        #expect(!flow.shouldClose(loadedBudgetId: "budget-current"))

        #expect(await recorder.payloads.isEmpty)
        #expect(recorder.completions.isEmpty)
    }

    @Test("a write already out keeps its month and its sheet, and stays the only one sent")
    func loadedMonthChange_whilePending_keepsTargetUntilSettled() async {
        let gate = Gate()
        let recorder = Recorder(gate: gate)
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "10"

        let write = Task { await flow.submitAdjustment(realizedBalance: 0, of: "budget-current") }
        await waitForCondition("the write never started") { flow.isSubmitting }
        #expect(!flow.shouldClose(loadedBudgetId: "budget-next"))
        #expect(await flow.submitAdjustment(realizedBalance: 0, of: "budget-next") == .ignored)

        await gate.open()
        #expect(await write.value == .created)
        #expect(flow.shouldClose(loadedBudgetId: "budget-next"))
        let payloads = await recorder.payloads
        #expect(payloads.map(\.budgetId) == ["budget-current"])
    }

    @Test("reconciliation writes to the viewed month", arguments: ["budget-past", "budget-future"])
    func submitAdjustment_targetsViewedMonth(budgetId: String) async throws {
        let recorder = Recorder()
        let flow = makeFlow(recorder: recorder, id: budgetId)
        flow.accounts[0].amountText = "50"
        #expect(await flow.submitAdjustment(realizedBalance: 20, of: budgetId) == .created)
        let payload = try #require(await recorder.payloads.first)
        #expect(payload.budgetId == budgetId)
        #expect(payload.amount == 30)
        #expect(payload.checkedAt != nil)
    }

    // MARK: - Draft

    @Test("a draft reopens on the same month's typed rows and label, never on another month's")
    func restoringDraft_onlyForTheSameBudget() throws {
        let typed = makeFlow()
        typed.accounts[0].amountText = "4600"
        typed.adjustmentLabel = "Écart banque"
        let draft = try #require(typed.draft)

        let reopened = makeFlow(restoring: draft)
        #expect(reopened.accounts == typed.accounts)
        #expect(reopened.adjustmentLabel == "Écart banque")

        let otherMonth = makeFlow(id: "budget-other", restoring: draft)
        #expect(otherMonth.accounts.first?.amountText.isEmpty == true)
        #expect(otherMonth.adjustmentLabel == "Ajustement")
    }

    @Test("a finished reconciliation leaves no draft behind")
    func draft_isNilOnceCompleted() async {
        let flow = makeFlow()
        flow.accounts[0].amountText = "100"
        #expect(flow.draft != nil)

        #expect(await flow.submitAdjustment(realizedBalance: 50, of: "budget-current") == .created)
        #expect(flow.draft == nil)
    }

    @Test("the resume is taken once, and a sheet left without a draft drops it")
    func draftStore_resumeTakenOnce() throws {
        let store = ReconcileDraftStore()
        let draft = try #require(makeFlow().draft)

        store.keep(draft)
        #expect(store.draft(for: "budget-current") == draft)
        #expect(store.draft(for: "budget-other") == nil)
        #expect(store.takeResume())
        #expect(!store.takeResume())

        store.keep(nil)
        #expect(store.draft(for: "budget-current") == nil)
        #expect(!store.takeResume())
    }

    @Test("a sheet opened from the budget detail keeps its draft but asks the Accueil to reopen nothing")
    func draftStore_noResumeFromBudgetDetail() throws {
        let store = ReconcileDraftStore()
        let draft = try #require(makeFlow().draft)

        store.keep(draft, resumes: false)

        #expect(store.draft(for: "budget-current") == draft)
        #expect(!store.takeResume())
    }

    @Test("a draft survives the lock with its rows and amounts, for the budget it was typed on")
    func draft_restoresRowsAndAmounts() throws {
        let flow = makeFlow()
        flow.accounts[0].amountText = "1000"
        flow.accounts[0].label = "Revolut"
        flow.addFreeAccount(isOwed: true)
        flow.accounts[1].amountText = "800"
        let draft = try #require(flow.draft)

        let restored = makeFlow(restoring: draft)
        #expect(restored.accounts == flow.accounts)
        #expect(restored.totalCents == 20_000)
        #expect(makeFlow(id: "budget-other", restoring: draft).accounts.map(\.amountText) == [""])
    }

    // MARK: - Helpers

    private static let now = Date(timeIntervalSince1970: 1_790_000_000)

    private func makeFlow(
        recorder: Recorder = Recorder(),
        id: String = "budget-current",
        freeAccounts: [ReconcileFreeAccountsStore.Entry] = [],
        restoring draft: ReconcileAccountsFlow.Draft? = nil
    ) -> ReconcileAccountsFlow {
        ReconcileAccountsFlow(
            budgetId: id,
            adjustmentLabel: "Ajustement",
            createTransaction: { payload in try await recorder.create(payload) },
            onAdjustmentCreated: { recorder.created.append($0) },
            onCompleted: { recorder.completions.append($0) },
            freeAccounts: freeAccounts,
            restoring: draft,
            now: { Self.now }
        )
    }
}

/// The create endpoint, faked: records each body and echoes it back as the server would.
@MainActor
private final class Recorder {
    var created: [Transaction] = []
    var completions: [AccountReconciliation.Completion] = []
    let server: FakeServer

    init(failuresBeforeSuccess: Int = 0, gate: Gate? = nil) {
        server = FakeServer(failuresBeforeSuccess: failuresBeforeSuccess, gate: gate)
    }

    var payloads: [TransactionCreate] {
        get async { await server.payloads }
    }

    nonisolated func create(_ payload: TransactionCreate) async throws -> Transaction {
        try await server.create(payload)
    }
}

private actor FakeServer {
    private(set) var payloads: [TransactionCreate] = []
    private var failuresLeft: Int
    private let gate: Gate?

    init(failuresBeforeSuccess: Int, gate: Gate?) {
        failuresLeft = failuresBeforeSuccess
        self.gate = gate
    }

    func create(_ payload: TransactionCreate) async throws -> Transaction {
        payloads.append(payload)
        await gate?.wait()
        if failuresLeft > 0 {
            failuresLeft -= 1
            throw URLError(.notConnectedToInternet)
        }
        return Transaction(
            id: "adjustment-\(payloads.count)",
            budgetId: payload.budgetId,
            budgetLineId: payload.budgetLineId,
            name: payload.name,
            amount: payload.amount,
            kind: payload.kind,
            transactionDate: payload.transactionDate ?? .distantPast,
            category: nil,
            checkedAt: payload.checkedAt,
            createdAt: .distantPast,
            updatedAt: .distantPast
        )
    }
}

/// Holds a fake write open until the test releases it.
private actor Gate {
    private var isOpen = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func wait() async {
        guard !isOpen else { return }
        await withCheckedContinuation { waiters.append($0) }
    }

    func open() {
        isOpen = true
        waiters.forEach { $0.resume() }
        waiters = []
    }
}
