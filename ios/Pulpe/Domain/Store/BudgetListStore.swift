import Foundation

@Observable @MainActor
final class BudgetListStore: StoreProtocol {
    // MARK: - State

    private(set) var budgets: [Budget] = []
    private(set) var isLoading = false
    private(set) var error: Error?

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
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            budgets = try await budgetService.getAllBudgets()
            lastLoadTime = Date()

            // Sync widget data after refresh
            await syncWidgetData()
        } catch {
            self.error = error
        }
    }

    // MARK: - Widget Sync

    private func syncWidgetData() async {
        do {
            let exportData = try await budgetService.exportAllBudgets()

            // Also get current budget details if it exists
            if let currentBudget = try? await budgetService.getCurrentMonthBudget() {
                let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
                await widgetSyncService.sync(
                    budgetsWithDetails: exportData.budgets,
                    currentBudgetDetails: details
                )
            } else {
                await widgetSyncService.sync(
                    budgetsWithDetails: exportData.budgets,
                    currentBudgetDetails: nil
                )
            }
        } catch {
            #if DEBUG
            print("BudgetListStore: syncWidgetData failed - \(error)")
            #endif
            await widgetSyncService.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: nil
            )
        }
    }

    // MARK: - Computed Properties

    struct YearGroup {
        let year: Int
        let budgets: [Budget]
    }

    var groupedByYear: [YearGroup] {
        let grouped = Dictionary(grouping: budgets) { $0.year }
        return grouped
            .sorted { $0.key < $1.key } // Oldest first, newest last
            .map { year, budgets in
                YearGroup(year: year, budgets: budgets.sorted { $0.month < $1.month })
            }
    }

    var nextAvailableMonth: (month: Int, year: Int)? {
        budgetService.getNextAvailableMonth(existingBudgets: budgets)
    }

    // MARK: - Mutations

    func addBudget(_ budget: Budget) async {
        budgets.append(budget)
        await syncWidgetData()
    }
}
