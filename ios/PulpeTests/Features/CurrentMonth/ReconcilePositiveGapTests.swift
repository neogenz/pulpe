import Foundation
@testable import Pulpe
import Testing

/// Step 2 when my accounts hold more than Pulpe (spec.md §4.3-4.5): the salary that may be early, the
/// « Je dois » row to add, and the money from before Pulpe, one write per answer. The context read and
/// the state write are faked at their seams, on one server whose context follows what it stored.
@MainActor
struct ReconcilePositiveGapTests {
    // MARK: - Salary early

    @Test("pay day 25: the 23rd is 2 days from the next period, the 19th is 6; no pay day or pay day 1 never")
    func salaryEarly_withinFiveDaysOfAPayDayOtherThanOne() async throws {
        let early = try await comparison(on: day(2026, 11, 23), payDay: 25)
        #expect(early.screen == .salaryEarly)
        #expect(early.nextPayDay == 25)

        #expect(try await comparison(on: day(2026, 11, 19), payDay: 25).screen == .moreOnAccounts)
        #expect(try await comparison(on: day(2026, 11, 23), payDay: nil).screen == .moreOnAccounts)
        #expect(try await comparison(on: day(2026, 11, 28), payDay: 1).screen == .moreOnAccounts)
    }

    @Test("pay day 31 in February 2026: March starts on the 28th, so the 23rd is 5 days away and both say « le 28 »")
    func salaryEarly_payDay31_countsToTheRealStartOfMarch() async throws {
        let twentyThird = try await comparison(on: day(2026, 2, 23), payDay: 31)
        #expect(twentyThird.screen == .salaryEarly)
        #expect(twentyThird.nextPayDay == 28)

        let twentySixth = try await comparison(on: day(2026, 2, 26), payDay: 31)
        #expect(twentySixth.screen == .salaryEarly)
        #expect(twentySixth.nextPayDay == 28)

        // Six days before the 28th: no longer « bientôt ».
        #expect(try await comparison(on: day(2026, 2, 22), payDay: 31).screen == .moreOnAccounts)
    }

    @Test("on pay day itself the next pay day is a month away: pay day 31, the 28 February is not early")
    func salaryEarly_onPayDayItself_looksAtTheMonthAfter() async throws {
        let payDay = try await comparison(on: day(2026, 2, 28), payDay: 31)
        #expect(payDay.screen == .moreOnAccounts)
        #expect(payDay.nextPayDay == 31)
    }

    @Test("a first comparison asks about money from before Pulpe, even close to pay day")
    func firstComparison_winsOverSalaryEarly() async throws {
        let server = StateServer(TestDataFactory.createReconciliationContext(hasCompletedComparison: false))
        let first = try await comparison(on: day(2026, 11, 23), payDay: 25, server: server)
        #expect(first.screen == .firstComparison)
    }

    // MARK: - « Je dois »

    @Test("« Ajouter ce que je dois » goes back to step 1 once, with a « Je dois » row to name and the amounts kept")
    func addOwedRow_backToStepOneOnce() async {
        let flow = await makeComparingFlow(server: StateServer())
        #expect(!flow.hasOwedRow)

        flow.addOwedRowFromComparison()
        flow.addOwedRowFromComparison()

        #expect(flow.step == .accounts)
        #expect(flow.accounts.map(\.amountText) == ["7050", ""])
        #expect(flow.accounts.map(\.isNegative) == [false, true])
        // The card question of step 2 asks only while no « Je dois » row exists.
        #expect(flow.hasOwedRow)
        #expect(flow.takeRowToFocus() == flow.accounts.last?.id)
        #expect(flow.takeRowToFocus() == nil)
    }

    // MARK: - « Oui, c'était déjà là »

    @Test("« Oui » is one write that stores the gap and completes; Terminer then writes and tracks nothing")
    func keepGap_oneWrite_oneEvent() async throws {
        let server = StateServer(TestDataFactory.createReconciliationContext(hasCompletedComparison: false))
        let flow = await makeComparingFlow(server: server)

        #expect(await flow.keepGapAsStartingAmount(realizedBalance: 1050, of: "budget-current") == .written)

        #expect(server.updates == [ReconciliationStateUpdate(startingAmount: 6000, completed: true)])
        #expect(server.events == [.upToDate])
        #expect(flow.context?.startingAmount == 6000)
        let matched = try #require(flow.comparison(realizedBalance: 1050, lines: [], transactions: []))
        #expect(matched.screen == .matched)
        #expect(flow.isMarkedComplete)
        #expect(!flow.isCompleted)

        #expect(flow.finishWithoutEntry(of: "budget-current"))
        await Task.yield()
        #expect(server.updates.count == 1)
        #expect(server.events == [.upToDate])
    }

