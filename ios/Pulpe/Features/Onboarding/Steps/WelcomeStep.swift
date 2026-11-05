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
        HStack(spacing: DesignTokens.Spacing.sm) {
            PulpeIcon(size: DesignTokens.IconSize.compact)
            Text("pulpe")
                .font(PulpeTypography.sectionTitle)
                .foregroundStyle(Color.heroInk)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pulpe")
    }

    /// Decorative: a sample month as the ring, with three stickers that say what the app does.
    /// The stickers sit around the ring, never over the figure in its middle.
    private var illustration: some View {
        let month = Formatters.monthNameInText(for: Calendar.current.component(.month, from: .now))
        return OnboardingBudgetRing(
            income: 6200, charges: 3021.5, savings: 588, currency: .chf,
            subtitle: "\(SupportedCurrency.chf.rawValue) · \(month)"
        )
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.xxxl)
            .frame(maxWidth: .infinity)
            .overlay(alignment: .topLeading) {
                OnboardingSticker(systemImage: "house", tint: .financialExpense, wash: .overWash) {
                    Text("Loyer").font(PulpeTypography.caption2).foregroundStyle(Color.textSecondary)
                    Text(Decimal(1850).asAmount(for: .chf)).font(PulpeTypography.metricLabelBold)
                }
                .rotationEffect(.degrees(DesignTokens.Entry.stickerTiltTopLeading))
            }
            .overlay(alignment: .bottomTrailing) {
                OnboardingSticker(systemImage: "checkmark", tint: .white, wash: .pulpePrimary) {
                    HStack(spacing: DesignTokens.Spacing.md) {
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
                            Text(verbatim: "Migros").font(PulpeTypography.metricLabelBold)
                            Text("pointé").font(PulpeTypography.caption2).foregroundStyle(Color.textSecondary)
                        }
                        Text((Decimal(8430) / 100).asAmount(for: .chf)).font(PulpeTypography.metricLabelBold)
                    }
                }
                .rotationEffect(.degrees(DesignTokens.Entry.stickerTiltTrailing))
                .offset(y: -DesignTokens.Spacing.xl)
            }
            .overlay(alignment: .bottomLeading) {
                OnboardingSticker(systemImage: "lock", tint: .accentInk, wash: .accentWash) {
                    Text("Montants chiffrés").font(PulpeTypography.metricLabelBold)
                }
                .rotationEffect(.degrees(DesignTokens.Entry.stickerTiltBottomLeading))
            }
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

/// Floating white card of the welcome illustration (V2 sticker): a tinted icon square, then
/// one or two lines. Light tokens inside, though the forest around it runs in dark mode.
private struct OnboardingSticker<Content: View>: View {
    let systemImage: String
    let tint: Color
    let wash: Color
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: systemImage)
                .font(PulpeTypography.caption2.weight(.bold))
                .foregroundStyle(tint)
                .frame(width: DesignTokens.Entry.stepBadge, height: DesignTokens.Entry.stepBadge)
                .background(wash, in: Circle())
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
                content
            }
            .foregroundStyle(Color.textPrimary)
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .background(Color.surface, in: .rect(cornerRadius: DesignTokens.Entry.stickerRadius))
        .shadow(DesignTokens.Shadow.elevated)
        .environment(\.colorScheme, .light)
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
