import SwiftUI

/// First-access intro for the Objectifs tab (V2 board « Objectif · intro »). One immersive
/// page: an example goal card (the real bar and tiles, mock figures) above a title, a
/// caption and the « Créer mon objectif » CTA. Shown once, gated by `SavingsGoalsIntroGate`.
///
/// `onComplete(createGoal:)` fires once: `true` from the CTA, `false` from « Plus tard ».
struct SavingsGoalsIntroCover: View {
    let currency: SupportedCurrency
    /// `true` → user tapped « Créer mon objectif »; `false` → « Plus tard ».
    let onComplete: (_ createGoal: Bool) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hasAppeared = false

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
            HStack {
                Spacer()
                Button("Plus tard") { skip() }
                    .sheetDismissLinkStyle()
                    .accessibilityHint("Ferme l'introduction")
            }

            IntroExampleGoalCard(currency: currency, filled: hasAppeared)
                .opacity(hasAppeared ? 1 : 0)
                .offset(y: hasAppeared || reduceMotion ? 0 : DesignTokens.Spacing.lg)
                .animation(entrance(step: 0), value: hasAppeared)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                Text("Ce projet, tu vas l'atteindre")
                    .font(PulpeTypography.onboardingTitle)
                    .foregroundStyle(Color.textPrimary)
                Text("""
                    Voyage, appart, coussin de sécurité… donne-lui un montant et une date. Je calcule ce \
                    qu'il faut mettre de côté chaque mois, et je te dis où tu en es.
                    """)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textSecondary)
            }
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityElement(children: .combine)
            .opacity(hasAppeared ? 1 : 0)
            .animation(entrance(step: 1), value: hasAppeared)

            Spacer(minLength: 0)

            Button("Créer mon objectif") {
                AnalyticsService.shared.capture(.savingsGoalsIntroCompleted)
                onComplete(true)
            }
            .primaryButtonStyle()
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.bottom, DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pulpeBackground()
        .trackScreen("SavingsGoals_Intro")
        .onAppear {
            AnalyticsService.shared.capture(.savingsGoalsIntroViewed)
            hasAppeared = true
        }
    }

    /// Reduce Motion keeps a short fade, never a hard cut.
    private func entrance(step: Int) -> SwiftUI.Animation {
        if reduceMotion { return .easeOut(duration: DesignTokens.Animation.fast) }
        return DesignTokens.Animation.entranceSpring.delay(Double(step) * DesignTokens.Animation.staggerStep)
    }

    private func skip() {
        AnalyticsService.shared.capture(.savingsGoalsIntroSkipped, properties: ["page": 0])
        onComplete(false)
    }
}

/// The example card: « Voyage » tagged « Exemple », 2'400.00 saved on 6'000.00, the bar
/// that fills once the page shows, and the two grey tiles of a real goal.
private struct IntroExampleGoalCard: View {
    let currency: SupportedCurrency
    let filled: Bool

    private let saved: Decimal = 2400
    private let target: Decimal = 6000
    private let monthly: Decimal = 400

    /// The deadline the figures imply: (6'000 − 2'400) / 400 = 9 months from now.
    private var deadline: String {
        let date = Calendar.current.date(byAdding: .month, value: 9, to: .now) ?? .now
        return Formatters.shortMonthYear.string(from: date)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            HStack(alignment: .firstTextBaseline) {
                Text("Voyage")
                    .font(PulpeTypography.cardTitle)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                GoalFactChip(label: AppLocale.string("Exemple"))
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                (Text(verbatim: saved.asAmount(for: currency))
                    .font(PulpeTypography.bigAmount)
                    + Text(verbatim: " \(currency.symbol)")
                    .font(PulpeTypography.bigCurrencySuffix))
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                Text("sur \(target.asAmount(for: currency))")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
            }

            GoalProgressTrack(fraction: filled ? 0.4 : 0)
                .frame(height: DesignTokens.ProgressBar.thickHeight)

            HeroMetricTileRow {
                GoalHeroTile(label: AppLocale.string("Requis par mois"), value: monthly.asAmount(for: currency))
                GoalHeroTile(label: AppLocale.string("Échéance"), value: deadline)
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(AppLocale.string("""
            Exemple d'objectif Voyage : \(saved.asCurrency(currency)) sur \(target.asCurrency(currency)), \
            \(monthly.asCurrency(currency)) par mois jusqu'en \(deadline)
            """))
    }
}

#Preview {
    Color.clear.fullScreenCover(isPresented: .constant(true)) {
        SavingsGoalsIntroCover(currency: .chf) { _ in }
    }
}
