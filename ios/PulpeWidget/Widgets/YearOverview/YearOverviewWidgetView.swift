import SwiftUI
import WidgetKit

struct YearOverviewWidgetView: View {
    var entry: YearOverviewEntry

    private static let columns = Array(repeating: GridItem(.flexible(), spacing: DesignTokens.Spacing.sm), count: 4)

    private var currentMonth: MonthData? {
        entry.months.first { $0.isCurrentMonth }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text(String(entry.year))
                    .font(PulpeTypography.sectionTitle)
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                Text("Disponible par mois")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textSecondary)
            }

            LazyVGrid(columns: Self.columns, spacing: DesignTokens.Spacing.sm) {
                ForEach(entry.months) { month in
                    if month.hasBudget {
                        Link(destination: DeepLinks.budget(id: month.id)) {
                            monthCell(month)
                        }
                    } else {
                        monthCell(month)
                    }
                }
            }

            if let month = currentMonth {
                currentMonthSummary(month)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .containerBackground(.background, for: .widget)
    }

    // MARK: - Current Month Summary

    @ViewBuilder
    private func currentMonthSummary(_ month: MonthData) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(AppLocale.string("Disponible en \(Formatters.monthNameInText(for: month.month))"))
                    .font(PulpeTypography.detailLabel)
                    .foregroundStyle(Color.textSecondary)

                if let available = month.available {
                    entry.currency.widgetFigure(
                        available, font: PulpeTypography.amountLarge, isOverBudget: available < 0
                    )
                        .monospacedDigit()
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                        .privacySensitive()
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Disponible \(month.shortName)")
            .accessibilityValue(month.available.map { "\($0.asCurrency(entry.currency))" } ?? "Pas de données")

            Spacer()

            WidgetAddLink()
        }
        .padding(.top, DesignTokens.Spacing.sm)
    }

    // MARK: - Month Cell

    @ViewBuilder
    private func monthCell(_ month: MonthData) -> some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(month.shortName)
                .font(PulpeTypography.metricMini)
                .foregroundStyle(month.isCurrentMonth ? Color.textPrimary : Color.textSecondary)

            if let available = month.available {
                Text(verbatim: available.asAmount(for: entry.currency))
                    .font(PulpeTypography.metricMini)
                    .fontWeight(month.isCurrentMonth ? .bold : .regular)
                    .foregroundStyle(amountColor(for: available))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .privacySensitive()
            } else if month.isFuture {
                Text("à créer")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
            } else {
                Text("—")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm)
                .fill(month.isCurrentMonth
                      ? Color.surfaceContainerHighest
                      : Color.clear)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(month.shortName)
        .accessibilityValue(
            month.available.map { $0.asCompactCurrency(entry.currency) }
                ?? AppLocale.string("Pas de données")
        )
        .accessibilityAddTraits(month.isCurrentMonth ? .isSelected : [])
    }

    // MARK: - Helpers

    private func amountColor(for amount: Decimal) -> Color {
        amount < 0 ? .financialOverBudget : .textPrimary
    }
}
