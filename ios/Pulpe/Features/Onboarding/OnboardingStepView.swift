import SwiftUI
import VariableBlur

private enum OnboardingStepScrollAnchor: Hashable {
    case cta
}

/// Label content swaps instantly while the outer capsule animates width — avoids overlapping “mid-morph” layouts.
private struct MorphingOnboardingCTALabel: View {
    let expanded: Bool
    let isKeyboardVisible: Bool
    let title: String
    let showTrailingChevron: Bool
    let isLoading: Bool

    private var fabSymbolName: String {
        isKeyboardVisible ? "keyboard.chevron.compact.down" : "arrow.down"
    }

    var body: some View {
        ZStack {
            if expanded {
                expandedInterior
            } else {
                Image(systemName: fabSymbolName)
                    .font(PulpeTypography.labelLarge)
                    .contentTransition(.symbolEffect(.replace))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentTransition(.identity)
        .animation(nil, value: expanded)
        .animation(nil, value: isLoading)
    }

    @ViewBuilder
    private var expandedInterior: some View {
        if isLoading {
            ProgressView()
                .tint(.white)
                .accessibilityLabel("Chargement")
        } else {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Spacer(minLength: 0)
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Text(title)
                    if showTrailingChevron {
                        Image(systemName: "arrow.right")
                            .font(PulpeTypography.labelLarge)
                    }
                }
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
        }
    }
}

/// Base scaffold used by every concrete onboarding step (firstName, income, …).
/// Owns the step header, error banner, full-width CTA and keyboard/scroll chrome.
struct OnboardingStepView<Content: View>: View {
    let step: OnboardingStep
    let state: OnboardingState
    let canProceed: Bool
    let onNext: () -> Void
    @ViewBuilder let content: () -> Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(FeatureFlagsStore.self) private var featureFlags
    @State private var showContent = false
    @State private var isAtBottom = false
    @State private var contentOverflows = false
    @State private var keyboardHeight: CGFloat = 0
    /// Dedicated trigger for the CTA "unlocked" haptic — fires only on false→true flip.
    @State private var canProceedTrigger = false
    @State private var showCurrencySwap = false

    private var isKeyboardVisible: Bool { keyboardHeight > 0 }

    /// Full-width primary CTA (Revolut-style) when the user reached the end of the scroll — keyboard up or down.
    private var useExpandedCTAChrome: Bool { isAtBottom || !contentOverflows }

    private var ctaOverlayBottomPadding: CGFloat {
        return DesignTokens.Spacing.lg
    }

    private var shouldShowCurrencyChip: Bool {
        featureFlags.isMultiCurrencyEnabled && [.charges, .savings, .budgetPreview].contains(step)
    }

    private var isEnabled: Bool {
        // `readyToComplete` / `isSubmitting` close the rapid-double-tap window on
        // the BudgetPreview CTA: between "tap → nextStep() fires → onChange(readyToComplete)
        // kicks off finishOnboarding", the button stays tappable unless we block it here.
        canProceed && !state.isLoading && !state.readyToComplete && !state.isSubmitting
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxxl) {
                    if shouldShowCurrencyChip {
                        HStack {
                            Spacer()
                            Button {
                                showCurrencySwap = true
                            } label: {
                                HStack(spacing: DesignTokens.Spacing.xxs) {
                                    Text(state.currency.compactLabel)
                                    Image(systemName: "chevron.down")
                                        .font(PulpeTypography.caption2)
                                }
                                .padding(.horizontal, DesignTokens.Spacing.md)
                                .padding(.vertical, DesignTokens.Spacing.xs)
                                .background(Color.surfaceContainerHigh)
                                .foregroundStyle(Color.onSurfaceVariant)
                                .clipShape(Capsule())
                            }
                            .frame(minHeight: DesignTokens.TapTarget.minimum)
                            .contentShape(Capsule())
                            .plainPressedButtonStyle()
                            .accessibilityLabel("Devise actuelle : \(state.currency.nativeName). Toucher pour changer.")
                        }
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                    }

                    OnboardingStepHeader(
                        step: step,
                        onSkip: step.isOptional ? onNext : nil
                    )

                    content()
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .blurSlide(showContent)

                    // Error banner
                    if let error = state.error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            state.error = nil
                        }
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }

