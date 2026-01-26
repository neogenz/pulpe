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
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1

        if let date = Calendar.current.date(from: components) {
            return Formatters.monthYear.string(from: date).capitalized
        }
        return "\(month)/\(year)"
    }

    var shortMonthYear: String {
        var components = DateComponents()
        components.month = month
        components.year = year
        components.day = 1

        if let date = Calendar.current.date(from: components) {
            return Formatters.shortMonthYear.string(from: date).capitalized
        }
        return "\(month)/\(year)"
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
/// Used for dashboard to avoid fetching full budget details
struct BudgetSparse: Decodable, Identifiable, Sendable {
    let id: String
    let month: Int?
    let year: Int?
    let totalExpenses: Decimal?
    let totalSavings: Decimal?
    let totalIncome: Decimal?
    let remaining: Decimal?
    let rollover: Decimal?
}

struct BudgetSparseListResponse: Decodable {
    let success: Bool
    let data: [BudgetSparse]
}
