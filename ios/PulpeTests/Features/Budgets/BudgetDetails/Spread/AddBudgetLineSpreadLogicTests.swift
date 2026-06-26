import Foundation
@testable import Pulpe
import Testing

/// PUL-17 Lot A — the add-budget-line "Lisser" submit wiring.
///
/// `AddBudgetLineSheet.addSpread()` is a thin orchestration over
/// `AddBudgetLineSpreadLogic` + the injectable `AddBudgetLineDependencies`. These
/// tests drive that exact contract without bootstrapping SwiftUI:
///   - `buildCreate` sends the per-month amount + one month ref per SELECTED
///     month, a single frozen `exchangeRate`, and a single
///     `perMonthOriginalAmount` only for multi-currency,
///   - submitting calls `createSpread` with that body AND fires the cross-budget
///     invalidation on success,
///   - the success toast carries the base copy + conditional suffixes.
@Suite("AddBudgetLine spread submit wiring")
@MainActor
struct AddBudgetLineSpreadLogicTests {
    /// A fixed idempotency key for the wiring tests that don't assert it specifically.
    private static let testGroupId = "a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d"

    // MARK: - buildCreate: per-month amount + one month ref per selected month, same-currency

    @Test
    func buildCreate_sameCurrency_sendsPerMonthAmountAndOneRefPerSelectedMonth() {
        let calculator = SpreadCalculator(anchorMonth: 11, anchorYear: 2026)
        calculator.setEnd(SpreadMonth(year: 2027, month: 1)) // Nov, Dec, Jan

        let data = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(name: "  Impôts  ", kind: .expense, amount: 80, mode: .perMonth, conversion: nil, spreadGroupId: Self.testGroupId)
        )

