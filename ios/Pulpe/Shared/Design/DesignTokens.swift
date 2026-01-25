import SwiftUI

/// Centralized design tokens for visual consistency across the app
enum DesignTokens {

    // MARK: - Corner Radius

    enum CornerRadius {
        /// Small elements: badges, chips (8pt)
        static let sm: CGFloat = 8
        /// Medium elements: cards, inputs, buttons (12pt)
        static let md: CGFloat = 12
        /// Large elements: sheets, modals (16pt)
        static let lg: CGFloat = 16
        /// Extra large: hero cards (20pt)
        static let xl: CGFloat = 20
    }

    // MARK: - Spacing

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        /// Offset for floating elements above standard tab bar (iOS < 26)
        static let tabBarFloatingOffset: CGFloat = 60
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
    }

    // MARK: - Opacity

    enum Opacity {
        /// Badge and chip backgrounds
        static let badgeBackground: Double = 0.12
        /// Subtle highlight backgrounds
        static let highlightBackground: Double = 0.08
    }

    // MARK: - Icon Sizes

    enum IconSize {
        /// List row icons
        static let listRow: CGFloat = 40
        /// Compact badges
        static let badge: CGFloat = 36
        /// Small inline icons
        static let compact: CGFloat = 28
    }

    // MARK: - Progress Bar

    enum ProgressBar {
        /// Standard thin progress bar height
        static let height: CGFloat = 3
        /// Thick progress bar height
        static let thickHeight: CGFloat = 8
        /// Circular progress stroke width
        static let circularLineWidth: CGFloat = 6
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
