import Foundation
import WidgetKit

struct CurrentMonthProvider: TimelineProvider {
    typealias Entry = CurrentMonthEntry

    private let coordinator = WidgetDataCoordinator()

    func placeholder(in context: Context) -> CurrentMonthEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (CurrentMonthEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        completion(loadEntry() ?? .placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CurrentMonthEntry>) -> Void) {
        let entry = loadEntry() ?? .empty
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadEntry() -> CurrentMonthEntry? {
        guard let cache = coordinator.load(),
              let currentMonth = cache.currentMonth else {
            return nil
        }

        return CurrentMonthEntry(
            date: cache.lastUpdated,
            available: currentMonth.available ?? 0,
            monthName: currentMonth.monthName,
            budgetId: currentMonth.id,
            hasData: true
        )
    }
}
