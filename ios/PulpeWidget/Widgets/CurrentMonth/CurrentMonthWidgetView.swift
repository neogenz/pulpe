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
        .containerBackground(.background, for: .widget)
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
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text("Disponible")
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textSecondary)

            Text(entry.available.asCompactCurrency(entry.currency))
                .font(PulpeTypography.amountXL)
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundStyle(entry.available >= 0 ? Color.pulpePrimary : Color.financialOverBudget)
                .privacySensitive()

            Text(entry.monthName)
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textTertiary)

            Spacer()

            Link(destination: DeepLinks.addExpense) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: DesignTokens.IconSize.badge))
                    .foregroundStyle(Color.pulpePrimary)
            }
            .accessibilityLabel("Ajouter une dépense")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Budget \(entry.monthName)")
        .accessibilityValue("\(entry.available.asCurrency(entry.currency)) disponible")
    }

    private var mediumWidgetView: some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Disponible à dépenser")
                    .font(PulpeTypography.detailLabel)
                    .foregroundStyle(Color.textSecondary)

                Text(entry.available.asCompactCurrency(entry.currency))
                    .font(PulpeTypography.amountLarge)
                    .monospacedDigit()
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .foregroundStyle(entry.available >= 0 ? Color.pulpePrimary : Color.financialOverBudget)
                    .privacySensitive()

                Text(entry.monthName)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Budget \(entry.monthName)")
            .accessibilityValue("\(entry.available.asCurrency(entry.currency)) disponible à dépenser")

            Spacer()

            Link(destination: DeepLinks.addExpense) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: DesignTokens.IconSize.widgetAction))
                    .foregroundStyle(Color.pulpePrimary)
            }
            .accessibilityLabel("Ajouter une dépense")
        }
        .padding(DesignTokens.Spacing.lg)
    }

    private var emptyView: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "calendar.badge.plus")
                .font(PulpeTypography.sectionIcon)
                .foregroundStyle(Color.textSecondary)

            Text("Ouvrez l'app")
                .font(PulpeTypography.detailLabel)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
