import SwiftUI

/// Tour 11 "Ça dérive" — envelopes consumed beyond plan this month, with mini
/// planned/overflow bars, and a "Rattraper" footer action listing the real levers.
/// Only rendered when the current month actually drifts.
struct DriftCard: View {
    let drifts: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)]
    let totalOver: Decimal
    /// Next-month name for the "ajuster {mois}" lever in the footer subtitle.
    let adjustMonthName: String
    var onViewBudget: () -> Void
    var onCatchUp: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden

    private var currency: SupportedCurrency { userSettingsStore.currency }

    private var headerAccessibilityLabel: String {
        guard !amountsHidden else { return "Ça dérive — montant masqué" }
        return "Ça dérive, \(totalOver.asCompactCurrency(currency)) au-delà du plan"
    }

    private var catchUpAccessibilityLabel: String {
        guard !amountsHidden else { return "Rattraper le dépassement" }
        return "Rattraper ces \(totalOver.asCompactCurrency(currency)) en trop"
    }

    private func rowAccessibilityLabel(_ line: BudgetLine, overBy: Decimal) -> String {
        guard !amountsHidden else { return "\(line.name), au-delà du plan" }
        return "\(line.name), \(overBy.asCurrency(currency)) au-delà du plan"
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            Button(action: onViewBudget) {
                header
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .plainPressedButtonStyle()
            .accessibilityLabel(headerAccessibilityLabel)
            .accessibilityHint("Voir le budget")

            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(Array(drifts.enumerated()), id: \.element.line.id) { index, drift in
                    driftRow(drift.line, drift.consumption)
                    if index < drifts.count - 1 {
                        Divider()
                    }
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.bottom, DesignTokens.Spacing.sm)

            Divider()
                .padding(.horizontal, DesignTokens.Spacing.xl)

            Button(action: onCatchUp) {
                catchUpRow
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .plainPressedButtonStyle()
            .accessibilityLabel(catchUpAccessibilityLabel)
            .accessibilityHint("Alléger le prévu, piocher dans l'épargne ou ajuster \(adjustMonthName)")
        }
        .pulpeCardBackground()
        .shadow(DesignTokens.Shadow.card)
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Ça dérive")
                    .font(PulpeTypography.cardTitle)
                    .foregroundStyle(Color.textPrimary)

                Text("\(totalOver.asCompactCurrency(currency)) au-delà du plan")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textTertiary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textTertiary)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
    }

    // MARK: - Drift Row

    private func driftRow(_ line: BudgetLine, _ consumption: BudgetFormulas.Consumption) -> some View {
        let overBy = -consumption.available

        return VStack(spacing: DesignTokens.Spacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(line.name)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)

                Spacer()

                Text("+\(overBy.asAmount(for: currency)) en trop")
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.driftAccent)
                    .monospacedDigit()
                    .sensitiveAmount()
            }

            HomeSegmentedBar(
                fillFraction: plannedFraction(line, consumption),
                overflowFraction: 1 - plannedFraction(line, consumption),
                fillColor: .textPrimary,
                overflowColor: .driftAccent,
                trackColor: .progressTrack,
                height: DesignTokens.ProgressBar.height
            )
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel(line, overBy: overBy))
    }

    /// Planned share of the consumed bar: `amount / allocated`.
    private func plannedFraction(_ line: BudgetLine, _ consumption: BudgetFormulas.Consumption) -> Double {
        guard consumption.allocated > 0, line.amount > 0 else { return 0 }
        return min(Double(truncating: (line.amount / consumption.allocated) as NSDecimalNumber), 1)
    }

    // MARK: - Catch-Up Footer

    private var catchUpRow: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Rattraper ces \(totalOver.asCompactAmount(for: currency)) en trop")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.pulpePrimary)
                    .monospacedDigit()
                    .sensitiveAmount()

                Text("Alléger le prévu du mois · piocher dans l'épargne · ajuster \(adjustMonthName)")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textTertiary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.pulpePrimary.opacity(DesignTokens.Opacity.heavy))
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
    }
}
