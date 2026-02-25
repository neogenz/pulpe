import SwiftUI

/// Styled text field for auth screens (login, registration).
///
/// Provides the standard auth input appearance: rounded background, focus-reactive
/// border, shadow, and subtle scale animation.
struct AuthTextField: View {
    let prompt: String
    @Binding var text: String
    var isFocused: Bool = false
    var hasError: Bool = false

    var body: some View {
        TextField(prompt, text: $text)
            .font(PulpeTypography.body)
            .foregroundStyle(Color.authInputText)
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .frame(height: DesignTokens.FrameHeight.button)
            .background {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
                    .fill(hasError ? Color.errorBackground : Color.authInputBackground)
                    .overlay {
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
                            .strokeBorder(borderColor, lineWidth: (isFocused || hasError) ? 2 : 1)
                    }
            }
            .shadow(
                color: isFocused ? Color.pulpePrimary.opacity(0.2) : Color.black.opacity(0.05),
                radius: isFocused ? 12 : 4,
                y: 4
            )
            .scaleEffect(isFocused ? 1.01 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isFocused)
    }

    private var borderColor: Color {
        if hasError {
            return Color.errorPrimary.opacity(0.5)
        }
        return isFocused ? Color.pulpePrimary.opacity(0.6) : Color.authInputBorder
    }
}

/// Password variant with show/hide toggle.
struct AuthSecureField: View {
    let prompt: String
    @Binding var text: String
    @Binding var isVisible: Bool
    var isFocused: Bool = false
    var hasError: Bool = false

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Group {
                if isVisible {
                    TextField(prompt, text: $text)
                } else {
                    SecureField(prompt, text: $text)
                }
            }
            .font(PulpeTypography.body)
            .foregroundStyle(Color.authInputText)

            Button {
                withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                    isVisible.toggle()
                }
            } label: {
                Image(systemName: isVisible ? "eye.slash.fill" : "eye.fill")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.authInputText.opacity(0.6))
                    .contentTransition(.symbolEffect(.replace))
            }
            .accessibilityLabel(isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe")
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .frame(height: DesignTokens.FrameHeight.button)
        .background {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
                .fill(hasError ? Color.errorBackground : Color.authInputBackground)
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
                        .strokeBorder(borderColor, lineWidth: (isFocused || hasError) ? 2 : 1)
                }
        }
        .shadow(
            color: isFocused ? Color.pulpePrimary.opacity(0.2) : Color.black.opacity(0.05),
            radius: isFocused ? 12 : 4,
            y: 4
        )
        .scaleEffect(isFocused ? 1.01 : 1)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isFocused)
    }

    private var borderColor: Color {
        if hasError {
            return Color.errorPrimary.opacity(0.5)
        }
        return isFocused ? Color.pulpePrimary.opacity(0.6) : Color.authInputBorder
    }
}
