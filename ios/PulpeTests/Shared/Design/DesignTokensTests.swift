import Foundation
import Testing
@testable import Pulpe

struct DesignTokensTests {

    // MARK: - Opacity Tokens

    @Test func opacityTokensAreInValidRange() {
        let opacities: [Double] = [
            DesignTokens.Opacity.faint,
            DesignTokens.Opacity.highlightBackground,
            DesignTokens.Opacity.shadow,
            DesignTokens.Opacity.badgeBackground,
            DesignTokens.Opacity.accent,
            DesignTokens.Opacity.secondary,
            DesignTokens.Opacity.glow,
            DesignTokens.Opacity.strong,
            DesignTokens.Opacity.heavy,
            DesignTokens.Opacity.overlay
        ]

        for opacity in opacities {
            #expect(opacity > 0)
            #expect(opacity <= 1.0)
        }
    }

    @Test func opacityTokensAreMonotonicallyIncreasing() {
        // Given: Opacity tokens ordered from faintest to most opaque
        let ordered: [Double] = [
            DesignTokens.Opacity.faint,
            DesignTokens.Opacity.highlightBackground,
            DesignTokens.Opacity.shadow,
            DesignTokens.Opacity.badgeBackground,
            DesignTokens.Opacity.accent,
            DesignTokens.Opacity.secondary,
            DesignTokens.Opacity.glow,
            DesignTokens.Opacity.strong,
            DesignTokens.Opacity.heavy,
            DesignTokens.Opacity.overlay
        ]

        // Then: Each should be >= the previous
        for i in 1..<ordered.count {
            #expect(ordered[i] >= ordered[i - 1])
        }
    }

    // MARK: - Animation Duration Tokens

    @Test func animationDurationsArePositive() {
        #expect(DesignTokens.Animation.fast > 0)
        #expect(DesignTokens.Animation.normal > 0)
        #expect(DesignTokens.Animation.slow > 0)
    }

    @Test func animationDurationsAreOrdered() {
        // Given: Animation durations
        // Then: fast < normal < slow
        #expect(DesignTokens.Animation.fast < DesignTokens.Animation.normal)
        #expect(DesignTokens.Animation.normal < DesignTokens.Animation.slow)
    }

    // MARK: - Spacing Tokens

    @Test func spacingTokensAreOrdered() {
        let spacings: [CGFloat] = [
            DesignTokens.Spacing.xs,
            DesignTokens.Spacing.sm,
            DesignTokens.Spacing.md,
            DesignTokens.Spacing.lg,
            DesignTokens.Spacing.xl,
            DesignTokens.Spacing.xxl,
            DesignTokens.Spacing.xxxl
        ]

        for i in 1..<spacings.count {
            #expect(spacings[i] > spacings[i - 1])
        }
    }

    // MARK: - Corner Radius Tokens

    @Test func cornerRadiusTokensAreOrdered() {
        let radii: [CGFloat] = [
            DesignTokens.CornerRadius.xs,
            DesignTokens.CornerRadius.sm,
            DesignTokens.CornerRadius.md,
            DesignTokens.CornerRadius.lg,
            DesignTokens.CornerRadius.xl
        ]

        for i in 1..<radii.count {
            #expect(radii[i] > radii[i - 1])
        }
    }
}
