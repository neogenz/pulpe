import Foundation
@testable import Pulpe
import Testing

@Suite("EditTemplateLineSheet Tests", .serialized)
@MainActor
struct EditTemplateLineSheetTests {
    private static let parityBudgetId = "september-2026"

    private struct BalanceFixture {
        let budgetId: String
        let staleBalance: Decimal
        let expectedBalance: Decimal
        let budget: Budget
        let staleLines: [BudgetLine]
        let refreshedDetails: BudgetDetails
        let refreshedSparse: [BudgetSparse]
    }

    private struct PropagationContext {
        let budgetService: MockBudgetService
        let budgetListStore: BudgetListStore
        let savingsGoalStore: SavingsGoalStore
        let viewModel: TemplateDetailsViewModel
    }

    // MARK: - Helpers

    private static func makeLine(
        id: String = "tl-1",
        amount: Decimal = 100,
        originalAmount: Decimal? = nil,
        originalCurrency: SupportedCurrency? = nil,
        targetCurrency: SupportedCurrency? = nil,
        exchangeRate: Decimal? = nil
    ) -> TemplateLine {
        TemplateLine(
            id: id,
            templateId: "template-1",
            name: "Test",
            amount: amount,
            kind: .expense,
            recurrence: .fixed,
            description: "",
            createdAt: TestDataFactory.fixedDate,
            updatedAt: TestDataFactory.fixedDate,
            originalAmount: originalAmount,
            originalCurrency: originalCurrency,
            targetCurrency: targetCurrency,
            exchangeRate: exchangeRate
        )
    }

    private static func makeBalanceFixture() throws -> BalanceFixture {
        let totalIncome = try #require(Decimal(string: "11475"))
        let totalExpenses = try #require(Decimal(string: "12962.02"))
        let rollover = try #require(Decimal(string: "-284.78"))
        let staleBalance = try #require(Decimal(string: "-6078"))
        let staleExpenses = try #require(Decimal(string: "17268.22"))
        let expectedBalance = try #require(Decimal(string: "-1771.80"))
        let budget = TestDataFactory.createBudget(id: parityBudgetId, month: 9, year: 2026, rollover: rollover)
        let incomeLine = TestDataFactory.createBudgetLine(
            id: "income",
            budgetId: parityBudgetId,
            amount: totalIncome,
            kind: .income
        )
        let staleLines = [
            incomeLine,
            TestDataFactory.createBudgetLine(
                id: "stale-expense",
                budgetId: parityBudgetId,
                amount: staleExpenses,
                kind: .expense
            ),
        ]
        let refreshedLines = [
            incomeLine,
            TestDataFactory.createBudgetLine(
                id: "expense",
                budgetId: parityBudgetId,
                amount: totalExpenses,
                kind: .expense
            ),
        ]
        let sparse = TestDataFactory.createBudgetSparse(
            id: parityBudgetId,
            month: 9,
            year: 2026,
            totalExpenses: totalExpenses,
            totalIncome: totalIncome,
            remaining: expectedBalance,
            rollover: rollover
        )
        return BalanceFixture(
            budgetId: parityBudgetId,
            staleBalance: staleBalance,
            expectedBalance: expectedBalance,
            budget: budget,
            staleLines: staleLines,
            refreshedDetails: BudgetDetails(budget: budget, transactions: [], budgetLines: refreshedLines),
            refreshedSparse: [sparse]
        )
    }

