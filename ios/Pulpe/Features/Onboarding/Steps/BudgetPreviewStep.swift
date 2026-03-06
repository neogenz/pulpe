import SwiftUI

struct BudgetPreviewStep: View {
    let state: OnboardingState

    @State private var showCheckmark = false
    @State private var showHero = false
    @State private var showCard = false
    @State private var showMessage = false

    var body: some View {
        OnboardingStepView(
            step: .budgetPreview,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() },
            content: {
                VStack(spacing: DesignTokens.Spacing.xxxl) {
                    heroSection
                    breakdownCard
                    encouragingMessage
                }
            }
        )
        .trackScreen("Onboarding_BudgetPreview")
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            // Celebration checkmark — peak moment opener
            ZStack {
                Circle()
                    .fill(Color.pulpePrimary.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: 56, height: 56)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(Color.pulpePrimary)
                    .symbolEffect(.bounce, value: showCheckmark)
            }
            .scaleEffect(showCheckmark ? 1 : 0.3)
            .opacity(showCheckmark ? 1 : 0)

            Text(state.availableToSpend.asCHF)
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .foregroundStyle(Color.pulpePrimary)
                .contentTransition(.numericText())

            Text("disponible \u{00e0} d\u{00e9}penser")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
        .padding(.vertical, DesignTokens.Spacing.xl)
        .opacity(showHero ? 1 : 0)
        .offset(y: showHero ? 0 : 10)
        .task {
            // Stagger: checkmark first (peak opener), then amount, then card, then message
            try? await Task.sleep(for: .milliseconds(400))
            await delayedAnimation(0, animation: DesignTokens.Animation.bouncySpring) {
                showCheckmark = true
            }
            await delayedAnimation(0.15, animation: DesignTokens.Animation.entranceSpring) {
                showHero = true
            }
            await delayedAnimation(0.25, animation: DesignTokens.Animation.defaultSpring) {
                showCard = true
            }
            await delayedAnimation(0.2) {
                showMessage = true
            }
        }
    }

    // MARK: - Breakdown Card

    private var breakdownCard: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            breakdownRow(
                icon: "arrow.down.circle.fill",
                label: "Revenus",
                value: "+\((state.monthlyIncome ?? 0).asCHF)",
                color: .pulpePrimary
            )

            Divider()

            if state.totalExpenses > 0 {
                breakdownRow(
                    icon: "arrow.up.circle.fill",
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
                    .font(PulpeTypography.buttonPrimary)
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
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text("On y voit plus clair, non ?")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textTertiaryOnboarding)

            Text("Tu pourras affiner tout \u{00e7}a plus tard.")
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.textTertiaryOnboarding.opacity(0.7))
        }
        .multilineTextAlignment(.center)
        .blurSlide(showMessage)
    }

    // MARK: - Helpers

    private func breakdownRow(icon: String, label: String, value: String, color: Color) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: icon)
                .font(PulpeTypography.body)
                .foregroundStyle(color)

            Text(label)
                .font(PulpeTypography.bodyLarge)

            Spacer()

            Text(value)
                .font(PulpeTypography.onboardingSubtitle)
                .monospacedDigit()
                .foregroundStyle(color)
        }
    }
}

#Preview {
    BudgetPreviewStep(state: {
        let step = OnboardingState()
        step.monthlyIncome = 5000
        step.housingCosts = 1500
        step.healthInsurance = 350
        step.phonePlan = 50
        return step
    }())
}
