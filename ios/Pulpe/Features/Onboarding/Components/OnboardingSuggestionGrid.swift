import SwiftUI

/// Reusable suggestion chip grid for onboarding steps.
/// Used by ChargesStep and SavingsStep — extracted to avoid duplication.
struct OnboardingSuggestionGrid: View {
    let suggestions: [OnboardingTransaction]
    let state: OnboardingState
    let accentColor: Color
    @Binding var toggleTrigger: Bool

    var body: some View {
        OnboardingSectionHeader(title: "Suggestions", icon: "lightbulb.fill") {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 155), spacing: DesignTokens.Spacing.sm)],
                spacing: DesignTokens.Spacing.sm
            ) {
                ForEach(suggestions, id: \.name) { suggestion in
                    let isSelected = state.isSuggestionSelected(suggestion)
                    Button {
                        withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                            state.toggleSuggestion(suggestion)
                        }
                        toggleTrigger.toggle()
                    } label: {
                        HStack(spacing: DesignTokens.Spacing.xs) {
                            Text(suggestion.name)
                                .lineLimit(1)
                            Text(suggestion.amount.asCompactCHF)
                                .foregroundStyle(
                                    isSelected ? Color.onPrimaryContainer : Color.onSurfaceVariant
                                )
                        }
                        .font(PulpeTypography.labelMedium)
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(isSelected ? Color.primaryContainer : Color.surfaceContainer)
                        .foregroundStyle(isSelected ? Color.onPrimaryContainer : Color.textPrimary)
                        .overlay {
                            Capsule()
                                .strokeBorder(
                                    isSelected ? accentColor : Color.clear,
                                    lineWidth: DesignTokens.BorderWidth.thin
                                )
                        }
                        .clipShape(Capsule())
                    }
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .contentShape(Capsule())
                    .plainPressedButtonStyle()
                    .accessibilityLabel("\(suggestion.name), \(suggestion.amount.asCompactCHF)")
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
            .sensoryFeedback(.selection, trigger: toggleTrigger)
        }
    }
}
