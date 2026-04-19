import SwiftUI

/// Running total display for onboarding financial steps (income, charges, savings)
struct OnboardingRunningTotal: View {
    let label: String
    let amount: Decimal
    let color: Color
    var currency: SupportedCurrency = .chf

    var body: some View {
        HStack {
            Text(label)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textSecondaryOnboarding)
            Spacer()
            Text(amount.asCurrency(currency))
                .font(PulpeTypography.onboardingSubtitle)
                .monospacedDigit()
                .foregroundStyle(color)
                .contentTransition(.numericText())
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .fill(Color.onboardingCardBackground)
                .shadow(DesignTokens.Shadow.card)
        )
        .animation(.snappy(duration: DesignTokens.Animation.fast), value: amount)
    }
}

#Preview {
    VStack(spacing: 20) {
        OnboardingRunningTotal(label: "Total revenus", amount: 5000, color: .financialIncome)
        OnboardingRunningTotal(label: "Total charges", amount: 2350, color: .financialExpense)
        OnboardingRunningTotal(label: "Total épargne", amount: 1087, color: .financialSavings)
    }
    .padding()
}
