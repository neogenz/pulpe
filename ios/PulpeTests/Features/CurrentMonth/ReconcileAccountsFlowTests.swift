import Foundation
@testable import Pulpe
import Testing

/// The state of one "Rapprocher mes comptes" presentation (PUL-351): rows, steps, and
/// the single write at the end. The create call is the only I/O, faked at its seam.
@MainActor
struct ReconcileAccountsFlowTests {
    // MARK: - Accounts step

    @Test("a fresh flow opens on one empty amount, with nothing to continue with")
    func init_startsWithOneEmptyAccount() {
        let flow = makeFlow()

        #expect(flow.accounts.count == 1)
        #expect(flow.accounts.first?.amountText.isEmpty == true)
        #expect(flow.totalCents == nil)
        #expect(!flow.canContinue)
        #expect(flow.path.isEmpty)
    }

    @Test("an added account can be removed, the first one cannot")
    func removeAccount_onlyRemovesAddedRows() throws {
        let flow = makeFlow()
        let first = try #require(flow.accounts.first?.id)
        let added = flow.addAccount()

        #expect(flow.accounts.map(\.id) == [first, added])
        #expect(!flow.canRemoveAccount(id: first))
        #expect(flow.canRemoveAccount(id: added))

        flow.removeAccount(id: first)
        #expect(flow.accounts.map(\.id) == [first, added])

        flow.removeAccount(id: added)
        #expect(flow.accounts.map(\.id) == [first])
    }

    @Test("the total follows every typed amount live, negative account included")
    func totalCents_followsTypedAmounts() {
        let flow = makeFlow()
        flow.accounts[0].amountText = "10.10"
        _ = flow.addAccount()
        flow.accounts[1].amountText = "5"
        flow.accounts[1].isNegative = true

        #expect(flow.totalCents == 510)
        #expect(flow.total == Decimal(string: "5.10"))
        #expect(flow.canContinue)
    }

    @Test("continuing needs one readable amount, and a refused one blocks it")
    func continueFromAccounts_requiresReadableAmounts() {
        let flow = makeFlow()
        flow.continueFromAccounts()
        #expect(flow.path.isEmpty)

        flow.accounts[0].amountText = "12."
        flow.continueFromAccounts()
        #expect(flow.path.isEmpty)
        #expect(flow.hasInvalidAmount(id: flow.accounts[0].id))

        flow.accounts[0].amountText = "12.5"
        flow.continueFromAccounts()
        #expect(flow.path == [.summary])
    }

    @Test("the summary leads to the verdict")
    func continueToVerdict_pushesVerdict() {
        let flow = makeFlow()
        flow.accounts[0].amountText = "100"
        flow.continueFromAccounts()
        flow.continueToVerdict()

        #expect(flow.path == [.summary, .verdict])
    }

    @Test("the items to check open inside the flow, keep the accounts, and lead to the verdict")
    func showItemsToCheck_staysInFlow_thenVerdictReplacesIt() {
        let flow = makeFlow()
        flow.showItemsToCheck()
        #expect(flow.path.isEmpty)

        flow.accounts[0].amountText = "100"
        flow.continueFromAccounts()
        flow.showItemsToCheck()
        flow.showItemsToCheck()
        #expect(flow.path == [.summary, .itemsToCheck])
        #expect(flow.accounts[0].amountText == "100")

        flow.continueToVerdict()
        #expect(flow.path == [.summary, .verdict])
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

    @Test("a refused write keeps every input and the step, then can be retried")
    func submitAdjustment_failure_keepsInputsAndAllowsRetry() async throws {
        let recorder = Recorder(failuresBeforeSuccess: 1)
        let flow = makeFlow(recorder: recorder)
        flow.accounts[0].amountText = "200"
        flow.adjustmentLabel = "Écart"
        flow.continueFromAccounts()
        flow.continueToVerdict()
        let accountsBefore = flow.accounts

        #expect(await flow.submitAdjustment(realizedBalance: 250, of: "budget-current") == .failed)
        #expect(flow.accounts == accountsBefore)
        #expect(flow.path == [.summary, .verdict])
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

    // MARK: - Helpers

    private static let now = Date(timeIntervalSince1970: 1_790_000_000)

    private func makeFlow(recorder: Recorder = Recorder()) -> ReconcileAccountsFlow {
        ReconcileAccountsFlow(
            budgetId: "budget-current",
            adjustmentLabel: "Ajustement",
            createTransaction: { payload in try await recorder.create(payload) },
            onAdjustmentCreated: { recorder.created.append($0) },
            onCompleted: { recorder.completions.append($0) },
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
