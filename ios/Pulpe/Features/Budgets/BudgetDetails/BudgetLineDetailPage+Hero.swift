import SwiftUI

// MARK: - Hero / Title

extension BudgetLineDetailPage {
    @ViewBuilder
    func heroSection(line: BudgetLine, transactions: [Transaction]) -> some View {
        // Projector pre-computes consumption for every line in source state
        // once per source change. Fall back to a zero consumption if a rare
        // race observes the line before the projector publishes — the page
        // re-renders one frame later with the real value.
        let consumption = projector.screenState.consumptionByLineId[line.id]
            ?? BudgetFormulas.Consumption(allocated: 0, available: line.amount, percentage: 0)
        let remaining = line.amount - consumption.allocated
        let clampedProgress = CGFloat(min(max(consumption.percentage / 100, 0), 1))
        let stateColor = stateColor(for: consumption, kind: line.kind)
        let currency = userSettingsStore.currency
        // 2-decimal formatters everywhere on the budget detail page per
        // `feedback_two_decimals_ios_budget_detail` (2026-05-08): the page
        // renders ligne-level amounts, so `asCompactCurrency` is proscribed.
        let remainingLabel = amountsHidden ? "Montant masqué" : remaining.asCurrency(currency)
        let spentLabel = amountsHidden ? "Montant masqué" : consumption.allocated.asCurrency(currency)
        let plannedLabel = amountsHidden ? "Montant masqué" : line.amount.asCurrency(currency)

        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Il reste")
                    .font(PulpeTypography.detailLabelBold)
                    .foregroundStyle(Color.textTertiary)
                    .textCase(.uppercase)
                    .tracking(DesignTokens.Tracking.uppercase)

                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                    Text(remaining.asAmount(for: currency))
                        .font(PulpeTypography.heroIcon)
                        .foregroundStyle(Color.textPrimary)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)

                    Text(currency.symbol)
                        .font(PulpeTypography.labelLargeBold)
                        .foregroundStyle(Color.textTertiary)
                }
                .sensitiveAmount()
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Il reste \(remainingLabel)")
            }

            progressRow(progress: clampedProgress, percentage: consumption.percentage, color: stateColor)

            Text("\(spentLabel) dépensés sur \(plannedLabel) prévu")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    /// 3-state color matching DA §3.1 — comfortable / tight / deficit.
    func stateColor(for consumption: BudgetFormulas.Consumption, kind: TransactionKind) -> Color {
        if consumption.isOverBudget { return .financialOverBudget }
        if consumption.isNearLimit { return .warningPrimary }
        return Color.financialColor(for: kind)
    }

    func progressRow(progress: CGFloat, percentage: Double, color: Color) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.progressTrack)

                ProgressBarShape(progress: progress)
                    .fill(color)
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)

            Text("\(Int(percentage.rounded()))%")
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(Int(percentage.rounded()))% utilisé")
    }

    func titleWithKindDot(line: BudgetLine) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Circle()
                .fill(Color.financialColor(for: line.kind))
                .frame(width: DesignTokens.Spacing.sm, height: DesignTokens.Spacing.sm)

            Text(line.name)
                .font(PulpeTypography.title3)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(2)
                .truncationMode(.tail)

            Spacer(minLength: DesignTokens.Spacing.sm)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
        .accessibilityLabel(line.name)
    }
}
