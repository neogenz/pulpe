import Foundation
@testable import Pulpe
import Testing

@Suite("BudgetDetailsViewModel — showCheckToastIfNeeded")
@MainActor
struct BudgetDetailsViewModelToastTests {
    // MARK: - Default branch (no consumption)

    @Test
    func showCheckToast_defaultBranch_formatsWithEURSymbolAndFrenchLocale() throws {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1234.56, kind: .expense)
        viewModel.addBudgetLine(line)
        let toastManager = ToastManager()

        viewModel.showCheckToastIfNeeded(
            for: line,
            toastManager: toastManager,
            presentationCurrency: .eur
        )

        let message = try #require(toastManager.currentToast?.message)
        #expect(message.hasPrefix("Pointé · "))
        #expect(message.hasSuffix(" €"))
        #expect(message.contains(",56"), "Expected French decimal comma, got: \(message)")
        #expect(!message.contains("CHF"))
    }

    @Test
    func showCheckToast_defaultBranch_formatsWithCHFCodeAndSwissLocale() throws {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1234.56, kind: .expense)
        viewModel.addBudgetLine(line)
        let toastManager = ToastManager()

        viewModel.showCheckToastIfNeeded(
            for: line,
            toastManager: toastManager,
            presentationCurrency: .chf
        )

        let message = try #require(toastManager.currentToast?.message)
        #expect(message.hasPrefix("Pointé · "))
        #expect(message.hasSuffix(" CHF"))
        #expect(message.contains(".56"), "Expected Swiss decimal dot, got: \(message)")
        #expect(containsSwissGroupingSeparator(message),
                "Expected Swiss grouping separator for 1234, got: \(message)")
        #expect(!message.contains("€"))
    }

    // MARK: - Amounts-hidden branch

    @Test
    func showCheckToast_amountsHidden_emitsShortMessageWithoutCurrency() throws {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 1234.56, kind: .expense)
        viewModel.addBudgetLine(line)
        let toastManager = ToastManager()

        viewModel.showCheckToastIfNeeded(
            for: line,
            toastManager: toastManager,
            presentationCurrency: .chf,
            amountsHidden: true
        )

        let message = try #require(toastManager.currentToast?.message)
        #expect(message == "Pointé")
    }

    // MARK: - Pessimistic branch (consumed < line.amount)

    @Test(
        "pessimistic branch surfaces consumed and effective with the active currency",
        arguments: [
            (SupportedCurrency.chf, "CHF"),
            (SupportedCurrency.eur, "€"),
        ]
    )
    func showCheckToast_pessimistic_includesConsumedAndEffective(
        currency: SupportedCurrency,
        symbol: String
    ) throws {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", amount: 200, kind: .expense)
        let consumedTx = TestDataFactory.createTransaction(
            id: "tx-1",
            budgetLineId: "line-1",
            amount: 120,
            kind: .expense,
            isChecked: true
        )
        viewModel.addBudgetLine(line)
        viewModel.addTransaction(consumedTx)
        let toastManager = ToastManager()

        viewModel.showCheckToastIfNeeded(
            for: line,
            toastManager: toastManager,
            presentationCurrency: currency
        )

        let message = try #require(toastManager.currentToast?.message)
        #expect(message.hasPrefix("Pointé · "))
        #expect(message.hasSuffix(" prévus"))
        #expect(message.contains(" — "), "Expected em-dash separator, got: \(message)")
        #expect(message.contains("120"), "Expected consumed amount, got: \(message)")
        #expect(message.contains("200"), "Expected effective amount, got: \(message)")
        // Both sides of the em-dash carry the currency symbol, so it appears twice.
        #expect(message.components(separatedBy: symbol).count - 1 == 2,
                "Expected currency symbol twice (consumed + effective), got: \(message)")
    }

    // MARK: - Early-exit branches (no toast)

    @Test
    func showCheckToast_onCheckedLine_emitsNoToast() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", kind: .expense, isChecked: true)
        viewModel.addBudgetLine(line)
        let toastManager = ToastManager()

        viewModel.showCheckToastIfNeeded(
            for: line,
            toastManager: toastManager,
            presentationCurrency: .chf
        )

        #expect(toastManager.currentToast == nil)
    }

    @Test
    func showCheckToast_onIncomeLine_emitsNoToast() {
        let viewModel = BudgetDetailsViewModel(budgetId: "test-budget")
        let line = TestDataFactory.createBudgetLine(id: "line-1", kind: .income)
        viewModel.addBudgetLine(line)
        let toastManager = ToastManager()

        viewModel.showCheckToastIfNeeded(
            for: line,
            toastManager: toastManager,
            presentationCurrency: .chf
        )

        #expect(toastManager.currentToast == nil)
    }
}
