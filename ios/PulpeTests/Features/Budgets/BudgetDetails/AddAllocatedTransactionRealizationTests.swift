import Foundation
@testable import Pulpe
import Testing

/// Realizing an announced withdrawal (PUL-329 v2): the forecast is copied into a
/// real allocated income — the only movement that debits the goal — and the row
/// says so instead of offering to point.
struct AddAllocatedTransactionRealizationTests {
    private func announcedLine(
        amount: Decimal = 500,
        goalId: String? = "goal-1",
        goalName: String? = "Fonds d'urgence"
    ) -> BudgetLine {
        BudgetLine(
            id: "line-1",
            budgetId: "budget-1",
            templateLineId: nil,
            savingsGoalId: nil,
            name: "Apport cuisine",
            amount: amount,
            kind: .income,
            recurrence: .oneOff,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: TestDataFactory.fixedDate,
            updatedAt: TestDataFactory.fixedDate,
            sourceSavingsGoalId: goalId,
            sourceSavingsGoalName: goalName
        )
    }

    /// What the projector's per-line index holds once `allocated` real incomes
    /// have landed on the forecast.
    private func consumption(allocated: Decimal, planned: Decimal = 500)
        -> BudgetFormulas.Consumption {
        BudgetFormulas.calculateConsumption(
            for: announcedLine(amount: planned),
            transactions: [TestDataFactory.createTransaction(
                budgetId: "budget-1",
                budgetLineId: "line-1",
                amount: allocated,
                kind: .income
            )]
        )
    }

    @Test("An ordinary forecast prefills nothing")
    func prefill_absentOnAnOrdinaryLine() {
        let prefill = AddAllocatedTransactionLogic.realizationPrefill(
            for: TestDataFactory.createBudgetLine(kind: .income),
            consumption: consumption(allocated: 0)
        )

        #expect(prefill == nil)
    }

    /// The goal is gone: the server has nothing left to debit, so the line stops
    /// presenting itself as realizable even though its provenance still reads.
    @Test("A broken source stops offering a realization")
    func prefill_absentOnABrokenSource() {
        let line = announcedLine(goalId: nil)

        #expect(line.savingsGoalSource == .broken(name: "Fonds d'urgence"))
        #expect(AddAllocatedTransactionLogic.realizationPrefill(
            for: line,
            consumption: consumption(allocated: 0)
        ) == nil)
    }

    /// `retrait restant = annoncé − Σ réels alloués` — the announcement itself
    /// takes nothing out, so a partial realization leaves the rest suggested.
    @Test("Copies the name and suggests what is left to take out")
    func prefill_suggestsTheRemainder() throws {
        let prefill = try #require(AddAllocatedTransactionLogic.realizationPrefill(
            for: announcedLine(),
            consumption: consumption(allocated: 200)
        ))

        #expect(prefill.name == "Apport cuisine")
        #expect(prefill.remainingAmount == 300)
        #expect(prefill.goalSource == .active(goalId: "goal-1", name: "Fonds d'urgence"))
    }

    @Test("A covered forecast offers no further realization")
    func prefill_isAbsentOnceCovered() {
        let exactly = AddAllocatedTransactionLogic.realizationPrefill(
            for: announcedLine(),
            consumption: consumption(allocated: 500)
        )
        let beyond = AddAllocatedTransactionLogic.realizationPrefill(
            for: announcedLine(),
            consumption: consumption(allocated: 620)
        )

        #expect(exactly == nil)
        #expect(beyond == nil)
    }

    // MARK: - Dedicated realization action

    @Test("The text action names the first realization, then its balance")
    func action_namesTheIntention() throws {
        let line = announcedLine()

        let first = try #require(BudgetLineMixedRow.realizationLabel(for: line, realizedAmount: 0))
        let partial = try #require(BudgetLineMixedRow.realizationLabel(for: line, realizedAmount: 200))

        #expect(first == "Réaliser ce retrait")
        #expect(partial == "Réaliser le solde")
        #expect(BudgetLineMixedRow.realizationLabel(for: line, realizedAmount: 500) == nil)
    }

    /// Every other line keeps the ordinary pointing circle — including a line whose
    /// goal was deleted, which the server would refuse to debit.
    @Test("Only an announced withdrawal replaces the pointing circle")
    func affordance_absentOnEveryOtherLine() {
        let ordinary = TestDataFactory.createBudgetLine(kind: .income)
        let broken = announcedLine(goalId: nil)

        #expect(BudgetLineMixedRow.realizationLabel(for: ordinary, realizedAmount: 0) == nil)
        #expect(BudgetLineMixedRow.realizationLabel(for: broken, realizedAmount: 0) == nil)
    }

    @Test("A realization payload is pointé from its first write")
    func payload_isChecked() {
        let payload = AddAllocatedTransactionLogic.buildCreate(
            for: announcedLine(),
            input: .init(
                name: "Apport cuisine",
                amount: 500,
                transactionDate: TestDataFactory.fixedDate,
                isChecked: true,
                conversion: nil,
                tagIds: nil
            )
        )

        #expect(payload.checkedAt != nil)
    }

    @Test("The row states where the announced money comes from")
    func metadata_namesTheSource() {
        let active = BudgetLineMixedRow.metadataText(
            isSpread: false,
            savingsGoalName: nil,
            isSavingsWithdrawalIncome: false,
            savingsGoalSource: .active(goalId: "goal-1", name: "Fonds d'urgence")
        )
        let deleted = BudgetLineMixedRow.metadataText(
            isSpread: false,
            savingsGoalName: nil,
            isSavingsWithdrawalIncome: false,
            savingsGoalSource: .broken(name: "Fonds d'urgence")
        )

        #expect(active == "Pris sur · Fonds d'urgence")
        #expect(deleted == "Objectif supprimé · Fonds d'urgence")
    }
}
