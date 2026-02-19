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
            .font(.custom("Manrope-SemiBold", size: 17, relativeTo: .body))
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background {
                if isEnabled {
                    Color.onboardingGradient
                } else {
                    Color.surfaceCard
                }
            }
            .foregroundStyle(isEnabled ? Color.textOnPrimary : Color.textSecondaryOnboarding)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

/// Secondary button style for cancel/back actions
struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.custom("Manrope-SemiBold", size: 17, relativeTo: .body))
            .frame(maxWidth: .infinity)
            .frame(height: DesignTokens.FrameHeight.button)
            .background(Color.surfaceCard)
            .foregroundStyle(Color.textPrimaryOnboarding)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
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
}
