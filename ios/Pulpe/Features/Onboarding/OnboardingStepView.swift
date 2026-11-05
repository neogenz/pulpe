import SwiftUI

/// Base scaffold of every onboarding step: a forest zone (a slot that answers the input, under the
/// flow's top bar) with a light card pulled up over it (question, form) and a pinned CTA.
struct OnboardingStepView<Zone: View, Content: View>: View {
    let step: OnboardingStep
    let state: OnboardingState
    let canProceed: Bool
    var subtitle: String?
    /// The preview step carries its title in the zone and rows in the card.
    var showsCardTitle = true
    /// The registration step renders its own inline error.
    var showsGenericError = true
    var ctaTitle: String?
    let onNext: () -> Void
    @ViewBuilder let zone: () -> Zone
    @ViewBuilder let content: () -> Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showContent = false
    @State private var canProceedTrigger = false

    private var isEnabled: Bool {
        // `readyToComplete` / `isSubmitting` close the rapid-double-tap window on the preview CTA:
        // between "tap, nextStep() fires" and "onChange(readyToComplete) starts finishOnboarding",
        // the button stays tappable unless we block it here.
        canProceed && !state.isLoading && !state.readyToComplete && !state.isSubmitting
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            zone()
                .frame(maxWidth: .infinity)
                .padding(.top, DesignTokens.Spacing.md)
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Entry.cardRadius + DesignTokens.Spacing.sm)
                .background { EntryZoneBackground() }
                .environment(\.colorScheme, .dark)

            card
        }
        .dismissKeyboardOnTap()
        .onChange(of: canProceed) { oldValue, newValue in
            // Celebration haptic only on the false→true flip (CTA just unlocked)
            if !oldValue && newValue { canProceedTrigger.toggle() }
        }
        .task {
            guard !showContent else { return }
            if reduceMotion {
                showContent = true
            } else {
                await delayedAnimation(0.25) { showContent = true }
            }
        }
    }

    // MARK: - Card

    private var card: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                if showsCardTitle {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text(step.title)
                            .font(PulpeTypography.entryTitle)
                            .foregroundStyle(Color.textPrimary)
                            .accessibilityAddTraits(.isHeader)
                        if let subtitle {
                            Text(subtitle)
                                .font(PulpeTypography.onboardingSubtitle)
                                .foregroundStyle(Color.textSecondary)
                        }
                    }
                }

                content()
                    .blurSlide(showContent)

                if showsGenericError, let error = state.error {
                    ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                        state.error = nil
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.xl)
            .padding(.bottom, DesignTokens.Spacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) { cta }
        // The card's fill runs under the home indicator; a clip on the view would stop it
        // at the safe area and leave a forest strip at the bottom.
        .background {
            UnevenRoundedRectangle(
                topLeadingRadius: DesignTokens.Entry.cardRadius,
                topTrailingRadius: DesignTokens.Entry.cardRadius
            )
            .fill(Color.appBackground)
            .ignoresSafeArea(edges: .bottom)
        }
        .padding(.top, -DesignTokens.Entry.cardRadius)
    }

    private var cta: some View {
        Button {
            guard isEnabled else { return }
            onNext()
        } label: {
            if state.isLoading {
                ProgressView().tint(.white).accessibilityLabel("Chargement")
            } else {
                Text(ctaTitle ?? buttonTitle)
            }
        }
        .primaryButtonStyle(isEnabled: isEnabled)
        .sensoryFeedback(.success, trigger: canProceedTrigger)
        .accessibilityValue(isEnabled ? "" : "désactivé")
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.appBackground)
    }

    private var buttonTitle: String {
        switch step {
        case .registration: AppLocale.string("Créer mon compte")
        case .budgetPreview: budgetPreviewButtonTitle
        case .welcome: AppLocale.string("Commencer")
        default: AppLocale.string("Continuer")
        }
    }

    /// The user has just spent 5+ steps configuring their budget: "Créer mon budget" would read as if
    /// they hadn't done the work. The title confirms what actually happened, by health state.
    private var budgetPreviewButtonTitle: String {
        switch state.emotionState {
        case .comfortable: AppLocale.string("C'est parti")
        case .tight: AppLocale.string("Valider mon budget")
        case .deficit: AppLocale.string("Valider et affiner")
        }
    }
}

extension OnboardingStepView where Zone == EmptyView {
    init(
        step: OnboardingStep,
        state: OnboardingState,
        canProceed: Bool,
        subtitle: String? = nil,
        onNext: @escaping () -> Void,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.init(
            step: step, state: state, canProceed: canProceed, subtitle: subtitle,
            onNext: onNext, zone: { EmptyView() }, content: content
        )
    }
}

// MARK: - Currency Swap Sheet

struct OnboardingCurrencySwapSheet: View {
    @Bindable var state: OnboardingState
    @Environment(\.dismiss) private var dismiss
    @State private var draft: SupportedCurrency

    init(state: OnboardingState) {
        self._state = Bindable(state)
        self._draft = State(initialValue: state.currency)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            Text("Choisis ta devise")
                .font(PulpeTypography.title3)

            Text(
                """
                On l'utilisera pour afficher tous tes montants. \
                Tu peux la changer à tout moment dans tes paramètres.
                """
            )
            .font(PulpeTypography.body)
            .foregroundStyle(Color.onSurfaceVariant)
            .fixedSize(horizontal: false, vertical: true)

            SegmentedPicker(selection: $draft, title: nil) { currency in
                Text("\(currency.flag) \(currency.rawValue)")
            }

            Button {
                state.selectCurrency(draft)
                dismiss()
            } label: {
                Text("Utiliser \(draft.nativeName)")
            }
            .primaryButtonStyle(isEnabled: true)
        }
        .padding(DesignTokens.Spacing.xxl)
        .intrinsicSheetPresentation()
    }
}
