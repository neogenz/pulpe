import Foundation
@testable import Pulpe
import Testing

/// Step 2 of « Comparer avec mes comptes » read from the numbers as they stand: the compared
/// figure, the suggestions, the checks and the screen.
@MainActor
struct ReconcileComparisonTests {
    @Test("the phase-7 month opens on Assurance, Essence and Pharmacie, Assurance alone settling the gap")
    func comparison_phase7Month_ranksThreeSuggestions() async throws {
        let month = await makePhase7Month()

        let comparison = month.flow.comparison(
            realizedBalance: 1050, lines: month.lines, transactions: month.transactions
        )
        let opened = try #require(comparison)
        let openedIds: [String] = ["bl-assurance", "tx-essence", "tx-pharmacie"]
        let openedExact: [Bool] = [true, false, false]
        #expect(opened.compared == Decimal(1050))
        #expect(opened.gap == Decimal(-100))
        #expect(opened.screen == .suggestions)
        #expect(opened.suggestions.map(\.id) == openedIds)
        #expect(opened.suggestions.map(\.isExact) == openedExact)
        #expect(opened.found == nil)
    }

    @Test("checking Essence then Pharmacie strikes the old figure, counts what was found, then matches")
    func comparison_checksWalkTheGapToMatched() async throws {
        let month = await makePhase7Month()
        let flow = month.flow
        let comparison = flow.comparison(realizedBalance: 1050, lines: month.lines, transactions: month.transactions)
        let opened = try #require(comparison)

        #expect(flow.beginCheck())
        #expect(await flow.check(opened.suggestions[1], realizedBalance: 1050) { true })
        let checked = TestDataFactory.createTransaction(id: "essence", name: "Essence", amount: 60, isChecked: true)
        let pharmacie = try #require(month.transactions.last)
        let partial = try #require(
            flow.comparison(realizedBalance: 990, lines: month.lines, transactions: [checked, pharmacie])
        )
        #expect(flow.beforeChecks?.compared == Decimal(1050))
        #expect(partial.compared == Decimal(990))
        #expect(partial.found == Decimal(60))
        #expect(partial.screen == .suggestions)
        #expect(partial.suggestions.map(\.id) == ["tx-pharmacie"])
        #expect(partial.suggestions.first?.isExact == true)

