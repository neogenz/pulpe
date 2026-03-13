import SwiftUI

/// Composite view: PIN dots + optional error message with animated transition.
/// Replaces duplicated VStack pattern across PinEntry, PinSetup, PinRecovery, and ChangePin views.
struct PinDotsErrorView: View {
    let enteredCount: Int
    let maxDigits: Int
    let isError: Bool
    let errorMessage: String?

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            PinDotsView(
                enteredCount: enteredCount,
                maxDigits: maxDigits,
                isError: isError
            )

            if let errorMessage {
                Text(errorMessage)
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.errorPrimary)
                    .transition(.opacity)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Code PIN")
        .accessibilityValue(accessibilityDescription)
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: errorMessage)
    }

    private var accessibilityDescription: String {
        var description = "\(enteredCount) chiffres sur \(maxDigits) saisis"
        if let errorMessage {
            description += ". \(errorMessage)"
        }
        return description
    }
}
