import SwiftUI

/// Reusable suggestion chip grid for onboarding steps.
/// Used by ChargesStep and SavingsStep — extracted to avoid duplication.
///
/// Visual language aligned with `CapsulePicker`: warm `surfaceContainerLow` card with
/// hairline stroke when unselected, `primaryContainer` tint with accent stroke + checkmark
/// when selected. Two-line layout (name / amount) prevents mid-word truncation.
struct OnboardingSuggestionGrid: View {
    let suggestions: [OnboardingTransaction]
    let state: OnboardingState
    let accentColor: Color
    @Binding var toggleTrigger: Bool

    var body: some View {
        OnboardingSectionHeader(title: "Suggestions", icon: "lightbulb.fill") {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 160), spacing: DesignTokens.Spacing.sm)],
                spacing: DesignTokens.Spacing.sm
            ) {
                ForEach(suggestions, id: \.name) { suggestion in
                    SuggestionChip(
                        suggestion: suggestion,
                        isSelected: state.isSuggestionSelected(suggestion),
                        accentColor: accentColor,
                        currency: state.currency
                    ) {
                        withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                            state.toggleSuggestion(suggestion)
                        }
                        toggleTrigger.toggle()
                    }
                }
            }
            .sensoryFeedback(.selection, trigger: toggleTrigger)
        }
    }
}

// MARK: - Chip

private struct SuggestionChip: View {
    let suggestion: OnboardingTransaction
    let isSelected: Bool
    let accentColor: Color
    let currency: SupportedCurrency
    let action: () -> Void

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
    }

    private var nameColor: Color {
        isSelected ? Color.onPrimaryContainer : Color.textPrimary
    }

    private var amountColor: Color {
        isSelected ? Color.onPrimaryContainer.opacity(0.78) : Color.textSecondary
    }

    private var strokeColor: Color {
        isSelected
            ? accentColor.opacity(0.35)
            : Color.onSurfaceVariant.opacity(0.22)
    }

    var body: some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: DesignTokens.Spacing.sm) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(suggestion.name)
                        .font(PulpeTypography.labelLarge)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .foregroundStyle(nameColor)
                    Text(suggestion.amount.asCompactCurrency(currency))
                        .font(PulpeTypography.caption)
                        .monospacedDigit()
                        .foregroundStyle(amountColor)
                }
                Spacer(minLength: DesignTokens.Spacing.xs)
                selectionIndicator
            }
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, DesignTokens.Spacing.sm + 2)
            .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
            .background(
                shape.fill(isSelected ? Color.primaryContainer : Color.surfaceContainerLow)
            )
            .overlay(
                shape.strokeBorder(strokeColor, lineWidth: DesignTokens.BorderWidth.thin)
            )
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(shape)
        .plainPressedButtonStyle()
        .animation(.snappy(duration: DesignTokens.Animation.fast), value: isSelected)
        .accessibilityLabel("\(suggestion.name), \(suggestion.amount.asCompactCurrency(currency))")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    @ViewBuilder
    private var selectionIndicator: some View {
        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(
                isSelected ? accentColor : Color.onSurfaceVariant.opacity(0.35)
            )
            .symbolRenderingMode(.hierarchical)
            .contentTransition(.symbolEffect(.replace))
            .accessibilityHidden(true)
    }
}
