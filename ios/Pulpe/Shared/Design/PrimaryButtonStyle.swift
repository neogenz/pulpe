import SwiftUI

/// Primary button style used across auth/onboarding flows
/// Provides consistent styling with gradient background and proper disabled state
struct PrimaryButtonStyle: ButtonStyle {
    let isEnabled: Bool

    init(isEnabled: Bool = true) {
        self.isEnabled = isEnabled
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(PulpeTypography.buttonPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background {
                if isEnabled {
                    Color.onboardingGradient
                } else {
                    Color.pulpePrimary.opacity(0.12)
                }
            }
            .foregroundStyle(isEnabled ? Color.textOnPrimary : Color.onSurfaceVariant)
            .clipShape(Capsule())
            .overlay {
                if !isEnabled {
                    Capsule()
                        .strokeBorder(Color.pulpePrimary.opacity(0.2), lineWidth: 1)
                }
            }
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: configuration.isPressed)
    }
}

/// Secondary button style for cancel/back actions
struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(PulpeTypography.buttonPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .foregroundStyle(Color.textPrimaryOnboarding)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Color.pulpeTextTertiary, lineWidth: 1.5)
            )
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: configuration.isPressed)
    }
}

/// Destructive button style for irreversible actions (delete account, danger zones)
struct DestructiveButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(PulpeTypography.buttonPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(Color.destructivePrimary)
            .foregroundStyle(Color.textOnPrimary)
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: configuration.isPressed)
    }
}

// MARK: - View Extension

extension View {
    /// Applies primary button styling
    func primaryButtonStyle(isEnabled: Bool = true) -> some View {
        self.buttonStyle(PrimaryButtonStyle(isEnabled: isEnabled))
    }

    /// Applies secondary button styling
    func secondaryButtonStyle() -> some View {
        self.buttonStyle(SecondaryButtonStyle())
    }

    /// Applies destructive button styling
    func destructiveButtonStyle() -> some View {
        self.buttonStyle(DestructiveButtonStyle())
    }
}
