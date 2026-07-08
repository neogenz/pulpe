import SwiftUI

/// One month row of « Ton plan, mois par mois » (PUL-12+, pilier B). Cloned from
/// `SpreadOccurrenceRow`: same grammar as the lissage timeline so there is zero new
/// language to learn (`docs/SAVINGS_PLAN.md` §2 pilier B).
///
/// `amount` / `cumulative` are injected so the same row serves read mode
/// (`plannedAmount` / `plannedCumulative`) and the simulator (`simulatedAmount` /
/// `simulatedCumulative`). Locked rows are dimmed + non-interactive; the current
/// period carries a « Ce mois » chip; a `gap` month shows « Pas de budget ». Amount
/// is the ligne 2-decimal (`asCurrency`), cumulative the aggregation compact
/// (`asCompactCurrency`, `→` prefix). Savings green + neutrals only (RG-002).
struct GoalPlanMonthRow: View {
    let month: SavingsGoalPlanMonth
    let amount: Decimal
    let cumulative: Decimal
    let currency: SupportedCurrency
    var isAdjusted: Bool = false

    private var isCurrentPeriod: Bool { month.state == .current }
    private var isGap: Bool { month.state == .gap }

    private var allChecked: Bool {
        !month.lines.isEmpty && month.lines.allSatisfy(\.isChecked)
    }

    private var stateIcon: (name: String, color: Color)? {
        if allChecked { return ("checkmark.circle.fill", .financialSavings) }
        if month.isLocked { return ("lock.fill", .textTertiary) }
        return nil
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            iconSlot

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(monthLabel)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)

                if isCurrentPeriod {
                    PulpeChip(label: "Ce mois", style: .muted)
                } else if isGap {
                    PulpeChip(icon: "calendar.badge.exclamationmark", label: "Pas de budget", style: .muted)
                }
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            amountView
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
        .opacity(month.isLocked ? DesignTokens.Opacity.pointedDim : 1)
        .allowsHitTesting(!month.isLocked)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    @ViewBuilder
    private var iconSlot: some View {
        if let icon = stateIcon {
            Image(systemName: icon.name)
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(icon.color)
                .frame(width: DesignTokens.IconSize.compact)
        } else {
            Color.clear.frame(width: DesignTokens.IconSize.compact, height: 1)
        }
    }

    @ViewBuilder
    private var amountView: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            if !isGap {
                Text(amount.asCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
                    .foregroundStyle(isAdjusted ? Color.pulpePrimary : Color.textPrimary)
            }
            Text("→ \(cumulative.asCompactCurrency(currency))")
                .font(PulpeTypography.metricMini)
                .monospacedDigit()
                .foregroundStyle(Color.textTertiary)
        }
        .sensitiveAmount()
    }

    private var monthLabel: String {
        "\(Formatters.monthName(for: month.month)) \(month.year)"
    }

    private var accessibilityLabel: String {
        var parts = [monthLabel]
        if isGap {
            parts.append("pas de budget")
        } else {
            parts.append(amount.asCurrency(currency))
        }
        parts.append("cumulé \(cumulative.asCurrency(currency))")
        if isCurrentPeriod { parts.append("ce mois") }
        if allChecked { parts.append("pointé") }
        if month.isLocked { parts.append("verrouillé") }
        return parts.joined(separator: ", ")
    }
}
