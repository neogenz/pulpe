import SwiftUI
import WidgetKit

struct YearOverviewWidgetView: View {
    var entry: YearOverviewEntry

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\(String(entry.year))")
                .font(.headline)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(entry.months) { month in
                    monthCell(month)
                }
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
        .widgetURL(URL(string: "pulpe://budget"))
    }

    @ViewBuilder
    private func monthCell(_ month: MonthData) -> some View {
        VStack(spacing: 2) {
            Text(month.shortName)
                .font(.caption2)
                .foregroundStyle(month.isCurrentMonth ? .primary : .secondary)

            if let available = month.available {
                Text(available.asCompactCHF)
                    .font(.caption)
                    .fontWeight(month.isCurrentMonth ? .semibold : .regular)
                    .foregroundColor(available >= 0 ? Color.primary : Color.red)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            } else {
                Text("—")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(month.isCurrentMonth ? Color.accentColor.opacity(0.15) : Color.clear)
        )
    }
}
