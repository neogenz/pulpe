import SwiftUI

/// First-access intro for the Objectifs tab (PUL-12). A 2-page immersive
/// `fullScreenCover` — DESIGN.md reserves `.fullScreenCover` for immersive
/// flows (auth, onboarding). It *shows* the feature: page 1 a real-looking goal
/// card, page 2 the actual month-by-month plan rows (mock data). Shown once,
/// gated by `SavingsGoalsIntroGate`. The advanced surfaces (plan simulator,
/// linking a saving forecast) are deliberately taught in context later, not
/// here — they aren't usable until a goal exists.
///
/// `onComplete(createGoal:)` fires once: `true` when the final CTA is tapped,
/// `false` on any skip. The page swipe is native `.page` paging, so it stays
/// interruptible without custom gesture code.
struct SavingsGoalsIntroCover: View {
    let currency: SupportedCurrency
    /// `true` → user tapped the final "Créer mon objectif"; `false` → skipped.
    let onComplete: (_ createGoal: Bool) -> Void

    @State private var selection = 0

    private let pageCount = 2

    private var isLastPage: Bool { selection >= pageCount - 1 }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            skipRow

            TabView(selection: $selection) {
                SavingsGoalsIntroPageView(
                    title: "Ce projet, tu vas l'atteindre",
                    caption: "Voyage, appart, coussin de sécurité… donne-lui un montant et une date. Pulpe garde le cap avec toi.",
                    isActive: selection == 0
                ) { active in IntroGoalCardPreview(currency: currency, animate: active) }
                    .tag(0)

                SavingsGoalsIntroPageView(
                    title: "Et tu sauras toujours où tu en es",
                    caption: "Chaque mois s'ajuste tout seul. Zéro calcul, zéro doute — juste ta progression qui monte.",
                    isActive: selection == 1
                ) { active in IntroPlanPreview(currency: currency, animate: active) }
                    .tag(1)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            pageIndicator

            primaryButtons
        }
        .padding(.bottom, DesignTokens.Spacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pulpeBackground()
        .trackScreen("SavingsGoals_Intro")
        .onAppear { AnalyticsService.shared.capture(.savingsGoalsIntroViewed) }
    }

    // MARK: - Chrome

    private var skipRow: some View {
        HStack {
            Spacer()
            if !isLastPage {
                Button("Passer") { skip() }
                    .font(PulpeTypography.buttonSecondary)
                    .foregroundStyle(Color.textTertiary)
                    .textLinkButtonStyle()
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .accessibilityLabel("Passer l'introduction")
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .frame(height: DesignTokens.TapTarget.minimum)
    }

    private var pageIndicator: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            ForEach(0..<pageCount, id: \.self) { index in
                Capsule()
                    .fill(index == selection ? Color.pulpePrimary : Color.secondary.opacity(0.2))
                    .frame(
                        width: index == selection ? DesignTokens.Spacing.lg : DesignTokens.Spacing.sm,
                        height: DesignTokens.Spacing.sm
                    )
            }
        }
        .animation(DesignTokens.Animation.stepTransition, value: selection)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Page \(selection + 1) sur \(pageCount)")
    }

    private var primaryButtons: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button(isLastPage ? "Créer mon objectif" : "Suivant") {
                if isLastPage {
                    AnalyticsService.shared.capture(.savingsGoalsIntroCompleted)
                    onComplete(true)
                } else {
                    withAnimation(DesignTokens.Animation.stepTransition) { selection += 1 }
                }
            }
            .primaryButtonStyle()

            if isLastPage {
                Button("Plus tard") { skip() }
                    .font(PulpeTypography.buttonSecondary)
                    .foregroundStyle(Color.textTertiary)
                    .textLinkButtonStyle()
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
    }

    private func skip() {
        AnalyticsService.shared.capture(
            .savingsGoalsIntroSkipped,
            properties: ["page": selection]
        )
        onComplete(false)
    }
}

#Preview {
    Color.clear.fullScreenCover(isPresented: .constant(true)) {
        SavingsGoalsIntroCover(currency: .chf) { _ in }
    }
}
