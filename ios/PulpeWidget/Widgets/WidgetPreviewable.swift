import WidgetKit

protocol PreviewableEntry: TimelineEntry {
    static var preview: Self { get }
}

// MARK: - Conformances

extension CurrentMonthEntry: PreviewableEntry {}
extension YearOverviewEntry: PreviewableEntry {}
