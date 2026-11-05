import SwiftUI

/// Suggestion chips of the charges and savings steps (V2): an outlined chip carries its amount;
/// the chosen one turns green with a check and drops the amount.
struct OnboardingSuggestionGrid: View {
    let suggestions: [OnboardingTransaction]
    let state: OnboardingState
    @Binding var toggleTrigger: Bool

    var body: some View {
        OnboardingSectionHeader(title: AppLocale.string("Suggestions")) {
            ChipFlowLayout {
                ForEach(suggestions, id: \.id) { suggestion in
                    let isSelected = state.isSuggestionSelected(suggestion)
                    Button {
                        withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                            state.toggleSuggestion(suggestion)
                        }
                        toggleTrigger.toggle()
                    } label: {
                        PulpeChip(label: suggestion.name, style: isSelected ? .selected : .outlined) {
                            if !isSelected {
                                Text(suggestion.amount.asAmount(for: state.currency))
                                    .font(PulpeTypography.captionRegular)
                                    .monospacedDigit()
                                    .foregroundStyle(Color.textSecondary)
                            }
                        }
                    }
                    .plainPressedButtonStyle()
                    .accessibilityLabel("\(suggestion.name), \(suggestion.amount.asCompactCurrency(state.currency))")
                    .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
                }
            }
            .sensoryFeedback(.selection, trigger: toggleTrigger)
        }
    }
}
