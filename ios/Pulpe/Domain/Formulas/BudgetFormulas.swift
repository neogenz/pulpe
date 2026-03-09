import Foundation

/// Budget calculation formulas - Single Source of Truth
/// Port of shared/src/calculators/budget-formulas.ts
enum BudgetFormulas {
    /// DA section 3.1: threshold separating "comfortable" from "tight"
    static let tightBudgetThreshold: Double = 80

    // MARK: - Display Budget Lines

    /// Budget lines augmented with a virtual rollover line when rollover != 0.
    /// Shared by CurrentMonthStore and BudgetDetailsViewModel.
    static func displayBudgetLines(base: [BudgetLine], budget: Budget?) -> [BudgetLine] {
        guard let budget, let rollover = budget.rollover, rollover != 0 else { return base }
        let rolloverLine = BudgetLine.rolloverLine(
            amount: rollover,
            budgetId: budget.id,
            sourceBudgetId: budget.previousBudgetId
        )
        return [rolloverLine] + base
    }

    // MARK: - Metrics Result

    struct Metrics: Equatable, Sendable {
        let totalIncome: Decimal
        let totalExpenses: Decimal
        let totalSavings: Decimal
        let available: Decimal
        let endingBalance: Decimal
        let remaining: Decimal
        let rollover: Decimal

        /// Percentage of budget used (0-100+)
        var usagePercentage: Double {
            guard available > 0 else { return 0 }
            let used = totalExpenses
            return Double(truncating: (used / available * 100) as NSDecimalNumber)
        }

        /// Whether the budget is in deficit
        var isDeficit: Bool {
            remaining < 0
        }

        /// DA §3.1: 3-state emotion zone — comfortable (<80%), tight (80-100%), deficit (>100%)
        var emotionState: EmotionState {
            BudgetFormulas.emotionState(
                remaining: remaining,
                totalIncome: totalIncome,
                totalExpenses: totalExpenses,
                rollover: rollover
            )
        }
    }

    /// Budget emotion states for UI tinting (hero card, background zones)
    enum EmotionState: Equatable, Sendable {
        case comfortable, tight, deficit
    }

    /// SOT: Compute emotion state from raw values.
    /// Used by both `Metrics.emotionState` and budget list hero card.
    static func emotionState(
        remaining: Decimal?,
        totalIncome: Decimal?,
        totalExpenses: Decimal?,
        rollover: Decimal?
    ) -> EmotionState {
        guard let remaining else { return .comfortable }
        if remaining < 0 { return .deficit }
        let available = (totalIncome ?? 0) + (rollover ?? 0)
        guard available > 0 else { return .comfortable }
        let usagePercentage = Double(truncating: ((totalExpenses ?? 0) / available * 100) as NSDecimalNumber)
        if usagePercentage >= tightBudgetThreshold { return .tight }
        return .comfortable
    }

    // MARK: - Realized Metrics

    struct RealizedMetrics: Equatable, Sendable {
        let realizedIncome: Decimal
        let realizedExpenses: Decimal
        let realizedBalance: Decimal
        let checkedItemsCount: Int
        let totalItemsCount: Int
        let checkedSavingsAmount: Decimal

        var completionPercentage: Double {
            guard totalItemsCount > 0 else { return 0 }
            return Double(checkedItemsCount) / Double(totalItemsCount) * 100
        }
    }

    // MARK: - Income Calculations

    /// Calculate total income using envelope logic
    /// Allocated transactions are covered by their envelope: max(line.amount, consumed)
    /// Free transactions (no budgetLineId) are added separately
    static func calculateTotalIncome(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let transactionsByLineId = Dictionary(
            grouping: transactions.filter { $0.kind == .income },
            by: { $0.budgetLineId ?? "" }
        )

        var total: Decimal = 0

        for line in budgetLines {
            guard line.kind == .income, !(line.isRollover ?? false) else { continue }
            let consumed = transactionsByLineId[line.id]?
                .reduce(Decimal.zero) { $0 + $1.amount } ?? 0
            total += max(line.amount, consumed)
        }

        let freeTransactions = transactionsByLineId[""]?
            .reduce(Decimal.zero) { $0 + $1.amount } ?? 0

        return total + freeTransactions
    }

    // MARK: - Expense Calculations

