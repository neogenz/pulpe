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
    /// The keyboard leaves room for the zone or for the form, not both: while it is up the zone
    /// folds to one line so the field, its label and the CTA stay readable.
    @State private var isKeyboardUp = false
    @State private var isShortScreen = false
    @State private var cardViewportHeight: CGFloat = 0

    /// The ring steps fold their zone on a short screen too: the ring and the form don't both fit.
    private var showsCompactZone: Bool {
        isKeyboardUp || (isShortScreen && [.income, .charges, .savings].contains(step))
    }

    private var isEnabled: Bool {
        // `readyToComplete` / `isSubmitting` close the rapid-double-tap window on the preview CTA:
        // between "tap, nextStep() fires" and "onChange(readyToComplete) starts finishOnboarding",
        // the button stays tappable unless we block it here.
        canProceed && !state.isLoading && !state.readyToComplete && !state.isSubmitting
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            // A ZStack, not a Group: a Group hands its modifiers to each child, so an empty
            // compact zone would drop the padding and pull the card over the top bar.
            ZStack {
                if showsCompactZone { compactZone } else { zone() }
            }
                .frame(maxWidth: .infinity)
                // The card's inset and column: the greeting and the card title share one left edge.
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .frame(maxWidth: DesignTokens.Entry.columnMaxWidth)
                .frame(maxWidth: .infinity)
                .padding(.top, DesignTokens.Spacing.md)
                .padding(.bottom, DesignTokens.Entry.cardRadius + DesignTokens.Spacing.sm)
                .background { EntryZoneBackground() }
                .environment(\.colorScheme, .dark)

            card
        }
        .dismissKeyboardOnTap()
        .onGeometryChange(for: Bool.self) { $0.size.height < DesignTokens.Entry.ringZoneMinHeight } action: {
            isShortScreen = $0
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            setKeyboardUp(true)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            setKeyboardUp(false)
        }
        .onChange(of: canProceed) { oldValue, newValue in
            // Celebration haptic only on the false→true flip (CTA just unlocked)
            if !oldValue && newValue { canProceedTrigger.toggle() }
        }
        .task {
            guard !showContent else { return }
            // No delay: the step already slides in, and its field must be usable as it lands.
            withAnimation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut) { showContent = true }
        }
    }

    private func setKeyboardUp(_ isUp: Bool) {
        guard isUp != isKeyboardUp else { return }
        withAnimation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseInOut) { isKeyboardUp = isUp }
    }

    // MARK: - Compact Zone

    /// What the ring says, on one line, for the steps whose input moves it; the other steps
    /// keep only the zone's margin above the card.
    @ViewBuilder
    private var compactZone: some View {
        switch step {
        case .income, .charges, .savings:
            let available = state.availableToSpend
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                Text(available < 0 ? AppLocale.string("Il manque") : AppLocale.string("Disponible"))
                    .font(PulpeTypography.detailLabel)
                    .foregroundStyle(Color.heroInk.opacity(DesignTokens.Opacity.overlay))
                Text(available.magnitude.asCurrency(state.currency))
                    .font(PulpeTypography.rowAmount)
                    .foregroundStyle(Color.heroInk)
                    .contentTransition(.numericText())
            }
            .accessibilityElement(children: .combine)
        case .firstName:
            // The greeting is this step's answer: it stays, on one line.
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xs) {
                Text("Enchanté,")
                    .font(PulpeTypography.detailLabel)
                    .foregroundStyle(Color.heroAccentPositive)
                Text(FirstNameResolver.normalized(state.firstName) ?? AppLocale.string("toi"))
                    .font(PulpeTypography.rowAmount)
                    .foregroundStyle(Color.heroInk)
                    .lineLimit(1)
            }
            .accessibilityElement(children: .combine)
        default:
            EmptyView()
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
                    .blurSlide(
                        showContent,
                        blur: DesignTokens.Animation.stepContentBlur,
                        rise: DesignTokens.Animation.stepContentRise
                    )

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
            .frame(maxWidth: DesignTokens.Entry.columnMaxWidth)
            // As tall as the card's visible part, so a tap anywhere on its empty area lands
            // on the tap catcher: the scroll view sits over the step's own one.
            .frame(maxWidth: .infinity, minHeight: cardViewportHeight, alignment: .top)
            .dismissKeyboardOnTap()
        }
        .onScrollGeometryChange(for: CGFloat.self) { geometry in
            geometry.containerSize.height - geometry.contentInsets.top - geometry.contentInsets.bottom
        } action: { _, height in
            cardViewportHeight = max(0, height)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) { cta }
        // The card's fill runs under the home indicator and the side insets (the open iPhone
        // Duo's status column); a clip on the view would stop it at the safe area and leave a
        // forest strip with the zone's hard bottom edge showing.
        .background {
            UnevenRoundedRectangle(
                topLeadingRadius: DesignTokens.Entry.cardRadius,
                topTrailingRadius: DesignTokens.Entry.cardRadius
            )
            .fill(Color.appBackground)
            .ignoresSafeArea(edges: [.bottom, .horizontal])
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
        // A request in flight keeps the solid fill: its white spinner would vanish on the
        // disabled tint, and the CTA would flash pale then green again before the step slides.
        .primaryButtonStyle(isEnabled: isEnabled || state.isLoading)
        .sensoryFeedback(.success, trigger: canProceedTrigger)
        .accessibilityValue(isEnabled ? "" : "désactivé")
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .frame(maxWidth: DesignTokens.Entry.columnMaxWidth)
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.md)
        // The rows fade out above the CTA instead of being sliced by its edge, so the card
        // reads as going on under it.
        .background(Color.appBackground)
        .overlay(alignment: .top) {
            LinearGradient(
                colors: [Color.appBackground.opacity(0), Color.appBackground],
                startPoint: .top,
                endPoint: .bottom
            )
                .frame(height: DesignTokens.Spacing.lg)
                .offset(y: -DesignTokens.Spacing.lg)
                .allowsHitTesting(false)
        }
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
        case .tight, .deficit: AppLocale.string("Valider mon budget")
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
