import SwiftUI

/// One page of the Objectifs first-run intro (PUL-12). Restrained visual —
/// authenticated context, so no brand glow (DESIGN.md Glass Restraint Rule):
/// an SF Symbol hero + title + one-line body, with a staggered entrance that
/// respects Reduce Motion (it keeps a short opacity fade, never a hard cut).
struct SavingsGoalsIntroPage: Identifiable {
    let id: Int
    let symbol: String
    let title: String
    let message: String
}

struct SavingsGoalsIntroPageView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let page: SavingsGoalsIntroPage
    /// The parent flips this true when the page becomes the selected one, so the
    /// entrance plays on first reveal rather than while pre-rendered off-screen.
    let isActive: Bool

    @State private var hasAppeared = false

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: page.symbol)
                .font(PulpeTypography.emojiDisplay)
                .foregroundStyle(Color.pulpePrimary)
                .symbolEffect(.bounce, value: hasAppeared)
                .opacity(hasAppeared ? 1 : 0)
                .scaleEffect(hasAppeared ? 1 : 0.8) // never scale(0) — a shape stays visible
                .animation(entrance(delayIndex: 0), value: hasAppeared)

            Text(page.title)
                .font(PulpeTypography.stepTitle)
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)
                .opacity(hasAppeared ? 1 : 0)
                .offset(y: hasAppeared ? 0 : entranceOffset)
                .animation(entrance(delayIndex: 1), value: hasAppeared)

            Text(page.message)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textTertiary)
                .multilineTextAlignment(.center)
                .opacity(hasAppeared ? 1 : 0)
                .offset(y: hasAppeared ? 0 : entranceOffset)
                .animation(entrance(delayIndex: 2), value: hasAppeared)
        }
        .padding(.horizontal, DesignTokens.Spacing.xxxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(page.title). \(page.message)")
        .onChange(of: isActive, initial: true) { _, active in
            if active { hasAppeared = true }
        }
    }

    // Reduce Motion → drop the offset/spring but keep a short opacity fade
    // (reduced motion means gentler, not none — Apple HIG).
    private var entranceOffset: CGFloat {
        reduceMotion ? 0 : DesignTokens.Spacing.lg
    }

    private func entrance(delayIndex: Int) -> SwiftUI.Animation {
        if reduceMotion {
            return .easeOut(duration: DesignTokens.Animation.fast)
        }
        return DesignTokens.Animation.entranceSpring
            .delay(Double(delayIndex) * DesignTokens.Animation.staggerStep)
    }
}

#Preview {
    SavingsGoalsIntroPageView(
        page: SavingsGoalsIntroPage(
            id: 0,
            symbol: "target",
            title: "Donne un cap à ton épargne",
            message: "Suis tes projets long terme — voyage, apport, matelas — sans recalculer à la main."
        ),
        isActive: true
    )
    .pulpeBackground()
}
