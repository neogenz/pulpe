import SwiftUI

/// Centralized design tokens for visual consistency across the app
enum DesignTokens {
    // MARK: - Tap Target

    enum TapTarget {
        /// Apple HIG minimum tap target (44pt)
        static let minimum: CGFloat = 44
    }

    // MARK: - Corner Radius

    enum CornerRadius {
        /// Progress bars, thin indicators (4pt)
        static let xs: CGFloat = 4
        /// Small elements: badges, chips (8pt)
        static let sm: CGFloat = 8
        /// Progress bars with visible rounding (10pt)
        static let progressBar: CGFloat = 10
        /// Medium elements: inputs, cards (24pt)
        static let md: CGFloat = 24
        /// Primary buttons (14pt)
        static let button: CGFloat = 14
        /// Large elements: sheets, modals (30pt)
        static let lg: CGFloat = 30
        /// Extra large: hero cards (32pt)
        static let xl: CGFloat = 32
        /// Hairline: thin separators in Form (1pt)
        static let hairline: CGFloat = 1
    }

    // MARK: - Spacing

    enum Spacing {
        static let xxs: CGFloat = 2
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
        /// Gap between form sections (onboarding)
        static let sectionGap: CGFloat = 40
        /// Top padding for step headers (onboarding)
        static let stepHeaderTop: CGFloat = 48
    }

    // MARK: - Tracking (Letter Spacing)

    enum Tracking {
        /// Large display numbers (year headers)
        static let display: CGFloat = -3
        /// Hero amounts (year recap big number)
        static let hero: CGFloat = -1.2
        /// Section titles
        static let title: CGFloat = -0.6
        /// Uppercase labels — narrow
        static let uppercaseNarrow: CGFloat = 0.5
        /// Uppercase labels — standard
        static let uppercase: CGFloat = 0.7
        /// Uppercase labels — wide
        static let uppercaseWide: CGFloat = 1
    }

    // MARK: - Border Width

    enum BorderWidth {
        static let hairline: CGFloat = 0.75
        static let thin: CGFloat = 1
        static let medium: CGFloat = 1.5
        static let thick: CGFloat = 2
    }

    // MARK: - Shadows

    enum Shadow {
        /// Subtle shadow for flat elements
        static let subtle = ShadowStyle(
            color: .black.opacity(0.05),
            radius: 2,
            y: 1
        )
        /// Standard card shadow
        static let card = ShadowStyle(
            color: .black.opacity(0.06),
            radius: 4,
            y: 2
        )
        /// Elevated elements (hero cards, modals)
        static let elevated = ShadowStyle(
            color: .black.opacity(0.08),
            radius: 8,
            y: 4
        )
        /// Input fields (auth, currency)
        static let input = ShadowStyle(
            color: .black.opacity(0.04),
            radius: 6,
            y: 2
        )
        /// Toast notifications
        static let toast = ShadowStyle(
            color: .black.opacity(0.1),
            radius: 8,
            y: 4
        )
    }

    // MARK: - Opacity

    enum Opacity {
        /// Barely visible tints
        static let faint: Double = 0.04
        /// Subtle highlight backgrounds
        static let highlightBackground: Double = 0.08
        /// Toast shadow, subtle borders
        static let shadow: Double = 0.1
        /// Badge and chip backgrounds, icon backgrounds
        static let badgeBackground: Double = 0.12
        /// Sparkline fills, accent highlights
        static let accent: Double = 0.15
        /// Secondary fills, progress tracks
        static let secondary: Double = 0.2
        /// Glow effects, shadows
        static let glow: Double = 0.25
        /// Strong accents, selected states
        static let strong: Double = 0.3
        /// Heavy overlays
        static let heavy: Double = 0.5
        /// Pressed state for interactive elements
        static let pressed: Double = 0.8
        /// Dark overlays (tutorial, modal backdrops)
        static let overlay: Double = 0.85
    }

    // MARK: - Icon Sizes

    enum IconSize {
        /// List row icons
        static let listRow: CGFloat = 40
        /// Compact badges
        static let badge: CGFloat = 36
        /// Small inline icons
        static let compact: CGFloat = 28
        /// Widget action button (plus circle in widget footers)
        static let widgetAction: CGFloat = 44
        /// Social login button icons (Apple logo, Google logo)
        static let socialButton: CGFloat = 20
    }

    // MARK: - List Row