    @Test("a refused « Oui » keeps the screen, tracks nothing, and reads the context again")
    func keepGap_refused_tracksNothing() async throws {
        let server = StateServer(TestDataFactory.createReconciliationContext(hasCompletedComparison: false))
        server.refusesWrites = true
        let flow = await makeComparingFlow(server: server)
        let readsBefore = server.reads

        #expect(await flow.keepGapAsStartingAmount(realizedBalance: 1050, of: "budget-current") == .failed)

        #expect(server.events.isEmpty)
        #expect(!flow.isMarkedComplete)
        #expect(server.reads == readsBefore + 1)
        #expect(flow.comparison(realizedBalance: 1050, lines: [], transactions: [])?.screen == .firstComparison)
    }

    @Test("a new « Comparer » is a new comparison: leaving it tracks and writes the completion again")
    func compare_resetsTheCompletion() async {
        let server = StateServer(TestDataFactory.createReconciliationContext(hasCompletedComparison: false))
        let flow = await makeComparingFlow(server: server)
        #expect(await flow.keepGapAsStartingAmount(realizedBalance: 1050, of: "budget-current") == .written)

        flow.editAccounts()
        flow.compare()
        #expect(!flow.isMarkedComplete)
        await flow.loadContext()
        #expect(flow.finishWithoutEntry(of: "budget-current"))

        #expect(server.events == [.upToDate, .upToDate])
        await waitForCondition("the completion was never sent") { server.updates.count == 2 }
        #expect(server.updates.last == ReconciliationStateUpdate(completed: true))
    }

    // MARK: - Money from before Pulpe

