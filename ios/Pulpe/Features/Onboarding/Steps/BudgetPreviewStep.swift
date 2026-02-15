import SwiftUI

struct BudgetPreviewStep: View {
    let state: OnboardingState

    @State private var showHero = false
    @State private var showCard = false
    @State private var showMessage = false

    @ScaledMetric(relativeTo: .largeTitle) private var heroFontSize: CGFloat = 42

    var body: some View {
        OnboardingStepView(
            step: .budgetPreview,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() }
        ) {
            VStack(spacing: DesignTokens.Spacing.xxxl) {
                heroSection
                breakdownCard
                encouragingMessage
            }
            .task {
                try? await Task.sleep(for: .milliseconds(300))
                withAnimation(.spring(response: 0.6, dampingFraction: 0.75)) {
                    showHero = true
                }
                try? await Task.sleep(for: .milliseconds(250))
                withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                    showCard = true
                }
                try? await Task.sleep(for: .milliseconds(200))
                withAnimation(.easeOut(duration: 0.4)) {
                    showMessage = true
                }
            }
        }
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(state.availableToSpend.asCHF)
                .font(.system(size: heroFontSize, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Color.pulpePrimary)
                .contentTransition(.numericText())

            Text("disponible \u{00e0} d\u{00e9}penser")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
        .padding(.vertical, DesignTokens.Spacing.xxl)
        .scaleEffect(showHero ? 1 : 0.85)
        .opacity(showHero ? 1 : 0)
    }

    // MARK: - Breakdown Card

    private var breakdownCard: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            breakdownRow(
                label: "Revenus",
                value: "+\((state.monthlyIncome ?? 0).asCHF)",
                color: .pulpePrimary
            )

            Divider()

            if state.totalExpenses > 0 {
                breakdownRow(
                    label: "Charges fixes",
                    value: "-\(state.totalExpenses.asCHF)",
                    color: .secondary
                )

                Divider()
            }

            HStack {
                Text("Disponible")
                    .font(PulpeTypography.labelLarge)
                Spacer()
                Text(state.availableToSpend.asCHF)
                    .font(.system(.body, design: .rounded).weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Color.pulpePrimary)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .fill(Color.onboardingCardBackground)
                .shadow(DesignTokens.Shadow.card)
        )
        .scaleEffect(showCard ? 1 : 0.95)
        .opacity(showCard ? 1 : 0)
    }

    // MARK: - Encouraging Message

    private var encouragingMessage: some View {
        Text("On y voit plus clair, non ?")
            .font(PulpeTypography.onboardingSubtitle)
            .foregroundStyle(Color.textTertiaryOnboarding)
            .multilineTextAlignment(.center)
            .opacity(showMessage ? 1 : 0)
            .offset(y: showMessage ? 0 : 8)
    }

    // MARK: - Helpers

    private func breakdownRow(label: String, value: String, color: Color) -> some View {
        HStack {
            Text(label)
                .font(PulpeTypography.bodyLarge)
            Spacer()
            Text(value)
                .font(.system(.body, design: .rounded).weight(.medium))
                .monospacedDigit()
                .foregroundStyle(color)
        }
    }
}

#Preview {
    BudgetPreviewStep(state: {
        let s = OnboardingState()
        s.monthlyIncome = 5000
        s.housingCosts = 1500
        s.healthInsurance = 350
        s.phonePlan = 50
        return s
    }())
}
