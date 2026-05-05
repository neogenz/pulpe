import SwiftUI

// MARK: - Shared types

/// Staged reveal of the budget preview — a single source of truth consumed by
/// every subview so that hero, breakdown and encouraging message animate in
/// strict order without each owning its own boolean. Comparable via the `Int`
/// raw value makes conditions like `phase >= .cardShown` natural.
///
/// Not `private` — the extracted subview files (`BudgetPreviewHero.swift`, etc.)
/// need access to it from outside this file.
enum BudgetPreviewRevealPhase: Int, Comparable {
    case initial
    case heroShown
    case cardShown
    case messageShown

    static func < (lhs: BudgetPreviewRevealPhase, rhs: BudgetPreviewRevealPhase) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

private struct PartitionedTransactions {
    var income: [OnboardingTransaction] = []
    var expense: [OnboardingTransaction] = []
    var saving: [OnboardingTransaction] = []
}

// MARK: - BudgetPreviewStep (coordinator)

/// Final onboarding step. Keeps only what cannot be delegated: the reveal
/// orchestration (`.task { await revealSequence() }`), the screen-view
/// analytics event and the one-shot sensory feedback tied to the hero reveal.
/// All UI is expressed by three dedicated subviews below.
struct BudgetPreviewStep: View {
    @Bindable var state: OnboardingState

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var phase: BudgetPreviewRevealPhase = .initial

    /// Canonical 3-state health — forwarded to subviews that need it for copy,
    /// colors or haptics. SOT is `BudgetFormulas.emotionState` via OnboardingState.
    private var emotionState: BudgetFormulas.EmotionState {
        state.emotionState
    }

    /// Light haptic for deficit (acknowledgement without celebration), success
    /// for healthy/tight (positive reinforcement). Matches "aucun haptique
    /// célébrant un déficit" from the design brief.
    private var heroSensoryFeedback: SensoryFeedback {
        switch emotionState {
        case .comfortable, .tight: .success
        case .deficit: .impact(weight: .light)
        }
    }

    /// Stable analytics string — decoupled from the enum `Equatable` identity so
    /// renames in `BudgetFormulas.EmotionState` can't silently break funnels.
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
            onNext: { state.nextStep() },
            content: {
                VStack(spacing: DesignTokens.Spacing.xxxl) {
                    BudgetPreviewHero(
                        state: state,
                        emotionState: emotionState,
                        phase: phase
                    )
                    BudgetPreviewBreakdownCard(
                        state: state,
                        phase: phase
                    )
                    BudgetPreviewEncouragingMessage(
                        state: state,
                        emotionState: emotionState,
                        phase: phase
                    )
                }
            }
        )
        // Background stays neutral across the whole onboarding flow. The
        // health state is communicated by the hero copy ("disponible" / "à
        // combler"), the hero glyph (checkmark / equal / up-down arrows) and
        // the accent color on the amount — not by a full-width chromatic wash
        // that a first-time user would have no prior context to decode.
        //
        // Enrich the screen-view event with the health band so the funnel can
        // split drop-off and time-on-screen by comfortable/tight/deficit.
        .trackScreen("Onboarding_BudgetPreview", properties: [
            "health_state": analyticsHealthState
        ])
        // Only fires once — when the phase transitions past `.initial` onto
        // `.heroShown`. Subsequent transitions (cardShown, messageShown) return
        // `nil` and stay silent, so we never double-haptic.
        .sensoryFeedback(trigger: phase) { _, newValue in
            newValue == .heroShown ? heroSensoryFeedback : nil
        }
        .task { await revealSequence() }
    }

    /// Staggered entrance choreography. Drives the single `phase` state that
    /// every subview reads to trigger its own local animation. Kept on the
    /// coordinator (not in a subview) so the sequencing is explicit and sits
    /// next to the `.task` that starts it.
    private func revealSequence() async {
        // Give the parent's step transition time to settle before the peak.
        try? await Task.sleep(for: .milliseconds(400))
        await delayedAnimation(0, animation: DesignTokens.Animation.bouncySpring) {
            phase = .heroShown
        }
        await delayedAnimation(0.4, animation: DesignTokens.Animation.defaultSpring) {
            phase = .cardShown
        }
        await delayedAnimation(0.2) {
            phase = .messageShown
        }
    }
}

