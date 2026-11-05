import SwiftUI

/// Final onboarding step: the ring and the verdict in the forest zone, then one row per block
/// (Revenus, Charges fixes, Épargne prévue) that leads back to its step.
struct BudgetPreviewStep: View {
    @Bindable var state: OnboardingState

    @State private var isRevealed = false

    private var emotionState: BudgetFormulas.EmotionState { state.emotionState }
    private var isDeficit: Bool { emotionState == .deficit }

    /// Light haptic for a deficit (acknowledgement without celebration), success otherwise.
    private var feedback: SensoryFeedback {
        isDeficit ? .impact(weight: .light) : .success
    }

    /// Stable analytics string, decoupled from the enum so a rename can't silently break funnels.
    private var analyticsHealthState: String {
        switch emotionState {
        case .comfortable: "comfortable"
        case .tight: "tight"
        case .deficit: "deficit"
        }
    }

    var body: some View {
        OnboardingStepView(
            step: .budgetPreview,
            state: state,
            canProceed: true,
            showsCardTitle: false,
            onNext: { state.nextStep() },
            zone: { zone },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    if isDeficit { deficitBanner }
                    FormCard {
                        breakdownRow(
                            step: .income,
                            kind: .income,
                            title: AppLocale.string("Revenus"),
                            names: [AppLocale.string("Salaire")] + names(of: .income),
                            amount: state.totalIncome.asSignedAmount(for: .income, in: state.currency)
                        )
                        if state.totalCharges > 0 {
                            FormRowDivider()
                            breakdownRow(
                                step: .charges,
                                kind: .expense,
                                title: AppLocale.string("Charges fixes"),
                                names: state.fixedChargeLines.map(\.label) + names(of: .expense),
                                amount: state.totalCharges.asAmount(for: state.currency)
                            )
                        }
                        if state.totalSavings > 0 {
                            FormRowDivider()
                            breakdownRow(
                                step: .savings,
                                kind: .saving,
                                title: AppLocale.string("Épargne prévue"),
                                names: names(of: .saving),
                                amount: state.totalSavings.asAmount(for: state.currency)
                            )
                        }
                    }
                    Text("""
                        Ces montants deviennent ton modèle de mois : chaque nouveau mois \
                        repart de là, et tu les changes quand tu veux.
                        """)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                }
            }
        )
        // The health state lives in the ring, its label and the copy, never in a tinted background.
        .trackScreen("Onboarding_BudgetPreview", properties: ["health_state": analyticsHealthState])
        .sensoryFeedback(feedback, trigger: isRevealed)
        .task { isRevealed = true }
    }

    // MARK: - Zone

    private var zone: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            OnboardingBudgetZone(
                state: state,
                legend: .all,
                subtitle: isDeficit
                    ? AppLocale.string("""
                        \(state.currency.rawValue) · \
                        \((state.totalExpenses).asAmount(for: state.currency)) prévus
                        """)
                    : AppLocale.string("\(state.currency.rawValue) · à dépenser")
            )
            VStack(spacing: DesignTokens.Spacing.xs) {
                Text(title)
                    .font(PulpeTypography.onboardingTitle)
                    .foregroundStyle(Color.heroInk)
                    .accessibilityAddTraits(.isHeader)
                Text(subtitle)
                    .font(PulpeTypography.onboardingSubtitle)
                    .foregroundStyle(Color.heroInkSecondary)
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
        }
    }

    /// Confirm (comfortable), acknowledge (tight) or reassure (deficit), with the first name when known.
    private var title: String {
        let base: String
        switch emotionState {
        case .comfortable: base = AppLocale.string("Ton budget respire")
        case .tight: base = AppLocale.string("Ton budget tient debout")
        case .deficit: base = AppLocale.string("Tu vois où tu en es")
        }
        let name = state.firstName.trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? "\(base)." : "\(base), \(name)."
    }

    private var subtitle: String {
        switch emotionState {
        case .comfortable: AppLocale.string("Belle marge pour le mois. Tu pourras affiner plus tard.")
        case .tight: AppLocale.string("C'est équilibré mais serré. Tu pourras affiner plus tard.")
        case .deficit: AppLocale.string("Rien n'est figé, tu pourras ajuster ton budget quand tu veux.")
        }
    }

    // MARK: - Deficit

    /// Charges alone past the income cannot be fixed by saving less: the banner then points at the charges.
    private var deficitBanner: some View {
        let chargesOnly = state.totalCharges > state.totalIncome
        return InfoBanner(style: .over, systemImage: "exclamationmark.circle") {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                Text(
                    chargesOnly
                        ? AppLocale.string("""
                            Tes charges dépassent à elles seules tes revenus. Revois-les pour tout \
                            faire tenir.
                            """)
                        : AppLocale.string("""
                            Ton épargne prévue dépasse ce qui reste après tes charges. La baisser \
                            de \(state.availableToSpend.magnitude.asAmount(for: state.currency)) \
                            suffit à tout faire tenir.
                            """)
                )
                Button(chargesOnly ? AppLocale.string("Revoir mes charges") : AppLocale.string("Revoir mon épargne")) {
                    state.jumpToStepForEdit(chargesOnly ? .charges : .savings)
                }
                .secondaryButtonStyle(size: .small)
            }
        }
    }

    // MARK: - Rows

    private func names(of kind: TransactionKind) -> [String] {
        state.customTransactions.filter { $0.type == kind }.map(\.name)
    }

    private func breakdownRow(
        step: OnboardingStep,
        kind: TransactionKind,
        title: String,
        names: [String],
        amount: String
    ) -> some View {
        Button { state.jumpToStepForEdit(step) } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                RowIcon(systemName: kind.icon, tint: kind.color)
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(title)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                    if let summary = Self.summary(of: names) {
                        Text(summary)
                            .font(PulpeTypography.captionRegular)
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(amount)
                    .font(PulpeTypography.rowAmount)
                    .foregroundStyle(Color.textPrimary)
                RowChevron()
            }
            .frame(minHeight: DesignTokens.ListRow.minHeight)
            .contentShape(Rectangle())
        }
        .plainPressedButtonStyle()
        .accessibilityLabel("\(title), \(amount). Toucher pour modifier.")
    }

    /// First name of the block, then how many others: "Loyer et 4 autres".
    static func summary(of names: [String]) -> String? {
        guard let first = names.first else { return nil }
        switch names.count - 1 {
        case 0: return first
        case 1: return AppLocale.string("\(first) et 1 autre")
        case let others: return AppLocale.string("\(first) et \(others) autres")
        }
    }
}

#Preview("Comfortable") {
    BudgetPreviewStep(state: {
        let state = OnboardingState()
        state.firstName = "Marie"
        state.monthlyIncome = 6000
        state.housingCosts = 1500
        state.healthInsurance = 350
        state.phonePlan = 50
        return state
    }())
}

#Preview("Deficit") {
    BudgetPreviewStep(state: {
        let state = OnboardingState()
        state.firstName = "Marie"
        state.monthlyIncome = 2500
        state.housingCosts = 1900
        state.healthInsurance = 450
        state.leasingCredit = 400
        return state
    }())
}
