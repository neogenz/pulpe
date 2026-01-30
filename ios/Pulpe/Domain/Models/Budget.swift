import Foundation

/// Monthly budget instance created from a template
struct Budget: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let month: Int
    let year: Int
    let description: String
    let userId: String?
    let templateId: String
    let endingBalance: Decimal?
    let rollover: Decimal?
    let remaining: Decimal?
    let previousBudgetId: String?
    let createdAt: Date
    let updatedAt: Date

    // MARK: - Computed Properties

    var monthYear: String {
        formatted(with: Formatters.monthYear)
    }

    var shortMonthYear: String {
        formatted(with: Formatters.shortMonthYear)
    }

    private func formatted(with formatter: DateFormatter) -> String {
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1

        guard let date = Calendar.current.date(from: components) else {
            return "\(month)/\(year)"
        }
        return formatter.string(from: date).capitalized
    }

    var isCurrentMonth: Bool {
        let now = Date()
        let calendar = Calendar.current
        return month == calendar.component(.month, from: now) &&
               year == calendar.component(.year, from: now)
    }
}

// MARK: - Create/Update DTOs

struct BudgetCreate: Encodable {
    let month: Int
    let year: Int
    let description: String
    let templateId: String
}

struct BudgetUpdate: Encodable {
    var description: String?
    var month: Int?
    var year: Int?
}

// MARK: - Response Types

struct BudgetDetailsResponse: Decodable {
    let success: Bool
    let data: BudgetDetails
}

struct BudgetDetails: Decodable {
    let budget: Budget
    let transactions: [Transaction]
    let budgetLines: [BudgetLine]
}

struct BudgetExportResponse: Decodable {
    let success: Bool
    let data: BudgetExportData
}

struct BudgetExportData: Decodable {
    let exportDate: String
    let totalBudgets: Int
    let budgets: [BudgetWithDetails]
}

struct BudgetWithDetails: Decodable {
    let id: String
    let month: Int
    let year: Int
    let description: String
    let templateId: String
    let endingBalance: Decimal?
    let rollover: Decimal
    let remaining: Decimal
    let previousBudgetId: String?
    let transactions: [Transaction]
    let budgetLines: [BudgetLine]
    let createdAt: Date
    let updatedAt: Date
}

// MARK: - Sparse Fieldsets (Dashboard optimized)

/// Sparse budget response with only requested aggregates
/// Used for dashboard and lists to avoid fetching full budget details
struct BudgetSparse: Decodable, Identifiable, Sendable, Hashable {
    let id: String
    let month: Int?
    let year: Int?
    let totalExpenses: Decimal?
    let totalSavings: Decimal?
    let totalIncome: Decimal?
    let remaining: Decimal?
    let rollover: Decimal?

    var isCurrentMonth: Bool {
        let now = Date()
        let calendar = Calendar.current
        return month == calendar.component(.month, from: now) &&
               year == calendar.component(.year, from: now)
    }

    init(from budget: Budget) {
        self.id = budget.id
        self.month = budget.month
        self.year = budget.year
        self.totalExpenses = nil
        self.totalSavings = nil
        self.totalIncome = nil
        self.remaining = budget.remaining ?? 0
        self.rollover = budget.rollover
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        month = try container.decodeIfPresent(Int.self, forKey: .month)
        year = try container.decodeIfPresent(Int.self, forKey: .year)
        totalExpenses = try container.decodeIfPresent(Decimal.self, forKey: .totalExpenses)
        totalSavings = try container.decodeIfPresent(Decimal.self, forKey: .totalSavings)
        totalIncome = try container.decodeIfPresent(Decimal.self, forKey: .totalIncome)
        remaining = try container.decodeIfPresent(Decimal.self, forKey: .remaining)
        rollover = try container.decodeIfPresent(Decimal.self, forKey: .rollover)
    }

    private enum CodingKeys: String, CodingKey {
        case id, month, year, totalExpenses, totalSavings, totalIncome, remaining, rollover
    }
}

struct BudgetSparseListResponse: Decodable {
    let success: Bool
    let data: [BudgetSparse]
}
