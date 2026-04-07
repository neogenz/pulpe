import SwiftUI

struct BudgetPreviewStep: View {
    let state: OnboardingState

    @Environment(\.amountsHidden) private var amountsHidden

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
                    .font(PulpeTypography.previewAmount)
                    .foregroundStyle(Color.pulpePrimary)
                    .symbolEffect(.bounce, value: showCheckmark)
            }
            .scaleEffect(showCheckmark ? 1 : 0.3)
            .opacity(showCheckmark ? 1 : 0)

            Text(state.availableToSpend.asCompactCHF)
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .foregroundStyle(Color.pulpePrimary)
                .contentTransition(.numericText())

            Text("disponible \u{00e0} d\u{00e9}penser")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
        .padding(.vertical, DesignTokens.Spacing.xl)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            amountsHidden
                ? "Disponible à dépenser: montant masqué"
                : "Disponible à dépenser: \(state.availableToSpend.asCompactCHF)"
        )
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
                value: "+\(totalIncome.asCompactCHF)",
                color: .financialIncome
            )

            ForEach(customIncomes) { tx in
                detailRow(tx, prefix: "+", color: Color.financialIncome)
            }

            Divider()
                .opacity(0.15)
                .padding(.horizontal, DesignTokens.Spacing.xs)

            if chargesTotal > 0 {
                breakdownRow(
                    icon: "arrow.up.circle.fill",
                    label: "Charges fixes",
                    value: "-\(chargesTotal.asCompactCHF)",
                    color: .financialExpense
                )

                // Hardcoded charges detail
                if let housing = state.housingCosts, housing > 0 {
                    namedDetailRow("Loyer", amount: housing)
                }
                if let health = state.healthInsurance, health > 0 {
                    namedDetailRow("Assurance maladie", amount: health)
                }
                if let phone = state.phonePlan, phone > 0 {
                    namedDetailRow("Forfait téléphone", amount: phone)
                }
                if let transport = state.transportCosts, transport > 0 {
                    namedDetailRow("Transport", amount: transport)
                }
                if let leasing = state.leasingCredit, leasing > 0 {
                    namedDetailRow("Leasing / crédit", amount: leasing)
                }

                ForEach(customExpenses) { tx in
                    detailRow(tx)
                }
            }

            if savingsTotal > 0 {
                breakdownRow(
                    icon: "arrow.up.circle.fill",
                    label: "Épargne prévue",
                    value: "-\(savingsTotal.asCompactCHF)",
                    color: .financialSavings
                )

                ForEach(customSavings) { tx in
                    detailRow(tx)
                }
            }

            if chargesTotal > 0 || savingsTotal > 0 {
                Divider()
                    .opacity(0.15)
                    .padding(.horizontal, DesignTokens.Spacing.xs)
            }

            HStack {
                Text("Disponible")
                    .font(PulpeTypography.labelLarge)
                Spacer()
                Text(state.availableToSpend.asCompactCHF)
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Résumé du budget")
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
                .foregroundStyle(Color.textTertiaryOnboarding)
        }
        .multilineTextAlignment(.center)
        .blurSlide(showMessage)
    }

    // MARK: - Computed

    private var customIncomes: [OnboardingTransaction] {
        state.customTransactions.filter { $0.type == .income }
    }

    private var customExpenses: [OnboardingTransaction] {
        state.customTransactions.filter { $0.type == .expense }
    }

    private var customSavings: [OnboardingTransaction] {
        state.customTransactions.filter { $0.type == .saving }
    }

    private var totalIncome: Decimal {
        (state.monthlyIncome ?? 0) + state.totalCustomIncome
    }

    private var savingsTotal: Decimal {
        customSavings.reduce(Decimal.zero) { $0 + $1.amount }
    }

    private var chargesTotal: Decimal {
        state.totalExpenses - savingsTotal
    }

    // MARK: - Helpers

    private func namedDetailRow(_ name: String, amount: Decimal) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Text(name)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
            Spacer()
            Text("-\(amount.asCompactCHF)")
                .font(PulpeTypography.caption)
                .monospacedDigit()
                .foregroundStyle(Color.textTertiary)
        }
        .padding(.leading, DesignTokens.Spacing.xl)
    }

    private func detailRow(
        _ tx: OnboardingTransaction, prefix: String = "-", color: Color = .textTertiary
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Text(tx.name)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
            Spacer()
            Text("\(prefix)\(tx.amount.asCompactCHF)")
                .font(PulpeTypography.caption)
                .monospacedDigit()
                .foregroundStyle(color)
        }
        .padding(.leading, DesignTokens.Spacing.xl)
    }

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
