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
                    Color.primaryContainerDisabled
                }
            }
            .foregroundStyle(isEnabled ? Color.textOnPrimary : Color.onSurfaceVariant)
            .clipShape(Capsule())
            .contentShape(Capsule())
            .overlay {
                if !isEnabled {
                    Capsule()
                        .strokeBorder(Color.outlineVariant, lineWidth: DesignTokens.BorderWidth.thin)
                }
            }
            .opacity(isEnabled && configuration.isPressed ? DesignTokens.Opacity.pressed : 1.0)
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
            .contentShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(Color.outlineVariant, lineWidth: DesignTokens.BorderWidth.thin)
            )
            .opacity(configuration.isPressed ? DesignTokens.Opacity.pressed : 1.0)
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
            .contentShape(Capsule())
            .opacity(configuration.isPressed ? DesignTokens.Opacity.pressed : 1.0)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: configuration.isPressed)
    }
}

/// Icon-only button style (eye toggle, dismiss X, delete, chart)
/// Guarantees 44×44pt minimum tap target with transparent background.
struct IconButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(minWidth: DesignTokens.TapTarget.minimum, minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .opacity(configuration.isPressed ? DesignTokens.Opacity.pressed : 1.0)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: configuration.isPressed)
    }
}

/// Text-link button style (forgot password, create account, see-all links)
/// Provides pressed feedback and extends hit area to full frame.
/// Callers are responsible for sizing (padding, frame) — the style does not enforce 44pt.
struct TextLinkButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
            .opacity(configuration.isPressed ? DesignTokens.Opacity.pressed : 1.0)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: configuration.isPressed)
    }
}

/// Plain button style with pressed-state opacity feedback.
/// Use when the label already defines its own layout and content shape.
struct PlainPressedButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? DesignTokens.Opacity.pressed : 1.0)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: configuration.isPressed)
    }
}

/// Circle icon button style (chart button on hero card, circular toggles)
/// Guarantees 44×44pt minimum tap target with circular hit area.
struct CircleIconButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(minWidth: DesignTokens.TapTarget.minimum, minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Circle())
            .opacity(configuration.isPressed ? DesignTokens.Opacity.pressed : 1.0)
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

    /// Applies icon-only button styling (44×44pt minimum tap target)
    func iconButtonStyle() -> some View {
        self.buttonStyle(IconButtonStyle())
    }

    /// Applies text-link button styling (44pt minimum tap height)
    func textLinkButtonStyle() -> some View {
        self.buttonStyle(TextLinkButtonStyle())
    }

    /// Applies plain button styling with pressed feedback only (no layout/shape constraints)
    func plainPressedButtonStyle() -> some View {
        self.buttonStyle(PlainPressedButtonStyle())
    }

    /// Applies circle icon button styling (44×44pt minimum tap target, circular hit area)
    func circleIconButtonStyle() -> some View {
        self.buttonStyle(CircleIconButtonStyle())
    }
}
