import SwiftUI

struct WelcomeStep: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showLogin = false
    @State private var isAppeared = false
    @Bindable var state: OnboardingState

    /// Computed, not `static let`: a stored constant would freeze the language the app
    /// happened to be in when the type was first touched.
    private static var consentMarkdown: AttributedString {
        AppURLs.legalDisclosure(for: .welcome)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                header
                illustration
                    .frame(maxWidth: .infinity)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("Ton mois, prévu d'avance.")
                        .font(PulpeTypography.brandTitle)
                        .foregroundStyle(Color.heroInk)
                        .accessibilityAddTraits(.isHeader)
                    Text("Ton budget est prêt en 2 minutes")
                        .font(PulpeTypography.onboardingSubtitle)
                        .foregroundStyle(Color.heroInkSecondary)
                }
                .opacity(isAppeared ? 1 : 0)
                .offset(y: isAppeared ? 0 : 20)
                .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring.delay(0.15), value: isAppeared)

                actions
                    .opacity(isAppeared ? 1 : 0)
                    .offset(y: isAppeared ? 0 : 10)
                    .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring.delay(0.3), value: isAppeared)
            }
            .padding(.horizontal, DesignTokens.Spacing.xxl)
            .padding(.vertical, DesignTokens.Spacing.lg)
            .frame(maxWidth: DesignTokens.Entry.columnMaxWidth)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background { EntryZoneBackground() }
        .environment(\.colorScheme, .dark)
        .trackScreen("Onboarding_Welcome")
        .task {
            // Idempotency guard lives on `OnboardingState`, not on this view: the
            // parent `OnboardingFlow` tears down and recreates `WelcomeStep` on any
            // back-nav via `.id(state.currentStep)`. A local `@State` guard would
            // reset between firstName → Retour → Welcome and re-fire the funnel event.
            guard !state.hasEmittedWelcomeViewed else { return }
            state.hasEmittedWelcomeViewed = true
            AnalyticsService.shared.capture(.welcomeViewed)
        }
        .sheet(isPresented: $showLogin) {
            LoginView(isPresented: $showLogin)
        }
        .task {
            if reduceMotion {
                isAppeared = true
            } else {
                withAnimation(DesignTokens.Animation.entranceSpring.delay(0.1)) {
                    isAppeared = true
                }
            }
        }
    }

    private var header: some View {
        Text("pulpe")
            .font(PulpeTypography.sectionTitle)
            .foregroundStyle(Color.heroInk)
            .accessibilityLabel("Pulpe")
    }

    /// Decorative: the brand wedge as a mascot, rising in with the rest of the screen.
    private var illustration: some View {
        WelcomeMascotHero(isShown: isAppeared)
            .padding(.vertical, DesignTokens.Spacing.xl)
    }

    private var actions: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            // Social login: the primary path
            SocialLoginSection(
                onAuthenticated: { user, persistError in
                    state.applySocialSignup(user, persistError: persistError)
                },
                onForest: true
            )

            SocialLoginDivider(onForest: true)

            Button("S'inscrire avec email") { state.nextStep() }
                .buttonStyle(ForestTintButtonStyle())

            Button("J'ai déjà un compte") { showLogin = true }
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.heroAccentPositive)
                .textLinkButtonStyle()
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Rectangle())
                .accessibilityIdentifier("existingAccountButton")

            // Implicit consent covers all auth methods
            OnboardingConsentText(attributed: Self.consentMarkdown, onForest: true)
        }
    }
}

/// The welcome's hero: the brand wedge scales up as the screen appears, then idles with a
/// slow float while a few sparkles twinkle out of step. Reduce Motion keeps all of it still.
private struct WelcomeMascotHero: View {
    let isShown: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        mascot
            .overlay { sparkles }
            .scaleEffect(isShown || reduceMotion ? 1 : DesignTokens.Entry.mascotEntranceScale)
            .opacity(isShown ? 1 : 0)
            .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring, value: isShown)
    }

    @ViewBuilder
    private var mascot: some View {
        let image = Image("WelcomeMascot")
            .resizable()
            .scaledToFit()
            .frame(width: DesignTokens.Entry.mascotWidth)
        if reduceMotion {
            image
        } else {
            image.phaseAnimator([false, true]) { content, isUp in
                content.offset(y: isUp ? -DesignTokens.Entry.mascotFloat : 0)
            } animation: { _ in
                .easeInOut(duration: DesignTokens.Animation.heroBreathingDuration)
            }
        }
    }

    /// Placed around the wedge's edge, never over its face.
    private var sparkles: some View {
        ZStack {
            sparkle(0, isDot: false).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .offset(x: DesignTokens.Spacing.xxxl, y: -DesignTokens.Spacing.lg)
            sparkle(1, isDot: true).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .offset(x: -DesignTokens.Spacing.sectionGap, y: -DesignTokens.Spacing.md)
            sparkle(2, isDot: false).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .offset(x: -DesignTokens.Spacing.sm, y: -DesignTokens.Spacing.xxl)
            sparkle(3, isDot: true).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .offset(x: -DesignTokens.Spacing.xl, y: -DesignTokens.Spacing.sectionGap)
            sparkle(4, isDot: false).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .offset(x: DesignTokens.Spacing.md, y: DesignTokens.Spacing.sm)
            sparkle(5, isDot: true).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .offset(x: DesignTokens.Spacing.sm, y: DesignTokens.Spacing.md)
        }
    }

    @ViewBuilder
    private func sparkle(_ index: Int, isDot: Bool) -> some View {
        let mark = Group {
            if isDot {
                Circle()
                    .fill(Color.heroAccentPositive)
                    .frame(width: DesignTokens.Entry.sparkleDot, height: DesignTokens.Entry.sparkleDot)
            } else {
                Image(systemName: "sparkle")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(Color.heroInk)
                    .frame(width: DesignTokens.Entry.sparkleSize, height: DesignTokens.Entry.sparkleSize)
            }
        }
        if reduceMotion {
            mark
        } else {
            mark.phaseAnimator([true, false]) { content, isBright in
                content
                    .opacity(isBright ? 1 : DesignTokens.Opacity.strong)
                    .scaleEffect(isBright ? 1 : DesignTokens.Entry.twinkleScale)
            } animation: { _ in
                DesignTokens.Animation.twinkle(index)
            }
        }
    }
}

/// Translucent white capsule on the forest (V2 `btn.tint`).
private struct ForestTintButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(PulpeTypography.buttonPrimary)
            .foregroundStyle(Color.heroInk)
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(Color.heroTile, in: Capsule())
            .contentShape(Capsule())
            .opacity(configuration.isPressed ? DesignTokens.Opacity.pressed : 1)
    }
}

#Preview {
    WelcomeStep(state: OnboardingState())
        .environment(AppState())
}