    /// Calculate total expenses (expenses + savings) using envelope logic
    /// Allocated transactions are covered by their envelope: max(line.amount, consumed)
    /// Free transactions (no budgetLineId) are added separately
    /// Note: Savings are treated as expenses per SPECS
    static func calculateTotalExpenses(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let transactionsByLineId = Dictionary(
            grouping: transactions.filter { $0.kind.isOutflow },
            by: { $0.budgetLineId ?? "" }
        )

        var total: Decimal = 0

        for line in budgetLines {
            guard line.kind.isOutflow, !(line.isRollover ?? false) else { continue }
            let consumed = transactionsByLineId[line.id]?
                .reduce(Decimal.zero) { $0 + $1.amount } ?? 0
            total += max(line.amount, consumed)
        }

        let freeTransactions = transactionsByLineId[""]?
            .reduce(Decimal.zero) { $0 + $1.amount } ?? 0

        return total + freeTransactions
    }

    // MARK: - Savings Calculations

    /// Calculate total savings using envelope logic
    /// Allocated transactions are covered by their envelope: max(line.amount, consumed)
    /// Free transactions (no budgetLineId) are added separately
    static func calculateTotalSavings(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let transactionsByLineId = Dictionary(
            grouping: transactions.filter { $0.kind == .saving },
            by: { $0.budgetLineId ?? "" }
        )

        var total: Decimal = 0

        for line in budgetLines {
            guard line.kind == .saving, !(line.isRollover ?? false) else { continue }
            let consumed = transactionsByLineId[line.id]?
                .reduce(Decimal.zero) { $0 + $1.amount } ?? 0
            total += max(line.amount, consumed)
        }

        let freeTransactions = transactionsByLineId[""]?
            .reduce(Decimal.zero) { $0 + $1.amount } ?? 0

        return total + freeTransactions
    }

    // MARK: - Realized Calculations (checked items only)

    /// Calculate realized income (only checked items)
    static func calculateRealizedIncome(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let checkedBudgetIncome = budgetLines
            .filter { $0.isChecked && $0.kind == .income }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let checkedTransactionIncome = transactions
            .filter { $0.isChecked && $0.kind == .income }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return checkedBudgetIncome + checkedTransactionIncome
    }

    /// Calculate realized expenses using envelope logic
    /// - Checked parent: max(envelope, consumed by checked transactions)
    /// - Unchecked parent: sum of checked allocated transactions
    /// - Free transactions: counted directly when checked
    /// - Performance: O(n+m) instead of O(n×m) using Dictionary-based indexing
    static func calculateRealizedExpenses(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        // Pre-index transactions by budgetLineId for O(1) lookups - O(m)
        // Only keep checked outflow transactions for this calculation
        let transactionsByLineId = Dictionary(
            grouping: transactions.filter { $0.isChecked && $0.kind.isOutflow },
            by: { $0.budgetLineId ?? "" }
        )

        var total: Decimal = 0

        // Calculate envelope totals - O(n) with O(1) lookups
        for line in budgetLines {
            guard line.kind.isOutflow else { continue }

            let consumed = transactionsByLineId[line.id]?
                .reduce(Decimal.zero) { $0 + $1.amount } ?? 0

            if line.isChecked {
                total += max(line.amount, consumed)
            } else {
                total += consumed
            }
        }

        // Free transactions (no parent envelope) - already filtered in index
        let freeTransactions = transactionsByLineId[""]?
            .reduce(Decimal.zero) { $0 + $1.amount } ?? 0

        return total + freeTransactions
    }

    /// Calculate realized balance (checked income - checked expenses)
    static func calculateRealizedBalance(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let realizedIncome = calculateRealizedIncome(budgetLines: budgetLines, transactions: transactions)
        let realizedExpenses = calculateRealizedExpenses(budgetLines: budgetLines, transactions: transactions)
        return realizedIncome - realizedExpenses
    }

    // MARK: - Core Formulas

    /// Calculate available amount
    /// Formula: available = totalIncome + rollover
    static func calculateAvailable(totalIncome: Decimal, rollover: Decimal) -> Decimal {
        totalIncome + rollover
    }

    /// Calculate ending balance
    /// Formula: endingBalance = available - totalExpenses
    static func calculateEndingBalance(available: Decimal, totalExpenses: Decimal) -> Decimal {
        available - totalExpenses
    }

