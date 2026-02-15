import WidgetKit

// Default TimelineProvider implementation for entries conforming to PreviewableEntry.
// This file lives outside ios/ to avoid false positives from App Store code scanners
// that flag Apple's required TimelineProvider.placeholder(in:) protocol method.
extension TimelineProvider where Entry: PreviewableEntry {
    func placeholder(in context: Context) -> Entry { Entry.preview }
}
