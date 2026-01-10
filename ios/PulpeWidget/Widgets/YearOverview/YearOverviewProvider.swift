import Foundation
import WidgetKit

struct YearOverviewProvider: TimelineProvider {
    typealias Entry = YearOverviewEntry

    private let coordinator = WidgetDataCoordinator()

    func placeholder(in context: Context) -> YearOverviewEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (YearOverviewEntry) -> Void) {
        let entry = loadEntry() ?? .placeholder
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<YearOverviewEntry>) -> Void) {
        let entry = loadEntry() ?? .empty
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadEntry() -> YearOverviewEntry? {
        guard let cache = coordinator.load() else {
            return nil
        }

        let currentMonth = Calendar.current.component(.month, from: Date())

        let months = cache.yearBudgets.map { budget in
            MonthData(
                id: budget.id,
                month: budget.month,
                shortName: budget.shortMonthName,
                available: budget.available,
                isCurrentMonth: budget.month == currentMonth
            )
        }

        guard !months.isEmpty else { return nil }

        return YearOverviewEntry(
            date: cache.lastUpdated,
            year: cache.yearBudgets.first?.year ?? Calendar.current.component(.year, from: Date()),
            months: months,
            hasData: true
        )
    }
}
