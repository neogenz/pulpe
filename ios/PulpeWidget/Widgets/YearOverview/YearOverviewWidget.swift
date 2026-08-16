import SwiftUI
import WidgetKit

struct YearOverviewWidget: Widget {
    let kind = "YearOverviewWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: YearOverviewProvider()) { entry in
            YearOverviewWidgetView(entry: entry)
                .environment(\.locale, AppLocale.currentUILocale)
        }
        .configurationDisplayName("Vue annuelle")
        .description("Affiche les 12 mois de l'année")
        .supportedFamilies([.systemLarge])
    }
}

#Preview("Large", as: .systemLarge) {
    YearOverviewWidget()
} timeline: {
    YearOverviewEntry.preview
}