        #expect(flow.beginCheck())
        #expect(await flow.check(partial.suggestions[0], realizedBalance: 990) { true })
        let checkedPharmacie = TestDataFactory.createTransaction(
            id: "pharmacie", name: "Pharmacie", amount: 40, isChecked: true
        )
        let matched = try #require(
            flow.comparison(realizedBalance: 950, lines: month.lines, transactions: [checked, checkedPharmacie])
        )
        #expect(matched.compared == Decimal(950))
        #expect(matched.screen == .matched)
        #expect(matched.found == Decimal(100))
        #expect(flow.checkedSuggestions.map(\.id) == ["tx-essence", "tx-pharmacie"])
    }

    @Test("a refused check moves nothing, and a second tap while one is out checks nothing")
    func check_refusedOrPending_changesNothing() async throws {
        let flow = await makeComparingFlow("950")
        let line = TestDataFactory.createBudgetLine(id: "assurance", amount: 100)
        let comparison = flow.comparison(realizedBalance: 1050, lines: [line], transactions: [])
        let row = try #require(comparison?.suggestions.first)

        #expect(flow.beginCheck())
        #expect(await flow.check(row, realizedBalance: 1050) { false } == false)
        #expect(flow.beforeChecks == nil)
        #expect(flow.checkedSuggestions.isEmpty)

        #expect(flow.beginCheck())
        let (released, release) = AsyncStream<Void>.makeStream()
        let first = Task {
            await flow.check(row, realizedBalance: 1050) {
                for await _ in released { break }
                return true
            }
        }
        #expect(!flow.beginCheck())
        #expect(!flow.canFinish(of: "budget-current"))
        release.yield()
        #expect(await first.value)
        #expect(flow.checkedSuggestions.map(\.id) == ["bl-assurance"])
    }

    @Test("from the tap that fills the circle, no exit completes until the check is back")
    func beginCheck_blocksTheExitsUntilTheCheckReturns() async throws {
        let flow = await makeComparingFlow("950")
        let line = TestDataFactory.createBudgetLine(id: "assurance", amount: 100)
        let comparison = flow.comparison(realizedBalance: 1050, lines: [line], transactions: [])
        let row = try #require(comparison?.suggestions.first)
        nonisolated(unsafe) var toggles = 0

        #expect(await flow.check(row, realizedBalance: 1050) { toggles += 1; return true } == false)
        #expect(toggles == 0)

        #expect(flow.beginCheck())
        #expect(!flow.finishWithoutEntry(of: "budget-current"))
        #expect(!flow.canSubmitAdjustment(realizedBalance: 1050, of: "budget-current"))
        #expect(await flow.check(row, realizedBalance: 1050) { toggles += 1; return true })
        #expect(toggles == 1)
        #expect(flow.finishWithoutEntry(of: "budget-current"))
    }

    @Test("a check that widens the gap finds nothing: 950 against 1 050, then a 50 income")
    func found_isTheReductionOfTheAbsoluteGap() async throws {
        let flow = await makeComparingFlow("950")
        let bonus = TestDataFactory.createTransaction(id: "bonus", name: "Bonus", amount: 50, kind: .income)
        let row = ReconcileAccountsFlow.Suggestion(.transaction(bonus))

        #expect(flow.beginCheck())
        #expect(await flow.check(row, realizedBalance: 1050) { true })
        let widened = try #require(flow.comparison(realizedBalance: 1100, lines: [], transactions: []))
        #expect(widened.gap == Decimal(-150))
        #expect(widened.found == 0)
    }

    @Test("a line already partly consumed settles the gap but is not highlighted: its amount is not the gap")
    func isExact_onlyWhenTheAmountIsTheGap() async throws {
        let flow = await makeComparingFlow("960")
        let line = TestDataFactory.createBudgetLine(id: "courses", name: "Courses", amount: 100)
        let consumed = TestDataFactory.createTransaction(
            id: "migros", budgetLineId: "courses", name: "Migros", amount: 60, isChecked: true
        )
        let cinema = TestDataFactory.createTransaction(id: "cinema", name: "Cinéma", amount: 40)
        let comparison = try #require(
            flow.comparison(realizedBalance: 1000, lines: [line], transactions: [consumed, cinema])
        )

        #expect(comparison.gap == Decimal(-40))
        #expect(comparison.suggestions.map(\.id) == ["bl-courses", "tx-cinema"])
        #expect(comparison.suggestions.map(\.isExact) == [false, true])
    }

    @Test("the « Voir les autres » list hands back to step 2 once the figures match")
    func closesToCheckList_onceMatched() async {
        let flow = await makeComparingFlow("950")

        #expect(!flow.closesToCheckList(realizedBalance: 1050))
        // One of the five checked there: Pulpe now has 950 too.
        #expect(flow.closesToCheckList(realizedBalance: 950))
    }

    @Test("the list stays open on the optimistic match, and after the server refuses the check")
    func closesToCheckList_waitsForTheConfirmedCheck() async {
        let flow = await makeComparingFlow("950")
        let expense = TestDataFactory.createTransaction(id: "achat", amount: 100)
        let row = ReconcileAccountsFlow.Suggestion(.transaction(expense))

        #expect(flow.beginCheck())
        let (released, release) = AsyncStream<Void>.makeStream()
        let refused = Task {
            await flow.check(row, realizedBalance: 1050) {
                for await _ in released { break }
                return false
            }
        }
        // The store already shows it checked: Pulpe reads 950 before the server answers.
        #expect(!flow.closesToCheckList(realizedBalance: 950))
        release.yield()
        #expect(await refused.value == false)
        #expect(!flow.closesToCheckList(realizedBalance: 1050))
    }

    @Test("new balances from step 1 start over: the suggestions show again, unchecked, and nothing is struck through")
    func compare_afterDismissAndChecks_startsOver() async throws {
        let flow = await makeComparingFlow("950")
        let courses = TestDataFactory.createBudgetLine(id: "courses", amount: 30)
        let opened = flow.comparison(realizedBalance: 1050, lines: [courses], transactions: [])
        let row = try #require(opened?.suggestions.first)
        #expect(flow.beginCheck())
        #expect(await flow.check(row, realizedBalance: 1050) { true })
        flow.dismissSuggestions()

        // 870 on accounts against 1 020 in Pulpe: Loyer, 150, now settles the gap exactly.
        flow.editAccounts()
        flow.accounts[0].amountText = "870"
        flow.compare()

        #expect(!flow.isDismissed)
        #expect(flow.beforeChecks == nil)
        // Unchecked on the web meanwhile, a row the server lists again must not keep its filled circle.
        #expect(flow.checkedSuggestions.isEmpty)
        let loyer = TestDataFactory.createBudgetLine(id: "loyer", amount: 150)
        let restarted = try #require(flow.comparison(realizedBalance: 1020, lines: [loyer], transactions: []))
        #expect(restarted.screen == .suggestions)
        #expect(restarted.suggestions.first?.isExact == true)
    }

    @Test("« Retirer « Je dois … » » changes the total: « trouvés » restarts, the struck figure stays")
    func removeOwedRows_restartsFound() async throws {
        let flow = makeFlow()
        flow.accounts[0].amountText = "1250"
        flow.addFreeAccount(isOwed: true)
        flow.accounts[1].amountText = "200"
        flow.compare()
        let line = TestDataFactory.createBudgetLine(id: "assurance", amount: 100)
        let opened = flow.comparison(realizedBalance: 1150, lines: [line], transactions: [])
        let row = try #require(opened?.suggestions.first)
        #expect(flow.beginCheck())
        #expect(await flow.check(row, realizedBalance: 1150) { true })
        #expect(flow.beforeChecks?.compared == Decimal(1150))

        flow.removeOwedRows()
        #expect(flow.beforeChecks == .init(compared: nil, realized: 1150))
    }

    @Test("« Aucune dépense ne correspond » leaves the suggestions for the gap's own screen")
    func dismissSuggestions_showsTheGapScreen() async {
        let flow = await makeComparingFlow("950")
        let line = TestDataFactory.createBudgetLine(id: "assurance", amount: 100)
        #expect(flow.comparison(realizedBalance: 1050, lines: [line], transactions: [])?.screen == .suggestions)

        flow.dismissSuggestions()
        #expect(flow.comparison(realizedBalance: 1050, lines: [line], transactions: [])?.screen == .largeGap)
        #expect(flow.comparison(realizedBalance: 955, lines: [line], transactions: [])?.screen == .smallGap)
    }

    @Test("« Retirer « Je dois … » » takes what I owe out, and goes back to the balances when nothing is left")
    func removeOwedRows_recomputesOrGoesBack() {
        let flow = makeFlow()
        flow.accounts[0].amountText = "1000"
        flow.addFreeAccount(isOwed: true)
        flow.accounts[1].amountText = "200"
        flow.compare()

        flow.removeOwedRows()
        #expect(!flow.hasOwedRow)
        #expect(flow.totalCents == 100_000)
        #expect(flow.step == .comparison)

        let owedOnly = makeFlow()
        owedOnly.accounts[0].isOwed = true
        owedOnly.accounts[0].amountText = "200"
        owedOnly.compare()
        owedOnly.removeOwedRows()
        #expect(owedOnly.step == .accounts)
    }

    // MARK: - Helpers

    /// Phase 7's month: realized 1 050.00, Assurance 100, Essence 60 and Pharmacie 40 unchecked, and
    /// 950.00 typed.
    private func makePhase7Month() async -> Phase7Month {
        let flow = await makeComparingFlow("950")
        let assurance = TestDataFactory.createBudgetLine(id: "assurance", name: "Assurance", amount: 100)
        let essence = TestDataFactory.createTransaction(id: "essence", name: "Essence", amount: 60)
        let pharmacie = TestDataFactory.createTransaction(id: "pharmacie", name: "Pharmacie", amount: 40)
        return Phase7Month(flow: flow, lines: [assurance], transactions: [essence, pharmacie])
    }

    private struct Phase7Month {
        let flow: ReconcileAccountsFlow
        let lines: [BudgetLine]
        let transactions: [Transaction]
    }

    private func makeFlow() -> ReconcileAccountsFlow {
        ReconcileAccountsFlow(
            budgetId: "budget-current",
            entryName: "Écart avec mes comptes",
            createTransaction: { _ in throw CancellationError() },
            onAdjustmentCreated: { _ in },
            onCompleted: { _ in }
        )
    }

    /// Step 2 with one account typed, as the sheet opens it.
    private func makeComparingFlow(_ amount: String) async -> ReconcileAccountsFlow {
        let flow = makeFlow()
        flow.accounts[0].amountText = amount
        flow.compare()
        return flow
    }
}

