import Foundation
@testable import Pulpe
import Testing

/// What step 2 shows from its numbers (spec.md §4.1, §4.2, §4.4): the matched card read from the accounts,
/// the Pulpe figure as the Accueil's « Solde pointé » alone, and the savings wording.
@MainActor
struct ReconcileCompareFiguresTests {
    // MARK: - Matched card

    @Test("the matched card starts from the accounts: 1 020.00, −320.00, 700.00 left to spend")
    func matchedCard_startsFromTheAccounts() async throws {
        let flow = await makeComparingFlow("1020")
        let matched = try #require(flow.comparison(realizedBalance: 1020, lines: [], transactions: []))
        let card = AccountReconciliation.matchedBreakdown(available: 700, compared: matched.compared)

        #expect(matched.screen == .matched)
        #expect(matched.accounts == 1020)
        #expect([card.stillPlanned, card.remaining] == [-320, 700])
        #expect(matched.accounts + card.stillPlanned == card.remaining)
    }

    // MARK: - « Dans Pulpe, déjà coché »

    @Test("the Pulpe figure is the Accueil's 900.00, and the gap reads it alone")
    func pulpeFigure_isTheCheckedBalance() async throws {
        let flow = await makeComparingFlow("840")
        let comparison = try #require(flow.comparison(realizedBalance: 900, lines: [], transactions: []))

        #expect(comparison.realized == 900)
        #expect(comparison.compared == 900)
        #expect(comparison.gap == -60)
    }

    @Test("checking Courses strikes 900.00 through")
    func struckFigure_onceTheCheckedBalanceMoved() async throws {
        let flow = await makeComparingFlow("840")
        let courses = TestDataFactory.createBudgetLine(id: "courses", name: "Courses", amount: 60)
        let opened = try #require(flow.comparison(realizedBalance: 900, lines: [courses], transactions: []))
        #expect(opened.realizedBefore == nil)

        let coursesRow = try #require(opened.suggestions.first)
        #expect(flow.beginCheck())
        #expect(await flow.check(coursesRow, realizedBalance: 900) { true })
        let checked = TestDataFactory.createBudgetLine(id: "courses", name: "Courses", amount: 60, isChecked: true)
        let matched = try #require(flow.comparison(realizedBalance: 840, lines: [checked], transactions: []))
        #expect(matched.screen == .matched)
        #expect(matched.realized == 840)
        #expect(matched.realizedBefore == 900)

        // New balances start another comparison: nothing struck through.
        flow.editAccounts()
        flow.compare()
        #expect(flow.beforeChecks == nil)
        #expect(flow.comparison(realizedBalance: 840, lines: [checked], transactions: [])?.realizedBefore == nil)
    }

    @Test("« Je dois » removed keeps 900.00 struck; « trouvés » restarts at the next check")
    func struckFigure_survivesOwedRemoval_foundRestarts() async throws {
        let flow = await makeComparingFlow("800")
        flow.editAccounts()
        let owed = flow.addFreeAccount(isOwed: true)
        flow.accounts[flow.accounts.firstIndex { $0.id == owed } ?? 0].amountText = "50"
        flow.compare()
        let courses = TestDataFactory.createBudgetLine(id: "courses", name: "Courses", amount: 20)
        let essence = TestDataFactory.createBudgetLine(id: "essence", name: "Essence", amount: 30)

        // 750.00 on the accounts, 900.00 in Pulpe: checking Courses moves the checked balance to 880.00.
        #expect(flow.beginCheck())
        #expect(await flow.check(suggestion(courses), realizedBalance: 900) { true })
        #expect(flow.comparison(realizedBalance: 880, lines: [], transactions: [])?.found == 20)

        flow.removeOwedRows()
        let afterRemoval = try #require(flow.comparison(realizedBalance: 880, lines: [], transactions: []))
        #expect(afterRemoval.accounts == 800)
        #expect(afterRemoval.realizedBefore == 900)
        #expect(afterRemoval.found == nil)

        // 800.00 against 880.00: Essence counts from the figure at its own check, not from 900.00.
        #expect(flow.beginCheck())
        #expect(await flow.check(suggestion(essence), realizedBalance: 880) { true })
        let afterEssence = try #require(flow.comparison(realizedBalance: 850, lines: [], transactions: []))
        #expect(afterEssence.realizedBefore == 900)
        #expect(afterEssence.found == 30)
    }

