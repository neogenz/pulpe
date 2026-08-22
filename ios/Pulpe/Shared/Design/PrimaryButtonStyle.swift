import SwiftUI

/// Primary button style used across auth/onboarding flows
/// Flat `pulpePrimary` fill: the hero is the screen's only saturated element (ios/DESIGN.md §5)
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
                    Color.pulpePrimary
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

/// Icon button on the forest hero surface: a `heroDisc` under a `heroInk` glyph,
/// so the glyph keeps its contrast whatever the navigation bar's colour scheme is doing
/// (the scheme lags a tab switch; the disc does not). 44pt hit area around a 36pt disc.
struct HeroToolbarButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(PulpeTypography.labelLarge.weight(.semibold))
            .foregroundStyle(Color.heroInk)
            .frame(width: DesignTokens.IconSize.heroToolbarDisc, height: DesignTokens.IconSize.heroToolbarDisc)
            .background(Color.heroDisc, in: Circle())
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
/// Provides a rectangular content shape so the whole label frame — including
/// `Spacer` gaps between a title and a trailing chevron — stays tappable
/// (iOS 26 no longer extends the label hit region from a `.contentShape` set on
/// the button itself). Callers add an explicit `.contentShape(...)` only when a
/// non-rectangular hit area (e.g. a capsule) is required.
struct PlainPressedButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
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

    /// Icon button on the hero surface while `isOnHeroSurface`; the flat canvas states
    /// keep `iconButtonStyle()`.
    func heroToolbarButtonStyle(_ isOnHeroSurface: Bool) -> some View {
        modifier(HeroToolbarButtonModifier(isOnHeroSurface: isOnHeroSurface))
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

private struct HeroToolbarButtonModifier: ViewModifier {
    let isOnHeroSurface: Bool

    func body(content: Content) -> some View {
        if isOnHeroSurface {
            content.buttonStyle(HeroToolbarButtonStyle())
        } else {
            content.buttonStyle(IconButtonStyle())
        }
    }
}

extension ToolbarContent {
    /// On the hero surface the discs are the only shapes: hides the toolbar's own glass
    /// behind the items on iOS 26. No-op on earlier systems and on a flat canvas.
    @ToolbarContentBuilder
    func heroToolbarGroup(_ isOnHeroSurface: Bool) -> some ToolbarContent {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *), isOnHeroSurface {
            sharedBackgroundVisibility(.hidden)
        } else {
            self
        }
        #else
        self
        #endif
    }
}