    private static func seedStaleProjections(_ fixture: BalanceFixture) async -> PropagationContext {
        let cache = BudgetDetailCache.shared
        cache.store(
            budgetId: fixture.budgetId,
            budget: fixture.budget,
            budgetLines: fixture.staleLines,
            transactions: []
        )
        #expect(BudgetDataStore(budgetId: fixture.budgetId).metrics.remaining == fixture.staleBalance)

        let budgetService = MockBudgetService()
        budgetService.stubbedSparse = [
            TestDataFactory.createBudgetSparse(
                id: fixture.budgetId,
                month: 9,
                year: 2026,
                remaining: fixture.staleBalance
            ),
        ]
        let budgetListStore = BudgetListStore(budgetService: budgetService)
        await budgetListStore.forceRefresh()
        #expect(budgetListStore.budgets(forYear: 2026).first?.remaining == fixture.staleBalance)

        let savingsGoalStore = SavingsGoalStore(service: MockSavingsGoalService())
        let projectionStores = TemplateBudgetProjectionStores(
            budgetList: budgetListStore,
            dashboard: DashboardStore(budgetService: MockBudgetService()),
            currentMonth: CurrentMonthStore(),
            savingsGoal: savingsGoalStore
        )
        let viewModel = TemplateDetailsViewModel(templateId: "template-1")
        viewModel.onBudgetDataMutation = {
            projectionStores.invalidate()
        }
        return PropagationContext(
            budgetService: budgetService,
            budgetListStore: budgetListStore,
            savingsGoalStore: savingsGoalStore,
            viewModel: viewModel
        )
    }

    private static func verifyRefresh(_ fixture: BalanceFixture, context: PropagationContext) async {
        context.budgetService.stubbedSparse = fixture.refreshedSparse
        context.viewModel.announceBudgetDataMutation(for: .budgetsChanged)

        #expect(BudgetDetailCache.shared.get(budgetId: fixture.budgetId) == nil)
        #expect(context.savingsGoalStore.budgetMutationVersion == 1)

        await context.budgetListStore.loadIfNeeded()
        let detailService = MockBudgetService()
        detailService.stubbedDetails = fixture.refreshedDetails
        detailService.stubbedSparse = fixture.refreshedSparse
        let coordinator = BudgetDetailsCoordinator(budgetId: fixture.budgetId, budgetService: detailService)
        await coordinator.dispatch(.loadDetails(force: false))

        let refreshedBudgets = context.budgetListStore.budgets(forYear: 2026)
        #expect(context.budgetService.getBudgetsSparseCallCount == 2)
        #expect(refreshedBudgets.first?.remaining == fixture.expectedBalance)
        #expect(coordinator.dataStore.metrics.remaining == fixture.expectedBalance)
        #expect(BudgetFormulas.yearClosingBalance(refreshedBudgets) == fixture.expectedBalance)
        #expect(BudgetDetailCache.shared.get(budgetId: fixture.budgetId) != nil)
    }

    private static func verifyNoBudgetChangePaths(_ fixture: BalanceFixture, context: PropagationContext) async {
        let impacts: [EditTemplateLineSaveImpact] = [
            .templateOnly,
            .propagation(affectedBudgetsCount: 0),
        ]
        for impact in impacts {
            context.viewModel.announceBudgetDataMutation(for: impact)
        }
        await context.budgetListStore.loadIfNeeded()

        #expect(context.budgetService.getBudgetsSparseCallCount == 2)
        #expect(BudgetDetailCache.shared.get(budgetId: fixture.budgetId) != nil)
        #expect(context.savingsGoalStore.budgetMutationVersion == 1)
    }

    // MARK: - shouldShowAlternateCurrency

    @Test("Case 1: alternate currency — picker shown")
    func shouldShowAlternateCurrency_differentCurrencies_returnsTrue() {
        let line = Self.makeLine(originalCurrency: .eur)

        #expect(EditTemplateLineSheet.shouldShowAlternateCurrency(for: line, userCurrency: .chf) == true)
    }

    @Test("Case 2: same currency — picker hidden")
    func shouldShowAlternateCurrency_sameCurrency_returnsFalse() {
        let line = Self.makeLine(originalCurrency: .eur)

        #expect(EditTemplateLineSheet.shouldShowAlternateCurrency(for: line, userCurrency: .eur) == false)
    }

    @Test("Case 3: mono-currency — picker hidden")
    func shouldShowAlternateCurrency_nilOriginal_returnsFalse() {
        let line = Self.makeLine(originalCurrency: nil)

        #expect(EditTemplateLineSheet.shouldShowAlternateCurrency(for: line, userCurrency: .chf) == false)
    }

    // MARK: - initialAmount