    enum ListRow {
        /// Vertical padding for all list/transaction/budget rows
        static let verticalPadding: CGFloat = 8
    }

    // MARK: - Animation

    enum Animation {
        // MARK: - Duration

        static let fast: Double = 0.2
        static let quickSnap: Double = 0.25
        static let normal: Double = 0.3
        static let slow: Double = 0.5

        // MARK: - Stagger

        static let staggerStep: Double = 0.05

        // MARK: - Spring Configurations

        static let springResponse: Double = 0.5
        static let springDamping: Double = 0.8

        static var defaultSpring: SwiftUI.Animation {
            .spring(response: springResponse, dampingFraction: springDamping)
        }

        static var gentleSpring: SwiftUI.Animation {
            .spring(response: 0.6, dampingFraction: 0.85)
        }

        static var bouncySpring: SwiftUI.Animation {
            .spring(response: 0.4, dampingFraction: 0.65)
        }

        static var entranceSpring: SwiftUI.Animation {
            .spring(response: 0.6, dampingFraction: 0.8)
        }

        // MARK: - Easing

        static var smoothEaseOut: SwiftUI.Animation {
            .easeOut(duration: normal)
        }

        static var smoothEaseInOut: SwiftUI.Animation {
            .easeInOut(duration: normal)
        }

        // MARK: - Step Transitions

        static var stepTransition: SwiftUI.Animation {
            .spring(response: 0.5, dampingFraction: 0.85)
        }

        static var iconEntrance: SwiftUI.Animation {
            .spring(response: 0.5, dampingFraction: 0.7)
        }

        // MARK: - Toast

        static var toastEntrance: SwiftUI.Animation {
            .spring(response: 0.4, dampingFraction: 0.7)
        }

        static var toastDismiss: SwiftUI.Animation {
            .easeOut(duration: fast)
        }

        static let pulseDuration: Double = 0.6

        static var pulse: SwiftUI.Animation {
            .easeInOut(duration: pulseDuration).repeatForever(autoreverses: true)
        }

        // MARK: - Skeleton

        /// Minimum skeleton display time to prevent jarring flash on fast loads
        static let skeletonMinimumDuration: Duration = .milliseconds(400)

        /// Waits until at least the minimum skeleton duration has elapsed since `start`.
        /// Call after an async fetch that was preceded by showing a skeleton.
        /// - Important: Throws `CancellationError` if the task is cancelled during the wait.
        static func ensureMinimumSkeletonTime(since start: ContinuousClock.Instant) async throws {
            let elapsed = ContinuousClock.now - start
            if elapsed < skeletonMinimumDuration {
                try await Task.sleep(for: skeletonMinimumDuration - elapsed)
            }
        }
    }

    // MARK: - Frame Heights

    enum FrameHeight {
        /// Primary action buttons
        static let button: CGFloat = 54
        /// Custom floating tab bar
        static let tabBar: CGFloat = 62
        /// Progress bar track
        static let progressBar: CGFloat = 8
        /// Thin separator lines
        static let separator: CGFloat = 1
    }

    // MARK: - Numpad

    enum Numpad {
        static let buttonSize: CGFloat = 75
        static let dotSize: CGFloat = 14
    }

    // MARK: - Checkbox

    enum Checkbox {
        static let size: CGFloat = 24
    }

    // MARK: - Amount Input

    enum AmountInput {
        static let quickAmounts = [10, 15, 20, 30]
        static let currencyCode = "CHF"
    }

    // MARK: - Blur

    enum Blur {
        /// Height of the gradient fade at the bottom of scrollable content
        static let bottomFadeHeight: CGFloat = 80
        /// Height of the gradient fade at the top (under progress indicator)
        static let topFadeHeight: CGFloat = 48
    }

    // MARK: - Progress Bar

    enum ProgressBar {
        /// Standard thin progress bar height
        static let height: CGFloat = 5
        /// Thick progress bar height
        static let thickHeight: CGFloat = 8
        /// Circular progress stroke width
        static let circularLineWidth: CGFloat = 6
        /// Hero card progress bar height (larger for visibility on colored backgrounds)
        static let heroHeight: CGFloat = 10
    }
}

// MARK: - Shadow Style

struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let y: CGFloat

    var x: CGFloat { 0 }
}

// MARK: - View Modifier

extension View {
    func shadow(_ style: ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
}
