import Foundation
@testable import Pulpe
import Testing

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
            DesignTokens.Opacity.pressed,
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

    // MARK: - Border Width Tokens

    @Test func borderWidthTokensArePositive() {
        #expect(DesignTokens.BorderWidth.hairline > 0)
        #expect(DesignTokens.BorderWidth.thin > 0)
        #expect(DesignTokens.BorderWidth.medium > 0)
        #expect(DesignTokens.BorderWidth.thick > 0)
    }

    @Test func borderWidthTokensAreOrdered() {
        let widths: [CGFloat] = [
            DesignTokens.BorderWidth.hairline,
            DesignTokens.BorderWidth.thin,
            DesignTokens.BorderWidth.medium,
            DesignTokens.BorderWidth.thick
        ]

        for i in 1..<widths.count {
            #expect(widths[i] > widths[i - 1])
        }
    }

    // MARK: - Icon Size Tokens

    @Test func iconSizeTokensArePositive() {
        #expect(DesignTokens.IconSize.listRow > 0)
        #expect(DesignTokens.IconSize.badge > 0)
        #expect(DesignTokens.IconSize.compact > 0)
        #expect(DesignTokens.IconSize.socialButton > 0)
    }

    // MARK: - Frame Height Tokens

    @Test func frameHeightTokensArePositive() {
        #expect(DesignTokens.FrameHeight.button > 0)
        #expect(DesignTokens.FrameHeight.tabBar > 0)
        #expect(DesignTokens.FrameHeight.progressBar > 0)
        #expect(DesignTokens.FrameHeight.separator > 0)
    }

    // MARK: - Progress Bar Tokens

    @Test func progressBarHeightsAreOrdered() {
        let heights: [CGFloat] = [
            DesignTokens.ProgressBar.height,
            DesignTokens.ProgressBar.thickHeight,
            DesignTokens.ProgressBar.heroHeight,
            DesignTokens.ProgressBar.flowBarHeight
        ]

        for i in 1..<heights.count {
            #expect(heights[i] > heights[i - 1])
        }
    }

    @Test func progressBarCircularLineWidthIsPositive() {
        #expect(DesignTokens.ProgressBar.circularLineWidth > 0)
    }

    // MARK: - Animation Durations (extended)

    @Test func animationQuickSnapFitsBetweenFastAndNormal() {
        #expect(DesignTokens.Animation.quickSnap > DesignTokens.Animation.fast)
        #expect(DesignTokens.Animation.quickSnap < DesignTokens.Animation.normal)
    }
}