    @Test("Case 1: alternate currency — uses originalAmount")
    func initialAmount_alternateCurrency_returnsOriginalAmount() {
        let line = Self.makeLine(amount: 95, originalAmount: 100, originalCurrency: .eur)

        #expect(EditTemplateLineSheet.initialAmount(for: line, userCurrency: .chf) == 100)
    }

    @Test("Case 3: mono-currency — uses line.amount")
    func initialAmount_monoCurrency_returnsLineAmount() {
        let line = Self.makeLine(amount: 42)

        #expect(EditTemplateLineSheet.initialAmount(for: line, userCurrency: .chf) == 42)
    }

    // MARK: - buildUpdate

    @Test("Case 5: mono-currency submit omits all currency metadata")
    func buildUpdate_monoCurrency_omitsCurrencyFields() {
        let update = EditTemplateLineSheet.buildUpdate(
            name: "Rent",
            amount: 1500,
            kind: .expense,
            recurrence: .fixed,
            conversion: nil
        )

        #expect(update.amount == 1500)
        #expect(update.recurrence == .fixed)
        #expect(update.originalAmount == nil)
        #expect(update.originalCurrency == nil)
        #expect(update.targetCurrency == nil)
        #expect(update.exchangeRate == nil)
    }

    @Test("Case 6: alternate currency submit includes fresh conversion metadata")
    func buildUpdate_alternateCurrency_includesConversionMetadata() {
        let conversion = CurrencyConversion(
            convertedAmount: 95,
            originalAmount: 100,
            originalCurrency: .eur,
            targetCurrency: .chf,
            exchangeRate: Decimal(0.95)
        )

        let update = EditTemplateLineSheet.buildUpdate(
            name: "Netflix EU",
            amount: 100,
            kind: .expense,
            recurrence: .fixed,
            conversion: conversion
        )

        #expect(update.amount == 95)
        #expect(update.originalAmount == 100)
        #expect(update.originalCurrency == .eur)
        #expect(update.targetCurrency == .chf)
        #expect(update.exchangeRate == Decimal(0.95))
    }

    @Test("buildUpdate forwards an explicit tag change")
    func buildUpdate_includesChangedTags() {
        let update = EditTemplateLineSheet.buildUpdate(
            name: "Tagged",
            amount: 50,
            kind: .expense,
            recurrence: .fixed,
            conversion: nil,
            tagIds: ["tag-1"]
        )

        #expect(update.tagIds == ["tag-1"])
    }

    @Test("Propagation keeps the direct update tag payload")
    func propagationUpdate_includesChangedTags() {
        var update = TemplateLineUpdate()
        update.tagIds = []

        let propagated = EditTemplateLineSheet.propagationUpdate(id: "tl-1", data: update)

        #expect(propagated.id == "tl-1")
        #expect(propagated.tagIds == [])
    }

    @Test("A propagated update signals changed budgets only when at least one was affected")
    func propagationImpact_distinguishesBudgetChanges() {
        #expect(EditTemplateLineSaveImpact.propagation(affectedBudgetsCount: 1) == .budgetsChanged)
        #expect(EditTemplateLineSaveImpact.propagation(affectedBudgetsCount: 0) == .templateOnly)
    }

    @Test("Template propagation refreshes stale annual and detail balances through the ViewModel mutation seam")
    func templatePropagation_refetchesAnnualBalanceToMatchDetail() async throws {
        BudgetDetailCache.shared.invalidateAll()
        defer { BudgetDetailCache.shared.invalidateAll() }

        let fixture = try Self.makeBalanceFixture()
        let context = await Self.seedStaleProjections(fixture)
        await Self.verifyRefresh(fixture, context: context)
        await Self.verifyNoBudgetChangePaths(fixture, context: context)
    }

    // MARK: - Case 7: pure helper snapshot stability

    @Test("Case 7: pure helper — repeated calls with stable inputs are deterministic")
    func shouldShowAlternateCurrency_isPure() {
        let line = Self.makeLine(originalCurrency: .eur)

        let first = EditTemplateLineSheet.shouldShowAlternateCurrency(for: line, userCurrency: .chf)
        let second = EditTemplateLineSheet.shouldShowAlternateCurrency(for: line, userCurrency: .chf)

        #expect(first == true)
        #expect(first == second)
    }
}
