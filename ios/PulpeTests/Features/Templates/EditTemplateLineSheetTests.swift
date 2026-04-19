import Foundation
@testable import Pulpe
import Testing

@Suite("EditTemplateLineSheet Tests")
@MainActor
struct EditTemplateLineSheetTests {
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
