import Foundation
import Testing
@testable import Pulpe

struct BudgetLineTests {

    // MARK: - Check Status

    @Test func isChecked_whenCheckedAtIsNil_returnsFalse() {
        let line = TestDataFactory.createBudgetLine(isChecked: false)
        let result = line.isChecked
        #expect(!result)
    }

    @Test func isChecked_whenCheckedAtHasValue_returnsTrue() {
        let line = TestDataFactory.createBudgetLine(isChecked: true)
        let result = line.isChecked
        #expect(result)
    }

    // MARK: - Toggle Behavior

    @Test func toggled_whenUnchecked_setsCheckedAt() {
        let line = TestDataFactory.createBudgetLine(isChecked: false)
        let toggled = line.toggled()
        #expect(toggled.isChecked)
        #expect(toggled.checkedAt != nil)
    }

    @Test func toggled_whenChecked_clearsCheckedAt() {
        let line = TestDataFactory.createBudgetLine(isChecked: true)
        let toggled = line.toggled()
        #expect(!toggled.isChecked)
        #expect(toggled.checkedAt == nil)
    }

    @Test func toggled_preservesAllOtherFields() {
        let original = BudgetLine(
            id: "test-id",
            budgetId: "budget-123",
            templateLineId: "template-456",
            savingsGoalId: "goal-789",
            name: "Test Line",
            amount: 1500,
            kind: .expense,
            recurrence: .fixed,
            isManuallyAdjusted: true,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date(),
            isRollover: false,
            rolloverSourceBudgetId: nil
        )
        let toggled = original.toggled()
        #expect(toggled.id == original.id)
        #expect(toggled.budgetId == original.budgetId)
        #expect(toggled.templateLineId == original.templateLineId)
        #expect(toggled.savingsGoalId == original.savingsGoalId)
        #expect(toggled.name == original.name)
        #expect(toggled.amount == original.amount)
        #expect(toggled.kind == original.kind)
        #expect(toggled.recurrence == original.recurrence)
        #expect(toggled.isManuallyAdjusted == original.isManuallyAdjusted)
        #expect(toggled.isRollover == original.isRollover)
    }

    @Test func toggled_canBeToggledMultipleTimes() {
        let line = TestDataFactory.createBudgetLine(isChecked: false)
        let toggled1 = line.toggled()
        let toggled2 = toggled1.toggled()
        let toggled3 = toggled2.toggled()
        #expect(toggled1.isChecked)
        #expect(!toggled2.isChecked)
        #expect(toggled3.isChecked)
    }

    // MARK: - Template Association

    @Test func isFromTemplate_whenTemplateLineIdExists_returnsTrue() {
        let line = BudgetLine(
            id: "test-id",
            budgetId: "budget-123",
            templateLineId: "template-456",
            savingsGoalId: nil,
            name: "Test",
            amount: 100,
            kind: .expense,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        let result = line.isFromTemplate
        #expect(result)
    }

    @Test func isFromTemplate_whenTemplateLineIdIsNil_returnsFalse() {
        let line = BudgetLine(
            id: "test-id",
            budgetId: "budget-123",
            templateLineId: nil,
            savingsGoalId: nil,
            name: "Test",
            amount: 100,
            kind: .expense,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
        let result = line.isFromTemplate
        #expect(!result)
    }

    // MARK: - Rollover Handling

    @Test func isVirtualRollover_whenIsRolloverTrue_returnsTrue() {
        let line = TestDataFactory.createBudgetLine(isRollover: true)
        let result = line.isVirtualRollover
        #expect(result)
    }

    @Test func isVirtualRollover_whenIsRolloverFalse_returnsFalse() {
        let line = TestDataFactory.createBudgetLine(isRollover: false)
        let result = line.isVirtualRollover
        #expect(!result)
    }

    @Test func rolloverLine_createsCorrectVirtualLine() {
        let amount: Decimal = 500
        let budgetId = "budget-123"
        let sourceBudgetId = "budget-122"
        let rollover = BudgetLine.rolloverLine(
            amount: amount,
            budgetId: budgetId,
            sourceBudgetId: sourceBudgetId
        )
        #expect(rollover.amount == 500)
        #expect(rollover.budgetId == budgetId)
        #expect(rollover.rolloverSourceBudgetId == sourceBudgetId)
        #expect(rollover.isVirtualRollover)
        #expect(rollover.isChecked)
        #expect(rollover.kind == .income)
    }

    @Test func rolloverLine_withNegativeAmount_createsExpense() {
        let amount: Decimal = -300
        let rollover = BudgetLine.rolloverLine(
            amount: amount,
            budgetId: "budget-123",
            sourceBudgetId: nil
        )
        #expect(rollover.amount == -300)
        #expect(rollover.kind == .expense)
    }

    @Test func rolloverLine_hasExpectedName() {
        let rollover = BudgetLine.rolloverLine(
            amount: 100,
            budgetId: "budget-123",
            sourceBudgetId: nil
        )
        #expect(rollover.name == "Report du mois précédent")
    }

    // MARK: - Kind Categorization

    @Test func kind_income_isNotOutflow() {
        let line = TestDataFactory.createBudgetLine(kind: .income)
        #expect(line.kind == .income)
        #expect(!line.kind.isOutflow)
    }

    @Test func kind_expense_isOutflow() {
        let line = TestDataFactory.createBudgetLine(kind: .expense)
        #expect(line.kind == .expense)
        #expect(line.kind.isOutflow)
    }

    @Test func kind_saving_isOutflow() {
        let line = TestDataFactory.createBudgetLine(kind: .saving)
        #expect(line.kind == .saving)
        #expect(line.kind.isOutflow)
    }

    // MARK: - Recurrence Types

    @Test func recurrence_fixed_representsRecurring() {
        let line = TestDataFactory.createBudgetLine(recurrence: .fixed)
        #expect(line.recurrence == .fixed)
    }

    @Test func recurrence_oneOff_representsNonRecurring() {
        let line = TestDataFactory.createBudgetLine(recurrence: .oneOff)
        #expect(line.recurrence == .oneOff)
    }

    // MARK: - Equality and Hashing

    @Test func equality_sameBudgetLines_areEqual() {
        let line1 = TestDataFactory.createBudgetLine(id: "test-1")
        let line2 = TestDataFactory.createBudgetLine(id: "test-1")
        #expect(line1 == line2)
    }

    @Test func equality_differentIDs_areNotEqual() {
        let line1 = TestDataFactory.createBudgetLine(id: "test-1")
        let line2 = TestDataFactory.createBudgetLine(id: "test-2")
        #expect(line1 != line2)
    }

    @Test func hashable_canBeUsedInSet() {
        let line1 = TestDataFactory.createBudgetLine(id: "test-1")
        let line2 = TestDataFactory.createBudgetLine(id: "test-2")
        let line3 = TestDataFactory.createBudgetLine(id: "test-1")
        let lineSet: Set<BudgetLine> = [line1, line2, line3]
        #expect(lineSet.count == 2)
    }

    // MARK: - Amount Validation

    @Test func amount_canBePositive() {
        let line = TestDataFactory.createBudgetLine(amount: 1500)
        #expect(line.amount == 1500)
    }

    @Test func amount_canBeZero() {
        let line = TestDataFactory.createBudgetLine(amount: 0)
        #expect(line.amount == 0)
    }

    @Test func amount_usesDecimalForPrecision() {
        let line = TestDataFactory.createBudgetLine(amount: Decimal(string: "1234.56")!)
        #expect(line.amount == Decimal(string: "1234.56")!)
    }
}