// MARK: - Context reads around a check

extension ReconcileComparisonTests {
    @Test("a movement whose prévision is pending deletion ranks Hors prévision, and its check keeps the link")
    func ranking_readsTheLedger_andChecksTheStoredMovement() async throws {
        let coordinator = BudgetDetailsCoordinator(
            budgetId: "budget-current", budgetLineService: MockBudgetLineService(),
            transactionService: MockTransactionService()
        )
        let courses = TestDataFactory.createBudgetLine(id: "courses", name: "Courses", amount: 100)
        let essence = TestDataFactory.createTransaction(
            id: "essence", budgetLineId: "courses", name: "Essence", amount: 60
        )
        await coordinator.dispatch(.addBudgetLine(courses))
        await coordinator.dispatch(.addTransaction(essence))
        let toasts = ToastContext(toastManager: ToastManager(), presentationCurrency: .chf)
        await coordinator.dispatch(.softDeleteBudgetLine(courses, toasts))
        let checking = coordinator.reconciliationChecking(toasts, amountsHidden: false)

        // 940 on accounts against 1 000: the balance reads Essence as Hors prévision, so does the ranking.
        let flow = await makeComparingFlow("940")
        let comparison = flow.comparison(
            realizedBalance: 1000, lines: checking.budgetLines, transactions: checking.transactions
        )
        let row = try #require(comparison?.suggestions.first)
        #expect(row.id == "tx-essence")
        #expect(row.isExact)

        #expect(flow.beginCheck())
        #expect(await flow.check(row, realizedBalance: 1000) { await checking.check(row.target) })
        let stored = coordinator.dataStore.transactions.first { $0.id == "essence" }
        #expect(stored?.isChecked == true)
        // Undoing the deletion regroups it under Courses.
        #expect(stored?.budgetLineId == "courses")
    }
}