    /// Calculate remaining (same as ending balance per SPECS)
    /// Formula: remaining = available - totalExpenses
    static func calculateRemaining(available: Decimal, totalExpenses: Decimal) -> Decimal {
        calculateEndingBalance(available: available, totalExpenses: totalExpenses)
    }

    // MARK: - Consumption Tracking

    struct Consumption: Equatable, Sendable {
        let allocated: Decimal
        let available: Decimal
        let percentage: Double

        var isOverBudget: Bool { percentage > 100 }
        var isNearLimit: Bool { percentage >= BudgetFormulas.tightBudgetThreshold && percentage <= 100 }
    }

    /// Calculate consumption for a budget line based on allocated transactions
    static func calculateConsumption(
        for budgetLine: BudgetLine,
        transactions: [Transaction]
    ) -> Consumption {
        let allocated = transactions
            .filter { $0.budgetLineId == budgetLine.id }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let available = budgetLine.amount - allocated
        let percentage = budgetLine.amount > 0
            ? Double(truncating: (allocated / budgetLine.amount * 100) as NSDecimalNumber)
            : 0

        return Consumption(
            allocated: allocated,
            available: available,
            percentage: percentage
        )
    }

    // MARK: - Forward Projection

    struct Projection: Equatable, Sendable {
        let projectedEndOfMonthBalance: Decimal
        let dailySpendingRate: Decimal
        let daysElapsed: Int
        let daysRemaining: Int
        let isOnTrack: Bool

        /// Trend direction relative to budget
        var trend: Trend {
            if isOnTrack { return .onTrack }
            return projectedEndOfMonthBalance < 0 ? .deficit : .surplus
        }

        enum Trend {
            case onTrack, deficit, surplus
        }
    }

    /// Calculate forward-looking projection based on current spending rate
    /// "À ce rythme, tu termineras le mois avec X CHF de disponible"
    static func calculateProjection(
        realizedExpenses: Decimal,
        totalBudgetedExpenses: Decimal,
        available: Decimal,
        month: Int,
        year: Int,
        referenceDate: Date = Date()
    ) -> Projection? {
        let calendar = Calendar.current

        // Create date for the budget month
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1
        guard let monthStart = calendar.date(from: components),
              let monthEnd = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart)
        else { return nil }

        let totalDaysInMonth = calendar.component(.day, from: monthEnd)
        let currentDay = calendar.component(.day, from: referenceDate)
        let currentMonth = calendar.component(.month, from: referenceDate)
        let currentYear = calendar.component(.year, from: referenceDate)

        // Only calculate projection for current or future months
        guard year > currentYear || (year == currentYear && month >= currentMonth) else {
            return nil
        }

        // For the current month, use actual days elapsed
        let daysElapsed: Int
        if month == currentMonth && year == currentYear {
            daysElapsed = max(1, currentDay) // At least 1 day to avoid division by zero
        } else {
            // For future months, no projection needed (no spending yet)
            return nil
        }

        let daysRemaining = totalDaysInMonth - daysElapsed

        // Calculate daily spending rate based on realized expenses
        let dailySpendingRate = realizedExpenses / Decimal(daysElapsed)

        // Project total expenses to end of month
        let projectedTotalExpenses = dailySpendingRate * Decimal(totalDaysInMonth)

        // Calculate projected end-of-month balance
        let projectedEndOfMonthBalance = available - projectedTotalExpenses

        // Determine if on track (projected balance >= planned remaining)
        let plannedRemaining = available - totalBudgetedExpenses
        let isOnTrack = projectedEndOfMonthBalance >= plannedRemaining

        return Projection(
            projectedEndOfMonthBalance: projectedEndOfMonthBalance,
            dailySpendingRate: dailySpendingRate,
            daysElapsed: daysElapsed,
            daysRemaining: daysRemaining,
            isOnTrack: isOnTrack
        )
    }

    // MARK: - Template Totals

    struct TemplateTotals: Equatable, Sendable {
        let totalIncome: Decimal
        let totalExpenses: Decimal
        let balance: Decimal
    }

    /// Calculate totals for a template
    static func calculateTemplateTotals(lines: [TemplateLine]) -> TemplateTotals {
        let income = lines
            .filter { $0.kind == .income }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let expenses = lines
            .filter { $0.kind.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return TemplateTotals(
            totalIncome: income,
            totalExpenses: expenses,
            balance: income - expenses
        )
    }
}