    @Test("a checked balance moved by less than a cent, 900.004 to 900.001, strikes nothing")
    func struckFigure_comparesAtTheCent() async throws {
        let flow = await makeComparingFlow("950")
        let line = TestDataFactory.createBudgetLine(id: "frais", name: "Frais", amount: 100)
        #expect(flow.beginCheck())
        #expect(await flow.check(suggestion(line), realizedBalance: Decimal(string: "900.004") ?? 0) { true })
        let realized = Decimal(string: "900.001") ?? 0
        #expect(flow.comparison(realizedBalance: realized, lines: [], transactions: [])?.realizedBefore == nil)
    }

    // MARK: - Savings in the suggestions

    @Test("below Pulpe, a saving shown names savings in the sentence and the button; « Je dois » keeps its sentence")
    func suggestionsWording_savingShown_namesSavings() async throws {
        let flow = await makeComparingFlow("950")
        let pilier = TestDataFactory.createBudgetLine(id: "pilier", name: "3e pilier", amount: 100, kind: .saving)
        let comparison = try #require(flow.comparison(realizedBalance: 1050, lines: [pilier], transactions: []))
        #expect(comparison.suggestions.map(\.id) == ["bl-pilier"])

        let wording = ReconcileCompareStepView.suggestionsWording(comparison, hasOwedRow: false)
        let savingsLead = AppLocale.string("Coche les dépenses et l'épargne que tu vois dans l'app de ta banque.")
        #expect(wording.lead == savingsLead)
        #expect(wording.dismiss == AppLocale.string("Rien ne correspond"))

        let owed = ReconcileCompareStepView.suggestionsWording(comparison, hasOwedRow: true)
        #expect(owed.lead == AppLocale.string("Coche les achats faits avec ta carte."))
        #expect(owed.dismiss == AppLocale.string("Rien ne correspond"))
    }

    @Test("a saving movement counts by its money kind, as a saving prévision does")
    func suggestionsWording_savingByMoneyKind_notBySource() async throws {
        let flow = await makeComparingFlow("950")
        let virement = TestDataFactory.createTransaction(id: "virement", name: "Virement", amount: 100, kind: .saving)
        let comparison = try #require(flow.comparison(realizedBalance: 1050, lines: [], transactions: [virement]))

        #expect(comparison.suggestions.map(\.id) == ["tx-virement"])
        #expect(comparison.suggestions.map(\.kind) == [.saving])
        let wording = ReconcileCompareStepView.suggestionsWording(comparison, hasOwedRow: false)
        #expect(wording.dismiss == AppLocale.string("Rien ne correspond"))
    }

    @Test("without a saving every text stays: expenses below Pulpe, card purchases with « Je dois », income above")
    func suggestionsWording_withoutSaving_unchanged() async throws {
        let flow = await makeComparingFlow("950")
        let essence = TestDataFactory.createTransaction(id: "essence", name: "Essence", amount: 100)
        let below = try #require(flow.comparison(realizedBalance: 1050, lines: [], transactions: [essence]))
        let expenses = ReconcileCompareStepView.suggestionsWording(below, hasOwedRow: false)
        #expect(expenses.lead == AppLocale.string("Coche les dépenses que tu vois dans l'app de ta banque."))
        #expect(expenses.dismiss == AppLocale.string("Aucune dépense ne correspond"))
        let card = ReconcileCompareStepView.suggestionsWording(below, hasOwedRow: true)
        #expect(card.lead == AppLocale.string("Coche les achats faits avec ta carte."))
        #expect(card.dismiss == AppLocale.string("Aucune dépense ne correspond"))

        let prime = TestDataFactory.createTransaction(id: "prime", name: "Prime", amount: 100, kind: .income)
        let above = try #require(flow.comparison(realizedBalance: 850, lines: [], transactions: [prime]))
        #expect(above.screen == .suggestions)
        let income = ReconcileCompareStepView.suggestionsWording(above, hasOwedRow: false)
        #expect(income.lead == AppLocale.string("Coche les revenus que tu vois dans l'app de ta banque."))
        #expect(income.dismiss == AppLocale.string("Aucun revenu ne correspond"))
    }

    // MARK: - Helpers

    private func suggestion(_ line: BudgetLine) -> ReconcileAccountsFlow.Suggestion {
        .init(
            target: .budgetLine(line), name: line.name, amount: line.amount, origin: .plannedThisMonth, isExact: false
        )
    }

    /// Step 2 with one account typed, as the sheet opens it.
    private func makeComparingFlow(_ amount: String) async -> ReconcileAccountsFlow {
        let flow = ReconcileAccountsFlow(
            budgetId: "budget-current",
            entryName: "Écart avec mes comptes",
            createTransaction: { _ in throw CancellationError() },
            onAdjustmentCreated: { _ in },
            onCompleted: { _ in }
        )
        flow.accounts[0].amountText = amount
        flow.compare()
        return flow
    }
}
