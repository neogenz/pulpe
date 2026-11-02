import SwiftUI

/// The next months' end balances as bars around zero. The headline names where the balance
/// turns; a tap on a month reads its figure above the bars.
struct ForecastSection: View {
    let forecasts: [MonthlyForecast]
    let currency: SupportedCurrency
    @State private var selectedID: String?

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Les prochains mois"))

            if forecasts.count >= 2, let outlook = ForecastOutlook(forecasts),
               let lowest = forecasts.min(by: { $0.availableBalance < $1.availableBalance }) {
                card(outlook: outlook, lowest: lowest)
            } else {
                Text("Crée des budgets futurs pour voir la tendance")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .pulpeCard()
            }
        }
    }

    private func card(outlook: ForecastOutlook, lowest: MonthlyForecast) -> some View {
        let selected = forecasts.first { $0.id == selectedID } ?? forecasts[0]
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            headline(outlook)
                .font(PulpeTypography.cardTitle)
            Text("Mois le plus serré : \(lowest.monthName), \(amount(lowest))")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .sensitiveAmount()

            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                Text(amount(selected))
                    .font(PulpeTypography.amountXL)
                    .foregroundStyle(tint(selected))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .sensitiveAmount()
                Text("fin \(selected.monthName)")
                if selected.id == lowest.id {
                    Text(verbatim: "·")
                    Text("le plus serré")
                }
            }
            .font(PulpeTypography.caption)
            .foregroundStyle(Color.textSecondary)
            .padding(.top, DesignTokens.Spacing.md)

            bars(selected: selected)
                .padding(.top, DesignTokens.Spacing.md)
                .sensitiveAmount()

            Text("Solde prévu en fin de mois, d'après tes budgets. Touche un mois pour le voir.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
                .padding(.top, DesignTokens.Spacing.sm)
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.md)
    }

    private func headline(_ outlook: ForecastOutlook) -> Text {
        switch outlook {
        case .staysPositive(let last): Text("Tout reste au vert jusqu'en \(last.monthName)")
        case .tightens(let month): Text("Ça se resserre en \(month.monthName)")
        case .recovers(let month): Text("Retour au vert en \(month.monthName)")
        case .staysNegative(let last): Text("Sous zéro jusqu'en \(last.monthName)")
        }
    }

    private func bars(selected: MonthlyForecast) -> some View {
        let balances = forecasts.map(\.availableBalance)
        let maxPositive = max(balances.max() ?? 0, 0)
        let maxNegative = max(-(balances.min() ?? 0), 0)
        let minBar = DesignTokens.Chart.forecastBarMinHeight
        let scale = DesignTokens.Chart.forecastPlotHeight / max(maxPositive + maxNegative, 1)
        let positiveRegion = balances.contains { $0 >= 0 } ? max(maxPositive * scale, minBar) : 0
        let negativeRegion = balances.contains { $0 < 0 } ? max(maxNegative * scale, minBar) : 0

        // Columns touch so each one's zero line joins its neighbours'. The value label rides the
        // bar tip; the empty side keeps an invisible one so every column puts zero at one height.
        return HStack(alignment: .top, spacing: DesignTokens.Spacing.none) {
            ForEach(forecasts) { month in
                let isSelected = month.id == selected.id
                let height = max(abs(month.availableBalance) * scale, minBar)
                let isPositive = month.availableBalance >= 0
                Button { selectedID = month.id } label: {
                    VStack(spacing: DesignTokens.Spacing.none) {
                        if positiveRegion > 0 {
                            VStack(spacing: DesignTokens.Spacing.xxs) {
                                valueLabel(month, isSelected: isSelected).opacity(isPositive ? 1 : 0)
                                bar(height: isPositive ? height : 0, month: month, isSelected: isSelected)
                            }
                            .padding(.top, positiveRegion - (isPositive ? height : 0))
                        }
                        Rectangle()
                            .fill(Color.outlineVariant)
                            .frame(height: DesignTokens.FrameHeight.separator)
                        if negativeRegion > 0 {
                            VStack(spacing: DesignTokens.Spacing.xxs) {
                                bar(height: isPositive ? 0 : height, month: month, isSelected: isSelected)
                                valueLabel(month, isSelected: isSelected).opacity(isPositive ? 0 : 1)
                            }
                            .padding(.bottom, negativeRegion - (isPositive ? 0 : height))
                        }
                        monthLabel(month, isSelected: isSelected)
                    }
                    .frame(maxWidth: .infinity)
                }
                .contentShape(Rectangle())
                .plainPressedButtonStyle()
                .accessibilityLabel(Text(verbatim: "\(month.monthName), \(amount(month))"))
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .animation(DesignTokens.Animation.smoothEaseInOut, value: selectedID)
        .sensoryFeedback(.selection, trigger: selectedID)
    }

    private func monthLabel(_ month: MonthlyForecast, isSelected: Bool) -> some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(month.shortMonthName)
                .font(PulpeTypography.caption)
                .fontWeight(isSelected ? .bold : .regular)
                .foregroundStyle(isSelected ? Color.textPrimary : Color.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .fixedSize(horizontal: false, vertical: true)
            Circle()
                .fill(isSelected ? Color.textPrimary : .clear)
                .frame(width: DesignTokens.ChipMetrics.stateDotSize, height: DesignTokens.ChipMetrics.stateDotSize)
        }
        .padding(.top, DesignTokens.Spacing.sm)
    }

    private func valueLabel(_ month: MonthlyForecast, isSelected: Bool) -> some View {
        Text(Decimal(month.availableBalance).asCompactAmount(for: currency))
            .font(PulpeTypography.caption2)
            .fontWeight(isSelected ? .bold : .medium)
            .foregroundStyle(isSelected ? Color.textPrimary : Color.textSecondary)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(DesignTokens.TextScale.compact)
            // Scaling may narrow a label, never shorten it: a shorter one would lift its column's
            // zero line off its neighbours'.
            .fixedSize(horizontal: false, vertical: true)
    }

    private func bar(height: CGFloat, month: MonthlyForecast, isSelected: Bool) -> some View {
        Rectangle()
            .fill(tint(month).opacity(isSelected ? 1 : DesignTokens.Opacity.chartUnselected))
            .frame(width: DesignTokens.Chart.forecastBarWidth, height: height)
            .clipShape(.rect(cornerRadius: DesignTokens.Chart.forecastBarWidth / 2))
    }

    private func tint(_ month: MonthlyForecast) -> Color {
        month.availableBalance < 0 ? .financialOverBudget : .financialSavings
    }

    private func amount(_ month: MonthlyForecast) -> String {
        Decimal(month.availableBalance).asAdaptiveCurrency(currency)
    }
}
