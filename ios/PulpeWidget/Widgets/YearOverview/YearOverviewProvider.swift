import Foundation
import WidgetKit

struct YearOverviewProvider: TimelineProvider {
    typealias Entry = YearOverviewEntry

    private let coordinator = WidgetDataCoordinator()

    func getSnapshot(in context: Context, completion: @escaping (YearOverviewEntry) -> Void) {
        if context.isPreview {
            completion(.preview)
            return
        }
        completion(loadEntry() ?? .preview)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<YearOverviewEntry>) -> Void) {
        let entry = loadEntry() ?? .empty
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    func relevance(of entry: YearOverviewEntry) -> TimelineEntryRelevance? {
        guard entry.hasData else { return nil }
        let currentMonthAvailable = entry.months.first { $0.isCurrentMonth }?.available
        guard let available = currentMonthAvailable else { return nil }
        return available < 0
            ? TimelineEntryRelevance(score: 1.0)
            : TimelineEntryRelevance(score: 0.5)
    }

    private func loadEntry() -> YearOverviewEntry? {
        guard let cache = coordinator.load() else { return nil }

        let now = Date()
        let currentMonth = Calendar.current.component(.month, from: now)
        let currentYear = Calendar.current.component(.year, from: now)

        let months = cache.yearBudgets.map { budget in
            MonthData(
                id: budget.id,
                month: budget.month,
                shortName: budget.shortMonthName,
                available: budget.available,
                isCurrentMonth: budget.month == currentMonth && budget.year == currentYear
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
