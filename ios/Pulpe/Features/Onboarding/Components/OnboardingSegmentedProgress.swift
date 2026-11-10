import SwiftUI

/// Segmented progress of the onboarding top bar: done = mint, now = white, to come = white 22%.
/// Takes the visible steps so the count matches what the user sees (social users skip two).
struct OnboardingSegmentedProgress: View {
    let currentStep: OnboardingStep
    let progressSteps: [OnboardingStep]

    private var position: Int { progressSteps.firstIndex(of: currentStep) ?? 0 }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            ForEach(Array(progressSteps.enumerated()), id: \.offset) { index, _ in
                RoundedRectangle(cornerRadius: DesignTokens.Entry.progressSegmentHeight / 2)
                    .fill(fill(for: index))
                    .frame(height: DesignTokens.Entry.progressSegmentHeight)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Étape \(position + 1) sur \(progressSteps.count), étape actuelle : \(currentStep.title)")
    }

    private func fill(for index: Int) -> Color {
        if index < position { return .heroAccentPositive }
        if index == position { return .heroInk }
        return Color.heroInk.opacity(DesignTokens.Opacity.outlinePill)
    }
}
