import Foundation

/// Budget calculation formulas - Single Source of Truth
/// Port of shared/src/calculators/budget-formulas.ts
enum BudgetFormulas {

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
    }

    // MARK: - Realized Metrics

    struct RealizedMetrics: Equatable, Sendable {
        let realizedIncome: Decimal
        let realizedExpenses: Decimal
        let realizedBalance: Decimal
        let checkedItemsCount: Int
        let totalItemsCount: Int

        var completionPercentage: Double {
            guard totalItemsCount > 0 else { return 0 }
            return Double(checkedItemsCount) / Double(totalItemsCount) * 100
        }
    }

    // MARK: - Income Calculations

    /// Calculate total income from budget lines and transactions
    /// Formula: Σ(items WHERE kind = 'income')
    static func calculateTotalIncome(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let budgetIncome = budgetLines
            .filter { $0.kind == .income && !($0.isRollover ?? false) }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let transactionIncome = transactions
            .filter { $0.kind == .income }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return budgetIncome + transactionIncome
    }

    // MARK: - Expense Calculations

    /// Calculate total expenses (expenses + savings) from budget lines and transactions
    /// Formula: Σ(items WHERE kind IN ('expense', 'saving'))
    /// Note: Savings are treated as expenses per SPECS
    static func calculateTotalExpenses(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let budgetExpenses = budgetLines
            .filter { $0.kind.isOutflow && !($0.isRollover ?? false) }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let transactionExpenses = transactions
            .filter { $0.kind.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return budgetExpenses + transactionExpenses
    }

    // MARK: - Savings Calculations

    /// Calculate total savings from budget lines and transactions
    /// Formula: Σ(items WHERE kind = 'saving')
    static func calculateTotalSavings(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let budgetSavings = budgetLines
            .filter { $0.kind == .saving && !($0.isRollover ?? false) }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let transactionSavings = transactions
            .filter { $0.kind == .saving }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return budgetSavings + transactionSavings
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
            guard line.isRollover != true else { continue }

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

    // MARK: - All Metrics

    /// Calculate all metrics at once (single-pass optimization)
    /// Performance: O(n+m) with 2 iterations instead of 10
    static func calculateAllMetrics(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = [],
        rollover: Decimal = 0
    ) -> Metrics {
        // Single pass over budget lines
        var budgetIncome: Decimal = 0
        var budgetExpenses: Decimal = 0
        var budgetSavings: Decimal = 0
        
        for line in budgetLines {
            guard !(line.isRollover ?? false) else { continue }
            switch line.kind {
            case .income:
                budgetIncome += line.amount
            case .expense:
                budgetExpenses += line.amount
            case .saving:
                budgetSavings += line.amount
                budgetExpenses += line.amount // Savings count as expenses per SPECS
            }
        }
        
        // Single pass over transactions
        var transactionIncome: Decimal = 0
        var transactionExpenses: Decimal = 0
        var transactionSavings: Decimal = 0
        
        for tx in transactions {
            switch tx.kind {
            case .income:
                transactionIncome += tx.amount
            case .expense:
                transactionExpenses += tx.amount
            case .saving:
                transactionSavings += tx.amount
                transactionExpenses += tx.amount // Savings count as expenses per SPECS
            }
        }
        
        let totalIncome = budgetIncome + transactionIncome
        let totalExpenses = budgetExpenses + transactionExpenses
        let totalSavings = budgetSavings + transactionSavings
        let available = totalIncome + rollover
        let endingBalance = available - totalExpenses

        return Metrics(
            totalIncome: totalIncome,
            totalExpenses: totalExpenses,
            totalSavings: totalSavings,
            available: available,
            endingBalance: endingBalance,
            remaining: endingBalance, // Same as ending balance per SPECS
            rollover: rollover
        )
    }

    /// Calculate realized metrics
    static func calculateRealizedMetrics(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> RealizedMetrics {
        let realizedIncome = calculateRealizedIncome(budgetLines: budgetLines, transactions: transactions)
        let realizedExpenses = calculateRealizedExpenses(budgetLines: budgetLines, transactions: transactions)
        let realizedBalance = realizedIncome - realizedExpenses

        let checkedCount = budgetLines.filter { $0.isChecked }.count + transactions.filter { $0.isChecked }.count
        let totalCount = budgetLines.count + transactions.count

        return RealizedMetrics(
            realizedIncome: realizedIncome,
            realizedExpenses: realizedExpenses,
            realizedBalance: realizedBalance,
            checkedItemsCount: checkedCount,
            totalItemsCount: totalCount
        )
    }

    // MARK: - Consumption Tracking

    struct Consumption: Equatable, Sendable {
        let allocated: Decimal
        let available: Decimal
        let percentage: Double

        var isOverBudget: Bool { percentage > 100 }
        var isNearLimit: Bool { percentage >= 80 && percentage <= 100 }
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
