import SwiftUI

/// Shared chrome for auth input fields: capsule background, border, icon, checkmark, shadow.
private struct AuthFieldContainer<Content: View>: View {
    var systemImage: String?
    var isFocused: Bool
    var hasError: Bool
    var isFilled: Bool = false
    @ViewBuilder let content: () -> Content

    @Environment(\.colorScheme) private var colorScheme

    private var fillColor: Color {
        hasError ? Color.errorBackground : Color.authInputBackground
    }

    private var borderColor: Color {
        if hasError { return Color.errorPrimary.opacity(0.5) }
        if isFocused { return Color.pulpePrimary.opacity(0.45) }
        if isFilled { return Color.pulpePrimary.opacity(0.2) }
        return Color.authInputBorder
    }

    private var strokeWidth: CGFloat {
        (isFocused || hasError) ? 2 : 0.75
    }

    private var showCheckmark: Bool {
        isFilled && !isFocused && !hasError
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.callout)
                    .foregroundStyle(Color.authInputText.opacity(0.5))
                    .frame(width: 24)
                    .accessibilityHidden(true)
            }

            content()

            if showCheckmark {
                Image(systemName: "checkmark.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(Color.pulpePrimary.opacity(0.6))
                    .transition(.scale.combined(with: .opacity))
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .frame(height: DesignTokens.FrameHeight.button)
        .background {
            Capsule(style: .continuous)
                .fill(fillColor)
                .overlay {
                    Capsule(style: .continuous)
                        .strokeBorder(borderColor, lineWidth: strokeWidth)
                }
        }
        .shadow(colorScheme == .dark
            ? ShadowStyle(color: .black.opacity(0.01), radius: 2, y: 1)
            : DesignTokens.Shadow.input)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isFocused)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: showCheckmark)
    }
}

/// Styled text field for auth screens (login, registration).
///
/// Provides the standard auth input appearance: rounded background, focus-reactive
/// border, and lightweight shadow. Supports a "filled" state with trailing checkmark.
struct AuthTextField: View {
    let prompt: String
    @Binding var text: String
    var systemImage: String?
    var isFocused: Bool = false
    var hasError: Bool = false
    var isFilled: Bool = false

    var body: some View {
        AuthFieldContainer(
            systemImage: systemImage,
            isFocused: isFocused,
            hasError: hasError,
            isFilled: isFilled
        ) {
            TextField(prompt, text: $text)
                .font(PulpeTypography.body)
                .foregroundStyle(Color.authInputText)
        }
    }
}

/// Password variant with show/hide toggle.
///
/// Does not display a trailing checkmark — validation feedback is provided
/// by `PasswordCriteriaRow` / `PasswordMatchRow` below the field.
struct AuthSecureField: View {
    let prompt: String
    @Binding var text: String
    @Binding var isVisible: Bool
    var systemImage: String?
    var isFocused: Bool = false
    var hasError: Bool = false

    var body: some View {
        AuthFieldContainer(
            systemImage: systemImage,
            isFocused: isFocused,
            hasError: hasError
        ) {
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
            .iconButtonStyle()
            .accessibilityLabel(isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe")
        }
    }
}
