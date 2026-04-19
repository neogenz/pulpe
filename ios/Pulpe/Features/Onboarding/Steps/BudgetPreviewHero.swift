import SwiftUI

/// Peak-moment header of the onboarding budget preview: glyph, animated amount
/// and subtitle. Owns its count-up state locally; the parent only passes the
/// phase that gates the reveal.
struct BudgetPreviewHero: View {
    let state: OnboardingState
    let emotionState: BudgetFormulas.EmotionState
    let phase: BudgetPreviewRevealPhase

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Animated value for the hero amount count-up. Starts at 0 and
    /// interpolates to the real `availableToSpend` as soon as `phase` reaches
    /// `.heroShown`. `.contentTransition(.numericText())` morphs the digits.
    @State private var displayAmount: Decimal = 0

    private var isRevealed: Bool { phase >= .heroShown }

    /// Canonical brand color for the emotion state. SOT is `EmotionState+UI`.
    private var heroAccentColor: Color { emotionState.color }

    /// Outlined SF Symbol per state — "prefer checkmarks over crosses",
    /// no filled icons. `equal` reads "balanced but tight"; `arrow.up.arrow.down`
    /// reads "to reconcile" without alarmist red vocabulary.
    private var heroGlyphName: String {
        switch emotionState {
        case .comfortable: "checkmark.circle"
        case .tight: "equal.circle"
        case .deficit: "arrow.up.arrow.down.circle"
        }
    }

    private var heroSubtitleText: String {
        switch emotionState {
        case .comfortable: "disponible à dépenser"
        case .tight: "disponible, mais serré"
        case .deficit: "à combler"
        }
    }

    /// Accessibility prefix — explicit health state for VoiceOver, which
    /// otherwise has no way to infer the chromatic signal.
    private var heroAccessibilityPrefix: String {
        switch emotionState {
        case .comfortable: "Disponible à dépenser"
        case .tight: "Disponible mais serré"
        case .deficit: "À combler"
        }
    }

    /// Animated hero amount — reads `displayAmount` so the digits roll from
    /// zero to the target via `.contentTransition(.numericText())`.
    private var heroAmountText: String {
        displayAmount.magnitude.asCompactCurrency(state.currency)
    }

    /// Final amount used for VoiceOver so it doesn't read every frame of the
    /// count-up animation.
    private var finalHeroAmountText: String {
        state.availableToSpend.magnitude.asCompactCurrency(state.currency)
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            // Peak-moment glyph — outlined per brand iconography, distinct per state.
            // The generic AI-slop "glyph inside a tinted circle badge" has been
            // dropped: the glyph stands alone at size, letting the emotion-zone
            // color tint from `OnboardingFlow` provide the surrounding wash.
            Image(systemName: heroGlyphName)
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(heroAccentColor)
                .symbolEffect(.bounce, value: isRevealed)
                .contentTransition(.symbolEffect(.replace))
                .scaleEffect(isRevealed ? 1 : 0.3)
                .opacity(isRevealed ? 1 : 0)

            Text(heroAmountText)
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .foregroundStyle(heroAccentColor)
                .contentTransition(.numericText())

            Text(heroSubtitleText)
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
        .padding(.vertical, DesignTokens.Spacing.xl)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            amountsHidden
                ? "\(heroAccessibilityPrefix) : montant masqué"
                : "\(heroAccessibilityPrefix) : \(finalHeroAmountText)"
        )
        .opacity(isRevealed ? 1 : 0)
        .offset(y: isRevealed ? 0 : 10)
        .onChange(of: isRevealed) { _, newValue in
            guard newValue else { return }
            startCountUp()
        }
    }

    /// Drive the count-up. Split out of body per SwiftUI refactor guideline
    /// "extract actions and side effects out of `body`".
    private func startCountUp() {
        if reduceMotion {
            displayAmount = state.availableToSpend
        } else {
            withAnimation(.smooth(duration: 0.7)) {
                displayAmount = state.availableToSpend
            }
        }
    }
}
