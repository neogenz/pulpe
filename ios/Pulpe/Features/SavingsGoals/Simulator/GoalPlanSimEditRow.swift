import SwiftUI

/// One editable open-month row in the plan simulator (PUL-12+): month label +
/// running cumulative + an inline decimal field. A visible field is the only
/// affordance a non-tech parses in 3 s and is natively accessible — no drag-on-bar,
/// no steppers (`docs/SAVINGS_PLAN.md` §2 pilier C). Savings green + neutrals only.
struct GoalPlanSimEditRow: View {
    let simMonth: SavingsPlanCalculator.SimulatedMonth
    let currency: SupportedCurrency
    @Binding var amount: Decimal

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
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

            Spacer(minLength: DesignTokens.Spacing.sm)

            HStack(spacing: DesignTokens.Spacing.xs) {
                TextField("", value: $amount, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                    .frame(width: 88)
                    .accessibilityLabel("Montant pour \(Formatters.monthName(for: simMonth.month.month))")
                Text(currency.symbol)
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.textSecondary)
            }
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, DesignTokens.Spacing.sm)
            .background(Color.surfaceContainerHigh)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.sm))
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
    }
}