// MARK: - Breakdown Card

/// Three-block breakdown (Revenus / Charges fixes / Épargne prévue) plus the
/// flow bars. Owns its reveal animation locally, reading the parent phase to
/// decide when to scale-in and fade-in.
private struct BudgetPreviewBreakdownCard: View {
    let state: OnboardingState
    let phase: BudgetPreviewRevealPhase

    private var isRevealed: Bool { phase >= .cardShown }

    /// Single-pass partition of custom transactions — avoids three separate
    /// `.filter` traversals during the body re-evaluations that happen on
    /// every phase transition.
    private var partitioned: PartitionedTransactions {
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

    /// Full sentence read by VoiceOver for the whole card — preserves the
    /// Entrées / Sorties / dont / et structure so the summary flows.
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

    var body: some View {
        let custom = partitioned
        let charges = state.totalCharges
        let savings = state.totalSavings

        // Visual rhythm: generous gap between category blocks, tight gap
        // within a block (header → sub-items). Spacing replaces dividers.
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
            BudgetPreviewFlowBars(
                income: state.totalIncome,
                charges: charges,
                savings: savings,
                isRevealed: isRevealed,
                currency: state.currency
            )

            // Category icons are outlined (not `.fill`) per brand iconography —
            // "outlined style, 1.5-2px stroke, rounded corners".
            categoryBlock {
                breakdownRow(
                    icon: "arrow.down.circle",
                    label: "Revenus",
                    amount: state.totalIncome,
                    kind: .income,
                    onEdit: { state.jumpToStepForEdit(.income) }
                )

                ForEach(custom.income) { tx in
                    detailRow(label: tx.name, amount: tx.amount, kind: .income, color: .financialIncome)
                }
            }

            if charges > 0 {
                categoryBlock {
                    breakdownRow(
                        icon: "arrow.up.circle",
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
            }

            if savings > 0 {
                categoryBlock {
                    breakdownRow(
                        icon: "building.columns",
                        label: "Épargne prévue",
                        amount: savings,
                        kind: .saving,
                        onEdit: { state.jumpToStepForEdit(.savings) }
                    )

                    ForEach(custom.saving) { tx in
                        detailRow(label: tx.name, amount: tx.amount, kind: .saving)
                    }
                }
            }
        }
        .padding(DesignTokens.Spacing.lg)
        // Generic "rounded rectangle + drop shadow" is explicitly called out as
        // AI slop in the design context. A thin outline + flat fill gives the
        // card its own presence against the pale emotion-zone gradient without
        // relying on elevation as a crutch — quieter and more confident.
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .fill(Color.onboardingCardBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                        .strokeBorder(Color.outlineVariant, lineWidth: DesignTokens.BorderWidth.thin)
                )
        )
        // `.contain` (not `.combine`) groups children semantically while
        // keeping each child individually focusable — the three "Modifier
        // {Revenus, Charges, Épargne}" edit buttons need to stay reachable for
        // VoiceOver users to round-trip back to the income/charges/savings steps.
        .accessibilityElement(children: .contain)
        .accessibilityLabel(breakdownAccessibilityLabel)
        .scaleEffect(isRevealed ? 1 : 0.95)
        .opacity(isRevealed ? 1 : 0)
    }

    /// Category block: tight vertical spacing between the header row and its
    /// sub-items so they read as one unit. The parent VStack handles the
    /// larger gap between blocks.
    @ViewBuilder
    private func categoryBlock<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            content()
        }
    }

    @ViewBuilder
    private func breakdownRow(
        icon: String,
        label: String,
        amount: Decimal,
        kind: TransactionKind,
        onEdit: (() -> Void)? = nil
    ) -> some View {
        if let onEdit {
            // Whole-row tap target: the pencil was a 44×44 island surrounded
            // by inert content. Making the entire row the button surface
            // increases discoverability and hit area without changing the
            // visual design — the pencil stays as a pure affordance cue.
            Button(action: onEdit) {
                breakdownRowContent(icon: icon, label: label, amount: amount, kind: kind, showEditGlyph: true)
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .plainPressedButtonStyle()
            .accessibilityLabel("\(label), \(amount.asCompactCurrency(state.currency)). Toucher pour modifier.")
        } else {
            breakdownRowContent(icon: icon, label: label, amount: amount, kind: kind, showEditGlyph: false)
        }
    }

    private func breakdownRowContent(
        icon: String,
        label: String,
        amount: Decimal,
        kind: TransactionKind,
        showEditGlyph: Bool
    ) -> some View {
        let color = Color.financialColor(for: kind)
        return HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: icon)
                .font(PulpeTypography.body)
                .foregroundStyle(color)

            Text(label)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            Text(amount.asSignedCompactCurrency(state.currency, for: kind))
                .font(PulpeTypography.onboardingSubtitle)
                .monospacedDigit()
                .foregroundStyle(color)

            if showEditGlyph {
                Image(systemName: "square.and.pencil")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiaryOnboarding)
                    // Decorative affordance only — the whole row carries the
                    // `Modifier X` action label, so the pencil must not be
                    // separately announced to VoiceOver.
                    .accessibilityHidden(true)
            }
        }
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
}