                    // Scroll anchor only — primary CTA is pinned in overlay (morphs FAB ↔ full width).
                    Color.clear
                        .frame(height: DesignTokens.FrameHeight.button)
                        .id(OnboardingStepScrollAnchor.cta)
                }
                .padding(.top, DesignTokens.Spacing.stepHeaderTop)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            .onScrollGeometryChange(for: ScrollMetrics.self) { geometry in
                ScrollMetrics(
                    remaining: geometry.contentSize.height
                        - geometry.contentOffset.y - geometry.containerSize.height,
                    overflows: geometry.contentSize.height > geometry.containerSize.height + 40
                )
            } action: { _, metrics in
                let newAtBottom = metrics.remaining < 80
                let newOverflows = metrics.overflows
                guard newAtBottom != isAtBottom || newOverflows != contentOverflows else { return }
                withAnimation(DesignTokens.Animation.defaultSpring) {
                    isAtBottom = newAtBottom
                    contentOverflows = newOverflows
                }
            }
            // Bottom blur — ignoresSafeArea BEFORE frame so it extends past home indicator
            .overlay(alignment: .bottom) {
                if (contentOverflows && !isAtBottom) || isKeyboardVisible {
                    VariableBlurView(
                        maxBlurRadius: 8,
                        direction: .blurredBottomClearTop
                    )
                    .allowsHitTesting(false)
                    .ignoresSafeArea(edges: .bottom)
                    .frame(height: DesignTokens.Blur.bottomFadeHeight)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
            .overlay(alignment: .bottom) {
                onboardingMorphingCTA(proxy: proxy)
                    .padding(.bottom, ctaOverlayBottomPadding)
            }
        }
        .background(Color.clear)
        .sheet(isPresented: $showCurrencySwap) {
            OnboardingCurrencySwapSheet(state: state)
        }
        .dismissKeyboardOnTap()
        .onChange(of: canProceed) { oldValue, newValue in
            // Celebration haptic only on the false→true flip (CTA just unlocked)
            if !oldValue && newValue { canProceedTrigger.toggle() }
        }
        .onReceive(
            NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)
        ) { notification in
            let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect
            let height = frame?.height ?? 0
            withAnimation(DesignTokens.Animation.defaultSpring) {
                keyboardHeight = height
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(DesignTokens.Animation.defaultSpring) {
                keyboardHeight = 0
            }
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

    // MARK: - Morphing CTA (single control: frame animates circle ↔ full-width pill)

    private func onboardingMorphingCTA(proxy: ScrollViewProxy) -> some View {
        let expanded = useExpandedCTAChrome
        let buttonHeight = DesignTokens.FrameHeight.button
        let fabShadow = DesignTokens.Shadow.elevated
        return HStack(spacing: 0) {
            Spacer(minLength: 0)
            Button {
                morphingCTAAction(proxy: proxy)
            } label: {
                MorphingOnboardingCTALabel(
                    expanded: expanded,
                    isKeyboardVisible: isKeyboardVisible,
                    title: buttonTitle,
                    showTrailingChevron: step != .registration && step != .budgetPreview,
                    isLoading: state.isLoading
                )
                .font(PulpeTypography.buttonPrimary)
                .frame(height: buttonHeight)
                .frame(maxWidth: expanded ? .infinity : buttonHeight)
                .foregroundStyle(ctaForeground(expanded: expanded))
                .background(ctaBackground(expanded: expanded))
                .clipShape(Capsule())
                .overlay(ctaDisabledOutline(expanded: expanded))
                .scaleEffect(expanded && !canProceed ? 0.98 : 1)
                .shadow(
                    color: expanded ? .clear : fabShadow.color,
                    radius: expanded ? 0 : fabShadow.radius,
                    y: expanded ? 0 : fabShadow.y
                )
                .animation(reduceMotion ? .none : DesignTokens.Animation.bouncySpring, value: expanded && !canProceed)
            }
            .buttonStyle(.plain)
            .disabled(expanded && !isEnabled)
            .sensoryFeedback(.success, trigger: canProceedTrigger)
            .accessibilityLabel(ctaAccessibilityLabel(expanded: expanded))
            .animation(reduceMotion ? .none : DesignTokens.Animation.onboardingCTAMorph, value: expanded)
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
    }

    private func ctaAccessibilityLabel(expanded: Bool) -> String {
        if expanded, state.isLoading {
            return "Chargement"
        }
        if expanded {
            return buttonTitle
        }
        return isKeyboardVisible ? "Fermer le clavier" : "Voir la suite"
    }

    private func morphingCTAAction(proxy: ScrollViewProxy) {
        if useExpandedCTAChrome {
            onNext()
        } else if isKeyboardVisible {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil, from: nil, for: nil
            )
        } else {
            withAnimation(DesignTokens.Animation.onboardingCTAMorph) {
                proxy.scrollTo(OnboardingStepScrollAnchor.cta, anchor: .bottom)
            }
        }
    }

    private func ctaForeground(expanded: Bool) -> Color {
        if expanded, isEnabled {
            return Color.textOnPrimary
        }
        if expanded, !isEnabled {
            return Color.onSurfaceVariant
        }
        return Color.textOnPrimary
    }

    /// Matches `PrimaryButtonStyle`: enabled → gradient; disabled → soft primary tint only (no gradient underlay).
    @ViewBuilder
    private func ctaBackground(expanded: Bool) -> some View {
        if expanded, !isEnabled {
            Color.pulpePrimary.opacity(0.12)
        } else {
            Color.onboardingGradient
        }
    }

    @ViewBuilder
    private func ctaDisabledOutline(expanded: Bool) -> some View {
        if expanded, !isEnabled {
            Capsule()
                .strokeBorder(Color.pulpePrimary.opacity(0.2), lineWidth: DesignTokens.BorderWidth.thin)
        }
    }

    private var buttonTitle: String {
        switch step {
        case .registration: "Créer mon compte"
        case .budgetPreview: "Créer mon budget"
        case .welcome: "Commencer"
        default: "Continuer"
        }
    }
}

// MARK: - Scroll Metrics

struct ScrollMetrics: Equatable {
    let remaining: CGFloat
    let overflows: Bool
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
                Toutes tes prévisions seront affichées dans la nouvelle devise. \
                Tu peux changer plus tard depuis tes paramètres.
                """
            )
            .font(PulpeTypography.body)
            .foregroundStyle(Color.onSurfaceVariant)
            .fixedSize(horizontal: false, vertical: true)

            CapsulePicker(selection: $draft, title: "Devise") { currency, isSelected in
                HStack(spacing: DesignTokens.Spacing.xs) {
                    Text(currency.flag)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(currency.rawValue).font(PulpeTypography.labelLarge)
                        Text(currency.nativeName)
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(isSelected ? Color.textOnPrimaryMuted : Color.onSurfaceVariant)
                    }
                }
            }

            Button {
                state.currency = draft
                dismiss()
            } label: {
                Text("Utiliser \(draft.nativeName)")
            }
            .primaryButtonStyle(isEnabled: true)

            Spacer()
        }
        .padding(DesignTokens.Spacing.xxl)
        .standardSheetPresentation(detents: [.height(360)])
    }
}
