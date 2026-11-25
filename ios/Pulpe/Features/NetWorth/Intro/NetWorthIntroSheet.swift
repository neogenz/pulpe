import SwiftUI

/// « Mon patrimoine » explainer: three pages, each an animated example card above a title and
/// a short text. Opens by itself on the first visit, then from the « ? » of the page.
///
/// `onFinish` fires once per opening with how it ended; the parent dismisses the sheet.
struct NetWorthIntroSheet: View {
    let source: NetWorthIntroSource
    let isEmpty: Bool
    let currency: SupportedCurrency
    let onFinish: (NetWorthIntroOutcome) -> Void

    @State private var step: NetWorthIntroStep = .overview
    @State private var completion = NetWorthIntroCompletion()

    private var action: NetWorthIntroAction { .primaryAction(step: step, isEmpty: isEmpty) }

    var body: some View {
        // In a navigation bar, « Plus tard » gets the system's place and margins, like every sheet's close button
        NavigationStack {
            content
                .background(Color.sheetBackground)
                .toolbar {
                    if step.next != nil {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Plus tard") { finish(.skipped(step)) }
                                .accessibilityHint("Ferme l'explication")
                        }
                    }
                }
                // The last page has no « Plus tard »: the bar keeps its height so the card does not jump up
                .toolbar(.visible, for: .navigationBar)
        }
        .standardSheetPresentation()
        .trackScreen("NetWorth_Intro")
        .onAppear { AnalyticsService.shared.capture(.netWorthIntroViewed, properties: ["source": source.rawValue]) }
        // A swipe down, or any dismissal the buttons did not cause, ends the intro as skipped.
        .onDisappear { finish(.skipped(step)) }
    }

    private var content: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    NetWorthIntroScene(step: step, currency: currency)
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                        Text(title)
                            .font(PulpeTypography.onboardingTitle)
                            .foregroundStyle(Color.textPrimary)
                            .accessibilityAddTraits(.isHeader)
                        Text(message)
                            .font(PulpeTypography.bodyLarge)
                            .foregroundStyle(Color.textSecondary)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xs)
            }
            .scrollBounceBehavior(.basedOnSize)

            VStack(spacing: DesignTokens.Spacing.lg) {
                StepDots(current: step.rawValue, total: NetWorthIntroStep.allCases.count)
                Button(actionTitle) { primaryTapped() }
                    .primaryButtonStyle()
                    .accessibilityIdentifier("netWorthIntroPrimary")
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.bottom, DesignTokens.Spacing.lg)
        .animation(DesignTokens.Animation.stepTransition, value: step)
    }

    private var title: LocalizedStringKey {
        switch step {
        case .overview: "Tout ton argent, au même endroit"
        case .netWorth: "Ta situation en un coup d'œil"
        case .update: "Garde-la à jour en un geste"
        }
    }

    private var message: LocalizedStringKey {
        switch step {
        case .overview:
            "Comptes, épargne, placements, mais aussi ta voiture ou ton appart : ajoute tout ce que tu possèdes."
        case .netWorth:
            // swiftlint:disable:next line_length
            "J'enlève ce que tu dois, crédit ou leasing. Il reste un chiffre : ta fortune nette, l'état réel de tes finances."
        case .update:
            // swiftlint:disable:next line_length
            "Une valeur change ? Tu la mets à jour. Et quand tu pointes de l'argent mis de côté dans ton budget, je l'ajoute ici."
        }
    }

    private var actionTitle: LocalizedStringKey {
        switch action {
        case .next: "Suivant"
        case .done: "Compris"
        case .add: "Ajouter mon premier compte"
        }
    }

    private func primaryTapped() {
        if action == .next, let next = step.next {
            step = next
        } else {
            finish(.completed(action))
        }
    }

    private func finish(_ outcome: NetWorthIntroOutcome) {
        guard let outcome = completion.finish(outcome) else { return }
        AnalyticsService.shared.capture(outcome.event, properties: outcome.properties(source: source))
        onFinish(outcome)
    }
}

#Preview {
    Color.clear.sheet(isPresented: .constant(true)) {
        NetWorthIntroSheet(source: .auto, isEmpty: false, currency: .chf) { _ in }
    }
}
