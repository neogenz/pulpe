import Foundation
@testable import Pulpe
import Testing

@Suite("EditTransactionSheet Tests")
@MainActor
struct EditTransactionSheetTests {
    // MARK: - Dependencies

    @Test
    func dependencies_updateTransaction_passesCorrectIdAndData() async throws {
        nonisolated(unsafe) var receivedId: String?
        nonisolated(unsafe) var receivedData: TransactionUpdate?
        let expectedTransaction = TestDataFactory.createTransaction(
            id: "tx-1",
            name: "Updated",
            amount: 200,
            kind: .income
        )

        let deps = EditTransactionDependencies(
            updateTransaction: { id, data in
                receivedId = id
                receivedData = data
                return expectedTransaction
            }
        )

        let result = try await deps.updateTransaction("tx-1", TransactionUpdate(
            name: "Updated",
            amount: 200,
            kind: .income,
            transactionDate: TestDataFactory.fixedDate
        ))

        #expect(receivedId == "tx-1")
        #expect(receivedData?.name == "Updated")
        #expect(receivedData?.amount == 200)
        #expect(receivedData?.kind == .income)
        #expect(receivedData?.transactionDate == TestDataFactory.fixedDate)
        #expect(result.id == "tx-1")
        #expect(result.name == "Updated")
    }

    // MARK: - Form Validation Logic

    @Test
    func canSubmit_validInputs_returnsTrue() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: 50,
            isLoading: false
        )

        #expect(result == true)
    }

    @Test
    func canSubmit_emptyName_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "",
            amount: 50,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_whitespaceOnlyName_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "   ",
            amount: 50,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_zeroAmount_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: 0,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_nilAmount_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: nil,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_negativeAmount_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: -10,
            isLoading: false
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_isLoading_returnsFalse() {
        let result = EditTransactionSheet.isFormValid(
            name: "Groceries",
            amount: 50,
            isLoading: true
        )

        #expect(result == false)
    }

    @Test
    func canSubmit_nameWithLeadingTrailingSpaces_returnsTrue() {
        let result = EditTransactionSheet.isFormValid(
            name: "  Groceries  ",
            amount: 50,
            isLoading: false
        )

        #expect(result == true)
    }

    // MARK: - Currency Edit Mode (PUL-99 v1)

    private static func makeTransaction(
        amount: Decimal = 100,
        originalAmount: Decimal? = nil,
        originalCurrency: SupportedCurrency? = nil,
        targetCurrency: SupportedCurrency? = nil,
        exchangeRate: Decimal? = nil
    ) -> Transaction {
        Transaction(
            id: "tx-1",
            budgetId: "budget-1",
            budgetLineId: nil,
            name: "Test",
            amount: amount,
            kind: .expense,
            transactionDate: TestDataFactory.fixedDate,
            category: nil,
            checkedAt: nil,
            createdAt: TestDataFactory.fixedDate,
            updatedAt: TestDataFactory.fixedDate,
            originalAmount: originalAmount,
            originalCurrency: originalCurrency,
            targetCurrency: targetCurrency,
            exchangeRate: exchangeRate
        )
    }

    @Test("Case 1: alternate currency — picker shown")
    func shouldShowAlternateCurrency_differentCurrencies_returnsTrue() {
        let tx = Self.makeTransaction(originalCurrency: .eur)

        #expect(EditTransactionSheet.shouldShowAlternateCurrency(for: tx, userCurrency: .chf) == true)
    }

    @Test("Case 2: same currency — picker hidden")
    func shouldShowAlternateCurrency_sameCurrency_returnsFalse() {
        let tx = Self.makeTransaction(originalCurrency: .eur)

        #expect(EditTransactionSheet.shouldShowAlternateCurrency(for: tx, userCurrency: .eur) == false)
    }

    @Test("Case 3: mono-currency — picker hidden")
    func shouldShowAlternateCurrency_nilOriginal_returnsFalse() {
        let tx = Self.makeTransaction(originalCurrency: nil)

        #expect(EditTransactionSheet.shouldShowAlternateCurrency(for: tx, userCurrency: .chf) == false)
    }

    @Test("Case 1: initialAmount uses originalAmount for alternate currency")
    func initialAmount_alternateCurrency_returnsOriginalAmount() {
        let tx = Self.makeTransaction(amount: 95, originalAmount: 100, originalCurrency: .eur)

        #expect(EditTransactionSheet.initialAmount(for: tx, userCurrency: .chf) == 100)
    }

    @Test("Case 3: initialAmount uses transaction.amount for mono-currency")
    func initialAmount_monoCurrency_returnsLineAmount() {
        let tx = Self.makeTransaction(amount: 42)

        #expect(EditTransactionSheet.initialAmount(for: tx, userCurrency: .chf) == 42)
    }

    @Test("Case 5: mono-currency submit omits all currency metadata")
    func buildUpdate_monoCurrency_omitsCurrencyFields() {
        let update = EditTransactionSheet.buildUpdate(
            name: "Groceries",
            amount: 50,
            kind: .expense,
            transactionDate: TestDataFactory.fixedDate,
            conversion: nil
        )

        #expect(update.amount == 50)
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

        let update = EditTransactionSheet.buildUpdate(
            name: "EU import",
            amount: 100,
            kind: .expense,
            transactionDate: TestDataFactory.fixedDate,
            conversion: conversion
        )

        #expect(update.amount == 95)
        #expect(update.originalAmount == 100)
        #expect(update.originalCurrency == .eur)
        #expect(update.targetCurrency == .chf)
        #expect(update.exchangeRate == Decimal(0.95))
    }

    @Test("Case 7: pure helper — repeated calls with stable inputs are deterministic")
    func shouldShowAlternateCurrency_isPure() {
        let tx = Self.makeTransaction(originalCurrency: .eur)

        let first = EditTransactionSheet.shouldShowAlternateCurrency(for: tx, userCurrency: .chf)
        let second = EditTransactionSheet.shouldShowAlternateCurrency(for: tx, userCurrency: .chf)

        #expect(first == true)
        #expect(first == second)
    }
}
