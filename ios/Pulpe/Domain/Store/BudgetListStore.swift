import Foundation
import OSLog

@Observable
final class BudgetListStore: StoreProtocol {
    // MARK: - State (accessed from main thread)

    @MainActor private(set) var budgets: [BudgetSparse] = []
    @MainActor private(set) var isLoading = false
    @MainActor private(set) var error: Error?

    // MARK: - Cache Metadata

    private var lastLoadTime: Date?
    private static let cacheValidityDuration: TimeInterval = 30 // 30 seconds (short for multi-device sync)

    // MARK: - Services

    private let budgetService: BudgetService
    private let widgetSyncService: WidgetDataSyncService

    // MARK: - Initialization

    init(
        budgetService: BudgetService = .shared,
        widgetSyncService: WidgetDataSyncService = .shared
    ) {
        self.budgetService = budgetService
        self.widgetSyncService = widgetSyncService
    }

    // MARK: - Smart Loading (StoreProtocol)

    func loadIfNeeded() async {
        // Skip if data is fresh (within 30s)
        if let lastLoad = lastLoadTime,
           Date().timeIntervalSince(lastLoad) < Self.cacheValidityDuration {
            return
        }
        await forceRefresh()
    }

    func forceRefresh() async {
        await MainActor.run {
            isLoading = true
            error = nil
        }
        defer { Task { @MainActor in isLoading = false } }

        do {
            let fetchedBudgets = try await budgetService.getBudgetsSparse(fields: "month,year,remaining")
            await MainActor.run {
                budgets = fetchedBudgets
            }
            lastLoadTime = Date()

            // Sync widget data after refresh
            await syncWidgetData()
        } catch {
            await MainActor.run {
                self.error = error
            }
        }
    }

    // MARK: - Widget Sync

    private func syncWidgetData() async {
        // Use centralized sync for consistency
        await widgetSyncService.syncAll()
    }

    // MARK: - Computed Properties

    struct YearGroup {
        let year: Int
        let budgets: [BudgetSparse]
    }

    @MainActor
    var groupedByYear: [YearGroup] {
        let grouped = Dictionary(grouping: budgets) { $0.year ?? 0 }
        return grouped
            .sorted { $0.key < $1.key } // Oldest first, newest last
            .map { year, budgets in
                YearGroup(year: year, budgets: budgets.sorted { ($0.month ?? 0) < ($1.month ?? 0) })
            }
    }

    @MainActor
    var nextAvailableMonth: (month: Int, year: Int)? {
        let calendar = Calendar.current
        let now = Date()
        let maxYearsAhead = AppConfiguration.maxBudgetYearsAhead

        for monthOffset in 0..<(maxYearsAhead * 12) {
            guard let date = calendar.date(byAdding: .month, value: monthOffset, to: now) else {
                continue
            }
            let month = calendar.component(.month, from: date)
            let year = calendar.component(.year, from: date)

            let exists = budgets.contains { $0.month == month && $0.year == year }
            if !exists {
                return (month, year)
            }
        }
        return nil
    }

    // MARK: - Mutations

    @MainActor
    func addBudget(_ budget: Budget) {
        budgets.append(BudgetSparse(from: budget))
        lastLoadTime = nil
    }
}
