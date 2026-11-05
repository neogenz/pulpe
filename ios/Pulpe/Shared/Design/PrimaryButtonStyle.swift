import SwiftUI

/// Height variants of the capsule buttons (V2: 52pt regular, 40pt small).
enum PulpeButtonSize {
    case regular
    case small

    fileprivate var height: CGFloat {
        switch self {
        case .regular: DesignTokens.FrameHeight.button
        case .small: DesignTokens.FrameHeight.buttonSmall
        }
    }

    fileprivate var font: Font {
        switch self {
        case .regular: PulpeTypography.buttonPrimary
        case .small: PulpeTypography.chipLabel
        }
    }

    fileprivate var horizontalPadding: CGFloat {
        switch self {
        case .regular: DesignTokens.Spacing.none
        case .small: DesignTokens.Spacing.lg
        }
    }
}

/// Press feedback shared by the V2 buttons: a 0.96 scale, none under Reduce Motion.
private struct PulpePressFeedback: ViewModifier {
    let isPressed: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed && !reduceMotion ? DesignTokens.Animation.pressedButtonScale : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: DesignTokens.Animation.fast), value: isPressed)
    }
}

/// Shared capsule recipe of the V2 buttons: a label centred in a filled capsule. Never black.
private struct CapsuleButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let size: PulpeButtonSize
    let fill: Color
    let foreground: Color

    var body: some View {
        configuration.label
            .font(size.font)
            .padding(.horizontal, size.horizontalPadding)
            .frame(maxWidth: size == .regular ? .infinity : nil)
            .frame(height: size.height)
            .foregroundStyle(foreground)
            .background(fill, in: Capsule())
            // The visual stays 40pt for the small variant; the hit area never drops below 44.
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Capsule())
            .modifier(PulpePressFeedback(isPressed: configuration.isPressed))
    }
}

/// Primary button: `pulpePrimary` fill, white label. The one filled action of a screen.
struct PrimaryButtonStyle: ButtonStyle {
    let isEnabled: Bool
    var size: PulpeButtonSize = .regular

    init(isEnabled: Bool = true, size: PulpeButtonSize = .regular) {
        self.isEnabled = isEnabled
        self.size = size
    }

    func makeBody(configuration: Configuration) -> some View {
        CapsuleButtonBody(
            configuration: configuration,
            size: size,
            fill: isEnabled ? Color.pulpePrimary : Color.primaryContainerDisabled,
            foreground: isEnabled ? Color.textOnPrimary : Color.onSurfaceVariant
        )
    }
}

/// Secondary button: pale green fill, deep green label, no outline.
struct SecondaryButtonStyle: ButtonStyle {
    var size: PulpeButtonSize = .regular

    func makeBody(configuration: Configuration) -> some View {
        CapsuleButtonBody(
            configuration: configuration,
            size: size,
            fill: Color.accentWash,
            foreground: Color.accentInk
        )
    }
}

/// Tertiary button: green text on nothing, 44pt tall.
struct TertiaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(PulpeTypography.buttonPrimary)
            .foregroundStyle(Color.pulpePrimary)
            .frame(maxWidth: .infinity)
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .modifier(PulpePressFeedback(isPressed: configuration.isPressed))
    }
}

/// Destructive button: pale red fill, red label. Red is reserved for deleting.
struct DestructiveButtonStyle: ButtonStyle {
    var size: PulpeButtonSize = .regular

    func makeBody(configuration: Configuration) -> some View {
        CapsuleButtonBody(
            configuration: configuration,
            size: size,
            fill: Color.destructiveBackground,
            foreground: Color.destructivePrimary
        )
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
    /// Applies primary button styling (green fill, 52pt; `.small` is 40pt)
    func primaryButtonStyle(isEnabled: Bool = true, size: PulpeButtonSize = .regular) -> some View {
        self.buttonStyle(PrimaryButtonStyle(isEnabled: isEnabled, size: size))
    }

    /// Applies secondary button styling (pale green fill, no outline)
    func secondaryButtonStyle(size: PulpeButtonSize = .regular) -> some View {
        self.buttonStyle(SecondaryButtonStyle(size: size))
    }

    /// Applies tertiary button styling (green text, 44pt)
    func tertiaryButtonStyle() -> some View {
        self.buttonStyle(TertiaryButtonStyle())
    }

    /// Applies destructive button styling (pale red fill, red label)
    func destructiveButtonStyle(size: PulpeButtonSize = .regular) -> some View {
        self.buttonStyle(DestructiveButtonStyle(size: size))
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

    /// Hero under the navigation bar: no bar background, and on iOS 26 the soft
    /// scroll-edge effect, pinned — the hard one rules a hairline across the forest on scroll.
    /// Light ink while `isOnHeroSurface`, the screen's own ink otherwise.
    func heroNavigationBar(isOnHeroSurface: Bool) -> some View {
        modifier(HeroNavigationBarModifier(isOnHeroSurface: isOnHeroSurface))
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

private struct HeroNavigationBarModifier: ViewModifier {
    let isOnHeroSurface: Bool
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        // Named off the forest, never nil: going back to nil leaves the bar's light ink on.
        let bare = content
            .toolbarColorScheme(isOnHeroSurface ? .dark : colorScheme, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            bare.scrollEdgeEffectStyle(.soft, for: .top)
        } else {
            bare
        }
        #else
        bare
        #endif
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
