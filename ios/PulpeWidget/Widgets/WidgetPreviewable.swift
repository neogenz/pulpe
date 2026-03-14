import WidgetKit

protocol PreviewableEntry: TimelineEntry {
    static var preview: Self { get }
}

// MARK: - Default TimelineProvider Implementation

extension TimelineProvider where Entry: PreviewableEntry {
    func placeholder(in context: Context) -> Entry { Entry.preview }
}

// MARK: - Conformances

extension CurrentMonthEntry: PreviewableEntry {}
extension YearOverviewEntry: PreviewableEntry {}
