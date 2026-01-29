import XCTest
@testable import Pulpe

/// Tests for design token consistency and semantic aliases
final class DesignTokensTests: XCTestCase {

    // MARK: - Opacity Tokens

    func testOpacityTokens_areInValidRange() {
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
            XCTAssertGreaterThan(opacity, 0, "Opacity should be > 0")
            XCTAssertLessThanOrEqual(opacity, 1.0, "Opacity should be <= 1.0")
        }
    }

    func testOpacityTokens_areMonotonicallyIncreasing() {
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
            XCTAssertGreaterThanOrEqual(
                ordered[i], ordered[i - 1],
                "Opacity at index \(i) should be >= opacity at index \(i - 1)"
            )
        }
    }

    // MARK: - Animation Duration Tokens

    func testAnimationDurations_arePositive() {
        XCTAssertGreaterThan(DesignTokens.Animation.fast, 0)
        XCTAssertGreaterThan(DesignTokens.Animation.normal, 0)
        XCTAssertGreaterThan(DesignTokens.Animation.slow, 0)
    }

    func testAnimationDurations_areOrdered() {
        // Given: Animation durations
        // Then: fast < normal < slow
        XCTAssertLessThan(DesignTokens.Animation.fast, DesignTokens.Animation.normal)
        XCTAssertLessThan(DesignTokens.Animation.normal, DesignTokens.Animation.slow)
    }

    // MARK: - Spacing Tokens

    func testSpacingTokens_areOrdered() {
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
            XCTAssertGreaterThan(
                spacings[i], spacings[i - 1],
                "Spacing at index \(i) should be > spacing at index \(i - 1)"
            )
        }
    }

    // MARK: - Corner Radius Tokens

    func testCornerRadiusTokens_areOrdered() {
        let radii: [CGFloat] = [
            DesignTokens.CornerRadius.xs,
            DesignTokens.CornerRadius.sm,
            DesignTokens.CornerRadius.md,
            DesignTokens.CornerRadius.lg,
            DesignTokens.CornerRadius.xl
        ]

        for i in 1..<radii.count {
            XCTAssertGreaterThan(
                radii[i], radii[i - 1],
                "CornerRadius at index \(i) should be > radius at index \(i - 1)"
            )
        }
    }
}
