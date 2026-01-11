import SwiftUI
import WidgetKit

struct YearOverviewWidgetView: View {
    var entry: YearOverviewEntry

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    private var currentMonth: MonthData? {
        entry.months.first { $0.isCurrentMonth }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\(String(entry.year))")
                .font(.headline)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(entry.months) { month in
                    if month.hasBudget {
                        Link(destination: URL(string: "pulpe://budget?id=\(month.id)")!) {
                            monthCell(month)
                        }
                    } else {
                        monthCell(month)
                    }
                }
            }

            if let month = currentMonth {
                Divider()

                currentMonthSummary(month)
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }

    @ViewBuilder
    private func currentMonthSummary(_ month: MonthData) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Disponible \(month.shortName.lowercased())")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let available = month.available {
                    Text(available.asCHF)
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(available >= 0 ? .primary : .red)
                        .privacySensitive()
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Disponible \(month.shortName)")
            .accessibilityValue(month.available.map { "\($0.asCHF)" } ?? "Pas de données")

            Spacer()

            Link(destination: URL(string: "pulpe://add-expense")!) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(.tint)
            }
            .accessibilityLabel("Ajouter une dépense")
        }
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
                    .privacySensitive()
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel(month.shortName)
        .accessibilityValue(month.available.map { "\($0.asCompactCHF)" } ?? "Pas de données")
        .accessibilityAddTraits(month.isCurrentMonth ? .isSelected : [])
    }
}
