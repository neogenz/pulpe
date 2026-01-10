import SwiftUI
import WidgetKit

struct CurrentMonthWidgetView: View {
    var entry: CurrentMonthEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        Group {
            if entry.hasData {
                contentView
            } else {
                emptyView
            }
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }

    @ViewBuilder
    private var contentView: some View {
        switch family {
        case .systemSmall:
            smallWidgetView
        case .systemMedium:
            mediumWidgetView
        default:
            smallWidgetView
        }
    }

    private var smallWidgetView: some View {
        VStack(spacing: 8) {
            Text("Disponible")
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(entry.available.asCHF)
                .font(.title2)
                .fontWeight(.semibold)
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            Text(entry.monthName)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "pulpe://add-expense"))
    }

    private var mediumWidgetView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Disponible à dépenser")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(entry.available.asCHF)
                    .font(.title)
                    .fontWeight(.semibold)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)

                Text(entry.monthName)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            Link(destination: URL(string: "pulpe://add-expense")!) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(.tint)
            }
        }
        .padding()
    }

    private var emptyView: some View {
        VStack(spacing: 8) {
            Image(systemName: "calendar.badge.plus")
                .font(.title)
                .foregroundStyle(.secondary)

            Text("Ouvrez l'app")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
