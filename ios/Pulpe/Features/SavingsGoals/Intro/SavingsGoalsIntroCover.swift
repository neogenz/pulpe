import SwiftUI

/// First-access intro for the Objectifs tab (PUL-12). A 2-page immersive
/// `fullScreenCover` — DESIGN.md reserves `.fullScreenCover` for immersive
/// flows (auth, onboarding). Page 1 = why goals exist, page 2 = how Pulpe
/// derives the monthly rhythm. Shown once, gated by `SavingsGoalsIntroGate`.
/// The advanced surfaces (plan simulator, linking a saving forecast) are
/// deliberately taught in context later, not here — they aren't usable until a
/// goal exists.
///
/// `onComplete(createGoal:)` fires once: `true` when the final CTA is tapped,
/// `false` on any skip. The page swipe is native `.page` paging, so it stays
/// interruptible without custom gesture code.
struct SavingsGoalsIntroCover: View {
    /// `true` → user tapped the final "Créer mon objectif"; `false` → skipped.
    let onComplete: (_ createGoal: Bool) -> Void

    @State private var selection = 0

    private let pages: [SavingsGoalsIntroPage] = [
        SavingsGoalsIntroPage(
            id: 0,
            symbol: "target",
            title: "Donne un cap à ton épargne",
            message: "Suis tes projets long terme — voyage, apport, matelas — sans recalculer à la main."
        ),
        SavingsGoalsIntroPage(
            id: 1,
            symbol: "chart.line.uptrend.xyaxis",
            title: "Pulpe calcule ton rythme",
            message: "À partir de ta cible et de ton échéance, Pulpe répartit le montant mois par mois — et tu l'ajustes quand tu veux."
        ),
    ]

    private var isLastPage: Bool { selection >= pages.count - 1 }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            skipRow

            TabView(selection: $selection) {
                ForEach(Array(pages.enumerated()), id: \.element.id) { index, page in
                    SavingsGoalsIntroPageView(page: page, isActive: selection == index)
                        .tag(index)
                }
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
            ForEach(pages.indices, id: \.self) { index in
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
        .accessibilityLabel("Page \(selection + 1) sur \(pages.count)")
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
        SavingsGoalsIntroCover { _ in }
    }
}
