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
        VStack(spacing: DesignTokens.Spacing.lg) {
            HStack {
                Spacer()
                if step.next != nil {
                    Button("Plus tard") { finish(.skipped(step)) }
                        .sheetDismissLinkStyle()
                        .accessibilityHint("Ferme l'explication")
                }
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)

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
                .padding(.vertical, DesignTokens.Spacing.xs)
            }
            .scrollBounceBehavior(.basedOnSize)

            VStack(spacing: DesignTokens.Spacing.lg) {
                StepDots(current: step)
                Button(actionTitle) { primaryTapped() }
                    .primaryButtonStyle()
                    .accessibilityIdentifier("netWorthIntroPrimary")
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.bottom, DesignTokens.Spacing.lg)
        .animation(DesignTokens.Animation.stepTransition, value: step)
        .standardSheetPresentation()
        .trackScreen("NetWorth_Intro")
        .onAppear { AnalyticsService.shared.capture(.netWorthIntroViewed, properties: ["source": source.rawValue]) }
        // A swipe down, or any dismissal the buttons did not cause, ends the intro as skipped.
        .onDisappear { finish(.skipped(step)) }
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
            "Une valeur change ? Tu la mets à jour. Et quand tu mets de l'argent de côté dans ton budget, je te propose de l'ajouter ici."
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

/// Three dots, the current one stretched into a pill.
private struct StepDots: View {
    let current: NetWorthIntroStep

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            ForEach(NetWorthIntroStep.allCases, id: \.self) { step in
                Capsule()
                    .fill(step == current ? Color.pulpePrimary : Color.outlineVariant)
                    .frame(
                        width: step == current ? DesignTokens.Spacing.xl : DesignTokens.Spacing.sm,
                        height: DesignTokens.Spacing.sm
                    )
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(AppLocale.string("Étape \(current.rawValue + 1) sur \(NetWorthIntroStep.allCases.count)"))
    }
}

#Preview {
    Color.clear.sheet(isPresented: .constant(true)) {
        NetWorthIntroSheet(source: .auto, isEmpty: false, currency: .chf) { _ in }
    }
}
