import SwiftUI

/// One editable open-month row in the plan simulator (PUL-12+): month label +
/// running cumulative + an inline decimal field. A visible field is the only
/// affordance a non-tech parses in 3 s and is natively accessible — no drag-on-bar,
/// no steppers (`docs/SAVINGS.md` §10.1). Savings green + neutrals only.
struct GoalPlanSimEditRow: View {
    let simMonth: SavingsPlanCalculator.SimulatedMonth
    let currency: SupportedCurrency
    @Binding var amount: Decimal

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: DesignTokens.Spacing.md) {
                monthDescription
                    .fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: DesignTokens.Spacing.sm)
                amountEditor(width: 88)
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                monthDescription
                    .fixedSize(horizontal: false, vertical: true)
                amountEditor(width: nil)
            }
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
    }

    private var monthDescription: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text("\(Formatters.monthName(for: simMonth.month.month)) \(simMonth.month.year)")
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)
            Text("→ \(simMonth.simulatedCumulative.asCompactCurrency(currency))")
                .font(PulpeTypography.metricMini)
                .monospacedDigit()
                .foregroundStyle(Color.textTertiary)
                .sensitiveAmount()
        }
    }

    private func amountEditor(width: CGFloat?) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            TextField("", value: $amount, format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.numbersAndPunctuation)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
                .frame(width: width)
                .frame(maxWidth: width == nil ? .infinity : nil)
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .accessibilityLabel("Mouvement de l’objectif ce mois")
            Text(currency.symbol)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: width == nil ? .infinity : nil)
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .background(Color.surfaceContainerHigh)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.sm))
    }
}
