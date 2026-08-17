import SwiftUI
import WidgetKit

struct CurrentMonthWidget: Widget {
    let kind = "CurrentMonthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CurrentMonthProvider()) { entry in
            CurrentMonthWidgetView(entry: entry)
                // The widget runs in its own process, with no store and no network of its
                // own: the language comes from the app-group snapshot the app writes.
                .environment(\.locale, AppLocale.currentUILocale)
        }
        .configurationDisplayName("Budget du mois")
        .description("Affiche le montant disponible à dépenser")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryRectangular,
            .accessoryCircular,
            .accessoryInline,
        ])
    }
}

#Preview("Small", as: .systemSmall) {
    CurrentMonthWidget()
} timeline: {
    CurrentMonthEntry.preview
}

#Preview("Medium", as: .systemMedium) {
    CurrentMonthWidget()
} timeline: {
    CurrentMonthEntry.preview
}

#Preview("Rectangular", as: .accessoryRectangular) {
    CurrentMonthWidget()
} timeline: {
    CurrentMonthEntry.preview
}

#Preview("Circular", as: .accessoryCircular) {
    CurrentMonthWidget()
} timeline: {
    CurrentMonthEntry.preview
}

#Preview("Inline", as: .accessoryInline) {
    CurrentMonthWidget()
} timeline: {
    CurrentMonthEntry.preview
}
