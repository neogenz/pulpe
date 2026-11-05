import SwiftUI

/// Budget month hero (V2 `Budget-mois`): a white card on the light page.
///
/// What is left to spend, to the cent (Two-Decimals rule), the report it already includes,
/// then where the month's money goes: one split bar (Dépenses / Épargne / Disponible) and its
/// three-column legend. « Le calcul » opens the detail of the figure.
struct BudgetDetailHero: View {
    let metrics: BudgetFormulas.Metrics
    var rolloverAmount: Decimal?
    var onRolloverTap: (() -> Void)?
    var onTapCalculation: () -> Void = {}
    /// The previous month, when this one has not started: the figure is a projection and
    /// its report an estimate.
    var projectedReportMonth: Int?

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var tapTrigger = false

    private var currency: SupportedCurrency { userSettingsStore.currency }

    /// Gate on the value rounded to the 2-decimal display precision, not `!= 0`: a
    /// sub-cent residual rollover would otherwise render "0.00".
    private var roundedRollover: Decimal? {
        guard let rolloverAmount, rolloverAmount.rounded(2) != 0 else { return nil }
        return rolloverAmount.rounded(2)
    }

    /// The three parts of the split, in bar order. Savings are counted inside
    /// `totalExpenses`, so the expense part is what is left of it once they are taken out.
    private struct SplitPart {
        let label: String
        let amount: Decimal
        let color: Color
    }

    private var parts: [SplitPart] {
        [
            SplitPart(
                label: AppLocale.string("Dépenses"),
                amount: metrics.totalExpenses - metrics.totalSavings,
                color: .financialExpense
            ),
            SplitPart(label: AppLocale.string("Épargne"), amount: metrics.totalSavings, color: .financialSavings),
            SplitPart(label: AppLocale.string("Disponible"), amount: metrics.remaining, color: .textPrimary),
        ]
    }

    private var segments: [SegmentedBar.Segment] {
        let shares = parts.map { max($0.amount, 0) }
        let whole = shares.reduce(0, +)
        guard whole > 0 else { return [] }
        return zip(shares, parts).map { share, part in
            SegmentedBar.Segment(
                fraction: Double(truncating: (share / whole) as NSDecimalNumber),
                color: part.color
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                headerRow
                figure
                if let roundedRollover {
                    rolloverLine(amount: roundedRollover)
                }
            }

            SegmentedBar(segments: segments, trackColor: .sunk, height: DesignTokens.ProgressBar.thickHeight)

            legend
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        .animation(DesignTokens.Animation.smoothEaseInOut, value: metrics)
    }

    private var headerRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
            let eyebrow: LocalizedStringKey = projectedReportMonth == nil
                ? "Disponible à dépenser"
                : "Disponible à dépenser prévu"
            Text(eyebrow)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Button {
                tapTrigger.toggle()
                onTapCalculation()
            } label: {
                HStack(spacing: DesignTokens.Spacing.xxs) {
                    Text("Le calcul")
                    Image(systemName: "chevron.right").font(PulpeTypography.metricLabel)
                }
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.pulpePrimary)
                // 44pt hit area without growing the row (swiftui-hit-areas.md).
                .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
                .contentShape(Rectangle())
                .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
            }
            .textLinkButtonStyle()
            .sensoryFeedback(.impact(flexibility: .soft), trigger: tapTrigger)
            .accessibilityHint("Ouvrir le détail du calcul")
            .accessibilityIdentifier("budgetCalculationLink")
        }
    }

    private var figure: some View {
        (Text(verbatim: metrics.remaining.asAmount(for: currency))
            .font(PulpeTypography.heroAmount)
            .tracking(DesignTokens.Tracking.hero)
            + Text(verbatim: " \(currency.symbol)")
            .font(PulpeTypography.heroCurrencySuffix)
            .foregroundStyle(Color.textTertiary))
            .monospacedDigit()
            .minimumScaleFactor(DesignTokens.TextScale.floor)
            .lineLimit(1)
            // Ocre only when the month is over its plan.
            .foregroundStyle(metrics.remaining < 0 ? Color.financialOverBudget : Color.textPrimary)
            .contentTransition(.numericText())
            .sensitiveAmount()
            .accessibilityIdentifier("budgetDetailHeroAmount")
    }

    @ViewBuilder
    private func rolloverLine(amount: Decimal) -> some View {
        let label = Text(projectedReportMonth.map {
            AppLocale.string(
                "Avec le report de \(Formatters.monthNameInText(for: $0)), estimé à \(amount.asAmount(for: currency))"
            )
        } ?? AppLocale.string("Report de \(amount.asAmount(for: currency)) inclus"))
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.textSecondary)
            .monospacedDigit()
            .sensitiveAmount()
        if let onRolloverTap {
            Button(action: onRolloverTap) { label }
                // 44pt hit area without growing the stack (swiftui-hit-areas.md).
                .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
                .contentShape(Rectangle())
                .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
                .plainPressedButtonStyle()
                .accessibilityAction(named: "Voir le budget précédent", onRolloverTap)
        } else {
            label
        }
    }

    private var legend: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            ForEach(parts, id: \.label) { part in
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Circle()
                            .fill(part.color)
                            .frame(
                                width: DesignTokens.ChipMetrics.stateDotSize,
                                height: DesignTokens.ChipMetrics.stateDotSize
                            )
                            .accessibilityHidden(true)
                        Text(part.label)
                            .font(PulpeTypography.captionRegular)
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(1)
                    }
                    Text(verbatim: part.amount.asAmount(for: currency))
                        .font(PulpeTypography.rowAmount)
                        .foregroundStyle(Color.textPrimary)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(DesignTokens.TextScale.compact)
                        .sensitiveAmount()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
            }
        }
    }
}
