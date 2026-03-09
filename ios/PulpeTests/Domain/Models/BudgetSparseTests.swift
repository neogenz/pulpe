import Foundation
@testable import Pulpe
import Testing

@Suite("BudgetSparse monthlyBalance")
struct BudgetSparseTests {
    @Test("positive monthly balance subtracts rollover")
    func positiveMonthlyBalance() {
        let budget = BudgetSparse(id: "test-1", remaining: 1000, rollover: 200)
        #expect(budget.monthlyBalance == 800)
    }

    @Test("negative monthly balance when rollover exceeds remaining")
    func negativeMonthlyBalance() {
        let budget = BudgetSparse(id: "test-1", remaining: -100, rollover: 500)
        #expect(budget.monthlyBalance == -600)
    }

    @Test("nil remaining returns nil")
    func nilRemaining() {
        let budget = BudgetSparse(id: "test-1", remaining: nil, rollover: 200)
        #expect(budget.monthlyBalance == nil)
    }

    @Test("nil rollover defaults to zero")
    func nilRolloverDefaultsToZero() {
        let budget = BudgetSparse(id: "test-1", remaining: 500, rollover: nil)
        #expect(budget.monthlyBalance == 500)
    }

    @Test("zero rollover returns remaining unchanged")
    func zeroRollover() {
        let budget = BudgetSparse(id: "test-1", remaining: 500, rollover: 0)
        #expect(budget.monthlyBalance == 500)
    }

    @Test("negative rollover adds back to remaining")
    func negativeRollover() {
        let budget = BudgetSparse(id: "test-1", remaining: 500, rollover: -200)
        #expect(budget.monthlyBalance == 700)
    }

    @Test("both nil remaining and nil rollover returns nil")
    func bothNil() {
        let budget = BudgetSparse(id: "test-1", remaining: nil, rollover: nil)
        #expect(budget.monthlyBalance == nil)
    }
}
