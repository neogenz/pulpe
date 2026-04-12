import SwiftUI

struct BudgetPreviewStep: View {
    @Bindable var state: OnboardingState

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var showCheckmark = false
    @State private var showHero = false
    @State private var showCard = false
    @State private var showMessage = false
    /// Animated display value for the hero amount count-up.
    /// Starts at 0 and interpolates to `state.availableToSpend` on appear.
    @State private var displayAmount: Decimal = 0

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
        .sensoryFeedback(.success, trigger: showCheckmark)
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            // Celebration checkmark — peak moment opener
            ZStack {
                Circle()
                    .fill(heroAccentColor.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: 56, height: 56)

                Image(systemName: "checkmark.circle.fill")
                    .font(PulpeTypography.previewAmount)
                    .foregroundStyle(heroAccentColor)
                    .symbolEffect(.bounce, value: showCheckmark)
            }
            .scaleEffect(showCheckmark ? 1 : 0.3)
            .opacity(showCheckmark ? 1 : 0)

            Text(heroAmountText)
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .foregroundStyle(heroAccentColor)
                .contentTransition(.numericText())

            Text(isDeficit ? "à équilibrer" : "disponible à dépenser")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
        .padding(.vertical, DesignTokens.Spacing.xl)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            amountsHidden
                ? "\(isDeficit ? "À équilibrer" : "Disponible à dépenser"): montant masqué"
                : "\(isDeficit ? "À équilibrer" : "Disponible à dépenser"): \(finalHeroAmountText)"
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
            // Count-up: amount rolls from 0 → final value, synchronized with the hero reveal
            if reduceMotion {
                displayAmount = state.availableToSpend
            } else {
                withAnimation(.smooth(duration: 0.7)) {
                    displayAmount = state.availableToSpend
                }
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
            BudgetPreviewFlowBars(
                income: totalIncome,
                charges: totalCharges,
                savings: totalSavings,
                isRevealed: showCard
            )

            Divider()
                .opacity(0.15)
                .padding(.horizontal, DesignTokens.Spacing.xs)

            breakdownRow(
                icon: "arrow.down.circle.fill",
                label: "Revenus",
                value: "+\(totalIncome.asCompactCHF)",
                color: .financialIncome,
                onEdit: { state.jumpToStepForEdit(.income) }
            )

            ForEach(customIncomes) { tx in
                detailRow(tx, prefix: "+", color: Color.financialIncome)
            }

            Divider()
                .opacity(0.15)
                .padding(.horizontal, DesignTokens.Spacing.xs)

            if totalCharges > 0 {
                breakdownRow(
                    icon: "arrow.up.circle.fill",
                    label: "Charges fixes",
                    value: "-\(totalCharges.asCompactCHF)",
                    color: .financialExpense,
                    onEdit: { state.jumpToStepForEdit(.charges) }
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

            if totalSavings > 0 {
                breakdownRow(
                    icon: "building.columns.fill",
                    label: "Épargne prévue",
                    value: "-\(totalSavings.asCompactCHF)",
                    color: .financialSavings,
                    onEdit: { state.jumpToStepForEdit(.savings) }
                )

                ForEach(customSavings) { tx in
                    detailRow(tx)
                }
            }

            if totalCharges > 0 || totalSavings > 0 {
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
                    .foregroundStyle(heroAccentColor)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .fill(Color.onboardingCardBackground)
                .shadow(DesignTokens.Shadow.card)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(breakdownAccessibilityLabel)
        .scaleEffect(showCard ? 1 : 0.95)
        .opacity(showCard ? 1 : 0)
    }

    // MARK: - Encouraging Message

    private var encouragingMessage: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(isDeficit ? "Tu as une vision claire." : "Ton budget est prêt !")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textTertiaryOnboarding)

            Text(isDeficit
                ? "On va affiner ensemble pour équilibrer tout ça."
                : "Tu pourras affiner tout ça plus tard.")
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

    private var totalIncome: Decimal { state.totalIncome }
    private var totalSavings: Decimal { state.totalSavings }
    private var totalCharges: Decimal { state.totalCharges }
    private var totalOutflows: Decimal { state.totalExpenses }

    private var breakdownAccessibilityLabel: String {
        var label = "Résumé du budget. Entrées \(totalIncome.asCompactCHF)"
            + ", sorties \(totalOutflows.asCompactCHF)"
        if totalCharges > 0 {
            label += " dont \(totalCharges.asCompactCHF) de charges"
        }
        if totalSavings > 0 {
            let connector = totalCharges > 0 ? " et" : " dont"
            label += "\(connector) \(totalSavings.asCompactCHF) d'épargne"
        }
        return label
    }

    private var isDeficit: Bool { state.availableToSpend < 0 }

    private var heroAccentColor: Color {
        isDeficit ? .financialExpense : .pulpePrimary
    }

    /// Animated hero amount — interpolates from 0 on appear via `displayAmount`.
    private var heroAmountText: String {
        (displayAmount < 0 ? displayAmount.magnitude : displayAmount).asCompactCHF
    }

    /// Final hero amount — always the true value, used for accessibility so VoiceOver
    /// doesn't read every frame of the count-up animation.
    private var finalHeroAmountText: String {
        (isDeficit ? state.availableToSpend.magnitude : state.availableToSpend).asCompactCHF
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

    private func breakdownRow(
        icon: String, label: String, value: String, color: Color,
        onEdit: (() -> Void)? = nil
    ) -> some View {
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

            if let onEdit {
                Button(action: onEdit) {
                    Image(systemName: "square.and.pencil")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textTertiaryOnboarding)
                }
                .iconButtonStyle()
                .accessibilityLabel("Modifier \(label)")
            }
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