    @Test("saving or resetting the starting amount is one write each, none when unchanged, and no event")
    func startingAmount_oneWritePerChange() async throws {
        let server = StateServer(TestDataFactory.createReconciliationContext(startingAmount: 3100))
        let flow = await makeComparingFlow(server: server)
        let line = TestDataFactory.createBudgetLine(id: "assurance", name: "Assurance", amount: 100)
        let assurance = ReconcileAccountsFlow.Suggestion(
            target: .budgetLine(line), name: "Assurance", amount: 100, origin: .plannedThisMonth, isExact: false
        )
        #expect(flow.beginCheck())
        #expect(await flow.check(assurance, realizedBalance: 1050) { true })
        #expect(flow.comparedBeforeChecks != nil)

        #expect(await flow.saveStartingAmount(3100) == .ignored)
        #expect(server.updates.isEmpty)

        #expect(await flow.saveStartingAmount(Decimal(string: "2999.50") ?? 0) == .written)
        #expect(flow.context?.startingAmount == Decimal(string: "2999.50"))
        #expect(flow.comparedBeforeChecks == nil)

        #expect(await flow.saveStartingAmount(0) == .written)
        #expect(flow.context?.startingAmount == 0)
        #expect(server.updates == [
            ReconciliationStateUpdate(startingAmount: Decimal(string: "2999.50")),
            ReconciliationStateUpdate(startingAmount: 0),
        ])
        #expect(server.events.isEmpty)
    }

    @Test("while the starting amount is out nothing ends or leaves; refused, the context is read again")
    func startingAmount_pending_blocksTheExits() async {
        let (released, release) = AsyncStream<Void>.makeStream()
        let server = StateServer(TestDataFactory.createReconciliationContext(startingAmount: 3100))
        server.refusesWrites = true
        server.held = released
        let flow = await makeComparingFlow(server: server)
        let readsBefore = server.reads

        let write = Task { await flow.saveStartingAmount(0) }
        await waitForCondition("the write never left") { !server.updates.isEmpty }
        #expect(flow.isWriting)
        #expect(!flow.canFinish(of: "budget-current"))
        #expect(!flow.beginCheck())
        #expect(!flow.shouldClose(loadedBudgetId: "budget-other"))
        #expect(await flow.saveStartingAmount(1) == .ignored)

        release.yield()
        #expect(await write.value == .failed)
        #expect(server.reads == readsBefore + 1)
        #expect(!flow.isWriting)
        #expect(server.updates.count == 1)
    }

    // MARK: - Other reasons

    @Test("other reasons keep their order, drop what cannot be the cause, and stop at three")
    func reasons_orderConditionsAndCap() {
        typealias Sheet = ReconcileReasonsSheet
        #expect(Sheet.reasons(hasOwedRow: false, hasPartlySpent: true) == [.card, .partlySpent, .income])
        #expect(Sheet.reasons(hasOwedRow: false, hasPartlySpent: false) == [.card, .income, .savings])
        #expect(Sheet.reasons(hasOwedRow: true, hasPartlySpent: true) == [.partlySpent, .income, .savings])
        #expect(Sheet.reasons(hasOwedRow: true, hasPartlySpent: false) == [.income, .savings])
    }

    @Test("« Noter un revenu » from the reasons writes nothing once a synced item turned the same gap into suggestions")
    func reasonIncome_screenMoved_writesNothing() async throws {
        let server = StateServer()
        let flow = await makeComparingFlow(server: server, today: try day(2026, 11, 23))
        let opened = try #require(
            flow.comparison(realizedBalance: 1050, lines: [], transactions: [], payDayOfMonth: 25)
        )
        #expect(opened.screen == .salaryEarly)

        // A 6 000.00 income, unchecked, synced while the sheet was open: same gap, suggestions again.
        let prime = TestDataFactory.createTransaction(id: "prime", name: "Prime", amount: 6000, kind: .income)
        let moved = flow.comparison(realizedBalance: 1050, lines: [], transactions: [prime], payDayOfMonth: 25)
        #expect(moved?.gap == opened.gap)
        #expect(moved?.screen == .suggestions)
        let outcome = await flow.submitReasonIncome(
            gap: opened.gap, screen: .salaryEarly, current: moved, realizedBalance: 1050, of: "budget-current"
        )
        #expect(outcome == .ignored)
        #expect(server.creates == 0)

        let same = await flow.submitReasonIncome(
            gap: opened.gap, screen: .salaryEarly, current: opened, realizedBalance: 1050, of: "budget-current"
        )
        #expect(same == .failed)
        #expect(server.creates == 1)
    }

    // MARK: - Helpers

    /// 7 050.00 typed against a realized 1 050.00: accounts 6 000.00 above Pulpe, no suggestion.
    private func comparison(
        on today: Date, payDay: Int?, server: StateServer = StateServer()
    ) async throws -> ReconcileAccountsFlow.Comparison {
        let flow = await makeComparingFlow(server: server, today: today)
        return try #require(
            flow.comparison(realizedBalance: 1050, lines: [], transactions: [], payDayOfMonth: payDay)
        )
    }

    private func makeComparingFlow(server: StateServer, today: Date = .now) async -> ReconcileAccountsFlow {
        let flow = ReconcileAccountsFlow(
            budgetId: "budget-current",
            entryName: "Écart avec mes comptes",
            createTransaction: { _ in try await server.create() },
            fetchContext: { _ in try await server.read() },
            updateState: { try await server.write($0) },
            onAdjustmentCreated: { _ in },
            onCompleted: { server.events.append($0) },
            now: { today }
        )
        flow.accounts[0].amountText = "7050"
        flow.compare()
        await flow.loadContext()
        return flow
    }

    private func day(_ year: Int, _ month: Int, _ day: Int) throws -> Date {
        try #require(Calendar.current.date(from: DateComponents(year: year, month: month, day: day, hour: 12)))
    }
}

/// The reconciliation endpoints, faked: the context read and the state write share what the server holds,
/// so a read after a write sees it. `held` keeps a write open until the test releases it.
@MainActor
private final class StateServer {
    private var context: ReconciliationContext
    private(set) var updates: [ReconciliationStateUpdate] = []
    private(set) var reads = 0
    var events: [AccountReconciliation.Completion] = []
    var refusesWrites = false
    var held: AsyncStream<Void>?

    init(_ context: ReconciliationContext = TestDataFactory.createReconciliationContext()) {
        self.context = context
    }

    /// Counts the entries asked for, then refuses them: what matters is whether one was asked.
    private(set) var creates = 0

    func create() throws -> Transaction {
        creates += 1
        throw URLError(.notConnectedToInternet)
    }

    func read() throws -> ReconciliationContext {
        reads += 1
        return context
    }

    func write(_ update: ReconciliationStateUpdate) async throws -> ReconciliationState {
        updates.append(update)
        if let held { for await _ in held { break } }
        if refusesWrites { throw URLError(.notConnectedToInternet) }
        context = ReconciliationContext(
            startingAmount: update.startingAmount ?? context.startingAmount,
            hasCompletedComparison: update.completed ?? context.hasCompletedComparison,
            priorCorrection: context.priorCorrection, priorItems: context.priorItems
        )
        return ReconciliationState(
            startingAmount: context.startingAmount, hasCompletedComparison: context.hasCompletedComparison
        )
    }
}