// MARK: - Encouraging Message

/// Coach-tone afterword rendered below the breakdown. Three registers
/// (confort / tendu / déficit), with an optional first-name suffix so the one
/// moment of personal address in the onboarding lands naturally.
private struct BudgetPreviewEncouragingMessage: View {
    let state: OnboardingState
    let emotionState: BudgetFormulas.EmotionState
    let phase: BudgetPreviewRevealPhase

    private var isRevealed: Bool { phase >= .messageShown }

    /// Title — confirm (comfortable) / acknowledge (tight) / reassure (deficit).
    /// Appended with the user's first name when available for a warm, one-beat
    /// personal touch — the single moment the interface addresses them by name.
    private var title: String {
        let base: String
        switch emotionState {
        case .comfortable: base = "Ton budget respire"
        case .tight: base = "Ton budget tient debout"
        case .deficit: base = "Tu vois clairement où tu en es"
        }
        let trimmedName = state.firstName.trimmingCharacters(in: .whitespaces)
        return trimmedName.isEmpty ? "\(base)." : "\(base), \(trimmedName)."
    }

    private var subtitle: String {
        switch emotionState {
        case .comfortable: "Belle marge pour le mois. Tu pourras affiner plus tard."
        case .tight: "C'est équilibré mais serré. Tu pourras affiner plus tard."
        case .deficit: "On va ajuster ensemble dès que ton budget est validé."
        }
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(title)
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textTertiaryOnboarding)

            Text(subtitle)
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.textTertiaryOnboarding)
        }
        .multilineTextAlignment(.center)
        .blurSlide(isRevealed)
    }
}

// MARK: - Previews

/// Sanity-check all three emotion bands in design review so the two-zone
/// composition, copy register and accent color can be compared side-by-side.
/// Each preview is rendered standalone — the parent `OnboardingFlow` scaffold
/// (progress bar, back button, CTA overlay) is NOT included, since that's the
/// step-agnostic chrome already validated elsewhere.
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
    .environment(FeatureFlagsStore())
}

#Preview("Tight") {
    BudgetPreviewStep(state: {
        let state = OnboardingState()
        state.firstName = "Marie"
        state.monthlyIncome = 3500
        state.housingCosts = 1800
        state.healthInsurance = 400
        state.phonePlan = 60
        state.transportCosts = 300
        return state
    }())
    .environment(FeatureFlagsStore())
}

#Preview("Deficit") {
    BudgetPreviewStep(state: {
        let state = OnboardingState()
        state.firstName = "Marie"
        state.monthlyIncome = 2500
        state.housingCosts = 1900
        state.healthInsurance = 450
        state.phonePlan = 70
        state.transportCosts = 350
        state.leasingCredit = 400
        return state
    }())
    .environment(FeatureFlagsStore())
}
