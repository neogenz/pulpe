import SwiftUI
import VariableBlur

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
    @Namespace private var bottomAnchor
    @State private var showContent = false
    @State private var isAtBottom = false
    @State private var contentOverflows = false
    @State private var keyboardHeight: CGFloat = 0
    /// Dedicated trigger for the CTA "unlocked" haptic — fires only on false→true flip.
    @State private var canProceedTrigger = false
    @State private var showCurrencySwap = false

    private var isKeyboardVisible: Bool { keyboardHeight > 0 }

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

                    // Full-width CTA at bottom of scroll content
                    fullWidthCTA
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .id(bottomAnchor)
                }
                .padding(.top, DesignTokens.Spacing.stepHeaderTop)
                .padding(.bottom, DesignTokens.Spacing.xxxl
                    + (isKeyboardVisible ? 80 + DesignTokens.FrameHeight.button + DesignTokens.Spacing.lg : 0)
                )
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
            // Floating ↓ button — stays within safe area
            .overlay(alignment: .bottomTrailing) {
                if (contentOverflows && !isAtBottom) || isKeyboardVisible {
                    floatingButton(proxy: proxy)
                        .padding(.trailing, DesignTokens.Spacing.xxl)
                        .padding(.bottom, DesignTokens.Spacing.lg)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
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

    // MARK: - Floating ↓ Button (Option C behavior)

    /// Keyboard open → dismiss keyboard
    /// Keyboard closed + not at bottom → scroll to CTA
    private func floatingButton(proxy: ScrollViewProxy) -> some View {
        Button {
            if isKeyboardVisible {
                UIApplication.shared.sendAction(
                    #selector(UIResponder.resignFirstResponder),
                    to: nil, from: nil, for: nil
                )
            } else {
                withAnimation(DesignTokens.Animation.defaultSpring) {
                    proxy.scrollTo(bottomAnchor, anchor: .bottom)
                }
            }
        } label: {
            Image(systemName: isKeyboardVisible ? "keyboard.chevron.compact.down" : "arrow.down")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textOnPrimary)
                .frame(width: DesignTokens.FrameHeight.button, height: DesignTokens.FrameHeight.button)
                .background(Color.onboardingGradient)
                .clipShape(Circle())
                .contentTransition(.symbolEffect(.replace))
        }
        .shadow(DesignTokens.Shadow.elevated)
        .contentShape(Circle())
        .accessibilityLabel(isKeyboardVisible ? "Fermer le clavier" : "Voir la suite")
    }

    // MARK: - Full-Width CTA (at bottom of scroll)

    private var fullWidthCTA: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Button(action: onNext) {
                if state.isLoading {
                    ProgressView()
                        .tint(.white)
                        .accessibilityLabel("Chargement")
                } else {
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        Text(buttonTitle)
                        if step != .registration && step != .budgetPreview {
                            Image(systemName: "arrow.right")
                                .font(PulpeTypography.labelLarge)
                        }
                    }
                }
            }
            .primaryButtonStyle(isEnabled: isEnabled)
            .disabled(!isEnabled)
            .scaleEffect(canProceed ? 1 : 0.98)
            .animation(reduceMotion ? .none : DesignTokens.Animation.bouncySpring, value: canProceed)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: isEnabled)
            .sensoryFeedback(.success, trigger: canProceedTrigger)
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