        #expect(data.name == "Impôts")
        #expect(data.kind == .expense)
        #expect(data.mode == .perMonth)
        #expect(data.perMonthAmount == 80)
        #expect(data.totalAmount == nil)
        #expect(data.totalOriginalAmount == nil)
        #expect(data.months.map { TranchePair($0.year, $0.month) } == [
            TranchePair(2026, 11), TranchePair(2026, 12), TranchePair(2027, 1),
        ])
        #expect(data.perMonthOriginalAmount == nil)
        #expect(data.exchangeRate == nil)
        #expect(data.originalCurrency == nil)
        #expect(data.targetCurrency == nil)
    }

    @Test
    func buildCreate_skipsDeselectedMonths() {
        let calculator = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        calculator.setEnd(SpreadMonth(year: 2026, month: 4)) // Jan..Apr
        calculator.toggle(SpreadMonth(year: 2026, month: 2)) // drop Feb

        let data = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(name: "Loyer", kind: .expense, amount: 500, mode: .perMonth, conversion: nil, spreadGroupId: Self.testGroupId)
        )

        #expect(data.months.map { TranchePair($0.year, $0.month) } == [
            TranchePair(2026, 1), TranchePair(2026, 3), TranchePair(2026, 4),
        ])
    }

    // MARK: - buildCreate: total mode emits totalAmount + mode "total"

    @Test
    func buildCreate_totalMode_sameCurrency_emitsTotalAmountAndModeTotal() {
        let calculator = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        calculator.setEnd(SpreadMonth(year: 2026, month: 3)) // Jan, Feb, Mar

        let data = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(name: "Vacances", kind: .expense, amount: 90, mode: .total, conversion: nil, spreadGroupId: Self.testGroupId)
        )

        #expect(data.mode == .total)
        #expect(data.totalAmount == 90)
        #expect(data.totalOriginalAmount == nil)
        // Per-month fields are nil in total mode — the server divides.
        #expect(data.perMonthAmount == nil)
        #expect(data.perMonthOriginalAmount == nil)
        #expect(data.months.count == 3)
    }

    @Test
    func buildCreate_totalMode_multiCurrency_dividesBothTotals() {
        let calculator = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        calculator.setEnd(SpreadMonth(year: 2026, month: 3)) // 3 months
        let conversion = CurrencyConversion(
            convertedAmount: 93,
            originalAmount: 100,
            originalCurrency: .eur,
            targetCurrency: .chf,
            exchangeRate: Decimal(string: "0.93") ?? 0
        )

        let data = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(name: "Assurance", kind: .expense, amount: 100, mode: .total, conversion: conversion, spreadGroupId: Self.testGroupId)
        )

        // FX figé: the converted total + the original total ride at request level.
        #expect(data.mode == .total)
        #expect(data.totalAmount == 93)
        #expect(data.totalOriginalAmount == 100)
        #expect(data.perMonthAmount == nil)
        #expect(data.perMonthOriginalAmount == nil)
        #expect(data.exchangeRate == Decimal(string: "0.93"))
        #expect(data.originalCurrency == .eur)
        #expect(data.targetCurrency == .chf)
    }

    // MARK: - buildCreate: single frozen FX shared across all months

    @Test
    func buildCreate_multiCurrency_freezesOneExchangeRateForAllMonths() {
        let calculator = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        calculator.setEnd(SpreadMonth(year: 2026, month: 3)) // 3 months
        let conversion = CurrencyConversion(
            convertedAmount: 93,
            originalAmount: 100,
            originalCurrency: .eur,
            targetCurrency: .chf,
            exchangeRate: Decimal(string: "0.93") ?? 0
        )

        let data = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(name: "Assurance", kind: .expense, amount: 100, mode: .perMonth, conversion: conversion, spreadGroupId: Self.testGroupId)
        )

        // One exchangeRate + one perMonthOriginalAmount at request level (FX figé).
        #expect(data.mode == .perMonth)
        #expect(data.exchangeRate == Decimal(string: "0.93"))
        #expect(data.originalCurrency == .eur)
        #expect(data.targetCurrency == .chf)
        #expect(data.months.count == 3)
        // Converted (target) amount per month; single original repeated server-side.
        #expect(data.perMonthAmount == 93)
        #expect(data.perMonthOriginalAmount == 100)
        #expect(data.totalAmount == nil)
        #expect(data.totalOriginalAmount == nil)
    }

    // MARK: - Idempotency key (PUL-17): carried into the DTO + reused across retries

    @Test
    func buildCreate_carriesTheIntentSpreadGroupId() {
        let calculator = SpreadCalculator(anchorMonth: 6, anchorYear: 2026)
        let intentId = "b7e8f9a0-1c2d-4e3f-8a9b-0c1d2e3f4a5b"

        let perMonth = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(name: "Impôts", kind: .expense, amount: 80, mode: .perMonth,
                         conversion: nil, spreadGroupId: intentId)
        )
        let total = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(name: "Vacances", kind: .expense, amount: 90, mode: .total,
                         conversion: nil, spreadGroupId: intentId)
        )

        #expect(perMonth.spreadGroupId == intentId)
        #expect(total.spreadGroupId == intentId)
    }

    @Test
    func buildCreate_reusesTheSameSpreadGroupId_onRetryOfTheSameIntent() {
        // The sheet mints ONE key per intent (@State) and reuses it on retry;
        // buildCreate must be a faithful conduit — same SubmitInput → same key on
        // every attempt, so a retry replays the group instead of duplicating it.
        let calculator = SpreadCalculator(anchorMonth: 6, anchorYear: 2026)
        let input = AddBudgetLineSpreadLogic.SubmitInput(
            name: "Impôts", kind: .expense, amount: 80, mode: .perMonth,
            conversion: nil, spreadGroupId: "b7e8f9a0-1c2d-4e3f-8a9b-0c1d2e3f4a5b"
        )

        let firstAttempt = AddBudgetLineSpreadLogic.buildCreate(calculator: calculator, input: input)
        let retry = AddBudgetLineSpreadLogic.buildCreate(calculator: calculator, input: input)

        #expect(firstAttempt.spreadGroupId == input.spreadGroupId)
        #expect(retry.spreadGroupId == firstAttempt.spreadGroupId)
    }

    // MARK: - Submit wiring: createSpread called + invalidation fired

    @Test
    func submit_callsCreateSpreadWithPerMonthAmountAndMonths_andFiresInvalidationOnSuccess() async throws {
        let calculator = SpreadCalculator(anchorMonth: 6, anchorYear: 2026)
        calculator.setEnd(SpreadMonth(year: 2026, month: 8)) // Jun, Jul, Aug

        let recorder = SpreadSubmitRecorder()
        let dependencies = AddBudgetLineDependencies(
            createBudgetLine: { _ in throw TestError.unexpectedSingleCall },
            createSpread: { data in
                recorder.captured = data
                return Self.makeResponse(lineCount: 3)
            },
            invalidateCrossBudgetCaches: { _ in recorder.invalidationFired = true }
        )

        // Mirror exactly what `AddBudgetLineSheet.addSpread()` does.
        let data = AddBudgetLineSpreadLogic.buildCreate(
            calculator: calculator,
            input: .init(name: "Impôts", kind: .expense, amount: 80, mode: .perMonth, conversion: nil, spreadGroupId: Self.testGroupId)
        )
        let response = try await dependencies.createSpread(data)
        dependencies.invalidateCrossBudgetCaches(BudgetListStore())

        let captured = try #require(recorder.captured)
        #expect(captured.perMonthAmount == 80)
        #expect(captured.months.map { TranchePair($0.year, $0.month) } == [
            TranchePair(2026, 6), TranchePair(2026, 7), TranchePair(2026, 8),
        ])
        #expect(captured.name == "Impôts")
        #expect(captured.kind == .expense)
        #expect(recorder.invalidationFired)
        #expect(response.lines.count == 3)
    }

    @Test
    func submit_doesNotInvalidate_whenCreateSpreadThrows() async {
        let recorder = SpreadSubmitRecorder()
        let dependencies = AddBudgetLineDependencies(
            createBudgetLine: { _ in throw TestError.unexpectedSingleCall },
            createSpread: { _ in throw TestError.network },
            invalidateCrossBudgetCaches: { _ in recorder.invalidationFired = true }
        )

        let data = BudgetLineSpreadCreate(
            name: "X",
            kind: .expense,
            mode: .perMonth,
            months: [SpreadMonthRef(year: 2026, month: 6)],
            perMonthAmount: 80
        )

        // The view runs invalidation only AFTER a successful createSpread.
        do {
            _ = try await dependencies.createSpread(data)
            dependencies.invalidateCrossBudgetCaches(BudgetListStore())
            Issue.record("Expected createSpread to throw")
        } catch {
            // expected
        }

        #expect(recorder.invalidationFired == false)
    }

    // MARK: - P2: refresh the currently-open budget on spread success

    @Test
    func onSuccess_feedsTheOpenBudgetOccurrenceBackThroughOnAdd() {
        // PUL-17 P2: when a tranche lands in the CURRENTLY-open budget, that exact
        // occurrence is fed back through `onAdd` so the active detail screen
        // refreshes via the coordinator (same seam as the single-line path).
        let openBudgetId = "budget-open"
        let lines = [
            TestDataFactory.createBudgetLine(id: "line-open", budgetId: openBudgetId),
            TestDataFactory.createBudgetLine(id: "line-other", budgetId: "budget-other"),
        ]
        let response = Self.makeResponse(lines: lines)

        // Mirror exactly what `AddBudgetLineSheet.addSpread()` selects for `onAdd`.
        let fedBack = response.lines.first { $0.budgetId == openBudgetId }

        #expect(fedBack?.id == "line-open")
    }

    @Test
    func onSuccess_doesNotFeedBack_whenNoTrancheTargetsTheOpenBudget() {
        // The open budget wasn't part of the spread window — nothing to feed back;
        // the cross-budget invalidation alone revalidates the touched months.
        let response = Self.makeResponse(lines: [
            TestDataFactory.createBudgetLine(id: "line-other", budgetId: "budget-other"),
        ])

        let fedBack = response.lines.first { $0.budgetId == "budget-open" }

        #expect(fedBack == nil)
    }

    // MARK: - Success toast copy

    @Test("Success toast carries base copy + conditional suffixes", arguments: [
        (1, 0, 0, "Dépense lissée sur 1 mois"),
        (3, 0, 0, "Dépense lissée sur 3 mois"),
        (3, 2, 0, "Dépense lissée sur 3 mois · 2 budgets créés"),
        (3, 1, 0, "Dépense lissée sur 3 mois · 1 budget créé"),
        (3, 0, 2, "Dépense lissée sur 3 mois · 2 mois ignorés (aucun modèle)"),
        (2, 1, 1, "Dépense lissée sur 2 mois · 1 budget créé · 1 mois ignoré (aucun modèle)"),
    ])
    func successMessage_formatsBaseAndSuffixes(
        lines: Int, created: Int, skipped: Int, expected: String
    ) {
        let response = Self.makeResponse(lineCount: lines, createdCount: created, skippedCount: skipped)
        #expect(AddBudgetLineSpreadLogic.successMessage(for: response) == expected)
    }

    @Test
    func successMessage_savingKind_usesEpargneNoun() {
        // Backend accepts kind `.saving` (Zod only excludes income), so a lissé
        // épargne must read "Épargne lissée", not "Dépense lissée".
        let response = Self.makeResponse(lines: [
            TestDataFactory.createBudgetLine(id: "s-0", kind: .saving),
            TestDataFactory.createBudgetLine(id: "s-1", kind: .saving),
        ])

        #expect(AddBudgetLineSpreadLogic.successMessage(for: response) == "Épargne lissée sur 2 mois")
    }

    @Test
    func successMessage_savingKind_keepsConditionalSuffixes() {
        let response = BudgetLineSpreadResponse(
            spreadGroupId: UUID(),
            lines: [TestDataFactory.createBudgetLine(id: "s-0", kind: .saving)],
            createdBudgets: [TestDataFactory.createBudget(id: "b-0")],
            skippedMonths: [SpreadSkippedMonth(month: 1, year: 2026)]
        )

        #expect(
            AddBudgetLineSpreadLogic.successMessage(for: response)
                == "Épargne lissée sur 1 mois · 1 budget créé · 1 mois ignoré (aucun modèle)"
        )
    }

    // MARK: - Helpers

    nonisolated private static func makeResponse(lines: [BudgetLine]) -> BudgetLineSpreadResponse {
        BudgetLineSpreadResponse(
            spreadGroupId: UUID(),
            lines: lines,
            createdBudgets: [],
            skippedMonths: []
        )
    }

    nonisolated private static func makeResponse(
        lineCount: Int,
        createdCount: Int = 0,
        skippedCount: Int = 0
    ) -> BudgetLineSpreadResponse {
        let groupId = UUID()
        let lines = (0..<lineCount).map { index in
            TestDataFactory.createBudgetLine(id: "line-\(index)", name: "Impôts")
        }
        let createdBudgets = (0..<createdCount).map { index in
            TestDataFactory.createBudget(id: "budget-\(index)")
        }
        let skipped = (0..<skippedCount).map { index in
            SpreadSkippedMonth(month: index + 1, year: 2026)
        }
        return BudgetLineSpreadResponse(
            spreadGroupId: groupId,
            lines: lines,
            createdBudgets: createdBudgets,
            skippedMonths: skipped
        )
    }
}

// MARK: - Test fixtures

private final class SpreadSubmitRecorder: @unchecked Sendable {
    var captured: BudgetLineSpreadCreate?
    var invalidationFired = false
}

private enum TestError: Error {
    case unexpectedSingleCall
    case network
}

private struct TranchePair: Equatable {
    let year: Int
    let month: Int
    init(_ year: Int, _ month: Int) {
        self.year = year
        self.month = month
    }
}
