import SwiftUI

private struct PartitionedTransactions {
    var income: [OnboardingTransaction] = []
    var expense: [OnboardingTransaction] = []
    var saving: [OnboardingTransaction] = []
}

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
                    .frame(
                        width: DesignTokens.IconSize.heroBadge,
                        height: DesignTokens.IconSize.heroBadge
                    )

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
        let custom = customByKind
        let charges = state.totalCharges
        let savings = state.totalSavings

        return VStack(spacing: DesignTokens.Spacing.md) {
            BudgetPreviewFlowBars(
                income: state.totalIncome,
                charges: charges,
                savings: savings,
                isRevealed: showCard,
                currency: state.currency
            )

            softDivider

            breakdownRow(
                icon: "arrow.down.circle.fill",
                label: "Revenus",
                amount: state.totalIncome,
                kind: .income,
                onEdit: { state.jumpToStepForEdit(.income) }
            )

            ForEach(custom.income) { tx in
                detailRow(label: tx.name, amount: tx.amount, kind: .income, color: .financialIncome)
            }

            softDivider

            if charges > 0 {
                breakdownRow(
                    icon: "arrow.up.circle.fill",
                    label: "Charges fixes",
                    amount: charges,
                    kind: .expense,
                    onEdit: { state.jumpToStepForEdit(.charges) }
                )

                ForEach(state.fixedChargeLines) { line in
                    detailRow(label: line.label, amount: line.amount, kind: .expense)
                }

                ForEach(custom.expense) { tx in
                    detailRow(label: tx.name, amount: tx.amount, kind: .expense)
                }
            }

            if savings > 0 {
                breakdownRow(
                    icon: "building.columns.fill",
                    label: "Épargne prévue",
                    amount: savings,
                    kind: .saving,
                    onEdit: { state.jumpToStepForEdit(.savings) }
                )

                ForEach(custom.saving) { tx in
                    detailRow(label: tx.name, amount: tx.amount, kind: .saving)
                }
            }

            if charges > 0 || savings > 0 {
                softDivider
            }

            HStack {
                Text("Disponible")
                    .font(PulpeTypography.labelLarge)
                Spacer()
                Text(state.availableToSpend.asCompactCurrency(state.currency))
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
        // `.contain` (not `.combine`) groups children semantically while keeping each
        // child individually focusable — the three "Modifier {Revenus, Charges, Épargne}"
        // edit buttons rendered by `breakdownRow` need to stay reachable for VoiceOver
        // users to round-trip back to the income/charges/savings steps.
        .accessibilityElement(children: .contain)
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

    /// Single-pass partition avoids three separate `.filter` traversals during
    /// the count-up animation re-renders.
    private var customByKind: PartitionedTransactions {
        var result = PartitionedTransactions()
        for tx in state.customTransactions {
            switch tx.type {
            case .income: result.income.append(tx)
            case .expense: result.expense.append(tx)
            case .saving: result.saving.append(tx)
            }
        }
        return result
    }

    private var breakdownAccessibilityLabel: String {
        let income = state.totalIncome.asCompactCurrency(state.currency)
        let outflows = state.totalExpenses.asCompactCurrency(state.currency)
        var label = "Résumé du budget. Entrées \(income), sorties \(outflows)"
        let charges = state.totalCharges
        let savings = state.totalSavings
        if charges > 0 {
            label += " dont \(charges.asCompactCurrency(state.currency)) de charges"
        }
        if savings > 0 {
            let connector = charges > 0 ? " et" : " dont"
            label += "\(connector) \(savings.asCompactCurrency(state.currency)) d'épargne"
        }
        return label
    }

    private var isDeficit: Bool { state.availableToSpend < 0 }

    private var heroAccentColor: Color {
        isDeficit ? .financialExpense : .pulpePrimary
    }

    /// Animated hero amount — interpolates from 0 on appear via `displayAmount`.
    private var heroAmountText: String {
        (displayAmount < 0 ? displayAmount.magnitude : displayAmount).asCompactCurrency(state.currency)
    }

    /// Final hero amount — always the true value, used for accessibility so VoiceOver
    /// doesn't read every frame of the count-up animation.
    private var finalHeroAmountText: String {
        (isDeficit ? state.availableToSpend.magnitude : state.availableToSpend).asCompactCurrency(state.currency)
    }

    // MARK: - Helpers

    private var softDivider: some View {
        Divider()
            .opacity(DesignTokens.Opacity.accent)
            .padding(.horizontal, DesignTokens.Spacing.xs)
    }

    private func detailRow(
        label: String,
        amount: Decimal,
        kind: TransactionKind,
        color: Color = .textTertiary
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Text(label)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
            Spacer()
            Text(amount.asSignedCompactCurrency(state.currency, for: kind))
                .font(PulpeTypography.caption)
                .monospacedDigit()
                .foregroundStyle(color)
        }
        .padding(.leading, DesignTokens.Spacing.xl)
    }

    private func breakdownRow(
        icon: String,
        label: String,
        amount: Decimal,
        kind: TransactionKind,
        onEdit: (() -> Void)? = nil
    ) -> some View {
        let color = Color.financialColor(for: kind)
        return HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: icon)
                .font(PulpeTypography.body)
                .foregroundStyle(color)

            Text(label)
                .font(PulpeTypography.bodyLarge)

            Spacer()

            Text(amount.asSignedCompactCurrency(state.currency, for: kind))
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
